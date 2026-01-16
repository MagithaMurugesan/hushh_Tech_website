/**
 * React Hook for Email OTP Authentication
 * 
 * Provides state management and methods for email-based authentication
 */

import { useState, useEffect, useCallback } from 'react';
import {
  sendEmailOTP,
  verifyEmailOTP,
  validateSession,
  signOutEmail,
  getCurrentEmailUser,
  type EmailAuthUser,
} from '../services/emailAuth';

export interface UseEmailAuthReturn {
  // State
  user: EmailAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isVerifying: boolean;
  isSendingOTP: boolean;
  error: string | null;
  otpSent: boolean;
  
  // Methods
  sendOTP: (email: string) => Promise<boolean>;
  verifyOTP: (email: string, otp: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshSession: () => Promise<void>;
}

export const useEmailAuth = (): UseEmailAuthReturn => {
  // State
  const [user, setUser] = useState<EmailAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Initialize: Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        // First check localStorage for quick initial state
        const cachedUser = getCurrentEmailUser();
        if (cachedUser) {
          setUser(cachedUser);
        }

        // Then validate with server
        const result = await validateSession();
        if (result.success && result.user) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('[useEmailAuth] Init error:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Send OTP to email
  const sendOTP = useCallback(async (email: string): Promise<boolean> => {
    setIsSendingOTP(true);
    setError(null);
    setOtpSent(false);

    try {
      const result = await sendEmailOTP(email);
      
      if (result.success) {
        setOtpSent(true);
        return true;
      } else {
        setError(result.error || 'Failed to send OTP');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
      return false;
    } finally {
      setIsSendingOTP(false);
    }
  }, []);

  // Verify OTP
  const verifyOTP = useCallback(async (email: string, otp: string): Promise<boolean> => {
    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifyEmailOTP(email, otp);
      
      if (result.success && result.user) {
        setUser(result.user);
        setOtpSent(false);
        return true;
      } else {
        setError(result.error || 'Invalid OTP');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await signOutEmail();
      setUser(null);
      setOtpSent(false);
      setError(null);
    } catch (err) {
      console.error('[useEmailAuth] Sign out error:', err);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh session
  const refreshSession = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await validateSession();
      if (result.success && result.user) {
        setUser(result.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[useEmailAuth] Refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    user,
    isAuthenticated: user !== null,
    isLoading,
    isVerifying,
    isSendingOTP,
    error,
    otpSent,
    
    // Methods
    sendOTP,
    verifyOTP,
    signOut,
    clearError,
    refreshSession,
  };
};

export default useEmailAuth;
