/**
 * Step 8 - Address Entry — Logic Hook
 *
 * All state, effects, handlers, and constants for the address entry step.
 *
 * GPS Auto-Fill Flow:
 * 1. On load, check for cached GPS data → parse address → fill all fields
 * 2. Trigger cascading dropdowns (country → state → city) with loading UX
 * 3. While dropdowns load, country/state are locked (isAutoFilling = true)
 * 4. Once all dropdowns resolve, unlock and show "Address auto-filled"
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { getOnboardingDisplayMeta } from '../../../services/onboarding/flow';
import { resolveOnboardingPrefill } from '../../../services/onboarding/prefill';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';
import { useLocationDropdowns } from '../../../hooks/useLocationDropdowns';
import { locationService } from '../../../services/location/locationService';

/* ═══════════════════════════════════════════════
   CONSTANTS & VALIDATION
   ═══════════════════════════════════════════════ */

const DISPLAY_META = getOnboardingDisplayMeta('/onboarding/step-6');

export const DISPLAY_STEP = DISPLAY_META.displayStep;
export const TOTAL_STEPS = DISPLAY_META.totalSteps;
export const PROGRESS_PCT = Math.round((DISPLAY_STEP / TOTAL_STEPS) * 100);

export const validateAddress = (v: string) => {
  if (!v.trim()) return 'Address is required';
  if (v.trim().length < 5) return 'Address is too short';
  if (v.trim().length > 100) return 'Address is too long';
  if (!/[a-zA-Z]/.test(v)) return 'Please enter a valid address';
  return undefined;
};

export const validateRequired = (v: string, label: string) =>
  !v ? `Please select a ${label}` : undefined;

export const validateZip = (v: string) => {
  if (!v.trim()) return 'ZIP / postal code is required';
  if (v.trim().length < 3 || v.trim().length > 10) return 'Enter a valid postal code';
  return undefined;
};

/* ═══════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════ */

