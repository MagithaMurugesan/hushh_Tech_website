// Hushh Profile Search API - Supabase Edge Function
// Advanced Profile Intelligence Engine v2.0
// Uses Gemini 3 Pro Preview via Vertex AI with Google Search grounding
// Features: Phone Intelligence, Email Domain Analysis, Multi-Phase Search, Name Variants

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import md5 from "blueimp-md5";
import { corsHeaders } from "../_shared/cors.ts";
import type { 
  ProfileResult, 
  StructuredData, 
  GroundingSource, 
  NewsItem, 
  Associate,
  SocialProfile,
  SearchParams 
} from "./types.ts";

// Vertex AI Configuration
const PROJECT_ID = Deno.env.get("GCP_PROJECT_ID") || "hushone-app";
const MODEL_ID = "gemini-3-pro-preview";
const VERTEX_AI_LOCATION = "global";

// =============================================================================
// PHONE NUMBER INTELLIGENCE
// =============================================================================
interface PhoneIntelligence {
  countryCode: string;
  countryName: string;
  region: string;
  carrier?: string;
  phoneType: 'mobile' | 'landline' | 'voip' | 'unknown';
  formatted: string;
  searchHints: string[];
}

const COUNTRY_CODE_MAP: Record<string, { name: string; region: string; platforms: string[] }> = {
  '+1': { name: 'USA/Canada', region: 'North America', platforms: ['LinkedIn', 'Twitter', 'Facebook', 'Instagram'] },
  '+44': { name: 'United Kingdom', region: 'Europe', platforms: ['LinkedIn', 'Twitter', 'Instagram'] },
  '+91': { name: 'India', region: 'South Asia', platforms: ['LinkedIn', 'Twitter', 'Instagram', 'Koo'] },
  '+86': { name: 'China', region: 'East Asia', platforms: ['WeChat', 'Weibo', 'LinkedIn'] },
  '+81': { name: 'Japan', region: 'East Asia', platforms: ['LinkedIn', 'Twitter', 'LINE'] },
  '+49': { name: 'Germany', region: 'Europe', platforms: ['LinkedIn', 'Xing', 'Twitter'] },
  '+33': { name: 'France', region: 'Europe', platforms: ['LinkedIn', 'Twitter', 'Instagram'] },
  '+971': { name: 'UAE', region: 'Middle East', platforms: ['LinkedIn', 'Instagram', 'Twitter'] },
  '+65': { name: 'Singapore', region: 'Southeast Asia', platforms: ['LinkedIn', 'Twitter', 'Instagram'] },
  '+852': { name: 'Hong Kong', region: 'East Asia', platforms: ['LinkedIn', 'Twitter', 'Instagram'] },
  '+61': { name: 'Australia', region: 'Oceania', platforms: ['LinkedIn', 'Twitter', 'Instagram'] },
  '+55': { name: 'Brazil', region: 'South America', platforms: ['LinkedIn', 'Instagram', 'Twitter', 'WhatsApp'] },
  '+7': { name: 'Russia', region: 'Eurasia', platforms: ['VK', 'Telegram', 'LinkedIn'] },
  '+82': { name: 'South Korea', region: 'East Asia', platforms: ['LinkedIn', 'KakaoTalk', 'Naver'] },
};

const parsePhoneIntelligence = (phone: string): PhoneIntelligence => {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Find matching country code (longest match first)
  let matchedCode = '';
  let countryInfo = { name: 'Unknown', region: 'Global', platforms: ['LinkedIn', 'Twitter'] };
  
  for (const code of Object.keys(COUNTRY_CODE_MAP).sort((a, b) => b.length - a.length)) {
    if (cleaned.startsWith(code)) {
      matchedCode = code;
      countryInfo = COUNTRY_CODE_MAP[code];
      break;
    }
  }
  
  // Determine phone type based on patterns
  const nationalNumber = cleaned.replace(matchedCode, '');
  let phoneType: 'mobile' | 'landline' | 'voip' | 'unknown' = 'unknown';
  
  // Mobile detection heuristics
  if (matchedCode === '+1' && nationalNumber.length === 10) {
    phoneType = 'mobile'; // Most +1 10-digit are mobile
  } else if (matchedCode === '+91' && nationalNumber.startsWith('9')) {
    phoneType = 'mobile'; // India mobile starts with 9
  } else if (matchedCode === '+44' && nationalNumber.startsWith('7')) {
    phoneType = 'mobile'; // UK mobile starts with 7
  } else if (nationalNumber.length >= 9) {
    phoneType = 'mobile'; // Default assumption for long numbers
  }
  
  // Generate search hints based on region
  const searchHints: string[] = [];
  if (countryInfo.region === 'North America') {
    searchHints.push('Search US business registrations', 'Check LinkedIn company pages');
  } else if (countryInfo.region === 'South Asia') {
    searchHints.push('Search Indian company registrar (MCA)', 'Check LinkedIn India');
  } else if (countryInfo.region === 'Europe') {
    searchHints.push('Search European business directories', 'Check XING for German connections');
  } else if (countryInfo.region === 'East Asia') {
    searchHints.push('Search regional business platforms', 'Check local social networks');
  }
  
  return {
    countryCode: matchedCode || '+1',
    countryName: countryInfo.name,
    region: countryInfo.region,
    phoneType,
    formatted: cleaned,
    searchHints
  };
};

// =============================================================================
// EMAIL DOMAIN INTELLIGENCE
// =============================================================================
interface EmailIntelligence {
  handle: string;
  domain: string;
  domainType: 'corporate' | 'personal' | 'educational' | 'government';
  organization?: string;
  industry?: string;
  searchStrategy: string;
}

const DOMAIN_PATTERNS: Record<string, { type: EmailIntelligence['domainType']; org?: string; industry?: string }> = {
  'gmail.com': { type: 'personal' },
  'yahoo.com': { type: 'personal' },
  'hotmail.com': { type: 'personal' },
  'outlook.com': { type: 'personal' },
  'icloud.com': { type: 'personal' },
  'protonmail.com': { type: 'personal' },
  'microsoft.com': { type: 'corporate', org: 'Microsoft', industry: 'Technology' },
  'google.com': { type: 'corporate', org: 'Google', industry: 'Technology' },
  'apple.com': { type: 'corporate', org: 'Apple', industry: 'Technology' },
  'amazon.com': { type: 'corporate', org: 'Amazon', industry: 'E-commerce/Cloud' },
  'meta.com': { type: 'corporate', org: 'Meta', industry: 'Technology/Social' },
  'facebook.com': { type: 'corporate', org: 'Meta', industry: 'Technology/Social' },
  'nvidia.com': { type: 'corporate', org: 'NVIDIA', industry: 'Semiconductors/AI' },
  'tesla.com': { type: 'corporate', org: 'Tesla', industry: 'Automotive/Energy' },
  'openai.com': { type: 'corporate', org: 'OpenAI', industry: 'AI Research' },
  'anthropic.com': { type: 'corporate', org: 'Anthropic', industry: 'AI Research' },
  '.edu': { type: 'educational' },
  '.gov': { type: 'government' },
  '.ac.uk': { type: 'educational' },
  '.ac.in': { type: 'educational' },
};

const parseEmailIntelligence = (email: string): EmailIntelligence => {
  const [handle, domain] = email.toLowerCase().split('@');
  
  // Check exact domain match first
  let domainInfo = DOMAIN_PATTERNS[domain];
  
  // Check suffix patterns
  if (!domainInfo) {
    for (const [suffix, info] of Object.entries(DOMAIN_PATTERNS)) {
      if (suffix.startsWith('.') && domain.endsWith(suffix)) {
        domainInfo = info;
        break;
      }
    }
  }
  
  // Default to corporate if unknown
  if (!domainInfo) {
    domainInfo = { type: 'corporate' };
  }
  
  // Infer organization from domain if not known
  let organization = domainInfo.org;
  if (!organization && domainInfo.type === 'corporate') {
    // Extract company name from domain (e.g., company.com -> Company)
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      organization = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
    }
  }
  
  // Determine search strategy
  let searchStrategy = '';
  switch (domainInfo.type) {
    case 'corporate':
      searchStrategy = `Focus on ${organization || 'corporate'} company pages, press releases, and executive profiles. Check Crunchbase, LinkedIn Company, and corporate news.`;
      break;
    case 'personal':
      searchStrategy = `Focus on personal social media, side projects, and public profiles. The handle "${handle}" is likely reused across platforms.`;
      break;
    case 'educational':
      searchStrategy = `Focus on academic publications, research papers, university profiles, and Google Scholar.`;
      break;
    case 'government':
      searchStrategy = `Focus on government directories, public records, and official announcements.`;
      break;
  }
  
  return {
    handle,
    domain,
    domainType: domainInfo.type,
    organization,
    industry: domainInfo.industry,
    searchStrategy
  };
};

// =============================================================================
// NAME VARIANT GENERATION
// =============================================================================
interface NameVariants {
  original: string;
  firstName: string;
  lastName: string;
  initials: string;
  nicknames: string[];
  formalVariations: string[];
  searchQueries: string[];
}

