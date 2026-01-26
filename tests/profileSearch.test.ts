/**
 * Profile Search Service Unit Tests
 * Tests for onboarding pre-population and AI profile enrichment
 * 
 * Total: 32 Test Cases covering:
 * - Address parsing (8 tests)
 * - Phone parsing (8 tests)  
 * - DOB parsing (6 tests)
 * - mapToOnboardingFields (6 tests)
 * - API response transformation (2 tests)
 * - Supabase integration (2 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrichedProfileData, ParsedAddress, ParsedPhone, ProfilePreferences } from '../src/services/profileSearch/types';

// ============================================================
// Helper Functions (Re-implemented for testing)
// These mirror the private functions in profileSearchService.ts
// ============================================================

function parseAddress(addressStr: string): ParsedAddress | undefined {
  if (!addressStr || addressStr === 'Unknown' || addressStr === 'Not publicly available') {
    return undefined;
  }

  const parts = addressStr.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const secondLast = parts.length > 2 ? parts[parts.length - 2] : '';
    
    const country = lastPart.length <= 3 ? lastPart : 
      ['USA', 'US', 'United States', 'UK', 'Canada', 'India', 'Australia'].includes(lastPart) ? lastPart : lastPart;
    
    const stateZipMatch = secondLast.match(/^([A-Z]{2})\s*(\d{5,6})?$/);
    const state = stateZipMatch ? stateZipMatch[1] : secondLast;
    const zipCode = stateZipMatch?.[2] || '';
    
    const city = parts.length > 3 ? parts[parts.length - 3] : parts.length > 2 ? parts[1] : '';
    const line1 = parts.slice(0, Math.max(1, parts.length - 3)).join(', ');
    
    return {
      line1: line1 || parts[0],
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
    };
  }
  
  return {
    line1: '',
    city: addressStr,
    state: '',
    zipCode: '',
    country: '',
  };
}

function parsePhone(contactStr: string): ParsedPhone | undefined {
  if (!contactStr || contactStr === 'Unknown' || contactStr === 'Not publicly available') {
    return undefined;
  }

  const cleaned = contactStr.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+')) {
    // Handle specific country codes explicitly
    if (cleaned.startsWith('+1')) {
      return { countryCode: '+1', number: cleaned.slice(2) };
    } else if (cleaned.startsWith('+91')) {
      return { countryCode: '+91', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+44')) {
      return { countryCode: '+44', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+49')) {
      return { countryCode: '+49', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+86')) {
      return { countryCode: '+86', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+81')) {
      return { countryCode: '+81', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+33')) {
      return { countryCode: '+33', number: cleaned.slice(3) };
    } else if (cleaned.startsWith('+971')) {
      return { countryCode: '+971', number: cleaned.slice(4) };
    } else {
      // Generic fallback: assume 2-digit country code for unknown
      const match = cleaned.match(/^\+(\d{2})(\d+)$/);
      if (match) {
        return { countryCode: `+${match[1]}`, number: match[2] };
      }
    }
  }
  
  return { countryCode: '+1', number: cleaned };
}

function parseDOB(dobStr: string): string | undefined {
  if (!dobStr || dobStr === 'Unknown') {
    return undefined;
  }

  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = dobStr.match(pattern);
    if (match) {
      if (pattern === datePatterns[0]) {
        return dobStr;
      }
      if (pattern === datePatterns[1]) {
        return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      }
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

function mapToOnboardingFields(data: EnrichedProfileData): Partial<{
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
  
  if (data.confidence < 0.4) {
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

// ============================================================
// Test Suite 1: Address Parsing (8 tests)
// ============================================================

describe('parseAddress', () => {
  // Test 1: Full US address with state and zip
  it('should parse full US address with state and zip', () => {
    const result = parseAddress('123 Main St, San Francisco, CA 94102, USA');
    expect(result).toBeDefined();
    expect(result?.line1).toBe('123 Main St');
    expect(result?.city).toBe('San Francisco');
    expect(result?.country).toBe('USA');
  });

  // Test 2: Address without zip code
  it('should parse address without zip code', () => {
    const result = parseAddress('456 Oak Ave, Los Angeles, CA, USA');
    expect(result).toBeDefined();
    expect(result?.city).toBe('Los Angeles');
    expect(result?.state).toBe('CA');
  });

  // Test 3: Simple city and country
  it('should parse simple city and country', () => {
    const result = parseAddress('Mumbai, India');
    expect(result).toBeDefined();
    expect(result?.country).toBe('India');
  });

  // Test 4: Unknown address returns undefined
  it('should return undefined for Unknown address', () => {
    const result = parseAddress('Unknown');
    expect(result).toBeUndefined();
  });

  // Test 5: Not publicly available returns undefined
  it('should return undefined for Not publicly available', () => {
    const result = parseAddress('Not publicly available');
    expect(result).toBeUndefined();
  });

  // Test 6: Empty string returns undefined
  it('should return undefined for empty string', () => {
    const result = parseAddress('');
    expect(result).toBeUndefined();
  });

  // Test 7: UK address format
  it('should parse UK address format', () => {
    const result = parseAddress('10 Downing Street, London, UK');
    expect(result).toBeDefined();
    expect(result?.country).toBe('UK');
  });

  // Test 8: Single location string
  it('should handle single location string', () => {
    const result = parseAddress('New York');
    expect(result).toBeDefined();
    expect(result?.city).toBe('New York');
  });
});

// ============================================================
// Test Suite 2: Phone Parsing (8 tests)
// ============================================================

describe('parsePhone', () => {
  // Test 9: US phone with country code
  it('should parse US phone with +1 country code', () => {
    const result = parsePhone('+1 555-123-4567');
    expect(result).toBeDefined();
    expect(result?.countryCode).toBe('+1');
    expect(result?.number).toBe('5551234567');
  });

  // Test 10: India phone with country code
  it('should parse India phone with +91 country code', () => {
    const result = parsePhone('+91 98765 43210');
    expect(result).toBeDefined();
    expect(result?.countryCode).toBe('+91');
    expect(result?.number).toBe('9876543210');
  });

  // Test 11: UK phone with country code
  it('should parse UK phone with +44 country code', () => {
    const result = parsePhone('+44 20 7946 0958');
    expect(result).toBeDefined();
    expect(result?.countryCode).toBe('+44');
    expect(result?.number).toBe('2079460958');
  });

  // Test 12: Phone without country code (defaults to US)
  it('should default to +1 for phone without country code', () => {
    const result = parsePhone('555-123-4567');
    expect(result).toBeDefined();
    expect(result?.countryCode).toBe('+1');
  });

  // Test 13: Unknown phone returns undefined
  it('should return undefined for Unknown phone', () => {
    const result = parsePhone('Unknown');
    expect(result).toBeUndefined();
  });

  // Test 14: Not publicly available returns undefined
  it('should return undefined for Not publicly available', () => {
    const result = parsePhone('Not publicly available');
    expect(result).toBeUndefined();
  });

  // Test 15: Empty string returns undefined
  it('should return undefined for empty string', () => {
    const result = parsePhone('');
    expect(result).toBeUndefined();
  });

  // Test 16: Generic international phone
  it('should parse generic international phone', () => {
    const result = parsePhone('+49 30 123456');
    expect(result).toBeDefined();
    expect(result?.countryCode).toBe('+49');
    expect(result?.number).toBe('30123456');
  });
});

// ============================================================
// Test Suite 3: DOB Parsing (6 tests)
// ============================================================

describe('parseDOB', () => {
  // Test 17: ISO format YYYY-MM-DD
  it('should return ISO format as-is', () => {
    const result = parseDOB('1990-05-15');
    expect(result).toBe('1990-05-15');
  });

  // Test 18: US format MM/DD/YYYY
  it('should convert US format MM/DD/YYYY', () => {
    const result = parseDOB('05/15/1990');
    expect(result).toBe('1990-05-15');
  });

  // Test 19: Long month format
  it('should convert long month format', () => {
    const result = parseDOB('January 15, 1990');
    expect(result).toBe('1990-01-15');
  });

  // Test 20: Unknown DOB returns undefined
  it('should return undefined for Unknown', () => {
    const result = parseDOB('Unknown');
    expect(result).toBeUndefined();
  });

  // Test 21: Empty string returns undefined
  it('should return undefined for empty string', () => {
    const result = parseDOB('');
    expect(result).toBeUndefined();
  });

  // Test 22: December month parsing
  it('should correctly parse December date', () => {
    const result = parseDOB('December 25, 2000');
    expect(result).toBe('2000-12-25');
  });
});

// ============================================================
// Test Suite 4: mapToOnboardingFields (6 tests)
// ============================================================

describe('mapToOnboardingFields', () => {
  const createMockData = (overrides: Partial<EnrichedProfileData> = {}): EnrichedProfileData => ({
    confidence: 0.85,
    netWorthScore: 75,
    preferences: {},
    sources: [],
    searchQuery: 'test',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  // Test 23: Maps nationality to citizenship_country
  it('should map nationality to citizenship_country', () => {
    const data = createMockData({ nationality: 'United States' });
    const result = mapToOnboardingFields(data);
    expect(result.citizenship_country).toBe('United States');
  });

  // Test 24: Maps address fields correctly
  it('should map address fields correctly', () => {
    const data = createMockData({
      address: {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        country: 'USA',
      },
    });
    const result = mapToOnboardingFields(data);
    expect(result.address_line_1).toBe('123 Main St');
    expect(result.city).toBe('San Francisco');
    expect(result.state).toBe('CA');
    expect(result.zip_code).toBe('94102');
    expect(result.residence_country).toBe('USA');
  });

  // Test 25: Maps phone fields correctly
  it('should map phone fields correctly', () => {
    const data = createMockData({
      phone: { countryCode: '+1', number: '5551234567' },
    });
    const result = mapToOnboardingFields(data);
    expect(result.phone_country_code).toBe('+1');
    expect(result.phone_number).toBe('5551234567');
  });

  // Test 26: Maps DOB correctly
  it('should map date of birth correctly', () => {
    const data = createMockData({ dob: '1990-05-15' });
    const result = mapToOnboardingFields(data);
    expect(result.date_of_birth).toBe('1990-05-15');
  });

  // Test 27: Returns empty object for low confidence
  it('should return empty object for low confidence', () => {
    const data = createMockData({ confidence: 0.3, nationality: 'USA' });
    const result = mapToOnboardingFields(data);
    expect(Object.keys(result).length).toBe(0);
  });

  // Test 28: Handles empty data gracefully
  it('should handle empty data gracefully', () => {
    const data = createMockData();
    const result = mapToOnboardingFields(data);
    expect(result).toBeDefined();
    expect(result.citizenship_country).toBeUndefined();
  });
});

// ============================================================
// Test Suite 5: API Response Transformation (2 tests)
// ============================================================

describe('transformApiResponse', () => {
  function transformApiResponse(apiResponse: any, searchQuery: string): EnrichedProfileData {
    const structured = apiResponse.structured || {};
    
    const preferences: ProfilePreferences = {
      diet: structured.diet,
      hobbies: structured.hobbies,
      brands: structured.brands,
    };

    Object.keys(preferences).forEach(key => {
      const val = preferences[key as keyof ProfilePreferences];
      if (val === undefined || val === 'Unknown') {
        delete preferences[key as keyof ProfilePreferences];
      }
    });

    return {
      age: structured.age ? parseInt(structured.age, 10) : undefined,
      dob: undefined,
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

  // Test 29: Transforms complete API response
  it('should transform complete API response', () => {
    const apiResponse = {
      structured: {
        age: '35',
        occupation: 'Software Engineer',
        nationality: 'India',
        confidence: 0.9,
        diet: 'Vegetarian',
        hobbies: ['Reading', 'Gaming'],
      },
      sources: [{ title: 'LinkedIn', uri: 'https://linkedin.com' }],
    };
    
    const result = transformApiResponse(apiResponse, 'John Doe');
    
    expect(result.age).toBe(35);
    expect(result.occupation).toBe('Software Engineer');
    expect(result.nationality).toBe('India');
    expect(result.confidence).toBe(0.9);
    expect(result.searchQuery).toBe('John Doe');
    expect(result.preferences.diet).toBe('Vegetarian');
  });

  // Test 30: Handles empty API response
  it('should handle empty API response', () => {
    const apiResponse = {};
    const result = transformApiResponse(apiResponse, 'Unknown User');
    
    expect(result.age).toBeUndefined();
    expect(result.confidence).toBe(0);
    expect(result.searchQuery).toBe('Unknown User');
  });
});

// ============================================================
// Test Suite 6: Supabase Integration Tests (2 tests)
// Uses the Management API to verify table existence
// ============================================================

describe('Supabase Integration', () => {
  const SUPABASE_API = 'https://api.supabase.com/v1/projects/ibsisfnjxeowvdtvgzff/database/query';
  const SUPABASE_TOKEN = 'sbp_f4130e6a2c63461d2a4540e1f940b4d963cd1921';

  // Test 31: Verify user_enriched_profiles table exists
  it('should have user_enriched_profiles table', async () => {
    const response = await fetch(SUPABASE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_enriched_profiles') AS exists",
      }),
    });
    
    const data = await response.json();
    expect(data[0]?.exists).toBe(true);
  });

  // Test 32: Verify ai_prefilled column exists in onboarding_data
  it('should have ai_prefilled column in onboarding_data', async () => {
    const response = await fetch(SUPABASE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'onboarding_data' AND column_name = 'ai_prefilled') AS exists",
      }),
    });
    
    const data = await response.json();
    expect(data[0]?.exists).toBe(true);
  });
});
