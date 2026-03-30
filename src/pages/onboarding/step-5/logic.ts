import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { TOTAL_VISIBLE_ONBOARDING_STEPS } from '../../../services/onboarding/flow';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import type { UIAccountType } from '../../../types/onboarding';
import { ACCOUNT_TYPE_OPTIONS } from '../../../types/onboarding';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';
import { locationService } from '../../../services/location';

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

export const CURRENT_STEP = 5;
export const TOTAL_STEPS = TOTAL_VISIBLE_ONBOARDING_STEPS;
export const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

export interface DialCodeOption {
  code: string;
  country: string;
  iso: string;
}

export const PHONE_DIAL_CODES: DialCodeOption[] = [
  { code: '+1', country: 'United States', iso: 'US' },
  { code: '+44', country: 'United Kingdom', iso: 'GB' },
  { code: '+33', country: 'France', iso: 'FR' },
  { code: '+49', country: 'Germany', iso: 'DE' },
  { code: '+39', country: 'Italy', iso: 'IT' },
  { code: '+34', country: 'Spain', iso: 'ES' },
  { code: '+31', country: 'Netherlands', iso: 'NL' },
  { code: '+91', country: 'India', iso: 'IN' },
  { code: '+86', country: 'China', iso: 'CN' },
  { code: '+81', country: 'Japan', iso: 'JP' },
  { code: '+82', country: 'South Korea', iso: 'KR' },
  { code: '+61', country: 'Australia', iso: 'AU' },
  { code: '+65', country: 'Singapore', iso: 'SG' },
  { code: '+971', country: 'United Arab Emirates', iso: 'AE' },
  { code: '+966', country: 'Saudi Arabia', iso: 'SA' },
  { code: '+55', country: 'Brazil', iso: 'BR' },
  { code: '+52', country: 'Mexico', iso: 'MX' },
  { code: '+7', country: 'Russia', iso: 'RU' },
  { code: '+62', country: 'Indonesia', iso: 'ID' },
  { code: '+60', country: 'Malaysia', iso: 'MY' },
  { code: '+66', country: 'Thailand', iso: 'TH' },
  { code: '+63', country: 'Philippines', iso: 'PH' },
  { code: '+92', country: 'Pakistan', iso: 'PK' },
  { code: '+880', country: 'Bangladesh', iso: 'BD' },
  { code: '+27', country: 'South Africa', iso: 'ZA' },
  { code: '+234', country: 'Nigeria', iso: 'NG' },
  { code: '+20', country: 'Egypt', iso: 'EG' },
  { code: '+90', country: 'Turkey', iso: 'TR' },
];

/** Maps UIAccountType → legacy account_structure for backward compatibility */
const toAccountStructure = (accountType: UIAccountType): 'individual' | 'other' => {
  return accountType === 'individual' ? 'individual' : 'other';
};

/* ═══════════════════════════════════════════════
   RE-EXPORTS for UI
   ═══════════════════════════════════════════════ */

export { ACCOUNT_TYPE_OPTIONS };
export type { UIAccountType };

/* ═══════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════ */

/**
 * Parse a full international phone number (e.g. "+12125551234")
 * into { dialCode, localNumber } by matching against known dial codes.
 * Uses longest-match to handle codes like +1 vs +91.
 */
const parseInternationalPhone = (raw: string): { dialCode: string; localNumber: string } | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) return null;

  // Sort dial codes by length descending to match longest first (e.g. +880 before +8)
  const sorted = [...PHONE_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const opt of sorted) {
    if (cleaned.startsWith(opt.code)) {
      const local = cleaned.slice(opt.code.length);
      if (local.length >= 6) {
        return { dialCode: opt.code, localNumber: local };
      }
    }
  }
  return null;
};

