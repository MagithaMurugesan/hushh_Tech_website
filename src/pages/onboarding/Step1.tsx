import React, { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../utils/useFooterVisibility';

// Back arrow icon
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

// Minus icon
const MinusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12H19" />
  </svg>
);

// Plus icon
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5V19M5 12H19" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

type RecurringFrequency = 'once_a_month' | 'twice_a_month' | 'weekly' | 'every_other_week';

// Share class configurations matching HTML template
interface ShareClass {
  id: string;
  name: string;
  tier: 'ultra' | 'premium' | 'standard';
  unitPrice: number;
  displayPrice: string;
  description: string;
  stripeGradient: string;
  hoverBorder: string;
}

const SHARE_CLASSES: ShareClass[] = [
  {
    id: 'class_a',
    name: 'Class A',
    tier: 'ultra',
    unitPrice: 25000000,
    displayPrice: '$25M/unit',
    description: 'Ultra High Net Worth tier with maximum allocation priority and exclusive benefits.',
    stripeGradient: 'from-slate-300 to-slate-500',
    hoverBorder: 'hover:border-slate-300',
  },
  {
    id: 'class_b',
    name: 'Class B',
    tier: 'premium',
    unitPrice: 5000000,
    displayPrice: '$5M/unit',
    description: 'Premium tier with enhanced portfolio access and dedicated relationship management.',
    stripeGradient: 'from-amber-300 to-amber-500',
    hoverBorder: 'hover:border-amber-200',
  },
  {
    id: 'class_c',
    name: 'Class C',
    tier: 'standard',
    unitPrice: 1000000,
    displayPrice: '$1M/unit',
    description: 'Standard tier with full access to AI-powered multi-strategy alpha portfolio.',
    stripeGradient: 'bg-[#2b8cee]',
    hoverBorder: 'hover:border-[#2b8cee]/30',
  },
];

