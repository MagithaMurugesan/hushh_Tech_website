/**
 * Location Service Types
 * Centralized type definitions for location-related APIs
 */

// GPS Geocoding API response
export interface LocationData {
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  city: string;
  postalCode: string;
  phoneDialCode: string;
  timezone: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export type LocationCacheSource = 'gps' | 'ip';

export interface LocationCacheRecord {
  data: LocationData;
  source: LocationCacheSource;
  detectedAt: string;
  lastCheckedAt: string;
  signature: string;
}

// Country for dropdown
export interface Country {
  isoCode: string;
  name: string;
}

// State for dropdown
export interface State {
  isoCode: string;
  name: string;
}

// City for dropdown
export interface City {
  name: string;
}

// API Response types
export interface GeocodeApiResponse {
  success: boolean;
  data?: LocationData;
  error?: string;
}

export interface LocationsApiResponse<T> {
  data?: T[];
  error?: string;
}

// Loading states for sequential dropdown loading
export type LocationLoadingState = 
  | 'idle'
  | 'detecting-gps'
  | 'loading-countries'
  | 'loading-states'
  | 'loading-cities'
  | 'ready'
  | 'error';

// Location detection result
export interface LocationDetectionResult {
  source: 'cached' | 'detected' | 'ip-detected' | 'failed' | 'denied';
  data: LocationData | null;
  error?: string;
}

// Permission state for geolocation
export type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

// GPS coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Country code to name mapping
export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'US': 'United States',
  'CA': 'Canada',
  'GB': 'United Kingdom',
  'UK': 'United Kingdom',
  'IN': 'India',
  'CN': 'China',
  'JP': 'Japan',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'RU': 'Russia',
  'KR': 'South Korea',
  'SA': 'Saudi Arabia',
  'AE': 'United Arab Emirates',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'NZ': 'New Zealand',
  'ZA': 'South Africa',
  'EG': 'Egypt',
  'NG': 'Nigeria',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'ID': 'Indonesia',
  'MY': 'Malaysia',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'PH': 'Philippines',
  'TR': 'Turkey',
  'PL': 'Poland',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'PT': 'Portugal',
  'GR': 'Greece',
  'IE': 'Ireland',
  'IL': 'Israel',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
  'VE': 'Venezuela',
};

// Country name to ISO code mapping
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
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
  'Saudi Arabia': 'SA',
  'South Korea': 'KR',
  'Brazil': 'BR',
  'Mexico': 'MX',
};
