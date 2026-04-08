/**
 * Step 13 — All Business Logic
 * Bank details form, Plaid auto-fill, validation, Supabase upsert
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { deriveBankCountry } from '../../../services/onboarding/prefill';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';
import { fetchAuthNumbers } from '../../../services/plaid/plaidService';

/* ─── Types & Constants ─── */

export interface ShareClassInfo {
  id: string;
  name: string;
  unitPrice: number;
  color: string;
  bgColor: string;
  borderColor: string;
  iconType: 'diamond' | 'star' | 'verified';
}

export const SHARE_CLASSES: ShareClassInfo[] = [
  {
    id: 'class_a',
    name: 'Class A',
    unitPrice: 25000000,
    color: '#6B7280',
    bgColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    iconType: 'diamond',
  },
  {
    id: 'class_b',
    name: 'Class B',
    unitPrice: 5000000,
    color: '#B8860B',
    bgColor: '#FFFAEB',
    borderColor: 'rgba(255, 215, 0, 0.4)',
    iconType: 'star',
  },
  {
    id: 'class_c',
    name: 'Class C',
    unitPrice: 1000000,
    color: '#2b8cee',
    bgColor: '#F0F7FF',
    borderColor: 'rgba(43, 140, 238, 0.3)',
    iconType: 'verified',
  },
];

