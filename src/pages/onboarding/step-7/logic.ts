import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

export const DISPLAY_STEP = 6;
export const TOTAL_STEPS = 12;
export const PROGRESS_PCT = Math.round((DISPLAY_STEP / TOTAL_STEPS) * 100);

/* ═══════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════ */

export function useStep7Logic() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreFilledFromBank, setIsPreFilledFromBank] = useState(false);
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

      // Check saved data — priority: DB > Plaid > OAuth
      const { data } = await config.supabaseClient
        .from('onboarding_data')
        .select('legal_first_name, legal_last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      // If DB has names, use them directly
      if (data?.legal_first_name && data?.legal_last_name) {
        setFirstName(data.legal_first_name);
        setLastName(data.legal_last_name);
        return;
      }

      // Try Plaid identity data for name pre-fill
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

          if (owner?.names?.length) {
            // Plaid returns full name string like "John Michael Doe"
            const fullName = String(owner.names[0]).trim();
            if (fullName) {
              const parts = fullName.split(/\s+/);
              const plaidFirst = parts[0] || '';
              const plaidLast = parts.slice(1).join(' ') || '';

              if (plaidFirst && plaidLast) {
                setFirstName(plaidFirst);
                setLastName(plaidLast);
                setIsPreFilledFromBank(true);
                console.log('[Step7] Name pre-filled from Plaid identity:', plaidFirst, plaidLast.charAt(0) + '***');
                return;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Step7] Plaid identity fetch failed (ignoring):', err);
      }

      // Fallback to OAuth metadata
      setFirstName(oauthFirst);
      setLastName(oauthLast);
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

  const isValid = Boolean(firstName.trim() && lastName.trim());

  const handleFirstNameChange = (value: string) => {
    setFirstName(value);
    if (error) setError(null);
    if (isPreFilledFromBank) setIsPreFilledFromBank(false);
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);
    if (error) setError(null);
    if (isPreFilledFromBank) setIsPreFilledFromBank(false);
  };

  return {
    // State
    firstName,
    lastName,
    isLoading,
    error,
    isFooterVisible,

    // Derived
    isValid,
    isPreFilledFromBank,

    // Handlers
    handleFirstNameChange,
    handleLastNameChange,
    handleContinue,
    handleBack,
    handleSkip,
  };
}