export function useStep5Logic() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<UIAccountType | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [selectedDialCountryIso, setSelectedDialCountryIso] = useState('US');
  const [isAutoDetectingDialCode, setIsAutoDetectingDialCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDialPicker, setShowDialPicker] = useState(false);
  const [isPreFilledFromBank, setIsPreFilledFromBank] = useState(false);
  const isFooterVisible = useFooterVisibility();

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

  /* ─── Load user + existing data ─── */
  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);

      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Restore account type
      if (onboardingData?.account_type) {
        const validTypes: UIAccountType[] = ['individual', 'joint', 'retirement', 'trust'];
        const saved = onboardingData.account_type as string;
        if (validTypes.includes(saved as UIAccountType)) {
          setSelectedAccountType(saved as UIAccountType);
        }
      } else if (onboardingData?.account_structure === 'individual') {
        setSelectedAccountType('individual');
      }

      /* ── Pre-populate phone from Plaid identity if not already saved ── */
      let hasPhoneFromOnboarding = false;

      if (onboardingData?.phone_number) {
        setPhoneNumber(String(onboardingData.phone_number).replace(/\D/g, ''));
        hasPhoneFromOnboarding = true;
      }

      /* Try Plaid identity data for phone pre-fill (only if no phone saved yet) */
      let plaidSetDialCode = false;
      if (!hasPhoneFromOnboarding) {
        try {
          const { data: financialData } = await config.supabaseClient
            .from('user_financial_data')
            .select('identity_data')
            .eq('user_id', user.id)
            .maybeSingle();

          if (financialData?.identity_data) {
            const identityData = financialData.identity_data as any;
            const accounts = identityData?.accounts || [];
            const owners = accounts[0]?.owners || [];
            const owner = owners[0];

            if (owner?.phone_numbers?.length) {
              // Use the first (primary) phone number from bank
              const bankPhone = owner.phone_numbers[0]?.data;
              if (bankPhone) {
                const parsed = parseInternationalPhone(String(bankPhone));
                if (parsed) {
                  setPhoneNumber(parsed.localNumber);
                  setCountryCode(parsed.dialCode);
                  const matched = PHONE_DIAL_CODES.find((o) => o.code === parsed.dialCode);
                  if (matched) setSelectedDialCountryIso(matched.iso);
                  setIsPreFilledFromBank(true);
                  plaidSetDialCode = true;
                  console.log('[Step5] Phone pre-filled from Plaid identity:', parsed.dialCode, parsed.localNumber.slice(0, 3) + '***');
                }
              }
            }
          }
        } catch (err) {
          console.warn('[Step5] Plaid identity fetch failed (ignoring):', err);
        }
      }

      /* Only run dial code detection if Plaid didn't already set it */
      if (!plaidSetDialCode) {
        const sharedLocationRecord = await locationService.readSharedLocationCache(user.id);
        const sharedLocation = sharedLocationRecord?.data || null;
        const savedPhoneCode = onboardingData?.phone_country_code ? String(onboardingData.phone_country_code) : '';
        const cachedDial =
          savedPhoneCode ||
          (sharedLocation?.phoneDialCode ? String(sharedLocation.phoneDialCode) : '') ||
          (onboardingData?.gps_detected_phone_dial_code ? String(onboardingData.gps_detected_phone_dial_code) : '') ||
          ((onboardingData?.gps_location_data as any)?.phoneDialCode ? String((onboardingData.gps_location_data as any).phoneDialCode) : '');

        if (cachedDial) {
          setCountryCode(cachedDial);
          if (sharedLocation?.countryCode) {
            const sharedIso = String(sharedLocation.countryCode).toUpperCase();
            if (PHONE_DIAL_CODES.some((o) => o.iso === sharedIso)) setSelectedDialCountryIso(sharedIso);
          } else {
            const matched = PHONE_DIAL_CODES.find((o) => o.code === cachedDial);
            if (matched) setSelectedDialCountryIso(matched.iso);
          }
        } else {
          setIsAutoDetectingDialCode(true);
          try {
            const cachedLocation = await locationService.getCachedLocation(user.id);
            const resolvedLocation = cachedLocation || await locationService.getLocationByIp();

            if (resolvedLocation?.phoneDialCode) {
              setCountryCode(resolvedLocation.phoneDialCode);
              const matched = PHONE_DIAL_CODES.find((o) => o.code === resolvedLocation.phoneDialCode);
              if (matched) setSelectedDialCountryIso(matched.iso);
            }
            if (resolvedLocation?.countryCode) {
              const iso = String(resolvedLocation.countryCode).toUpperCase();
              if (PHONE_DIAL_CODES.some((o) => o.iso === iso)) setSelectedDialCountryIso(iso);
            }
            if (!cachedLocation && resolvedLocation) {
              try { await locationService.saveLocationToOnboarding(user.id, resolvedLocation, 'ip'); }
              catch (e) { console.warn('[Step5] cache fail:', e); }
            }
          } catch (err) {
            console.warn('[Step5] IP detection failed:', err);
          } finally {
            setIsAutoDetectingDialCode(false);
          }
        }
      } // end if (!plaidSetDialCode)
    };
    getCurrentUser();
  }, [navigate]);

  /* ─── Phone formatting ─── */
  const formatPhoneNumber = (value: string) => {
    const d = value.replace(/\D/g, '');
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    if (d.length <= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
    return d;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 15) {
      setPhoneNumber(value);
      // Clear pre-filled badge once user edits the phone
      if (isPreFilledFromBank) setIsPreFilledFromBank(false);
    }
  };

  const isValidPhone = phoneNumber.length >= 8 && phoneNumber.length <= 15;
  const canContinue = Boolean(selectedAccountType) && isValidPhone;

  const selectedDialOption = useMemo(() => {
    return PHONE_DIAL_CODES.find((o) => o.code === countryCode && o.iso === selectedDialCountryIso)
      || PHONE_DIAL_CODES.find((o) => o.code === countryCode)
      || PHONE_DIAL_CODES[0];
  }, [countryCode, selectedDialCountryIso]);

  /* ─── Handlers ─── */
  const handleContinue = async () => {
    if (!selectedAccountType || !userId || !config.supabaseClient || !isValidPhone) return;
    setIsLoading(true);
    try {
      await upsertOnboardingData(userId, {
        account_type: selectedAccountType,
        account_structure: toAccountStructure(selectedAccountType),
        phone_number: phoneNumber,
        phone_country_code: countryCode,
        current_step: 5,
      });
      navigate('/onboarding/step-7');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => navigate('/onboarding/step-4');
  const handleSkip = () => navigate('/onboarding/step-7');

  const handleSelectDialCode = (option: DialCodeOption) => {
    setCountryCode(option.code);
    setSelectedDialCountryIso(option.iso);
    setShowDialPicker(false);
  };

  return {
    // State
    selectedAccountType,
    setSelectedAccountType,
    phoneNumber,
    countryCode,
    selectedDialCountryIso,
    isAutoDetectingDialCode,
    isLoading,
    showDialPicker,
    setShowDialPicker,
    isFooterVisible,

    // Derived
    isValidPhone,
    canContinue,
    selectedDialOption,
    formatPhoneNumber,
    isPreFilledFromBank,

    // Handlers
    handlePhoneChange,
    handleContinue,
    handleBack,
    handleSkip,
    handleSelectDialCode,
  };
}
