import resources from "../../resources/resources";
import { sanitizeInternalRedirect } from "../../utils/security";

// Use Supabase OAuth flow for Google sign-in.
export default async function googleSignIn() {
  try {
    const supabase = resources.config.supabaseClient;
    if (!supabase) {
      console.error("Supabase client is not initialized");
      return;
    }

    const baseRedirectUrl =
      resources.config.redirect_url || `${window.location.origin}/auth/callback`;

    // Preserve redirect parameter from current URL (for Hushh AI and other modules)
    const currentParams = new URLSearchParams(window.location.search);
    const rawRedirectPath = currentParams.get('redirect');
    const redirectPath = rawRedirectPath
      ? sanitizeInternalRedirect(rawRedirectPath)
      : null;

    // Force redirect to /auth/callback to ensure we handle MFA/Onboarding checks
    let redirectTo = baseRedirectUrl;

    // If there's a redirect param, append it to the callback URL
    if (redirectPath) {
      redirectTo = `${redirectTo}?redirect=${encodeURIComponent(redirectPath)}`;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      console.error("Supabase Google sign-in failed:", error);
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }
  } catch (error) {
    console.error("Supabase Google Sign-In failed:", error);
  }
}
