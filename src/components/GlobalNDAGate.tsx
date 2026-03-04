/**
 * GlobalNDAGate Component
 *
 * GLOBAL NDA ENFORCEMENT — Acts as a universal key for the entire website.
 *
 * How it works:
 * - If user is NOT authenticated → Allow access (public marketing pages)
 * - If user IS authenticated → Check NDA status (with sessionStorage cache)
 *   - If NDA signed → Allow access to all routes
 *   - If NDA NOT signed → Redirect to /sign-nda
 *
 * Performance optimizations:
 * - NDA status cached in sessionStorage (5-minute TTL)
 * - Single useEffect (no double-fire race condition)
 * - Case-insensitive route matching
 * - Only re-checks when userId changes (not on every route change)
 * - Retry logic with graceful fallback on errors
 */

import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Box, Spinner, VStack, Text } from '@chakra-ui/react';
import { checkNDAStatus } from '../services/nda/ndaService';

interface GlobalNDAGateProps {
  children: ReactNode;
  session: Session | null;
}

/* ── Cache helpers ── */
const NDA_CACHE_KEY = 'hushh_nda_cache';
const NDA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface NDACache {
  userId: string;
  hasSignedNda: boolean;
  timestamp: number;
}

/** Read cached NDA status. Returns null if expired or missing. */
const getCachedNDA = (userId: string): boolean | null => {
  try {
    const raw = sessionStorage.getItem(NDA_CACHE_KEY);
    if (!raw) return null;
    const cache: NDACache = JSON.parse(raw);
    if (cache.userId !== userId) return null;
    if (Date.now() - cache.timestamp > NDA_CACHE_TTL) return null;
    return cache.hasSignedNda;
  } catch {
    return null;
  }
};

/** Write NDA status to cache. */
export const setCachedNDA = (userId: string, hasSignedNda: boolean): void => {
  try {
    const cache: NDACache = { userId, hasSignedNda, timestamp: Date.now() };
    sessionStorage.setItem(NDA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* sessionStorage may not be available — ignore */
  }
};

/** Clear NDA cache (e.g. on logout). */
export const clearNDACache = (): void => {
  try {
    sessionStorage.removeItem(NDA_CACHE_KEY);
  } catch {
    /* ignore */
  }
};

/* ── Route bypass lists (all lowercase for case-insensitive matching) ── */
const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/sign-nda',
];

const isAuthRoute = (pathname: string): boolean => {
  const lower = pathname.toLowerCase();
  return AUTH_ROUTES.some(
    (route) => lower === route || lower.startsWith(`${route}/`),
  );
};

/* ── Component ── */
const GlobalNDAGate: React.FC<GlobalNDAGateProps> = ({ children, session }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [hasSignedNDA, setHasSignedNDA] = useState<boolean | null>(null);

  // Track the last userId we checked — avoids re-checking on every render
  const lastCheckedUserRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const pathname = location.pathname;

      // 1. Always allow auth-related routes instantly
      if (isAuthRoute(pathname)) {
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
        }
        return;
      }

      // 2. No session → allow public pages instantly
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
        }
        return;
      }

      // 3. Already checked this user and NDA is signed → allow instantly
      if (lastCheckedUserRef.current === userId && hasSignedNDA === true) {
        if (!cancelled) setIsChecking(false);
        return;
      }

      // 4. Check sessionStorage cache first (instant, no network)
      const cached = getCachedNDA(userId);
      if (cached === true) {
        lastCheckedUserRef.current = userId;
        if (!cancelled) {
          setHasSignedNDA(true);
          setIsChecking(false);
        }
        return;
      }

      // 5. Fresh check needed — show spinner briefly, call RPC
      if (!cancelled) setIsChecking(true);

      try {
        const status = await checkNDAStatus(userId);

        if (cancelled) return;

        setCachedNDA(userId, status.hasSignedNda);
        lastCheckedUserRef.current = userId;
        setHasSignedNDA(status.hasSignedNda);

        if (!status.hasSignedNda) {
          sessionStorage.setItem('nda_redirect_after', pathname);
          navigate('/sign-nda', { replace: true });
        }
      } catch (error) {
        console.error('[GlobalNDAGate] NDA check failed:', error);

        if (cancelled) return;

        // Retry once before giving up
        try {
          const retryStatus = await checkNDAStatus(userId);

          if (cancelled) return;

          setCachedNDA(userId, retryStatus.hasSignedNda);
          lastCheckedUserRef.current = userId;
          setHasSignedNDA(retryStatus.hasSignedNda);

          if (!retryStatus.hasSignedNda) {
            sessionStorage.setItem('nda_redirect_after', pathname);
            navigate('/sign-nda', { replace: true });
          }
        } catch (retryError) {
          console.error('[GlobalNDAGate] NDA retry also failed:', retryError);

          if (cancelled) return;

          // If we had a previous cached result for this user, use it
          if (cached !== null) {
            setHasSignedNDA(cached);
          } else {
            // No cache, no network — redirect to NDA to be safe
            sessionStorage.setItem('nda_redirect_after', pathname);
            navigate('/sign-nda', { replace: true });
          }
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // Only re-run when userId changes or pathname changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, location.pathname]);

  // Loading spinner — Apple-style
  if (isChecking) {
    return (
      <Box
        minH="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="white"
      >
        <VStack spacing={4}>
          <Spinner
            thickness="3px"
            speed="0.65s"
            emptyColor="gray.200"
            color="black"
            size="xl"
          />
          <Text color="gray.600" fontSize="sm">
            Verifying access...
          </Text>
        </VStack>
      </Box>
    );
  }

  return <>{children}</>;
};

export default GlobalNDAGate;
