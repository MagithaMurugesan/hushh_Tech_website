import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Container, Heading, Text, Spinner, Button, Flex, Icon, Alert, AlertIcon } from '@chakra-ui/react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import config from '../resources/config/config';
import { searchProfile, mapToOnboardingFields } from '../services/profileSearch';
import { isPrivateRelayEmail } from '../utils/emailUtils';
import { DEFAULT_AUTH_REDIRECT, sanitizeInternalRedirect } from '../utils/security';


// Helper function to enrich user profile in background (non-blocking)
async function enrichUserProfile(userId: string, email: string, fullName: string, supabase: any) {
  try {
    console.log('[AuthCallback][ProfileEnrich] Starting profile enrichment for:', fullName);
    
    // Call the AI-powered profile search API
    const result = await searchProfile({ 
      name: fullName, 
      email: email 
    });
    
    if (!result.success || !result.data) {
      console.log('[AuthCallback][ProfileEnrich] No profile data found or API error:', result.error);
      return;
    }
    
    const enrichedData = result.data;
    console.log('[AuthCallback][ProfileEnrich] Got enriched data with confidence:', enrichedData.confidence);
    
    // Save enriched profile to user_enriched_profiles table
    const { error: enrichError } = await supabase
      .from('user_enriched_profiles')
      .upsert({
        user_id: userId,
        age: enrichedData.age || null,
        dob: enrichedData.dob || null,
        address: enrichedData.address || null,
        phone: enrichedData.phone || null,
        occupation: enrichedData.occupation || null,
        nationality: enrichedData.nationality || null,
        marital_status: enrichedData.maritalStatus || null,
        preferences: enrichedData.preferences || null,
        confidence: enrichedData.confidence || 0,
        net_worth_score: enrichedData.netWorthScore || 0,
        net_worth_context: enrichedData.netWorthContext || null,
        sources: enrichedData.sources || [],
        field_sources: {
          // Track which fields are AI-detected vs user-provided
          age: 'ai_detected',
          dob: 'ai_detected',
          address: 'ai_detected',
          phone: 'ai_detected',
          occupation: 'ai_detected',
          nationality: 'ai_detected',
          marital_status: 'ai_detected',
          preferences: 'ai_detected',
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
    
    if (enrichError) {
      console.error('[AuthCallback][ProfileEnrich] Error saving enriched profile:', enrichError);
      return;
    }
    
    console.log('[AuthCallback][ProfileEnrich] Saved enriched profile to database');
    
    // Pre-fill onboarding_data with mapped fields if confidence is good
    if (enrichedData.confidence >= 0.4) {
      const mappedFields = mapToOnboardingFields(enrichedData);
      
      if (Object.keys(mappedFields).length > 0) {
        console.log('[AuthCallback][ProfileEnrich] Pre-filling onboarding with:', Object.keys(mappedFields));
        
        // Check if onboarding record exists
        const { data: existingOnboarding } = await supabase
          .from('onboarding_data')
          .select('id')
          .eq('user_id', userId)
          .single();
        
        if (existingOnboarding) {
          // Update existing record with AI-detected fields (only if not already filled)
          const { error: updateError } = await supabase
            .from('onboarding_data')
            .update({
              ...mappedFields,
              ai_prefilled: true,
              ai_prefilled_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            // Only update fields that are null/empty
            .is('citizenship_country', null);
          
          if (updateError) {
            console.log('[AuthCallback][ProfileEnrich] Could not update onboarding (may already have data):', updateError.message);
          }
        } else {
          // Create new onboarding record with AI-detected fields
          const { error: insertError } = await supabase
            .from('onboarding_data')
            .insert({
              user_id: userId,
              ...mappedFields,
              ai_prefilled: true,
              ai_prefilled_at: new Date().toISOString(),
              current_step: 1,
              is_completed: false,
            });
          
          if (insertError) {
            console.log('[AuthCallback][ProfileEnrich] Could not create onboarding:', insertError.message);
          }
        }
      }
    }
    
    console.log('[AuthCallback][ProfileEnrich] Profile enrichment complete!');
  } catch (error) {
    console.error('[AuthCallback][ProfileEnrich] Exception during enrichment:', error);
    // Non-blocking - don't throw, just log
  }
}


const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get custom redirect from URL param (for Hushh AI and other modules)
  const redirectParam = searchParams.get('redirect');
  const customRedirect = redirectParam
    ? sanitizeInternalRedirect(redirectParam, DEFAULT_AUTH_REDIRECT)
    : null;

  // Helper to determine final redirect destination
  const getRedirectDestination = (hasCompletedOnboarding: boolean) => {
    // If custom redirect is set (e.g., /hushh-ai), use it
    if (customRedirect) return customRedirect;
    // Otherwise, default behavior: onboarding or profile
    return hasCompletedOnboarding ? '/hushh-user-profile' : '/onboarding/financial-link';
  };

  const queueWelcomeToast = (userId?: string | null) => {
    sessionStorage.setItem('showWelcomeToast', 'true');
    if (userId) {
      sessionStorage.setItem('showWelcomeToastUserId', userId);
      return;
    }
    sessionStorage.removeItem('showWelcomeToastUserId');
  };

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        const supabase = config.supabaseClient;
        if (!supabase) {
          setVerificationStatus('error');
          setErrorMessage('Configuration error');
          console.error('[Hushh][AuthCallback] Supabase client missing - cannot restore session');
          return;
        }

        // Always clear stale toast flags; set again only on successful auth restore.
        sessionStorage.removeItem('showWelcomeToast');
        sessionStorage.removeItem('showWelcomeToastUserId');

        // Check for any type and error from the URL
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        const code = searchParams.get('code');
        console.info('[Hushh][AuthCallback] Callback hit', { type, hasCode: !!code, hasError: !!error, customRedirect });

        // If there's an error, display it
        if (error) {
          setVerificationStatus('error');
          setErrorMessage(errorDescription || 'An error occurred during verification');
          console.error('[Hushh][AuthCallback] OAuth error', { error, errorDescription });
          return;
        }

        // Handle OAuth code exchange (Apple/PKCE) so we actually get a session/JWT on Safari/iOS
        if (code) {
          const { data: existingSession } = await supabase.auth.getSession();
          if (!existingSession.session) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              setVerificationStatus('error');
              setErrorMessage(exchangeError.message);
              console.error('[Hushh][AuthCallback] Code exchange failed', exchangeError);
              return;
            }
            console.info('[Hushh][AuthCallback] Code exchange succeeded, session created');
          }

          // Clean the URL to avoid re-exchanging the same code on refresh
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        // If it's a signup confirmation
        if (type === 'signup') {
          // Get the access token and refresh token from the URL
          const accessToken = searchParams.get('access_token');
          const refreshToken = searchParams.get('refresh_token');

          if (!accessToken || !refreshToken) {
            setVerificationStatus('error');
            setErrorMessage('Missing authentication tokens');
            console.error('[Hushh][AuthCallback] Missing tokens in signup callback');
            return;
          }

          // Set the session with Supabase
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            setVerificationStatus('error');
            setErrorMessage(error.message);
            console.error('[Hushh][AuthCallback] setSession failed', error);
            return;
          }

          // Get the current user
          const { data: { user } } = await supabase.auth.getUser() || { data: { user: null } };

          if (!user) {
            setVerificationStatus('error');
            setErrorMessage('Could not retrieve user information');
            console.error('[Hushh][AuthCallback] No user after setSession');
            return;
          }

          // Check if user has completed onboarding
          const { data: onboardingData } = await supabase
            ?.from('onboarding_data')
            .select('is_completed, current_step')
            .eq('user_id', user.id)
            .single() || { data: null };

          // 🚀 Fire-and-forget: Enrich user profile with AI-powered web intelligence
          // This runs in the background and doesn't block the auth flow
          // For Apple Private Relay emails, don't use email prefix as name (it's garbage like "abc123")
          const isRelay = isPrivateRelayEmail(user.email);
          const fullName = user.user_metadata?.full_name || (isRelay ? '' : (user.email?.split('@')[0] || ''));
          if (fullName && user.email && !isRelay) {
            enrichUserProfile(user.id, user.email, fullName, supabase).catch(() => {});
          } else if (fullName && user.email) {
            // Relay user with real name from metadata — still enrich but skip email-based search
            enrichUserProfile(user.id, '', fullName, supabase).catch(() => {});
          }

          // Proceed to success/redirect directly (no MFA check)
          queueWelcomeToast(user.id);
          setVerificationStatus('success');
          setTimeout(() => {
            const hasCompletedOnboarding = onboardingData?.is_completed ?? false;
            navigate(getRedirectDestination(hasCompletedOnboarding));
          }, 1200);

        } else {
          // Handle other auth types (OAuth, etc.)
          // If a session is already present (e.g., implicit flow), this will return it
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            setVerificationStatus('error');
            setErrorMessage(sessionError.message);
            console.error('[Hushh][AuthCallback] getSession error', sessionError);
            return;
          }

          if (!session) {
            setVerificationStatus('error');
            setErrorMessage('No active session found. Please try signing in again.');
            console.error('[Hushh][AuthCallback] No active session after callback');
            return;
          }

          // Get the current user
          const { data: { user } } = await supabase.auth.getUser() || { data: { user: null } };

          if (user) {
            // Check if user has completed onboarding
            const { data: onboardingData } = await supabase
              .from('onboarding_data')
              .select('is_completed, current_step')
              .eq('user_id', user.id)
              .maybeSingle(); // Use maybeSingle() to handle cases where no record exists
            console.info('[Hushh][AuthCallback] Session restored', { userId: user.id, email: user.email, onboardingFound: !!onboardingData });

            // 🚀 Fire-and-forget: Enrich user profile with AI-powered web intelligence
            // This runs in the background and doesn't block the auth flow
            // For Apple Private Relay emails, don't use email prefix as name (it's garbage like "abc123")
            const isRelayOAuth = isPrivateRelayEmail(user.email);
            const fullName = user.user_metadata?.full_name || (isRelayOAuth ? '' : (user.email?.split('@')[0] || ''));
            if (fullName && user.email && !isRelayOAuth) {
              enrichUserProfile(user.id, user.email, fullName, supabase).catch(() => {});
            } else if (fullName && user.email) {
              enrichUserProfile(user.id, '', fullName, supabase).catch(() => {});
            }

            // Proceed to success/redirect directly (no MFA check)
            console.log('[AuthCallback] Proceeding to redirect (2FA disabled)');
            queueWelcomeToast(user.id);
            setVerificationStatus('success');
            setTimeout(() => {
              const hasCompletedOnboarding = onboardingData?.is_completed ?? false;
              navigate(getRedirectDestination(hasCompletedOnboarding));
            }, 1200);

          } else {
            setVerificationStatus('success');
            setTimeout(() => {
              navigate(getRedirectDestination(false));
            }, 1200);

          }
        }
      } catch (err) {
        console.error('Verification error:', err);
        setVerificationStatus('error');
        setErrorMessage('An unexpected error occurred');
      }
    };

    handleEmailVerification();
  }, [searchParams, navigate]);

  const redirectToLogin = () => {
    navigate('/login');
  };

  const redirectToHome = () => {
    navigate('/');
  };

  return (
    <Container maxW="container.md" py={12}>
      <Box
        borderWidth="1px"
        borderRadius="lg"
        p={8}
        boxShadow="lg"
        bg="white"
        textAlign="center"
      >
        {verificationStatus === 'loading' && (
          <Flex direction="column" align="center" py={10}>
            <Spinner size="xl" color="#0AADBC" thickness="4px" speed="0.65s" mb={6} />
            <Heading size="lg" mb={4}>Verifying your email...</Heading>
            <Text color="gray.600">Please wait while we confirm your email address.</Text>
          </Flex>
        )}

        {verificationStatus === 'success' && (
          <Flex direction="column" align="center" py={6}>
            <Icon as={CheckCircle} w={16} h={16} color="green.500" mb={6} />
            <Heading size="lg" mb={4}>Welcome to HushhTech!</Heading>
            <Text color="gray.600" mb={8}>
              Your email has been successfully verified. You can now set up your profile and start exploring the community.
            </Text>
            <Flex gap={4}>
              <Button
                colorScheme="green"
                size="lg"
                onClick={() => navigate('/user-registration')}
              >
                Set us your profile
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/community')}
              >
                Checkout communnity posts
              </Button>
            </Flex>
          </Flex>
        )}

        {verificationStatus === 'error' && (
          <Flex direction="column" align="center" py={6}>
            <Icon as={AlertTriangle} w={16} h={16} color="red.500" mb={6} />
            <Heading size="lg" mb={4}>Verification Failed</Heading>
            <Alert status="error" mb={6}>
              <AlertIcon />
              {errorMessage || 'There was an error verifying your email. Please try again.'}
            </Alert>
            <Flex gap={4}>
              <Button
                colorScheme="blue"
                size="lg"
                onClick={redirectToLogin}
              >
                Try Logging In
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={redirectToHome}
              >
                Go to Home
              </Button>
            </Flex>
          </Flex>
        )}
      </Box>
    </Container>
  );
};

export default AuthCallback;
