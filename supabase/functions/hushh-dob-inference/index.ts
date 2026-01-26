// Hushh DOB Inference API - Supabase Edge Function
// Uses Gemini 3 Pro Preview via Vertex AI with Google Search grounding
// Infers Date of Birth using name, address, and public records

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Vertex AI Configuration
const PROJECT_ID = Deno.env.get("GCP_PROJECT_ID") || "hushone-app";
// Use gemini-2.0-flash-exp for Google Search grounding support
const MODEL_ID = "gemini-2.0-flash-exp";
const VERTEX_AI_LOCATION = "us-central1";

interface DobInferenceRequest {
  name: string;
  email?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  residenceCountry?: string;
  phone?: string;
}

interface DobInferenceResult {
  dob: string | null;  // Format: YYYY-MM-DD
  dobDisplay: string | null;  // Format: MM/DD/YYYY for display
  age: number | null;
  confidence: number;  // 0-100
  sources: string[];
  reasoning: string;
}

// Get OAuth access token for Vertex AI
const getAccessToken = async (): Promise<string> => {
  const accessToken = Deno.env.get("GCP_ACCESS_TOKEN") || Deno.env.get("GOOGLE_ACCESS_TOKEN");
  if (accessToken && accessToken.length > 50) {
    return accessToken;
  }
  
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (serviceAccountJson) {
    try {
      const sa = JSON.parse(serviceAccountJson);
      
      if (!sa.private_key || !sa.client_email) {
        throw new Error("Service account JSON missing private_key or client_email");
      }
      
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
      
      const encoder = new TextEncoder();
      const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const unsignedJwt = `${headerB64}.${payloadB64}`;
      
      let privateKeyPem = sa.private_key;
      if (!privateKeyPem.includes('\n') && privateKeyPem.includes('\\n')) {
        privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
      }
      
      const pemHeader = "-----BEGIN PRIVATE KEY-----";
      const pemFooter = "-----END PRIVATE KEY-----";
      const startIdx = privateKeyPem.indexOf(pemHeader);
      const endIdx = privateKeyPem.indexOf(pemFooter);
      
      if (startIdx === -1 || endIdx === -1) {
        throw new Error("Invalid PEM format");
      }
      
      const pemBody = privateKeyPem
        .substring(startIdx + pemHeader.length, endIdx)
        .replace(/[\r\n\s]/g, '');
      
      const binaryString = atob(pemBody);
      const binaryKey = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        binaryKey[i] = binaryString.charCodeAt(i);
      }
      
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        encoder.encode(unsignedJwt)
      );
      
      const signatureArray = new Uint8Array(signature);
      let signatureB64 = '';
      for (let i = 0; i < signatureArray.length; i++) {
        signatureB64 += String.fromCharCode(signatureArray[i]);
      }
      signatureB64 = btoa(signatureB64).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      
      const signedJwt = `${unsignedJwt}.${signatureB64}`;
      
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.access_token) {
        return tokenData.access_token;
      }
      
      throw new Error("Token response missing access_token");
    } catch (e) {
      console.error("Failed to get access token:", e);
      throw e;
    }
  }
  
  throw new Error("No valid GCP access token found");
};

// Call Vertex AI Gemini API with Google Search grounding
const callVertexAI = async (prompt: string): Promise<any> => {
  const accessToken = await getAccessToken();
  
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;
  
  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,  // Lower temperature for factual data
      maxOutputTokens: 2048,
    },
    // Google Search Grounding - enables real-time web search
    tools: [{
      googleSearch: {}
    }],
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };
  
  console.log(`🔍 Calling Vertex AI for DOB inference with Google Search grounding`);
  
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
    throw new Error(`Vertex AI API error: ${response.status}`);
  }
  
  return await response.json();
};

// Parse DOB from Gemini response
const parseDobResponse = (text: string): DobInferenceResult => {
  const result: DobInferenceResult = {
    dob: null,
    dobDisplay: null,
    age: null,
    confidence: 0,
    sources: [],
    reasoning: ""
  };
  
  // Extract structured data
  const dobMatch = text.match(/DOB:\s*(\d{4}-\d{2}-\d{2})/i);
  if (dobMatch) {
    result.dob = dobMatch[1];
    const [year, month, day] = dobMatch[1].split('-');
    result.dobDisplay = `${month}/${day}/${year}`;
    
    // Calculate age
    const birthDate = new Date(dobMatch[1]);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    result.age = age;
  }
  
  // Extract confidence
  const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
  if (confidenceMatch) {
    result.confidence = Math.min(100, parseInt(confidenceMatch[1], 10));
  }
  
  // Extract sources
  const sourcesMatch = text.match(/SOURCES:\s*(.+)/i);
  if (sourcesMatch) {
    result.sources = sourcesMatch[1].split(',').map(s => s.trim()).filter(s => s);
  }
  
  // Extract reasoning
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=\n[A-Z]+:|$)/is);
  if (reasoningMatch) {
    result.reasoning = reasoningMatch[1].trim();
  }
  
  return result;
};