export const COUNTRIES = [
  { code: '', name: 'Select Country' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
];

export interface PlaidAccount {
  accountId: string;
  name: string;
  mask: string;
  subtype: string;
  achAccount: string;
  achRouting: string;
}

// Known Plaid sandbox test values — never auto-fill these in production
const SANDBOX_TEST_ACCOUNTS = new Set([
  '1111222233330000', '1111222233331111', '2222333344440000',
  '3333444455550000', '6666777788880000', '0000000000000000',
]);
const SANDBOX_TEST_ROUTING = new Set([
  '011401533', '021000021', '011000015', '054001725',
]);

const isValidPlaidAccountNumber = (value: string): boolean => {
  if (!value || value.length < 4 || value.length > 17) return false;
  if (!/^\d+$/.test(value)) return false;
  if (SANDBOX_TEST_ACCOUNTS.has(value)) return false;
  return true;
};

const isValidPlaidRoutingNumber = (value: string): boolean => {
  if (!value || value.length !== 9) return false;
  if (!/^\d+$/.test(value)) return false;
  if (SANDBOX_TEST_ROUTING.has(value)) return false;
  return true;
};

export const formatCurrency = (amount: number): string => {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
};

/* ─── Validation Functions ─── */
export const validateBankName = (value: string): string | null => {
  if (!value.trim()) return 'Bank name is required';
  if (value.trim().length < 2) return 'Bank name must be at least 2 characters';
  if (value.trim().length > 100) return 'Bank name is too long';
  return null;
};

export const validateAccountHolderName = (value: string): string | null => {
  if (!value.trim()) return 'Account holder name is required';
  if (value.trim().length < 2) return 'Name must be at least 2 characters';
  if (!/^[a-zA-Z\s\-'.]+$/.test(value.trim())) return 'Name should only contain letters';
  if (value.trim().length > 100) return 'Name is too long';
  return null;
};

export const validateAccountNumber = (value: string): string | null => {
  if (!value.trim()) return 'Account number is required';
  if (!/^\d+$/.test(value)) return 'Account number must contain only digits';
  if (value.length < 4) return 'Account number must be at least 4 digits';
  if (value.length > 17) return 'Account number is too long';
  return null;
};

export const validateConfirmAccountNumber = (value: string, original: string): string | null => {
  if (!value.trim()) return 'Please confirm your account number';
  if (value !== original) return 'Account numbers do not match';
  return null;
};

export const validateBankCountry = (value: string): string | null => {
  if (!value) return 'Please select a country';
  return null;
};

export const validateRoutingNumber = (value: string, country: string): string | null => {
  if (!value.trim()) return 'Routing number is required';
  if (!/^\d+$/.test(value)) return 'Routing number must contain only digits';
  if (country === 'US' && value.length !== 9) return 'US routing number must be exactly 9 digits';
  if (country !== 'US' && (value.length < 5 || value.length > 15)) return 'Routing number must be 5-15 digits';
  return null;
};

/* ─── Touched State Type ─── */
export interface TouchedFields {
  bankName: boolean;
  accountHolderName: boolean;
  accountNumber: boolean;
  confirmAccountNumber: boolean;
  routingNumber: boolean;
  bankCountry: boolean;
  bankCity: boolean;
}

/* ─── Hook Return Type ─── */
export interface Step13Logic {
  loading: boolean;
  pageLoading: boolean;
  error: string | null;
  isFooterVisible: boolean;
  autoFillMessage: string | null;
  plaidAccounts: PlaidAccount[];
  selectedAccountIdx: number;
  plaidInstitutionName: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  routingNumber: string;
  bankCity: string;
  bankCountry: string;
  accountType: 'checking' | 'savings';
  selectedOnboardingAccountType: string;
  formattedOnboardingAccountType: string;
  touched: TouchedFields;
  shareUnits: { class_a_units: number; class_b_units: number; class_c_units: number };
  totalInvestment: number;
  hasAnyUnits: boolean;
  bankNameError: string | null;
  accountHolderNameError: string | null;
  accountNumberError: string | null;
  confirmAccountNumberError: string | null;
  routingNumberError: string | null;
  isFormValid: () => boolean;
  getUnits: (classId: string) => number;
  handleBlur: (field: keyof TouchedFields) => void;
  handleBack: () => void;
  handleSkip: () => Promise<void>;
  handleContinue: () => Promise<void>;
  setBankName: (v: string) => void;
  setAccountHolderName: (v: string) => void;
  setAccountNumber: (v: string) => void;
  setConfirmAccountNumber: (v: string) => void;
  setRoutingNumber: (v: string) => void;
  setBankCity: (v: string) => void;
  setAccountType: (v: 'checking' | 'savings') => void;
  setSelectedAccountIdx: (v: number) => void;
  applyAccountSelection: (account: PlaidAccount) => void;
  userModifiedFields: React.MutableRefObject<Set<string>>;
}

/* ─── Main Hook ─── */
export const useStep13Logic = (): Step13Logic => {
  const navigate = useNavigate();
  const isFooterVisible = useFooterVisibility();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Plaid auto-fill status message
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  // Cleanup refs for async operations
  const autoFillTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track which fields user has manually edited
  const userModifiedFields = useRef(new Set<string>());

  // Plaid multi-account state
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccount[]>([]);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0);
  const [plaidInstitutionName, setPlaidInstitutionName] = useState('');

  // Banking form state
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [bankCity, setBankCity] = useState('');
  const [bankCountry, setBankCountry] = useState('US');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [selectedOnboardingAccountType, setSelectedOnboardingAccountType] = useState('');

  // Touched state for showing validation errors only after user interaction
  const [touched, setTouched] = useState<TouchedFields>({
    bankName: false,
    accountHolderName: false,
    accountNumber: false,
    confirmAccountNumber: false,
    routingNumber: false,
    bankCountry: false,
    bankCity: false,
  });

  // Share class units state
  const [shareUnits, setShareUnits] = useState<{
    class_a_units: number;
    class_b_units: number;
    class_c_units: number;
  }>({
    class_a_units: 0,
    class_b_units: 0,
    class_c_units: 0,
  });

  // Calculate total investment from share units
  const calculateTotalInvestment = () => {
    return (
      (shareUnits.class_a_units * 25000000) +
      (shareUnits.class_b_units * 5000000) +
      (shareUnits.class_c_units * 1000000)
    );
  };

  const totalInvestment = calculateTotalInvestment();
  const hasAnyUnits = shareUnits.class_a_units > 0 || shareUnits.class_b_units > 0 || shareUnits.class_c_units > 0;

  const formattedOnboardingAccountType = selectedOnboardingAccountType
    ? selectedOnboardingAccountType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Not selected';

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoFillTimeoutRef.current) clearTimeout(autoFillTimeoutRef.current);
    };
  }, []);

  // Apply selected account from multi-account picker
  const applyAccountSelection = useCallback((account: PlaidAccount) => {
    if (!userModifiedFields.current.has('accountNumber')) {
      setAccountNumber(account.achAccount);
      setConfirmAccountNumber(account.achAccount);
    }
    if (!userModifiedFields.current.has('routingNumber')) {
      setRoutingNumber(account.achRouting);
    }
    if (!userModifiedFields.current.has('accountType')) {
      const subtype = account.subtype as 'checking' | 'savings';
      if (subtype === 'checking' || subtype === 'savings') setAccountType(subtype);
    }
  }, []);

  // ─── Plaid Auto-Fill Logic ───
  const attemptPlaidAutoFill = async (
    userId: string,
    dbHasBankName: boolean,
  ) => {
    if (!config.supabaseClient) return;

    try {
      const { data: financialData } = await config.supabaseClient
        .from('user_financial_data')
        .select('plaid_access_token, institution_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (!financialData?.plaid_access_token) return;
      if (!isMountedRef.current) return;

      setAutoFillMessage('🔍 Auto-filling from your linked bank...');
      console.log('[Step13] Plaid access_token found, fetching auth numbers...');

      const authData = await fetchAuthNumbers(financialData.plaid_access_token);
      if (!isMountedRef.current) return;

      if (!authData) {
        console.warn('[Step13] Plaid returned no auth data — token may be expired');
        setAutoFillMessage('⚠️ Bank connection expired. Please enter details manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
        return;
      }

      const achNumbers = authData.numbers?.ach || [];
      const accounts = authData.accounts || [];

      if (achNumbers.length === 0) {
        console.warn('[Step13] No ACH accounts returned from Plaid');
        setAutoFillMessage('⚠️ Your bank does not support ACH. Please enter details manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
        return;
      }

      const mappedAccounts: PlaidAccount[] = achNumbers.map((ach: any) => {
        const matched = accounts.find((a: any) => a.account_id === ach.account_id) as any;
        return {
          accountId: ach.account_id || '',
          name: matched?.name || matched?.official_name || 'Account',
          mask: matched?.mask || (ach.account ? ach.account.slice(-4) : '****'),
          subtype: matched?.subtype || 'checking',
          achAccount: ach.account || '',
          achRouting: ach.routing || '',
        };
      });

      const hasAnySandboxData = mappedAccounts.some(
        (acct) =>
          SANDBOX_TEST_ACCOUNTS.has(acct.achAccount) ||
          SANDBOX_TEST_ROUTING.has(acct.achRouting),
      );

      if (hasAnySandboxData) {
        console.error('[Step13] 🚨 Sandbox test data detected — NOT auto-filling in production');
        setAutoFillMessage('⚠️ Test bank data detected. Please enter your real bank details.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 6000);
        return;
      }

      const validAccounts = mappedAccounts.filter(
        (acct) => isValidPlaidAccountNumber(acct.achAccount) && isValidPlaidRoutingNumber(acct.achRouting),
      );

      if (validAccounts.length === 0) {
        console.warn('[Step13] No valid accounts after validation');
        setAutoFillMessage('⚠️ Could not verify bank details. Please enter manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
        return;
      }

      setPlaidAccounts(validAccounts);
      if (financialData.institution_name) setPlaidInstitutionName(financialData.institution_name);

      if (validAccounts.length === 1) {
        const account = validAccounts[0];
        setSelectedAccountIdx(0);

        if (!userModifiedFields.current.has('accountNumber')) {
          setAccountNumber(account.achAccount);
          setConfirmAccountNumber(account.achAccount);
        }
        if (!userModifiedFields.current.has('routingNumber')) {
          setRoutingNumber(account.achRouting);
        }
        if (!userModifiedFields.current.has('accountType')) {
          const subtype = account.subtype as 'checking' | 'savings';
          if (subtype === 'checking' || subtype === 'savings') setAccountType(subtype);
        }

        setAutoFillMessage('✅ Bank details auto-filled from Plaid');
      } else {
        setSelectedAccountIdx(-1);
        setAutoFillMessage('👆 Select which bank account to use for wire transfers');
      }

      if (financialData.institution_name && !dbHasBankName && !userModifiedFields.current.has('bankName')) {
        setBankName(financialData.institution_name);
      }
      console.log('[Step13] Plaid auto-fill complete:', {
        accountsFound: validAccounts.length,
        institution: financialData.institution_name,
      });

      autoFillTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setAutoFillMessage(null);
      }, 5000);
    } catch (err) {
      console.error('[Step13] Plaid auto-fill failed:', err);
      if (isMountedRef.current) {
        setAutoFillMessage('⚠️ Could not auto-fill bank details. Please enter manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
      }
    }
  };

  /* ─── Enable page-level scrolling ─── */
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.classList.add('onboarding-page-scroll');
    document.body.classList.add('onboarding-page-scroll');
    return () => {
      document.documentElement.classList.remove('onboarding-page-scroll');
      document.body.classList.remove('onboarding-page-scroll');
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!config.supabaseClient) { setPageLoading(false); return; }

      try {
        const { data: { user } } = await config.supabaseClient.auth.getUser();
        if (!user) { setPageLoading(false); return; }

        const { data } = await config.supabaseClient
          .from('onboarding_data')
          .select(`
            class_a_units, class_b_units, class_c_units,
            account_type,
            legal_first_name, legal_last_name,
            address_country, residence_country,
            bank_name, bank_account_holder_name, bank_account_type,
            bank_routing_number, bank_address_city, bank_address_country
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        let dbHasBankName = false;

        if (data) {
          setShareUnits({
            class_a_units: data.class_a_units || 0,
            class_b_units: data.class_b_units || 0,
            class_c_units: data.class_c_units || 0,
          });

          setBankCountry(deriveBankCountry({
            addressCountry: data.address_country,
            residenceCountry: data.residence_country,
            savedBankCountry: data.bank_address_country,
          }));

          if (data.legal_first_name && data.legal_last_name && !data.bank_account_holder_name) {
            setAccountHolderName(`${data.legal_first_name} ${data.legal_last_name}`);
          }

          if (data.bank_name) { setBankName(data.bank_name); dbHasBankName = true; }
          if (data.bank_account_holder_name) setAccountHolderName(data.bank_account_holder_name);
          if (data.bank_account_type) setAccountType(data.bank_account_type as 'checking' | 'savings');
          if (data.account_type) setSelectedOnboardingAccountType(String(data.account_type));
          if (data.bank_routing_number) setRoutingNumber(data.bank_routing_number);
          if (data.bank_address_city) setBankCity(data.bank_address_city);
        }

        const hasBankDataAlready = data?.bank_routing_number;
        if (!hasBankDataAlready) {
          await attemptPlaidAutoFill(user.id, dbHasBankName);
        }
      } catch (err) {
        console.error('[Step13] Error loading data:', err);
      } finally {
        setPageLoading(false);
      }
    };

    loadData();
  }, []);

  // Get units for a class
  const getUnits = (classId: string): number => {
    if (classId === 'class_a') return shareUnits.class_a_units;
    if (classId === 'class_b') return shareUnits.class_b_units;
    if (classId === 'class_c') return shareUnits.class_c_units;
    return 0;
  };

  // Mark field as touched on blur
  const handleBlur = (field: keyof TouchedFields) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Get error for each field
  const bankNameError = validateBankName(bankName);
  const accountHolderNameError = validateAccountHolderName(accountHolderName);
  const accountNumberError = validateAccountNumber(accountNumber);
  const confirmAccountNumberError = validateConfirmAccountNumber(confirmAccountNumber, accountNumber);
  const routingNumberError = validateRoutingNumber(routingNumber, bankCountry);

  // Check if form is valid
  const isFormValid = (): boolean => {
    return (
      !bankNameError &&
      !accountHolderNameError &&
      !accountNumberError &&
      !confirmAccountNumberError &&
      !routingNumberError
    );
  };

  // Save banking info and continue
  const handleContinue = async () => {
    if (!bankName.trim()) {
      setError('Please enter your bank name');
      return;
    }
    if (!accountHolderName.trim()) {
      setError('Please enter the account holder name');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Please enter your account number');
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      setError('Account numbers do not match');
      return;
    }
    if (!routingNumber.trim()) {
      setError('Please enter the routing number');
      return;
    }

    setLoading(true);
    setError(null);

    if (!config.supabaseClient) {
      setError('Configuration error');
      setLoading(false);
      return;
    }

    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const encryptedAccountNumber = btoa(accountNumber);

    const { error: upsertError } = await upsertOnboardingData(user.id, {
      bank_name: bankName.trim(),
      bank_account_holder_name: accountHolderName.trim(),
      bank_account_number_encrypted: encryptedAccountNumber,
      bank_routing_number: routingNumber.trim(),
      bank_address_city: bankCity.trim() || null,
      bank_address_country: bankCountry || 'US',
      bank_account_type: accountType,
      banking_info_skipped: false,
      banking_info_submitted_at: new Date().toISOString(),
      current_step: 13,
      is_completed: true,
      completed_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError('Failed to save banking information');
      setLoading(false);
      return;
    }

    navigate('/onboarding/meet-ceo');
  };

  // Skip and continue later
  const handleSkip = async () => {
    setLoading(true);
    setError(null);

    if (!config.supabaseClient) {
      setError('Configuration error');
      setLoading(false);
      return;
    }

    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { error: upsertError } = await upsertOnboardingData(user.id, {
      banking_info_skipped: true,
      current_step: 13,
      is_completed: true,
      completed_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError('Failed to save data');
      setLoading(false);
      return;
    }

    navigate('/onboarding/meet-ceo');
  };

  const handleBack = () => {
    navigate('/onboarding/step-9');
  };

  return {
    loading,
    pageLoading,
    error,
    isFooterVisible,
    autoFillMessage,
    plaidAccounts,
    selectedAccountIdx,
    plaidInstitutionName,
    bankName,
    accountHolderName,
    accountNumber,
    confirmAccountNumber,
    routingNumber,
    bankCity,
    bankCountry,
    accountType,
    selectedOnboardingAccountType,
    formattedOnboardingAccountType,
    touched,
    shareUnits,
    totalInvestment,
    hasAnyUnits,
    bankNameError,
    accountHolderNameError,
    accountNumberError,
    confirmAccountNumberError,
    routingNumberError,
    isFormValid,
    getUnits,
    handleBlur,
    handleBack,
    handleSkip,
    handleContinue,
    setBankName,
    setAccountHolderName,
    setAccountNumber,
    setConfirmAccountNumber,
    setRoutingNumber,
    setBankCity,
    setAccountType,
    setSelectedAccountIdx,
    applyAccountSelection,
    userModifiedFields,
  };
};
