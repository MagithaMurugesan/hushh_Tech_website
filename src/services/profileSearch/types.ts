// Types for Hushh Profile Search Service
// Maps API response to onboarding/profile fields

export interface ParsedAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ParsedPhone {
  countryCode: string;
  number: string;
}

export interface EnrichedProfileData {
  // Identity Core (maps to onboarding)
  age?: number;
  dob?: string; // YYYY-MM-DD
  address?: ParsedAddress;
  phone?: ParsedPhone;
  occupation?: string;
  nationality?: string;
  maritalStatus?: string;
  
  // Lifestyle Preferences (30+ categories)
  preferences: ProfilePreferences;
  
  // Metadata
  confidence: number;
  netWorthScore: number;
  netWorthContext?: string;
  sources: GroundingSource[];
  searchQuery: string;
  createdAt: string;
}

export interface ProfilePreferences {
  // Food & Drink
  diet?: string;
  foods?: string[];
  coffeePreferences?: string[];
  chaiPreferences?: string[];
  drinkPreferences?: string[];
  spiciness?: string;
  diningStyle?: string;
  restaurantTypes?: string[];
  deliveryApps?: string[];
  
  // Lifestyle
  hobbies?: string[];
  colors?: string[];
  likes?: string[];
  dislikes?: string[];
  smokePreferences?: string;
  fashionStyle?: string;
  fashionBrands?: string[];
  
  // Travel & Hotels
  hotelPreferences?: string[];
  travelStyle?: string;
  travelDestinations?: string[];
  travelFrequency?: string;
  
  // Entertainment
  musicGenres?: string[];
  musicArtists?: string[];
  musicPlatform?: string;
  streamingServices?: string[];
  movieGenres?: string[];
  showsWatching?: string[];
  gamingPlatform?: string;
  
  // Health & Fitness
  fitnessRoutine?: string[];
  healthApps?: string[];
  sleepPattern?: string;
  allergies?: string[];
  healthInsurance?: string[];
  meditationPractice?: string;
  
  // Work & Productivity
  workEnvironment?: string;
  productivityTools?: string[];
  workHours?: string;
  communicationPreference?: string;
  learningStyle?: string;
  
  // Tech
  brands?: string[];
  techEcosystem?: string;
  smartDevices?: string[];
  aiPreferences?: string[];
  
  // Financial
  investmentStyle?: string;
  shoppingBehavior?: string;
  paymentPreference?: string;
  
  // Social
  socialPersonality?: string;
  socialMediaUsage?: string;
  contentCreation?: string;
  petPreference?: string;
  pets?: string[];
  
  // Learning
  bookGenres?: string[];
  newsSources?: string[];
  podcasts?: string[];
  
  // Transport
  vehiclePreference?: string;
  transportMode?: string;
  
