import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../utils/useFooterVisibility';
import { fetchAuthNumbers } from '../../services/plaid/plaidService';

// SVG Icons
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const BankIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2b8cee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21H21M3 10H21M5 6L12 3L19 6M4 10V21M20 10V21M8 14V17M12 14V17M16 14V17" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b8cee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const ArrowForwardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12,5 19,12 12,19" />
  </svg>
);

// Share class pill icons
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4AF37" stroke="#D4AF37" strokeWidth="1">
    <polygon points="12,2 15,8.5 22,9.3 17,14 18.2,21 12,17.5 5.8,21 7,14 2,9.3 9,8.5" />
  </svg>
);

const DiamondIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3H18L22 9L12 21L2 9L6 3Z" />
  </svg>
);

const VerifiedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2b8cee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L15 5L19 5L19 9L22 12L19 15L19 19L15 19L12 22L9 19L5 19L5 15L2 12L5 9L5 5L9 5L12 2Z" />
    <polyline points="9,12 11,14 15,10" />
  </svg>
);

// Share class configurations
interface ShareClassInfo {
  id: string;
  name: string;
  unitPrice: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

const SHARE_CLASSES: ShareClassInfo[] = [
  {
    id: 'class_a',
    name: 'Class A',
    unitPrice: 25000000,
    color: '#6B7280',
    bgColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    icon: <DiamondIcon />,
  },
  {
    id: 'class_b',
    name: 'Class B',
    unitPrice: 5000000,
    color: '#B8860B',
    bgColor: '#FFFAEB',
    borderColor: 'rgba(255, 215, 0, 0.4)',
    icon: <StarIcon />,
  },
  {
    id: 'class_c',
    name: 'Class C',
    unitPrice: 1000000,
    color: '#2b8cee',
    bgColor: '#F0F7FF',
    borderColor: 'rgba(43, 140, 238, 0.3)',
    icon: <VerifiedIcon />,
  },
];

// Country list
const COUNTRIES = [
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

// Plaid account from auth/get response
interface PlaidAccount {
  accountId: string;
  name: string;
  mask: string; // last 4 digits
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

// Validate Plaid-returned data before auto-filling
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

// Format currency for display
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(0)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
};

function OnboardingStep13() {
  const navigate = useNavigate();
  const isFooterVisible = useFooterVisibility();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true); // Data fetch loading
  const [autoSkipping, setAutoSkipping] = useState(false); // Plaid auto-save & skip in progress
  const [error, setError] = useState<string | null>(null);
  
  // Plaid auto-fill status message (shown as banner)
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  // Cleanup refs for async operations
  const autoFillTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track which fields user has manually edited (prevents Plaid overwrite)
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
  const [bankCountry, setBankCountry] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [selectedOnboardingAccountType, setSelectedOnboardingAccountType] = useState('');
  
  // Touched state for showing validation errors only after user interaction
  const [touched, setTouched] = useState({
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

  // Cleanup on unmount — clear timeouts, mark unmounted
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
  // Fetches ACH account/routing numbers from Plaid via the user's stored access_token.
  // Validates data before auto-filling (rejects sandbox test values).
  // If multiple accounts exist, shows picker instead of blindly selecting the first.
  // Returns: { validAccounts, institutionName } if Plaid data found, null otherwise
  const attemptPlaidAutoFill = async (
    userId: string,
    dbHasBankName: boolean,
    dbHasCountry: boolean,
  ): Promise<{ validAccounts: PlaidAccount[]; institutionName: string } | null> => {
    if (!config.supabaseClient) return null;

    try {
      // 1. Check if user has a Plaid access token from the financial link step
      const { data: financialData } = await config.supabaseClient
        .from('user_financial_data')
        .select('plaid_access_token, institution_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (!financialData?.plaid_access_token) return null; // No linked bank — nothing to auto-fill
      if (!isMountedRef.current) return null;

      setAutoFillMessage('🔍 Auto-filling from your linked bank...');
      console.log('[Step13] Plaid access_token found, fetching auth numbers...');

      // 2. Fetch ACH auth numbers from Plaid via Edge Function
      const authData = await fetchAuthNumbers(financialData.plaid_access_token);
      if (!isMountedRef.current) return null;

      // Handle expired/invalid access token
      if (!authData) {
        console.warn('[Step13] Plaid returned no auth data — token may be expired');
        setAutoFillMessage('⚠️ Bank connection expired. Please enter details manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
        return null;
      }

      const achNumbers = authData.numbers?.ach || [];
      const accounts = authData.accounts || [];

      // Handle no ACH accounts (bank doesn't support ACH)
      if (achNumbers.length === 0) {
        console.warn('[Step13] No ACH accounts returned from Plaid');
        setAutoFillMessage('⚠️ Your bank does not support ACH. Please enter details manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
        return null;
      }

      // 3. Map Plaid response to our PlaidAccount format
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

      // 4. Validate data — reject sandbox/test values
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
        return null;
      }

      // Filter out accounts with invalid data
      const validAccounts = mappedAccounts.filter(
        (acct) => isValidPlaidAccountNumber(acct.achAccount) && isValidPlaidRoutingNumber(acct.achRouting),
      );

      if (validAccounts.length === 0) {
        console.warn('[Step13] No valid accounts after validation');
        setAutoFillMessage('⚠️ Could not verify bank details. Please enter manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
        return null;
      }

      // 5. Set accounts for picker UI
      setPlaidAccounts(validAccounts);
      if (financialData.institution_name) setPlaidInstitutionName(financialData.institution_name);

      // 6. Auto-fill logic depends on number of accounts
      if (validAccounts.length === 1) {
        // Single account — auto-fill directly
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
        // Multiple accounts — show picker, DON'T auto-select
        // User must explicitly choose which account to use
        setSelectedAccountIdx(-1); // -1 = nothing selected yet
        setAutoFillMessage('👆 Select which bank account to use for wire transfers');
      }

      // Fill bank name & country only if not already set
      if (financialData.institution_name && !dbHasBankName && !userModifiedFields.current.has('bankName')) {
        setBankName(financialData.institution_name);
      }
      if (!dbHasCountry && !userModifiedFields.current.has('bankCountry')) {
        setBankCountry('US'); // ACH = US-only
      }

      console.log('[Step13] Plaid auto-fill complete:', {
        accountsFound: validAccounts.length,
        institution: financialData.institution_name,
      });

      // Clear success message after delay
      autoFillTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setAutoFillMessage(null);
      }, 5000);

      // Return the valid accounts so caller can decide to auto-skip
      return { validAccounts, institutionName: financialData.institution_name || '' };
    } catch (err) {
      console.error('[Step13] Plaid auto-fill failed:', err);
      if (isMountedRef.current) {
        setAutoFillMessage('⚠️ Could not auto-fill bank details. Please enter manually.');
        autoFillTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setAutoFillMessage(null);
        }, 5000);
      }
      return null;
    }
  };

  // Load existing data
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
          bank_name, bank_account_holder_name, bank_account_type,
          bank_routing_number, bank_address_city, bank_address_country
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      // Track what DB already has so we know what's "pre-filled" vs "empty"
      let dbHasBankName = false;
      let dbHasCountry = false;

      if (data) {
        setShareUnits({
          class_a_units: data.class_a_units || 0,
          class_b_units: data.class_b_units || 0,
          class_c_units: data.class_c_units || 0,
        });
        
        if (data.legal_first_name && data.legal_last_name && !data.bank_account_holder_name) {
          setAccountHolderName(`${data.legal_first_name} ${data.legal_last_name}`);
        }
        
        if (data.bank_name) { setBankName(data.bank_name); dbHasBankName = true; }
        if (data.bank_account_holder_name) setAccountHolderName(data.bank_account_holder_name);
        if (data.bank_account_type) setAccountType(data.bank_account_type as 'checking' | 'savings');
        if (data.account_type) setSelectedOnboardingAccountType(String(data.account_type));
        if (data.bank_routing_number) setRoutingNumber(data.bank_routing_number);
        if (data.bank_address_city) setBankCity(data.bank_address_city);
        if (data.bank_address_country) { setBankCountry(data.bank_address_country); dbHasCountry = true; }
      }

      // --- Plaid Auto-Fill & Auto-Skip ---
      // Only attempt if user hasn't already saved bank data in a previous session
      const hasBankDataAlready = data?.bank_routing_number;
      if (!hasBankDataAlready) {
        const plaidResult = await attemptPlaidAutoFill(user.id, dbHasBankName, dbHasCountry);

        // ─── AUTO-SKIP LOGIC ───
        // If Plaid returned exactly 1 valid account → save it automatically & skip this page
        // If multiple accounts → user must pick one (show the form with picker)
        if (plaidResult && plaidResult.validAccounts.length === 1 && isMountedRef.current) {
          const account = plaidResult.validAccounts[0];
          const holderName = (data?.legal_first_name && data?.legal_last_name)
            ? `${data.legal_first_name} ${data.legal_last_name}`
            : (data?.bank_account_holder_name || '');

          console.log('[Step13] ✅ Single valid Plaid account — auto-saving & skipping page');
          setAutoSkipping(true);
          setAutoFillMessage('✅ Saving your bank details from Plaid...');

          try {
            // Auto-save bank data to onboarding_data
            const encryptedAccountNumber = btoa(account.achAccount);
            const acctType = (account.subtype === 'checking' || account.subtype === 'savings')
              ? account.subtype
              : 'checking';

            const { error: autoSaveError } = await upsertOnboardingData(user.id, {
              bank_name: plaidResult.institutionName || 'Plaid-linked Bank',
              bank_account_holder_name: holderName,
              bank_account_number_encrypted: encryptedAccountNumber,
              bank_routing_number: account.achRouting,
              bank_address_country: 'US', // ACH = US only
              bank_account_type: acctType,
              banking_info_skipped: false,
              banking_info_submitted_at: new Date().toISOString(),
              plaid_auto_filled: true, // Flag indicating auto-filled by Plaid
              current_step: 13,
              is_completed: true,
              completed_at: new Date().toISOString(),
            });

            if (autoSaveError) {
              console.error('[Step13] Auto-save failed, showing manual form:', autoSaveError);
              setAutoSkipping(false);
              setAutoFillMessage('⚠️ Auto-save failed. Please enter details manually.');
              // Fall through — user will see the manual form
            } else {
              // Success! Navigate to meet-ceo page, skip showing the form
              console.log('[Step13] ✅ Bank data auto-saved via Plaid — navigating to meet-ceo');
              navigate('/onboarding/meet-ceo');
              return; // Exit loadData — component will unmount
            }
          } catch (saveErr) {
            console.error('[Step13] Auto-save exception:', saveErr);
            setAutoSkipping(false);
            setAutoFillMessage('⚠️ Auto-save failed. Please enter details manually.');
            // Fall through — show manual form
          }
        }
        // If plaidResult has multiple accounts or null → show manual form (already handled)
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
  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Validation functions for each field
  const validateBankName = (value: string): string | null => {
    if (!value.trim()) return 'Bank name is required';
    if (value.trim().length < 2) return 'Bank name must be at least 2 characters';
    if (value.trim().length > 100) return 'Bank name is too long';
    return null;
  };

  const validateAccountHolderName = (value: string): string | null => {
    if (!value.trim()) return 'Account holder name is required';
    if (value.trim().length < 2) return 'Name must be at least 2 characters';
    if (!/^[a-zA-Z\s\-'.]+$/.test(value.trim())) return 'Name should only contain letters';
    if (value.trim().length > 100) return 'Name is too long';
    return null;
  };

  const validateAccountNumber = (value: string): string | null => {
    if (!value.trim()) return 'Account number is required';
    if (!/^\d+$/.test(value)) return 'Account number must contain only digits';
    if (value.length < 4) return 'Account number must be at least 4 digits';
    if (value.length > 17) return 'Account number is too long';
    return null;
  };

  const validateConfirmAccountNumber = (value: string, original: string): string | null => {
    if (!value.trim()) return 'Please confirm your account number';
    if (value !== original) return 'Account numbers do not match';
    return null;
  };

  const validateBankCountry = (value: string): string | null => {
    if (!value) return 'Please select a country';
    return null;
  };

  const validateRoutingNumber = (value: string, country: string): string | null => {
    if (!value.trim()) return 'Routing number is required';
    if (!/^\d+$/.test(value)) return 'Routing number must contain only digits';
    // US routing numbers must be exactly 9 digits
    if (country === 'US' && value.length !== 9) return 'US routing number must be exactly 9 digits';
    // For other countries, allow 5-15 digits
    if (country !== 'US' && (value.length < 5 || value.length > 15)) return 'Routing number must be 5-15 digits';
    return null;
  };

  // Get error for each field
  const bankNameError = validateBankName(bankName);
  const accountHolderNameError = validateAccountHolderName(accountHolderName);
  const accountNumberError = validateAccountNumber(accountNumber);
  const confirmAccountNumberError = validateConfirmAccountNumber(confirmAccountNumber, accountNumber);
  const bankCountryError = validateBankCountry(bankCountry);
  const routingNumberError = validateRoutingNumber(routingNumber, bankCountry);

  // Check if form is valid
  const isFormValid = (): boolean => {
    return (
      !bankNameError &&
      !accountHolderNameError &&
      !accountNumberError &&
      !confirmAccountNumberError &&
      !bankCountryError &&
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
    if (!bankCountry) {
      setError('Please select your bank country');
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

    // ⚠️ NOTE: btoa() is base64 ENCODING, not encryption.
    // TODO: Replace with server-side AES-256 encryption or Supabase Vault for production security.
    const encryptedAccountNumber = btoa(accountNumber);

    const { error: upsertError } = await upsertOnboardingData(user.id, {
      bank_name: bankName.trim(),
      bank_account_holder_name: accountHolderName.trim(),
      bank_account_number_encrypted: encryptedAccountNumber,
      bank_routing_number: routingNumber.trim(),
      bank_address_city: bankCity.trim() || null,
      bank_address_country: bankCountry,
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
    navigate('/onboarding/step-11');
  };

  return (
    <div
      className="bg-white min-h-[100dvh]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", WebkitFontSmoothing: 'antialiased' }}
    >
      {/* ═══ iOS Navigation Bar ═══ */}
      <nav
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#C6C6C8]/30 flex items-end justify-between px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 12px) + 4px)', minHeight: '48px' }}
      >
        <button onClick={handleBack} className="text-[#007AFF] flex items-center -ml-2 active:opacity-50 transition-opacity" aria-label="Go back">
          <span className="material-symbols-outlined text-3xl -mr-1" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_left</span>
          <span className="text-[17px] leading-none pb-[2px]">Back</span>
        </button>
        <span className="font-semibold text-[17px] text-black">Setup</span>
        <button onClick={handleSkip} className="text-[17px] text-[#007AFF] font-normal active:opacity-50 transition-opacity">Skip</button>
      </nav>

      <main className="max-w-lg mx-auto w-full px-4 pt-2 pb-48">
        {/* ─── Progress ─── */}
        <div className="mb-6 mt-2">
          <div className="flex justify-between items-end mb-2 px-1">
            <span className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide">Onboarding Progress</span>
            <span className="text-[13px] text-[#8E8E93]">Step 12/12</span>
          </div>
          <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#007AFF] w-full rounded-full" />
          </div>
          <p className="mt-1.5 px-1 text-[12px] font-medium text-[#007AFF]">100% complete</p>
        </div>

        {/* ─── Title ─── */}
        <h1 className="text-[34px] leading-tight font-bold text-black tracking-tight mb-2 px-1">Bank Details</h1>
        <p className="text-[17px] leading-snug text-[#8E8E93] mb-8 px-1">
          Provide your banking information for investment transfers securely.
        </p>

        {/* ─── Auto-Skip Transition Screen ─── */}
        {autoSkipping && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-16 h-16 bg-[#F0F7FF] rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[#007AFF] text-3xl">account_balance</span>
            </div>
            <h2 className="text-[20px] font-semibold text-black mb-2">Saving Bank Details</h2>
            <p className="text-[15px] text-[#8E8E93] text-center max-w-xs mb-6">
              Your bank information from Plaid is being saved automatically...
            </p>
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[#007AFF] rounded-full animate-spin" />
          </div>
        )}

        {/* ─── Page Loading Shimmer ─── */}
        {pageLoading && !autoSkipping && (
          <div className="space-y-4 animate-pulse">
            <div className="h-[120px] bg-gray-100 rounded-xl" />
            <div className="space-y-0 rounded-[10px] overflow-hidden border border-gray-100">
              {[1,2,3,4].map(i => <div key={i} className="h-[44px] bg-gray-50 border-b border-gray-100" />)}
            </div>
            <div className="space-y-0 rounded-[10px] overflow-hidden border border-gray-100">
              {[1,2,3].map(i => <div key={i} className="h-[44px] bg-gray-50 border-b border-gray-100" />)}
            </div>
            <div className="flex justify-center pt-4">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-[#007AFF] rounded-full animate-spin" />
            </div>
            <p className="text-center text-[13px] text-[#8E8E93]">Loading your data...</p>
          </div>
        )}

        {/* ─── Form Content (hidden while loading or auto-skipping) ─── */}
        {!pageLoading && !autoSkipping && <>
          {/* Error Message */}
          {error && (
            <div className="mx-5 mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Plaid Auto-Fill Banner */}
          {autoFillMessage && (
            <div className="mx-5 mb-4 p-3 bg-[#F0F7FF] border border-[#2b8cee]/20 rounded-xl text-[#2b8cee] text-sm font-medium text-center animate-pulse">
              {autoFillMessage}
            </div>
          )}

          {/* Multi-Account Selector — shown when Plaid returns 2+ accounts */}
          {plaidAccounts.length > 1 && (
            <div className="mx-5 mb-5">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">
                  {plaidInstitutionName ? `${plaidInstitutionName} - ` : ''}SELECT ACCOUNT
                </p>
                <div className="space-y-2">
                  {plaidAccounts.map((acct, idx) => {
                    const isSelected = idx === selectedAccountIdx;
                    return (
                      <button
                        key={acct.accountId || idx}
                        type="button"
                        onClick={() => {
                          setSelectedAccountIdx(idx);
                          // Clear user modifications for auto-fillable fields so the new account applies
                          userModifiedFields.current.delete('accountNumber');
                          userModifiedFields.current.delete('confirmAccountNumber');
                          userModifiedFields.current.delete('routingNumber');
                          userModifiedFields.current.delete('accountType');
                          applyAccountSelection(acct);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                          isSelected
                            ? 'border-[#2b8cee] bg-[#F0F7FF] ring-1 ring-[#2b8cee]/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                        aria-label={`Select ${acct.name} ending in ${acct.mask}`}
                      >
                        {/* Radio indicator */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#2b8cee]' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#2b8cee]" />}
                        </div>
                        {/* Account info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{acct.name}</p>
                          <p className="text-xs text-slate-500">
                            {acct.subtype.charAt(0).toUpperCase() + acct.subtype.slice(1)} &middot; &bull;&bull;&bull;&bull;{acct.mask}
                          </p>
                        </div>
                        {/* Selected check */}
                        {isSelected && (
                          <span className="text-[#2b8cee] text-sm font-bold">*</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Investment Amount Card */}
          {hasAnyUnits && (
            <div className="mx-5 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-1">
                  INVESTMENT AMOUNT
                </p>
                <div className="text-3xl font-bold text-slate-900 mb-4">
                  {formatCurrency(totalInvestment)}
                </div>
                
                {/* Share Class Pills */}
                <div className="flex flex-wrap gap-2">
                  {SHARE_CLASSES.map((shareClass) => {
                    const units = getUnits(shareClass.id);
                    if (units === 0) return null;
                    
                    return (
                      <div
                        key={shareClass.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{
                          backgroundColor: shareClass.bgColor,
                          border: `1px solid ${shareClass.borderColor}`,
                        }}
                      >
                        {shareClass.icon}
                        <span 
                          className="text-xs font-bold"
                          style={{ color: shareClass.color }}
                        >
                          {shareClass.name} —{units}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── BANKING INFORMATION — iOS Grouped Table ─── */}
          <div className="mb-8">
            <div className="uppercase text-[13px] text-[#8E8E93] mb-2 px-4 font-normal">Banking Information</div>
            <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] divide-y divide-[#C6C6C8]/50">
              {/* Bank Name */}
              <div className="flex items-center min-h-[44px] px-4 active:bg-gray-100 transition-colors">
                <label className="w-1/3 text-[17px] text-black py-3">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => { userModifiedFields.current.add('bankName'); setBankName(e.target.value); }}
                  onBlur={() => handleBlur('bankName')}
                  placeholder="Required"
                  className="w-2/3 bg-transparent border-none text-[17px] text-right text-black placeholder-[#8E8E93] focus:ring-0 p-0"
                />
              </div>
              {/* Holder Name */}
              <div className="flex items-center min-h-[44px] px-4 active:bg-gray-100 transition-colors">
                <label className="w-1/3 text-[17px] text-black py-3 whitespace-nowrap">Holder Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  onBlur={() => handleBlur('accountHolderName')}
                  placeholder="Required"
                  className="w-2/3 bg-transparent border-none text-[17px] text-right text-black placeholder-[#8E8E93] focus:ring-0 p-0"
                />
              </div>
              {/* Account Type */}
              <div className="flex items-center justify-between min-h-[44px] px-4 cursor-pointer">
                <label className="text-[17px] text-black py-3">Account Type</label>
                <div className="flex items-center">
                  <span className="text-[17px] text-[#8E8E93] mr-2">{formattedOnboardingAccountType}</span>
                  <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
                </div>
              </div>
              {/* Country */}
              <div className="flex items-center justify-between min-h-[44px] px-4 cursor-pointer relative">
                <label className="text-[17px] text-black py-3">Country</label>
                <div className="flex items-center">
                  <select
                    value={bankCountry}
                    onChange={(e) => { userModifiedFields.current.add('bankCountry'); setBankCountry(e.target.value); handleBlur('bankCountry'); }}
                    onBlur={() => handleBlur('bankCountry')}
                    className="appearance-none bg-transparent border-none text-[17px] text-[#8E8E93] text-right focus:ring-0 p-0 pr-6 cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} disabled={c.code === ''}>{c.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-gray-400 text-lg absolute right-4 pointer-events-none">chevron_right</span>
                </div>
              </div>
            </div>
            <p className="mt-2 px-4 text-[13px] text-[#8E8E93] leading-normal">Ensure the account holder name matches your ID exactly.</p>
            {touched.bankName && bankNameError && <p className="mt-1 px-4 text-[13px] text-red-500">{bankNameError}</p>}
            {touched.accountHolderName && accountHolderNameError && <p className="mt-1 px-4 text-[13px] text-red-500">{accountHolderNameError}</p>}
          </div>

          {/* ─── ACCOUNT DETAILS — iOS Grouped Table ─── */}
          <div className="mb-8">
            <div className="uppercase text-[13px] text-[#8E8E93] mb-2 px-4 font-normal">Account Details</div>
            <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] divide-y divide-[#C6C6C8]/50">
              {/* Routing # */}
              <div className="flex items-center min-h-[44px] px-4 active:bg-gray-100 transition-colors">
                <label className="w-1/3 text-[17px] text-black py-3">Routing #</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={routingNumber}
                  onChange={(e) => { userModifiedFields.current.add('routingNumber'); setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, bankCountry === 'US' ? 9 : 15)); }}
                  onBlur={() => handleBlur('routingNumber')}
                  placeholder="9 digits"
                  maxLength={bankCountry === 'US' ? 9 : 15}
                  className="w-2/3 bg-transparent border-none text-[17px] text-right text-black placeholder-[#8E8E93] focus:ring-0 p-0 font-mono tracking-tight"
                />
              </div>
              {/* Account # */}
              <div className="flex items-center min-h-[44px] px-4 active:bg-gray-100 transition-colors">
                <label className="w-1/3 text-[17px] text-black py-3">Account #</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => { userModifiedFields.current.add('accountNumber'); setAccountNumber(e.target.value.replace(/\D/g, '')); }}
                  onBlur={() => handleBlur('accountNumber')}
                  placeholder="Required"
                  className="w-2/3 bg-transparent border-none text-[17px] text-right text-black placeholder-[#8E8E93] focus:ring-0 p-0 font-mono tracking-tight"
                />
              </div>
              {/* Confirm # */}
              <div className="flex items-center min-h-[44px] px-4 active:bg-gray-100 transition-colors">
                <label className="w-1/3 text-[17px] text-black py-3">Confirm #</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={confirmAccountNumber}
                  onChange={(e) => { userModifiedFields.current.add('confirmAccountNumber'); setConfirmAccountNumber(e.target.value.replace(/\D/g, '')); }}
                  onBlur={() => handleBlur('confirmAccountNumber')}
                  placeholder="Re-enter number"
                  className="w-2/3 bg-transparent border-none text-[17px] text-right text-black placeholder-[#8E8E93] focus:ring-0 p-0 font-mono tracking-tight"
                />
              </div>
            </div>
            <p className="mt-2 px-4 text-[13px] text-[#8E8E93] leading-normal">Routing number can be found on the bottom left of your check.</p>
            {touched.routingNumber && routingNumberError && <p className="mt-1 px-4 text-[13px] text-red-500">{routingNumberError}</p>}
            {touched.accountNumber && accountNumberError && <p className="mt-1 px-4 text-[13px] text-red-500">{accountNumberError}</p>}
            {touched.confirmAccountNumber && confirmAccountNumberError && <p className="mt-1 px-4 text-[13px] text-red-500">{confirmAccountNumberError}</p>}
          </div>

          {/* ─── Security Badge ─── */}
          <div className="flex flex-col items-center justify-center mt-6 mb-8 opacity-80">
            <div className="flex items-center space-x-1.5 text-[#8E8E93]">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span className="text-[13px] font-medium">Bank-level Security</span>
            </div>
            <p className="text-[11px] text-[#8E8E93] mt-1 text-center max-w-xs">
              Your data is encrypted with 256-bit SSL security.
            </p>
          </div>
        </>}
        </main>

        {/* ═══ iOS Fixed Footer ═══ */}
        {!isFooterVisible && !autoSkipping && (
          <div
            className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#C6C6C8]/30 px-4 pt-3 z-50"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
            data-onboarding-footer
          >
            <div className="max-w-lg mx-auto flex flex-col gap-3">
              <div className="flex gap-4 h-[50px]">
                <button onClick={handleBack} disabled={loading} className="flex-1 bg-gray-200 text-black font-semibold text-[17px] rounded-xl active:bg-gray-300 transition-colors">Back</button>
                <button
                  onClick={handleContinue}
                  disabled={loading || !isFormValid()}
                  data-onboarding-cta
                  className={`flex-1 rounded-xl font-semibold text-[17px] flex items-center justify-center gap-1 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 ${
                    isFormValid() && !loading ? 'bg-[#007AFF] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Saving...' : 'Continue'}
                  {!loading && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
                </button>
              </div>
              <button onClick={handleSkip} disabled={loading} className="text-[15px] font-medium text-[#8E8E93] active:text-[#007AFF] transition-colors text-center">
                I'll do this later
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default OnboardingStep13;
