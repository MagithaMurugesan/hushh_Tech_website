import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/home/ui';
import Leadership from './components/Leadership';
import Philosophy from './components/Philosophy';
import Footer from './components/Footer';
import LoginPage from './pages/login/ui'
import Contact from './pages/Contact';
import ScrollToTop from './components/ScrollToTop';
import OnboardingShellAutoPadding from './components/OnboardingShellAutoPadding';
// FloatingContactBubble removed as requested
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import Consumers from './pages/services/consumers';
import Business from './pages/services/business';
import SignupPage from './pages/signup/ui';
import Faq from './pages/faq';
import Career from './pages/career';
// import Community from './pages/community'; // OLD monolithic
// Old monolithic community (kept as backup):
// import CommunityList from './pages/community/communityList';
// import CommunityPost from './pages/community/communityPost';
import CommunityPage from './pages/community/ui';
import CommunityPostPage from './pages/community/post-ui';
import ReportDetailPage from './pages/reports/reportDetail';
import BenefitsPage from './pages/benefits';
import PrivacyPolicy from './pages/privacy-policy';
import CareersPrivacyPolicy from './pages/career-privacy-policy';
import CaliforniaPrivacyPolicy from './pages/california-privacy-policy';
import EUUKPrivacyPolicy from './pages/eu-uk-privacy-policy';
import DeleteAccountPage from './pages/delete-account';
import { useState, useEffect, ReactNode } from 'react';
import config from './resources/config/config';
import NDAPopup from './components/NdaForm';
import Profile from './pages/profile';
import AuthCallback from './pages/AuthCallback';
import KYCVerificationPage from './pages/kyc-verification/page';
import NDARequestModal from './components/NdaForm';
import NDARequestModalComponent from './components/NDARequestModal';
import UserProfilePage from './pages/user-profile/page';
import InvestorProfilePage from './pages/investor-profile';
import KYCFormPage from './pages/kyc-form/page';
import { Session } from '@supabase/supabase-js';
import DiscoverFundA from './pages/discover-fund-a';
import SellTheWallPage from './pages/sell-the-wall';
import AIPoweredBerkshirePage from './pages/ai-powered-berkshire';
import UserRegistration from './pages/UserRegistration';
import ProtectedRoute from './components/ProtectedRoute';
import YourProfilePage from './pages/your-profile';
import HushhUserProfilePage from './pages/hushh-user-profile';
import ViewPreferencesPage from './pages/hushh-user-profile/view';
import PrivacyControlsPage from './pages/hushh-user-profile/privacy';
import PublicHushhProfilePage from './pages/hushhid';
import PublicInvestorProfilePage from './pages/investor/PublicInvestorProfile';
import HushhIDHeroDemo from './pages/hushhid-hero-demo';
import FinancialLinkPage from './pages/onboarding/financial-link/ui';
import OnboardingStep1 from './pages/onboarding/step-1/ui';
import OnboardingStep2 from './pages/onboarding/step-2/ui';
// Step 3 removed (was interstitial filler) — route redirects to step-4
import OnboardingStep4 from './pages/onboarding/step-4/ui';
import OnboardingStep5 from './pages/onboarding/step-5/ui';
import OnboardingStep7 from './pages/onboarding/step-7/ui';
import OnboardingStep8 from './pages/onboarding/step-8/ui';
import OnboardingStep9 from './pages/onboarding/step-9/ui';
import OnboardingStep11 from './pages/onboarding/step-11/ui';
import OnboardingStep13 from './pages/onboarding/step-13/ui';
import VerifyIdentityPage from './pages/onboarding/verify-identity/ui';
import VerifyCompletePage from './pages/onboarding/verify-complete/ui';
import MeetCeoPage from './pages/onboarding/meet-ceo/ui';
import InvestorGuidePage from './pages/onboarding/InvestorGuide';
import KYCDemoPage from './pages/kyc-demo';
import KycFlowPage from './pages/kyc-flow';
import A2APlaygroundPage from './pages/a2a-playground';
import ReceiptGeneratorPage from './pages/receipt-generator';
import DeveloperDocsPage from './pages/developer-docs';
import HushhAgentMailerPage from './pages/hushh-agent-mailer';
import MobileBottomNav from './components/MobileBottomNav';
import HushhAIPage from './hushh-ai/pages';
import { LoginPage as HushhAILoginPage, SignupPage as HushhAISignupPage } from './hushh-ai/presentation/pages';
import HushhAgentApp from './hushh-agent/pages';
import KaiApp from './kai/pages';
import KaiIndiaApp from './kai-india/pages';
import HushhStudioApp from './hushh-studio/pages';
import HushhAgentsApp from './hushh-agents/pages';
import GlobalNDAGate from './components/GlobalNDAGate';
import SignNDAPage from './pages/sign-nda';
import NDAAdminPage from './pages/nda-admin';