// Infer DOB using Gemini + Google Search (Enhanced Prompt v2)
const inferDob = async (params: DobInferenceRequest): Promise<DobInferenceResult> => {
  const { name, email, address, residenceCountry, phone } = params;
  
  // Build location string
  const locationParts: string[] = [];
  if (address?.city) locationParts.push(address.city);
  if (address?.state) locationParts.push(address.state);
  if (address?.country) locationParts.push(address.country);
  else if (residenceCountry) locationParts.push(residenceCountry);
  
  const location = locationParts.join(', ') || 'Unknown';

  const prompt = `
# DOB DISCOVERY MISSION - DIGITAL FOOTPRINT ANALYSIS

You are an expert OSINT researcher. Your ONLY task is to find the Date of Birth (DOB) for this person.

## TARGET PERSON
- **Name**: "${name}"
- **Location**: ${location}
- **Email**: ${email || 'Not provided'}
- **Phone**: ${phone || 'Not provided'}

---

### PHASE 1: DIGITAL FOOTPRINT & DOB DISCOVERY (CRITICAL)

You must SEARCH for the User's Date of Birth (DOB) or Age using Google Search based on their Name, Email, and Location.

**SEARCH STRATEGY:**

1. **EMAIL DEEP SEARCH**: Perform a deep search for the email: "${email || 'N/A'}". Look for linked profiles:
   - LinkedIn profiles
   - Facebook profiles  
   - Resume/CV on job sites
   - GitHub profiles
   - Personal websites

2. **NAME + LOCATION SEARCH**: Search for "${name}" + "${location}" + "LinkedIn" or "Education" or "Birthday"

3. **⚠️ EMAIL WARNING**: The email address might contain random numbers (e.g., 'ankit97593'). 
   **DO NOT** assume '97' means 1997 unless you find an actual profile or date confirming it. 
   Random large numbers (like 97593) are often just unique identifiers, NOT birth years.

4. **AGE ESTIMATION HEURISTICS (If exact DOB not found):**
   
   **FOR INDIA (Pune, Bangalore, Delhi, Mumbai, etc.):**
   - If the user appears to be a **Student, Fresher, or recent graduate** in Pune, India:
     → Likely birth year is **2000-2004** (Gen Z, currently 22-26 years old)
   - If appears to be a **Working Professional (3-8 years exp)** in Indian tech:
     → Likely birth year is **1993-2000** (currently 26-33 years old)
   - If appears to be a **Senior Professional/Manager**:
     → Likely birth year is **1985-1993** (currently 33-41 years old)
   
   **Do NOT default to Millennials (1990s) if context suggests younger professional or student.**
   
   **Look for these clues:**
   - "Class of 202X" → Calculate: 202X - 22 = birth year
   - "Graduated 202X" → Calculate: 202X - 22 = birth year
   - "X years of experience" → Calculate: 2026 - X - 22 = approximate birth year
   - College admission year → Add 18 to get birth year

5. **NAME POPULARITY CURVES (Last Resort):**
   
   | Indian Names | Peak Years | Current Age (2026) |
   |-------------|------------|-------------------|
   | Aarav, Advait, Ananya | 2010-2020 | 6-16 years |
   | Aryan, Riya, Ishaan | 2000-2010 | 16-26 years |
   | Ankit, Amit, Priya, Pooja | 1985-1995 | 31-41 years |
   | Rahul, Arun, Sanjay, Suresh | 1970-1985 | 41-56 years |

---

### OUTPUT FORMAT (STRICT JSON-LIKE)

Respond with EXACTLY this format:

DOB: YYYY-MM-DD
CONFIDENCE: [0-100]
METHOD: [Search / Graduation Year / Experience Calculation / Heuristic / Name Curve]
SOURCES: [comma-separated list of sources or signals used]
REASONING: [1-2 sentence explanation of how you determined the DOB]

**CONFIDENCE LEVELS:**
- 90-100: Found exact DOB from public profile
- 70-89: Found graduation year or specific age mention
- 50-69: Calculated from experience/education timeline
- 30-49: Estimated from name popularity + location context
- 0-29: Pure guess, insufficient data

**EXAMPLE OUTPUT:**
DOB: 2001-06-15
CONFIDENCE: 72
METHOD: Graduation Year
SOURCES: LinkedIn Education section shows B.Tech 2023
REASONING: Found graduation year 2023, assuming typical age 22 at graduation, birth year would be around 2001. Used June 15 as default day/month.

---

Now search for "${name}" with email "${email || 'not provided'}" in "${location}" and find their DOB:
`;

  try {
    const response = await callVertexAI(prompt);
    
    let text = "";
    if (response.candidates && response.candidates[0]?.content?.parts) {
      text = response.candidates[0].content.parts
        .map((part: any) => part.text || "")
        .join("");
    }
    
    console.log(`📋 Gemini response for DOB:`, text.substring(0, 500));
    
    const result = parseDobResponse(text);
    
    // Add grounding sources if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          result.sources.push(chunk.web.uri);
        }
      });
    }
    
    return result;
    
  } catch (error) {
    console.error("DOB inference error:", error);
    
    // Fallback: Use onomastic estimation based on first name
    const firstName = name.split(' ')[0].toLowerCase();
    
    // Indian names born 1985-1995
    const indianMillennial = ['ankit', 'amit', 'priya', 'pooja', 'neha', 'rahul', 'vikas', 'deepak'];
    
    // Western millennial names
    const westernMillennial = ['joshua', 'jessica', 'ashley', 'brittany', 'tyler', 'brandon'];
    
    let estimatedYear = 1990;
    let confidence = 25;
    
    if (indianMillennial.includes(firstName)) {
      estimatedYear = 1990;
      confidence = 35;
    } else if (westernMillennial.includes(firstName)) {
      estimatedYear = 1992;
      confidence = 35;
    }
    
    return {
      dob: `${estimatedYear}-06-15`,
      dobDisplay: `06/15/${estimatedYear}`,
      age: 2026 - estimatedYear,
      confidence,
      sources: ['Name popularity analysis (fallback)'],
      reasoning: `Estimated based on first name "${firstName}" popularity patterns. Low confidence due to search failure.`
    };
  }
};

// HTTP Handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DobInferenceRequest = await req.json();
    
    if (!body.name) {
      return new Response(
        JSON.stringify({ error: "Missing required field: name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎂 DOB Inference request for: ${body.name}`);
    
    const result = await inferDob(body);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("API Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
