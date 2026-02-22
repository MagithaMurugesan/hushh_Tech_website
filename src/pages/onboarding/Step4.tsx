import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { upsertOnboardingData } from '../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../utils/useFooterVisibility';
import { locationService, LocationData, COUNTRY_CODE_TO_NAME } from '../../services/location';
import PermissionHelpModal from '../../components/PermissionHelpModal';

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

const CURRENT_STEP = 4;
const TOTAL_STEPS = 12;
const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

// United States first, then alphabetical
const countries = [
  'United States',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
  'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'North Korea',
  'South Korea', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macedonia', 'Madagascar', 'Malawi',
  'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
  'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
  'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Swaziland', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
  'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan',
  'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'Uruguay',
  'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function OnboardingStep4() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [citizenshipCountry, setCitizenshipCountry] = useState('');
  const [residenceCountry, setResidenceCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isFooterVisible = useFooterVisibility();

  // GPS location detection state
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [userManuallyChanged, setUserManuallyChanged] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'success' | 'ip-success' | 'denied' | 'failed' | 'manual' | null>(null);
  const [detectedLocation, setDetectedLocation] = useState('');
  const [userConfirmedManual, setUserConfirmedManual] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [hasPreviousData, setHasPreviousData] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const canContinue = locationDetected || userConfirmedManual;

  /* ─── Scroll to top ─── */
  useEffect(() => { window.scrollTo(0, 0); }, []);

  /* ─── Load user + existing data ─── */
  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);

      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (onboardingData) {
        if (onboardingData.citizenship_country) {
          setCitizenshipCountry(onboardingData.citizenship_country);
          setUserManuallyChanged(true);
          setHasPreviousData(true);
        }
        if (onboardingData.residence_country) {
          setResidenceCountry(onboardingData.residence_country);
        }
      }
    };
    getCurrentUser();
    return () => { locationService.cancel(); };
  }, [navigate]);

  // Show modal on first visit
  useEffect(() => {
    if (!locationStatus && !hasPreviousData && userId) {
      setShowLocationModal(true);
    }
  }, [userId, locationStatus, hasPreviousData]);

  /* ─── Location detection ─── */
  const detectLocation = async (uid: string) => {
    setIsDetectingLocation(true);
    setLocationStatus('detecting');

    try {
      const result = await locationService.detectLocation();

      if ((result.source === 'detected' || result.source === 'ip-detected') && result.data) {
        const locationData: LocationData = result.data;
        const countryName = COUNTRY_CODE_TO_NAME[locationData.countryCode] || locationData.country;

        if (countries.includes(countryName)) {
          setCitizenshipCountry(countryName);
          setResidenceCountry(countryName);
        }

        setDetectedLocation(locationData.city || locationData.state || countryName);
        setLocationDetected(true);
        setLocationStatus(result.source === 'detected' ? 'success' : 'ip-success');
        setHasPreviousData(false);

        try { await locationService.saveLocationToOnboarding(uid, locationData); }
        catch (e) { console.warn('[Step4] Cache failed:', e); }
      } else if (result.source === 'denied') {
        setLocationStatus('denied');
      } else {
        setLocationStatus('failed');
      }
    } catch (error) {
      console.error('[Step4] Location error:', error);
      setLocationStatus('failed');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  /* ─── Handlers ─── */
  const handleCitizenshipChange = (value: string) => {
    setCitizenshipCountry(value);
    setUserManuallyChanged(true);
    if (userConfirmedManual) { setUserConfirmedManual(false); setLocationStatus('manual'); }
  };

  const handleResidenceChange = (value: string) => {
    setResidenceCountry(value);
    setUserManuallyChanged(true);
    if (userConfirmedManual) { setUserConfirmedManual(false); setLocationStatus('manual'); }
  };

  const handleConfirmManualSelection = () => {
    if (citizenshipCountry && residenceCountry) {
      setUserConfirmedManual(true);
      setLocationStatus('manual');
    }
  };

  const handleRetry = async () => {
    setLocationDetected(false);
    setUserManuallyChanged(false);
    setUserConfirmedManual(false);
    if (userId) await detectLocation(userId);
  };

  // iOS Alert: "Allow Once" or "Allow While Using App"
  const handleAllowLocation = async () => {
    if (!userId) return;
    setShowLocationModal(false);
    await detectLocation(userId);
  };

  // iOS Alert: "Don't Allow"
  const handleDontAllow = () => {
    setShowLocationModal(false);
    setLocationStatus('manual');
  };

  const handleContinue = async () => {
    if (!userId || !config.supabaseClient || !canContinue) return;
    setIsLoading(true);
    try {
      await upsertOnboardingData(userId, {
        citizenship_country: citizenshipCountry,
        residence_country: residenceCountry,
        current_step: 4,
      });
      navigate('/onboarding/step-5');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => navigate('/onboarding/step-2');
  const handleSkip = () => navigate('/onboarding/step-5');

  const isErrorStatus = locationStatus === 'denied' || locationStatus === 'failed';
  const isSuccessStatus = locationStatus === 'success' || locationStatus === 'ip-success';
  const shouldShowForm = Boolean(locationStatus || hasPreviousData);
  const canConfirmSelection = Boolean(citizenshipCountry && residenceCountry && !userConfirmedManual);

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div
      className="bg-white min-h-[100dvh] flex flex-col relative overflow-hidden"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", WebkitFontSmoothing: 'antialiased' }}
    >
      {/* ═══ Background layer (blurs when modal is open) ═══ */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showLocationModal ? 'scale-[0.98] blur-[2px] opacity-60' : ''}`}>
        {/* ═══ iOS Navigation Bar ═══ */}
        <nav
          className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#C6C6C8]/30 flex items-end justify-between px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 12px) + 4px)', minHeight: '48px' }}
        >
          <button onClick={handleBack} className="text-[#007AFF] flex items-center -ml-2 active:opacity-50 transition-opacity" aria-label="Go back">
            <span className="material-symbols-outlined text-3xl -mr-1" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
              chevron_left
            </span>
            <span className="text-[17px] leading-none pb-[2px]">Back</span>
          </button>
          <h1 className="text-[17px] font-semibold text-black absolute left-1/2 transform -translate-x-1/2">
            Setup
          </span>
          <button onClick={handleSkip} className="text-[#007AFF] font-medium text-[17px]">Skip</button>
        </nav>

        <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-4 pb-52">
          {/* ─── Progress Bar ─── */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide">Onboarding Progress</span>
              <span className="text-[13px] text-[#8E8E93]">Step {CURRENT_STEP}/{TOTAL_STEPS}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div className="bg-[#007AFF] h-1 rounded-full transition-all duration-500" style={{ width: `${PROGRESS_PCT}%` }} />
            </div>
            <p className="mt-2 text-[13px] font-medium text-[#007AFF]">{PROGRESS_PCT}% complete</p>
          </div>

          {/* ─── Title ─── */}
          <h1 className="text-[34px] leading-[41px] font-bold text-black mb-2 tracking-tight">
            Confirm your residence
          </span>
          <p className="text-[17px] text-[#8E8E93] mb-8 leading-snug">
            We need to know where you live and pay taxes to open your investment account.
          </p>

          {/* ─── Status Banners ─── */}
          {locationStatus === 'detecting' && (
            <div className="flex items-center gap-3 p-3 mb-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="animate-spin h-5 w-5 border-2 border-[#007AFF] border-t-transparent rounded-full shrink-0" />
              <p className="text-sm font-medium text-[#007AFF]">Detecting your location...</p>
            </div>
          )}

          {isSuccessStatus && (
            <div className="flex items-start gap-3 p-4 mb-8 bg-green-50 rounded-xl">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700", fontSize: '14px' }}>check</span>
              </div>
              <p className="text-[15px] leading-snug text-black">
                <span className="font-semibold">Location detected:</span> {detectedLocation}
              </p>
            </div>
          )}

          {isErrorStatus && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>error</span>
                  <p className="text-sm font-medium text-red-700">
                    {locationStatus === 'denied' ? 'Location access denied' : 'Could not detect location'}
                  </p>
                </div>
                <button onClick={handleRetry} className="text-[#007AFF] text-sm font-semibold shrink-0">Retry</button>
              </div>
              {locationStatus === 'denied' && (
                <button
                  onClick={(e) => { e.preventDefault(); setShowPermissionHelp(true); }}
                  className="mt-2 ml-1 text-xs font-semibold text-[#007AFF]"
                >
                  How to enable location
                </button>
              )}
            </div>
          )}

          {/* ─── Country Selection — iOS Separated Rows ─── */}
          {shouldShowForm && (
            <div className="space-y-8">
              {/* Citizenship */}
              <div className="space-y-2">
                <span className="px-4 text-[13px] uppercase text-[#8E8E93] font-normal">
                  Country of Citizenship
                </span>
                <div className="bg-white rounded-xl overflow-hidden border border-[#C6C6C8]/50">
                  <label className="flex items-center justify-between pl-4 pr-3 py-3 cursor-pointer active:bg-gray-100 transition-colors relative">
                    <span className="text-[17px] text-black">{citizenshipCountry || 'Select country'}</span>
                    <span className="material-symbols-outlined text-gray-400" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_right</span>
                    <select
                      value={citizenshipCountry}
                      onChange={(e) => handleCitizenshipChange(e.target.value)}
                      disabled={isDetectingLocation}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                      <option disabled value="">Select country</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {/* Residence */}
              <div className="space-y-2">
                <span className="px-4 text-[13px] uppercase text-[#8E8E93] font-normal">
                  Country of Residence
                </span>
                <div className="bg-white rounded-xl overflow-hidden border border-[#C6C6C8]/50">
                  <label className="flex items-center justify-between pl-4 pr-3 py-3 cursor-pointer active:bg-gray-100 transition-colors relative">
                    <span className="text-[17px] text-black">{residenceCountry || 'Select country'}</span>
                    <span className="material-symbols-outlined text-gray-400" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_right</span>
                    <select
                      value={residenceCountry}
                      onChange={(e) => handleResidenceChange(e.target.value)}
                      disabled={isDetectingLocation}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                      <option disabled value="">Select country</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {/* Confirm manual selection (hidden button — auto-confirms on select) */}
              {!locationDetected && canConfirmSelection && !userConfirmedManual && (
                <button
                  onClick={handleConfirmManualSelection}
                  className="w-full py-2.5 rounded-xl bg-[#007AFF]/10 text-[#007AFF] font-semibold text-[15px] active:scale-[0.98] transition-all"
                >
                  Confirm Selection
                </button>
              )}
            </div>
          )}

          {/* ─── Detect Location Button (when no modal) ─── */}
          {!showLocationModal && !isDetectingLocation && !isSuccessStatus && (
            <button
              onClick={() => userId && detectLocation(userId)}
              className="w-full py-3 rounded-xl border border-[#007AFF]/20 bg-blue-50 text-[#007AFF] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>my_location</span>
              Detect My Location
            </button>
          )}
        </main>
      </div>

      {/* ═══ Dark Overlay ═══ */}
      {showLocationModal && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
      )}

      {/* ═══ iOS System Alert Dialog ═══ */}
      {showLocationModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-8">
          <div
            className="w-[270px] overflow-hidden rounded-[14px] shadow-2xl"
            style={{
              backgroundColor: 'rgba(245, 245, 245, 0.85)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            {/* Content */}
            <div className="px-4 pt-5 pb-4 text-center">
              <h3 className="text-[17px] font-semibold leading-[22px] text-black mb-1">
                Allow &ldquo;Hushh&rdquo; to use your location?
              </h3>
              <p className="text-[13px] leading-[16px] font-normal text-black px-1">
                Your location is used to automatically determine your country and streamline the verification process.
              </p>
            </div>

            {/* Action buttons — stacked iOS style */}
            <div className="flex flex-col border-t" style={{ borderColor: 'rgba(60,60,67,0.2)' }}>
              <button
                onClick={handleAllowLocation}
                className="h-[44px] w-full text-[17px] leading-[22px] text-[#007AFF] font-normal active:bg-gray-200/50 transition-colors border-b"
                style={{ borderColor: 'rgba(60,60,67,0.2)' }}
              >
                Allow Once
              </button>
              <button
                onClick={handleAllowLocation}
                className="h-[44px] w-full text-[17px] leading-[22px] text-[#007AFF] font-normal active:bg-gray-200/50 transition-colors border-b"
                style={{ borderColor: 'rgba(60,60,67,0.2)' }}
              >
                Allow While Using App
              </button>
              <button
                onClick={handleDontAllow}
                className="h-[44px] w-full text-[17px] leading-[22px] text-[#007AFF] font-semibold active:bg-gray-200/50 transition-colors"
              >
                Don&apos;t Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Fixed Footer ═══ */}
      {!isFooterVisible && !showLocationModal && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#C6C6C8]/30 z-40"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          data-onboarding-footer
        >
          <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
            {/* Skip Button */}
            <button
              onClick={handleSkip}
              className="h-[50px] w-full rounded-xl bg-[#F2F2F7] text-[#007AFF] font-semibold text-[17px] active:bg-gray-200 transition-colors flex items-center justify-center"
            >
              Skip
            </button>
            {/* Next Button */}
            <button
              onClick={handleContinue}
              disabled={!canContinue || isLoading || isDetectingLocation}
              data-onboarding-cta
              className={`h-[50px] w-full rounded-xl font-semibold text-[17px] shadow-sm transition-all flex items-center justify-center ${
                canContinue && !isLoading && !isDetectingLocation
                  ? 'bg-[#007AFF] text-white active:opacity-90 active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isDetectingLocation ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                  Detecting...
                </>
              ) : isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Permission Help Modal */}
      <PermissionHelpModal
        isOpen={showPermissionHelp}
        onClose={() => setShowPermissionHelp(false)}
      />
    </div>
  );
}