// Google Analytics configuration
const GA_TRACKING_ID = 'G-R58S9WWPM0';

// Content wrapper component that applies conditional margin
const ContentWrapper = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/signUp' || location.pathname === '/solutions';
  const isAuthCallback = location.pathname.startsWith('/auth/callback');
  const isUserRegistration = location.pathname === '/user-registration';
  const isOnboarding = location.pathname.startsWith('/onboarding');
  const isKycFlow = location.pathname.startsWith('/kyc-flow');
  const isKycDemo = location.pathname.startsWith('/kyc-demo');
  const isA2APlayground = location.pathname.startsWith('/a2a-playground');
  const isInvestorGuide = location.pathname === '/investor-guide';
  const isHushhAI = location.pathname.startsWith('/hushh-ai');
  const isHushhAgent = location.pathname.startsWith('/hushh-agent');
  const isHushhAgents = location.pathname.startsWith('/hushh-agents');
  const isKai = location.pathname.startsWith('/kai');
  const isStudio = location.pathname.startsWith('/studio');
  const isHushhUserProfile = location.pathname.startsWith('/hushh-user-profile');
  const isSignNda = location.pathname.startsWith('/sign-nda');
  const isInvestorProfile = location.pathname.startsWith('/investor-profile');
  const isPublicInvestorProfile = location.pathname.startsWith('/investor/');
  const isDiscoverFundA = location.pathname === '/discover-fund-a';
  const isCommunity = location.pathname.startsWith('/community');
  const isDeleteAccount = location.pathname === '/delete-account';
  const isLogin = location.pathname.toLowerCase() === '/login';
  const isSignup = location.pathname.toLowerCase() === '/signup';
  const isProfile = location.pathname === '/profile';

  return (
    <div className={`${isHomePage || isAuthCallback || isUserRegistration || isOnboarding || isKycFlow || isKycDemo || isA2APlayground || isInvestorGuide || isHushhAI || isHushhAgent || isHushhAgents || isKai || isStudio || isHushhUserProfile || isSignNda || isInvestorProfile || isPublicInvestorProfile || isDiscoverFundA || isCommunity || isDeleteAccount || isLogin || isSignup || isProfile ? '' : 'mt-20'}`}>
      {children}
    </div>
  );
};

// Layout visibility hook - determines which components to show based on route
const useLayoutVisibility = () => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isHushhAI = location.pathname.startsWith('/hushh-ai');
  const isHushhAgent = location.pathname.startsWith('/hushh-agent');
  const isHushhAgents = location.pathname.startsWith('/hushh-agents');
  const isKai = location.pathname.startsWith('/kai');
  const isStudio = location.pathname.startsWith('/studio');
  const isOnboarding = location.pathname.startsWith('/onboarding');
  const isProfile = location.pathname === '/profile';
  const isFundA = location.pathname === '/discover-fund-a';
  const isCommunity = location.pathname.startsWith('/community');
  const isDeleteAccount = location.pathname === '/delete-account';
  const isLogin = location.pathname.toLowerCase() === '/login';
  const isSignup = location.pathname.toLowerCase() === '/signup';
  const isSignNda = location.pathname.startsWith('/sign-nda');
  const isHushhUserProfile = location.pathname.startsWith('/hushh-user-profile');

  // All pages using HushhTechHeader — hide old global Navbar/Footer
  const isKycFlow = location.pathname.startsWith('/kyc-flow');
  const isKycDemo = location.pathname.startsWith('/kyc-demo');
  const isA2APlayground = location.pathname.startsWith('/a2a-playground');
  const isPublicInvestorProfile = location.pathname.startsWith('/investor/');
  const hideOld = isHushhAI || isHushhAgent || isHushhAgents || isKai || isStudio || isHomePage || isOnboarding || isProfile || isFundA || isCommunity || isDeleteAccount || isLogin || isSignup || isSignNda || isHushhUserProfile || isKycFlow || isKycDemo || isA2APlayground || isPublicInvestorProfile;
  return {
    showNavbar: !hideOld,
    showFooter: !hideOld,
    showMobileNav: !hideOld,
  };
};

// Google Analytics setup function
const initializeGoogleAnalytics = () => {
  // Check if gtag is already loaded
  if (typeof window !== 'undefined' && !window.gtag) {
    // Create script element for gtag
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
    document.head.appendChild(script);

    // Initialize gtag
    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: any[]) {
        window.dataLayer.push(args);
      }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', GA_TRACKING_ID);
    };
  }
};

