/**
 * Hushh Agents - Auth Hook
 * 
 * Uses existing Supabase auth with redirect back to /hushh-agents
 */

import { useState, useEffect, useCallback } from 'react';
import config from '../../resources/config/config';
import { ROUTES, DEFAULT_LANGUAGE, type LanguageCode, SUBSCRIPTION_TIERS } from '../core/constants';
import type { HushhAgentUser, UseAuthReturn } from '../core/types';

const { supabaseClient } = config;

/**
 * Hook to manage authentication for Hushh Agents
 */
export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<HushhAgentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check current auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseClient) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          // Map Supabase user to HushhAgentUser
          const hushhUser: HushhAgentUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            avatarUrl: session.user.user_metadata?.avatar_url,
            subscriptionTier: 'LIMITED', // Default to limited, can be fetched from DB
            dailyMessageCount: 0,
            lastResetDate: new Date().toISOString().split('T')[0],
            preferredLanguage: DEFAULT_LANGUAGE,
            createdAt: session.user.created_at,
          };
          
          setUser(hushhUser);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError('Failed to check authentication');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    if (!supabaseClient) return;
    
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const hushhUser: HushhAgentUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            avatarUrl: session.user.user_metadata?.avatar_url,
            subscriptionTier: 'LIMITED',
            dailyMessageCount: 0,
            lastResetDate: new Date().toISOString().split('T')[0],
            preferredLanguage: DEFAULT_LANGUAGE,
            createdAt: session.user.created_at,
          };
          setUser(hushhUser);
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with OAuth provider
  const signIn = useCallback(async (provider: 'google' | 'apple') => {
    if (!supabaseClient) {
      setError('Authentication service not available');
      return;
    }

    setError(null);

    try {
      // Preserve the current page's ?redirectTo= so after OAuth
      // the LoginPage can navigate to the intended destination
      const currentSearch = window.location.search;
      const redirectUrl = `${window.location.origin}/hushh-agents/login${currentSearch}`;
      
      console.log('[HushhAgents] OAuth redirect URL:', redirectUrl);
      
      const { error: signInError } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (signInError) {
        throw signInError;
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    if (!supabaseClient) {
      return;
    }

    try {
      await supabaseClient.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    signIn,
    signOut,
    error,
  };
}

export default useAuth;
