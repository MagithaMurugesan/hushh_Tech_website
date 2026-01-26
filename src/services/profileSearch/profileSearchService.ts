// Profile Search Service
// Calls hushh-profile-search API and transforms response for onboarding/profile pre-population

import { EnrichedProfileData, ParsedAddress, ParsedPhone, ProfilePreferences } from './types';

const PROFILE_SEARCH_API = 'https://ibsisfnjxeowvdtvgzff.supabase.co/functions/v1/hushh-profile-search';
// Use the correct Supabase anon key from config
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlic2lzZm5qeGVvd3ZkdHZnemZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NTk1NzgsImV4cCI6MjA4MDEzNTU3OH0.K16sO1R9L2WZGPueDP0mArs2eDYZc-TnIk2LApDw_fs';

export interface SearchParams {
  name: string;
  email: string;
  country?: string;
}

export interface ProfileSearchResult {
  success: boolean;
  data?: EnrichedProfileData;
  error?: string;
}

/**
 * Parse address string into structured components
 * Example: "123 Main St, San Francisco, CA 94102, USA"
 */
function parseAddress(addressStr: string): ParsedAddress | undefined {
  if (!addressStr || addressStr === 'Unknown' || addressStr === 'Not publicly available') {
    return undefined;
  }

  // Try to parse common address formats
  const parts = addressStr.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Try to extract components
    const lastPart = parts[parts.length - 1];
    const secondLast = parts.length > 2 ? parts[parts.length - 2] : '';
    
    // Check if last part is country
    const country = lastPart.length <= 3 ? lastPart : 
      ['USA', 'US', 'United States', 'UK', 'Canada', 'India', 'Australia'].includes(lastPart) ? lastPart : lastPart;
    
    // Parse state and zip from second last part
    const stateZipMatch = secondLast.match(/^([A-Z]{2})\s*(\d{5,6})?$/);
    const state = stateZipMatch ? stateZipMatch[1] : secondLast;
    const zipCode = stateZipMatch?.[2] || '';
    
    // City is typically before state
    const city = parts.length > 3 ? parts[parts.length - 3] : parts.length > 2 ? parts[1] : '';
    
    // Address line 1 is the rest
    const line1 = parts.slice(0, Math.max(1, parts.length - 3)).join(', ');
    
    return {
      line1: line1 || parts[0],
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
    };
  }
  
  // Single part - assume it's a country or city
  return {
    line1: '',
    city: addressStr,
    state: '',
    zipCode: '',
    country: '',
  };
}

/**
 * Parse phone contact string into country code and number
 * Example: "+1 555-123-4567" or "555-123-4567"
 */
function parsePhone(contactStr: string): ParsedPhone | undefined {
  if (!contactStr || contactStr === 'Unknown' || contactStr === 'Not publicly available') {
    return undefined;
  }

  // Remove all non-digit/plus characters for parsing
  const cleaned = contactStr.replace(/[^\d+]/g, '');
  
  // Check if starts with country code
  if (cleaned.startsWith('+')) {
    // Common country code patterns
    if (cleaned.startsWith('+1')) {
      return { countryCode: '+1', number: cleaned.slice(2) };
    } else if (cleaned.startsWith('+91')) {
      return { countryCode: '+91', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+44')) {
      return { countryCode: '+44', number: cleaned.slice(3) };
    } else {
      // Generic extraction - assume 1-3 digit country code
      const match = cleaned.match(/^\+(\d{1,3})(\d+)$/);
      if (match) {
        return { countryCode: `+${match[1]}`, number: match[2] };
      }
    }
  }
  
  // No country code - assume US
  return { countryCode: '+1', number: cleaned };
}

/**
 * Parse DOB string into YYYY-MM-DD format
 */
function parseDOB(dobStr: string): string | undefined {
  if (!dobStr || dobStr === 'Unknown') {
    return undefined;
  }

  // Try various date formats
  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
  ];

  for (const pattern of datePatterns) {
    const match = dobStr.match(pattern);
    if (match) {
      // Already ISO format
      if (pattern === datePatterns[0]) {
        return dobStr;
      }
      // MM/DD/YYYY format
      if (pattern === datePatterns[1]) {
        return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      }
      // Month DD, YYYY format
      if (pattern === datePatterns[2]) {
        const months: Record<string, string> = {
          'January': '01', 'February': '02', 'March': '03', 'April': '04',
          'May': '05', 'June': '06', 'July': '07', 'August': '08',
          'September': '09', 'October': '10', 'November': '11', 'December': '12',
        };
        const month = months[match[1]] || '01';
        return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
      }
    }
  }

  return undefined;
}

/**
 * Transform API response to EnrichedProfileData
 */
