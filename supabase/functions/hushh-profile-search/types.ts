// Types for Hushh Profile Search API v3.0
// Enhanced with 25+ Preference Vectors for Comprehensive Psychographic Profiling

export interface StructuredData {
  // === IDENTITY CORE ===
  age: string;
  dob: string;
  address: string;
  contact: string;
  occupation: string;
  nationality: string;
  maritalStatus: string;
  children: string[];
  knownFor: string[];
  confidence: number;
  netWorthScore: number;
  netWorthContext: string;
  
  // === LIFESTYLE & PREFERENCES (Original 15) ===
  diet: string;
  foods: string[];
  hobbies: string[];
  brands: string[];
  associates: Associate[];
  colors: string[];
  likes: string[];
  dislikes: string[];
  allergies: string[];
  hotelPreferences: string[];
  coffeePreferences: string[];
  drinkPreferences: string[];
  smokePreferences: string;
  chaiPreferences: string[];
  spiciness: string;
  healthInsurance: string[];
  agentPreferences: string[];
  aiPreferences: string[];
  
  // === NEW PREFERENCES (Expanding to 25+) ===
  
  // 16. Music Preferences
  musicGenres: string[];          // e.g., ["Lo-Fi", "Indie", "Classical", "Hip-Hop"]
  musicArtists: string[];         // e.g., ["Taylor Swift", "The Weeknd", "A.R. Rahman"]
  musicPlatform: string;          // e.g., "Spotify", "Apple Music", "YouTube Music"
  
  // 17. Travel Preferences
  travelStyle: string;            // e.g., "Backpacker", "Luxury", "Adventure", "Business"
  travelDestinations: string[];   // e.g., ["Japan", "Iceland", "Dubai"]
  travelFrequency: string;        // e.g., "Monthly", "Quarterly", "Yearly"
  
  // 18. Entertainment Preferences
  streamingServices: string[];    // e.g., ["Netflix", "Prime", "Disney+", "Hulu"]
  movieGenres: string[];          // e.g., ["Sci-Fi", "Documentary", "Thriller"]
  showsWatching: string[];        // e.g., ["The Office", "Breaking Bad", "Anime"]
  
  // 19. Fashion & Style
  fashionStyle: string;           // e.g., "Minimalist", "Streetwear", "Business Casual", "Athleisure"
  fashionBrands: string[];        // e.g., ["Uniqlo", "Zara", "Gucci", "Nike"]
  
  // 20. Communication Style
  communicationPreference: string; // e.g., "Text", "Email", "Call", "Video"
  socialPersonality: string;       // e.g., "Introvert", "Extrovert", "Ambivert"
  
  // 21. Fitness & Health
  fitnessRoutine: string[];       // e.g., ["Gym", "Yoga", "Running", "Swimming"]
  healthApps: string[];           // e.g., ["MyFitnessPal", "Strava", "Calm"]
  sleepPattern: string;           // e.g., "Night Owl", "Early Bird", "Flexible"
  
  // 22. Reading & Learning
  bookGenres: string[];           // e.g., ["Business", "Self-Help", "Fiction", "Tech"]
  newsSources: string[];          // e.g., ["WSJ", "TechCrunch", "The Economist"]
  learningStyle: string;          // e.g., "Visual", "Audio (Podcasts)", "Reading", "Hands-on"
  podcasts: string[];             // e.g., ["Lex Fridman", "Tim Ferriss", "NPR"]
  
  // 23. Vehicle & Transportation
  vehiclePreference: string;      // e.g., "Tesla Model S", "BMW", "Public Transit", "Cycling"
  transportMode: string;          // e.g., "Car", "Uber", "Public Transit", "Walk"
  
  // 24. Pets & Animals
  petPreference: string;          // e.g., "Dog Person", "Cat Person", "No Pets", "Exotic"
  pets: string[];                 // e.g., ["Golden Retriever named Max"]
  
