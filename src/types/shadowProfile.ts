export interface Associate {
  name: string;
  relation: string;
  strength: number;
  category: 'INNER' | 'ORBIT' | 'MEDIA' | 'RIVAL';
}

export interface NewsItem {
  date: string;
  source: string;
  title: string;
  summary: string;
}

export interface ShadowProfile {
  age: string;
  ageContext: string;
  gender: string;
  dob: string;
  occupation: string;
  nationality: string;
  address: string;
  contact: string;
  maritalStatus: string;
  children: string[];
  knownFor: string[];
  confidence: number;
  netWorthScore: number;
  netWorthContext: string;
  diet: string;
  foods: string[];
  hobbies: string[];
  brands: string[];
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
  associates: Associate[];
  socialMedia: { platform: string; url: string }[];
  news: NewsItem[];
}
