/**
 * Login Page — All Business Logic
 *
 * Contains:
 * - Auth session check & redirect
 * - OAuth sign-in handlers (Apple, Google)
 * - Loading state management
 *
 * After login, redirect to "/" (home).
 * GlobalNDAGate handles NDA enforcement automatically —
 * no need to redirect to /hushh-user-profile and bounce through
 * ProtectedRoute → onboarding → NDA gate (which caused 3 redirects).
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import services from "../../services/services";
import config from "../../resources/config/config";

/* ─── Types ─── */
export interface LoginLogic {
  isLoading: boolean;
  isSigningIn: boolean;
  handleAppleSignIn: () => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
}

/* ─── Main Hook ─── */
export const useLoginLogic = (): LoginLogic => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Redirect path — defaults to "/" so GlobalNDAGate can handle NDA check
  const redirectPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect") || "/";
  }, []);

  /* Auth session listener — redirect if already logged in */
  useEffect(() => {
    if (!config.supabaseClient) {
      setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = config.supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate(redirectPath, { replace: true });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, [navigate, redirectPath]);

  /* Apple OAuth — prevent double-clicks */
  const handleAppleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await services.authentication.appleSignIn();
    } catch {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  /* Google OAuth — prevent double-clicks */
  const handleGoogleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await services.authentication.googleSignIn();
    } catch {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  return {
    isLoading,
    isSigningIn,
    handleAppleSignIn,
    handleGoogleSignIn,
  };
};
