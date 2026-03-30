import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import services from "../services/services";
import HushhLogo from "../components/images/Hushhogo.png";
import config from "../resources/config/config";
import { DEFAULT_AUTH_REDIRECT, sanitizeInternalRedirect } from "../utils/security";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
};

export default function Signup() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Stable redirect path — computed once from URL params
  const redirectPath = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return sanitizeInternalRedirect(params.get("redirect"), DEFAULT_AUTH_REDIRECT);
  }, []);

  useEffect(() => {
    if (!config.supabaseClient) {
      setIsLoading(false);
      return;
    }

    // Single listener handles both initial session check and future auth changes.
    // This avoids the race condition of calling getSession() + onAuthStateChange() separately.
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

  // Prevent double-clicks on OAuth buttons
  const handleAppleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await services.authentication.appleSignIn();
    } catch {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  const handleGoogleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await services.authentication.googleSignIn();
    } catch {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  // Don't flash Signup UI while checking auth
  if (isLoading) return null;

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-between px-6 py-6 sm:py-8"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif' }}
    >
      <motion.div
        className="w-full max-w-[448px] flex-1 flex flex-col"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="w-full max-w-[384px] mx-auto pt-3 sm:pt-5">
          {/* Logo */}
          <div className="w-full flex justify-center mb-10">
            <Link to="/">
              <div className="w-[84px] h-[84px] rounded-[22px] bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center overflow-hidden border border-black/5">
                <img src={HushhLogo} alt="Hushh Logo" className="w-[60px] h-[60px] object-contain" />
              </div>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-12 space-y-3">
            <h1 className="text-[34px] font-bold leading-[41px] tracking-tight text-black">
              Create your account.
            </h1>
            <p className="text-[17px] leading-[22px] font-normal text-[#8e8e93]">
              AI-powered investment insights and long-term wealth.
            </p>
          </div>

          {/* Sign-up Buttons */}
          <div className="flex flex-col gap-4">
            <button
              type="button"
              disabled={isSigningIn}
              className="bg-black text-white rounded-[14px] h-[52px] w-full flex items-center justify-center relative active:scale-[0.98] transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAppleSignIn}
              aria-label="Continue with Apple"
              tabIndex={0}
            >
              <span className="absolute left-6 flex items-center justify-center">
                <svg className="h-[18px] w-auto" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z" />
                </svg>
              </span>
              <span className="text-[19px] font-medium ml-2">Continue with Apple</span>
            </button>

            <button
              type="button"
              disabled={isSigningIn}
              className="bg-white border border-[#e5e5ea] text-black rounded-[14px] h-[52px] w-full flex items-center justify-center relative active:scale-[0.98] transition-transform duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGoogleSignIn}
              aria-label="Continue with Google"
              tabIndex={0}
            >
              <span className="absolute left-6 flex items-center justify-center w-[18px]">
                <svg className="h-[18px] w-auto" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </span>
              <span className="text-[19px] font-medium ml-2">Continue with Google</span>
            </button>
          </div>

          {/* Log in link */}
          <div className="mt-8 text-center">
            <p className="text-[15px] font-normal text-[#8e8e93]">
              Already have an account?{" "}
              <Link to="/login" className="text-[#007aff] font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Footer — Terms & Privacy */}
      <motion.div
        className="w-full max-w-[320px] pb-1 sm:pb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12, duration: 0.3 }}
      >
        <p className="text-[12px] leading-[18px] font-normal text-[#aeaeb2] text-center">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="text-[#007aff] underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-[#007aff] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}
