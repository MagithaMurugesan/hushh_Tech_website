// Onboarding Type Definitions

// Updated account types based on Manish Sainani's feedback
// - All accounts are "Wealth Investment Account" with Hushh prefix
// - Three tiers: $1M, $5M (Silver), $25M (Gold/Platinum for Ultra High Net Worth)
export type AccountType = 'wealth_1m' | 'wealth_5m' | 'ultra_25m';

// Legacy account types for backward compatibility
export type LegacyAccountType = 'general' | 'retirement';

export type ReferralSource = 
  | 'podcast'
  | 'social_media_influencer'
  | 'social_media_ad'
  | 'yahoo_finance'
  | 'ai_tool'
  | 'website_blog_article'
  | 'penny_hoarder'
  | 'family_friend'
  | 'tv_radio'
  | 'other';

export type AccountStructure = 'individual' | 'joint' | 'retirement' | 'trust' | 'other';

// UI-facing account type values used in Step 5 and the profile page.
// These map directly to the DB account_type column (constraint updated via migration).
export type UIAccountType = 'individual' | 'joint' | 'retirement' | 'trust';

// Account type option for rendering in the UI
export interface AccountTypeOption {
  value: UIAccountType;
  label: string;
}

// Options displayed in Step 5 and the profile page
export const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'joint', label: 'Joint' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'trust', label: 'Trust' },
];

// Matches onboarding_data.recurring_frequency DB constraint.
export type RecurringFrequency = 'once_a_month' | 'twice_a_month' | 'weekly' | 'every_other_week';

// Account tier information for UI display
export interface AccountTierInfo {
  type: AccountType;
  name: string;
  minimum: string;
  minimumAmount: number;
  description: string;
  tierLevel: 'standard' | 'silver' | 'gold';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    border: string;
    background: string;
    selectedBorder: string;
    selectedBackground: string;
  };
}

// Account tier configurations
export const ACCOUNT_TIERS: Record<AccountType, AccountTierInfo> = {
  wealth_1m: {
    type: 'wealth_1m',
    name: 'Hushh Wealth Investment Account',
    minimum: '$1 million minimum',
    minimumAmount: 1000000,
    description: 'A flexible wealth investment account designed to help you build and preserve long-term wealth through AI-powered strategies.',
    tierLevel: 'standard',
    colors: {
      primary: '#00A9E0',
      secondary: '#6DD3EF',
      accent: '#0B1120',
      border: '#E2E8F0',
      background: '#FFFFFF',
      selectedBorder: '#00A9E0',
      selectedBackground: '#F0F9FF',
    },
  },
  wealth_5m: {
    type: 'wealth_5m',
    name: 'Hushh Wealth Investment Account',
    minimum: '$5 million minimum',
    minimumAmount: 5000000,
    description: 'Enhanced wealth management with premium portfolio strategies and dedicated relationship support.',
    tierLevel: 'silver',
    colors: {
      primary: '#71717A',
      secondary: '#A1A1AA',
      accent: '#3F3F46',
      border: '#D4D4D8',
      background: '#FAFAFA',
      selectedBorder: '#71717A',
      selectedBackground: '#F4F4F5',
    },
  },
  ultra_25m: {
    type: 'ultra_25m',
    name: 'Hushh Ultra High Net Worth Investment Account',
    minimum: '$25 million minimum',
    minimumAmount: 25000000,
    description: 'Exclusive investment access tailored for ultra high net worth individuals and families worldwide, with bespoke portfolio solutions.',
    tierLevel: 'gold',
    colors: {
      primary: '#B8860B',
      secondary: '#DAA520',
      accent: '#8B6914',
      border: '#D4AF37',
      background: '#FFFEF7',
      selectedBorder: '#B8860B',
      selectedBackground: '#FFF9E6',
    },
  },
};

export interface OnboardingData {
  id: string;
  user_id: string;

  // LEGACY: Account Type (removed from flow, kept for backward compatibility)
  account_type?: AccountType | LegacyAccountType;

  // Step 1: Fund & Share Class Selection (was Step 3)
  selected_fund?: string;
  class_a_units?: number;
  class_b_units?: number;
  class_c_units?: number;

  // Step 2: Referral Source (was Step 4)
  referral_source?: ReferralSource;
  referral_source_other?: string;

  // Step 3: Information intro (was Step 5 - no data stored)

  // Step 4: Residence (was Step 6)
  citizenship_country?: string;
  residence_country?: string;

  // Step 5: Account Structure (was Step 7)
  account_structure?: AccountStructure;

  // Step 6: Phone Number (was Step 8)
  phone_number?: string;
  phone_country_code?: string;

  // Step 7: Legal Name (was Step 9)
  legal_first_name?: string;
  legal_last_name?: string;

  // Step 8: Address (was Step 10)
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  address_phone_number?: string;

  // Step 9: Sensitive Info (was Step 11)
  ssn_encrypted?: string;
  date_of_birth?: string;

  // Step 10: Initial Investment (was Step 12)
  initial_investment_amount?: number;

  // Step 11: Recurring Investment (was Step 13)
  recurring_investment_enabled?: boolean;
  recurring_frequency?: RecurringFrequency;
  recurring_amount?: number;
  recurring_day_of_month?: number;

  // Step 12: (was Step 14)
  // Step 13: Banking Info (was Step 15)
  
  // Progress Tracking
  current_step: number;
  completed_steps: number[];
  is_completed: boolean;
  completed_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Partial types for each step
export interface Step1Data {
  selected_fund: string;
  class_a_units?: number;
  class_b_units?: number;
  class_c_units?: number;
  initial_investment_amount?: number;
}

export interface Step2Data {
  referral_source: ReferralSource;
  referral_source_other?: string;
}

export interface Step3Data {
  // Information intro - no data stored
}

export interface Step4Data {
  citizenship_country: string;
  residence_country: string;
}

export interface Step5Data {
  account_structure: AccountStructure;
}

export interface Step6Data {
  phone_number: string;
  phone_country_code: string;
}

export interface Step7Data {
  legal_first_name: string;
  legal_last_name: string;
}

export interface Step8Data {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  address_phone_number: string;
}

export interface Step9Data {
  ssn_encrypted: string;
  date_of_birth: string;
}

export interface Step10Data {
  initial_investment_amount: number;
}

export interface Step11Data {
  recurring_investment_enabled: boolean;
  recurring_frequency?: RecurringFrequency;
  recurring_amount?: number;
  recurring_day_of_month?: number;
}

export interface Step12Data {
  // Step 12 data (was Step 14)
}

export interface Step13Data {
  // Banking info (was Step 15)
}

// Onboarding context/state type
export interface OnboardingState {
  data: Partial<OnboardingData>;
  currentStep: number;
  isLoading: boolean;
  error: string | null;
}

// API Response types
export interface OnboardingResponse {
  success: boolean;
  data?: OnboardingData;
  error?: string;
}

export interface OnboardingStepUpdate {
  step: number;
  data: Partial<OnboardingData>;
  markComplete?: boolean;
}

// Helper function to migrate legacy account types
export function migrateAccountType(legacyType: string): AccountType {
  if (legacyType === 'general') return 'wealth_1m';
  if (legacyType === 'retirement') return 'wealth_5m';
  return legacyType as AccountType;
}