  // 25. Work Style
  workEnvironment: string;        // e.g., "Remote", "Hybrid", "Office", "Nomad"
  productivityTools: string[];    // e.g., ["Notion", "Slack", "Obsidian", "Figma"]
  workHours: string;              // e.g., "9-5", "Flexible", "Night Shifts"
  
  // 26. Financial Behavior
  investmentStyle: string;        // e.g., "Conservative", "Aggressive", "Index Funds", "Crypto"
  shoppingBehavior: string;       // e.g., "Impulse", "Researcher", "Deal Hunter", "Luxury"
  paymentPreference: string;      // e.g., "Apple Pay", "Credit Card", "Cash", "Crypto"
  
  // 27. Dining Preferences
  diningStyle: string;            // e.g., "Fine Dining", "Street Food", "Home Cook", "Fast Food"
  restaurantTypes: string[];      // e.g., ["Sushi", "Italian", "Indian", "Vegan"]
  deliveryApps: string[];         // e.g., ["DoorDash", "Uber Eats", "Swiggy"]
  
  // 28. Tech Ecosystem
  techEcosystem: string;          // e.g., "Apple", "Android/Google", "Windows", "Linux"
  smartDevices: string[];         // e.g., ["Apple Watch", "AirPods", "Ring Doorbell"]
  gamingPlatform: string;         // e.g., "PC", "PlayStation", "Nintendo", "Mobile", "None"
  
  // 29. Mindfulness & Spirituality
  meditationPractice: string;     // e.g., "Daily", "Occasional", "None", "Yoga"
  spiritualBeliefs: string;       // e.g., "Secular", "Buddhist", "Hindu", "Christian", "Agnostic"
  
  // 30. Social Media Behavior
  socialMediaUsage: string;       // e.g., "Heavy", "Moderate", "Minimal", "Lurker", "Creator"
  contentCreation: string;        // e.g., "YouTube", "Blog", "Twitter Threads", "None"
  
  // === IDENTITY ===
  socialMedia: SocialProfile[];

  // === NEWS & TIMELINE ===
  news: NewsItem[];
}

export interface Associate {
  name: string;
  relation: string;
}

export interface SocialProfile {
  platform: string;
  url: string;
}

export interface NewsItem {
  date: string;
  source: string;
  title: string;
  summary?: string;
  url?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ProfileResult {
  structured: StructuredData;
  biography: string;
  sources: GroundingSource[];
  // New: Preference count for validation
  preferenceCount?: number;
}

export interface SearchParams {
  name: string;
  country?: string;
  email: string;
  contact: string;
}

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

// Preference categories for UI grouping
export const PREFERENCE_CATEGORIES = {
  FOOD_DRINK: ['diet', 'foods', 'coffeePreferences', 'chaiPreferences', 'drinkPreferences', 'spiciness', 'diningStyle', 'restaurantTypes', 'deliveryApps'],
  LIFESTYLE: ['hobbies', 'colors', 'likes', 'dislikes', 'smokePreferences', 'fashionStyle', 'fashionBrands'],
  TRAVEL_HOTELS: ['hotelPreferences', 'travelStyle', 'travelDestinations', 'travelFrequency'],
  ENTERTAINMENT: ['musicGenres', 'musicArtists', 'musicPlatform', 'streamingServices', 'movieGenres', 'showsWatching', 'gamingPlatform'],
  HEALTH_FITNESS: ['fitnessRoutine', 'healthApps', 'sleepPattern', 'allergies', 'healthInsurance', 'meditationPractice'],
  WORK_PRODUCTIVITY: ['workEnvironment', 'productivityTools', 'workHours', 'communicationPreference', 'learningStyle'],
  TECH: ['brands', 'techEcosystem', 'smartDevices', 'aiPreferences'],
  FINANCIAL: ['investmentStyle', 'shoppingBehavior', 'paymentPreference'],
  SOCIAL: ['socialPersonality', 'socialMediaUsage', 'contentCreation', 'petPreference', 'pets'],
  LEARNING: ['bookGenres', 'newsSources', 'podcasts'],
  TRANSPORT: ['vehiclePreference', 'transportMode'],
  BELIEFS: ['spiritualBeliefs']
} as const;
