/**
 * Step 11 — All Business Logic
 * Investment summary, share class editing modal, recurring investment config
 */
import { useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { getOnboardingDisplayMeta } from '../../../services/onboarding/flow';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';

/* ─── Types & Constants ─── */
export type RecurringFrequency = 'once_a_month' | 'twice_a_month' | 'weekly' | 'every_other_week';

export interface ShareClassInfo {
  id: string;
  name: string;
  unitPrice: number;
  tier: 'platinum' | 'gold' | 'standard';
  borderGradient: string;
  badge?: string;
}

export const SHARE_CLASSES: ShareClassInfo[] = [
  {
    id: 'class_a',
    name: 'Class A',
    unitPrice: 25000000,
    tier: 'platinum',
    borderGradient: 'bg-gradient-to-b from-gray-300 via-gray-100 to-gray-300',
    badge: 'ULTRA',
  },
  {
    id: 'class_b',
    name: 'Class B',
    unitPrice: 5000000,
    tier: 'gold',
    borderGradient: 'bg-gradient-to-b from-yellow-400 via-yellow-200 to-yellow-500',
    badge: 'PREMIUM',
  },
  {
    id: 'class_c',
    name: 'Class C',
    unitPrice: 1000000,
    tier: 'standard',
    borderGradient: 'bg-[#2b8cee]',
  },
];

export const MIN_RECURRING_AMOUNT = 100;
export const MAX_RECURRING_AMOUNT = 100000000;

const DISPLAY_META = getOnboardingDisplayMeta('/onboarding/step-10');

export const DISPLAY_STEP = DISPLAY_META.displayStep;
export const PROG_TOTAL = DISPLAY_META.totalSteps;
export const PROG_PCT = Math.round((DISPLAY_STEP / PROG_TOTAL) * 100);

export const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'once_a_month', label: 'Once a month' },
  { value: 'twice_a_month', label: 'Twice a month' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'every_other_week', label: 'Every other week' },
];

export const AMOUNT_PRESETS = [500000, 750000, 1000000, 1500000];

export const DAY_OPTIONS = [
  { value: '1st', label: '1st' },
  { value: '2nd', label: '2nd' },
  { value: '5th', label: '5th' },
  { value: '10th', label: '10th' },
  { value: '15th', label: '15th' },
  { value: '20th', label: '20th' },
  { value: '25th', label: '25th' },
  { value: 'Last', label: 'Last day of month' },
];

/* ─── Utility Functions ─── */
export const formatCurrency = (amount: number): string => {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
};

export const formatFullCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumberWithCommas = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const parseFormattedNumber = (value: string): number => {
  return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
};

export const getFrequencyLabel = (value: RecurringFrequency): string => {
  if (value === 'once_a_month') return 'Once a month';
  if (value === 'twice_a_month') return 'Twice a month';
  if (value === 'weekly') return 'Weekly';
  return 'Every other week';
};

/* ─── Hook Return Type ─── */
export interface Step11Logic {
  loading: boolean;
  error: string | null;
  isFooterVisible: boolean;
  shareUnits: { class_a_units: number; class_b_units: number; class_c_units: number };
  frequency: RecurringFrequency;
  investmentDay: string;
  selectedAmount: number | null;
  customAmount: string;
  customAmountError: string | null;
  showRecurringEditor: boolean;
  isModalOpen: boolean;
  localShareUnits: { class_a_units: number; class_b_units: number; class_c_units: number };
  savingModal: boolean;
  totalInvestment: number;
  modalTotalInvestment: number;
  hasModalChanges: boolean;
  hasAnyUnits: boolean;
  recurringAmount: number;
  isFormValid: boolean;
  recurringSummaryTitle: string;
  recurringSummarySubtitle: string;
  getUnits: (classId: string) => number;
  getModalUnits: (classId: string) => number;
  getUnitsSummary: () => string;
  handleBack: () => void;
  handleSkip: () => void;
  handleContinue: () => Promise<void>;
  handleOpenModal: () => void;
  handleCloseModal: () => void;
  handleIncrement: (classId: string) => void;
  handleDecrement: (classId: string) => void;
  handleSaveChanges: () => Promise<void>;
  handleAmountClick: (amount: number) => void;
  handleCustomAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setFrequency: (f: RecurringFrequency) => void;
  setInvestmentDay: (d: string) => void;
  setShowRecurringEditor: (v: boolean | ((prev: boolean) => boolean)) => void;
}

