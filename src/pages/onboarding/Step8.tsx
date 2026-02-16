import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../resources/config/config';
import { useFooterVisibility } from '../../utils/useFooterVisibility';
import { getAllCountries, getStatesOfCountry, getCitiesOfState } from '../../data/locationData';

// Edge Function URL for GPS geocoding (real-time location detection)
const LOCATION_GEOCODE_API = `${config.SUPABASE_URL}/functions/v1/hushh-location-geocode`;

// Types for location data
interface Country {
  isoCode: string;
  name: string;
}

interface State {
  isoCode: string;
  name: string;
}

interface City {
  name: string;
}

// Back arrow icon
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

// Info icon for helper text
const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

// Chevron down icon for selects
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// Field validation errors type
interface FieldErrors {
  addressLine1?: string;
  country?: string;
  state?: string;
  city?: string;
  zipCode?: string;
}

function OnboardingStep8() {
  const navigate = useNavigate();
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [country, setCountry] = useState(''); // Empty initially - will be set by GPS or user selection
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const isFooterVisible = useFooterVisibility();

  // Location data
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // Refs to store pending GPS/inference values (applied when dropdowns load)
  const pendingGpsCountry = useRef<string | null>(null);
  const pendingGpsState = useRef<string | null>(null);
  const pendingGpsCity = useRef<string | null>(null);

  // Abort controllers for cleanup
  const inferenceAbortController = useRef<AbortController | null>(null);
  const gpsAbortController = useRef<AbortController | null>(null);

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load countries on mount (static list - no heavy processing)
  useEffect(() => {
    setLoadingCountries(true);
    const allCountries = getAllCountries();
    setCountries(allCountries);
    setLoadingCountries(false);
    console.log('[Step8] Countries loaded:', allCountries.length);
  }, []);

  // Load states when country changes (async API call)
  useEffect(() => {
    if (!country) {
      setStates([]);
      return;
    }

    let cancelled = false;
    const loadStates = async () => {
      setLoadingStates(true);
      try {
        // Find state name for the selected state (API needs country name)
        const statesList = await getStatesOfCountry(country);
        if (!cancelled) {
          setStates(statesList);
          console.log('[Step8] States loaded for', country, ':', statesList.length);
        }
      } catch (err) {
        console.error('Error loading states:', err);
      } finally {
        if (!cancelled) setLoadingStates(false);
      }
    };
    loadStates();
    return () => { cancelled = true; };
  }, [country]);

  // Load cities when state changes (async API call)
  useEffect(() => {
    if (!country || !state) {
      setCities([]);
      return;
    }

    let cancelled = false;
    const loadCities = async () => {
      setLoadingCities(true);
      try {
        // Find state name from the states list (API needs state name, not code)
        const stateObj = states.find(s => s.isoCode === state);
        const stateName = stateObj?.name || state;
        const citiesList = await getCitiesOfState(country, stateName);
        if (!cancelled) {
          setCities(citiesList);
          console.log('[Step8] Cities loaded for', stateName, ':', citiesList.length);
        }
      } catch (err) {
        console.error('Error loading cities:', err);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    };
    loadCities();
    return () => { cancelled = true; };
  }, [country, state, states]);

  // ============================================
  // FIX: Watch for dropdown data loading and apply pending GPS values
  // This solves the race condition where GPS data arrives before dropdowns load
  // ============================================

  // Apply pending country when countries list loads
  useEffect(() => {
    if (countries.length > 0 && pendingGpsCountry.current) {
      const countryCode = pendingGpsCountry.current;
      const countryExists = countries.some(c => c.isoCode === countryCode);
      if (countryExists) {
        console.log('[Step8] Applying pending GPS country:', countryCode);
        setCountry(countryCode);
      }
      pendingGpsCountry.current = null;
    }
  }, [countries]);

  // Apply pending state when states list loads
  useEffect(() => {
    if (states.length > 0 && pendingGpsState.current) {
      const stateCode = pendingGpsState.current;
      const stateExists = states.some(s => s.isoCode === stateCode || s.name === stateCode);
      if (stateExists) {
        // Use isoCode if it matches, otherwise use name
        const matchingState = states.find(s => s.isoCode === stateCode || s.name === stateCode);
        if (matchingState) {
          console.log('[Step8] Applying pending GPS state:', matchingState.isoCode);
          setState(matchingState.isoCode);
        }
      }
      pendingGpsState.current = null;
    }
  }, [states]);

  // Apply pending city when cities list loads
  useEffect(() => {
    if (cities.length > 0 && pendingGpsCity.current) {
      const cityName = pendingGpsCity.current;
      const cityExists = cities.some(c => c.name === cityName);
      if (cityExists) {
        console.log('[Step8] Applying pending GPS city:', cityName);
        setCity(cityName);
      }
      pendingGpsCity.current = null;
    }
  }, [cities]);

  // AI Address Inference state
  const [isInferringAddress, setIsInferringAddress] = useState(false);
  const [inferenceMessage, setInferenceMessage] = useState<string | null>(null);

  // Lightweight Address Inference API URL
  const ADDRESS_INFERENCE_API = 'https://ibsisfnjxeowvdtvgzff.supabase.co/functions/v1/hushh-address-inference';

  // Real-time GPS detection function
  const detectAndApplyGPS = useCallback(async (uid: string) => {
    if (!navigator.geolocation) {
      console.log('[Step8] Geolocation not available');
      return null;
    }

    setIsInferringAddress(true);
    setInferenceMessage('📍 Detecting your location...');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1 minute cache - fresh data
        });
      });

      const { latitude, longitude } = position.coords;
      console.log(`[Step8] Real-time GPS: ${latitude}, ${longitude}`);

      gpsAbortController.current = new AbortController();

      const response = await fetch(LOCATION_GEOCODE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ latitude, longitude }),
        signal: gpsAbortController.current.signal,
      });

      const result = await response.json();

      if (result.success && result.data) {
        const gpsData = result.data;
        console.log('[Step8] Real-time GPS data:', gpsData);

        // Update cache for consistency
        if (config.supabaseClient) {
          await config.supabaseClient
            .from('onboarding_data')
            .update({
              gps_location_data: gpsData,
              gps_detected_country: gpsData.country,
              gps_detected_state: gpsData.state,
              gps_detected_city: gpsData.city,
              gps_detected_postal_code: gpsData.postalCode,
              gps_detected_phone_dial_code: gpsData.phoneDialCode,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', uid);
        }

        setInferenceMessage(`📍 ${gpsData.city || gpsData.country}`);
        setTimeout(() => setInferenceMessage(null), 2000);

        return gpsData;
      }
      return null;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.log('[Step8] GPS detection failed:', error);
      }
      setInferenceMessage(null);
      return null;
    } finally {
      setIsInferringAddress(false);
    }
  }, []);

  // Apply GPS data to form fields (FIXED: Uses pending refs to handle race condition)
  const applyGpsDataToForm = useCallback((gpsData: {
    country?: string;
    countryCode?: string;
    state?: string;
    stateCode?: string;
    city?: string;
    postalCode?: string;
    formattedAddress?: string;
  }) => {
    console.log('[Step8] Applying GPS data to form:', gpsData);
    
    // Set postal code immediately (no dropdown dependency)
    if (gpsData.postalCode) {
      setZipCode(gpsData.postalCode);
    }
    
    // Parse formattedAddress into address lines (no dropdown dependency)
    if (gpsData.formattedAddress) {
      const fullAddress = gpsData.formattedAddress;
      const cityName = gpsData.city || '';
      const stateName = gpsData.state || '';
      const postalCode = gpsData.postalCode || '';
      const countryName = gpsData.country || '';
      
      let streetPart = fullAddress;
      
      if (countryName && streetPart.endsWith(countryName)) {
        streetPart = streetPart.slice(0, -countryName.length).replace(/,\s*$/, '');
      }
      if (postalCode) {
        streetPart = streetPart.replace(new RegExp(`\\s*${postalCode}\\s*,?`), '');
      }
      if (stateName) {
        streetPart = streetPart.replace(new RegExp(`,?\\s*${stateName}\\s*$`), '');
      }
      if (cityName) {
        streetPart = streetPart.replace(new RegExp(`,?\\s*${cityName}\\s*$`), '');
      }
      
      streetPart = streetPart.replace(/,\s*$/, '').trim();
      const parts = streetPart.split(',').map(p => p.trim()).filter(p => p);
      
      if (parts.length >= 1) {
        setAddressLine1(parts[0]);
        console.log('[Step8] GPS Address Line 1:', parts[0]);
      }
      if (parts.length >= 2) {
        setAddressLine2(parts.slice(1).join(', '));
        console.log('[Step8] GPS Address Line 2:', parts.slice(1).join(', '));
      }
    }
    
    // FIX: Store GPS values in refs for later application when dropdowns load
    // This solves the race condition where dropdowns aren't ready yet
    
    // Country: Store in ref AND try to set directly (if countries already loaded)
    if (gpsData.countryCode) {
      pendingGpsCountry.current = gpsData.countryCode;
      // Also try setting directly - if countries are already loaded, this will work
      // If not, the useEffect watching countries will apply the pending value
      setCountry(gpsData.countryCode);
    }
    
    // State: Store in ref for later application when states load
    if (gpsData.stateCode) {
      pendingGpsState.current = gpsData.stateCode;
      console.log('[Step8] Stored pending GPS state:', gpsData.stateCode);
    } else if (gpsData.state) {
      pendingGpsState.current = gpsData.state;
      console.log('[Step8] Stored pending GPS state (name):', gpsData.state);
    }
    
    // City: Store in ref for later application when cities load
    if (gpsData.city) {
      pendingGpsCity.current = gpsData.city;
      console.log('[Step8] Stored pending GPS city:', gpsData.city);
    }
  }, []);

  // Load existing data with REAL-TIME GPS detection
  useEffect(() => {
    const loadData = async () => {
      if (!config.supabaseClient) return;

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) return;

      // 1. First, check existing onboarding data (user-entered takes priority)
      const { data: onboardingData } = await config.supabaseClient
        .from('onboarding_data')
        .select('address_line_1, address_line_2, address_country, state, city, zip_code, legal_first_name, legal_last_name, residence_country')
        .eq('user_id', user.id)
        .maybeSingle();

      // If user already has address data, use it (they may have edited it)
      if (onboardingData?.address_line_1) {
        setAddressLine1(onboardingData.address_line_1 || '');
        setAddressLine2(onboardingData.address_line_2 || '');
        setCountry(onboardingData.address_country || 'US');
        setState(onboardingData.state || '');
        setCity(onboardingData.city || '');
        setZipCode(onboardingData.zip_code || '');
        return; // User has existing data, don't override
      }

      // 2. For new users: Always detect GPS in REAL-TIME (not cached data)
      console.log('[Step8] Detecting location in real-time...');
      const gpsData = await detectAndApplyGPS(user.id);
      
      if (gpsData) {
        applyGpsDataToForm(gpsData);
        return; // GPS data found, don't need AI inference
      }

      // 3. GPS failed - Check for cached enriched profile data (from previous inference)
      const { data: enrichedProfile } = await config.supabaseClient
        .from('user_enriched_profiles')
        .select('address')
        .eq('user_id', user.id)
        .maybeSingle();

      if (enrichedProfile?.address) {
        const addr = enrichedProfile.address as {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          country?: string;
          countryCode?: string;
          zipCode?: string;
        };
        console.log('[Step8] Found cached enriched profile address:', addr);
        
        // Pre-fill from enriched profile
        if (addr.line1) setAddressLine1(addr.line1);
        if (addr.line2) setAddressLine2(addr.line2);
        if (addr.countryCode) {
          setCountry(addr.countryCode);
        } else if (addr.country) {
          const countryCode = mapCountryToIsoCode(addr.country);
          setCountry(countryCode);
        }
        if (addr.state) setState(addr.state);
        if (addr.city) setCity(addr.city);
        if (addr.zipCode) setZipCode(addr.zipCode);
        return;
      }

      // 4. Fallback: Use residence_country from Step 6 if GPS data not available
      if (onboardingData?.residence_country) {
        const countryCode = mapCountryToIsoCode(onboardingData.residence_country);
        console.log('[Step8] Using residence_country as fallback:', countryCode);
        setCountry(countryCode);
      }

      // 5. No cached data - use lightweight address inference API if we have name
      if (onboardingData?.legal_first_name && onboardingData?.legal_last_name) {
        console.log('[Step8] No cached profile, calling lightweight address inference API...');
        
        const fullName = `${onboardingData.legal_first_name} ${onboardingData.legal_last_name}`;
        const userEmail = user.email || '';
        
        setIsInferringAddress(true);
        setInferenceMessage('🔍 Finding your location...');
        
        // Create abort controller for cleanup
        inferenceAbortController.current = new AbortController();
        
        try {
          const response = await fetch(ADDRESS_INFERENCE_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: fullName,
              email: userEmail,
            }),
            signal: inferenceAbortController.current.signal,
          });

          const result = await response.json();

          if (result.success && result.data) {
            console.log('[Step8] Address inference success:', result.data);
            setInferenceMessage(`✅ Found: ${result.data.address?.city || result.data.address?.country || 'Location detected'}`);
            
            const addr = result.data.address;
            
            // Cache the inferred address for future use
            await config.supabaseClient
              .from('user_enriched_profiles')
              .upsert({
                user_id: user.id,
                address: addr,
                nationality: result.data.nationality,
                confidence: result.data.confidence,
                search_query: fullName,
                sources: result.data.sources,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id'
              });

            // Pre-fill address from API result using ref-based pending pattern
            if (addr) {
              if (addr.zipCode) setZipCode(addr.zipCode);

              // Country: set directly + store in ref for safety
              if (addr.countryCode) {
                pendingGpsCountry.current = addr.countryCode;
                setCountry(addr.countryCode);
              } else if (addr.country) {
                const countryCode = mapCountryToIsoCode(addr.country);
                pendingGpsCountry.current = countryCode;
                setCountry(countryCode);
              }

              // State & City: store in refs, applied when dropdowns load
              if (addr.state) {
                pendingGpsState.current = addr.state;
                console.log('[Step8] Stored pending inference state:', addr.state);
              }
              if (addr.city) {
                pendingGpsCity.current = addr.city;
                console.log('[Step8] Stored pending inference city:', addr.city);
              }
            }
            
            // Clear message after 2 seconds
            setTimeout(() => {
              setInferenceMessage(null);
            }, 2000);
          } else {
            console.log('[Step8] Address inference returned no data');
            setInferenceMessage(null);
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            console.log('[Step8] Address inference aborted');
          } else {
            console.error('[Step8] Address inference error:', err);
          }
          setInferenceMessage(null);
          // Silently fail - user can enter manually
        } finally {
          setIsInferringAddress(false);
        }
      }
    };

    loadData();
    
    // Cleanup: abort any pending requests on unmount
    return () => {
      if (inferenceAbortController.current) {
        inferenceAbortController.current.abort();
      }
      if (gpsAbortController.current) {
        gpsAbortController.current.abort();
      }
    };
  }, []);

  // Helper function to map country names to ISO codes
  const mapCountryToIsoCode = (countryName: string): string => {
    const countryMap: Record<string, string> = {
      'United States': 'US',
      'USA': 'US',
      'US': 'US',
      'India': 'IN',
      'United Kingdom': 'GB',
      'UK': 'GB',
      'Canada': 'CA',
      'Australia': 'AU',
      'Germany': 'DE',
      'France': 'FR',
      'Japan': 'JP',
      'China': 'CN',
      'Singapore': 'SG',
      'United Arab Emirates': 'AE',
      'UAE': 'AE',
    };
    return countryMap[countryName] || countryName;
  };

  // Validation functions
  const validateAddressLine1 = (value: string): string | undefined => {
    if (!value.trim()) return 'Address is required';
    if (value.trim().length < 5) return 'Address is too short';
    if (value.trim().length > 100) return 'Address is too long';
    // Check for basic address format (should contain letters and numbers)
    if (!/[a-zA-Z]/.test(value)) return 'Please enter a valid address';
    return undefined;
  };

  const validateZipCode = (value: string): string | undefined => {
    if (!value.trim()) return 'ZIP code is required';
    // Allow 5 or 6 digit ZIP codes
    if (!/^\d{5,6}$/.test(value.trim())) return 'ZIP code must be 5 or 6 digits';
    return undefined;
  };

  const validateCountry = (value: string): string | undefined => {
    if (!value) return 'Please select a country';
    return undefined;
  };

  const validateState = (value: string): string | undefined => {
    if (!value) return 'Please select a state';
    return undefined;
  };

  const validateCity = (value: string): string | undefined => {
    if (!value) return 'Please select a city';
    return undefined;
  };

  // Handle field blur (mark as touched)
  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate the field on blur
    let error: string | undefined;
    switch (field) {
      case 'addressLine1':
        error = validateAddressLine1(addressLine1);
        break;
      case 'zipCode':
        error = validateZipCode(zipCode);
        break;
      case 'country':
        error = validateCountry(country);
        break;
      case 'state':
        error = validateState(state);
        break;
      case 'city':
        error = validateCity(city);
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  // Validate all fields
  const validateAllFields = (): boolean => {
    const errors: FieldErrors = {
      addressLine1: validateAddressLine1(addressLine1),
      country: validateCountry(country),
      state: validateState(state),
      city: validateCity(city),
      zipCode: validateZipCode(zipCode),
    };
    
    setFieldErrors(errors);
    setTouched({
      addressLine1: true,
      country: true,
      state: true,
      city: true,
      zipCode: true,
    });
    
    return !Object.values(errors).some(e => e !== undefined);
  };

  const handleContinue = async () => {
    // Validate all fields first
    if (!validateAllFields()) {
      setError('Please fix the errors above');
      return;
    }

    setLoading(true);
    setError(null);

    if (!config.supabaseClient) {
      setError('Configuration error');
      setLoading(false);
      return;
    }

    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { error: upsertError } = await config.supabaseClient
      .from('onboarding_data')
      .upsert({
        user_id: user.id,
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || null,
        address_country: country,
        state: state,
        city: city,
        zip_code: zipCode.trim(),
        current_step: 8,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      setError('Failed to save data');
      setLoading(false);
      return;
    }

    navigate('/onboarding/step-9');
  };

  const handleBack = () => {
    navigate('/onboarding/step-7');
  };

  const isValid = addressLine1.trim() && country && state && city && zipCode.trim();

  return (
    <div 
      className="bg-slate-50 min-h-screen"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="relative flex min-h-screen w-full flex-col bg-white max-w-[500px] mx-auto shadow-xl overflow-hidden border-x border-slate-100">
        
        {/* Sticky Header */}
        <header className="flex items-center px-4 pt-6 pb-4 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
          <button 
            onClick={handleBack}
            className="flex items-center gap-1 text-slate-900 hover:text-[#2b8cee] transition-colors"
          >
            <BackIcon />
            <span className="text-base font-bold tracking-tight">Back</span>
          </button>
          <div className="flex-1" />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col px-6 pb-48 overflow-y-auto">
          {/* Header Section - Center Aligned */}
          <div className="mb-8 text-center">
            <h1 className="text-slate-900 text-[22px] font-bold leading-tight tracking-tight mb-3">
              Enter your address
            </h1>
            <p className="text-slate-500 text-[14px] font-normal leading-relaxed">
              Please provide your primary residence address.
            </p>
            
            {/* AI Address Inference Status */}
            {(isInferringAddress || inferenceMessage) && (
              <div className={`mt-4 py-2 px-4 rounded-full inline-flex items-center gap-2 text-sm font-medium transition-all ${
                isInferringAddress 
                  ? 'bg-blue-50 text-blue-600 animate-pulse' 
                  : 'bg-green-50 text-green-600'
              }`}>
                {isInferringAddress ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{inferenceMessage || 'Finding your location...'}</span>
                  </>
                ) : (
                  <span>{inferenceMessage}</span>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Form Card 1: Street Address */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 mb-6 space-y-5">
            {/* Address Line 1 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900" htmlFor="address1">
                Address line 1
              </label>
              <input
                id="address1"
                type="text"
                value={addressLine1}
                onChange={(e) => {
                  setAddressLine1(e.target.value);
                  // Clear error when user starts typing
                  if (touched.addressLine1) {
                    setFieldErrors(prev => ({ ...prev, addressLine1: validateAddressLine1(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('addressLine1')}
                placeholder="Street address"
                className={`w-full h-12 px-4 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 transition-all ${
                  touched.addressLine1 && fieldErrors.addressLine1
                    ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                    : 'border-gray-200 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee]'
                }`}
              />
              {/* Error or Helper Text */}
              {touched.addressLine1 && fieldErrors.addressLine1 ? (
                <p className="text-red-500 text-xs font-normal leading-tight mt-1">
                  {fieldErrors.addressLine1}
                </p>
              ) : (
                <div className="flex items-start gap-1.5 mt-1.5">
                  <InfoIcon />
                  <p className="text-slate-400 text-xs font-normal leading-tight">
                    Use your street address, not a P.O. Box.
                  </p>
                </div>
              )}
            </div>

            {/* Address Line 2 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="block text-sm font-medium text-slate-900" htmlFor="address2">
                  Address line 2
                </label>
                <span className="text-xs text-slate-400">Optional</span>
              </div>
              <input
                id="address2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt, suite, unit, etc."
                className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] transition-all"
              />
            </div>
          </div>

          {/* Form Card 2: Region Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 space-y-5 mb-4">
            {/* Country */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900" htmlFor="country">
                Country
              </label>
              <div className="relative">
                <select
                  id="country"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setState('');
                    setCity('');
                  }}
                  className="w-full h-12 px-4 pr-10 rounded-lg border border-gray-200 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] transition-all appearance-none"
                >
                  <option value="">Select country...</option>
                  {countries.map((c) => (
                    <option key={c.isoCode} value={c.isoCode}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDownIcon />
                </div>
              </div>
            </div>

            {/* State & City Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* State */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900" htmlFor="state">
                  State
                </label>
                <div className="relative">
                  <select
                    id="state"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity('');
                    }}
                    disabled={!country || loadingStates}
                    className="w-full h-12 px-4 pr-10 rounded-lg border border-gray-200 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] transition-all appearance-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{loadingStates ? 'Loading...' : 'Select'}</option>
                    {states.map((s) => (
                      <option key={s.isoCode} value={s.isoCode}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>

              {/* City */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900" htmlFor="city">
                  City
                </label>
                <div className="relative">
                  <select
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!state || loadingCities}
                    className="w-full h-12 px-4 pr-10 rounded-lg border border-gray-200 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] transition-all appearance-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{loadingCities ? 'Loading...' : 'Select'}</option>
                    {cities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>
            </div>

            {/* ZIP Code */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900" htmlFor="zip">
                ZIP code
              </label>
              <input
                id="zip"
                type="text"
                value={zipCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setZipCode(value);
                  // Update validation on change
                  if (touched.zipCode) {
                    setFieldErrors(prev => ({ ...prev, zipCode: validateZipCode(value) }));
                  }
                }}
                onBlur={() => handleBlur('zipCode')}
                inputMode="numeric"
                placeholder="00000"
                className={`w-full h-12 px-4 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 transition-all ${
                  touched.zipCode && fieldErrors.zipCode
                    ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                    : 'border-gray-200 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee]'
                }`}
              />
              {/* Error or Helper Text */}
              {touched.zipCode && fieldErrors.zipCode ? (
                <p className="text-red-500 text-xs font-normal leading-tight mt-1">
                  {fieldErrors.zipCode}
                </p>
              ) : (
                <p className="text-slate-400 text-xs font-normal leading-tight mt-1">
                  Enter 5 or 6 digit ZIP code
                </p>
              )}
            </div>
          </div>
        </main>

        {/* Fixed Footer - Hidden when main footer is visible */}
        {!isFooterVisible && (
          <div className="fixed bottom-0 left-0 right-0 z-20 w-full max-w-[500px] mx-auto bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 flex flex-col gap-3" data-onboarding-footer>
            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={!isValid || loading}
              className={`
                flex w-full cursor-pointer items-center justify-center rounded-full h-14 px-5 text-base font-bold tracking-wide transition-all active:scale-[0.98]
                ${isValid && !loading
                  ? 'bg-[#2b8cee] hover:bg-[#2070c0] text-white shadow-lg shadow-[#2b8cee]/20'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
            
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="flex w-full cursor-pointer items-center justify-center rounded-full bg-transparent py-2 text-slate-500 text-sm font-bold hover:text-slate-800 transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingStep8;