function transformApiResponse(apiResponse: any, searchQuery: string): EnrichedProfileData {
  const structured = apiResponse.structured || {};
  
  // Parse preferences from API response
  const preferences: ProfilePreferences = {
    // Food & Drink
    diet: structured.diet,
    foods: structured.foods,
    coffeePreferences: structured.coffeePreferences,
    chaiPreferences: structured.chaiPreferences,
    drinkPreferences: structured.drinkPreferences,
    spiciness: structured.spiciness,
    diningStyle: structured.diningStyle,
    restaurantTypes: structured.restaurantTypes,
    deliveryApps: structured.deliveryApps,
    
    // Lifestyle
    hobbies: structured.hobbies,
    colors: structured.colors,
    likes: structured.likes,
    dislikes: structured.dislikes,
    smokePreferences: structured.smokePreferences,
    fashionStyle: structured.fashionStyle,
    fashionBrands: structured.fashionBrands,
    
    // Travel & Hotels
    hotelPreferences: structured.hotelPreferences,
    travelStyle: structured.travelStyle,
    travelDestinations: structured.travelDestinations,
    travelFrequency: structured.travelFrequency,
    
    // Entertainment
    musicGenres: structured.musicGenres,
    musicArtists: structured.musicArtists,
    musicPlatform: structured.musicPlatform,
    streamingServices: structured.streamingServices,
    movieGenres: structured.movieGenres,
    showsWatching: structured.showsWatching,
    gamingPlatform: structured.gamingPlatform,
    
    // Health & Fitness
    fitnessRoutine: structured.fitnessRoutine,
    healthApps: structured.healthApps,
    sleepPattern: structured.sleepPattern,
    allergies: structured.allergies,
    healthInsurance: structured.healthInsurance,
    meditationPractice: structured.meditationPractice,
    
    // Work & Productivity
    workEnvironment: structured.workEnvironment,
    productivityTools: structured.productivityTools,
    workHours: structured.workHours,
    communicationPreference: structured.communicationPreference,
    learningStyle: structured.learningStyle,
    
    // Tech
    brands: structured.brands,
    techEcosystem: structured.techEcosystem,
    smartDevices: structured.smartDevices,
    aiPreferences: structured.aiPreferences,
    
    // Financial
    investmentStyle: structured.investmentStyle,
    shoppingBehavior: structured.shoppingBehavior,
    paymentPreference: structured.paymentPreference,
    
    // Social
    socialPersonality: structured.socialPersonality,
    socialMediaUsage: structured.socialMediaUsage,
    contentCreation: structured.contentCreation,
    petPreference: structured.petPreference,
    pets: structured.pets,
    
    // Learning
    bookGenres: structured.bookGenres,
    newsSources: structured.newsSources,
    podcasts: structured.podcasts,
    
    // Transport
    vehiclePreference: structured.vehiclePreference,
    transportMode: structured.transportMode,
    
    // Beliefs
    spiritualBeliefs: structured.spiritualBeliefs,
  };

  // Clean up undefined values
  Object.keys(preferences).forEach(key => {
    const val = preferences[key as keyof ProfilePreferences];
    if (val === undefined || val === 'Unknown' || val === 'Not publicly available') {
      delete preferences[key as keyof ProfilePreferences];
    }
  });

  return {
    age: structured.age ? parseInt(structured.age, 10) : undefined,
    dob: parseDOB(structured.dob),
    address: parseAddress(structured.address),
    phone: parsePhone(structured.contact),
    occupation: structured.occupation !== 'Unknown' ? structured.occupation : undefined,
    nationality: structured.nationality !== 'Unknown' ? structured.nationality : undefined,
    maritalStatus: structured.maritalStatus !== 'Unknown' ? structured.maritalStatus : undefined,
    preferences,
    confidence: structured.confidence || 0,
    netWorthScore: structured.netWorthScore || 0,
    netWorthContext: structured.netWorthContext,
    sources: apiResponse.sources || [],
    searchQuery,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Search for user profile using AI-powered web intelligence
 * @param params Search parameters (name, email, optional country)
 * @returns Enriched profile data or error
 */
export async function searchProfile(params: SearchParams): Promise<ProfileSearchResult> {
  try {
    console.log('[ProfileSearch] Starting search for:', params.name);
    
    const response = await fetch(PROFILE_SEARCH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        country: params.country || 'United States',
        contact: '', // Optional - API will search based on name/email
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ProfileSearch] API error:', response.status, errorText);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }

    const apiResponse = await response.json();
    
    if (!apiResponse.success || !apiResponse.result) {
      return {
        success: false,
        error: apiResponse.error || 'No profile data returned',
      };
    }

    const enrichedData = transformApiResponse(apiResponse.result, params.name);
    
    console.log('[ProfileSearch] Success! Confidence:', enrichedData.confidence);
    
    return {
      success: true,
      data: enrichedData,
    };
  } catch (error) {
    console.error('[ProfileSearch] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Map enriched profile data to onboarding form fields
 * Returns only the fields that have values and confidence > 0.4
 */
export function mapToOnboardingFields(data: EnrichedProfileData): Partial<{
  citizenship_country: string;
  residence_country: string;
  phone_number: string;
  phone_country_code: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  zip_code: string;
  date_of_birth: string;
}> {
  const result: Record<string, string> = {};
  
  // Only pre-fill if confidence is reasonable
  if (data.confidence < 0.4) {
    console.log('[ProfileSearch] Low confidence, skipping pre-fill');
    return {};
  }

  if (data.nationality) {
    result.citizenship_country = data.nationality;
  }

  if (data.address?.country) {
    result.residence_country = data.address.country;
  }

  if (data.phone) {
    result.phone_country_code = data.phone.countryCode;
    result.phone_number = data.phone.number;
  }

  if (data.address) {
    if (data.address.line1) result.address_line_1 = data.address.line1;
    if (data.address.line2) result.address_line_2 = data.address.line2;
    if (data.address.city) result.city = data.address.city;
    if (data.address.state) result.state = data.address.state;
    if (data.address.zipCode) result.zip_code = data.address.zipCode;
  }

  if (data.dob) {
    result.date_of_birth = data.dob;
  }

  return result;
}

export default {
  searchProfile,
  mapToOnboardingFields,
};