/* ─── Main Hook ─── */
export const useStep11Logic = (): Step11Logic => {
  const navigate = useNavigate();
  const isFooterVisible = useFooterVisibility();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUnits, setShareUnits] = useState<{
    class_a_units: number;
    class_b_units: number;
    class_c_units: number;
  }>({
    class_a_units: 0,
    class_b_units: 0,
    class_c_units: 0,
  });
  const [frequency, setFrequency] = useState<RecurringFrequency>('once_a_month');
  const [investmentDay, setInvestmentDay] = useState('1st');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);
  const [showRecurringEditor, setShowRecurringEditor] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localShareUnits, setLocalShareUnits] = useState({
    class_a_units: 0,
    class_b_units: 0,
    class_c_units: 0,
  });
  const [savingModal, setSavingModal] = useState(false);

  // Calculate total investment from share units
  const calculateTotal = (units = shareUnits) => {
    return (
      (units.class_a_units * 25000000) +
      (units.class_b_units * 5000000) +
      (units.class_c_units * 1000000)
    );
  };

  const totalInvestment = calculateTotal();
  const modalTotalInvestment = calculateTotal(localShareUnits);

  // Check if modal has changes
  const hasModalChanges =
    localShareUnits.class_a_units !== shareUnits.class_a_units ||
    localShareUnits.class_b_units !== shareUnits.class_b_units ||
    localShareUnits.class_c_units !== shareUnits.class_c_units;

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
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) return;

      const { data } = await config.supabaseClient
        .from('onboarding_data')
        .select('class_a_units, class_b_units, class_c_units, initial_investment_amount, recurring_frequency, recurring_day_of_month, recurring_amount')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setShareUnits({
          class_a_units: data.class_a_units || 0,
          class_b_units: data.class_b_units || 0,
          class_c_units: data.class_c_units || 0,
        });

        if (data.recurring_frequency) {
          const freqMap: Record<string, RecurringFrequency> = {
            once_a_month: 'once_a_month',
            twice_a_month: 'twice_a_month',
            weekly: 'weekly',
            every_other_week: 'every_other_week',
            monthly: 'once_a_month',
            bimonthly: 'twice_a_month',
            biweekly: 'every_other_week',
          };
          const raw = String(data.recurring_frequency);
          setFrequency(freqMap[raw] || 'once_a_month');
        }

        if (data.recurring_day_of_month) {
          const dayNum = data.recurring_day_of_month;
          if (dayNum === 31) {
            setInvestmentDay('Last');
          } else {
            const suffix = dayNum === 1 ? 'st' : dayNum === 2 ? 'nd' : dayNum === 3 ? 'rd' : 'th';
            setInvestmentDay(`${dayNum}${suffix}`);
          }
        }

        if (data.recurring_amount) {
          const amount = data.recurring_amount;
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

    loadData();
  }, []);

  // Open modal and initialize local state
  const handleOpenModal = () => {
    setLocalShareUnits({ ...shareUnits });
    setIsModalOpen(true);
  };

  // Close modal without saving
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Increment units in modal
  const handleIncrement = (classId: string) => {
    setLocalShareUnits(prev => ({
      ...prev,
      [`${classId}_units`]: (prev[`${classId}_units` as keyof typeof prev] || 0) + 1,
    }));
  };

  // Decrement units in modal
  const handleDecrement = (classId: string) => {
    setLocalShareUnits(prev => ({
      ...prev,
      [`${classId}_units`]: Math.max(0, (prev[`${classId}_units` as keyof typeof prev] || 0) - 1),
    }));
  };

  // Save modal changes to Supabase
  const handleSaveChanges = async () => {
    if (!hasModalChanges) return;

    setSavingModal(true);

    if (!config.supabaseClient) {
      setSavingModal(false);
      return;
    }

    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) {
      setSavingModal(false);
      return;
    }

    const { error: upsertError } = await upsertOnboardingData(user.id, {
      class_a_units: localShareUnits.class_a_units,
      class_b_units: localShareUnits.class_b_units,
      class_c_units: localShareUnits.class_c_units,
      initial_investment_amount: modalTotalInvestment,
    });

    if (!upsertError) {
      setShareUnits({ ...localShareUnits });
      setIsModalOpen(false);
    }

    setSavingModal(false);
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

  // Get units for modal display
  const getModalUnits = (classId: string): number => {
    if (classId === 'class_a') return localShareUnits.class_a_units;
    if (classId === 'class_b') return localShareUnits.class_b_units;
    if (classId === 'class_c') return localShareUnits.class_c_units;
    return 0;
  };

  const handleContinue = async () => {
    if (totalInvestment < 1000000) {
      setError('Minimum investment is $1 million');
      return;
    }

    if (customAmountError) {
      setShowRecurringEditor(true);
      setError(customAmountError);
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

    const recurringAmount = getFinalRecurringAmount();
    const convertDayToInt = (day: string | number): number => {
      if (typeof day === 'number') return day;
      if (day === 'Last') return 31;
      return parseInt(day.replace(/\D/g, ''), 10);
    };

    const convertFrequencyToDb = (freq: RecurringFrequency): string => {
      return freq;
    };

    const updateData: Record<string, unknown> = {
      user_id: user.id,
      initial_investment_amount: totalInvestment,
      current_step: 12,
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

    const { error: upsertError } = await upsertOnboardingData(user.id, updateData);

    if (upsertError) {
      setError('Failed to save data');
      setLoading(false);
      return;
    }

    navigate('/onboarding/step-11');
  };

  // Get units for a class
  const getUnits = (classId: string): number => {
    if (classId === 'class_a') return shareUnits.class_a_units;
    if (classId === 'class_b') return shareUnits.class_b_units;
    if (classId === 'class_c') return shareUnits.class_c_units;
    return 0;
  };

  const hasAnyUnits = shareUnits.class_a_units > 0 || shareUnits.class_b_units > 0 || shareUnits.class_c_units > 0;
  const recurringAmount = getFinalRecurringAmount();
  const hasValidRecurringAmount =
    !customAmountError &&
    (
      !customAmount || selectedAmount !== null ||
      (recurringAmount >= MIN_RECURRING_AMOUNT && recurringAmount <= MAX_RECURRING_AMOUNT)
    );
  const isFormValid = hasAnyUnits && totalInvestment >= 1000000 && hasValidRecurringAmount;

  const handleBack = () => {
    navigate('/onboarding/step-9');
  };

  const handleSkip = () => {
    navigate('/onboarding/step-11');
  };

  // Generate units summary text
  const getUnitsSummary = () => {
    const parts: string[] = [];
    if (shareUnits.class_a_units > 0) parts.push(`${shareUnits.class_a_units} Class A`);
    if (shareUnits.class_b_units > 0) parts.push(`${shareUnits.class_b_units} Class B`);
    if (shareUnits.class_c_units > 0) parts.push(`${shareUnits.class_c_units} Class C`);
    return parts.join(' + ') + ' units';
  };

  const recurringSummaryTitle =
    recurringAmount > 0
      ? `$${recurringAmount.toLocaleString()} recurring`
      : 'No recurring investment configured';
  const recurringSummarySubtitle =
    recurringAmount > 0
      ? `${getFrequencyLabel(frequency)} \u2022 Day ${investmentDay}`
      : 'Tap Edit to add recurring amount, frequency, and day.';

  return {
    loading,
    error,
    isFooterVisible,
    shareUnits,
    frequency,
    investmentDay,
    selectedAmount,
    customAmount,
    customAmountError,
    showRecurringEditor,
    isModalOpen,
    localShareUnits,
    savingModal,
    totalInvestment,
    modalTotalInvestment,
    hasModalChanges,
    hasAnyUnits,
    recurringAmount,
    isFormValid,
    recurringSummaryTitle,
    recurringSummarySubtitle,
    getUnits,
    getModalUnits,
    getUnitsSummary,
    handleBack,
    handleSkip,
    handleContinue,
    handleOpenModal,
    handleCloseModal,
    handleIncrement,
    handleDecrement,
    handleSaveChanges,
    handleAmountClick,
    handleCustomAmountChange,
    setFrequency,
    setInvestmentDay,
    setShowRecurringEditor,
  };
};
