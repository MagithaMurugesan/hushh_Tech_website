import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../resources/config/config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const checkAuthAndOnboarding = async () => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let subscription: any = null;
    try {
      if (!config.supabaseClient) {
        navigate("/login", { replace: true });
        return;
      }

      const supabase = config.supabaseClient;
      let { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        await new Promise<void>((resolve) => {
          const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
            if (newSession?.user) { session = newSession; resolve(); }
          });
          subscription = data.subscription;
          timeout = setTimeout(() => resolve(), 1500);
        });
        if (timeout) clearTimeout(timeout);
        if (subscription) subscription.unsubscribe();

        if (!session?.user) {
          navigate("/login", { replace: true });
          return;
        }
      }

      const user = session?.user;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: onboardingData } = await supabase
        .from('onboarding_data')
        .select('is_completed, current_step')
        .eq('user_id', user.id)
        .maybeSingle();

      const isOnOnboardingPage = location.pathname.startsWith('/onboarding/');

      if (!onboardingData || !onboardingData.is_completed) {
        if (!isOnOnboardingPage) {
          navigate('/onboarding/step-1', { replace: true });
          return;
        }
      }

      console.log('[ProtectedRoute] Authorization check passed');
      setIsAuthorized(true);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/login", { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthAndOnboarding();
  }, [navigate, location.pathname]);

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
