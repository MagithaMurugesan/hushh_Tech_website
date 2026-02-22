/**
 * KycFinancialLinkScreen - Pre-KYC Financial Verification
 *
 * Design refreshed to match onboarding UI guidelines while keeping all
 * financial-link functionality unchanged.
 */
'use client';

import React, { useMemo } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  Flex,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { usePlaidLinkHook } from '../../../services/plaid/usePlaidLink';
import {
  formatCurrency,
  type ProductFetchStatus,
} from '../../../services/plaid/plaidService';
import type { FinancialVerificationResult } from '../../../types/kyc';

const COLORS = {
  primary: '#007AFF',
  primaryHover: '#0062CC',
  textMain: '#000000',
  textSub: '#3C3C43',
  textMuted: '#8E8E93',
  surface: '#FFFFFF',
  surfaceSoft: '#F2F2F7',
  border: 'rgba(0,0,0,0.04)',
  borderCard: 'rgba(255,255,255,0.6)',
  success: '#34C759',
  warning: '#D97706',
  error: '#FF3B30',
  iconBlueBg: 'linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)',
  iconGreenBg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
  iconPurpleBg: 'linear-gradient(135deg, #FAF5FF 0%, #EDE9FE 100%)',
  iconBlue: '#2563EB',
  iconGreen: '#16A34A',
  iconPurple: '#7C3AED',
  glassBg: 'rgba(255,255,255,0.8)',
  glowShadow: '0 4px 14px 0 rgba(0, 118, 255, 0.39)',
  softShadow: '0 8px 30px rgba(0,0,0,0.06)',
  vibrantBg: 'linear-gradient(135deg, #f5f7fa 0%, #eef2f8 100%)',
};

export interface KycFinancialLinkScreenProps {
  userId: string;
  userEmail?: string;
  onContinue: (result: FinancialVerificationResult) => void;
  onSkip?: () => void;
  bankName?: string;
}

const WalletIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="6.5" width="19" height="13" rx="3" stroke={color} strokeWidth="1.8" />
    <path d="M2.5 10.5H21.5" stroke={color} strokeWidth="1.8" />
    <circle cx="16.5" cy="14.5" r="1.5" fill={color} />
  </svg>
);

const AssetsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke={color} strokeWidth="1.8" />
    <path d="M8 16.5V12.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 16.5V9.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16 16.5V11.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const InvestmentsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 16.5L8.5 11.5L12.5 15.5L20.5 7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.5 7.5H20.5V11.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 11V8C8 5.8 9.8 4 12 4C14.2 4 16 5.8 16 8V11" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const STATUS_COLORS: Record<ProductFetchStatus, string> = {
  idle: COLORS.textMuted,
  loading: COLORS.textSub,
  success: COLORS.success,
  pending: COLORS.warning,
  unavailable: COLORS.textMuted,
  error: COLORS.error,
};

const resolveStatusText = ({
  status,
  mainValue,
  unavailableMessage,
  errorMessage,
}: {
  status: ProductFetchStatus;
  mainValue?: string;
  unavailableMessage?: string;
  errorMessage?: string;
}) => {
  switch (status) {
    case 'loading':
      return 'Fetching...';
    case 'success':
      return mainValue || 'Verified';
    case 'pending':
      return 'Generating report...';
    case 'unavailable':
      return unavailableMessage || 'Not available';
    case 'error':
      return errorMessage || 'Failed to fetch';
    default:
      return 'Auto-fetched on connect';
  }
};

const ProductCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  status: ProductFetchStatus;
  mainValue?: string;
  unavailableMessage?: string;
  errorMessage?: string;
}> = ({ title, icon, iconBg, status, mainValue, unavailableMessage, errorMessage }) => {
  const statusText = useMemo(
    () =>
      resolveStatusText({
        status,
        mainValue,
        unavailableMessage,
        errorMessage,
      }),
    [status, mainValue, unavailableMessage, errorMessage],
  );

  const isValueState = status === 'success' && mainValue;

  return (
    <Flex
      w="100%"
      align="center"
      justify="space-between"
      px={4}
      py={3.5}
      transition="background 0.15s"
      _active={{ bg: 'rgba(0,0,0,0.03)' }}
    >
      <Flex align="center" gap={4}>
        <Flex
          w="40px"
          h="40px"
          borderRadius="12px"
          bg={iconBg}
          align="center"
          justify="center"
          flexShrink={0}
          backdropFilter="blur(8px)"
          sx={{ WebkitBackdropFilter: 'blur(8px)' }}
          border="1px solid rgba(255,255,255,0.4)"
          boxShadow="0 1px 3px rgba(0,0,0,0.06)"
        >
          {icon}
        </Flex>
        <Text fontSize="17px" fontWeight="600" color={COLORS.textMain}>
          {title}
        </Text>
      </Flex>

      <Flex align="center" gap={2}>
        {status === 'loading' && <Spinner size="sm" color={COLORS.primary} thickness="3px" />}
        <Text
          fontSize="17px"
          color={isValueState ? COLORS.textMain : COLORS.textMuted}
          fontWeight={isValueState ? '700' : '500'}
          letterSpacing={isValueState ? '-0.01em' : undefined}
        >
          {statusText}
        </Text>
      </Flex>
    </Flex>
  );
};

