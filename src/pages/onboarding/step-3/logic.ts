/**
 * Step 4 — All Business Logic
 * Country/residence detection, GPS/IP location, Supabase upsert
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { TOTAL_VISIBLE_ONBOARDING_STEPS } from '../../../services/onboarding/flow';
import { resolveOnboardingPrefill } from '../../../services/onboarding/prefill';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';
import {
  locationService,
  type LocationCacheRecord,
  type LocationData,
  COUNTRY_CODE_TO_NAME,
} from '../../../services/location';

export const CURRENT_STEP = 4;
export const TOTAL_STEPS = TOTAL_VISIBLE_ONBOARDING_STEPS;
export const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

export const countries = [
  'United States','Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin',
  'Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso',
  'Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China',
  'Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti',
  'Dominica','Dominican Republic','East Timor','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea',
  'Estonia','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece',
  'Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya',
  'Kiribati','North Korea','South Korea','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia',
  'Libya','Liechtenstein','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives',
  'Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco',
  'Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','Norway','Oman','Pakistan','Palau','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino',
  'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Spain','Sri Lanka','Sudan',
  'Suriname','Swaziland','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo',
  'Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe',
];

export type LocationStatus = 'detecting' | 'success' | 'ip-success' | 'denied' | 'failed' | 'manual' | null;

export interface Step4Logic {
  citizenshipCountry: string; residenceCountry: string;
  isLoading: boolean; isFooterVisible: boolean;
  isDetectingLocation: boolean; locationDetected: boolean;
  locationStatus: LocationStatus; detectedLocation: string;
  userConfirmedManual: boolean; showPermissionHelp: boolean;
  showLocationModal: boolean; canContinue: boolean;
  isErrorStatus: boolean; isSuccessStatus: boolean;
  shouldShowForm: boolean; canConfirmSelection: boolean;
  handleCitizenshipChange: (v: string) => void;
  handleResidenceChange: (v: string) => void;
  handleConfirmManualSelection: () => void;
  handleRetry: () => Promise<void>;
  handleAllowLocation: () => Promise<void>;
  handleDontAllow: () => void;
  handleContinue: () => Promise<void>;
  handleBack: () => void;
  handleSkip: () => void;
  setShowPermissionHelp: (v: boolean) => void;
}

export const mergeDetectedCountryIntoStep4Fields = ({
  citizenshipCountry,
  residenceCountry,
}: {
  citizenshipCountry: string;
  residenceCountry: string;
}): { citizenshipCountry: string; residenceCountry: string } => {
  return {
    citizenshipCountry,
    residenceCountry,
  };
};

export const getTrustedStep4Countries = (onboardingData: {
  citizenship_country?: string | null;
  residence_country?: string | null;
  current_step?: number | null;
} | null | undefined): {
  citizenship_country?: string;
  residence_country?: string;
} => {
  if (!onboardingData) return {};

  const currentStep =
    typeof onboardingData.current_step === 'number'
      ? onboardingData.current_step
      : Number(onboardingData.current_step || 0);

  // Ignore schema/default country values before Step 4 has actually been reached.
  if (!Number.isFinite(currentStep) || currentStep < 4) {
    return {};
  }

  return {
    citizenship_country: onboardingData.citizenship_country || undefined,
    residence_country: onboardingData.residence_country || undefined,
  };
};

export const getStep4StatusFromCacheRecord = (
  cacheRecord: LocationCacheRecord | null
): LocationStatus => {
  if (!cacheRecord) return null;
  return cacheRecord.source === 'gps' ? 'success' : 'ip-success';
};

/** Check browser geolocation permission state without triggering the prompt. */
const checkGeoPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state as 'granted' | 'denied' | 'prompt';
    }
  } catch {
    // Permissions API not supported (e.g. older Safari)
  }
  // Default to 'prompt' so we show the modal
  return 'prompt';
};

