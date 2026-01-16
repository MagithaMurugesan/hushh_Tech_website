/**
 * Email OTP Authentication Service for Hushh Agent
 * 
 * Uses Supabase Edge Function for sending and verifying OTP via Gmail API
 * Session tokens stored in localStorage for persistence
 */

import config from '../../resources/config/config';

// Types
export interface EmailAuthUser {
  id: string;
  email: string;
  displayName: string | null;
  premiumTier: 'free' | 'pro' | 'enterprise';
}

export interface EmailAuthResult {
  success: boolean;
  user?: EmailAuthUser;
  sessionToken?: string;
  expiresAt?: string;
  error?: string;
}

// Storage keys
const STORAGE_KEYS = {
  SESSION_TOKEN: 'hushh_agent_session_token',
  USER_DATA: 'hushh_agent_user_data',
  SESSION_EXPIRY: 'hushh_agent_session_expiry',
};

// Edge function URL
const getEdgeFunctionUrl = (endpoint: string) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || config.SUPABASE_URL;
  return `${baseUrl}/functions/v1/email-otp/${endpoint}`;
};

/**
 * Send OTP to email address
 */
export const sendEmailOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[EmailAuth] Sending OTP to:', email);

    const response = await fetch(getEdgeFunctionUrl('send'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: email.toLowerCase() }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('[EmailAuth] Failed to send OTP:', data.error);
      return { success: false, error: data.error || 'Failed to send OTP' };
    }

    console.log('[EmailAuth] OTP sent successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[EmailAuth] Error sending OTP:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Verify OTP and create session
 */
export const verifyEmailOTP = async (email: string, otp: string): Promise<EmailAuthResult> => {
  try {
    console.log('[EmailAuth] Verifying OTP for:', email);

    const response = await fetch(getEdgeFunctionUrl('verify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: email.toLowerCase(), otp }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('[EmailAuth] OTP verification failed:', data.error);
      return { success: false, error: data.error || 'Invalid OTP' };
    }

    // Store session in localStorage
    localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.sessionToken);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
    localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, data.expiresAt);

    console.log('[EmailAuth] OTP verified, session created');

    return {
      success: true,
      user: data.user,
      sessionToken: data.sessionToken,
      expiresAt: data.expiresAt,
    };
  } catch (error: any) {
    console.error('[EmailAuth] Error verifying OTP:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Validate current session
 */
export const validateSession = async (): Promise<EmailAuthResult> => {
  try {
    const sessionToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    const expiryStr = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);

    if (!sessionToken) {
      return { success: false, error: 'No session' };
    }

    // Check local expiry first
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      if (expiry < new Date()) {
        console.log('[EmailAuth] Session expired locally');
        clearSession();
        return { success: false, error: 'Session expired' };
      }
    }

    // Validate with server
    const response = await fetch(getEdgeFunctionUrl('session'), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.log('[EmailAuth] Session invalid on server');
      clearSession();
      return { success: false, error: 'Invalid session' };
    }

    // Update user data
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

    return {
      success: true,
      user: data.user,
    };
  } catch (error: any) {
    console.error('[EmailAuth] Session validation error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Sign out user
 */
export const signOutEmail = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const sessionToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);

    if (sessionToken) {
      // Notify server
      await fetch(getEdgeFunctionUrl('logout'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    }

    clearSession();
    console.log('[EmailAuth] User signed out');
    return { success: true };
  } catch (error: any) {
    console.error('[EmailAuth] Sign out error:', error);
    // Clear local session anyway
    clearSession();
    return { success: true };
  }
};

/**
 * Clear local session data
 */
const clearSession = (): void => {
  localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
};

/**
 * Get current user from localStorage (synchronous)
 */
export const getCurrentEmailUser = (): EmailAuthUser | null => {
  try {
    const userDataStr = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    const expiryStr = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);

    if (!userDataStr) return null;

    // Check expiry
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      if (expiry < new Date()) {
        clearSession();
        return null;
      }
    }

    return JSON.parse(userDataStr) as EmailAuthUser;
  } catch {
    return null;
  }
};

/**
 * Get session token
 */
export const getSessionToken = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
};

/**
 * Check if user is authenticated (synchronous)
 */
export const isAuthenticated = (): boolean => {
  const user = getCurrentEmailUser();
  return user !== null;
};

/**
 * Get user data from Supabase (for additional profile info)
 */
export const getUserProfile = async (userId: string) => {
  if (!config.supabaseClient) {
    console.warn('[EmailAuth] Supabase client not available');
    return null;
  }

  try {
    const { data, error } = await config.supabaseClient
      .from('hushh_agent_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[EmailAuth] Failed to get user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[EmailAuth] Error getting user profile:', error);
    return null;
  }
};

/**
 * Update user display name
 */
export const updateDisplayName = async (displayName: string): Promise<boolean> => {
  const user = getCurrentEmailUser();
  if (!user || !config.supabaseClient) return false;

  try {
    const { error } = await config.supabaseClient
      .from('hushh_agent_users')
      .update({ display_name: displayName })
      .eq('id', user.id);

    if (error) {
      console.error('[EmailAuth] Failed to update display name:', error);
      return false;
    }

    // Update local storage
    const updatedUser = { ...user, displayName };
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));

    return true;
  } catch (error) {
    console.error('[EmailAuth] Error updating display name:', error);
    return false;
  }
};
