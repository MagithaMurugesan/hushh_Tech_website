/**
 * Step 3 — Informational Interstitial (Auto-skip after 10s)
 *
 * All state, effects, handlers, and constants.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../../resources/config/config";
import { TOTAL_VISIBLE_ONBOARDING_STEPS } from "../../../services/onboarding/flow";
import { upsertOnboardingData } from "../../../services/onboarding/upsertOnboardingData";

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

export const CURRENT_STEP = 3;
export const TOTAL_STEPS = TOTAL_VISIBLE_ONBOARDING_STEPS;
export const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

/** Auto-skip delay in seconds */
export const AUTO_SKIP_SECONDS = 10;

/* ═══════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════ */

export function useStep3Logic() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_SKIP_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  /* ─── Get current user ─── */
  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;
      const {
        data: { user },
      } = await config.supabaseClient.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);
    };
    getCurrentUser();
  }, [navigate]);

  /* ─── Auto-skip countdown timer ─── */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ─── Navigate when countdown reaches 0 ─── */
  useEffect(() => {
    if (countdown === 0 && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      handleContinue();
    }
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Handlers ─── */
  const handleContinue = async () => {
    if (hasNavigatedRef.current && countdown !== 0) return;
    hasNavigatedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    setIsLoading(true);
    try {
      if (userId && config.supabaseClient) {
        await upsertOnboardingData(userId, { current_step: 3 });
      }
      navigate("/onboarding/step-4");
    } catch {
      navigate("/onboarding/step-4");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigate("/onboarding/step-2");
  };

  return {
    isLoading,
    countdown,
    handleContinue,
    handleBack,
  };
}
