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

import React, { useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Box, Spinner, VStack, Text } from '@chakra-ui/react';
import { checkNDAStatus } from '../services/nda/ndaService';

interface GlobalNDAGateProps {
  children: ReactNode;
  session: Session | null;
}

// MINIMAL routes that bypass NDA check for authenticated users
// These are ONLY the routes needed for authentication and NDA signing itself
const AUTH_ROUTES = [
  '/Login',
  '/Signup',
  '/auth/callback',
  '/sign-nda',
  '/document-viewer',
];

// Public routes accessible WITHOUT authentication
// These are marketing/info pages visible to non-logged-in users
const UNAUTHENTICATED_PUBLIC_ROUTES = [
  '/',
  '/privacy-policy',
  '/faq',
  '/carrer-privacy-policy',
  '/california-privacy-policy',
  '/eu-uk-jobs-privacy-policy',
  '/delete-account',
  '/investor-guide',
  '/about',
  '/services',
  '/career',
  '/community',
  '/Contact',
  '/benefits',
];

// Public profile routes that should ALWAYS be accessible (even for authenticated users)
// These are shared links that anyone should be able to open
const PUBLIC_PROFILE_ROUTES = [
  '/investor/',  // /investor/:slug — public shared profile pages
];

// Check if path is a public profile route (bypass NDA for these)
const isPublicProfileRoute = (pathname: string): boolean => {
  return PUBLIC_PROFILE_ROUTES.some(route => pathname.startsWith(route));
};

// Check if path is an auth-related route
const isAuthRoute = (pathname: string): boolean => {
  return AUTH_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
};

// Check if path is a public route (for unauthenticated users)
const isUnauthenticatedPublicRoute = (pathname: string): boolean => {
  // Home page exact match
  if (pathname === '/') return true;
  
  return UNAUTHENTICATED_PUBLIC_ROUTES.some(route => {
    if (route === '/') return false; // Already handled above
    return pathname === route || pathname.startsWith(`${route}/`);
  });
};

const GlobalNDAGate: React.FC<GlobalNDAGateProps> = ({ children, session }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [hasSignedNDA, setHasSignedNDA] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkNDA = async () => {
      const pathname = location.pathname;

      // Always allow auth-related routes (login, signup, sign-nda, callback)
      if (isAuthRoute(pathname)) {
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
        }
        return;
      }

      // Always allow public profile routes (shared investor profiles)
      // These must be accessible by ANYONE — authenticated or not, NDA or not
      if (isPublicProfileRoute(pathname)) {
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
        }
        return;
      }

      // If no session (not logged in), allow access to public pages
      if (!session?.user?.id) {
        // Allow public marketing pages for non-authenticated users
        if (!cancelled) {
          setIsChecking(false);
          setHasSignedNDA(true);
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
  }, [session?.user?.id, location.pathname, navigate]);

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
