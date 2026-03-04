/**
 * Step 9 - SSN + Date of Birth — Logic Hook
 *
 * All state, effects, handlers, and constants for the SSN & DOB step.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

export const DISPLAY_STEP = 8;
export const TOTAL_STEPS = 12;
export const PROGRESS_PCT = Math.round((DISPLAY_STEP / TOTAL_STEPS) * 100);

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* ═══════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════ */

export function useStep9Logic() {
  const navigate = useNavigate();
  const isFooterVisible = useFooterVisibility();
  const [ssn, setSsn] = useState('');
  const [dob, setDob] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  /* ─── Helpers ─── */
  const formatIsoToDisplay = (iso?: string | null) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return iso;
  };

  const parseDobToIso = (value: string) => {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length === 3) {
      let [p1, p2, year] = parts.map((p) => p.trim());
      let month = p1, day = p2;
      if (parseInt(p1, 10) > 12) { day = p1; month = p2; }
      const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (!Number.isNaN(Date.parse(iso))) return iso;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return value;
    return null;
  };

  /* ─── Load saved data ─── */
  useEffect(() => {
    const loadData = async () => {
      if (!config.supabaseClient) return;
      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) return;

      const { data } = await config.supabaseClient
        .from('onboarding_data')
        .select('ssn_encrypted, date_of_birth')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.date_of_birth) {
        const saved = formatIsoToDisplay(data.date_of_birth);
        if (saved) setDob(saved);
        // Also populate dropdowns from ISO date
        const parts = data.date_of_birth.split('-');
        if (parts.length === 3) {
          setDobYear(parts[0]);
          setDobMonth(parts[1]);
          setDobDay(parts[2]);
        }
      }
      if (data?.ssn_encrypted && data.ssn_encrypted !== '999-99-9999') {
        setSsn(data.ssn_encrypted);
      }
    };
    loadData();
  }, []);

  /* ─── Formatters ─── */
  const formatSSN = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 9)}`;
  };

  const formatDate = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`;
  };

  const handleSSNChange = (e: React.ChangeEvent<HTMLInputElement>) => setSsn(formatSSN(e.target.value));
  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => setDob(formatDate(e.target.value));

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setDob(formatIsoToDisplay(e.target.value));
  };

  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker?.();
      dateInputRef.current.click();
    }
  };

  // Sync dob string from dropdown selections
  useEffect(() => {
    if (dobMonth && dobDay && dobYear) {
      setDob(`${dobMonth}/${dobDay}/${dobYear}`);
    }
  }, [dobMonth, dobDay, dobYear]);

  // Generate year options (current year down to 1930)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1929 }, (_, i) => String(currentYear - i));

  // Days in selected month/year
  const daysInMonth = dobMonth && dobYear
    ? new Date(parseInt(dobYear), parseInt(dobMonth), 0).getDate()
    : 31;
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));

  // Correct day if month changed and day is now out of range
  useEffect(() => {
    if (dobDay && parseInt(dobDay) > daysInMonth) {
      setDobDay(String(daysInMonth).padStart(2, '0'));
    }
  }, [dobMonth, dobYear, daysInMonth, dobDay]);

  /* ─── 18+ age check ─── */
  const isUnder18 = (() => {
    if (!dobMonth || !dobDay || !dobYear || dobYear.length !== 4) return false;
    const birthDate = new Date(parseInt(dobYear), parseInt(dobMonth) - 1, parseInt(dobDay));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  })();

  const ageError = isUnder18 ? 'you must be at least 18 years old to continue' : null;

  const isFormValid = !!(dobMonth && dobDay && dobYear && dobYear.length === 4 && !isUnder18);

  /* ─── Handlers ─── */
  const handleContinue = async () => {
    if (isUnder18) { setError('you must be at least 18 years old to continue'); return; }
    if (!isFormValid) { setError('Please enter your date of birth'); return; }
    setLoading(true); setError(null);

    if (!config.supabaseClient) { setError('Configuration error'); setLoading(false); return; }
    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }

    const isoDob = parseDobToIso(dob);
    if (!isoDob) { setError('Please enter a valid date (MM/DD/YYYY)'); setLoading(false); return; }

    const { error: e } = await upsertOnboardingData(user.id, {
      ssn_encrypted: ssn, date_of_birth: isoDob, current_step: 9,
    });
    if (e) { setError('Failed to save data'); setLoading(false); return; }
    navigate('/onboarding/step-11');
  };

  const handleSkip = async () => {
    if (!isFormValid) { setError('Please enter your date of birth before skipping'); return; }
    setLoading(true); setError(null);

    if (!config.supabaseClient) { setError('Configuration error'); setLoading(false); return; }
    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }

    const isoDob = parseDobToIso(dob);
    if (!isoDob) { setError('Please enter a valid date (MM/DD/YYYY)'); setLoading(false); return; }

    const { error: e } = await upsertOnboardingData(user.id, {
      ssn_encrypted: '999-99-9999', date_of_birth: isoDob, current_step: 9,
    });
    if (e) { setError('Failed to save data'); setLoading(false); return; }
    navigate('/onboarding/step-11');
  };

  const handleBack = () => navigate('/onboarding/step-7');

  const handleShowInfoToggle = (open: boolean) => setShowInfo(open);

  return {
    // State
    ssn,
    dob,
    dobMonth,
    setDobMonth,
    dobDay,
    setDobDay,
    dobYear,
    setDobYear,
    loading,
    error,
    showInfo,
    isFormValid,
    isFooterVisible,
    dateInputRef,

    // Derived
    yearOptions,
    dayOptions,
    daysInMonth,
    isUnder18,
    ageError,

    // Handlers
    handleSSNChange,
    handleDobChange,
    handleNativeDateChange,
    openDatePicker,
    handleContinue,
    handleSkip,
    handleBack,
    handleShowInfoToggle,
  };
}
