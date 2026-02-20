import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select, {
  components,
  type OptionProps,
  type SingleValueProps,
  type StylesConfig,
} from 'react-select';
import ReactCountryFlag from 'react-country-flag';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import type { UIAccountType } from '../../types/onboarding';
import { ACCOUNT_TYPE_OPTIONS } from '../../types/onboarding';
import { useFooterVisibility } from '../../utils/useFooterVisibility';
import { locationService } from '../../services/location';
import { OnboardingStepProgress } from '../../components/onboarding/OnboardingStepProgress';

// Back arrow icon
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

interface DialCodeOption {
  code: string;
  country: string;
  iso: string;
}

const PHONE_DIAL_CODES: DialCodeOption[] = [
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

const DialCodeOptionRow = ({ option }: { option: DialCodeOption }) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <ReactCountryFlag
      countryCode={option.iso}
      svg
      style={{ width: '1.15em', height: '1.15em', borderRadius: 2, flexShrink: 0 }}
      aria-label={option.country}
      title={option.country}
    />
    <span className="truncate text-sm font-medium text-slate-900">{option.country}</span>
    <span className="ml-auto text-sm font-semibold text-slate-500">{option.code}</span>
  </div>
);

const DialCodeOptionComponent = (props: OptionProps<DialCodeOption, false>) => (
  <components.Option {...props}>
    <DialCodeOptionRow option={props.data} />
  </components.Option>
);

const DialCodeSingleValueComponent = (props: SingleValueProps<DialCodeOption, false>) => (
  <components.SingleValue {...props}>
    <DialCodeOptionRow option={props.data} />
  </components.SingleValue>
);

const dialCodeSelectStyles: StylesConfig<DialCodeOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 54,
    borderRadius: 12,
    borderColor: state.isFocused ? '#3A63B8' : '#E2E8F0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(58,99,184,0.22)' : '0 1px 2px rgba(15,23,42,0.06)',
    '&:hover': {
      borderColor: state.isFocused ? '#3A63B8' : '#CBD5E1',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '6px 10px',
  }),
  singleValue: (base) => ({
    ...base,
    margin: 0,
    width: '100%',
    maxWidth: '100%',
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 4,
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: '#64748B',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
    transition: 'transform 0.16s ease',
    ':hover': { color: '#334155' },
  }),
  menu: (base) => ({
    ...base,
    overflow: 'hidden',
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
    maxWidth: 'calc(100vw - 24px)',
    zIndex: 60,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 80,
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: 220,
    paddingTop: 4,
    paddingBottom: 4,
  }),
  option: (base, state) => ({
    ...base,
    padding: '10px 12px',
    backgroundColor: state.isSelected ? '#EAF2FF' : state.isFocused ? '#F8FAFC' : '#FFFFFF',
    color: '#0F172A',
    cursor: 'pointer',
  }),
};

/** Maps UIAccountType → legacy account_structure value for backward compatibility */
const toAccountStructure = (accountType: UIAccountType): 'individual' | 'other' => {
  return accountType === 'individual' ? 'individual' : 'other';
};

