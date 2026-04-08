/**
 * GlobalNDAGate Component
 * 
 * GLOBAL NDA ENFORCEMENT - Acts as a universal key for the entire website.
 * 
 * How it works:
 * - If user is NOT authenticated → Allow access (they'll see public marketing pages)
 * - If user IS authenticated → Check NDA status
 *   - If NDA signed → Allow access to all routes
 *   - If NDA NOT signed → Redirect to /sign-nda (only allow minimal auth routes)
 * 
 * This ensures NO authenticated user can access ANY content without signing the NDA first.
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Spinner, VStack, Text } from '@chakra-ui/react';
import { checkNDAStatus } from '../services/nda/ndaService';
import { useAuthSession } from '../auth/AuthSessionProvider';
import {
  buildLoginRedirectPath,
  canGuestAccessRoute,
  isAuthenticatedAccountRoute,
  isGuestAuthRoute,
  isPublicSharedProfileRoute,
} from '../auth/routePolicy';

interface GlobalNDAGateProps {
  children: ReactNode;
}

const GlobalNDAGate: React.FC<GlobalNDAGateProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, status } = useAuthSession();
  const [isChecking, setIsChecking] = useState(true);
  const [hasSignedNDA, setHasSignedNDA] = useState<boolean | null>(null);

  // Fallback timeout — if isChecking stays true for >8 seconds,
  // auto-resolve to prevent infinite "Verifying access..." spinner.
  // This handles edge cases where auth status gets stuck at 'booting'
  // (e.g., OAuth race condition, network hang on getUser()).
  const bootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isChecking) {
      bootTimeoutRef.current = setTimeout(() => {
        console.warn(
          '[GlobalNDAGate] Boot timeout reached (8s). Forcing access check to resolve.'
        );
        setIsChecking(false);
        // Allow access to public/guest routes; authenticated-only routes
        // will be caught by ProtectedRoute downstream.
        setHasSignedNDA(canGuestAccessRoute(location.pathname));
      }, 8000);
    } else if (bootTimeoutRef.current) {
      clearTimeout(bootTimeoutRef.current);
      bootTimeoutRef.current = null;
    }

    return () => {
      if (bootTimeoutRef.current) {
        clearTimeout(bootTimeoutRef.current);
        bootTimeoutRef.current = null;
      }
    };
  }, [isChecking, location.pathname]);

  useEffect(() => {
    let cancelled = false;

    const checkNDA = async () => {
      const pathname = location.pathname;

      // Always allow auth-related routes (login, signup, sign-nda, callback)
      if (isGuestAuthRoute(pathname)) {
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
        }
        return;
      }

      // Always allow public profile routes (shared investor profiles)
      // These must be accessible by ANYONE — authenticated or not, NDA or not
      if (isPublicSharedProfileRoute(pathname)) {
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
        }
        return;
      }

      // If no session (not logged in), allow access to public pages
      if (status === 'booting') {
        if (!cancelled) {
          setIsChecking(true);
          setHasSignedNDA(null);
        }
        return;
      }

      if (!session?.user?.id || status !== 'authenticated') {
        if (isAuthenticatedAccountRoute(pathname)) {
          navigate(
            buildLoginRedirectPath(
              location.pathname,
              location.search,
              location.hash
            ),
            { replace: true }
          );
          return;
        }

        // Allow public marketing and guest-accessible routes for non-authenticated users
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(canGuestAccessRoute(pathname));
        }
        return;
      }

      if (!cancelled) {
        setIsChecking(true);
        setHasSignedNDA(null);
      }

      // USER IS AUTHENTICATED - Check NDA status
      try {
        const status = await checkNDAStatus(session.user.id);
        if (cancelled) {
          return;
        }

        setHasSignedNDA(status.hasSignedNda);

        // If NDA not signed, redirect to NDA page
        if (!status.hasSignedNda) {
          // Store the intended destination for redirect after signing
          sessionStorage.setItem('nda_redirect_after', pathname);
          navigate('/sign-nda', { replace: true });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Error checking NDA status:', error);
        // On error, redirect to NDA page to be safe
        sessionStorage.setItem('nda_redirect_after', pathname);
        navigate('/sign-nda', { replace: true });
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    void checkNDA();

    return () => {
      cancelled = true;
    };
  }, [location.hash, location.pathname, location.search, navigate, session?.user?.id, status]);

  // Show loading state while checking - Apple-style black/white design
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

  // Render children if access is allowed
  return <>{children}</>;
};

export default GlobalNDAGate;
