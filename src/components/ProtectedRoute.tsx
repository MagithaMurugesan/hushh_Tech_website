import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../resources/config/config';
import {
  FINANCIAL_LINK_ROUTE,
  normalizeFinancialLinkStatus,
} from '../services/onboarding/flow';
import { useAuthSession } from '../auth/AuthSessionProvider';
import { buildLoginRedirectPath } from '../auth/routePolicy';
import { fetchResolvedOnboardingProgress } from '../services/onboarding/progress';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const BOOT_TIMEOUT_MS = 8000;

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, status } = useAuthSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const bootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boot timeout safety net — if isLoading stays true for >8 seconds
  // (e.g., auth status stuck at 'booting'), redirect to login instead
  // of showing an infinite spinner. With the AuthSessionProvider fix
  // (instant boot from localStorage), this should rarely trigger.
  useEffect(() => {
    if (isLoading) {
      bootTimeoutRef.current = setTimeout(() => {
        console.warn(
          '[ProtectedRoute] Boot timeout reached (8s). Redirecting to login.'
        );
        setIsLoading(false);
        navigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash),
          { replace: true }
        );
      }, BOOT_TIMEOUT_MS);
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
  }, [isLoading, location.hash, location.pathname, location.search, navigate]);

  const checkAuthAndOnboarding = async () => {
    let shouldSettleLoading = true;
    try {
      if (status === 'booting') {
        setIsLoading(true);
        shouldSettleLoading = false;
        return;
      }

      if (!config.supabaseClient) {
        navigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash),
          { replace: true }
        );
        return;
      }

      const user = session?.user;
      if (!user) {
        navigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash),
          { replace: true }
        );
        return;
      }

      const onboardingData = await fetchResolvedOnboardingProgress(
        config.supabaseClient,
        user.id
      );

      const isOnOnboardingPage = location.pathname.startsWith('/onboarding/');
      const isOnFinancialLinkPage = location.pathname === FINANCIAL_LINK_ROUTE;
      const isInvestorProfileAlias = location.pathname === '/investor-profile';
      const financialLinkStatus = normalizeFinancialLinkStatus(
        onboardingData?.financial_link_status
      );

      if (!onboardingData || !onboardingData.is_completed) {
        if (
          !isOnOnboardingPage &&
          !(isInvestorProfileAlias && financialLinkStatus !== 'pending')
        ) {
          navigate(FINANCIAL_LINK_ROUTE, { replace: true });
          return;
        }

        if (!isOnFinancialLinkPage && financialLinkStatus === 'pending') {
          navigate(FINANCIAL_LINK_ROUTE, { replace: true });
          return;
        }
      }

      console.log('[ProtectedRoute] Authorization check passed');
      setIsAuthorized(true);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate(
        buildLoginRedirectPath(location.pathname, location.search, location.hash),
        { replace: true }
      );
    } finally {
      if (shouldSettleLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') {
      setIsAuthorized(false);
    }
    checkAuthAndOnboarding();
  }, [location.hash, location.pathname, location.search, navigate, session?.user?.id, status]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
