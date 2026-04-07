import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import config from "../resources/config/config";
import {
  DEFAULT_AUTH_REDIRECT,
  sanitizeInternalRedirect,
} from "../utils/security";

export type AuthSessionStatus =
  | "booting"
  | "authenticated"
  | "anonymous"
  | "invalidated";

export type AuthSessionReason =
  | "signed_out"
  | "expired"
  | "deleted"
  | "invalid_session";

export type OAuthProvider = "google" | "apple";

export interface AuthSessionSnapshot {
  status: AuthSessionStatus;
  session: Session | null;
  user: User | null;
  reason?: AuthSessionReason;
}

export interface AuthBroadcastEvent {
  at: number;
  reason: AuthSessionReason;
}

export const AUTH_EVENT_STORAGE_KEY = "hushh_auth_event";

const LEGACY_AUTH_STORAGE_KEYS = [
  "isLoggedIn",
  "showWelcomeToast",
  "showWelcomeToastUserId",
];

export function clearLegacyAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  LEGACY_AUTH_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export function buildOAuthRedirectTo(
  provider: OAuthProvider,
  search: string = window.location.search
) {
  const baseRedirectUrl =
    config.redirect_url || `${window.location.origin}/auth/callback`;
  const currentParams = new URLSearchParams(search);
  const rawRedirectPath = currentParams.get("redirect");
  const redirectPath = rawRedirectPath
    ? sanitizeInternalRedirect(rawRedirectPath, DEFAULT_AUTH_REDIRECT)
    : null;

  let redirectTo = baseRedirectUrl;
  if (redirectPath) {
    redirectTo = `${redirectTo}?redirect=${encodeURIComponent(redirectPath)}`;
  }

  if (provider === "google") {
    return {
      redirectTo,
      queryParams: { access_type: "offline", prompt: "consent" },
    };
  }

  return {
    redirectTo,
    scopes: "name email",
  };
}

export async function startUnifiedOAuth(
  provider: OAuthProvider,
  client: SupabaseClient | undefined = config.supabaseClient
) {
  try {
    if (!client) {
      console.error("[AuthSession] Supabase client is not initialized");
      return false;
    }

    const options = buildOAuthRedirectTo(provider);
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options,
    });

    if (error) {
      console.error(`[AuthSession] ${provider} OAuth start failed:`, error);
      return false;
    }

    if (data?.url) {
      window.location.assign(data.url);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[AuthSession] ${provider} OAuth start failed:`, error);
    return false;
  }
}

export function getAuthInvalidationReason(error?: {
  message?: string;
  status?: number;
} | null): AuthSessionReason {
  const message = error?.message?.toLowerCase() || "";
  if (error?.status === 401 || message.includes("expired")) {
    return "expired";
  }

  return "invalid_session";
}

export async function validateSessionCandidate(
  client: SupabaseClient | undefined,
  session: Session | null
): Promise<AuthSessionSnapshot> {
  if (!client || !session?.access_token || !session.user?.id) {
    return {
      status: "anonymous",
      session: null,
      user: null,
    };
  }

  if (typeof client.auth.getUser !== "function") {
    return {
      status: "authenticated",
      session,
      user: session.user as User,
    };
  }

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user || user.id !== session.user.id) {
      return {
        status: "invalidated",
        session: null,
        user: null,
        reason: getAuthInvalidationReason(error),
      };
    }

    return {
      status: "authenticated",
      session,
      user,
    };
  } catch (error) {
    console.error("[AuthSession] Session validation failed:", error);
    return {
      status: "invalidated",
      session: null,
      user: null,
      reason: "invalid_session",
    };
  }
}

export async function getValidatedSession(
  client: SupabaseClient | undefined = config.supabaseClient
): Promise<AuthSessionSnapshot> {
  if (!client) {
    return {
      status: "anonymous",
      session: null,
      user: null,
    };
  }

  try {
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (!session) {
      return {
        status: error ? "invalidated" : "anonymous",
        session: null,
        user: null,
        reason: error ? getAuthInvalidationReason(error) : undefined,
      };
    }

    return validateSessionCandidate(client, session);
  } catch (error) {
    console.error("[AuthSession] Failed to read current session:", error);
    return {
      status: "invalidated",
      session: null,
      user: null,
      reason: "invalid_session",
    };
  }
}

export async function getAuthenticatedSession(
  client: SupabaseClient | undefined = config.supabaseClient,
  errorMessage = "User not logged in. Please sign in again."
): Promise<Session> {
  const snapshot = await getValidatedSession(client);

  if (snapshot.status !== "authenticated" || !snapshot.session?.access_token) {
    throw new Error(errorMessage);
  }

  return snapshot.session;
}

export async function clearSupabaseSession(
  client: SupabaseClient | undefined = config.supabaseClient
) {
  if (!client) {
    return;
  }

  try {
    await client.auth.signOut({ scope: "local" as any });
  } catch (error) {
    console.warn("[AuthSession] Local sign-out fallback failed:", error);
  }
}

export function broadcastAuthEvent(reason: AuthSessionReason) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: AuthBroadcastEvent = {
    at: Date.now(),
    reason,
  };

  try {
    window.localStorage.setItem(AUTH_EVENT_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[AuthSession] Failed to broadcast auth event:", error);
  }
}

export function parseAuthBroadcastEvent(
  rawValue: string | null
): AuthBroadcastEvent | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthBroadcastEvent>;
    if (
      typeof parsed?.at === "number" &&
      typeof parsed?.reason === "string"
    ) {
      return parsed as AuthBroadcastEvent;
    }
  } catch (error) {
    console.warn("[AuthSession] Failed to parse auth event:", error);
  }

  return null;
}
