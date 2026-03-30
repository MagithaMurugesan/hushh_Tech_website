export const DEFAULT_AUTH_REDIRECT = "/hushh-user-profile";

/**
 * Only allow same-origin, app-internal redirects.
 * External URLs, protocol-relative URLs, and malformed values fall back.
 */
export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  if (!value) return fallback;

  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(candidate, "https://hushh.local");
    if (url.origin !== "https://hushh.local") {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}
