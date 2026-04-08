/**
 * Login Page — All Business Logic
 *
 * Contains:
 * - Auth session check & redirect
 * - OAuth sign-in handlers (Apple, Google)
 * - Loading state management
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../resources/config/config";
import {
  redirectToUrl,
  resolveOAuthHost,
} from "../../auth/authHost";
import type { OAuthStartResult } from "../../auth/session";
import { DEFAULT_AUTH_REDIRECT, sanitizeInternalRedirect } from "../../utils/security";
import { useAuthSession } from "../../auth/AuthSessionProvider";

/* ─── Types ─── */
export interface LoginLogic {
  isLoading: boolean;
  isSigningIn: boolean;
  oauthError: string | null;
  oauthFallbackUrl: string | null;
  handleAppleSignIn: () => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
}

/* ─── Main Hook ─── */
export const useLoginLogic = (): LoginLogic => {
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);
  const [oauthFallbackUrl, setOAuthFallbackUrl] = useState<string | null>(null);
  const { status, startOAuth } = useAuthSession();

  const hostResolution = useMemo(
    () =>
      resolveOAuthHost(
        window.location.pathname,
        window.location.search,
        config.redirect_url,
        window.location.origin
      ),
    []
  );
  const shouldRedirectToSupportedHost = !hostResolution.supported;

  // Stable redirect path — computed once from URL params
  const redirectPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return sanitizeInternalRedirect(params.get("redirect"), DEFAULT_AUTH_REDIRECT);
  }, []);

  useEffect(() => {
    if (shouldRedirectToSupportedHost) {
      redirectToUrl(hostResolution.canonicalEntryUrl);
    }
  }, [hostResolution.canonicalEntryUrl, shouldRedirectToSupportedHost]);

  /* Auth session listener — redirect if already logged in */
  useEffect(() => {
    if (shouldRedirectToSupportedHost) {
      return;
    }

    if (status === "authenticated") {
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath, shouldRedirectToSupportedHost, status]);

  const handleOAuthFailure = useCallback(
    (result: Extract<OAuthStartResult, { ok: false }>) => {
      setIsSigningIn(false);
      if (result.reason === "unsupported_host" && result.redirectTo) {
        redirectToUrl(result.redirectTo);
        return;
      }

      setOAuthError(result.message);
      setOAuthFallbackUrl(result.redirectTo || null);
    },
    []
  );

  /* Apple OAuth — prevent double-clicks */
  const handleAppleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setOAuthError(null);
    setOAuthFallbackUrl(null);
    const result = await startOAuth("apple");
    if (!result.ok) {
      handleOAuthFailure(result);
    }
  }, [handleOAuthFailure, isSigningIn, startOAuth]);

  /* Google OAuth — prevent double-clicks */
  const handleGoogleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setOAuthError(null);
    setOAuthFallbackUrl(null);
    const result = await startOAuth("google");
    if (!result.ok) {
      handleOAuthFailure(result);
    }
  }, [handleOAuthFailure, isSigningIn, startOAuth]);

  return {
    isLoading: status === "booting" || shouldRedirectToSupportedHost,
    isSigningIn,
    oauthError,
    oauthFallbackUrl,
    handleAppleSignIn,
    handleGoogleSignIn,
  };
};
