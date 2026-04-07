import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../resources/config/config';
import { getCanonicalOnboardingRoute } from '../services/onboarding/flow';
import { useAuthSession } from '../auth/AuthSessionProvider';
import { buildLoginRedirectPath } from '../auth/routePolicy';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, status } = useAuthSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const checkAuthAndOnboarding = async () => {
    try {
      if (status === 'booting') {
        setIsLoading(true);
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

      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('is_completed, current_step')
        .eq('user_id', user.id)
        .maybeSingle();

      const isOnOnboardingPage = location.pathname.startsWith('/onboarding/');

      if (!onboardingData || !onboardingData.is_completed) {
        if (!isOnOnboardingPage) {
          const step = onboardingData?.current_step || 1;
          navigate(getCanonicalOnboardingRoute(step), { replace: true });
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
      setIsLoading(false);
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
