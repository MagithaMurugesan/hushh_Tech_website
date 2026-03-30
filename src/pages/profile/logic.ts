/**
 * Profile Page — Logic / ViewModel
 * Session, onboarding status, NDA check (once, no polling).
 * UI stays in ui.tsx.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../resources/config/config';
import { getContinueOnboardingCta } from '../../services/onboarding/flow';

export function useProfileLogic() {
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [ndaApproved, setNdaApproved] = useState(false);
  const ndaCheckedRef = useRef(false);

  /* onboarding status */
  const [onboardingStatus, setOnboardingStatus] = useState<{
    hasProfile: boolean;
    isCompleted: boolean;
    currentStep: number;
    loading: boolean;
  }>({
    hasProfile: false,
    isCompleted: false,
    currentStep: 1,
    loading: true,
  });

  /* session setup */
  useEffect(() => {
    config.supabaseClient?.auth
      .getSession()
      .then(({ data: { session } }: any) => setSession(session));

    const { data: { subscription } } =
      config.supabaseClient?.auth.onAuthStateChange((_event: any, s: any) => {
        setSession(s);
      }) ?? { data: { subscription: null } };

    return () => subscription?.unsubscribe?.();
  }, []);

  /* check onboarding status (once when session loads) */
  useEffect(() => {
    if (!session?.user?.id || !config.supabaseClient) {
      setOnboardingStatus((prev) => ({ ...prev, loading: false }));
      return;
    }

    const checkUserStatus = async () => {
      try {
        const { data: profile, error: profileError } =
          await config.supabaseClient!
            .from('investor_profiles')
            .select('id, user_confirmed')
            .eq('user_id', session.user.id)
            .maybeSingle();

        const { data: onboarding } = await config.supabaseClient!
            .from('onboarding_data')
          .select('is_completed, current_step')
          .eq('user_id', session.user.id)
          .maybeSingle();

        setOnboardingStatus({
          hasProfile: !!profile && !profileError,
          isCompleted: onboarding?.is_completed || false,
          currentStep: onboarding?.current_step || 1,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking user status:', error);
        setOnboardingStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    checkUserStatus();
  }, [session?.user?.id]);

  /* check NDA status ONCE (no polling) */
  useEffect(() => {
    if (!session?.access_token || ndaCheckedRef.current) return;
    ndaCheckedRef.current = true;

    const checkNda = async () => {
      try {
        const { data } = await axios.post(
          'https://gsqmwxqgqrgzhlhmbscg.supabase.co/rest/v1/rpc/check_access_status',
          {},
          {
            headers: {
              apikey: config.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (data === 'Approved') setNdaApproved(true);
      } catch (err: any) {
        /* 401 = expired/invalid token — silently ignore, don't retry */
        if (err?.response?.status === 401) return;
        console.warn('NDA check failed:', err?.message);
      }
    };

    checkNda();
  }, [session?.access_token]);

  /* primary CTA content based on onboarding status */
  const getPrimaryCTAContent = () => {
    if (onboardingStatus.loading) {
      return { text: 'Loading...', action: () => {} };
    }
    if (onboardingStatus.hasProfile || onboardingStatus.isCompleted) {
      return {
        text: 'View Your Profile',
        action: () => navigate('/hushh-user-profile'),
      };
    }
    if (onboardingStatus.currentStep > 1) {
      const cta = getContinueOnboardingCta(onboardingStatus.currentStep);
      return {
        text: cta.text,
        action: () => navigate(cta.route),
      };
    }
    return {
      text: 'Complete Your Hushh Profile',
      action: () => navigate('/onboarding/financial-link'),
    };
  };

  const primaryCTA = getPrimaryCTAContent();
  const handleDiscoverFundA = () => navigate('/discover-fund-a');

  return {
    session,
    ndaApproved,
    onboardingStatus,
    primaryCTA,
    handleDiscoverFundA,
  };
}
