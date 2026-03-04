/**
 * Location Service
 * Handles GPS-based and IP-based location detection.
 * Uses Permissions API to check geolocation state before requesting.
 * Falls back to IP geolocation when GPS is unavailable.
 */

import config from '../../resources/config/config';
import {
  LocationData,
  Country,
  State,
  City,
  GeocodeApiResponse,
  LocationsApiResponse,
  LocationDetectionResult,
  Coordinates,
  GeoPermissionState,
  COUNTRY_CODE_TO_NAME,
  COUNTRY_NAME_TO_CODE,
} from './types';

// localStorage keys for permission + location caching
const LS_LOCATION_GRANTED = 'hushh_location_granted';
const LS_LOCATION_CACHE = 'hushh_location_cache';
const LS_LOCATION_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// API Endpoints
const LOCATIONS_API = `${config.SUPABASE_URL}/functions/v1/get-locations`;
const GEOCODE_API = `${config.SUPABASE_URL}/functions/v1/hushh-location-geocode`;

// IP Geolocation fallback (free, no API key needed)
// NOTE: ipapi.co is frequently blocked (403) in many environments. Use ipwho.is instead.
const IP_GEO_API_PRIMARY = 'https://ipwho.is/';
const IP_GEO_API_BACKUP = 'https://ipwhois.app/json/';

// Reverse geocoding fallbacks (no API key required)
// NOTE: The official OSM Nominatim instance does not send permissive CORS headers, so browser fetch() is blocked.
// Use a CORS-enabled public Nominatim instance as the client-side fallback.
const NOMINATIM_REVERSE_API = 'https://nominatim.terrestris.de/reverse';
const BIGDATA_REVERSE_API = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

// Country code to phone dial code mapping (used when provider doesn't return calling code)
const COUNTRY_DIAL_CODES: Record<string, string> = {
  'US': '+1',
  'CA': '+1',
  'GB': '+44',
  'UK': '+44',
  'IN': '+91',
  'CN': '+86',
  'JP': '+81',
  'AU': '+61',
  'DE': '+49',
  'FR': '+33',
  'IT': '+39',
  'ES': '+34',
  'BR': '+55',
  'MX': '+52',
  'RU': '+7',
  'KR': '+82',
  'SA': '+966',
  'AE': '+971',
  'SG': '+65',
  'HK': '+852',
  'NZ': '+64',
  'ZA': '+27',
  'EG': '+20',
  'NG': '+234',
  'PK': '+92',
  'BD': '+880',
  'ID': '+62',
  'MY': '+60',
  'TH': '+66',
  'VN': '+84',
  'PH': '+63',
  'TR': '+90',
  'PL': '+48',
  'NL': '+31',
  'BE': '+32',
  'SE': '+46',
  'NO': '+47',
  'DK': '+45',
  'FI': '+358',
  'CH': '+41',
  'AT': '+43',
  'PT': '+351',
  'GR': '+30',
  'IE': '+353',
  'IL': '+972',
  'AR': '+54',
  'CL': '+56',
  'CO': '+57',
  'PE': '+51',
  'VE': '+58',
};

/**
 * LocationService - Centralized service for all location-related API calls.
 * Supports GPS detection with browser permission popup + IP-based fallback.
 */
export class LocationService {
  private abortController: AbortController | null = null;

  private getDeviceTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private normalizeDialCode(raw: unknown): string {
    const str = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
    const digits = str.replace(/[^\d]/g, '');
    return digits ? `+${digits}` : '';
  }

  private getDialCodeForCountry(countryCode: string): string {
    const code = (countryCode || '').toUpperCase();
    return COUNTRY_DIAL_CODES[code] || '+1';
  }

  private parseIsoSubdivisionCode(value: unknown): string {
    const str = typeof value === 'string' ? value.trim() : '';
    if (!str) return '';
    const last = str.includes('-') ? str.split('-').pop() : str;
    return (last || '').toUpperCase();
  }

