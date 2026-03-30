import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type SecurityMode = "off" | "observe" | "enforce";

const DEFAULT_SITE_URL = "https://hushhtech.com";

function splitCsv(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getSecurityMode(
  envName: string,
  fallback: SecurityMode = "observe",
): SecurityMode {
  const raw = (Deno.env.get(envName) || fallback).trim().toLowerCase();
  if (raw === "off" || raw === "observe" || raw === "enforce") {
    return raw;
  }
  return fallback;
}

export function getPrimarySiteUrl(): string {
  const configured =
    Deno.env.get("PUBLIC_SITE_URL") ||
    Deno.env.get("SITE_URL") ||
    DEFAULT_SITE_URL;
  return normalizeOrigin(configured) || DEFAULT_SITE_URL;
}

export function getAllowedOrigins(): string[] {
  const configured = splitCsv(Deno.env.get("SECURITY_ALLOWED_ORIGINS"));
  const siteUrl = getPrimarySiteUrl();
  const defaults = [siteUrl, "https://www.hushhtech.com"];

  return [...new Set([...configured, ...defaults].map((value) => normalizeOrigin(value)).filter(Boolean) as string[])];
}

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return getAllowedOrigins().includes(normalized);
}

export function getTrustedOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin)) {
    return normalizeOrigin(origin)!;
  }

  if (origin) {
    console.warn("[Security] Untrusted origin received, using fallback site URL", {
      origin,
      fallback: getPrimarySiteUrl(),
    });
  }

  return getPrimarySiteUrl();
}

export function sanitizeReturnUrl(
  value: string | null | undefined,
  fallbackPath = "/",
): string {
  const base = getPrimarySiteUrl();
  if (!value) {
    return `${base}${fallbackPath}`;
  }

  try {
    const url = new URL(value, base);
    if (!isAllowedOrigin(url.origin)) {
      console.warn("[Security] Rejected untrusted return URL origin", {
        provided: value,
        resolvedOrigin: url.origin,
      });
      return `${base}${fallbackPath}`;
    }

    return url.toString();
  } catch {
    return `${base}${fallbackPath}`;
  }
}

function unauthorizedResponse(message: string, status = 401): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function authenticateEdgeRequest(
  req: Request,
  {
    label,
    modeEnv = "SECURITY_PLAID_EDGE_AUTH_MODE",
    expectedUserId,
  }: {
    label: string;
    modeEnv?: string;
    expectedUserId?: string | null;
  },
): Promise<Response | null> {
  const mode = getSecurityMode(modeEnv, "observe");
  if (mode === "off") {
    return null;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn(`[Security][${label}] Missing bearer token`, { mode });
    if (mode === "enforce") {
      return unauthorizedResponse("Missing authorization header");
    }
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(`[Security][${label}] Supabase service config missing`, { mode });
    if (mode === "enforce") {
      return unauthorizedResponse("Authentication unavailable", 500);
    }
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.warn(`[Security][${label}] Invalid bearer token`, {
      mode,
      error: error?.message,
    });
    if (mode === "enforce") {
      return unauthorizedResponse("Invalid or expired token");
    }
    return null;
  }

  if (expectedUserId && user.id !== expectedUserId) {
    console.warn(`[Security][${label}] Authenticated user mismatch`, {
      mode,
      expectedUserId,
      actualUserId: user.id,
    });
    if (mode === "enforce") {
      return unauthorizedResponse("Authenticated user mismatch", 403);
    }
  }

  return null;
}
