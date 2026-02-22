import React, { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../utils/useFooterVisibility';

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const MinusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12H19" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5V19M5 12H19" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

type RecurringFrequency = 'once_a_month' | 'twice_a_month' | 'weekly' | 'every_other_week';

interface ShareClass {
  id: string;
  name: string;
  tier: 'ultra' | 'premium' | 'standard';
  unitPrice: number;
  displayPrice: string;
  description: string;
  borderColor: string;
}

const SHARE_CLASSES: ShareClass[] = [
  {
    id: 'class_a',
    name: 'Class A',
    tier: 'ultra',
    unitPrice: 25000000,
    displayPrice: '$25M',
    description: 'Maximum allocation priority with exclusive institutional benefits.',
    borderColor: 'border-l-[#4F46E5]',
  },
  {
    id: 'class_b',
    name: 'Class B',
    tier: 'premium',
    unitPrice: 5000000,
    displayPrice: '$5M',
    description: 'Enhanced portfolio access and relationship management.',
    borderColor: 'border-l-[#D97706]',
  },
  {
    id: 'class_c',
    name: 'Class C',
    tier: 'standard',
    unitPrice: 1000000,
    displayPrice: '$1M',
    description: 'Standard tier with full access to AI-powered multi-strategy alpha.',
    borderColor: 'border-l-slate-400',
  },
];

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
  const [investmentDay, setInvestmentDay] = useState('1st of the month');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  const totalInvestment = SHARE_CLASSES.reduce((total, shareClass) => {
    return total + (units[shareClass.id] * shareClass.unitPrice);
  }, 0);

  const hasSelection = Object.values(units).some(count => count > 0);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.classList.add('onboarding-step1-scroll');
    document.body.classList.add('onboarding-step1-scroll');

    return () => {
      document.documentElement.classList.remove('onboarding-step1-scroll');
      document.body.classList.remove('onboarding-step1-scroll');
    };
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

        // If query errored or no row found, redirect to financial link
        if (finError) {
          console.warn('[Step1] Financial data query error:', finError.message);
        }

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
            once_a_month: 'once_a_month',
            twice_a_month: 'twice_a_month',
            weekly: 'weekly',
            every_other_week: 'every_other_week',
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
            setInvestmentDay('Last day of the month');
          } else if (dayNum === 15) {
            setInvestmentDay('15th of the month');
          } else {
            setInvestmentDay('1st of the month');
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
      return `Minimum is $${MIN_RECURRING_AMOUNT.toLocaleString()}`;
    }
    if (rawValue > MAX_RECURRING_AMOUNT) {
      return `Maximum is $${(MAX_RECURRING_AMOUNT / 1000000).toFixed(0)}M`;
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

      if (saveError) {
        setError(saveError.message || 'Failed to save investment details');
        return;
      }

      sessionStorage.removeItem('financial_link_skipped');
      sessionStorage.removeItem('financial_verification_complete');
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

  const renderShareClassCard = (shareClass: ShareClass) => {
    const unitCount = units[shareClass.id];
    const isUltra = shareClass.tier === 'ultra';
    const isPremium = shareClass.tier === 'premium';

    return (
      <div key={shareClass.id} className={`bg-white rounded-xl p-6 border border-slate-200 overflow-hidden transition-colors duration-300 relative border-l-4 ${shareClass.borderColor} ${unitCount > 0 ? 'ring-1 ring-[#3A63B8]/10' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-slate-900">{shareClass.name}</h3>
              {isUltra && (
                <span className="inline-block bg-slate-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-100 tracking-wider uppercase">
                  Ultra
                </span>
              )}
              {isPremium && (
                <span className="inline-block bg-slate-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-100 tracking-wider uppercase">
                  Premium
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pr-4">
              {shareClass.description}
            </p>
          </div>
          <div className="text-right whitespace-nowrap">
            <span className="block text-base font-bold text-slate-900">{shareClass.displayPrice}</span>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Per Unit</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-4">
          <span className="text-[10px] font-bold text-slate-400 tracking-[0.15em] uppercase">Units</span>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleUnitChange(shareClass.id, -1)}
              disabled={unitCount === 0}
              className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all ${unitCount === 0 ? 'border-slate-100 text-slate-300' : 'border-slate-200 text-slate-400 hover:text-[#3A63B8] hover:border-[#3A63B8] active:scale-95'}`}
            >
              <MinusIcon />
            </button>
            <span className="w-6 text-center font-medium text-base text-slate-900">
              {unitCount}
            </span>
            <button
              onClick={() => handleUnitChange(shareClass.id, 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:text-[#3A63B8] hover:border-[#3A63B8] transition-all active:scale-95"
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#F9F9F8] min-h-screen flex justify-center selection:bg-[#3A63B8] selection:text-white relative font-sans text-slate-600">
      <div className="w-full max-w-md px-6 pb-48 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={handleBack}
            className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-slate-900"
          >
            <BackIcon />
          </button>
          <div className="flex-1"></div>
          <button onClick={() => navigate('/dashboard')} className="text-xs font-semibold text-[#3A63B8] tracking-wide">
            SAVE &amp; EXIT
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase">Onboarding</span>
            <span className="text-[10px] font-semibold text-slate-400">Step 1 of 12</span>
          </div>
          <div className="flex gap-1.5 pt-0.5">
            <div className="h-1 flex-1 bg-[#3A63B8] rounded-full"></div>
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-slate-200 rounded-full"></div>
            ))}
          </div>
        </div>

        {/* Title block */}
        <div className="text-center mb-10 px-2">
          <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3">
            Institutional Series
          </p>
          <div className="mb-3">
            <h1 className="text-2xl font-bold leading-tight text-slate-900 tracking-tight block">
              Hushh Fund A
            </h1>
            <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight block whitespace-nowrap">
              Multi-Strategy <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#3A63B8] to-[#0891B2] opacity-95">Alpha</span>
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto text-center font-normal">
            Select unit allocation for each share class. Our inaugural fund leverages AI-driven value investing.
          </p>
        </div>

        {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
        )}

        {/* Share Classes */}
        <div className="space-y-6 mb-12">
          {SHARE_CLASSES.map(renderShareClassCard)}
        </div>

        {/* Recurring Investment */}
        <div className="mb-12 pt-8 border-t border-slate-200/60">
          <div className="text-center mb-8">
            <h2 className="text-base font-bold text-slate-900 mb-2">Recurring Investment</h2>
            <p className="text-xs text-slate-600 mx-auto max-w-xs">Configure automated contributions to streamline future capital calls.</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Frequency</h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Optional</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { value: 'once_a_month', label: 'Once a month' },
                { value: 'twice_a_month', label: 'Twice a month' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'every_other_week', label: 'Bi-weekly' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value as RecurringFrequency)}
                  className={`py-3 px-3 rounded-lg border transition-all text-xs flex items-center justify-center ${
                    frequency === opt.value
                      ? 'bg-[#F0F4FF] text-[#3A63B8] font-semibold border-transparent hover:bg-blue-50'
                      : 'bg-white text-slate-600 font-medium border-slate-200 hover:border-[#3A63B8] hover:text-[#3A63B8]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mb-8">
              <div className="relative group">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-semibold text-slate-500 z-10 uppercase tracking-wide">
                  Investment day
                </label>
                <select 
                  value={investmentDay}
                  onChange={(e) => setInvestmentDay(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-3.5 px-3 text-slate-900 focus:ring-1 focus:ring-[#3A63B8] focus:border-[#3A63B8] appearance-none font-medium text-xs transition-shadow outline-none"
                >
                  <option>1st of the month</option>
                  <option>15th of the month</option>
                  <option>Last day of the month</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <ChevronDownIcon />
                </div>
              </div>
            </div>

            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4">Recurring Amount</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[500000, 750000, 1000000, 1500000].map(amount => (
                <button
                  key={amount}
                  onClick={() => handleAmountClick(amount)}
                  className={`py-3 px-3 rounded-lg border transition-colors text-xs flex items-center justify-center ${
                    selectedAmount === amount
                      ? 'bg-[#F0F4FF] text-[#3A63B8] font-semibold border-transparent'
                      : 'bg-white text-slate-900 font-medium border-slate-200 hover:border-[#3A63B8] hover:text-[#3A63B8]'
                  }`}
                >
                  ${(amount / 1000).toLocaleString()}k
                </button>
              ))}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-slate-400 font-medium text-xs">$</span>
              </div>
              <input 
                className={`w-full bg-white border rounded-lg py-3.5 pl-8 pr-3 text-slate-900 outline-none font-medium text-xs placeholder-slate-400 ${
                  customAmountError 
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                    : 'border-slate-200 focus:ring-1 focus:ring-[#3A63B8] focus:border-[#3A63B8]'
                }`}
                placeholder="Enter custom amount" 
                type="text"
                inputMode="numeric"
                value={customAmount}
                onChange={handleCustomAmountChange}
              />
            </div>
            {customAmountError && (
              <p className="text-red-500 text-[10px] mt-1.5 px-1">{customAmountError}</p>
            )}
          </div>
        </div>

      </div>

      {/* Footer */}
      {!isFooterVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/50 bg-white/95 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:px-5 sm:pt-3 sm:pb-4">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Total Investment</span>
              <span className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{formatCurrency(totalInvestment)}</span>
            </div>
            
            <button 
              onClick={handleNext}
              disabled={!hasSelection || isLoading || !!customAmountError}
              className={`mb-2.5 h-[46px] w-full rounded-full text-[13px] font-bold tracking-wide shadow-none transition-all sm:h-[48px] sm:text-sm ${
                !hasSelection || isLoading || !!customAmountError
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#3A63B8] hover:bg-[#2C4A8A] text-white active:scale-[0.99]'
              }`}
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
            
            <div className="text-center">
              <p className="mx-auto max-w-[240px] text-[8px] font-medium leading-tight tracking-wide text-slate-400 sm:max-w-xs sm:text-[9px]">
                Minimum investment per unit &bull; Units can be adjusted later
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