  /** Cancel any pending requests */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check current geolocation permission state.
   * Returns: 'granted' | 'denied' | 'prompt' | 'unavailable'
   */
  async checkPermissionState(): Promise<GeoPermissionState> {
    // Check if geolocation API exists at all
    if (!navigator.geolocation) {
      console.log('[LocationService] navigator.geolocation not available');
      return 'unavailable';
    }

    // Use Permissions API if available (Chrome, Edge, Firefox)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        console.log('[LocationService] Permission state:', result.state);
        return result.state as GeoPermissionState;
      } catch (err) {
        // Permissions API not supported for geolocation (Safari, some WebViews)
        console.log('[LocationService] Permissions API not supported, will try direct request');
        return 'prompt'; // Assume we can prompt
      }
    }

    // No Permissions API (Safari, Capacitor WebView)
    // Return 'prompt' to try the direct getCurrentPosition call
    console.log('[LocationService] No Permissions API, assuming prompt available');
    return 'prompt';
  }

  /**
   * Get current GPS coordinates from browser.
   * This triggers the browser's native permission popup.
   */
  async getGpsCoordinates(options?: PositionOptions): Promise<Coordinates> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not available');
    }

    const getCurrentPosition = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });

    const mapGeoError = (error: GeolocationPositionError) => {
      console.error('[LocationService] GPS error:', error.code, error.message);
      if (error.code === 1) return new Error('Location permission denied');
      if (error.code === 2) return new Error('Location unavailable');
      if (error.code === 3) return new Error('Location timeout');
      return new Error(`GPS error: ${error.message}`);
    };

    const lowAccuracyOpts: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 60000,
      ...options,
    };

    const highAccuracyOpts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    };

    try {
      console.log('[LocationService] Trying GPS (low accuracy)...');
      const pos = await getCurrentPosition(lowAccuracyOpts);
      const accuracy = pos.coords.accuracy;
      console.log('[LocationService] GPS success (low):', pos.coords.latitude, pos.coords.longitude, 'acc:', accuracy);

      // If low-accuracy result is too coarse, try high accuracy once.
      if (typeof accuracy === 'number' && accuracy > 2000) {
        console.log('[LocationService] GPS accuracy too coarse, trying high accuracy...');
        const pos2 = await getCurrentPosition(highAccuracyOpts);
        console.log('[LocationService] GPS success (high):', pos2.coords.latitude, pos2.coords.longitude, 'acc:', pos2.coords.accuracy);
        return { latitude: pos2.coords.latitude, longitude: pos2.coords.longitude };
      }

      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      // Permission denied: don't retry.
      if (geoErr && typeof geoErr.code === 'number' && geoErr.code === 1) {
        throw mapGeoError(geoErr);
      }

      console.warn('[LocationService] Low-accuracy GPS failed, trying high accuracy...', err);
      try {
        const pos2 = await getCurrentPosition(highAccuracyOpts);
        console.log('[LocationService] GPS success (high after retry):', pos2.coords.latitude, pos2.coords.longitude, 'acc:', pos2.coords.accuracy);
        return { latitude: pos2.coords.latitude, longitude: pos2.coords.longitude };
      } catch (err2) {
        throw mapGeoError(err2 as GeolocationPositionError);
      }
    }
  }

  /**
   * Get location from IP address (fallback method).
   * Works everywhere - no permissions needed.
   */
  async getLocationByIp(): Promise<LocationData> {
    console.log('[LocationService] Trying IP-based geolocation...');

    const tryProvider = async (url: string, parser: (data: any) => LocationData): Promise<LocationData> => {
      this.abortController = new AbortController();
      const response = await fetch(url, {
        signal: this.abortController.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`IP geolocation failed: ${response.status}`);
      }

      const data = await response.json();
      return parser(data);
    };

    const parseIpwhoIs = (data: any): LocationData => {
      if (data?.success === false) {
        throw new Error(data?.message || 'IP geolocation failed');
      }

      const countryCode = (data?.country_code || '').toString().toUpperCase();
      const phoneDialCode =
        this.normalizeDialCode(data?.calling_code) || this.getDialCodeForCountry(countryCode);

      return {
        country: data?.country || '',
        countryCode,
        state: data?.region || '',
        stateCode: (data?.region_code || '').toString().toUpperCase(),
        city: data?.city || '',
        postalCode: data?.postal || '',
        phoneDialCode,
        timezone: data?.timezone?.id || this.getDeviceTimezone(),
        formattedAddress: [data?.city, data?.region, data?.country].filter(Boolean).join(', '),
        latitude: typeof data?.latitude === 'number' ? data.latitude : Number(data?.latitude) || 0,
        longitude: typeof data?.longitude === 'number' ? data.longitude : Number(data?.longitude) || 0,
      };
    };

    const parseIpwhoisApp = (data: any): LocationData => {
      const countryCode = (data?.country_code || '').toString().toUpperCase();
      const phoneDialCode = this.getDialCodeForCountry(countryCode);
      return {
        country: data?.country || '',
        countryCode,
        state: data?.region || data?.state || '',
        stateCode: (data?.region_code || '').toString().toUpperCase(),
        city: data?.city || '',
        postalCode: data?.postal || '',
        phoneDialCode,
        timezone: data?.timezone || this.getDeviceTimezone(),
        formattedAddress: [data?.city, data?.region, data?.country].filter(Boolean).join(', '),
        latitude: typeof data?.latitude === 'number' ? data.latitude : Number(data?.latitude) || 0,
        longitude: typeof data?.longitude === 'number' ? data.longitude : Number(data?.longitude) || 0,
      };
    };

    try {
      const loc = await tryProvider(IP_GEO_API_PRIMARY, parseIpwhoIs);
      console.log('[LocationService] IP geolocation result (primary):', loc);
      return loc;
    } catch (err) {
      console.warn('[LocationService] Primary IP provider failed, trying backup...', err);
      const loc = await tryProvider(IP_GEO_API_BACKUP, parseIpwhoisApp);
      console.log('[LocationService] IP geolocation result (backup):', loc);
      return loc;
    }
  }

  /**
   * Call geocode API to convert GPS coordinates to address.
   * Uses Google Geocoding API via Supabase Edge Function.
   */
  async geocodeCoordinates(coords: Coordinates): Promise<LocationData> {
    const providers: Array<{ name: string; run: () => Promise<LocationData> }> = [
      {
        name: 'supabase-geocode',
        run: async () => {
          this.abortController = new AbortController();
          const response = await fetch(GEOCODE_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(coords),
            signal: this.abortController.signal,
          });

          const result: GeocodeApiResponse = await response.json();
          if (!result.success || !result.data) {
            throw new Error(result.error || 'Geocoding failed');
          }
          return result.data;
        },
      },
      {
        name: 'nominatim',
        run: async () => {
          this.abortController = new AbortController();
          const url = `${NOMINATIM_REVERSE_API}?format=jsonv2&lat=${encodeURIComponent(
            coords.latitude
          )}&lon=${encodeURIComponent(coords.longitude)}&addressdetails=1`;
          const response = await fetch(url, {
            signal: this.abortController.signal,
            headers: {
              'Accept': 'application/json',
              'Accept-Language': 'en',
            },
          });
          if (!response.ok) {
            throw new Error(`Nominatim geocoding failed: ${response.status}`);
          }
          const json = (await response.json()) as any;
          const addr = json?.address || {};

          const countryCode = (addr?.country_code || '').toString().toUpperCase();
          const stateIso =
            addr?.['ISO3166-2-lvl4'] ||
            addr?.['ISO3166-2-lvl6'] ||
            addr?.['ISO3166-2-lvl3'] ||
            addr?.['ISO3166-2-lvl5'] ||
            '';

          const stateCode = this.parseIsoSubdivisionCode(stateIso || addr?.state_code || '');
          /* Primary city: prefer actual city/town over sub-localities.
             Also include state_district as pipe-separated fallback
             so dropdown matching can try "Mahalunge|Pune" */
          const primaryCity =
            addr?.city ||
            addr?.town ||
            '';
          const subCity =
            addr?.village ||
            addr?.hamlet ||
            addr?.suburb ||
            addr?.county ||
            '';
          const district = addr?.state_district || '';

          /* Build pipe-separated candidates for dropdown matching:
             e.g. "Pune" or "Mahalunge|Pune" */
          const city = primaryCity
            || (subCity && district && subCity !== district ? `${subCity}|${district}` : '')
            || subCity
            || district
            || '';

          const countryNameFromCode = countryCode ? this.mapIsoCodeToCountry(countryCode) : '';

          return {
            country: addr?.country || countryNameFromCode || '',
            countryCode,
            state: addr?.state || addr?.region || '',
            stateCode,
            city,
            postalCode: addr?.postcode || '',
            phoneDialCode: this.getDialCodeForCountry(countryCode),
            timezone: this.getDeviceTimezone(),
            formattedAddress: json?.display_name || '',
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        },
      },
      {
        name: 'bigdatacloud',
        run: async () => {
          this.abortController = new AbortController();
          const url = `${BIGDATA_REVERSE_API}?latitude=${encodeURIComponent(
            coords.latitude
          )}&longitude=${encodeURIComponent(coords.longitude)}&localityLanguage=en`;
          const response = await fetch(url, {
            signal: this.abortController.signal,
            headers: { 'Accept': 'application/json' },
          });
          if (!response.ok) {
            throw new Error(`BigDataCloud geocoding failed: ${response.status}`);
          }
          const json = (await response.json()) as any;

          const countryCode = (json?.countryCode || '').toString().toUpperCase();
          const state = json?.principalSubdivision || '';
          const stateCode = this.parseIsoSubdivisionCode(json?.principalSubdivisionCode || '');
          const city = json?.city || json?.locality || '';
          const postalCode = json?.postcode || '';

          return {
            country: json?.countryName || '',
            countryCode,
            state,
            stateCode,
            city,
            postalCode,
            phoneDialCode: this.getDialCodeForCountry(countryCode),
            timezone: this.getDeviceTimezone(),
            formattedAddress: [city, state, json?.countryName].filter(Boolean).join(', '),
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        },
      },
    ];

    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        const data = await provider.run();
        console.log('[LocationService] Geocode success via', provider.name);
        return data;
      } catch (err) {
        lastError = err;
        console.warn('[LocationService] Geocode provider failed:', provider.name, err);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Geocoding failed');
  }

  /**
   * Main location detection method.
   * Flow:
   * 1. Check permission state
   * 2. If GPS available → request GPS → geocode → return
   * 3. If GPS denied/unavailable → fall back to IP geolocation
   */
  /** Save location result to localStorage cache (15 min TTL) */
  private cacheLocationToStorage(data: LocationData): void {
    try {
      const payload = { data, ts: Date.now() };
      localStorage.setItem(LS_LOCATION_CACHE, JSON.stringify(payload));
      localStorage.setItem(LS_LOCATION_GRANTED, 'true');
      console.log('[LocationService] Cached location to localStorage');
    } catch { /* localStorage may be unavailable in private mode */ }
  }

  /** Read cached location from localStorage if still fresh */
  getCachedLocationFromStorage(): LocationData | null {
    try {
      const raw = localStorage.getItem(LS_LOCATION_CACHE);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > LS_LOCATION_CACHE_TTL) {
        localStorage.removeItem(LS_LOCATION_CACHE);
        return null;
      }
      return data as LocationData;
    } catch { return null; }
  }

  /** Check if user previously granted location permission */
  wasLocationGranted(): boolean {
    try { return localStorage.getItem(LS_LOCATION_GRANTED) === 'true'; } catch { return false; }
  }

  async detectLocation(): Promise<LocationDetectionResult> {
    try {
      // Step 0: Check localStorage cache (avoids re-detecting within 15 min)
      const cached = this.getCachedLocationFromStorage();
      if (cached) {
        console.log('[LocationService] Returning cached location from localStorage');
        return { source: 'detected', data: cached };
      }

      // Step 1: Check geolocation permission state
      const permState = await this.checkPermissionState();
      const previouslyGranted = this.wasLocationGranted();
      console.log('[LocationService] Permission state:', permState, 'previouslyGranted:', previouslyGranted);

      // Step 2: If GPS is available, try it first
      if (permState !== 'unavailable' && permState !== 'denied') {
        try {
          // This triggers the browser's native permission popup
          const coords = await this.getGpsCoordinates();
          console.log(`[LocationService] GPS coordinates: ${coords.latitude}, ${coords.longitude}`);

          // Geocode coordinates to address via Google API
          const locationData = await this.geocodeCoordinates(coords);
          console.log('[LocationService] GPS location detected:', locationData);

          // Cache to localStorage for next 15 min
          this.cacheLocationToStorage(locationData);

          return {
            source: 'detected',
            data: locationData,
          };
        } catch (gpsError) {
          const message = (gpsError as Error).message;
          console.warn('[LocationService] GPS failed:', message);

          // If user denied permission, don't fall back — respect their choice
          if (message === 'Location permission denied') {
            console.log('[LocationService] User denied GPS. Trying IP fallback...');
            // Fall through to IP fallback below
          }
          // For timeout/unavailable errors, fall through to IP fallback
        }
      }

      // Step 3: Fall back to IP-based geolocation
      console.log('[LocationService] Falling back to IP geolocation...');
      try {
        const ipLocation = await this.getLocationByIp();
        console.log('[LocationService] IP location detected:', ipLocation);

        return {
          source: 'ip-detected',
          data: ipLocation,
        };
      } catch (ipError) {
        console.error('[LocationService] IP geolocation also failed:', ipError);

        // If GPS was denied AND IP failed, report denied
        if (permState === 'denied') {
          return { source: 'denied', data: null, error: 'Location permission denied' };
        }

        return {
          source: 'failed',
          data: null,
          error: 'Could not detect location via GPS or IP',
        };
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[LocationService] Request cancelled');
        return { source: 'failed', data: null, error: 'Request cancelled' };
      }

      console.error('[LocationService] Detection failed:', error);
      return {
        source: 'failed',
        data: null,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Fetch all countries for dropdown
   */
  async fetchCountries(): Promise<Country[]> {
    try {
      const response = await fetch(`${LOCATIONS_API}?type=countries`);
      const result: LocationsApiResponse<Country> = await response.json();
      if (result.error) throw new Error(result.error);
      return result.data || [];
    } catch (error) {
      console.error('[LocationService] Failed to fetch countries:', error);
      throw error;
    }
  }

  /**
   * Fetch states for a specific country
   */
  async fetchStates(countryCode: string): Promise<State[]> {
    if (!countryCode) return [];
    try {
      const response = await fetch(`${LOCATIONS_API}?type=states&country=${countryCode}`);
      const result: LocationsApiResponse<State> = await response.json();
      if (result.error) throw new Error(result.error);
      return result.data || [];
    } catch (error) {
      console.error('[LocationService] Failed to fetch states:', error);
      throw error;
    }
  }

  /**
   * Fetch cities for a specific state in a country
   */
  async fetchCities(countryCode: string, stateCode: string): Promise<City[]> {
    if (!countryCode || !stateCode) return [];
    try {
      const response = await fetch(`${LOCATIONS_API}?type=cities&country=${countryCode}&state=${stateCode}`);
      const result: LocationsApiResponse<City> = await response.json();
      if (result.error) throw new Error(result.error);
      return result.data || [];
    } catch (error) {
      console.error('[LocationService] Failed to fetch cities:', error);
      throw error;
    }
  }

  /**
   * Save GPS location data to onboarding_data table
   */
  async saveLocationToOnboarding(userId: string, locationData: LocationData): Promise<void> {
    if (!config.supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    const now = new Date().toISOString();
    const countryName = COUNTRY_CODE_TO_NAME[locationData.countryCode] || locationData.country;

    const updateV2 = {
      // Matches the current onboarding_data schema (gps_* columns).
      gps_latitude: locationData.latitude,
      gps_longitude: locationData.longitude,
      gps_city: (locationData.city || '').split('|')[0].trim() || null,
      gps_state: locationData.state || null,
      gps_country: countryName || locationData.country || null,
      gps_zip_code: locationData.postalCode || null,
      gps_full_address: locationData.formattedAddress || null,
      gps_detected_at: now,
      updated_at: now,
    } satisfies Record<string, unknown>;

    const updateLegacy = {
      // Backward-compatible payload for older schemas that stored the full JSON blob.
      gps_location_data: locationData,
      gps_detected_country: countryName,
      gps_detected_state: locationData.state,
      gps_detected_city: locationData.city,
      gps_detected_postal_code: locationData.postalCode,
      gps_detected_phone_dial_code: locationData.phoneDialCode,
      gps_detected_timezone: locationData.timezone,
      updated_at: now,
    } satisfies Record<string, unknown>;

    const tryUpdate = async (payload: Record<string, unknown>) => {
      const { error } = await config.supabaseClient!
        .from('onboarding_data')
        .update(payload)
        .eq('user_id', userId);
      return error;
    };

    const errorV2 = await tryUpdate(updateV2);
    if (!errorV2) {
      console.log('[LocationService] Location saved to onboarding_data (gps_* columns)');
      return;
    }

    // If columns are missing (schema mismatch), try the legacy JSON columns.
    if (errorV2.code === 'PGRST204' || errorV2.message?.toLowerCase().includes('schema cache')) {
      const errorLegacy = await tryUpdate(updateLegacy);
      if (!errorLegacy) {
        console.log('[LocationService] Location saved to onboarding_data (legacy gps_location_data columns)');
        return;
      }
      console.error('[LocationService] Failed to save location (legacy):', errorLegacy);
      throw errorLegacy;
    }

    console.error('[LocationService] Failed to save location:', errorV2);
    throw errorV2;
  }

  /**
   * Get cached GPS location data from onboarding_data
   */
  async getCachedLocation(userId: string): Promise<LocationData | null> {
    if (!config.supabaseClient) return null;

    const { data, error } = await config.supabaseClient
      .from('onboarding_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    // Prefer the richer legacy JSON blob if present.
    if ((data as any)?.gps_location_data) {
      return (data as any).gps_location_data as LocationData;
    }

    // Otherwise, reconstruct from gps_* columns if present.
    const lat = (data as any).gps_latitude;
    const lon = (data as any).gps_longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;

    const country = String((data as any).gps_country || '');
    const inferredCountryCode = this.mapCountryToIsoCode(country);

    return {
      country,
      countryCode: inferredCountryCode,
      state: String((data as any).gps_state || ''),
      stateCode: '',
      city: String((data as any).gps_city || ''),
      postalCode: String((data as any).gps_zip_code || ''),
      phoneDialCode: this.getDialCodeForCountry(inferredCountryCode),
      timezone: this.getDeviceTimezone(),
      formattedAddress: String((data as any).gps_full_address || ''),
      latitude: lat,
      longitude: lon,
    };
  }

  /**
   * Check if location is already cached
   */
  async hasLocationCached(userId: string): Promise<boolean> {
    const cached = await this.getCachedLocation(userId);
    return cached !== null;
  }

  /** Map country name to ISO code */
  mapCountryToIsoCode(countryName: string): string {
    return COUNTRY_NAME_TO_CODE[countryName] || countryName;
  }

  /** Map ISO code to country name */
  mapIsoCodeToCountry(isoCode: string): string {
    return COUNTRY_CODE_TO_NAME[isoCode] || isoCode;
  }

  /**
   * Find matching state in list (by code or name)
   */
  findMatchingState(states: State[], gpsState: string, gpsStateCode?: string): State | null {
    if (gpsStateCode) {
      const byCode = states.find(s => s.isoCode === gpsStateCode);
      if (byCode) return byCode;
    }
    const byName = states.find(s =>
      s.name.toLowerCase() === gpsState.toLowerCase() ||
      s.isoCode.toLowerCase() === gpsState.toLowerCase()
    );
    if (byName) return byName;
    const partial = states.find(s =>
      s.name.toLowerCase().includes(gpsState.toLowerCase()) ||
      gpsState.toLowerCase().includes(s.name.toLowerCase())
    );
    return partial || null;
  }

  /**
   * Find matching city in list
   */
  findMatchingCity(cities: City[], gpsCity: string): City | null {
    const exact = cities.find(c => c.name.toLowerCase() === gpsCity.toLowerCase());
    if (exact) return exact;
    const partial = cities.find(c =>
      c.name.toLowerCase().includes(gpsCity.toLowerCase()) ||
      gpsCity.toLowerCase().includes(c.name.toLowerCase())
    );
    return partial || null;
  }

  /**
   * Parse formatted address into address lines
   */
  parseFormattedAddress(formattedAddress: string, locationData: LocationData): { line1: string; line2: string } {
    let streetPart = formattedAddress;
    if (locationData.country && streetPart.endsWith(locationData.country)) {
      streetPart = streetPart.slice(0, -locationData.country.length).replace(/,\s*$/, '');
    }
    if (locationData.postalCode) {
      streetPart = streetPart.replace(new RegExp(`\\s*${locationData.postalCode}\\s*,?`), '');
    }
    if (locationData.state) {
      streetPart = streetPart.replace(new RegExp(`,?\\s*${locationData.state}\\s*$`), '');
    }
    if (locationData.city) {
      streetPart = streetPart.replace(new RegExp(`,?\\s*${locationData.city}\\s*$`), '');
    }
    streetPart = streetPart.replace(/,\s*$/, '').trim();
    const parts = streetPart.split(',').map(p => p.trim()).filter(p => p);
    return {
      line1: parts[0] || '',
      line2: parts.slice(1).join(', '),
    };
  }
}

// Export singleton instance
export const locationService = new LocationService();

// Export types
export * from './types';
