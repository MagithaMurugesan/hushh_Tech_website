# HushhTech Secret Runbook

This runbook keeps the current production flow intact while moving secret material out of source control.

## 1. What stays public

These values can live in frontend build environment variables because they are meant for browser use:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_REDIRECT_URL`
- `VITE_MARKET_SUPABASE_URL`
- `VITE_MARKET_SUPABASE_KEY`
- Firebase public web config values

Important: "public" does not mean "safe for private AI vendors." Do not put OpenAI, Gemini, Stripe secret, Plaid secret, or service-role keys under `VITE_*`.

## 2. What must stay server-only

Put these in Supabase Edge Function secrets, your server host env, or Secret Manager:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_API_KEY_2`
- `GEMINI_API_KEY_3`
- `GEMINI_API_KEY_4`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `NDA_ADMIN_PASSWORD`
- `VERCEL_OIDC_TOKEN`
- any Apple `.p8` private key

## 3. Where each secret should live

### Supabase Edge Functions

Set these in Supabase project secrets before deploying functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL`
- `SITE_URL`
- `SECURITY_ALLOWED_ORIGINS`
- `SECURITY_PLAID_EDGE_AUTH_MODE=observe`
- `NDA_ADMIN_PASSWORD`
- existing Stripe, Plaid, OpenAI, and Gemini server secrets used by your functions

### Frontend build environment

Set only public client values here:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_REDIRECT_URL`
- `VITE_MARKET_SUPABASE_URL`
- `VITE_MARKET_SUPABASE_KEY`

Do not set `VITE_OPENAI_API_KEY` or `VITE_GEMINI_API_KEY` in production unless you intentionally accept browser exposure for those features.

### Local development

- Keep real local values in `.env.local`
- Do not use tracked `.env` for secrets
- Keep Apple private keys outside the repo, for example:
  - `~/.private_keys/AuthKey_<KEY_ID>.p8`

## 4. Production-safe rollout order

1. Add the new secrets to Supabase and your frontend/server host.
2. Redeploy the updated Supabase Edge Functions.
3. Redeploy the frontend with the public `VITE_*` values it already expects.
4. Smoke test:
   - login
   - signup
   - auth callback
   - onboarding
   - Plaid link
   - Stripe payment
   - NDA admin
5. After traffic looks normal, rotate and revoke any exposed old secrets.

## 5. Required manual cleanup after this commit

These files were the most important exposures:

- `.env`
- `src/scripts/AuthKey_LK53NZBH4L.p8`
- `scripts/run-migration.cjs`

After you confirm the new secret locations are populated:

1. Move real local secrets into `.env.local` or provider secret storage.
2. Remove tracked secret files from git history and the index.
3. Rotate the affected credentials:
   - Apple private key
   - Supabase service-role key
   - any OpenAI/Gemini/Plaid keys that were ever committed

## 6. Still-open items

This pass removes the highest-risk literal secrets from source, but some browser-facing `anon` keys and `VITE_*` AI patterns still need a second pass:

- market/community public anon key wiring should be moved to env-backed build config everywhere
- browser-direct Gemini/OpenAI paths should be replaced with server-side proxies before production secrecy is complete
- tracked `.env` should be untracked and rotated after secrets are safely relocated
