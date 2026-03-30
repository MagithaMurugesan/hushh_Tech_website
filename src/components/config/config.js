import { createClient } from "@supabase/supabase-js";

const env = typeof import.meta !== "undefined" ? import.meta.env : {};

function readClientEnv(value, name, fallback = "") {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  console.error(`[Config] Missing required client environment variable: ${name}`);
  return fallback;
}

const config = {
  SUPABASE_URL: readClientEnv(env?.VITE_SUPABASE_URL, "VITE_SUPABASE_URL"),
  SUPABASE_ANON_KEY: readClientEnv(env?.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY"),
  guestModeAccessToken: env?.VITE_GUEST_MODE_ACCESS_TOKEN || "",
  redirect_url:
    env?.VITE_SUPABASE_REDIRECT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "https://www.hushhtech.com/auth/callback"),
};

function createSupabaseClient() {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    return undefined;
  }

  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  return supabase;
}

config.supabaseClient = createSupabaseClient();

export default config;
