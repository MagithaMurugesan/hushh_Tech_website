/**
 * Gemini Voice Token - Supabase Edge Function
 * 
 * Generates WebSocket URL for Gemini Live API voice connections.
 * Supports Tamil, Hindi, and English voice conversations.
 * 
 * Endpoint: POST /functions/v1/gemini-voice-token
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rotate through multiple API keys for high availability
const getApiKey = (): string => {
  const keys = [
    Deno.env.get("GEMINI_API_KEY"),
    Deno.env.get("GEMINI_API_KEY_2"),
    Deno.env.get("GEMINI_API_KEY_3"),
    Deno.env.get("GEMINI_API_KEY_4"),
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  // Random selection for load balancing
  const index = Math.floor(Math.random() * keys.length);
  return keys[index];
};

// Language-specific system prompts
const SYSTEM_PROMPTS: Record<string, string> = {
  "ta-IN": `நீங்கள் ஹஷ் (Hushh) AI உதவியாளர். தமிழில் மட்டுமே பதிலளிக்கவும்.
You are Hushh AI assistant. ALWAYS respond in Tamil language only.
Be helpful, friendly, and conversational.
Keep responses concise for voice conversations.`,
  
  "hi-IN": `आप हुश (Hushh) AI सहायक हैं। केवल हिंदी में जवाब दें।
You are Hushh AI assistant. ALWAYS respond in Hindi language only.
Be helpful, friendly, and conversational.
Keep responses concise for voice conversations.`,
  
  "en-US": `You are Hushh AI assistant. Be helpful, friendly, and conversational.
Keep responses concise for voice conversations.`,
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const language = body.language || "ta-IN";

    // Get API key
    const apiKey = getApiKey();

    // Generate WebSocket URL for Gemini Live API
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    // Get language-specific prompt
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS["en-US"];

    // Return connection info
    return new Response(
      JSON.stringify({
        success: true,
        wsUrl,
        language,
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        systemPrompt,
        config: {
          response_modalities: ["AUDIO", "TEXT"],
          speech_config: {
            language_code: language,
          },
        },
        expiresIn: 3600, // 1 hour session
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Gemini voice token error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate voice token",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
