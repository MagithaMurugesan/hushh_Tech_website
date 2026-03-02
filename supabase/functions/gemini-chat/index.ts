/**
 * Supabase Edge Function: Gemini Chat Proxy with Usage Tracking
 * 
 * Secure proxy for Gemini API - keeps API key on server side
 * Logs all usage to hushh_agents_chat_logs for analytics
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.0-flash";

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  language?: string;
  model?: string;
  userId?: string;
  sessionId?: string;
  systemInstruction?: string;
  agentId?: string;
}

// Create Supabase client for logging
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[gemini-chat] Supabase credentials not configured - logging disabled");
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Log message to tracking table
async function logChatMessage(
  supabase: ReturnType<typeof createClient> | null,
  userId: string | undefined,
  role: "user" | "assistant",
  content: string,
  language: string,
  agentId: string,
  inputTokens: number,
  outputTokens: number,
  responseTimeMs: number,
  sessionId?: string
) {
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase.from("hushh_agents_chat_logs").insert({
      user_id: userId,
      session_id: sessionId || null,
      role,
      content: content.substring(0, 5000), // Limit content length for storage
      content_length: content.length,
      agent_id: agentId,
      language_code: language,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      response_time_ms: responseTimeMs,
      model_used: DEFAULT_MODEL,
    });

    if (error) {
      console.warn("[gemini-chat] Failed to log message:", error.message);
    } else {
      console.log(`[gemini-chat] Logged ${role} message for user ${userId}`);
    }

    // Update user stats
    if (role === "user") {
      await supabase.rpc("log_hushh_agents_message", {
        p_user_id: userId,
        p_role: role,
        p_content: content.substring(0, 1000),
        p_agent_id: agentId,
        p_language_code: language,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
        p_response_time_ms: responseTimeMs,
        p_session_id: sessionId || null,
      });
    }
  } catch (err) {
    console.error("[gemini-chat] Logging error:", err);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get all available API keys (supports up to 4 for load balancing/fallback)
    const API_KEYS = [
      Deno.env.get("GEMINI_API_KEY"),
      Deno.env.get("GEMINI_API_KEY_2"),
      Deno.env.get("GEMINI_API_KEY_3"),
      Deno.env.get("GEMINI_API_KEY_4"),
    ].filter(key => key && key.startsWith("AIza"));
    
    if (API_KEYS.length === 0) {
      console.error("[gemini-chat] No valid API keys configured (keys must start with AIza)");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[gemini-chat] Found ${API_KEYS.length} valid API keys`);
    
    // Rotate keys based on timestamp for load distribution
    const keyIndex = Math.floor(Date.now() / 1000) % API_KEYS.length;
    const GEMINI_API_KEY = API_KEYS[keyIndex];

    // Initialize Supabase client for logging
    const supabase = getSupabaseClient();

    // Parse request
    const { 
      message, 
      history = [], 
      language = "en-US", 
      model = DEFAULT_MODEL,
      userId,
      sessionId,
      systemInstruction: customSystemInstruction,
      agentId: customAgentId 
    }: ChatRequest = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[gemini-chat] Request: user=${userId || 'anonymous'}, lang=${language}, msg="${message.substring(0, 50)}..."`);

    // Build system instruction based on language
    const languageInstructions: Record<string, string> = {
      "en-US": "Respond in English.",
      "en-IN": "Respond in English with an Indian context when relevant.",
      "hi-IN": "आपको हिंदी में जवाब देना है। सभी responses हिंदी में होने चाहिए।",
      "ta-IN": "நீங்கள் தமிழில் பதிலளிக்க வேண்டும். அனைத்து பதில்களும் தமிழில் இருக்க வேண்டும்।",
    };

    // Use custom system instruction if provided (e.g., for agent-specific chats)
    const systemInstruction = customSystemInstruction || `You are Hushh, a friendly and intelligent AI assistant created by Hushh Labs. You help users with a wide variety of tasks including answering questions, creative writing, analysis, coding, and general conversation.

Key traits:
- Warm, professional, and approachable
- Clear and concise in your responses
- Helpful and proactive in offering assistance
- Respectful of user privacy
- Knowledgeable across many domains

${languageInstructions[language] || languageInstructions["en-US"]}

Important: Never mention that you are powered by Gemini or Google. You are Hushh, created by Hushh Labs.`;

    // Determine agent ID for logging
    const effectiveAgentId = customAgentId || "hushh";

    // Build conversation history
    const contents = [
      ...history.map((msg) => ({
        role: msg.role,
        parts: msg.parts,
      })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    // Call Gemini API
    const geminiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.9,
          topK: 40,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error(`[gemini-chat] Gemini API error: ${geminiResponse.status}`, errorData);
      return new Response(
        JSON.stringify({ 
          error: "AI service error", 
          details: geminiResponse.status === 403 ? "API key issue" : "Service unavailable" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await geminiResponse.json();
    
    // Extract response text and usage
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I couldn't generate a response.";
    const usageMetadata = data.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;

    console.log(`[gemini-chat] Response generated in ${responseTime}ms, tokens: in=${inputTokens}, out=${outputTokens}`);

    // Log both user message and assistant response
    if (userId) {
      // Log user message
      await logChatMessage(
        supabase,
        userId,
        "user",
        message,
        language,
        effectiveAgentId,
        inputTokens,
        0,
        0,
        sessionId
      );

      // Log assistant response
      await logChatMessage(
        supabase,
        userId,
        "assistant",
        responseText,
        language,
        effectiveAgentId,
        0,
        outputTokens,
        responseTime,
        sessionId
      );
    }

    return new Response(
      JSON.stringify({
        response: responseText,
        model: model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        responseTimeMs: responseTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[gemini-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
