/**
 * MCP Agent Card API
 * Returns agent metadata in MCP-compatible format
 * GET /api/mcp/agents/:id
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader("Content-Type", "application/json");

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Agent ID is required" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fetch agent from kirkland_agents table
    const { data: agent, error } = await supabase
      .from("kirkland_agents")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        error: "Agent not found",
        agentId: id,
      });
    }

    // Build MCP Agent Card response
    const agentCard = {
      // MCP Agent Card spec fields
      name: agent.name,
      description: `${agent.name} — ${(agent.categories || []).join(", ")} located in ${agent.city}, ${agent.state}`,
      url: `https://hushhtech.com/hushh-agents/kirkland/${agent.id}`,
      
      // Provider info
      provider: {
        organization: "Hushh Labs",
        url: "https://hushhtech.com",
      },

      // Version
      version: "1.0.0",

      // Capabilities
      capabilities: {
        streaming: false,
        pushNotifications: false,
      },

      // Skills / tools this agent provides
      skills: [
        {
          id: "chat",
          name: "Chat with Agent",
          description: `Have a conversation with ${agent.name}`,
          inputModes: ["text"],
          outputModes: ["text"],
        },
        {
          id: "info",
          name: "Get Business Info",
          description: `Get information about ${agent.name} including hours, location, and services`,
          inputModes: ["text"],
          outputModes: ["text"],
        },
      ],

      // Agent metadata
      metadata: {
        agentId: agent.id,
        alias: agent.alias || null,
        phone: agent.phone || null,
        address: [agent.address1, agent.address2].filter(Boolean).join(", "),
        city: agent.city,
        state: agent.state,
        zip: agent.zip,
        country: agent.country,
        coordinates: agent.latitude && agent.longitude
          ? { lat: agent.latitude, lng: agent.longitude }
          : null,
        rating: agent.avg_rating,
        reviewCount: agent.review_count,
        categories: agent.categories || [],
        isOpen: !agent.is_closed,
        photoUrl: agent.photo_url || null,
      },

      // Authentication (none required for public agents)
      authentication: {
        schemes: ["none"],
      },

      // Chat endpoint
      defaultInputModes: ["text"],
      defaultOutputModes: ["text"],

      // Links
      _links: {
        chat: {
          href: `https://hushhtech.com/hushh-agents/kirkland/${agent.id}/chat`,
          method: "GET",
        },
        detail: {
          href: `https://hushhtech.com/hushh-agents/kirkland/${agent.id}`,
          method: "GET",
        },
      },
    };

    return res.status(200).json(agentCard);
  } catch (err) {
    console.error("[mcp-agents] Error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
}