// Format currency for display
const formatCurrency = (amount: number): string => {
  if (amount === 0) return '$0';
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(0)}M`;
  }
  return `$${amount.toLocaleString()}`;
};

const MIN_RECURRING_AMOUNT = 100;
const MAX_RECURRING_AMOUNT = 100000000;

const formatNumberWithCommas = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const parseFormattedNumber = (value: string): number => {
  return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
};

export default function OnboardingStep1() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFooterVisible = useFooterVisibility();
  const [units, setUnits] = useState<Record<string, number>>({
    class_a: 0,
    class_b: 0,
    class_c: 0,
  });
  const [frequency, setFrequency] = useState<RecurringFrequency>('once_a_month');
  const [investmentDay, setInvestmentDay] = useState('1st');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  // Calculate total investment
  const totalInvestment = SHARE_CLASSES.reduce((total, shareClass) => {
    return total + (units[shareClass.id] * shareClass.unitPrice);
  }, 0);

  // Check if at least one unit is selected
  const hasSelection = Object.values(units).some(count => count > 0);

  useEffect(() => {
    // Scroll to top on component mount
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

      // Check if user intentionally skipped financial verification
      const hasSkipped = sessionStorage.getItem('financial_link_skipped') === 'true';

      if (hasSkipped) {
        // Keep the flag during onboarding to avoid local dev StrictMode double-effect redirect loops.
        console.log('[Step1] User skipped financial verification - allowing access');
      } else {
        // Gate: redirect to financial-link if not yet verified
        const { data: financialData } = await config.supabaseClient
          .from('user_financial_data')
          .select('status')
          .eq('user_id', user.id)
          .single();

        if (!financialData || (financialData.status !== 'complete' && financialData.status !== 'partial')) {
          navigate('/onboarding/financial-link', { replace: true });
          return;
        }
      }

      // Load existing selections if any
      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('class_a_units, class_b_units, class_c_units, recurring_frequency, recurring_day_of_month, recurring_amount')
        .eq('user_id', user.id)
        .single();

      if (onboardingData) {
        setUnits({
          class_a: onboardingData.class_a_units || 0,
          class_b: onboardingData.class_b_units || 0,
          class_c: onboardingData.class_c_units || 0,
        });

        if (onboardingData.recurring_frequency) {
          const freqMap: Record<string, RecurringFrequency> = {
            // Current DB values (match onboarding_data_recurring_frequency_check)
            once_a_month: 'once_a_month',
            twice_a_month: 'twice_a_month',
            weekly: 'weekly',
            every_other_week: 'every_other_week',

            // Legacy values (older constraint/data)
            monthly: 'once_a_month',
            bimonthly: 'twice_a_month',
            biweekly: 'every_other_week',
          };

          const raw = String(onboardingData.recurring_frequency);
          setFrequency(freqMap[raw] || 'once_a_month');
        }

        if (onboardingData.recurring_day_of_month) {
          const dayNum = onboardingData.recurring_day_of_month;
          if (dayNum === 31) {
            setInvestmentDay('Last');
          } else {
            const suffix = dayNum === 1 ? 'st' : dayNum === 2 ? 'nd' : dayNum === 3 ? 'rd' : 'th';
            setInvestmentDay(`${dayNum}${suffix}`);
          }
        }

        if (onboardingData.recurring_amount) {
          const amount = onboardingData.recurring_amount;
          if ([500000, 750000, 1000000, 1500000].includes(amount)) {
            setSelectedAmount(amount);
            setCustomAmount('');
          } else {
            setSelectedAmount(null);
            setCustomAmount(amount.toLocaleString());
          }
        }
      }
    };

    getCurrentUser();
  }, [navigate]);

  const handleUnitChange = (classId: string, delta: number) => {
    setUnits(prev => ({
      ...prev,
      [classId]: Math.max(0, prev[classId] + delta),
    }));
  };

  const handleAmountClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setCustomAmountError(null);
    setError(null);
  };

  const validateRecurringAmount = (rawValue: number): string | null => {
    if (rawValue === 0) return null;
    if (rawValue < MIN_RECURRING_AMOUNT) {
      return `Minimum recurring amount is $${MIN_RECURRING_AMOUNT.toLocaleString()}`;
    }
    if (rawValue > MAX_RECURRING_AMOUNT) {
      return `Maximum recurring amount is $${(MAX_RECURRING_AMOUNT / 1000000).toFixed(0)}M`;
    }
    return null;
  };

  const handleCustomAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedAmount(null);
    setError(null);

    const rawValue = e.target.value.replace(/[^\d]/g, '');
    if (rawValue.length > 12) return;

    const formattedValue = formatNumberWithCommas(rawValue);
    setCustomAmount(formattedValue);
    setCustomAmountError(validateRecurringAmount(parseFormattedNumber(formattedValue)));
  };

  const getFinalRecurringAmount = () => {
    if (selectedAmount) return selectedAmount;
    return parseFormattedNumber(customAmount);
  };

  const handleNext = async () => {
    if (!userId || !config.supabaseClient || !hasSelection) return;
    if (customAmountError) {
      setError(customAmountError);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const recurringAmount = getFinalRecurringAmount();
      const convertDayToInt = (day: string | number): number => {
        if (typeof day === 'number') return day;
        if (day === 'Last') return 31;
        return parseInt(day.replace(/\D/g, ''), 10);
      };

      const convertFrequencyToDb = (freq: RecurringFrequency): string => {
        // DB constraint expects these exact values.
        return freq;
      };

      const updateData: Record<string, unknown> = {
        selected_fund: 'hushh_fund_a',
        class_a_units: units.class_a,
        class_b_units: units.class_b,
        class_c_units: units.class_c,
        initial_investment_amount: totalInvestment,
        current_step: 1,
        updated_at: new Date().toISOString(),
      };

      if (recurringAmount > 0) {
        updateData.recurring_frequency = convertFrequencyToDb(frequency);
        updateData.recurring_day_of_month = convertDayToInt(investmentDay);
        updateData.recurring_amount = recurringAmount;
      } else {
        updateData.recurring_frequency = null;
        updateData.recurring_day_of_month = null;
        updateData.recurring_amount = null;
      }

      // Save share unit selections to database (upsert: creates row if missing)
      const { error: saveError } = await upsertOnboardingData(userId, updateData);

      if (saveError) {
        setError(saveError.message || 'Failed to save investment details');
        return;
      }

      // Step 1 is persisted; skip marker is no longer needed.
      sessionStorage.removeItem('financial_link_skipped');

      // Navigate to step 2
      navigate('/onboarding/step-2');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/onboarding/financial-link');
  };

  // Render share class card
  const renderShareClassCard = (shareClass: ShareClass) => {
    const unitCount = units[shareClass.id];
    const isUltra = shareClass.tier === 'ultra';
    const isPremium = shareClass.tier === 'premium';

    return (
      <div
        key={shareClass.id}
        className={`group relative rounded-xl border border-slate-200 bg-white p-5 transition-all ${shareClass.hoverBorder} hover:shadow-md`}
      >
        {/* Left colored vertical stripe */}
        <div 
          className={`absolute left-0 top-4 h-8 w-1 rounded-r-full ${
            shareClass.tier === 'standard' 
              ? 'bg-[#2b8cee]' 
              : `bg-gradient-to-b ${shareClass.stripeGradient}`
          }`}
        />
        
        <div className="flex flex-col gap-4">
          {/* Top row: Class name, badge, price */}
          <div className="flex items-start justify-between">
            <div className="max-w-[65%]">
              <h3 className="text-slate-900 text-lg font-bold">{shareClass.name}</h3>
              
              {/* Tier badge */}
              {isUltra && (
                <div className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wide">
                  ULTRA
                </div>
              )}
              {isPremium && (
                <div className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 uppercase tracking-wide">
                  PREMIUM
                </div>
              )}
              
              <p className="text-slate-500 text-xs font-medium mt-2 leading-relaxed">
                {shareClass.description}
              </p>
            </div>
            
            <div className="text-right shrink-0">
              <p className="text-slate-900 text-lg font-bold">{shareClass.displayPrice}</p>
            </div>
          </div>

          {/* Bottom row: Units selector */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Units</span>
            
            <div className="flex items-center gap-3 bg-slate-50 rounded-full p-1 border border-slate-100">
              {/* Minus button */}
              <button
                onClick={() => handleUnitChange(shareClass.id, -1)}
                disabled={unitCount === 0}
                className="flex size-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-300 transition-colors disabled:opacity-50"
              >
                <MinusIcon />
              </button>
              
              {/* Unit count */}
              <span className="w-8 text-center text-slate-900 font-bold text-lg">
                {unitCount}
              </span>
              
              {/* Plus button */}
              <button
                onClick={() => handleUnitChange(shareClass.id, 1)}
                className="flex size-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-slate-300 active:bg-slate-50 transition-colors"
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="bg-slate-50 min-h-screen"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="onboarding-shell relative flex min-h-screen w-full flex-col bg-white max-w-[500px] mx-auto shadow-xl overflow-hidden border-x border-slate-100">
        
        {/* Sticky Header */}
        <header className="flex items-center px-4 pt-4 pb-2 bg-white sticky top-0 z-10">
          <button 
            onClick={handleBack}
            aria-label="Go back"
            className="flex size-10 shrink-0 items-center justify-center text-slate-900 rounded-full hover:bg-slate-50 transition-colors"
          >
            <BackIcon />
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col px-4 sm:px-6 pb-56 sm:pb-72">
          {/* Header Section */}
          <div className="mb-8 mt-2 flex flex-col items-center text-center">
            <h1 className="text-slate-900 text-[22px] font-extrabold leading-tight tracking-tight mb-2">
              Hushh Fund A: AI-Powered Multi-Strategy Alpha
            </h1>
            <p className="text-slate-500 text-sm font-bold tracking-wide uppercase">
              TAGLINE: The AI-Powered Berkshire Hathaway
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <p className="text-slate-900 font-bold mb-2 text-base">
              Select the number of units for each share class. You can invest in multiple classes.
            </p>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">
              Our inaugural fund demonstrating an AI-driven value investing strategy designed to deliver consistent, market-beating returns and sustainable, risk-adjusted alpha.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Share Class Cards */}
          <div className="flex flex-col gap-6">
            {SHARE_CLASSES.map(renderShareClassCard)}
          </div>

          {/* Recurring Investment */}
          <div className="mt-8 mb-3">
            <h2 className="text-lg font-bold text-slate-900">Recurring Investment</h2>
            <p className="text-xs text-slate-500 mt-1">
              Optional. You can configure this now and avoid an extra step later.
            </p>
          </div>

          {/* Frequency Section */}
          <div className="mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-base font-bold text-slate-900 mb-4">Frequency</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { value: 'once_a_month', label: 'Once a month' },
                  { value: 'twice_a_month', label: 'Twice a month' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'every_other_week', label: 'Every other week' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFrequency(option.value as RecurringFrequency)}
                    className={`flex h-11 items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                      frequency === option.value
                        ? 'bg-[#2b8cee] text-white shadow-sm ring-2 ring-[#2b8cee] ring-offset-1'
                        : 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-slate-500">
                  Investment day
                </label>
                <select
                  value={investmentDay}
                  onChange={(e) => setInvestmentDay(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-300 bg-white text-slate-900 px-3 text-sm font-medium focus:border-[#2b8cee] focus:ring-1 focus:ring-[#2b8cee] outline-none appearance-none"
                >
                  <option value="1st">1st</option>
                  <option value="2nd">2nd</option>
                  <option value="5th">5th</option>
                  <option value="10th">10th</option>
                  <option value="15th">15th</option>
                  <option value="20th">20th</option>
                  <option value="25th">25th</option>
                  <option value="Last">Last day of month</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <ChevronDownIcon />
                </div>
              </div>
            </div>
          </div>

          {/* Recurring Amount Section */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-base font-bold text-slate-900 mb-4">Recurring Amount</h3>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[500000, 750000, 1000000, 1500000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountClick(amount)}
                    className={`relative flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                      selectedAmount === amount
                        ? 'border-2 border-[#2b8cee] bg-[#2b8cee]/5'
                        : 'border border-slate-200 bg-white hover:border-[#2b8cee]/50 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-sm font-bold ${
                      selectedAmount === amount ? 'text-[#2b8cee]' : 'text-slate-900'
                    }`}>
                      ${amount.toLocaleString()}
                    </span>
                    {selectedAmount === amount && (
                      <div className="absolute -top-2 -right-2 bg-[#2b8cee] text-white rounded-full p-0.5">
                        <CheckIcon />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <span className={`absolute inset-y-0 left-0 pl-3 flex items-center font-medium text-lg ${
                    customAmountError ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    placeholder="Other Amount"
                    className={`w-full h-12 rounded-xl border bg-white text-slate-900 pl-8 pr-3 text-lg font-bold outline-none transition-all placeholder:text-slate-300 ${
                      customAmountError
                        ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-300 focus:border-[#2b8cee] focus:ring-1 focus:ring-[#2b8cee]'
                    }`}
                  />
                </div>

                {customAmountError && (
                  <p className="text-red-500 text-xs font-medium px-1">{customAmountError}</p>
                )}
                {!customAmountError && customAmount && (
                  <p className="text-green-600 text-xs font-medium px-1">
                    Amount: ${parseFormattedNumber(customAmount).toLocaleString()}
                  </p>
                )}
                {!customAmount && selectedAmount === null && (
                  <p className="text-slate-400 text-xs px-1">
                    Leave empty if you want to set recurring later.
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Fixed Footer - Hidden when main footer is visible */}
        {!isFooterVisible && (
          <div
            className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[500px] mx-auto border-t border-slate-100 bg-white/90 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-5 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
            data-onboarding-footer
          >
            {/* Total Investment */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 tracking-wider uppercase">
                TOTAL INVESTMENT
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(totalInvestment)}
              </span>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Next Button */}
              <button
                onClick={handleNext}
                disabled={!hasSelection || isLoading || !!customAmountError}
                data-onboarding-cta
                className={`flex w-full h-11 sm:h-12 cursor-pointer items-center justify-center rounded-full bg-[#2b8cee] px-6 text-white text-sm sm:text-base font-semibold transition-all hover:bg-[#2070c0] active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400 ${
                  !hasSelection || isLoading || !!customAmountError ? 'disabled:cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Saving...' : 'Next'}
              </button>

              {/* Back Button */}
              <button
                onClick={handleBack}
                className="flex w-full cursor-pointer items-center justify-center rounded-full bg-transparent py-2 text-slate-500 text-sm font-semibold hover:text-slate-800 transition-colors"
              >
                Back
              </button>
            </div>

            {/* Footer Note */}
            <div className="mt-3 sm:mt-4 text-center">
              <p className="text-[10px] text-slate-400 leading-tight">
                Minimum investment per unit &bull; Units can be adjusted later
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
