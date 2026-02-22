/**
 * FinancialLink — Pre-Onboarding Financial Verification
 * 
 * Apple-inspired clean UI wrapper. White background theme.
 * First step in the onboarding flow (before Step 1).
 * 
 * Links user's bank via Plaid and fetches:
 * 1. Balance  2. Assets  3. Investments
 * 
 * On completion → navigates to /onboarding/step-1
 * Data is saved to Supabase `user_financial_data` table automatically.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';
import config from '../../resources/config/config';
import KycFinancialLinkScreen from '../../components/kyc/screens/KycFinancialLinkScreen';
import type { FinancialVerificationResult } from '../../types/kyc';

export default function OnboardingFinancialLink() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const hasInitialized = useRef(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get authenticated user — runs only once
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const getUser = async () => {
      if (!config.supabaseClient) {
        navigate('/login');
        return;
      }

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || undefined);

      // Check if user already completed financial link
      try {
        const { data: financialData, error: fetchError } = await config.supabaseClient
          .from('user_financial_data')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        // Ignore errors (table may not exist, 406, RLS, etc.)
        if (fetchError) {
          console.warn('[FinancialLink] Supabase query error (ignoring):', fetchError.message);
        }

        // If already completed, still show the page (user may navigate back here)
        // They can re-verify or tap Continue/Skip to proceed
      } catch (err) {
        // Table may not exist yet — continue anyway
        console.warn('[FinancialLink] Error checking financial data (ignoring):', err);
      }

      setIsReady(true);
    };

    getUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle financial verification complete → go to Step 1
  const handleContinue = (result: FinancialVerificationResult) => {
    console.log('[FinancialLink] Verification complete:', result);
    // Set flag so Step 1 skips DB check (save runs in background, may not be done yet)
    sessionStorage.setItem('financial_verification_complete', 'true');
    navigate('/onboarding/step-1', { replace: true });
  };

  // Skip option — let user proceed without linking bank
  const handleSkip = () => {
    // Set skip flag so Step 1 knows this was intentional
    sessionStorage.setItem('financial_link_skipped', 'true');
    console.log('[FinancialLink] User skipped financial verification');
    navigate('/onboarding/step-1', { replace: true });
  };

  // Loading state — clean white screen
  if (!isReady || !userId) {
    return (
      <Box
        minH="100dvh"
        bg="#FFFFFF"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={6}
      >
        <VStack spacing={3}>
          <Spinner size="lg" color="#2F80ED" thickness="3px" />
          <Text fontSize="sm" color="gray.500" textAlign="center">
            Preparing your secure onboarding...
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <KycFinancialLinkScreen
      userId={userId}
      userEmail={userEmail}
      onContinue={handleContinue}
      onSkip={handleSkip}
      bankName="Hushh"
    />
  );
}