const NICKNAME_MAP: Record<string, string[]> = {
  'william': ['will', 'bill', 'billy', 'willy'],
  'robert': ['rob', 'bob', 'bobby', 'robbie'],
  'richard': ['rick', 'dick', 'richie', 'ricky'],
  'james': ['jim', 'jimmy', 'jamie'],
  'michael': ['mike', 'mikey', 'mick'],
  'joseph': ['joe', 'joey'],
  'thomas': ['tom', 'tommy'],
  'charles': ['charlie', 'chuck', 'chas'],
  'daniel': ['dan', 'danny'],
  'matthew': ['matt', 'matty'],
  'christopher': ['chris', 'kit'],
  'anthony': ['tony', 'ant'],
  'steven': ['steve', 'stevie'],
  'edward': ['ed', 'eddie', 'ted', 'teddy'],
  'elizabeth': ['liz', 'lizzy', 'beth', 'betty', 'eliza'],
  'jennifer': ['jen', 'jenny', 'jenn'],
  'margaret': ['maggie', 'meg', 'peggy', 'marge'],
  'katherine': ['kate', 'kathy', 'katie', 'kat'],
  'patricia': ['pat', 'patty', 'trish'],
  'samantha': ['sam', 'sammy'],
  'alexandra': ['alex', 'alexa', 'lexi', 'xandra'],
  'benjamin': ['ben', 'benny', 'benji'],
  'nicholas': ['nick', 'nicky'],
  'alexander': ['alex', 'xander', 'sandy'],
  'jonathan': ['jon', 'johnny', 'nathan'],
  'nathaniel': ['nate', 'nathan', 'nat'],
  'theodore': ['theo', 'ted', 'teddy'],
  'satya': ['satya'], // Indian names often don't have nicknames
  'sundar': ['sundar'],
  'jensen': ['jensen'],
  'elon': ['elon'],
};

const generateNameVariants = (fullName: string): NameVariants => {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts[parts.length - 1] || '';
  const middleNames = parts.slice(1, -1);
  
  // Generate initials
  const initials = parts.map(p => p.charAt(0).toUpperCase()).join('');
  
  // Find nicknames for first name
  const firstNameLower = firstName.toLowerCase();
  const nicknames: string[] = [];
  
  // Check direct mapping
  if (NICKNAME_MAP[firstNameLower]) {
    nicknames.push(...NICKNAME_MAP[firstNameLower]);
  }
  
  // Check reverse mapping (if given name is a nickname)
  for (const [formal, nicks] of Object.entries(NICKNAME_MAP)) {
    if (nicks.includes(firstNameLower)) {
      nicknames.push(formal);
      nicknames.push(...nicks.filter(n => n !== firstNameLower));
    }
  }
  
  // Generate formal variations
  const formalVariations: string[] = [
    fullName,
    `${firstName} ${lastName}`,
    `${firstName.charAt(0)}. ${lastName}`,
    `${firstName} ${middleNames.map(m => m.charAt(0) + '.').join(' ')} ${lastName}`.trim(),
  ];
  
  // Add nickname-based variations
  nicknames.forEach(nick => {
    formalVariations.push(`${nick.charAt(0).toUpperCase() + nick.slice(1)} ${lastName}`);
  });
  
  // Generate search queries
  const searchQueries: string[] = [
    `"${fullName}"`,
    `"${firstName} ${lastName}"`,
    `"${lastName}, ${firstName}"`,
  ];
  
  // Add nickname search queries
  nicknames.slice(0, 3).forEach(nick => {
    searchQueries.push(`"${nick.charAt(0).toUpperCase() + nick.slice(1)} ${lastName}"`);
  });
  
  return {
    original: fullName,
    firstName,
    lastName,
    initials,
    nicknames: [...new Set(nicknames)],
    formalVariations: [...new Set(formalVariations)],
    searchQueries: [...new Set(searchQueries)]
  };
};

// Get OAuth access token for Vertex AI
const getAccessToken = async (): Promise<string> => {
  // Try different token sources - check for fresh OAuth token first
  const accessToken = Deno.env.get("GCP_ACCESS_TOKEN") || Deno.env.get("GOOGLE_ACCESS_TOKEN");
  if (accessToken && accessToken.length > 50) {
    console.log("Using GCP_ACCESS_TOKEN from environment");
    return accessToken;
  }
  
  // Try to get token from service account JSON
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (serviceAccountJson) {
    try {
      console.log("Attempting to generate access token from service account...");
      const sa = JSON.parse(serviceAccountJson);
      
      if (!sa.private_key || !sa.client_email) {
        throw new Error("Service account JSON missing private_key or client_email");
      }
      
      // Generate JWT for OAuth
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: "RS256", typ: "JWT" };
      const payload = {
        iss: sa.client_email,
        sub: sa.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
      };
      
      // Base64URL encode header and payload
      const encoder = new TextEncoder();
      const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const unsignedJwt = `${headerB64}.${payloadB64}`;
      
      // Parse the PEM private key properly
      // Handle both cases: actual newlines and escaped \n strings
      let privateKeyPem = sa.private_key;
      if (!privateKeyPem.includes('\n') && privateKeyPem.includes('\\n')) {
        privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
      }
      
      // Extract the base64 content between PEM headers
      const pemHeader = "-----BEGIN PRIVATE KEY-----";
      const pemFooter = "-----END PRIVATE KEY-----";
      const startIdx = privateKeyPem.indexOf(pemHeader);
      const endIdx = privateKeyPem.indexOf(pemFooter);
      
      if (startIdx === -1 || endIdx === -1) {
        throw new Error("Invalid PEM format: missing headers");
      }
      
      const pemBody = privateKeyPem
        .substring(startIdx + pemHeader.length, endIdx)
        .replace(/[\r\n\s]/g, '');
      
      // Decode base64 to binary
      const binaryString = atob(pemBody);
      const binaryKey = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        binaryKey[i] = binaryString.charCodeAt(i);
      }
      
      // Import the private key using Web Crypto API
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      // Sign the JWT
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        encoder.encode(unsignedJwt)
      );
      
      // Base64URL encode the signature
      const signatureArray = new Uint8Array(signature);
      let signatureB64 = '';
      for (let i = 0; i < signatureArray.length; i++) {
        signatureB64 += String.fromCharCode(signatureArray[i]);
      }
      signatureB64 = btoa(signatureB64).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      
      const signedJwt = `${unsignedJwt}.${signatureB64}`;
      
      console.log(`Generated signed JWT for ${sa.client_email}`);
      
      // Exchange JWT for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        console.error("Token exchange error:", tokenData.error, tokenData.error_description);
        throw new Error(`Token exchange failed: ${tokenData.error} - ${tokenData.error_description}`);
      }
      
      if (tokenData.access_token) {
        console.log("Successfully obtained OAuth access token from service account");
        return tokenData.access_token;
      }
      
      throw new Error("Token response missing access_token field");
    } catch (e) {
      console.error("Failed to get access token from service account:", e);
      throw e;
    }
  }
  
  throw new Error("No valid GCP access token found. Please set GCP_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON");
};

// Call Vertex AI Gemini API with Thinking Protocol
const callVertexAI = async (prompt: string): Promise<any> => {
  const accessToken = await getAccessToken();
  
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;
  
  // Enhanced request with Chain-of-Thought Reasoning via Prompt Engineering
  // Note: thinkingConfig is not yet supported on gemini-3-pro-preview via Vertex AI
  // We achieve similar results through detailed prompt instructions for mathematical reasoning
  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,  // Increased for detailed reasoning + response
      // System 2 Thinking: Achieved through prompt engineering with explicit
      // reasoning trace requirements in the prompt itself
    },
    // Google Search Grounding - enables real-time web search
    tools: [{
      googleSearch: {}
    }],
    // Safety settings for comprehensive search
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };
  
  console.log(`🧠 Calling Vertex AI with Prompt-Based CoT Reasoning`);
  console.log(`📡 Endpoint: ${endpoint}`);
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Vertex AI Error:", errorText);
    throw new Error(`Vertex AI API error: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  // Log thinking metadata if available
  if (result.candidates?.[0]?.thinkingMetadata) {
    const thinkingMeta = result.candidates[0].thinkingMetadata;
    console.log(`🧠 Thinking completed: ${thinkingMeta.thoughtTokenCount || 'N/A'} thought tokens used`);
  }
  
  return result;
};

// =============================================================================
// GRAVATAR FETCH (Server-side - no CORS issues)
// =============================================================================
const fetchGravatarData = async (email: string): Promise<any> => {
  try {
    const hash = md5(email.trim().toLowerCase());
    const gravatarUrl = `https://en.gravatar.com/${hash}.json`;
    
    // Direct fetch - no CORS proxy needed server-side
    const response = await fetch(gravatarUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.entry?.[0] || null;
  } catch (e) {
    console.warn("Gravatar fetch failed, proceeding with standard signal intelligence.", e);
    return null;
  }
};

