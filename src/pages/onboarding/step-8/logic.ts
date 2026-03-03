/**
 * Step 8 - Address Entry — Logic Hook
 *
 * All state, effects, handlers, and constants for the address entry step.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';
import { useLocationDropdowns } from '../../../hooks/useLocationDropdowns';
import { locationService } from '../../../services/location/locationService';

/* ═══════════════════════════════════════════════
   CONSTANTS & VALIDATION
   ═══════════════════════════════════════════════ */

export const DISPLAY_STEP = 7;
export const TOTAL_STEPS = 12;
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

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [zipCode, setZipCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

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

  /* ─── Auto-detect location ─── */
  const detectAndApply = async (userId?: string) => {
    setIsDetecting(true);
    setDetectionStatus('Detecting your location...');

    try {
      const result = await locationService.detectLocation();
      if (!result.data) { setDetectionStatus(null); return; }

      if (result.data.postalCode) setZipCode(result.data.postalCode);

      if (result.data.formattedAddress) {
        const parsed = locationService.parseFormattedAddress(result.data.formattedAddress, result.data);
        if (parsed.line1) setAddressLine1(parsed.line1);
        if (parsed.line2) setAddressLine2(parsed.line2);
      }

      dropdowns.applyDetectedLocation(
        result.data.countryCode,
        result.data.stateCode,
        result.data.state,
        result.data.city,
      );

      if (userId) {
        locationService.saveLocationToOnboarding(userId, result.data).catch(() => {});
      }

      setDetectionStatus(result.data.city || result.data.country || 'Location detected');
      setTimeout(() => setDetectionStatus(null), 2500);
    } catch {
      setDetectionStatus(null);
    } finally {
      setIsDetecting(false);
    }
  };

  /* ─── Init: Load saved data or detect ─── */
  useEffect(() => {
    const init = async () => {
      if (!config.supabaseClient) return;
      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) return;

      const { data: saved } = await config.supabaseClient
        .from('onboarding_data')
        .select('address_line_1, address_line_2, address_country, state, city, zip_code, residence_country')
        .eq('user_id', user.id)
        .maybeSingle();

      /* ── Path A: Full address was previously saved (return visit) ── */
      if (saved?.address_line_1) {
        setAddressLine1(saved.address_line_1);
        setAddressLine2(saved.address_line_2 || '');
        setZipCode(saved.zip_code || '');
        const code = locationService.mapCountryToIsoCode(saved.address_country || 'US');
        dropdowns.applyDetectedLocation(code, saved.state, undefined, saved.city);
        return;
      }

      /* ── Path B: First visit — collect best data from ALL sources ── */
      /* Priority: saved (Step 4) → Plaid identity → GPS detection */
      let bestCity: string | undefined = saved?.city; /* Step 4 may have saved city from Plaid */
      let bestCountryCode: string | undefined;
      let bestStateCode: string | undefined;
      let bestStateName: string | undefined;
      let localAddr1 = '';
      let localZip = '';

      /* Source 1: residence_country from Step 4 */
      if (saved?.residence_country) {
        bestCountryCode = locationService.mapCountryToIsoCode(saved.residence_country);
      }

      /* Source 2: Plaid identity address */
      try {
        const { data: finData } = await config.supabaseClient
          .from('user_financial_data')
          .select('identity_data')
          .eq('user_id', user.id)
          .maybeSingle();

        if (finData?.identity_data) {
          const accounts = finData.identity_data.accounts || [];
          const owners = accounts[0]?.owners || [];
          const owner = owners[0];
          if (owner?.addresses?.length) {
            const primaryAddr = owner.addresses.find((a: any) => a.primary) || owner.addresses[0];
            const addr = primaryAddr?.data || {};
            if (addr.city && !bestCity) bestCity = addr.city;
            if (addr.street) { setAddressLine1(addr.street); localAddr1 = addr.street; }
            if (addr.postal_code) { setZipCode(addr.postal_code); localZip = addr.postal_code; }
            console.log('[Step8] Plaid address:', { city: addr.city, street: addr.street, zip: addr.postal_code });
          }
        }
      } catch (err) {
        console.warn('[Step8] Plaid identity fetch failed:', err);
      }

      /* Source 3: GPS detection — fills address lines, zip, country/state/city */
      setIsDetecting(true);
      setDetectionStatus('Detecting your location...');
      try {
        const result = await locationService.detectLocation();
        if (result.data) {
          /* Fill address fields from GPS only if not already set */
          if (result.data.postalCode && !localZip) {
            setZipCode(result.data.postalCode);
          }
          if (result.data.formattedAddress) {
            const parsed = locationService.parseFormattedAddress(result.data.formattedAddress, result.data);
            if (parsed.line1 && !localAddr1) setAddressLine1(parsed.line1);
            if (parsed.line2) setAddressLine2(parsed.line2);
          }

          /* GPS country/state are reliable for dropdowns */
          if (result.data.countryCode) bestCountryCode = result.data.countryCode;
          if (result.data.stateCode) bestStateCode = result.data.stateCode;
          if (result.data.state) bestStateName = result.data.state;

          /* GPS city: only use if we don't have a better source */
          if (!bestCity && result.data.city) bestCity = result.data.city;

          locationService.saveLocationToOnboarding(user.id, result.data).catch(() => {});

          setDetectionStatus(result.data.city || result.data.country || 'Location detected');
          setTimeout(() => setDetectionStatus(null), 2500);
        }
      } catch {
        setDetectionStatus(null);
      } finally {
        setIsDetecting(false);
      }

      /* 4. Apply ALL collected data in ONE single call — no race conditions */
      console.log('[Step8] Final sources → city:', bestCity, 'country:', bestCountryCode, 'state:', bestStateCode || bestStateName);
      if (bestCountryCode || bestStateCode || bestCity) {
        dropdowns.applyDetectedLocation(bestCountryCode, bestStateCode, bestStateName, bestCity);
      }
    };
    init();
    return () => { locationService.cancel(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Handlers ─── */
  const handleDetectClick = async () => {
    if (!config.supabaseClient) return;
    const { data: { user } } = await config.supabaseClient.auth.getUser();
    await detectAndApply(user?.id);
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
    navigate('/onboarding/step-9');
  };

  const handleBack = () => navigate('/onboarding/step-7');

  const handleSkip = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (config.supabaseClient) {
        const { data: { user } } = await config.supabaseClient.auth.getUser();
        if (user) await upsertOnboardingData(user.id, { current_step: 8 });
      }
      navigate('/onboarding/step-9');
    } catch { navigate('/onboarding/step-9'); }
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
