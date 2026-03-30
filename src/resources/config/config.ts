import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getOAuthRedirectUrl } from "../../utils/platform";

interface Config {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  redirect_url: string;
  supabaseClient?: SupabaseClient;
}

function readClientEnv(value: string | undefined, name: string, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  console.error(`[Config] Missing required client environment variable: ${name}`);
  return fallback;
}

const config: Config = {
  SUPABASE_URL: readClientEnv(import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL"),
  SUPABASE_ANON_KEY: readClientEnv(import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY"),
  // Use platform-aware redirect URL for iOS Universal Links support
  redirect_url:
    import.meta.env.VITE_SUPABASE_REDIRECT_URL || getOAuthRedirectUrl(),
};

function createSupabaseClient() {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    return undefined;
  }

  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return supabase;
}

config.supabaseClient = createSupabaseClient();

export default config;