function App() {
  const [session, setSession] = useState<Session | null>(null);

  // Initialize Google Analytics
  useEffect(() => {
    initializeGoogleAnalytics();
  }, []);

  // Fetch user session when app loads
  useEffect(() => {
    if (config.supabaseClient) {
      const syncSessionIfUserChanged = (nextSession: Session | null) => {
        setSession((currentSession) => {
          const currentUserId = currentSession?.user?.id ?? null;
          const nextUserId = nextSession?.user?.id ?? null;
          const currentAccessToken = currentSession?.access_token ?? null;
          const nextAccessToken = nextSession?.access_token ?? null;
          const isSameSession = currentUserId === nextUserId && currentAccessToken === nextAccessToken;
          return isSameSession ? currentSession : nextSession;
        });
      };

      config.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        syncSessionIfUserChanged(session);
      });

      // Listen for auth state changes
      const {
        data: { subscription },
      } = config.supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
        syncSessionIfUserChanged(nextSession);
      });

      return () => subscription?.unsubscribe();
    }
  }, []);

  // Inner layout component that uses hooks for conditional rendering
  const AppLayout = () => {
    const { showNavbar, showFooter, showMobileNav } = useLayoutVisibility();
    
    return (
      <div className="min-h-screen flex flex-col">
        {/* Navbar - Only show for non-Hushh AI routes */}
        {showNavbar && <Navbar />}
        {/* {session && <NDAPopup />} */}
        <ContentWrapper>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about/leadership" element={<Leadership />} />
            <Route path="/about/philosophy" element={<Philosophy />} />
            <Route path="/Login" element={<LoginPage />} />
            <Route path="/Contact" element={<Contact />} />
            <Route path="/benefits" element={<BenefitsPage />} />
            <Route path='/services/consumers' element={<Consumers />} />
            <Route path='/services/business' element={<Business />} />
            <Route path='/Signup' element={<SignupPage />} />
            <Route path='/faq' element={<Faq />} />
            <Route path='/profile' element={
              <Profile />
            } />
            <Route path="/career" element={<Career />} />
            <Route path="/career/*" element={<Career />} />
            <Route path='/privacy-policy' element={<PrivacyPolicy />} />
            <Route path='/carrer-privacy-policy' element={<CareersPrivacyPolicy />} />
            <Route path="/community" element={
              <CommunityPage />
            } />
            <Route path='/california-privacy-policy' element={<CaliforniaPrivacyPolicy />} />
            <Route path='/eu-uk-jobs-privacy-policy' element={<EUUKPrivacyPolicy />} />
            <Route path='/delete-account' element={<DeleteAccountPage />} />
            <Route path="/community/*" element={
              <CommunityPostPage />
            } />
            <Route path="/reports/:id" element={

              <ReportDetailPage />

            } />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Investor Onboarding Guide - Public landing page */}
            <Route path="/investor-guide" element={<InvestorGuidePage />} />
            {/* Financial Link — mandatory pre-step before onboarding */}
            <Route path="/onboarding/financial-link" element={
              <ProtectedRoute>
                <FinancialLinkPage />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-1" element={
              <ProtectedRoute>
                <OnboardingStep1 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-2" element={
              <ProtectedRoute>
                <OnboardingStep2 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-3" element={
              <Navigate to="/onboarding/step-4" replace />
            } />
            {/* Step 3 removed — was interstitial "Let's continue" filler */}
            <Route path="/onboarding/step-4" element={
              <ProtectedRoute>
                <OnboardingStep4 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-5" element={
              <ProtectedRoute>
                <OnboardingStep5 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-6" element={
              <ProtectedRoute>
                <Navigate to="/onboarding/step-5" replace />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-7" element={
              <ProtectedRoute>
                <OnboardingStep7 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-8" element={
              <ProtectedRoute>
                <OnboardingStep8 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-9" element={
              <ProtectedRoute>
                <OnboardingStep9 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-10" element={
              <ProtectedRoute>
                <Navigate to="/onboarding/step-11" replace />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-11" element={
              <ProtectedRoute>
                <OnboardingStep11 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-12" element={
              <ProtectedRoute>
                <Navigate to="/onboarding/step-11" replace />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/step-13" element={
              <ProtectedRoute>
                <OnboardingStep13 />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/verify" element={
              <ProtectedRoute>
                <VerifyIdentityPage />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/verify-complete" element={
              <ProtectedRoute>
                <VerifyCompletePage />
              </ProtectedRoute>
            } />
            <Route path="/onboarding/meet-ceo" element={
              <ProtectedRoute>
                <MeetCeoPage />
              </ProtectedRoute>
            } />
            <Route path="/hushh-user-profile" element={
              <ProtectedRoute>
                <HushhUserProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/hushh-user-profile/view" element={
              <ProtectedRoute>
                <ViewPreferencesPage />
              </ProtectedRoute>
            } />
            <Route path="/hushh-user-profile/privacy" element={
              <ProtectedRoute>
                <PrivacyControlsPage />
              </ProtectedRoute>
            } />
            <Route path="/profile/:id" element={<ViewPreferencesPage />} />
            <Route path="/hushhid/:id" element={<PublicHushhProfilePage />} />
            <Route path="/hushhid-hero-demo" element={<HushhIDHeroDemo />} />
            {/* <Route path="/solutions" element={<SolutionsPage />} /> */}
            <Route path='/kyc-verification' element={

              <KYCVerificationPage />

            } />
            <Route path='/kyc-form' element={

              <KYCFormPage />

            } />
            <Route path='/discover-fund-a' element={

              <DiscoverFundA />

            } />
            <Route path='/sell-the-wall' element={

              <SellTheWallPage />

            } />
            <Route path='/ai-powered-berkshire' element={

              <AIPoweredBerkshirePage />

            } />
            <Route path='/user-registration' element={
              <ProtectedRoute>
                <UserRegistration />
              </ProtectedRoute>
            } />
            <Route path='/nda-form' element={

              <NDARequestModalComponent
                session={session}
                onSubmit={(result: string) => {
                  console.log("NDA submission result:", result);
                  // Handle post-submission actions here
                  if (result === "Approved" || result === "Pending" || result === "Requested permission") {
                    // Redirect to appropriate page on success
                    window.location.href = "/";
                  }
                }}
              />

            } />
            <Route path='/investor-profile' element={
              <ProtectedRoute>
                <InvestorProfilePage />
              </ProtectedRoute>
            } />
            <Route path='/investor/:slug' element={<PublicInvestorProfilePage />} />
            <Route path='/user-profile' element={

              <UserProfilePage />

            } />
            <Route path='/your-profile' element={

              <YourProfilePage />

            } />
            <Route path='/kyc-demo' element={<KYCDemoPage />} />
            <Route path='/kyc-flow' element={<KycFlowPage />} />
            <Route path='/a2a-playground' element={<A2APlaygroundPage />} />
            <Route path='/receipt-generator' element={<ReceiptGeneratorPage />} />
            <Route path='/developer-docs' element={<DeveloperDocsPage />} />
            <Route path='/hushh-agent-mailer' element={<HushhAgentMailerPage />} />
            <Route path='/hushh-ai' element={<HushhAIPage />} />
            <Route path='/hushh-ai/login' element={<HushhAILoginPage />} />
            <Route path='/hushh-ai/signup' element={<HushhAISignupPage />} />
            {/* Hushh Agent - AI Voice/Video Coaching Platform */}
            {/* Uses wildcard to enable nested routing within hushh-agent module */}
            <Route path='/hushh-agent/*' element={<HushhAgentApp />} />
            {/* Kai - Financial Intelligence Agent */}
            {/* Real-time AI voice/video financial advisor powered by Gemini 2.0 Flash */}
            <Route path='/kai' element={<KaiApp />} />
            {/* Kai India - Indian Market Intelligence Dashboard */}
            {/* Real-time NSE/BSE market data powered by Gemini 2.5 Flash with Google Search */}
            <Route path='/kai-india' element={<KaiIndiaApp />} />
            {/* Hushh Studio - FREE AI Video Generation */}
            {/* Powered by Google Veo 3.1 - No login required, free for Indian audience */}
            <Route path='/studio' element={<HushhStudioApp />} />
            {/* Global NDA Signing Page */}
            <Route path='/sign-nda' element={<SignNDAPage />} />
            {/* NDA Admin Page - Password protected view of all NDA agreements */}
            <Route path='/nda-admin' element={<NDAAdminPage />} />
            {/* Hushh Agents - Multi-lingual AI Chat Platform */}
            {/* Powered by GCP Gemini Live API - Hindi, English, Tamil support */}
            <Route path='/hushh-agents/*' element={<HushhAgentsApp />} />
          </Routes>
        </ContentWrapper>
        {/* Footer - Only show for non-Hushh AI routes */}
        {showFooter && <Footer />}
        {/* Mobile Bottom Navigation - only visible on mobile and non-Hushh AI routes */}
        {showMobileNav && <MobileBottomNav />}
      </div>
    );
  };

  return (
    <ChakraProvider theme={theme}>
      <Router>
        <ScrollToTop />
        <OnboardingShellAutoPadding />
        <GlobalNDAGate session={session}>
          <AppLayout />
        </GlobalNDAGate>
      </Router>
    </ChakraProvider>
  );
}

export default App;