export default function OnboardingStep5() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<UIAccountType | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [selectedDialCountryIso, setSelectedDialCountryIso] = useState('US');
  const [isAutoDetectingDialCode, setIsAutoDetectingDialCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isFooterVisible = useFooterVisibility();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUserId(user.id);

      // Load existing data if any
      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Restore account type — prefer account_type, fall back to account_structure
      if (onboardingData?.account_type) {
        const validTypes: UIAccountType[] = ['individual', 'joint', 'retirement', 'trust'];
        const saved = onboardingData.account_type as string;
        if (validTypes.includes(saved as UIAccountType)) {
          setSelectedAccountType(saved as UIAccountType);
        }
      } else if (onboardingData?.account_structure === 'individual') {
        // Backward compat: old data only has account_structure
        setSelectedAccountType('individual');
      }

      if (onboardingData?.phone_number) {
        setPhoneNumber(String(onboardingData.phone_number).replace(/\D/g, ''));
      }

      const savedPhoneCode = onboardingData?.phone_country_code ? String(onboardingData.phone_country_code) : '';
      const cachedDial =
        savedPhoneCode ||
        (onboardingData?.gps_detected_phone_dial_code ? String(onboardingData.gps_detected_phone_dial_code) : '') ||
        ((onboardingData?.gps_location_data as any)?.phoneDialCode ? String((onboardingData.gps_location_data as any).phoneDialCode) : '');

      if (cachedDial) {
        setCountryCode(cachedDial);
        const matchedByDial = PHONE_DIAL_CODES.find((option) => option.code === cachedDial);
        if (matchedByDial) {
          setSelectedDialCountryIso(matchedByDial.iso);
        }
      } else {
        // No cached dial code yet: use IP location (no permission prompt) and cache it for later steps.
        setIsAutoDetectingDialCode(true);
        try {
          const ipLoc = await locationService.getLocationByIp();
          if (ipLoc?.phoneDialCode) {
            setCountryCode(ipLoc.phoneDialCode);
            const matchedByDial = PHONE_DIAL_CODES.find((option) => option.code === ipLoc.phoneDialCode);
            if (matchedByDial) {
              setSelectedDialCountryIso(matchedByDial.iso);
            }
          }
          if (ipLoc?.countryCode) {
            const iso = String(ipLoc.countryCode).toUpperCase();
            if (PHONE_DIAL_CODES.some((option) => option.iso === iso)) {
              setSelectedDialCountryIso(iso);
            }
          }
          if (!onboardingData?.gps_location_data) {
            try {
              await locationService.saveLocationToOnboarding(user.id, ipLoc);
            } catch (saveErr) {
              console.warn('[Step5] Failed to cache IP location:', saveErr);
            }
          }
        } catch (err) {
          console.warn('[Step5] IP dial code detection failed:', err);
        } finally {
          setIsAutoDetectingDialCode(false);
        }
      }
    };

    getCurrentUser();
  }, [navigate]);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 15) {
      setPhoneNumber(value);
    }
  };

  const isValidPhone = phoneNumber.length >= 8 && phoneNumber.length <= 15;
  const canContinue = Boolean(selectedAccountType) && isValidPhone;

  const dialCodeOptions = useMemo(() => {
    if (countryCode && !PHONE_DIAL_CODES.some((c) => c.code === countryCode)) {
      return [{ code: countryCode, country: `Custom (${countryCode})`, iso: 'US' }, ...PHONE_DIAL_CODES];
    }
    return PHONE_DIAL_CODES;
  }, [countryCode]);

  const selectedDialOption = useMemo(() => {
    const exactMatch = dialCodeOptions.find(
      (option) => option.code === countryCode && option.iso === selectedDialCountryIso,
    );
    if (exactMatch) return exactMatch;

    const codeMatch = dialCodeOptions.find((option) => option.code === countryCode);
    return codeMatch ?? null;
  }, [countryCode, dialCodeOptions, selectedDialCountryIso]);

  const handleContinue = async () => {
    if (!selectedAccountType || !userId || !config.supabaseClient || !isValidPhone) return;

    setIsLoading(true);
    try {
      await upsertOnboardingData(userId, {
        // Primary field — used by the profile page to display account type
        account_type: selectedAccountType,
        // Backward-compatible field — keeps legacy consumers working
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

  const handleBack = () => {
    navigate('/onboarding/step-4');
  };

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="onboarding-shell relative flex min-h-screen w-full flex-col bg-white max-w-[500px] mx-auto shadow-xl overflow-hidden border-x border-slate-100">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 flex items-center bg-white/90 px-4 pt-4 pb-2 backdrop-blur-sm sm:px-6 sm:pt-5">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-100"
          >
            <BackIcon />
          </button>
        </header>

        <OnboardingStepProgress currentStep={5} totalSteps={12} visibleSteps={12} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pb-40 sm:px-6 sm:pb-48">
          {/* Header Section */}
          <div className="mb-8 mt-2 text-center">
            <h1 className="text-3xl font-bold text-slate-900">
              A few more details
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-slate-500">
              This helps us personalize your account and keep your profile secure.
            </p>
          </div>

          {/* Account Type Selection — radio button list saves to account_type */}
          <h2 className="text-slate-900 text-base font-bold mb-3">Account type</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {ACCOUNT_TYPE_OPTIONS.map((option, index) => {
              const isSelected = selectedAccountType === option.value;
              const isLast = index === ACCOUNT_TYPE_OPTIONS.length - 1;

              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedAccountType(option.value)}
                  className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${
                    !isLast ? 'border-b border-gray-100' : ''
                  }`}
                  aria-label={`Select ${option.label} account`}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <span className="text-slate-900 text-base font-medium">{option.label}</span>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-[#2b8cee] bg-[#2b8cee]'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Phone Number */}
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-slate-900 text-base font-bold">Phone number</h2>
              {isAutoDetectingDialCode && (
                <span className="text-xs font-semibold text-slate-400">Detecting code...</span>
              )}
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              We&apos;ll use this to verify your identity when needed.
            </p>

            <div className="flex w-full gap-3">
              <div className="relative min-w-[124px] flex-[0.9]">
                <Select<DialCodeOption, false>
                  inputId="phone-country-code"
                  className="w-full"
                  options={dialCodeOptions}
                  value={selectedDialOption}
                  onChange={(selected) => {
                    if (!selected) return;
                    setSelectedDialCountryIso(selected.iso);
                    setCountryCode(selected.code);
                  }}
                  isSearchable
                  placeholder="Country"
                  styles={dialCodeSelectStyles}
                  components={{
                    Option: DialCodeOptionComponent,
                    SingleValue: DialCodeSingleValueComponent,
                  }}
                  menuPlacement="auto"
                  menuPosition="fixed"
                  maxMenuHeight={220}
                  menuShouldScrollIntoView={false}
                  menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
                  noOptionsMessage={() => 'No countries found'}
                />
              </div>

              <div className="relative flex-1">
                <input
                  type="tel"
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={handlePhoneChange}
                  placeholder="(000) 000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-[#3A63B8]"
                />
              </div>
            </div>

            <p className="pt-1 text-xs text-slate-500">
              Standard message and data rates may apply.
            </p>
          </div>
        </main>

        {/* Fixed Footer - Hidden when main footer is visible */}
        {!isFooterVisible && (
          <div
            className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[500px] mx-auto border-t border-slate-100 bg-white/90 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-5 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
            data-onboarding-footer
          >
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Continue Button */}
              <button
                onClick={handleContinue}
                disabled={!canContinue || isLoading}
                data-onboarding-cta
                className={`flex w-full h-11 sm:h-12 cursor-pointer items-center justify-center rounded-full px-6 text-sm sm:text-base font-semibold transition-all active:scale-[0.98] ${
                  canContinue && !isLoading
                    ? 'bg-[#3A63B8] text-white hover:bg-[#2e4f94] shadow-lg shadow-blue-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