// =============================================================================
// STRUCTURED DATA PARSER (Exact copy from React app)
// =============================================================================
const parseStructuredData = (text: string): { structured: StructuredData; biography: string } => {
  const blockRegex = /---START_DATA---([\s\S]*?)---END_DATA---/;
  const match = text.match(blockRegex);

  const defaultData: StructuredData = {
    // Identity Core
    age: "Unknown",
    dob: "Unknown",
    occupation: "Unverified",
    nationality: "Unknown",
    address: "Hidden",
    contact: "Unlisted",
    maritalStatus: "Unknown",
    children: [],
    knownFor: [],
    confidence: 0,
    netWorthScore: 0,
    netWorthContext: "Assets obscured or data insufficient.",
    
    // Original 15 Preferences
    diet: "Unspecified",
    foods: [],
    hobbies: [],
    brands: [],
    associates: [],
    colors: [],
    likes: [],
    dislikes: [],
    allergies: [],
    hotelPreferences: [],
    coffeePreferences: [],
    drinkPreferences: [],
    smokePreferences: "Unknown",
    chaiPreferences: [],
    spiciness: "Unknown",
    healthInsurance: [],
    agentPreferences: [],
    aiPreferences: [],
    
    // NEW: Music Preferences (16)
    musicGenres: [],
    musicArtists: [],
    musicPlatform: "Unknown",
    
    // NEW: Travel Preferences (17)
    travelStyle: "Unknown",
    travelDestinations: [],
    travelFrequency: "Unknown",
    
    // NEW: Entertainment (18)
    streamingServices: [],
    movieGenres: [],
    showsWatching: [],
    
    // NEW: Fashion (19)
    fashionStyle: "Unknown",
    fashionBrands: [],
    
    // NEW: Communication (20)
    communicationPreference: "Unknown",
    socialPersonality: "Unknown",
    
    // NEW: Fitness (21)
    fitnessRoutine: [],
    healthApps: [],
    sleepPattern: "Unknown",
    
    // NEW: Reading & Learning (22)
    bookGenres: [],
    newsSources: [],
    learningStyle: "Unknown",
    podcasts: [],
    
    // NEW: Vehicle (23)
    vehiclePreference: "Unknown",
    transportMode: "Unknown",
    
    // NEW: Pets (24)
    petPreference: "Unknown",
    pets: [],
    
    // NEW: Work Style (25)
    workEnvironment: "Unknown",
    productivityTools: [],
    workHours: "Unknown",
    
    // NEW: Financial (26)
    investmentStyle: "Unknown",
    shoppingBehavior: "Unknown",
    paymentPreference: "Unknown",
    
    // NEW: Dining (27)
    diningStyle: "Unknown",
    restaurantTypes: [],
    deliveryApps: [],
    
    // NEW: Tech Ecosystem (28)
    techEcosystem: "Unknown",
    smartDevices: [],
    gamingPlatform: "Unknown",
    
    // NEW: Mindfulness (29)
    meditationPractice: "Unknown",
    spiritualBeliefs: "Unknown",
    
    // NEW: Social Media Behavior (30)
    socialMediaUsage: "Unknown",
    contentCreation: "Unknown",
    
    // Identity
    socialMedia: [],
    news: []
  };

  if (!match) {
    return { structured: defaultData, biography: text };
  }

  const dataBlock = match[1];
  const cleanBio = text.replace(blockRegex, "").trim();
  const result = { ...defaultData };

  // Helper to safely parse numbers between 0-100
  const parseScore = (val: string): number => {
    const scoreMatch = val.match(/(\d+)/);
    if (!scoreMatch) return 0;
    
    let num = parseInt(scoreMatch[0], 10);
    if (isNaN(num)) return 0;
    return Math.min(100, Math.max(0, num));
  };

  // Platforms that MUST have a path (e.g. twitter.com is invalid, twitter.com/user is valid)
  const platformsRequiringPath = [
    'linkedin.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com', 
    'github.com', 'youtube.com', 'tiktok.com', 'pinterest.com', 
    'medium.com', 'substack.com', 'dribbble.com', 'behance.net',
    'gitlab.com', 'stackoverflow.com', 'twitch.tv', 'vimeo.com', 'sketchfab.com'
  ];

  // Helper to check if a URL is a valid profile and not a search result/directory
  const isValidProfileUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    // Block list for generic directory/search paths and aggregators
    const blockList = [
      '/pub/dir/', '/public/', '/search', '/explore', '/directory', 
      '/people/', '/company/', '/topics/', '/hashtag/', '/home', '/login', '/signup',
      'rocketreach', 'zoominfo', 'spokeo', 'whitepages', 'radaris', 
      'lusha', 'contactout', 'apollo.io', 'signalhire', 'beenverified',
      'intelius', 'mylife', 'truthfinder', 'fastpeoplesearch'
    ];

    if (blockList.some(term => lower.includes(term))) return false;

    // Reject content/post URLs
    const contentPatterns = [
        /\/status\/\d+/, // Twitter status
        /\/p\//,         // Instagram photo
        /\/reel\//,      // Instagram/FB reel
        /\/watch\?v=/,   // YouTube video
        /\/video\//,     // TikTok video
        /\/posts\//,     // General posts
        /\/article\//    // LinkedIn article
    ];
    if (contentPatterns.some(pattern => pattern.test(lower))) return false;

    try {
      // Normalize URL
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = u.hostname.replace(/^www\./, '');

      // Check for platforms that require a path (handle)
      if (platformsRequiringPath.some(p => domain.includes(p))) {
         if (u.pathname === '/' || u.pathname === '' || u.pathname.length < 2) {
             return false;
         }
      }
      
      // Additional Platform Specific Logic
      // Allow international linkedin domains (uk.linkedin.com) but ensure /in/ exists
      if (domain.includes('linkedin.') && !lower.includes('/in/')) return false;
      
    } catch (e) {
      return false; 
    }

    return true;
  };

  // Parse line by line with more robust splitting
  const lines = dataBlock.split('\n');
  lines.forEach(line => {
    // Remove potential markdown asterisks from keys e.g. **AGE**
    const cleanLine = line.replace(/\*\*/g, '').trim();
    if (!cleanLine) return;

    const separatorIndex = cleanLine.indexOf(':');
    if (separatorIndex > -1) {
      const key = cleanLine.substring(0, separatorIndex).trim().toUpperCase();
      const value = cleanLine.substring(separatorIndex + 1).trim();
      
      if (value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined') {
        const parseList = (val: string) => val.split(',').map(s => s.trim()).filter(s => {
            const lower = s.toLowerCase();
            return s.length > 0 && !['none', 'unknown', 'n/a', 'null', 'undefined', 'not specified'].includes(lower);
        });

        switch (key) {
          case 'AGE': result.age = value; break;
          case 'DOB': result.dob = value; break;
          case 'OCCUPATION': result.occupation = value; break;
          case 'NATIONALITY': result.nationality = value; break;
          case 'ADDRESS': result.address = value; break;
          case 'CONTACT': result.contact = value; break;
          case 'MARITAL_STATUS': result.maritalStatus = value; break;
          case 'CHILDREN': result.children = parseList(value); break;
          case 'KNOWN_FOR': result.knownFor = parseList(value); break;
          case 'CONFIDENCE': 
            result.confidence = parseScore(value);
            break;
          case 'NET_WORTH_SCORE':
            result.netWorthScore = parseScore(value);
            break;
          case 'NET_WORTH_CONTEXT': result.netWorthContext = value; break;
          
          // Lists
          case 'DIET': result.diet = value; break;
          case 'FOODS': result.foods = parseList(value); break;
          case 'HOBBIES': result.hobbies = parseList(value); break;
          case 'BRANDS': result.brands = parseList(value); break;
          
          // Network Graph (Associates)
          case 'ASSOCIATES': 
             result.associates = value.split(',').map(item => {
               const parts = item.split('|');
               if (parts.length > 1) {
                 return { name: parts[0].trim(), relation: parts[1].trim() };
               }
               const cleanName = item.trim();
               return cleanName ? { name: cleanName, relation: 'Connected' } : null;
             }).filter((a): a is Associate => a !== null && a.name.length > 0 && !['none', 'unknown'].includes(a.name.toLowerCase()));
             break;

          // Social Identity
          case 'SOCIAL': {
             // 1. Clean Markdown Links first: [Link Text](URL)
             let cleanedValue = value;
             const mdLinkMatch = value.match(/\((https?:\/\/[^)]+)\)/);
             if (mdLinkMatch) {
                 cleanedValue = mdLinkMatch[1]; // Use extracted URL
             }
             
             // 2. Parse "Platform | URL" format
             const pipeParts = cleanedValue.split('|');
             let platform = '';
             let url = '';

             if (pipeParts.length >= 2) {
                 platform = pipeParts[0].trim();
                 url = pipeParts.slice(1).join('|').trim();
             } else {
                 // Fallback: Try to find a raw URL in the string
                 const urlMatch = cleanedValue.match(/(https?:\/\/[^\s]+)/);
                 if (urlMatch) {
                     url = urlMatch[0];
                     platform = 'Web';
                 }
             }

             // 3. Post-Cleaning of URL
             if (url) {
                // Remove trailing punctuation like ')' or '.' or '>'
                url = url.replace(/[)>.,;]+$/, '');
                
                // Add protocol if missing
                if (!url.startsWith('http') && !url.startsWith('//')) {
                   url = 'https://' + url;
                }
             }
             
             // 4. Clean Tracking Params
             if (url) {
                try {
                    const u = new URL(url);
                    u.search = ''; // Remove query params like ?s=20
                    u.hash = '';   // Remove anchors
                    url = u.toString();
                    if (url.endsWith('/')) url = url.slice(0, -1);
                } catch (e) {}
             }

             // 5. Validation & Deduplication
             if (url && url.toLowerCase() !== 'none' && url.includes('.')) {
                 if (isValidProfileUrl(url)) {
                     const exists = result.socialMedia.some(
                         p => p.url.toLowerCase() === url.toLowerCase()
                     );
                     
                     if (!exists) {
                         // Infer platform from URL if generic
                         if ((!platform || platform === 'Web') && url) {
                             try {
                                 const u = new URL(url);
                                 const host = u.hostname.replace('www.', '').split('.')[0];
                                 platform = host.charAt(0).toUpperCase() + host.slice(1);
                             } catch {}
                         }
                         
                         result.socialMedia.push({ platform: platform || 'Link', url });
                     }
                 }
             }
             break;
          }
          
          // New Preferences
          case 'COLORS': result.colors = parseList(value); break;
          case 'LIKES': result.likes = parseList(value); break;
          case 'DISLIKES': result.dislikes = parseList(value); break;
          case 'ALLERGIES': result.allergies = parseList(value); break;
          case 'HOTELS': result.hotelPreferences = parseList(value); break;
          case 'COFFEE': result.coffeePreferences = parseList(value); break;
          case 'DRINKS': result.drinkPreferences = parseList(value); break;
          case 'SMOKE': result.smokePreferences = value; break;
          case 'CHAI': result.chaiPreferences = parseList(value); break;
          case 'SPICINESS': result.spiciness = value; break;
          case 'INSURANCE': result.healthInsurance = parseList(value); break;
          case 'AGENTS': result.agentPreferences = parseList(value); break;
          case 'AI_SENTIMENT': result.aiPreferences = parseList(value); break;
          
          // =========== NEW PREFERENCE CATEGORIES (16-30) ===========
          
          // 16. Music Preferences
          case 'MUSIC_GENRES': result.musicGenres = parseList(value); break;
          case 'MUSIC_ARTISTS': result.musicArtists = parseList(value); break;
          case 'MUSIC_PLATFORM': result.musicPlatform = value; break;
          
          // 17. Travel Preferences
          case 'TRAVEL_STYLE': result.travelStyle = value; break;
          case 'TRAVEL_DESTINATIONS': result.travelDestinations = parseList(value); break;
          case 'TRAVEL_FREQUENCY': result.travelFrequency = value; break;
          
          // 18. Entertainment
          case 'STREAMING': result.streamingServices = parseList(value); break;
          case 'MOVIE_GENRES': result.movieGenres = parseList(value); break;
          case 'SHOWS': result.showsWatching = parseList(value); break;
          
          // 19. Fashion
          case 'FASHION_STYLE': result.fashionStyle = value; break;
          case 'FASHION_BRANDS': result.fashionBrands = parseList(value); break;
          
          // 20. Communication
          case 'COMMUNICATION': result.communicationPreference = value; break;
          case 'PERSONALITY': result.socialPersonality = value; break;
          
          // 21. Fitness
          case 'FITNESS': result.fitnessRoutine = parseList(value); break;
          case 'HEALTH_APPS': result.healthApps = parseList(value); break;
          case 'SLEEP_PATTERN': result.sleepPattern = value; break;
          
          // 22. Reading & Learning
          case 'BOOK_GENRES': result.bookGenres = parseList(value); break;
          case 'NEWS_SOURCES': result.newsSources = parseList(value); break;
          case 'LEARNING_STYLE': result.learningStyle = value; break;
          case 'PODCASTS': result.podcasts = parseList(value); break;
          
          // 23. Vehicle
          case 'VEHICLE': result.vehiclePreference = value; break;
          case 'TRANSPORT': result.transportMode = value; break;
          
          // 24. Pets
          case 'PET_PREFERENCE': result.petPreference = value; break;
          case 'PETS': result.pets = parseList(value); break;
          
          // 25. Work Style
          case 'WORK_ENVIRONMENT': result.workEnvironment = value; break;
          case 'PRODUCTIVITY_TOOLS': result.productivityTools = parseList(value); break;
          case 'WORK_HOURS': result.workHours = value; break;
          
          // 26. Financial
          case 'INVESTMENT_STYLE': result.investmentStyle = value; break;
          case 'SHOPPING_BEHAVIOR': result.shoppingBehavior = value; break;
          case 'PAYMENT_PREFERENCE': result.paymentPreference = value; break;
          
          // 27. Dining
          case 'DINING_STYLE': result.diningStyle = value; break;
          case 'RESTAURANT_TYPES': result.restaurantTypes = parseList(value); break;
          case 'DELIVERY_APPS': result.deliveryApps = parseList(value); break;
          
          // 28. Tech Ecosystem
          case 'TECH_ECOSYSTEM': result.techEcosystem = value; break;
          case 'SMART_DEVICES': result.smartDevices = parseList(value); break;
          case 'GAMING': result.gamingPlatform = value; break;
          
          // 29. Mindfulness
          case 'MEDITATION': result.meditationPractice = value; break;
          case 'SPIRITUALITY': result.spiritualBeliefs = value; break;
          
          // 30. Social Media Behavior
          case 'SOCIAL_MEDIA_USAGE': result.socialMediaUsage = value; break;
          case 'CONTENT_CREATION': result.contentCreation = value; break;

          // News - Accumulate items instead of overwriting
          case 'NEWS': {
            const newItems = value.split('||').map((item): NewsItem | null => {
              // Expected format: Date | Source | Title | Summary
              const parts = item.split('|').map(s => s.trim());
              if (parts.length >= 3) {
                return {
                  date: parts[0],
                  source: parts[1],
                  title: parts[2],
                  summary: parts[3] || "Restricted. Click to verify source."
                };
              }
              return null;
            }).filter((n): n is NewsItem => n !== null);
            
            if (newItems.length > 0) {
                result.news = [...result.news, ...newItems];
            }
            break;
          }
        }
      }
    }
  });

  return { structured: result, biography: cleanBio };
};

