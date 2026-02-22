/**
 * KycFinancialLinkScreen - Pre-KYC Financial Verification
 *
 * iOS-first design: clean white bg, iOS grouped list, inline icons.
 * All Plaid link + financial data logic unchanged.
 */
'use client';

import React, { useMemo } from 'react';
import {
  Box,
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

/* iOS design tokens */
const IOS = {
  primary: '#007AFF',
  primaryHover: '#0062CC',
  text: '#000000',
  secondary: '#8E8E93',
  tertiary: '#3C3C43',
  bg: '#FFFFFF',
  listBg: '#F9F9FB',
  separator: '#E5E5EA',
  success: '#34C759',
  warning: '#D97706',
  error: '#FF3B30',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
};

export interface KycFinancialLinkScreenProps {
  userId: string;
  userEmail?: string;
  onContinue: (result: FinancialVerificationResult) => void;
  onSkip?: () => void;
  bankName?: string;
}

/* ─── Status helpers ─── */
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
      return 'Auto-fetched';
  }
};

/* ─── iOS List Row ─── */
const ListRow: React.FC<{
  title: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  status: ProductFetchStatus;
  mainValue?: string;
  unavailableMessage?: string;
  errorMessage?: string;
  isLast?: boolean;
}> = ({ title, icon, iconBg, iconColor, status, mainValue, unavailableMessage, errorMessage, isLast }) => {
  const statusText = useMemo(
    () => resolveStatusText({ status, mainValue, unavailableMessage, errorMessage }),
    [status, mainValue, unavailableMessage, errorMessage],
  );

  const isValueState = status === 'success' && mainValue;

  return (
    <Flex
      align="center" px={4} py={3.5}
      borderBottom={isLast ? 'none' : '0.5px solid'}
      borderColor={IOS.separator}
      transition="background 0.15s"
      _active={{ bg: 'rgba(0,0,0,0.03)' }}
      cursor="pointer"
    >
      {/* Icon */}
      <Flex
        w="32px" h="32px" borderRadius="full"
        bg={iconBg} align="center" justify="center"
        mr={4} flexShrink={0}
      >
        <Text
          fontSize="20px" lineHeight="1" color={iconColor}
          className="material-symbols-outlined"
          sx={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
        >
          {icon}
        </Text>
      </Flex>

      {/* Title */}
      <Text flex="1" fontSize="17px" fontWeight="500" color={IOS.text}>
        {title}
      </Text>

      {/* Status */}
      <Flex align="center" gap={2}>
        {status === 'loading' && <Spinner size="sm" color={IOS.primary} thickness="3px" />}
        <Text
          fontSize="16px"
          color={isValueState ? IOS.text : '#C7C7CC'}
          fontWeight={isValueState ? '600' : '400'}
        >
          {statusText}
        </Text>
      </Flex>
    </Flex>
  );
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT — All Plaid logic preserved
   ═══════════════════════════════════════════════════ */
const KycFinancialLinkScreen: React.FC<KycFinancialLinkScreenProps> = ({
  userId,
  userEmail,
  onContinue,
  onSkip,
  bankName = 'Hushh',
}) => {
  const plaid = usePlaidLinkHook(userId, userEmail);

  /* ─── Computed display values ─── */
  const balanceDisplay = useMemo(() => {
    const data = plaid.financialData?.balance?.data;
    if (!data) return { mainValue: undefined };
    const accounts = data.accounts || [];
    const totalBalance = accounts.reduce(
      (sum: number, acc: any) => sum + (acc.balances?.current || 0), 0,
    );
    const currency = accounts[0]?.balances?.iso_currency_code || 'USD';
    return { mainValue: formatCurrency(totalBalance, currency) };
  }, [plaid.financialData]);

  const assetsDisplay = useMemo(() => {
    const data = plaid.financialData?.assets?.data;
    if (!data) return { mainValue: undefined };
    if (data.status === 'pending') return { mainValue: undefined };
    return { mainValue: 'Report generated' };
  }, [plaid.financialData]);

  const investmentsDisplay = useMemo(() => {
    const data = plaid.financialData?.investments?.data;
    if (!data) return { mainValue: undefined };
    const holdings = data.holdings || [];
    const totalValue = holdings.reduce(
      (sum: number, holding: any) => sum + (holding.institution_value || 0), 0,
    );
    const currency = holdings[0]?.iso_currency_code || 'USD';
    return { mainValue: formatCurrency(totalValue, currency) };
  }, [plaid.financialData]);

  const headerSubtitle = useMemo(() => {
    if (plaid.step === 'done' && plaid.institution) {
      return `Connected to ${plaid.institution.name}. You can continue to the next step.`;
    }
    return "We'll securely check your financial profile before starting KYC verification.";
  }, [plaid.step, plaid.institution]);

  const isProcessing = ['creating_token', 'exchanging', 'fetching'].includes(plaid.step);
  const isInitializing = plaid.step === 'idle' || plaid.step === 'creating_token';
  const isDone = plaid.step === 'done';
  const canProceed = isDone && plaid.canProceed;

  const buttonText = useMemo(() => {
    if (plaid.step === 'idle') return 'Preparing...';
    if (plaid.step === 'creating_token') return 'Preparing...';
    if (plaid.step === 'linking') return 'Connecting...';
    if (plaid.step === 'exchanging') return 'Securing connection...';
    if (plaid.step === 'fetching') return 'Fetching financial data...';
    if (isDone && canProceed) return 'Continue to KYC';
    if (plaid.step === 'error' || (isDone && !plaid.canProceed)) return 'Try Again';
    return 'Connect Bank Account';
  }, [plaid.step, plaid.canProceed, isDone, canProceed]);

  const handleButtonClick = () => {
    if (isDone && canProceed) {
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

    if (plaid.step === 'error' || (isDone && !plaid.canProceed)) {
      plaid.retry();
      return;
    }

    if (plaid.isReady) {
      plaid.openPlaidLink();
    }
  };

  /* ─── RENDER ─── */
  return (
    <Box
      className="onboarding-shell"
      minH="calc(100dvh - var(--onboarding-top-space, 7rem))"
      h="calc(100dvh - var(--onboarding-top-space, 7rem))"
      display="flex"
      flexDirection="column"
      bg={IOS.bg}
      fontFamily={IOS.font}
      sx={{
        '--onboarding-footer-space': '0px',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Scrollable content */}
      <Box
        as="main"
        flex="1 1 auto"
        minH={0}
        overflowY="auto"
        overflowX="hidden"
        pb="200px"
      >
        {/* ═══ Header ═══ */}
        <Box pt={14} px={5} pb={0} mb={2}>
          <Text
            as="h1"
            fontSize="34px" lineHeight="41px" fontWeight="900"
            letterSpacing="-0.02em" color={IOS.text}
            mb={3}
          >
            Financial Verification
          </Text>
          <Text fontSize="17px" lineHeight="22px" color="gray.500" fontWeight="400">
            {headerSubtitle}
          </Text>
        </Box>

        {/* ═══ Connected Institution Badge ═══ */}
        {isDone && plaid.institution && (
          <Box px={5} mt={4} mb={2}>
            <Flex align="center" gap={2}>
              <Badge
                bg="green.50" color="green.600"
                fontSize="13px" fontWeight="600"
                px={3} py={1} borderRadius="full"
                border="1px solid" borderColor="green.200"
              >
                ✓ Connected to {plaid.institution.name}
              </Badge>
            </Flex>
          </Box>
        )}

        {/* ═══ Account Overview — iOS grouped list ═══ */}
        <Box px={5} mt={8}>
          <Text
            pl={4} mb={2} fontSize="13px" fontWeight="500"
            color="gray.500" textTransform="uppercase" letterSpacing="0.06em"
          >
            Account Overview
          </Text>

          <Box
            bg={IOS.listBg} borderRadius="12px" overflow="hidden"
            border="0.5px solid" borderColor="rgba(0,0,0,0.04)"
          >
            <ListRow
              title="Balance"
              icon="account_balance_wallet"
              iconBg="rgba(0,122,255,0.1)"
              iconColor={IOS.primary}
              status={plaid.balanceStatus}
              mainValue={balanceDisplay.mainValue}
              unavailableMessage="Not available"
              errorMessage={plaid.financialData?.balance?.error || 'Failed to fetch'}
            />
            <ListRow
              title="Assets"
              icon="finance_mode"
              iconBg="rgba(52,199,89,0.1)"
              iconColor={IOS.success}
              status={plaid.assetsStatus}
              mainValue={assetsDisplay.mainValue}
              unavailableMessage="Not supported"
              errorMessage={plaid.financialData?.assets?.error || 'Failed to fetch'}
            />
            <ListRow
              title="Investments"
              icon="monitoring"
              iconBg="rgba(175,82,222,0.1)"
              iconColor="#AF52DE"
              status={plaid.investmentsStatus}
              mainValue={investmentsDisplay.mainValue}
              unavailableMessage="No investment accounts"
              errorMessage={plaid.financialData?.investments?.error || 'Failed to fetch'}
              isLast
            />
          </Box>
        </Box>

        {/* Error message */}
        {plaid.error && plaid.step === 'error' && (
          <Box mx={5} mt={4} p={3} borderRadius="12px" bg="#FEF2F2" border="1px solid #FECACA">
            <Text textAlign="center" fontSize="13px" color={IOS.error} lineHeight="1.5">
              {plaid.error}
            </Text>
          </Box>
        )}
      </Box>

      {/* ═══ Fixed bottom bar ═══ */}
      <Box
        position="absolute"
        bottom={0} left={0} right={0}
        bg="rgba(255,255,255,0.95)"
        backdropFilter="blur(20px)"
        sx={{ WebkitBackdropFilter: 'blur(20px)' }}
        px={5} pt={4} pb={8}
        zIndex={50}
      >
        {/* Security badge */}
        <Flex align="center" justify="center" mb={5} gap={1.5} opacity={0.7}>
          <Text
            fontSize="16px" lineHeight="1" color={IOS.secondary}
            className="material-symbols-outlined"
            sx={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
          >
            lock
          </Text>
          <Text fontSize="13px" fontWeight="500" color={IOS.secondary}>
            Secure 256-bit encryption
          </Text>
        </Flex>

        {/* Primary CTA */}
        <Button
          w="100%"
          data-onboarding-cta
          bg={canProceed ? IOS.success : IOS.primary}
          color="white"
          borderRadius="12px"
          h="52px"
          fontSize="17px"
          fontWeight="600"
          isDisabled={isInitializing || isProcessing}
          isLoading={isInitializing || isProcessing}
          loadingText={buttonText}
          _hover={{ bg: canProceed ? '#15803D' : IOS.primaryHover }}
          _active={{ transform: 'scale(0.98)' }}
          _disabled={{
            bg: '#CBD5E1',
            color: '#94A3B8',
            cursor: 'not-allowed',
          }}
          transition="all 0.2s"
          onClick={handleButtonClick}
          aria-label={buttonText}
        >
          {buttonText}
        </Button>

        {/* Secondary actions: Skip + Connect another */}
        <Flex mt={3} justify="center" gap={4}>
          {isDone && (
            <Button
              variant="ghost"
              color={IOS.primary}
              fontSize="15px"
              fontWeight="600"
              h="auto"
              py={2}
              _active={{ opacity: 0.6 }}
              onClick={plaid.retry}
              aria-label="Connect another account"
            >
              Connect another account
            </Button>
          )}

          {onSkip && (
            <Button
              variant="ghost"
              color={IOS.secondary}
              fontSize="15px"
              fontWeight="600"
              h="auto"
              py={2}
              _hover={{ color: IOS.text }}
              _active={{ opacity: 0.6 }}
              onClick={onSkip}
              aria-label="Skip for now"
            >
              Skip for now
            </Button>
          )}
        </Flex>
      </Box>
    </Box>
  );
};

export default KycFinancialLinkScreen;