const KycFinancialLinkScreen: React.FC<KycFinancialLinkScreenProps> = ({
  userId,
  userEmail,
  onContinue,
  onSkip,
  bankName = 'Hushh',
}) => {
  const plaid = usePlaidLinkHook(userId, userEmail);

  const balanceDisplay = useMemo(() => {
    const data = plaid.financialData?.balance?.data;
    if (!data) return { mainValue: undefined };

    const accounts = data.accounts || [];
    const totalBalance = accounts.reduce(
      (sum: number, acc: any) => sum + (acc.balances?.current || 0),
      0,
    );
    const currency = accounts[0]?.balances?.iso_currency_code || 'USD';

    return {
      mainValue: formatCurrency(totalBalance, currency),
    };
  }, [plaid.financialData]);

  const assetsDisplay = useMemo(() => {
    const data = plaid.financialData?.assets?.data;
    if (!data) return { mainValue: undefined };
    if (data.status === 'pending') return { mainValue: undefined };

    return {
      mainValue: 'Report generated',
    };
  }, [plaid.financialData]);

  const investmentsDisplay = useMemo(() => {
    const data = plaid.financialData?.investments?.data;
    if (!data) return { mainValue: undefined };

    const holdings = data.holdings || [];
    const totalValue = holdings.reduce(
      (sum: number, holding: any) => sum + (holding.institution_value || 0),
      0,
    );
    const currency = holdings[0]?.iso_currency_code || 'USD';

    return {
      mainValue: formatCurrency(totalValue, currency),
    };
  }, [plaid.financialData]);

  const headerTitle = useMemo(() => {
    if (plaid.step === 'done') {
      if (plaid.productsAvailable === 3) return 'Financial Verification';
      if (plaid.productsAvailable > 0) return 'Financial Verification';
      return 'Financial Verification';
    }
    return 'Financial Verification';
  }, [plaid.step, plaid.productsAvailable]);

  const headerSubtitle = useMemo(() => {
    if (plaid.step === 'done' && plaid.institution) {
      return `Connected to ${plaid.institution.name}. You can continue to the next step.`;
    }
    return "We'll securely check your financial profile before starting KYC verification.";
  }, [plaid.step, plaid.institution]);

  const isProcessing = ['creating_token', 'exchanging', 'fetching'].includes(plaid.step);
  const isInitializing = plaid.step === 'idle' || plaid.step === 'creating_token';

  const infoMessage = useMemo(() => {
    if (plaid.step !== 'done') return null;
    if (plaid.productsAvailable === 3) return null;
    if (plaid.productsAvailable > 0) {
      return "We've saved what's available. You can link additional accounts later.";
    }
    return 'Something went wrong. Please try again or link a different account.';
  }, [plaid.step, plaid.productsAvailable]);

  const buttonText = useMemo(() => {
    if (plaid.step === 'idle') return 'Preparing...';
    if (plaid.step === 'creating_token') return 'Preparing...';
    if (plaid.step === 'linking') return 'Connecting...';
    if (plaid.step === 'exchanging') return 'Securing connection...';
    if (plaid.step === 'fetching') return 'Fetching financial data...';
    if (plaid.step === 'done' && plaid.canProceed) return 'Continue to KYC';
    if (plaid.step === 'error' || (plaid.step === 'done' && !plaid.canProceed)) return 'Try Again';
    return 'Link Bank Account';
  }, [plaid.step, plaid.canProceed]);

  const buttonBg = useMemo(() => {
    if (plaid.step === 'done' && plaid.canProceed) return COLORS.success;
    if (plaid.step === 'error' || (plaid.step === 'done' && !plaid.canProceed)) return COLORS.error;
    return COLORS.primary;
  }, [plaid.step, plaid.canProceed]);

  const buttonHoverBg = useMemo(() => {
    if (plaid.step === 'done' && plaid.canProceed) return '#15803D';
    if (plaid.step === 'error' || (plaid.step === 'done' && !plaid.canProceed)) return '#B91C1C';
    return COLORS.primaryHover;
  }, [plaid.step, plaid.canProceed]);

  const handleButtonClick = () => {
    if (plaid.step === 'done' && plaid.canProceed) {
      const result: FinancialVerificationResult = {
        verified: true,
        productsAvailable: plaid.productsAvailable,
        institutionName: plaid.institution?.name,
        institutionId: plaid.institution?.id,
        balanceAvailable: plaid.balanceStatus === 'success',
        assetsAvailable: plaid.assetsStatus === 'success',
        investmentsAvailable: plaid.investmentsStatus === 'success',
        timestamp: new Date().toISOString(),
      };
      onContinue(result);
      return;
    }

    if (plaid.step === 'error' || (plaid.step === 'done' && !plaid.canProceed)) {
      plaid.retry();
      return;
    }

    if (plaid.isReady) {
      plaid.openPlaidLink();
    }
  };

  return (
    <Box
      className="onboarding-shell"
      minH="calc(100dvh - var(--onboarding-top-space, 7rem))"
      h="calc(100dvh - var(--onboarding-top-space, 7rem))"
      display="flex"
      flexDirection="column"
      bg={COLORS.vibrantBg}
      position="relative"
      sx={{
        '--onboarding-footer-space': '0px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      }}
    >
      <Box
        as="main"
        flex="1 1 auto"
        minH={0}
        overflowY="auto"
        overflowX="hidden"
        pb="180px"
      >
        {/* Large bold title — iOS style */}
        <Box pt={8} px={5} pb={6}>
          <Heading
            as="h1"
            fontSize="34px"
            fontWeight="700"
            lineHeight="1.1"
            letterSpacing="-0.02em"
            bgGradient="linear(to-br, gray.900, gray.600)"
            bgClip="text"
          >
            Financial{'\n'}Verification
          </Heading>
        </Box>

        {/* Institution Card — shown when connected */}
        {plaid.step === 'done' && plaid.institution && (
          <Box px={4} mb={6}>
            <Box
              bg="white"
              borderRadius="20px"
              p={4}
              boxShadow={COLORS.softShadow}
              border="1px solid"
              borderColor={COLORS.borderCard}
            >
              <Flex align="center" justify="space-between">
                <Flex align="center" gap={4}>
                  <Flex
                    w="56px"
                    h="56px"
                    borderRadius="16px"
                    bgGradient="linear(to-br, blue.800, purple.900)"
                    align="center"
                    justify="center"
                    color="white"
                    fontWeight="700"
                    fontSize="xl"
                    boxShadow="0 4px 14px rgba(30, 64, 175, 0.2)"
                  >
                    {(plaid.institution.name || '').substring(0, 2).toUpperCase()}
                  </Flex>
                  <Box>
                    <Flex align="center" gap={2} mb={1}>
                      <Text fontWeight="700" fontSize="17px" color="gray.900">
                        {plaid.institution.name}
                      </Text>
                      <Badge
                        bg="green.100"
                        color="green.600"
                        fontSize="11px"
                        fontWeight="700"
                        px={2}
                        py={0.5}
                        borderRadius="full"
                        border="1px solid"
                        borderColor="green.200"
                        display="flex"
                        alignItems="center"
                        gap={0.5}
                      >
                        ✓ VERIFIED
                      </Badge>
                    </Flex>
                    <Text color="gray.500" fontSize="15px" fontWeight="500">
                      Connected account
                    </Text>
                  </Box>
                </Flex>
              </Flex>

              <Flex align="center" mt={3} px={4}>
                <LockIcon />
                <Text ml={1.5} fontSize="13px" color={COLORS.primary} fontWeight="500">
                  Data secured with 256-bit encryption
                </Text>
              </Flex>
            </Box>
          </Box>
        )}

        {/* Pre-connect state — show prompt */}
        {plaid.step !== 'done' && (
          <Box px={4} mb={6}>
            <Box
              bg="white"
              borderRadius="20px"
              p={5}
              boxShadow={COLORS.softShadow}
              border="1px solid"
              borderColor={COLORS.borderCard}
              textAlign="center"
            >
              <Flex justify="center" mb={4}>
                <Flex
                  w="56px"
                  h="56px"
                  borderRadius="16px"
                  bg={COLORS.primary}
                  align="center"
                  justify="center"
                  boxShadow="0 8px 24px rgba(0, 122, 255, 0.3)"
                >
                  <WalletIcon color="#FFFFFF" />
                </Flex>
              </Flex>
              <Text color={COLORS.textSub} fontSize="15px" lineHeight="1.6" fontWeight="500">
                {headerSubtitle}
              </Text>
            </Box>
          </Box>
        )}

        {/* Account Overview — iOS grouped list */}
        <Box px={4}>
          <Text
            fontSize="13px"
            textTransform="uppercase"
            color="gray.500"
            fontWeight="600"
            mb={3}
            pl={4}
            letterSpacing="0.04em"
          >
            Account Overview
          </Text>
          <Box
            bg="white"
            borderRadius="20px"
            overflow="hidden"
            boxShadow={COLORS.softShadow}
            border="1px solid"
            borderColor={COLORS.borderCard}
          >
            <ProductCard
              title="Balance"
              icon={<WalletIcon color={COLORS.iconBlue} />}
              iconBg={COLORS.iconBlueBg}
              status={plaid.balanceStatus}
              mainValue={balanceDisplay.mainValue}
              unavailableMessage="Not available for this institution"
              errorMessage={plaid.financialData?.balance?.error || 'Failed to fetch'}
            />
            <Box h="0.5px" bg="gray.100" ml="68px" />
            <ProductCard
              title="Assets"
              icon={<AssetsIcon color={COLORS.iconGreen} />}
              iconBg={COLORS.iconGreenBg}
              status={plaid.assetsStatus}
              mainValue={assetsDisplay.mainValue}
              unavailableMessage="Not supported by this institution"
              errorMessage={plaid.financialData?.assets?.error || 'Failed to fetch'}
            />
            <Box h="0.5px" bg="gray.100" ml="68px" />
            <ProductCard
              title="Investments"
              icon={<InvestmentsIcon color={COLORS.iconPurple} />}
              iconBg={COLORS.iconPurpleBg}
              status={plaid.investmentsStatus}
              mainValue={investmentsDisplay.mainValue}
              unavailableMessage="No investment accounts found"
              errorMessage={plaid.financialData?.investments?.error || 'Failed to fetch'}
            />
          </Box>

          <Text fontSize="13px" color={COLORS.textMuted} mt={3} px={4} lineHeight="1.6" fontWeight="500">
            {infoMessage || (plaid.step === 'done'
              ? "We've successfully retrieved your available data. You can link additional accounts in the next step."
              : '')}
          </Text>
        </Box>

        {plaid.step === 'done' && (
          <Box mt={6} px={4}>
            <Button
              w="100%"
              variant="ghost"
              color={COLORS.primary}
              fontSize="17px"
              fontWeight="600"
              _active={{ opacity: 0.6 }}
              onClick={plaid.retry}
            >
              Link a different account
            </Button>
          </Box>
        )}

        {plaid.error && plaid.step === 'error' && (
          <Box
            mx={4}
            p={3}
            borderRadius="14px"
            bg="#FEF2F2"
            border="1px solid #FECACA"
          >
            <Text textAlign="center" fontSize="13px" color={COLORS.error} lineHeight="1.5">
              {plaid.error}
            </Text>
          </Box>
        )}
      </Box>

      {/* Fixed bottom bar — frosted glass with gradient CTA */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        bg="rgba(255,255,255,0.8)"
        backdropFilter="blur(20px)"
        sx={{ WebkitBackdropFilter: 'blur(20px)' }}
        borderTop="1px solid"
        borderColor="rgba(0,0,0,0.06)"
        px={5}
        pt={4}
        pb={8}
        zIndex={50}
      >
        <Button
          w="100%"
          data-onboarding-cta
          size="lg"
          bgGradient="linear(to-r, blue.600, blue.500)"
          color="white"
          borderRadius="16px"
          h="54px"
          fontSize="17px"
          fontWeight="700"
          isDisabled={isInitializing || isProcessing}
          isLoading={isInitializing || isProcessing}
          loadingText={buttonText}
          boxShadow={COLORS.glowShadow}
          _hover={{
            bgGradient: 'linear(to-r, blue.700, blue.600)',
            boxShadow: '0 6px 20px rgba(0, 118, 255, 0.45)',
          }}
          _active={{ transform: 'scale(0.98)' }}
          _disabled={{
            bg: '#CBD5E1',
            bgGradient: 'none',
            color: '#94A3B8',
            cursor: 'not-allowed',
            boxShadow: 'none',
          }}
          transition="all 0.2s ease"
          onClick={handleButtonClick}
          aria-label={buttonText}
        >
          {buttonText}
        </Button>

        {onSkip && (
          <Button
            mt={3}
            w="100%"
            size="sm"
            variant="ghost"
            color={COLORS.textMuted}
            fontWeight="600"
            fontSize="15px"
            rightIcon={<ArrowRightIcon />}
            _hover={{ color: COLORS.textMain }}
            _active={{ opacity: 0.6 }}
            onClick={onSkip}
            aria-label="Skip financial verification for now"
          >
            Skip for now
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default KycFinancialLinkScreen;
