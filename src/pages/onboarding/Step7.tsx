/**
 * Step 7 - Legal Name Entry (iOS-native design)
 *
 * Collects user's legal first and last name for verification.
 * Auto-fills from OAuth provider metadata (Google, Apple).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../utils/useFooterVisibility';

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

const DISPLAY_STEP = 6;
const TOTAL_STEPS = 12;
const PROGRESS_PCT = Math.round((DISPLAY_STEP / TOTAL_STEPS) * 100);

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function OnboardingStep7() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFooterVisible = useFooterVisibility();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  /* ─── Load user + existing data ─── */
  useEffect(() => {
    const loadData = async () => {
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }

      // Extract name from OAuth provider metadata
      const meta = user.user_metadata || {};
      const oauthFirst = meta.given_name || meta.first_name || (meta.full_name?.split(' ')[0]) || (meta.name?.split(' ')[0]) || '';
      const oauthLast = meta.family_name || meta.last_name || (meta.full_name?.split(' ').slice(1).join(' ')) || (meta.name?.split(' ').slice(1).join(' ')) || '';

      // Check saved data — priority: DB > OAuth
      const { data } = await config.supabaseClient
        .from('onboarding_data')
        .select('legal_first_name, legal_last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      setFirstName(data?.legal_first_name || oauthFirst);
      setLastName(data?.legal_last_name || oauthLast);
    };
    loadData();
  }, [navigate]);

  /* ─── Handlers ─── */
  const handleContinue = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter both first and last name');
      return;
    }

    setIsLoading(true);
    setError(null);

    if (!config.supabaseClient) { setError('Configuration error'); setIsLoading(false); return; }

    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) { setError('Not authenticated'); setIsLoading(false); return; }

    const { error: upsertError } = await upsertOnboardingData(user.id, {
      legal_first_name: firstName.trim(),
      legal_last_name: lastName.trim(),
      current_step: 7,
    });

    if (upsertError) { setError('Failed to save data'); setIsLoading(false); return; }
    navigate('/onboarding/step-8');
  };

  const handleBack = () => navigate('/onboarding/step-5');

  const handleSkip = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      if (config.supabaseClient) {
        const { data: { user } } = await config.supabaseClient.auth.getUser();
        if (user) await upsertOnboardingData(user.id, { current_step: 7 });
      }
      navigate('/onboarding/step-8');
    } catch { navigate('/onboarding/step-8'); }
    finally { setIsLoading(false); }
  };

  const isValid = firstName.trim() && lastName.trim();

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div
      className="bg-white min-h-[100dvh] flex flex-col"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", WebkitFontSmoothing: 'antialiased' }}
    >
      {/* ═══ iOS Navigation Bar ═══ */}
      <nav
        className="sticky top-0 z-30 bg-white/90 backdrop-blur-md flex items-end justify-between px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 12px) + 4px)', minHeight: '48px' }}
      >
        <button onClick={handleBack} className="text-[#007AFF] p-2 -ml-2 active:opacity-50 transition-opacity" aria-label="Go back">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_left</span>
        </button>
        <button onClick={handleSkip} className="text-[#007AFF] font-semibold text-[17px] active:opacity-50 transition-opacity">
          Skip
        </button>
      </nav>

      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pb-48">
        {/* ─── Progress Bar ─── */}
        <div className="mt-2 mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide">Onboarding Progress</span>
            <span className="text-[13px] text-[#8E8E93]">Step {DISPLAY_STEP}/{TOTAL_STEPS}</span>
          </div>
          <div className="h-1 w-full bg-[#F2F2F7] rounded-full overflow-hidden">
            <div className="h-full bg-[#007AFF] rounded-full transition-all duration-500" style={{ width: `${PROGRESS_PCT}%` }} />
          </div>
          <p className="mt-2 text-[13px] font-medium text-[#007AFF]">{PROGRESS_PCT}% complete</p>
        </div>

        {/* ─── Title ─── */}
        <div className="mb-8 space-y-3">
          <h1 className="text-[34px] leading-[41px] font-bold text-black tracking-tight">
            Enter your full legal name
          </h1>
          <p className="text-[17px] leading-[22px] text-[#8E8E93]">
            We are required to collect this info for verification purposes.
          </p>
        </div>

        {/* ─── Error ─── */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
        )}

        {/* ─── Name Fields — iOS Grouped Table ─── */}
        <div className="bg-[#F2F2F7]/30 rounded-xl overflow-hidden border border-[#C6C6C8]/30">
          {/* First Name */}
          <div className="flex items-center pl-4 bg-white active:bg-gray-50 transition-colors">
            <label htmlFor="firstName" className="w-[100px] py-3.5 text-[17px] text-black font-normal shrink-0">
              First Name
            </label>
            <div className="flex-1 border-b border-[#C6C6C8]/40 py-3.5 pr-4 flex items-center">
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); if (error) setError(null); }}
                placeholder="Required"
                className="w-full bg-transparent border-0 p-0 text-[17px] text-black placeholder-[#8E8E93] focus:ring-0 outline-none"
                autoComplete="given-name"
              />
            </div>
          </div>

          {/* Last Name */}
          <div className="flex items-center pl-4 bg-white active:bg-gray-50 transition-colors">
            <label htmlFor="lastName" className="w-[100px] py-3.5 text-[17px] text-black font-normal shrink-0">
              Last Name
            </label>
            <div className="flex-1 py-3.5 pr-4 flex items-center">
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); if (error) setError(null); }}
                placeholder="Required"
                className="w-full bg-transparent border-0 p-0 text-[17px] text-black placeholder-[#8E8E93] focus:ring-0 outline-none"
                autoComplete="family-name"
              />
            </div>
          </div>
        </div>

        {/* Helper text */}
        <p className="mt-4 text-[13px] text-[#8E8E93] px-4 text-center">
          Make sure this matches your government ID.
        </p>
      </main>

      {/* ═══ Fixed Footer — Skip + Continue ═══ */}
      {!isFooterVisible && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-[#C6C6C8]/30 px-4 pt-4 z-40"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          data-onboarding-footer
        >
          <div className="flex gap-3 max-w-md mx-auto">
            <button
              onClick={handleSkip}
              className="flex-1 h-[50px] rounded-xl bg-[#F2F2F7] text-[#007AFF] font-semibold text-[17px] active:scale-[0.98] transition-transform flex items-center justify-center"
            >
              Skip
            </button>
            <button
              onClick={handleContinue}
              disabled={!isValid || isLoading}
              data-onboarding-cta
              className={`flex-[2] h-[50px] rounded-xl font-semibold text-[17px] shadow-sm active:scale-[0.98] transition-all flex items-center justify-center ${
                isValid && !isLoading
                  ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