export const useStep4Logic = (): Step4Logic => {
  const navigate = useNavigate();
  const autoDetectionStartedRef = useRef(false);
  const citizenshipCountryRef = useRef('');
  const residenceCountryRef = useRef('');
  const [userId, setUserId] = useState<string | null>(null);
  const [citizenshipCountry, setCitizenshipCountry] = useState('');
  const [residenceCountry, setResidenceCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isFooterVisible = useFooterVisibility();
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(null);
  const [detectedLocation, setDetectedLocation] = useState('');
  const [userConfirmedManual, setUserConfirmedManual] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const canContinue = Boolean(citizenshipCountry && residenceCountry);
  const isErrorStatus = locationStatus === 'denied' || locationStatus === 'failed';
  const isSuccessStatus = locationStatus === 'success' || locationStatus === 'ip-success';
  const shouldShowForm = true;
  const canConfirmSelection = false;

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => { citizenshipCountryRef.current = citizenshipCountry; }, [citizenshipCountry]);
  useEffect(() => { residenceCountryRef.current = residenceCountry; }, [residenceCountry]);

  const applyDetectedLocation = (locationData: LocationData, status: LocationStatus) => {
    const countryName = COUNTRY_CODE_TO_NAME[locationData.countryCode] || locationData.country;
    const matchedCountry = countries.includes(countryName) ? countryName : '';

    // Pre-populate citizenship country from GPS if the user hasn't picked one yet
    if (!citizenshipCountryRef.current && matchedCountry) {
      citizenshipCountryRef.current = matchedCountry;
      setCitizenshipCountry(matchedCountry);
    }

    // Pre-populate residence country from GPS if the user hasn't picked one yet
    if (!residenceCountryRef.current && matchedCountry) {
      residenceCountryRef.current = matchedCountry;
      setResidenceCountry(matchedCountry);
    }

    setDetectedLocation(
      locationData.formattedAddress ||
      locationData.city ||
      locationData.state ||
      countryName
    );
    setLocationDetected(true);
    setLocationStatus(status);
  };

  const refreshLocation = async (uid: string) => {
    setIsDetectingLocation(true);
    setLocationStatus('detecting');

    try {
      const result = await locationService.refreshStep4Location(uid);

      if (result.fresh) {
        applyDetectedLocation(
          result.fresh.data,
          result.fresh.source === 'gps' ? 'success' : 'ip-success'
        );
        return;
      }

      if (result.cached) {
        applyDetectedLocation(result.cached.data, getStep4StatusFromCacheRecord(result.cached));
        return;
      }

      setLocationStatus('failed');
    } catch (error) {
      console.error('[Step4] Location refresh error:', error);
      const cachedRecord = await locationService.readSharedLocationCache(uid);
      if (cachedRecord) {
        applyDetectedLocation(cachedRecord.data, getStep4StatusFromCacheRecord(cachedRecord));
      } else {
        setLocationStatus('failed');
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;
      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);

      const [onboardingResult, sharedCache] = await Promise.all([
        config.supabaseClient
          .from('onboarding_data')
          .select('citizenship_country, residence_country, current_step')
          .eq('user_id', user.id)
          .maybeSingle(),
        locationService.readSharedLocationCache(user.id),
      ]);
      const cachedLocation = sharedCache?.data || await locationService.getCachedLocation(user.id);

      const onboardingData = onboardingResult.data || null;
      const trustedCountries = getTrustedStep4Countries(onboardingData);
      const resolved = resolveOnboardingPrefill({
        onboardingData: trustedCountries,
        locationData: cachedLocation || undefined,
      });

      if (resolved.values.citizenship_country) {
        citizenshipCountryRef.current = resolved.values.citizenship_country;
        setCitizenshipCountry(resolved.values.citizenship_country);
      }
      if (resolved.values.residence_country) {
        residenceCountryRef.current = resolved.values.residence_country;
        setResidenceCountry(resolved.values.residence_country);
      }

      // Fallback: if prefill didn't set countries but we have cached GPS data, extract country
      if (cachedLocation) {
        const cachedCountryName =
          COUNTRY_CODE_TO_NAME[cachedLocation.countryCode] || cachedLocation.country;
        const matchedCached = countries.includes(cachedCountryName) ? cachedCountryName : '';

        if (!citizenshipCountryRef.current && matchedCached) {
          citizenshipCountryRef.current = matchedCached;
          setCitizenshipCountry(matchedCached);
        }
        if (!residenceCountryRef.current && matchedCached) {
          residenceCountryRef.current = matchedCached;
          setResidenceCountry(matchedCached);
        }

        setDetectedLocation(
          cachedLocation.formattedAddress ||
          cachedLocation.city ||
          cachedLocation.state ||
          cachedLocation.country
        );
        setLocationDetected(true);
        setLocationStatus(getStep4StatusFromCacheRecord(sharedCache) || 'ip-success');
      }

      // Check geolocation permission before auto-detecting
      if (!autoDetectionStartedRef.current) {
        autoDetectionStartedRef.current = true;

        // If we already have cached location data, just refresh silently
        if (cachedLocation) {
          void refreshLocation(user.id);
        } else {
          // No cached data — check if browser permission is already granted
          const permState = await checkGeoPermission();
          if (permState === 'granted') {
            // Permission already granted, detect silently
            void refreshLocation(user.id);
          } else {
            // Permission not yet granted ('prompt') or denied — show our modal
            setShowLocationModal(true);
          }
        }
      }
    };
    getCurrentUser();
    return () => { locationService.cancel(); };
  }, [navigate]);

  const handleCitizenshipChange = (value: string) => {
    citizenshipCountryRef.current = value;
    setCitizenshipCountry(value);
    setUserConfirmedManual(true);
    setLocationStatus('manual');
  };

  const handleResidenceChange = (value: string) => {
    residenceCountryRef.current = value;
    setResidenceCountry(value);
    setUserConfirmedManual(true);
    setLocationStatus('manual');
  };

  const handleConfirmManualSelection = () => {
    if (citizenshipCountry && residenceCountry) { setUserConfirmedManual(true); setLocationStatus('manual'); }
  };

  const handleRetry = async () => {
    setUserConfirmedManual(false);
    if (userId) await refreshLocation(userId);
  };

  const handleAllowLocation = async () => { if (!userId) return; setShowLocationModal(false); await refreshLocation(userId); };
  const handleDontAllow = () => { setShowLocationModal(false); setLocationStatus('manual'); };

  const handleContinue = async () => {
    if (!userId || !config.supabaseClient || !canContinue) return;
    setIsLoading(true);
    try {
      await upsertOnboardingData(userId, { citizenship_country: citizenshipCountry, residence_country: residenceCountry, current_step: 4 });
      navigate('/onboarding/step-4');
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  };

  const handleBack = () => navigate('/onboarding/step-2');
  const handleSkip = () => navigate('/onboarding/step-4');

  return {
    citizenshipCountry, residenceCountry, isLoading, isFooterVisible,
    isDetectingLocation, locationDetected, locationStatus, detectedLocation,
    userConfirmedManual, showPermissionHelp, showLocationModal, canContinue,
    isErrorStatus, isSuccessStatus, shouldShowForm, canConfirmSelection,
    handleCitizenshipChange, handleResidenceChange, handleConfirmManualSelection,
    handleRetry, handleAllowLocation, handleDontAllow, handleContinue,
    handleBack, handleSkip, setShowPermissionHelp,
  };
};