export function useStep8Logic() {
  const navigate = useNavigate();
  const isFooterVisible = useFooterVisibility();
  const dropdowns = useLocationDropdowns();
  const autoDetectionStartedRef = useRef(false);

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [zipCode, setZipCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // GPS auto-fill: true while cascading dropdowns are still resolving
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  // Tracks whether we triggered a GPS-based cascade that needs monitoring
  const autoFillCascadeRef = useRef(false);

  /* ─── Enable page-level scrolling ─── */
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.classList.add('onboarding-page-scroll');
    document.body.classList.add('onboarding-page-scroll');
    return () => {
      document.documentElement.classList.remove('onboarding-page-scroll');
      document.body.classList.remove('onboarding-page-scroll');
    };
  }, []);

  /* ─── Monitor cascade completion to clear isAutoFilling ─── */
  useEffect(() => {
    if (!autoFillCascadeRef.current) return;

    // Cascade is done when states and cities have finished loading
    // AND we have resolved values for country, state, and city
    const cascadeDone =
      !dropdowns.loadingStates &&
      !dropdowns.loadingCities &&
      dropdowns.country &&
      dropdowns.state &&
      dropdowns.city;

    if (cascadeDone) {
      autoFillCascadeRef.current = false;
      setIsAutoFilling(false);
      setDetectionStatus('Address auto-filled from GPS');
      setTimeout(() => setDetectionStatus(null), 3000);
    }
  }, [
    dropdowns.loadingStates,
    dropdowns.loadingCities,
    dropdowns.country,
    dropdowns.state,
    dropdowns.city,
  ]);

  /* ─── Auto-detect location ─── */
  const detectAndApply = async (userId?: string, overwrite = true) => {
    setIsDetecting(true);
    setIsAutoFilling(true);
    autoFillCascadeRef.current = true;
    setDetectionStatus('Auto-filling address from GPS...');

    try {
      const result = await locationService.detectLocation();
      if (!result.data) {
        setDetectionStatus(null);
        setIsAutoFilling(false);
        autoFillCascadeRef.current = false;
        return;
      }

      // Fill postal code
      if (result.data.postalCode && (overwrite || !zipCode)) {
        setZipCode(result.data.postalCode);
      }

      // Parse formatted address — combine line1 + line2 into a single Address Line 1
      if (result.data.formattedAddress) {
        const parsed = locationService.parseFormattedAddress(result.data.formattedAddress, result.data);
        const combined = [parsed.line1, parsed.line2].filter(Boolean).join(', ');
        if (combined && (overwrite || !addressLine1)) setAddressLine1(combined);
      }

      // Trigger cascading dropdowns (country → state → city)
      if (
        overwrite ||
        !dropdowns.country ||
        !dropdowns.state ||
        !dropdowns.city
      ) {
        dropdowns.applyDetectedLocation(
          result.data.countryCode,
          result.data.stateCode,
          result.data.state,
          result.data.city,
        );
      }

      // Save to DB in background
      if (userId) {
        locationService
          .saveLocationToOnboarding(
            userId,
            result.data,
            result.source === 'detected' ? 'gps' : 'ip'
          )
          .catch(() => {});
      }

      setDetectionStatus('Auto-filling address from GPS...');
    } catch {
      setDetectionStatus(null);
      setIsAutoFilling(false);
      autoFillCascadeRef.current = false;
    } finally {
      setIsDetecting(false);
    }
  };

  /* ─── Init: Load saved data or prefill from known sources ─── */
  useEffect(() => {
    const init = async () => {
      if (!config.supabaseClient) return;
      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) return;

      const [onboardingResult, financialResult, enrichedResult, cachedLocation] = await Promise.all([
        config.supabaseClient
          .from('onboarding_data')
          .select(`
            address_line_1, address_line_2, address_country, state, city, zip_code, residence_country
          `)
          .eq('user_id', user.id)
          .maybeSingle(),
        config.supabaseClient
          .from('user_financial_data')
          .select('identity_data')
          .eq('user_id', user.id)
          .maybeSingle(),
        config.supabaseClient
          .from('user_enriched_profiles')
          .select('enriched_address_line1, enriched_address_city, enriched_address_state, enriched_address_zip, enriched_address_country')
          .eq('user_id', user.id)
          .maybeSingle(),
        locationService.getCachedLocation(user.id),
      ]);

      const enrichedProfile = enrichedResult.data
        ? {
            address_line_1: enrichedResult.data.enriched_address_line1 || '',
            city: enrichedResult.data.enriched_address_city || '',
            state: enrichedResult.data.enriched_address_state || '',
            zip_code: enrichedResult.data.enriched_address_zip || '',
            address_country: enrichedResult.data.enriched_address_country || '',
          }
        : undefined;

      const resolved = resolveOnboardingPrefill({
        onboardingData: onboardingResult.data || undefined,
        plaidIdentity: financialResult.data?.identity_data,
        enrichedProfile,
        locationData: cachedLocation || undefined,
      });

      // Apply resolved values from saved data / enriched profile
      if (resolved.values.address_line_1) setAddressLine1(resolved.values.address_line_1);
      if (resolved.values.address_line_2) setAddressLine2(resolved.values.address_line_2);
      if (resolved.values.zip_code) setZipCode(resolved.values.zip_code);

      // ─── GPS auto-fill: parse cached address into fields ───
      // If we have cached GPS data but no saved address_line_1,
      // parse the formatted address into line1 and line2.
      if (cachedLocation && !resolved.values.address_line_1) {
        if (cachedLocation.formattedAddress) {
          const parsed = locationService.parseFormattedAddress(
            cachedLocation.formattedAddress,
            cachedLocation
          );
          // Combine line1 + line2 into a single Address Line 1
          const combined = [parsed.line1, parsed.line2].filter(Boolean).join(', ');
          if (combined) setAddressLine1(combined);
        }
        // Also fill ZIP from GPS if not already set
        if (cachedLocation.postalCode && !resolved.values.zip_code) {
          setZipCode(cachedLocation.postalCode);
        }
      }

      // Resolve country code for cascading dropdowns
      const resolvedCountry =
        resolved.values.address_country ||
        resolved.values.residence_country ||
        cachedLocation?.country ||
        'US';
      const countryCode = locationService.mapCountryToIsoCode(resolvedCountry);

      // Determine state/city values for cascade
      const stateValue = resolved.values.state || cachedLocation?.stateCode || cachedLocation?.state || '';
      const cityValue = resolved.values.city || cachedLocation?.city || '';

      if (countryCode || stateValue || cityValue) {
        // Show auto-filling UX while cascade loads
        setIsAutoFilling(true);
        autoFillCascadeRef.current = true;
        setDetectionStatus('Auto-filling address from GPS...');

        dropdowns.applyDetectedLocation(
          countryCode,
          stateValue,
          stateValue,
          cityValue
        );
      }

      // If cached location exists, show the detection status
      if (cachedLocation && !resolved.values.address_line_1) {
        setDetectionStatus('Auto-filling address from GPS...');
      }

      const hasCompleteKnownAddress = Boolean(
        (resolved.values.address_line_1 || cachedLocation?.formattedAddress) &&
        (resolved.values.city || cachedLocation?.city) &&
        (resolved.values.state || cachedLocation?.state) &&
        (resolved.values.zip_code || cachedLocation?.postalCode)
      );

      // Only run fresh GPS detection if no known address at all
      if (!hasCompleteKnownAddress && !autoDetectionStartedRef.current) {
        autoDetectionStartedRef.current = true;
        void detectAndApply(user.id, false);
      }
    };
    init();
    return () => { locationService.cancel(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Safety timeout: clear isAutoFilling after 10s to avoid stuck state ─── */
  useEffect(() => {
    if (!isAutoFilling) return;
    const timer = setTimeout(() => {
      if (isAutoFilling) {
        setIsAutoFilling(false);
        autoFillCascadeRef.current = false;
        // If we have some data, show success
        if (dropdowns.country) {
          setDetectionStatus('Address fields populated');
          setTimeout(() => setDetectionStatus(null), 2500);
        } else {
          setDetectionStatus(null);
        }
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [isAutoFilling, dropdowns.country]);

  /* ─── Handlers ─── */
  const handleDetectClick = async () => {
    if (!config.supabaseClient) return;
    const { data: { user } } = await config.supabaseClient.auth.getUser();
    await detectAndApply(user?.id, true);
  };

  const validate = (field: string, value: string) => {
    switch (field) {
      case 'addressLine1': return validateAddress(value);
      case 'country': return validateRequired(value, 'country');
      case 'state': return validateRequired(value, 'state');
      case 'city': return validateRequired(value, 'city');
      case 'zipCode': return validateZip(value);
      default: return undefined;
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setErrors((p) => ({ ...p, [field]: validate(field, value) }));
  };

  const validateAll = () => {
    const next = {
      addressLine1: validateAddress(addressLine1),
      country: validateRequired(dropdowns.country, 'country'),
      state: validateRequired(dropdowns.state, 'state'),
      city: validateRequired(dropdowns.city, 'city'),
      zipCode: validateZip(zipCode),
    };
    setErrors(next);
    setTouched({ addressLine1: true, country: true, state: true, city: true, zipCode: true });
    return !Object.values(next).some(Boolean);
  };

  const handleContinue = async () => {
    if (!validateAll()) { setError('Please fix the errors above'); return; }
    setLoading(true);
    setError(null);

    if (!config.supabaseClient) { setLoading(false); return; }
    const { data: { user } } = await config.supabaseClient.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }

    const { error: saveError } = await upsertOnboardingData(user.id, {
      address_line_1: addressLine1.trim(),
      address_line_2: addressLine2.trim() || null,
      address_country: dropdowns.country,
      state: dropdowns.state,
      city: dropdowns.city,
      zip_code: zipCode.trim(),
      current_step: 8,
    });

    if (saveError) { setError('Failed to save. Please try again.'); setLoading(false); return; }
    navigate('/onboarding/step-7');
  };

  const handleBack = () => navigate('/onboarding/step-5');

  const handleSkip = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (config.supabaseClient) {
        const { data: { user } } = await config.supabaseClient.auth.getUser();
        if (user) await upsertOnboardingData(user.id, { current_step: 8 });
      }
      navigate('/onboarding/step-7');
    } catch { navigate('/onboarding/step-7'); }
    finally { setLoading(false); }
  };

  const handleAddressLine1Change = (value: string) => {
    setAddressLine1(value);
    if (touched.addressLine1) setErrors((p) => ({ ...p, addressLine1: validateAddress(value) }));
  };

  const handleZipCodeChange = (value: string) => {
    const next = value.slice(0, 10);
    setZipCode(next);
    if (touched.zipCode) setErrors((p) => ({ ...p, zipCode: validateZip(next) }));
  };

  const isValid = !!(addressLine1.trim() && dropdowns.country && dropdowns.state && dropdowns.city && zipCode.trim());

  return {
    // State
    addressLine1,
    addressLine2,
    setAddressLine2,
    zipCode,
    loading,
    isDetecting,
    isAutoFilling,
    detectionStatus,
    error,
    touched,
    errors,
    isValid,
    isFooterVisible,
    dropdowns,

    // Handlers
    handleBack,
    handleSkip,
    handleContinue,
    handleDetectClick,
    handleBlur,
    handleAddressLine1Change,
    handleZipCodeChange,
  };
}
