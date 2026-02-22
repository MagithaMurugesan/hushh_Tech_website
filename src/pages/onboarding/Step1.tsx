import React, { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../utils/useFooterVisibility';

/* ═══════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════ */

type RecurringFrequency = 'once_a_month' | 'twice_a_month' | 'weekly' | 'every_other_week';

interface ShareClass {
  id: string;
  name: string;
  tier: 'ultra' | 'premium' | 'standard';
  unitPrice: number;
  displayPrice: string;
  description: string;
  tierLabel?: string;
  tierBg?: string;
  tierText?: string;
}

const SHARE_CLASSES: ShareClass[] = [
  {
    id: 'class_a',
    name: 'Class A',
    tier: 'ultra',
    unitPrice: 25000000,
    displayPrice: '$25M',
    description: 'Maximum allocation priority with exclusive institutional benefits.',
    tierLabel: 'Ultra',
    tierBg: 'bg-indigo-100 dark:bg-indigo-900',
    tierText: 'text-indigo-600 dark:text-indigo-300',
  },
  {
    id: 'class_b',
    name: 'Class B',
    tier: 'premium',
    unitPrice: 5000000,
    displayPrice: '$5M',
    description: 'Enhanced portfolio access and relationship management.',
    tierLabel: 'Premium',
    tierBg: 'bg-yellow-100 dark:bg-yellow-900/40',
    tierText: 'text-yellow-700 dark:text-yellow-400',
  },
  {
    id: 'class_c',
    name: 'Class C',
    tier: 'standard',
    unitPrice: 1000000,
    displayPrice: '$1M',
    description: 'Standard tier with full access to AI-powered multi-strategy alpha.',
  },
];

const TOTAL_STEPS = 12;

const formatCurrency = (amount: number): string => {
  if (amount === 0) return '$0';
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
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

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

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
  const [investmentDay, setInvestmentDay] = useState('1st of the month');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  const totalInvestment = SHARE_CLASSES.reduce((total, sc) => total + units[sc.id] * sc.unitPrice, 0);
  const hasSelection = Object.values(units).some((c) => c > 0);

  /* ─── Scroll & body class ─── */
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.classList.add('onboarding-step1-scroll');
    document.body.classList.add('onboarding-step1-scroll');
    return () => {
      document.documentElement.classList.remove('onboarding-step1-scroll');
      document.body.classList.remove('onboarding-step1-scroll');
    };
  }, []);

  /* ─── Load user + existing data ─── */
  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);

      const hasSkipped = sessionStorage.getItem('financial_link_skipped') === 'true';
      const hasCompleted = sessionStorage.getItem('financial_verification_complete') === 'true';

      if (hasSkipped || hasCompleted) {
        console.log('[Step1] Financial verification bypassed via sessionStorage flag');
      } else {
        const { data: financialData, error: finError } = await config.supabaseClient
          .from('user_financial_data')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (finError) console.warn('[Step1] Financial data query error:', finError.message);

        if (!financialData || (financialData.status !== 'complete' && financialData.status !== 'partial')) {
          navigate('/onboarding/financial-link', { replace: true });
          return;
        }
      }

      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('class_a_units, class_b_units, class_c_units, recurring_frequency, recurring_day_of_month, recurring_amount')
        .eq('user_id', user.id)
        .maybeSingle();

      if (onboardingData) {
        setUnits({
          class_a: onboardingData.class_a_units || 0,
          class_b: onboardingData.class_b_units || 0,
          class_c: onboardingData.class_c_units || 0,
        });

        if (onboardingData.recurring_frequency) {
          const freqMap: Record<string, RecurringFrequency> = {
            once_a_month: 'once_a_month', twice_a_month: 'twice_a_month',
            weekly: 'weekly', every_other_week: 'every_other_week',
            monthly: 'once_a_month', bimonthly: 'twice_a_month', biweekly: 'every_other_week',
          };
          setFrequency(freqMap[String(onboardingData.recurring_frequency)] || 'once_a_month');
        }

        if (onboardingData.recurring_day_of_month) {
          const d = onboardingData.recurring_day_of_month;
          setInvestmentDay(d === 31 ? 'Last day of the month' : d === 15 ? '15th of the month' : '1st of the month');
        }

        if (onboardingData.recurring_amount) {
          const amt = onboardingData.recurring_amount;
          if ([500000, 750000, 1000000, 1500000].includes(amt)) {
            setSelectedAmount(amt); setCustomAmount('');
          } else {
            setSelectedAmount(null); setCustomAmount(amt.toLocaleString());
          }
        }
      }
    };
    getCurrentUser();
  }, [navigate]);

  /* ─── Handlers ─── */
  const handleUnitChange = (classId: string, delta: number) => {
    setUnits((prev) => ({ ...prev, [classId]: Math.max(0, prev[classId] + delta) }));
  };

  const handleAmountClick = (amount: number) => {
    setSelectedAmount(amount); setCustomAmount(''); setCustomAmountError(null); setError(null);
  };

  const validateRecurringAmount = (v: number): string | null => {
    if (v === 0) return null;
    if (v < MIN_RECURRING_AMOUNT) return `Minimum is $${MIN_RECURRING_AMOUNT.toLocaleString()}`;
    if (v > MAX_RECURRING_AMOUNT) return `Maximum is $${(MAX_RECURRING_AMOUNT / 1000000).toFixed(0)}M`;
    return null;
  };

  const handleCustomAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedAmount(null); setError(null);
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw.length > 12) return;
    const formatted = formatNumberWithCommas(raw);
    setCustomAmount(formatted);
    setCustomAmountError(validateRecurringAmount(parseFormattedNumber(formatted)));
  };

  const getFinalRecurringAmount = () => selectedAmount || parseFormattedNumber(customAmount);

  const handleNext = async () => {
    if (!userId || !config.supabaseClient || !hasSelection) return;
    if (customAmountError) { setError(customAmountError); return; }

    setIsLoading(true); setError(null);
    try {
      const recurringAmount = getFinalRecurringAmount();
      let dayInt = 1;
      if (investmentDay.includes('15th')) dayInt = 15;
      else if (investmentDay.includes('Last')) dayInt = 31;

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
        updateData.recurring_frequency = frequency;
        updateData.recurring_day_of_month = dayInt;
        updateData.recurring_amount = recurringAmount;
      } else {
        updateData.recurring_frequency = null;
        updateData.recurring_day_of_month = null;
        updateData.recurring_amount = null;
      }

      const { error: saveError } = await upsertOnboardingData(userId, updateData);
      if (saveError) { setError(saveError.message || 'Failed to save'); return; }

      sessionStorage.removeItem('financial_link_skipped');
      sessionStorage.removeItem('financial_verification_complete');
      navigate('/onboarding/step-2');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => navigate('/onboarding/financial-link');

  /* ─── Frequency buttons config ─── */
  const freqOptions: { value: RecurringFrequency; label: string }[] = [
    { value: 'once_a_month', label: 'Once a month' },
    { value: 'twice_a_month', label: 'Twice a month' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'every_other_week', label: 'Bi-weekly' },
  ];

  const amountPresets = [500000, 750000, 1000000, 1500000];

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div
      className="bg-white min-h-[100dvh] pb-52"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", WebkitFontSmoothing: 'antialiased' }}
    >
      {/* ═══ iOS Navigation Bar ═══ */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#C6C6C8]/30 flex items-end justify-between px-4 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 12px) + 4px)', minHeight: '48px' }}>
        <button onClick={handleBack} className="text-[#007AFF] flex items-center -ml-2 active:opacity-50 transition-opacity" aria-label="Go back">
          <span className="material-symbols-outlined text-3xl -mr-1" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_left</span>
          <span className="text-[17px] leading-none pb-[2px]">Back</span>
        </button>
        <span className="font-semibold text-[17px] text-black">Setup</span>
        <button onClick={() => navigate('/dashboard')} className="text-[#007AFF] text-[17px] font-normal active:opacity-50 transition-opacity">
          Skip
        </button>
      </nav>

      <main className="px-4 pt-4 max-w-md mx-auto">
        {/* ═══ Progress Bar ═══ */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide">Onboarding Progress</span>
            <span className="text-[13px] text-[#8E8E93]">Step 1/{TOTAL_STEPS}</span>
          </div>
          <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#007AFF] rounded-full transition-all duration-500" style={{ width: `${Math.round((1 / TOTAL_STEPS) * 100)}%` }} />
          </div>
          <p className="mt-2 text-[13px] font-medium text-[#007AFF]">{Math.round((1 / TOTAL_STEPS) * 100)}% complete</p>
        </div>

        {/* ═══ Title Block ═══ */}
        <div className="mb-6">
          <h2 className="text-[13px] font-semibold text-[#3C3C4399] uppercase tracking-wider mb-1">
            Institutional Series
          </h2>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight text-black">
            Hushh Fund A<br />
            <span className="text-[#007AFF]">Multi-Strategy Alpha</span>
          </h1>
          <p className="mt-2 text-[17px] leading-snug text-[#3C3C4399]">
            Select unit allocation for each share class. Our inaugural fund leverages AI-driven value investing.
          </p>
        </div>

        {/* ═══ Error ═══ */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ═══ Share Class Cards ═══ */}
        <div className="space-y-4 mb-8">
          {SHARE_CLASSES.map((sc) => {
            const count = units[sc.id];
            const isSelected = count > 0;

            return (
              <div
                key={sc.id}
                className={`bg-white rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${
                  isSelected ? 'ring-2 ring-[#007AFF]/40' : ''
                }`}
              >
                {/* Top section */}
                <div className="p-4 border-b border-[#C6C6C8]/20">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-black">{sc.name}</h3>
                      {sc.tierLabel && (
                        <span className={`${sc.tierBg} ${sc.tierText} text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide`}>
                          {sc.tierLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[17px] font-semibold text-black">{sc.displayPrice}</div>
                      <div className="text-[11px] text-[#3C3C4399] uppercase">Per Unit</div>
                    </div>
                  </div>
                  <p className="text-[15px] text-[#3C3C4399] leading-snug pr-8">
                    {sc.description}
                  </p>
                </div>

                {/* Units stepper */}
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-[15px] font-medium text-[#3C3C4399] uppercase tracking-wide">
                    Units
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleUnitChange(sc.id, -1)}
                      disabled={count === 0}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 disabled:opacity-50 transition active:bg-gray-100"
                      aria-label={`Decrease ${sc.name} units`}
                    >
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                        remove
                      </span>
                    </button>
                    <span className="text-[20px] font-medium w-4 text-center text-black">
                      {count}
                    </span>
                    <button
                      onClick={() => handleUnitChange(sc.id, 1)}
                      className="w-8 h-8 rounded-full border border-[#007AFF] text-[#007AFF] flex items-center justify-center transition active:bg-blue-50"
                      aria-label={`Increase ${sc.name} units`}
                    >
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                        add
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ Recurring Investment ═══ */}
        <div className="mb-4">
          <div className="text-center mb-4 px-4">
            <h3 className="text-[20px] font-semibold text-black">Recurring Investment</h3>
            <p className="text-[15px] text-[#3C3C4399] mt-1">
              Configure automated contributions to streamline future capital calls.
            </p>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {/* Frequency header */}
            <div className="px-4 py-3 border-b border-[#C6C6C8]/20 flex justify-between items-center">
              <span className="text-[13px] font-medium text-[#3C3C4399] uppercase tracking-wide">
                Frequency
              </span>
              <span className="bg-gray-100 text-[#3C3C4399] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                Optional
              </span>
            </div>

            {/* Frequency buttons */}
            <div className="p-4 border-b border-[#C6C6C8]/20">
              <div className="grid grid-cols-2 gap-3">
                {freqOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`py-2.5 px-2 text-[15px] font-medium rounded-lg border text-center transition ${
                      frequency === opt.value
                        ? 'bg-blue-50 text-[#007AFF] border-[#007AFF]/20'
                        : 'bg-white text-black border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Investment Day */}
            <div className="px-4 py-4 border-b border-[#C6C6C8]/20">
              <label className="text-[13px] font-medium text-[#3C3C4399] uppercase tracking-wide mb-2 block">
                Investment Day
              </label>
              <div className="relative">
                <select
                  value={investmentDay}
                  onChange={(e) => setInvestmentDay(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-200 rounded-lg py-2.5 px-3 pr-8 text-[17px] text-black focus:outline-none focus:ring-1 focus:ring-[#007AFF] focus:border-[#007AFF]"
                >
                  <option>1st of the month</option>
                  <option>15th of the month</option>
                  <option>Last day of the month</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#3C3C4399]">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Recurring Amount */}
            <div className="p-4">
              <label className="text-[13px] font-medium text-[#3C3C4399] uppercase tracking-wide mb-3 block">
                Recurring Amount
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {amountPresets.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleAmountClick(amt)}
                    className={`py-2.5 px-2 text-[15px] font-medium rounded-lg border text-center transition ${
                      selectedAmount === amt
                        ? 'bg-blue-50 text-[#007AFF] border-[#007AFF]/20'
                        : 'bg-white text-black border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    ${(amt / 1000).toLocaleString()}k
                  </button>
                ))}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-[#3C3C4399] text-[17px]">$</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                  placeholder="Enter custom amount"
                  className={`block w-full pl-7 pr-3 py-2.5 border rounded-lg bg-white text-black placeholder-gray-400 focus:outline-none focus:ring-1 text-[17px] ${
                    customAmountError
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-[#007AFF] focus:border-[#007AFF]'
                  }`}
                />
              </div>
              {customAmountError && (
                <p className="text-red-500 text-[12px] mt-1.5 px-1">{customAmountError}</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ═══ Fixed Footer ═══ */}
      {!isFooterVisible && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#C6C6C8]/30 z-40 pt-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[13px] font-bold text-[#3C3C4399] uppercase tracking-wide">
                Total Investment
              </span>
              <span className="text-[22px] font-bold text-black">
                {formatCurrency(totalInvestment)}
              </span>
            </div>
            <button
              onClick={handleNext}
              disabled={!hasSelection || isLoading || !!customAmountError}
              data-onboarding-cta
              className={`w-full font-semibold text-[17px] py-3.5 rounded-xl transition duration-200 shadow-md ${
                !hasSelection || isLoading || !!customAmountError
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#007AFF] hover:bg-blue-600 text-white active:scale-[0.98]'
              }`}
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
            <p className="text-[11px] text-center text-[#3C3C4399] mt-3">
              Minimum investment per unit • Units can be adjusted later
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
