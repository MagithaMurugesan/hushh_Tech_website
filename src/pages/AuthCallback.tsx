import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Container, Heading, Text, Spinner, Button, Flex, Icon, Alert, AlertIcon } from '@chakra-ui/react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import config from '../resources/config/config';
import { DEFAULT_AUTH_REDIRECT, sanitizeInternalRedirect } from '../utils/security';


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