// =============================================================================
// SEARCH PERSON (Enhanced with Multi-Signal Intelligence)
// =============================================================================
const searchPerson = async (params: SearchParams): Promise<ProfileResult> => {
  try {
    const { name, country, email, contact } = params;
    
    // =========================================================================
    // PHASE 0: MULTI-SIGNAL INTELLIGENCE GATHERING
    // =========================================================================
    console.log("🔍 Initiating Multi-Signal Intelligence Gathering...");
    
    // 0.1 Parse Email Intelligence
    const emailIntel = parseEmailIntelligence(email);
    console.log(`📧 Email Intel: ${emailIntel.domainType} domain (${emailIntel.organization || 'Unknown Org'})`);
    
    // 0.2 Parse Phone Intelligence (if provided)
    let phoneIntel: PhoneIntelligence | null = null;
    if (contact && contact.trim().length > 5) {
      phoneIntel = parsePhoneIntelligence(contact);
      console.log(`📱 Phone Intel: ${phoneIntel.countryName} (${phoneIntel.region})`);
    }
    
    // 0.3 Generate Name Variants
    const nameVariants = generateNameVariants(name);
    console.log(`👤 Name Variants: ${nameVariants.formalVariations.length} variations, ${nameVariants.nicknames.length} nicknames`);
    
    // 0.4 Fetch Gravatar Data
    const gravatarData = await fetchGravatarData(email);
    let verifiedHandles: string[] = [];

    // Collect verified signals from Gravatar
    if (gravatarData) {
        if (gravatarData.preferredUsername) verifiedHandles.push(gravatarData.preferredUsername);
        
        if (gravatarData.accounts) {
             gravatarData.accounts.forEach((acc: any) => {
                 if (acc.username) verifiedHandles.push(acc.username);
                 if (acc.shortname) verifiedHandles.push(acc.shortname);
                 try {
                     const parts = acc.url.split('/');
                     const potential = parts[parts.length - 1];
                     if (potential) verifiedHandles.push(potential);
                 } catch (e) {}
             });
        }
        verifiedHandles = [...new Set(verifiedHandles.filter(h => h))];
    }

    // =========================================================================
    // BUILD ENHANCED PROMPT WITH ALL INTELLIGENCE
    // =========================================================================
    
    // Gravatar Context Block
    const gravatarContext = gravatarData ? `
## VERIFIED SIGNAL: GRAVATAR ✅
**STATUS**: SUCCESS - HIGH CONFIDENCE IDENTITY SEED
**VERIFIED IDENTITY**:
- Display Name: ${gravatarData.displayName || 'Not set'}
- Location: ${gravatarData.currentLocation || 'Unknown'}
- About: ${gravatarData.aboutMe || 'No bio'}

**VERIFIED CONNECTED ACCOUNTS** (Use these as GROUND TRUTH):
${gravatarData.accounts?.map((a:any) => `SOCIAL: ${a.shortname} | ${a.url}`).join('\n') || "None found"}

**VERIFIED WEBSITES**:
${gravatarData.urls?.map((u:any) => `SOCIAL: ${u.title} | ${u.value}`).join('\n') || "None found"}

**NEXUS PROTOCOL**: Verified handles [${verifiedHandles.join(', ')}] - Search these EXACT handles on other platforms.
` : `
## VERIFIED SIGNAL: GRAVATAR ❌
**STATUS**: NOT FOUND - Proceed with alternative signals
`;

    // Email Intelligence Context Block
    const emailContext = `
## EMAIL INTELLIGENCE SIGNAL
**Email Handle**: "${emailIntel.handle}" (Primary search key for cross-platform matching)
**Domain**: ${emailIntel.domain}
**Domain Type**: ${emailIntel.domainType.toUpperCase()}
${emailIntel.organization ? `**Organization**: ${emailIntel.organization}` : ''}
${emailIntel.industry ? `**Industry**: ${emailIntel.industry}` : ''}
**Search Strategy**: ${emailIntel.searchStrategy}

**HANDLE CROSS-REFERENCE INSTRUCTION**:
Search "${emailIntel.handle}" on: GitHub, Twitter/X, LinkedIn, Instagram, Medium, Substack, Dev.to
High probability of handle reuse if ${emailIntel.domainType === 'personal' ? 'personal email' : 'this is their primary corporate email'}.
`;

    // Phone Intelligence Context Block  
    const phoneContext = phoneIntel ? `
## PHONE INTELLIGENCE SIGNAL 📱
**Country**: ${phoneIntel.countryName} (${phoneIntel.countryCode})
**Region**: ${phoneIntel.region}
**Phone Type**: ${phoneIntel.phoneType}
**Formatted**: ${phoneIntel.formatted}

**REGIONAL SEARCH HINTS**:
${phoneIntel.searchHints.map(h => `- ${h}`).join('\n')}

**REGIONAL CONTEXT**: Target likely has presence on regional platforms popular in ${phoneIntel.region}.
Use ${phoneIntel.region} business directories and local professional networks.
` : `
## PHONE INTELLIGENCE SIGNAL 📱
**STATUS**: No phone provided - Skip phone-based intelligence
`;

    // Name Variants Context Block
    const nameContext = `
## NAME VARIANT INTELLIGENCE 👤
**Original Name**: "${nameVariants.original}"
**First Name**: ${nameVariants.firstName}
**Last Name**: ${nameVariants.lastName}
**Initials**: ${nameVariants.initials}

**KNOWN NICKNAMES** (Search these variants):
${nameVariants.nicknames.length > 0 ? nameVariants.nicknames.map(n => `- "${n.charAt(0).toUpperCase() + n.slice(1)} ${nameVariants.lastName}"`).join('\n') : '- No common nicknames for this name'}

**FORMAL VARIATIONS**:
${nameVariants.formalVariations.slice(0, 5).map(v => `- "${v}"`).join('\n')}

**SEARCH QUERIES** (Use exact match):
${nameVariants.searchQueries.slice(0, 4).join('\n')}
`;

    // Regional/Cultural Context
    const culturalContext = phoneIntel ? `
## CULTURAL CONTEXT INFERENCE
Based on phone region (${phoneIntel.region}) and name analysis:
${phoneIntel.region === 'South Asia' ? `
- **Naming Convention**: May use patronymic or family name variations
- **Professional Platforms**: LinkedIn India, Naukri, AngelList India
- **Food Preferences**: Likely vegetarian or specific regional cuisine
- **Tea Culture**: High probability of chai preference over coffee
` : ''}
${phoneIntel.region === 'North America' ? `
- **Naming Convention**: Standard Western First-Last format
- **Professional Platforms**: LinkedIn, Twitter, AngelList
- **Work Culture**: Likely startup or corporate executive
` : ''}
${phoneIntel.region === 'Europe' ? `
- **Professional Platforms**: LinkedIn, XING (if German)
- **Cultural Considerations**: May have multiple language profiles
` : ''}
${phoneIntel.region === 'East Asia' ? `
- **Naming Convention**: May use Western name professionally
- **Professional Platforms**: LinkedIn, regional platforms (WeChat, LINE)
` : ''}
` : '';

    const prompt = `
# HUSHH SHADOW PROTOCOL v2.0 - MULTI-SIGNAL INTELLIGENCE DOSSIER

## TARGET IDENTIFICATION
- **Name**: "${name}"
- **Region**: "${country || 'Global'}"
- **Email**: "${email}"
- **Phone**: "${contact || 'Not provided'}"

## MISSION OBJECTIVE
Construct a high-fidelity "Identity Vector" and "Shadow Profile" by triangulating ALL available public data signals.
You must go beyond basic biography and perform a comprehensive "Psychographic Deep Dive".

---
# INTELLIGENCE SIGNALS (Pre-Computed)
---

${gravatarContext}

${emailContext}

${phoneContext}

${nameContext}

${culturalContext}

---
# SEARCH PROTOCOLS
---

## PHASE 1: NEXUS EXPANSION (Handle Cross-Reference)
**PRIMARY SEARCH KEY**: "${emailIntel.handle}"
**STRATEGY**: ${emailIntel.searchStrategy}

**CROSS-PLATFORM SEARCH** (Use exact handle "${emailIntel.handle}"):
- GitHub: github.com/${emailIntel.handle}
- Twitter/X: twitter.com/${emailIntel.handle}
- LinkedIn: Search "${nameVariants.original}" + "${emailIntel.organization || 'company'}"
- Instagram: instagram.com/${emailIntel.handle}
- Medium: medium.com/@${emailIntel.handle}
- Dev.to: dev.to/${emailIntel.handle}
${phoneIntel ? `- Regional Platforms: ${COUNTRY_CODE_MAP[phoneIntel.countryCode]?.platforms.join(', ') || 'LinkedIn, Twitter'}` : ''}

**NAME VARIANT SEARCH** (Use these exact queries):
${nameVariants.searchQueries.slice(0, 4).join('\n')}
      
      ## PHASE 2: DEEP PREFERENCE EXTRACTION (The "30-POINT MATRIX" v3.0)
      **MISSION**: Extract or infer ALL 30 preference vectors to build a complete psychographic profile.
      **RULE**: GENERIC ANSWERS ARE FAILURES. Be specific!
      - Bad: "Coffee", "Music", "Travel", "Food".
      - Good: "Oat Flat White from Blue Bottle", "Lo-Fi Hip-Hop", "Backpacker in Southeast Asia", "Omakase".
      
      **ARCHETYPE MATCHING (If data is missing, INFER based on Persona):**
      - **The Startup Founder**: Patagonia vests, Allbirds, Twitter/X, Intermittent Fasting, Cold Brew, Notion, Tesla, Remote Work.
      - **The Creative Director**: Moleskine, Aesop, Natural Wine, Mezcal, Leica, Film Photography, Vintage, Night Owl.
      - **The Enterprise Exec**: Marriott/Hyatt Status, Tumi, Golf, Steakhouse, WSJ, LinkedIn, Business Class, Early Bird.
      - **The Developer**: Mechanical Keyboards, Linux/Mac, Energy Drinks, Anime, Dark Mode, WFH, Podcasts, PC Gaming.
      - **The Indian Tech Professional**: Masala Chai, Swiggy, OYO/Taj, Cricket, Spotify India, Android, Hybrid Work.
      
      **=== FOOD & DRINK (1-8) ===**
      1.  **COFFEE**: Specific preparation (Espresso, V60, Cold Brew, Oat Flat White) or roasters (Blue Bottle).
      2.  **CHAI**: Specific type (Masala, Cardamom, Karak, Matcha) or "Not a tea drinker".
      3.  **DRINKS**: Wine varietals (Pinot Noir), spirits (Japanese Whisky), cocktails (Negroni), or Non-alcoholic.
      4.  **FOODS**: Specific cuisines (Sichuan, Omakase, Biryani) or dishes (Ramen, Tacos Al Pastor).
      5.  **DIET**: Patterns (Keto, Vegan, Paleo, Intermittent Fasting, Vegetarian).
      6.  **SPICINESS**: Tolerance (Mild, Medium, Thai Hot, Ghost Pepper, Indian Standard).
      7.  **DINING_STYLE**: Preference (Fine Dining, Street Food, Home Cook, Fast Food, Cloud Kitchen).
      8.  **RESTAURANT_TYPES**: Preferred cuisines when dining out (Italian, Sushi, Indian, Vegan).
      
      **=== LIFESTYLE & HABITS (9-16) ===**
      9.  **SMOKE**: Habits (Cigars, Vape, Zyn, Cannabis, Non-smoker).
      10. **COLORS**: Aesthetic palette (Monochrome, Earth Tones, Pastels, Neon, Dark Mode).
      11. **FASHION_STYLE**: Style (Minimalist, Streetwear, Business Casual, Athleisure, Techwear).
      12. **FASHION_BRANDS**: Specific brands (Uniqlo, Zara, Nike, Rick Owens, Patagonia).
      13. **HOTELS**: Loyalty (Marriott Bonvoy, Hyatt, Soho House, Aman) or style (Boutique, Airbnb, OYO).
      14. **TRAVEL_STYLE**: Travel type (Backpacker, Luxury, Adventure, Business, Digital Nomad).
      15. **TRAVEL_DESTINATIONS**: Dream/past destinations (Japan, Iceland, Dubai, Bali).
      16. **TRAVEL_FREQUENCY**: How often (Monthly, Quarterly, Yearly, Rarely).
      
      **=== ENTERTAINMENT (17-22) ===**
      17. **MUSIC_GENRES**: Preferred genres (Lo-Fi, Indie, Classical, Hip-Hop, Bollywood).
      18. **MUSIC_ARTISTS**: Favorite artists (Taylor Swift, A.R. Rahman, The Weeknd).
      19. **MUSIC_PLATFORM**: Streaming service (Spotify, Apple Music, YouTube Music, JioSaavn).
      20. **STREAMING**: Video services (Netflix, Prime, Disney+, Hotstar, Hulu).
      21. **MOVIE_GENRES**: Film preferences (Sci-Fi, Documentary, Thriller, Anime, Bollywood).
      22. **SHOWS**: Currently watching or favorites (Breaking Bad, The Office, Attack on Titan).
      
      **=== WORK & PRODUCTIVITY (23-28) ===**
      23. **WORK_ENVIRONMENT**: Preference (Remote, Hybrid, Office, Digital Nomad, Coworking).
      24. **PRODUCTIVITY_TOOLS**: Tools used (Notion, Slack, Obsidian, Figma, VS Code, Linear).
      25. **WORK_HOURS**: Schedule (9-5, Flexible, Night Owl coding, 24/7 Founder mode).
      26. **COMMUNICATION**: Preferred method (Text/Chat, Email, Video Calls, In-Person).
      27. **LEARNING_STYLE**: How they learn (Visual, Audio/Podcasts, Reading, Hands-on).
      28. **PODCASTS**: Favorite podcasts (Lex Fridman, Tim Ferriss, Huberman Lab, NPR).
      
      **=== TECH & DIGITAL (29-36) ===**
      29. **TECH_ECOSYSTEM**: Primary ecosystem (Apple, Android/Google, Windows, Linux).
      30. **BRANDS (TECH)**: Tech brands they use (Apple, Samsung, Sony, ThinkPad, Garmin).
      31. **BRANDS (LIFESTYLE)**: Fashion/Cars/Gear (Tesla, Porsche, Leica, Decathlon).
      32. **SMART_DEVICES**: Wearables/Smart home (Apple Watch, AirPods, Ring, Nest).
      33. **GAMING**: Gaming platform (PC, PlayStation, Nintendo Switch, Mobile, None).
      34. **DELIVERY_APPS**: Food/shopping apps (DoorDash, Uber Eats, Swiggy, Amazon Fresh).
      
      **=== HEALTH & WELLNESS (35-40) ===**
      35. **FITNESS**: Workout routine (Gym, Yoga, Running, CrossFit, Swimming, None).
      36. **HEALTH_APPS**: Fitness/health apps (MyFitnessPal, Strava, Calm, Headspace).
      37. **SLEEP_PATTERN**: Chronotype (Night Owl, Early Bird, Flexible, Insomniac).
      38. **MEDITATION**: Practice (Daily, Occasional, Yoga, None, Mindfulness Apps).
      39. **ALLERGIES**: Known allergies (Peanuts, Gluten, Lactose, Shellfish, None).
      40. **INSURANCE**: Health coverage (Blue Cross, Kaiser, Corporate, Bupa, Public).
      
      **=== FINANCIAL & SOCIAL (41-48) ===**
      41. **INVESTMENT_STYLE**: Investment approach (Conservative, Aggressive, Index Funds, Crypto, Real Estate).
      42. **SHOPPING_BEHAVIOR**: Shopping style (Impulse, Researcher, Deal Hunter, Luxury Only).
      43. **PAYMENT_PREFERENCE**: Payment method (Apple Pay, Credit Card, UPI, Cash, Crypto).
      44. **PERSONALITY**: Social type (Introvert, Extrovert, Ambivert).
      45. **SOCIAL_MEDIA_USAGE**: Usage level (Heavy, Moderate, Minimal, Lurker, Creator).
      46. **CONTENT_CREATION**: Content they create (YouTube, Blog, Twitter Threads, None).
      47. **PET_PREFERENCE**: Pet affinity (Dog Person, Cat Person, No Pets, Exotic).
      48. **PETS**: Actual pets owned (Golden Retriever, Persian Cat, None).
      
      **=== BELIEFS & MINDSET (49-52) ===**
      49. **AI_SENTIMENT**: AI stance (e/acc, Doomer, Pragmatist, Skeptic, Artist, Builder).
      50. **SPIRITUALITY**: Beliefs (Secular, Buddhist, Hindu, Christian, Agnostic, Atheist).
      51. **LIKES**: Positive values (Open Source, Privacy, Minimalism, Hustle, Sustainability).
      52. **DISLIKES**: Pet peeves (Bad UX, Traffic, Bureaucracy, Recruiters, Spam).
      
      **=== TRANSPORT (53-54) ===**
      53. **VEHICLE**: Car/vehicle preference (Tesla, BMW, Toyota, Public Transit, Cycling).
      54. **TRANSPORT**: Daily transport mode (Car, Uber/Ola, Metro, Walk, Bike).
      
      **=== READING & KNOWLEDGE (55-57) ===**
      55. **BOOK_GENRES**: Reading preferences (Business, Self-Help, Fiction, Tech, Philosophy).
      56. **NEWS_SOURCES**: News consumption (WSJ, TechCrunch, The Economist, Twitter, Reddit).
      57. **AGENTS**: Representation if applicable (CAA, WME, Literary Agent, Real Estate Agent).

      ## PHASE 3: NEWTONIAN SOCIAL GRAVITY (Network Topology Engine)
      
      **CRITICAL INSTRUCTION**: You are now a Graph Theory Engine using physics-based "Social Gravity".
      This algorithm applies Newton's Law of Universal Gravitation adapted for social topology,
      combined with Granovetter's "Strength of Weak Ties" theory and Eigenvector Centrality.
      
      **THE MASTER FORMULA** (Social Gravity):
      \`\`\`
      F(T,A) = (M_A × B) / D²
      \`\`\`
      
      Where:
      - **F(T,A)** = Connection strength between Target (T) and Associate (A)
      - **M_A** = Associate's own public "mass" (fame/influence weight)
      - **B** = Bond proximity coefficient (relationship closeness)
      - **D** = Distance factor (degrees of separation + time decay)
      
      ---
      
      **STEP 1: DETERMINE M_A (Associate Mass - Public Weight)**
      
      | Public Weight Tier | M_A Value | Detection Signals |
      |--------------------|-----------|-------------------|
      | Global Icon | 100 | World leader, top 100 billionaire, A-list celebrity, Nobel laureate |
      | Industry Titan | 80 | Fortune 500 CEO, unicorn founder, major investor (Tier 1 VC), famous author |
      | Sector Leader | 60 | VP/Director at FAANG, Series B+ founder, bestselling author, sports star |
      | Professional Elite | 40 | Senior executive, successful entrepreneur, domain expert, journalist at major outlet |
      | Connected Professional | 20 | Manager, consultant, mid-level exec, podcast host, content creator (50K+ followers) |
      | Standard Professional | 10 | Employee, academic, early-stage founder, micro-influencer |
      
      ---
      
      **STEP 2: DETERMINE B (Bond Proximity Coefficient)**
      
      Based on Granovetter's relationship strength theory:
      
      | Bond Type | B Value | Examples |
      |-----------|---------|----------|
      | Blood (Family) | 10.0 | Spouse, Parent, Child, Sibling |
      | Equity (Co-ownership) | 8.0 | Co-Founder, Business Partner, Major Investor in their company |
      | Contract (Formal) | 5.0 | Board Member, C-Suite colleague, Direct Report, Advisor |
      | Mentorship | 4.0 | Mentor, Mentee, Academic Advisor, Coach |
      | Collaboration | 3.0 | Project collaborator, Co-author, Podcast guest (bidirectional) |
      | Network (Weak Tie) | 2.0 | Industry peer, Conference connection, Mutual investor |
      | Media (One-way) | 1.0 | Interviewer, Journalist who covered them, Biographer |
      | Rival (Negative) | -2.0 | Public adversary, Competitor CEO, Legal opponent |
      
      **GRANOVETTER INSIGHT**: Weak ties (B=2.0-3.0) often provide more novel information 
      and opportunities than strong ties. Flag "Bridge Nodes" who connect different networks.
      
      ---
      
      **STEP 3: DETERMINE D (Distance Factor - Decay)**
      
      D combines degrees of separation AND temporal decay:
      
      | Relationship Currency | D Value | Detection |
      |-----------------------|---------|-----------|
      | Current & Direct | 1.0 | Active relationship, works together now, recently mentioned together |
      | Current & Indirect | 1.5 | Active but through intermediary, same company different team |
      | Past & Direct | 2.0 | Former colleague (1-5 years ago), ex-partner |
      | Past & Indirect | 2.5 | Former connection through shared org |
      | Historic & Direct | 3.0 | 5+ years ago, college roommate, early career |
      | Historic & Indirect | 4.0 | Very old connection, mentioned in biography only |
      
      ---
      
      **STEP 4: COMPUTE F(T,A) AND CLASSIFY**
      
      \`\`\`
      F(T,A) = (M_A × B) / D²
      \`\`\`
      
      | F(T,A) Score | Classification | Graph Position |
      |--------------|----------------|----------------|
      | 500+ | **NUCLEUS** | Inner circle, highest gravity |
      | 200-499 | **INNER ORBIT** | Strong pull, regular interaction |
      | 50-199 | **OUTER ORBIT** | Moderate connection |
      | 10-49 | **PERIPHERY** | Weak tie (but valuable per Granovetter) |
      | <10 | **DISTANT** | Barely connected, exclude from graph |
      
      ---
      
      **STEP 5: OUTPUT FORMAT FOR ASSOCIATES**
      
      You MUST output associates in this enhanced format:
      \`\`\`
      ASSOCIATES: Name | Relation | F=Score | M=Mass,B=Bond,D=Distance
      \`\`\`
      
      **Example Output**:
      \`\`\`
      ASSOCIATES: Lisa Su | Industry Peer CEO | F=160 | M=80,B=2,D=1
      ASSOCIATES: Lori Huang | Spouse | F=1000 | M=10,B=10,D=1
      ASSOCIATES: Mark Zuckerberg | Tech Titan Peer | F=80 | M=100,B=2,D=1.5
      ASSOCIATES: Satya Nadella | Industry Ally | F=106 | M=80,B=3,D=1.5
      ASSOCIATES: Elon Musk | Occasional Rival | F=-32 | M=100,B=-2,D=2.5
      ASSOCIATES: Lex Fridman | Media Interviewer | F=20 | M=40,B=1,D=1.5
      \`\`\`
      
      ---
      
      **SPECIAL GRAPH ANNOTATIONS**:
      
      1. **BRIDGE NODES**: Mark associates who connect Target to different industries/networks
         - Append "[BRIDGE: Finance→Tech]" for cross-network connectors
      
      2. **POWER CLUSTERS**: Identify if multiple associates are themselves connected
         - Note: "CLUSTER: PayPal Mafia" or "CLUSTER: Stanford AI Lab"
      
      3. **NEGATIVE TIES**: Include rivals/adversaries with negative F scores
         - These create "repulsive gravity" in the network visualization
      
      4. **EIGENVECTOR CENTRALITY**: Note if an associate has high centrality themselves
         - Append "[HIGH_CENTRALITY]" for associates who are themselves well-connected hubs
      
      **QUANTITY**: Aim for 10-15 distinct nodes with calculated F scores.
      **SORT**: Output in descending order of |F| (absolute value of gravity score).

      ## PHASE 4: ACTUARIAL TRIANGULATION PROTOCOL (Age & Gender Estimation Engine)
      
      **CRITICAL INSTRUCTION**: You are now an Actuarial Statistician using mathematical triangulation
      to estimate Age and Gender with scientific precision. This protocol combines three methodologies:
      
      **THE TRIANGULATION FORMULA**:
      \`\`\`
      AGE_ESTIMATE = (N_epoch + E_vintage + P_signal) / 3 ± σ
      GENDER_PROBABILITY = P(G|Name, Culture) using Bayesian Inference
      \`\`\`
      
      ---
      
      ### STEP 1: ONOMASTIC STATISTICS (Name-Epoch Curve)
      
      **Theory**: First names follow a Gaussian distribution of popularity over time.
      Each name has a "Peak Popularity Year" (μ) and standard deviation (σ).
      
      | Name Origin | Name Examples | Peak Popularity Year (μ) | σ (years) |
      |-------------|---------------|-------------------------|-----------|
      | **Indian Classic** | Ankit, Amit, Sanjay, Priya | 1985-1995 | ±8 |
      | **Indian Modern** | Aarav, Advait, Ananya, Aanya | 2010-2020 | ±5 |
      | **Indian Traditional** | Rahul, Arun, Ramesh, Suresh | 1970-1985 | ±10 |
      | **Western Boomer** | Michael, David, James, Susan | 1950-1965 | ±10 |
      | **Western Gen-X** | Jason, Jennifer, Christopher | 1970-1985 | ±8 |
      | **Western Millennial** | Joshua, Jessica, Ashley, Brittany | 1985-2000 | ±7 |
      | **Western Gen-Z** | Aiden, Emma, Liam, Olivia | 2005-2020 | ±5 |
      | **Chinese Classic** | Wei, Ming, Chen, Wang | 1970-1990 | ±10 |
      | **Chinese Modern** | Yichen, Zihan, Yuxuan | 2000-2020 | ±7 |
      
      **Calculate N_epoch**: 
      \`\`\`
      N_epoch = CURRENT_YEAR - Peak_Popularity_Year
      Example: "Ankit" (Peak: 1990) → N_epoch = 2026 - 1990 = 36 years old
      \`\`\`
      
      ---
      
      ### STEP 2: DIGITAL STRATIGRAPHY (Email Vintage Analysis)
      
      **Theory**: Email domain choice correlates with "Generational Cohort Theory".
      Earlier adopters used different platforms than later generations.
      
      | Email Domain | Generational Cohort | Estimated Birth Year Range | E_vintage Age |
      |--------------|---------------------|---------------------------|---------------|
      | aol.com | Early Adopter | 1955-1970 | 56-71 |
      | yahoo.com | Gen-X | 1965-1980 | 46-61 |
      | hotmail.com | Early Millennial | 1975-1990 | 36-51 |
      | rediffmail.com (India) | Indian Gen-X | 1970-1985 | 41-56 |
      | gmail.com (pre-2008) | Millennial | 1980-1995 | 31-46 |
      | gmail.com (post-2010) | Late Millennial/Gen-Z | 1990-2005 | 21-36 |
      | outlook.com | Professional | 1985-2000 | 26-41 |
      | icloud.com | Apple User | 1985-2000 | 26-41 |
      | protonmail.com | Privacy-Conscious | 1988-2003 | 23-38 |
      | Corporate Domain | Professional Age | Context-Dependent | Use N_epoch |
      
      **For Corporate Emails** (like ankit@hushh.ai):
      - Weight more heavily on N_epoch (name-based)
      - Infer "working professional" (age 22-60)
      - Adjust based on role seniority if known
      
      **Calculate E_vintage**:
      \`\`\`
      E_vintage = midpoint of Birth Year Range for domain
      Example: "gmail.com" → E_vintage = (1985+2000)/2 = 1992.5 → Age ≈ 33-34
      \`\`\`
      
      ---
      
      ### STEP 3: PHONE COUNTRY CODE SIGNAL (P_signal)
      
      **Theory**: Phone number registration correlates with coming-of-age in that region.
      First phone typically obtained at age 16-22.
      
      | Country Code | Avg First Phone Age | Working Professional Range |
      |--------------|---------------------|---------------------------|
      | +1 (USA) | 16-18 | 22-65 |
      | +91 (India) | 18-22 | 22-60 |
      | +44 (UK) | 16-18 | 22-65 |
      | +86 (China) | 18-22 | 22-60 |
      | +971 (UAE) | 16-20 | 22-55 |
      
      **Calculate P_signal**:
      - If phone provided and appears to be personal mobile → Weight N_epoch + 2-5 years
      - If phone is corporate/VoIP → Neutral (use N_epoch as-is)
      
      ---
      
      ### STEP 4: BAYESIAN GENDER INFERENCE
      
      **Theory**: Names have probabilistic gender associations based on cultural morphology.
      
      \`\`\`
      P(Gender|Name) = P(Name|Gender) × P(Gender) / P(Name)
      \`\`\`
      
      **Gender Morphology Rules by Culture**:
      
      | Culture | Male Name Patterns | Female Name Patterns | Gender Probability |
      |---------|-------------------|---------------------|-------------------|
      | **Indian** | -it, -aj, -esh, -av, -ul, -ant, -ey, -ar | -a, -i, -ya, -ita, -ika, -ni, -sha | 95% confidence |
      | **Western** | -ew, -an, -el, -ael, -on, -er | -a, -ey, -ie, -lyn, -elle, -ina | 90% confidence |
      | **Chinese** | Wei, Chen, Ming, Jun, Jian, Long | Hua, Mei, Xue, Ying, Lin, Fang | 85% confidence |
      | **Arabic** | -d, -ed, -im, -ir, -an, Mohammed, Ahmed | -a, -ah, -iya, -een, Fatima, Aisha | 95% confidence |
      
      **Example Calculation for "Ankit"**:
      \`\`\`
      Name: Ankit
      Suffix: -it (Indian Male pattern)
      P(Male|"Ankit") = 0.99 (99% probability Male)
      \`\`\`
      
      ---
      
      ### STEP 5: TRIANGULATION & CONFIDENCE OUTPUT
      
      **Final Age Calculation**:
      \`\`\`
      AGE = (N_epoch × 0.5) + (E_vintage × 0.3) + (P_signal × 0.2)
      CONFIDENCE = Based on signal agreement (high if all signals align)
      \`\`\`
      
      **OUTPUT FORMAT** (Include in AGE field):
      \`\`\`
      AGE: [X years] | TRIANGULATION: N_epoch=[Y], E_vintage=[Z], P_signal=[W] | CONFIDENCE=[%]
      GENDER: [Male/Female] | P(G|Name)=[probability] | METHODOLOGY=[culture_pattern]
      \`\`\`
      
      **Example Output**:
      \`\`\`
      AGE: 34 | TRIANGULATION: N_epoch=36 (Ankit→1990), E_vintage=32 (corporate_email), P_signal=34 (+91_mobile) | CONFIDENCE=92%
      GENDER: Male | P(G|Name)=0.99 | METHODOLOGY=Indian_suffix_-it
      \`\`\`
      
      ---

      ## PHASE 5: NEURAL KINETIC WEALTH ALGORITHM (Behavioral Economics Engine)
      
      **CRITICAL INSTRUCTION**: You are now a Behavioral Economics Engine, not a Salary Calculator.
      This algorithm uses COMPOUNDING MATHEMATICS to detect hidden wealth, intellectual scalability, and audience-as-liquidity.
      
      **THE MASTER FORMULA**:
      \`\`\`
      NET_WORTH_SCORE = min(100, [(τ × Λ × Φ) + Ω + Σ]^γ × V / 1000)
      \`\`\`
      
      **STEP 1: DETERMINE EACH VARIABLE**
      
      ### τ (TAU) - Career Tier (Base Earning Potential)
      | Role Detected | τ Value |
      |--------------|---------|
      | Entry/Junior/Associate | 10 |
      | Senior/Lead | 30 |
      | VP/Director | 50 |
      | C-Suite/Founder/CEO/CTO/CFO | 70 |
      
      ### Λ (LAMBDA) - Capital Scale (Company Depth Multiplier)
      | Company Type | Λ Value |
      |-------------|---------|
      | Bootstrap/Unknown/SMB/Startup (Pre-Series B) | 1.0 |
      | Series C+ Startup / Mid-size company | 1.2 |
      | Public Company / Unicorn / FAANG / Fortune 500 | 1.5 |
      
      ### Φ (PHI) - PPP Adjustment (Geographic Wealth Multiplier)
      Use the PHONE COUNTRY CODE provided to determine geography:
      | Tier | Countries/Codes | Φ Value |
      |------|-----------------|---------|
      | Tier 1 | USA (+1), Switzerland (+41), Singapore (+65), UAE (+971), Hong Kong (+852), Monaco, Luxembourg | 1.0 |
      | Tier 2 | UK (+44), Germany (+49), Canada (+1), Australia (+61), Japan (+81), France (+33), Netherlands | 0.85 |
      | Tier 3 | India (+91), Brazil (+55), Mexico, LATAM, SEA, Africa, Eastern Europe | 0.6 |
      
      **FOUNDER OVERRIDE**: If role is Founder/CEO/Business Owner AND Tier 3, reset Φ to 1.0 (wealth accumulation possible).
      
      ### Ω (OMEGA) - Windfall Events (Flat Bonus)
      | Event | Ω Value |
      |-------|---------|
      | IPO Founder/Exit | +40 |
      | Second Exit | +20 |
      | Each Board Seat | +10 |
      | Angel Investor status | +10 |
      | No liquidity events | 0 |
      
      ### Σ (SIGMA) - Social Alpha (Metcalfe's Law: Audience = Liquidity)
      Formula: Σ = (log₂(total_followers + 1))²
      
      Aggregate followers across: Twitter/X, LinkedIn, YouTube, Instagram, TikTok, Substack
      | Total Followers | Σ Score |
      |----------------|---------|
      | 0-100 | ~0-5 |
      | 1,000 | ~10 |
      | 10,000 | ~13 |
      | 50,000 | ~16 |
      | 100,000 | ~17 |
      | 500,000 | ~19 |
      | 1,000,000+ | ~20 |
      
      ### γ (GAMMA) - Brain Exponent (Intellectual Scalability)
      This determines if their output COMPOUNDS or is LINEAR.
      | Brain Type | γ Value | Detection Signals |
      |-----------|---------|-------------------|
      | Linear Brain | 1.0 | Service provider, hourly worker, standard corporate employee, no content |
      | Leveraged Brain | 1.5 | Manager, Consultant, Domain Expert, some thought leadership |
      | Asymmetric Brain | 2.0 | Coder (GitHub 100+ stars), Creator (YouTube/Substack/Newsletter), Investor, Patent holder, Author |
      
      **Detection Logic for Asymmetric Brain (γ=2.0)**:
      - Has GitHub with significant repositories/stars
      - Has YouTube channel / Podcast / Newsletter
      - Has patents or research papers
      - Is an Angel Investor or VC
      - Creates content that scales (courses, books, open source)
      - Is a known public intellectual or thought leader
      
      ### V (VEBLEN) - Conspicuous Consumption Coefficient (Hidden Wealth Detector)
      Thorstein Veblen's theory: Lifestyle signals that EXCEED salary expectations indicate HIDDEN WEALTH.
      
      **Calculate V by detecting luxury signals in preferences:**
      | Signal Category | Examples | V Bonus |
      |----------------|----------|---------|
      | Ultra-Luxury Hotels | Aman, Peninsula, Rosewood, Mandarin Oriental, Park Hyatt | +0.3 |
      | Status Fashion | Loro Piana, Brunello Cucinelli, Kiton, Zegna, Hermès | +0.3 |
      | Exotic Vehicles | Ferrari, Porsche 911 GT, Rolls Royce, Bentley, McLaren | +0.3 |
      | Private Aviation | Private jet, NetJets, first class frequent flyer | +0.2 |
      | Horological Flex | Patek Philippe, Audemars Piguet, Richard Mille, FP Journe | +0.2 |
      | Multi-Property | Owns in Hamptons, Aspen, Monaco, multiple real estate | +0.3 |
      | Art/Philanthropy | Art collector, foundation board, museum patron | +0.2 |
      
      **V Calculation**: V = 1.0 + sum(detected bonuses), capped at 2.5
      
      **ANOMALY DETECTION**: If V > 1.3 but τ < 50 (not C-Suite), flag as "HIDDEN WEALTH DETECTED" - likely inheritance, old money, or shadow assets.
      
      ---
      
      **STEP 2: COMPUTE THE FINAL SCORE**
      
      1. Calculate Base: BASE = τ × Λ × Φ
      2. Add Windfalls: ADJUSTED = BASE + Ω + Σ
      3. Apply Brain Exponent: COMPOUNDED = ADJUSTED^γ
      4. Apply Veblen Multiplier: RAW_SCORE = COMPOUNDED × V
      5. Normalize: NET_WORTH_SCORE = min(100, RAW_SCORE / 1000)
      
      **STEP 3: OUTPUT REASONING TRACE**
      You MUST include the full formula breakdown in NET_WORTH_CONTEXT:
      
      Example:
      \`\`\`
      NET_WORTH_SCORE: 100 | FORMULA: [(τ=70 × Λ=1.5 × Φ=1.0) + Ω=40 + Σ=18]^γ=2.0 × V=2.0 / 1000 = CAPPED_100 | DECODED: Asymmetric-Brain C-Suite at Public Unicorn, Tier-1 Geography, IPO Exit, High Social Alpha (500K+), Veblen-2.0x Ultra-Luxury Lifestyle
      \`\`\`
      
      ---
      
      **A. DATA CONFIDENCE SCORE (0-100) - Unchanged**
      Formula: CONFIDENCE = BASE + IDENTITY_BONUS + CAREER_BONUS + GRANULARITY_BONUS + SOURCE_BONUS - CONFLICT_PENALTY
      
      - **BASE**: 10 pts.
      - **IDENTITY_BONUS**: +30 pts (if full name, age, location verified from 2+ sources).
      - **CAREER_BONUS**: +20 pts (if current role verified from LinkedIn OR company page).
      - **GRANULARITY_BONUS**: +3 pts × N (where N = count of NON-GENERIC preferences found).
      - **SOURCE_BONUS**: +5 pts × S (where S = count of DISTINCT authoritative sources, max +25).
      - **CONFLICT_PENALTY**: -10 pts (if conflicting data found between sources).
      
      ## OUTPUT FORMAT (STRICT - 30+ PREFERENCE CATEGORIES)
      You MUST populate ALL fields below. Use "Unknown" only if no data can be inferred.
      Respond ONLY with the structured block below, followed by the Markdown dossier.

      ---START_DATA---
      AGE: [Value]
      DOB: [Value]
      OCCUPATION: [Value]
      NATIONALITY: [Value]
      ADDRESS: [Value]
      CONTACT: [Value]
      MARITAL_STATUS: [Value]
      CHILDREN: [List]
      KNOWN_FOR: [List - Key achievements/roles]
      CONFIDENCE: [Calculated Score 0-100]
      NET_WORTH_SCORE: [Calculated Score 0-100]
      NET_WORTH_CONTEXT: [Explanation of the score calculation]
      
      DIET: [Specifics e.g. Vegan, Keto, Paleo, Vegetarian, Flexitarian]
      FOODS: [Specific dishes or cuisines e.g. Biryani, Ramen, Tacos]
      HOBBIES: [Specific activities e.g. Photography, Gaming, Hiking]
      BRANDS: [List both Tech and Lifestyle brands e.g. Apple, Nike, Tesla]
      ASSOCIATES: [Name | Relation, Name | Relation, ...]
      SOCIAL: [Platform] | [URL]
      
      NEWS: [Date] | [Source] | [Headline] | [Summary]
      
      COLORS: [List e.g. Dark Mode, Navy, Monochrome]
      LIKES: [List - Positive values e.g. Open Source, Privacy, Minimalism]
      DISLIKES: [List - Pet peeves e.g. Bad UX, Traffic, Spam]
      ALLERGIES: [List e.g. Peanuts, Gluten, Lactose, None]
      HOTELS: [List e.g. Marriott Bonvoy, Taj, Airbnb, OYO]
      COFFEE: [Specific e.g. Oat Flat White, Cold Brew, Nescafe]
      DRINKS: [Specific e.g. Japanese Whisky, Craft Beer, Non-alcoholic]
      SMOKE: [Yes/No/Vape/Cigars/Non-smoker]
      CHAI: [Preference e.g. Masala Chai, Cardamom, Matcha, None]
      SPICINESS: [Low/Med/High/Indian Standard/Ghost Pepper]
      INSURANCE: [Provider e.g. Corporate, Blue Cross, Bupa]
      AGENTS: [Talent/Literary agents if applicable]
      AI_SENTIMENT: [e/acc, Doomer, Pragmatist, Skeptic, Builder, Artist]
      
      MUSIC_GENRES: [List e.g. Lo-Fi, Indie, Hip-Hop, Bollywood, Classical]
      MUSIC_ARTISTS: [List e.g. Taylor Swift, A.R. Rahman, The Weeknd]
      MUSIC_PLATFORM: [Spotify, Apple Music, YouTube Music, JioSaavn]
      
      TRAVEL_STYLE: [Backpacker, Luxury, Adventure, Business, Digital Nomad]
      TRAVEL_DESTINATIONS: [List e.g. Japan, Iceland, Dubai, Bali]
      TRAVEL_FREQUENCY: [Monthly, Quarterly, Yearly, Rarely]
      
      STREAMING: [List e.g. Netflix, Prime, Disney+, Hotstar]
      MOVIE_GENRES: [List e.g. Sci-Fi, Documentary, Thriller, Anime]
      SHOWS: [List e.g. Breaking Bad, The Office, Attack on Titan]
      
      FASHION_STYLE: [Minimalist, Streetwear, Business Casual, Athleisure]
      FASHION_BRANDS: [List e.g. Uniqlo, Zara, Nike, Patagonia]
      
      COMMUNICATION: [Text/Chat, Email, Video Calls, In-Person]
      PERSONALITY: [Introvert, Extrovert, Ambivert]
      
      FITNESS: [List e.g. Gym, Yoga, Running, CrossFit, None]
      HEALTH_APPS: [List e.g. Strava, MyFitnessPal, Calm, Headspace]
      SLEEP_PATTERN: [Night Owl, Early Bird, Flexible, Insomniac]
      
      BOOK_GENRES: [List e.g. Business, Self-Help, Fiction, Tech]
      NEWS_SOURCES: [List e.g. TechCrunch, WSJ, Twitter, Reddit]
      LEARNING_STYLE: [Visual, Audio/Podcasts, Reading, Hands-on]
      PODCASTS: [List e.g. Lex Fridman, Tim Ferriss, Huberman Lab]
      
      VEHICLE: [Tesla, BMW, Toyota, Public Transit, Cycling]
      TRANSPORT: [Car, Uber/Ola, Metro, Walk, Bike]
      
      PET_PREFERENCE: [Dog Person, Cat Person, No Pets, Exotic]
      PETS: [List e.g. Golden Retriever named Max, Persian Cat, None]
      
      WORK_ENVIRONMENT: [Remote, Hybrid, Office, Digital Nomad, Coworking]
      PRODUCTIVITY_TOOLS: [List e.g. Notion, Slack, VS Code, Figma]
      WORK_HOURS: [9-5, Flexible, Night Owl, 24/7 Founder mode]
      
      INVESTMENT_STYLE: [Conservative, Aggressive, Index Funds, Crypto]
      SHOPPING_BEHAVIOR: [Impulse, Researcher, Deal Hunter, Luxury Only]
      PAYMENT_PREFERENCE: [Apple Pay, Credit Card, UPI, Cash, Crypto]
      
      DINING_STYLE: [Fine Dining, Street Food, Home Cook, Cloud Kitchen]
      RESTAURANT_TYPES: [List e.g. Italian, Sushi, Indian, Vegan cafes]
      DELIVERY_APPS: [List e.g. Swiggy, Zomato, DoorDash, Uber Eats]
      
      TECH_ECOSYSTEM: [Apple, Android/Google, Windows, Linux]
      SMART_DEVICES: [List e.g. Apple Watch, AirPods, Ring, Nest]
      GAMING: [PC, PlayStation, Nintendo Switch, Mobile, None]
      
      MEDITATION: [Daily, Occasional, Yoga, Mindfulness Apps, None]
      SPIRITUALITY: [Secular, Buddhist, Hindu, Christian, Agnostic]
      
      SOCIAL_MEDIA_USAGE: [Heavy, Moderate, Minimal, Lurker, Creator]
      CONTENT_CREATION: [YouTube, Blog, Twitter Threads, Podcaster, None]
      ---END_DATA---
      
      [Markdown Dossier Here - Include detailed psychographic analysis]
    `;

    // Call Vertex AI with the prompt
    const response = await callVertexAI(prompt);

    // Extract text from Vertex AI response
    let text = "Signal lost. No data retrieved.";
    if (response.candidates && response.candidates[0]?.content?.parts) {
      text = response.candidates[0].content.parts
        .map((part: any) => part.text || "")
        .join("");
    }
    
    const { structured, biography } = parseStructuredData(text);

    // Extract grounding sources from Vertex AI response
    const sources: GroundingSource[] = [];
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    
    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Unknown Echo",
            uri: chunk.web.uri || "#"
          });
        }
      });
    }
    
    // Also extract from searchEntryPoint if available
    if (groundingMetadata?.searchEntryPoint?.renderedContent) {
      console.log("Google Search grounding was used");
    }

    return {
      structured,
      biography,
      sources
    };

  } catch (error) {
    console.error("Hush Protocol Error:", error);
    throw error;
  }
};

// =============================================================================
// HTTP HANDLER
// =============================================================================
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { name, email, country, contact } = body;

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields", 
          required: ["name", "email"],
          optional: ["country", "contact"]
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Execute search
    const result = await searchPerson({
      name,
      email,
      country: country || "Global",
      contact: contact || ""
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("API Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