  // Beliefs
  spiritualBeliefs?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

// Preference category groups for UI display
export const PREFERENCE_CATEGORIES: Record<string, {
  label: string;
  icon: string;
  fields: (keyof ProfilePreferences)[];
}> = {
  FOOD_DRINK: {
    label: 'Food & Drink',
    icon: '🍽️',
    fields: ['diet', 'foods', 'coffeePreferences', 'chaiPreferences', 'drinkPreferences', 'spiciness', 'diningStyle', 'restaurantTypes', 'deliveryApps'],
  },
  LIFESTYLE: {
    label: 'Lifestyle',
    icon: '✨',
    fields: ['hobbies', 'colors', 'likes', 'dislikes', 'smokePreferences', 'fashionStyle', 'fashionBrands'],
  },
  TRAVEL: {
    label: 'Travel & Hotels',
    icon: '✈️',
    fields: ['hotelPreferences', 'travelStyle', 'travelDestinations', 'travelFrequency'],
  },
  ENTERTAINMENT: {
    label: 'Entertainment',
    icon: '🎬',
    fields: ['musicGenres', 'musicArtists', 'musicPlatform', 'streamingServices', 'movieGenres', 'showsWatching', 'gamingPlatform'],
  },
  HEALTH: {
    label: 'Health & Fitness',
    icon: '💪',
    fields: ['fitnessRoutine', 'healthApps', 'sleepPattern', 'allergies', 'healthInsurance', 'meditationPractice'],
  },
  WORK: {
    label: 'Work Style',
    icon: '💼',
    fields: ['workEnvironment', 'productivityTools', 'workHours', 'communicationPreference', 'learningStyle'],
  },
  TECH: {
    label: 'Tech',
    icon: '📱',
    fields: ['brands', 'techEcosystem', 'smartDevices', 'aiPreferences'],
  },
  FINANCIAL: {
    label: 'Financial',
    icon: '💰',
    fields: ['investmentStyle', 'shoppingBehavior', 'paymentPreference'],
  },
  SOCIAL: {
    label: 'Social',
    icon: '👥',
    fields: ['socialPersonality', 'socialMediaUsage', 'contentCreation', 'petPreference', 'pets'],
  },
  LEARNING: {
    label: 'Learning',
    icon: '📚',
    fields: ['bookGenres', 'newsSources', 'podcasts'],
  },
  TRANSPORT: {
    label: 'Transport',
    icon: '🚗',
    fields: ['vehiclePreference', 'transportMode'],
  },
};

// Field labels for display
export const PREFERENCE_FIELD_LABELS: Record<keyof ProfilePreferences, string> = {
  diet: 'Diet',
  foods: 'Favorite Foods',
  coffeePreferences: 'Coffee Preferences',
  chaiPreferences: 'Tea/Chai Preferences',
  drinkPreferences: 'Drink Preferences',
  spiciness: 'Spice Tolerance',
  diningStyle: 'Dining Style',
  restaurantTypes: 'Restaurant Types',
  deliveryApps: 'Delivery Apps',
  hobbies: 'Hobbies',
  colors: 'Favorite Colors',
  likes: 'Likes',
  dislikes: 'Dislikes',
  smokePreferences: 'Smoking',
  fashionStyle: 'Fashion Style',
  fashionBrands: 'Fashion Brands',
  hotelPreferences: 'Hotel Preferences',
  travelStyle: 'Travel Style',
  travelDestinations: 'Travel Destinations',
  travelFrequency: 'Travel Frequency',
  musicGenres: 'Music Genres',
  musicArtists: 'Music Artists',
  musicPlatform: 'Music Platform',
  streamingServices: 'Streaming Services',
  movieGenres: 'Movie Genres',
  showsWatching: 'Shows Watching',
  gamingPlatform: 'Gaming Platform',
  fitnessRoutine: 'Fitness Routine',
  healthApps: 'Health Apps',
  sleepPattern: 'Sleep Pattern',
  allergies: 'Allergies',
  healthInsurance: 'Health Insurance',
  meditationPractice: 'Meditation Practice',
  workEnvironment: 'Work Environment',
  productivityTools: 'Productivity Tools',
  workHours: 'Work Hours',
  communicationPreference: 'Communication Style',
  learningStyle: 'Learning Style',
  brands: 'Preferred Brands',
  techEcosystem: 'Tech Ecosystem',
  smartDevices: 'Smart Devices',
  aiPreferences: 'AI Preferences',
  investmentStyle: 'Investment Style',
  shoppingBehavior: 'Shopping Behavior',
  paymentPreference: 'Payment Preference',
  socialPersonality: 'Social Personality',
  socialMediaUsage: 'Social Media Usage',
  contentCreation: 'Content Creation',
  petPreference: 'Pet Preference',
  pets: 'Pets',
  bookGenres: 'Book Genres',
  newsSources: 'News Sources',
  podcasts: 'Podcasts',
  vehiclePreference: 'Vehicle Preference',
  transportMode: 'Transport Mode',
  spiritualBeliefs: 'Spiritual Beliefs',
};
