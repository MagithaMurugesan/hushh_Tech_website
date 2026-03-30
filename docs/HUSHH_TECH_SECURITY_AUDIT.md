# Hushh.tech Security Audit

**Date:** 2026-03-25  
**Scope:** `hushh.tech` investor-facing auth, onboarding, NDA, KYC, Plaid, Stripe, and the Vercel/Supabase functions those flows invoke  
**Approach:** direct-to-production hardening with reversible rollout controls

---

## Executive Summary

The investor surface has multiple high-risk issues concentrated in four areas:

1. Client-side trust where server-side truth is required
2. Sensitive credential handling in source and browser code
3. Weak protection around internal/admin routes
4. Backend helper functions that were built for convenience before hardening

The immediate objective is to reduce exposure without harming live onboarding, payment, or KYC conversion. Fixes that could affect user flow should ship in `observe` mode first and only move to `enforce` after production smoke checks.

---

## Scope

Included:

- `/login`, `/signup`, `/auth/callback`
- `/onboarding/*`
- NDA signing and NDA admin access
- Stripe payment and verification flows
- Plaid connection, data fetch, and bank-detail autofill
- Supabase Edge Functions and Vercel API routes used by those paths

Excluded for this first pass:

- unrelated mobile/research modules
- community/report tooling unless it shares secrets or auth/config with investor flows
- non-production experiments not reachable from the investor funnel

---

## Attack Surface Inventory

Frontend routes:

- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- `src/pages/AuthCallback.tsx`
- `src/pages/onboarding/financial-link/logic.ts`
- `src/pages/onboarding/step-1/logic.ts`
- `src/pages/onboarding/step-13/logic.ts`
- `src/pages/onboarding/meet-ceo/logic.ts`
- `src/pages/nda-admin/index.tsx`

Sensitive backend endpoints:

- `supabase/functions/create-link-token/index.ts`
- `supabase/functions/exchange-public-token/index.ts`
- `supabase/functions/get-balance/index.ts`
- `supabase/functions/get-auth-numbers/index.ts`
- `supabase/functions/get-identity/index.ts`
- `supabase/functions/identity-match/index.ts`
- `supabase/functions/asset-report-create/index.ts`
- `supabase/functions/investments-holdings/index.ts`
- `supabase/functions/signal-prepare/index.ts`
- `supabase/functions/signal-evaluate/index.ts`
- `supabase/functions/create-verification-session/index.ts`
- `supabase/functions/onboarding-create-checkout/index.ts`
- `supabase/functions/onboarding-verify-payment/index.ts`
- `supabase/functions/ceo-calendar-booking/index.ts`
- `supabase/functions/nda-admin-fetch/index.ts`
- `supabase/functions/chat-create-checkout/index.ts`

---

## Findings Table

| ID | Severity | Surface | Summary | Status |
| --- | --- | --- | --- | --- |
| `SEC-001` | Critical | Secrets | tracked `.env` and private key material in repo | open |
| `SEC-002` | Critical | Plaid | helper endpoints accept sensitive requests without enforced auth | in_progress |
| `SEC-003` | Critical | Plaid | browser can read and reuse `plaid_access_token` | open |
| `SEC-004` | Critical | Banking | bank account “encryption” uses `btoa()` | open |
| `SEC-005` | High | NDA admin | admin access trusted client-side state and exposed password logic | in_progress |
| `SEC-006` | High | Auth | redirect query params were not sanitized to internal paths | in_progress |
| `SEC-007` | High | Stripe | checkout/return URLs were built from untrusted request origin | in_progress |
| `SEC-008` | High | Verification | Stripe verification return URL accepted untrusted origin/path input | in_progress |
| `SEC-009` | High | Onboarding | financial-step progression trusted `sessionStorage` flags | open |
| `SEC-010` | High | Browser LLM | insecure browser-side OpenAI/Gemini fallbacks remain in source | open |
| `SEC-011` | Medium | CORS | multiple endpoints still use wildcard CORS | open |
| `SEC-012` | Medium | Headers | current CSP still allows `unsafe-inline` and `unsafe-eval` | open |

---

## Detailed Findings

### `SEC-001` Tracked secrets and key material in repo

- **Severity:** Critical
- **Evidence:**
  - `.env` is tracked in git
  - `src/scripts/AuthKey_LK53NZBH4L.p8` is tracked in git
- **Exploit path:** repo access or artifact leakage exposes reusable credentials
- **Business impact:** credential compromise, vendor account abuse, emergency rotation burden
- **Recommended fix:**
  - rotate all exposed credentials
  - remove secret-bearing files from source control history and active tree
  - replace with example/template files only
- **Validation:**
  - `git ls-files` no longer returns secret-bearing runtime files
  - runtime secrets come only from deployment environment or secret manager

### `SEC-002` Plaid helper endpoints lack enforced auth

- **Severity:** Critical
- **Evidence:**
  - helper functions accepted requests without mandatory JWT validation
  - endpoints process sensitive Plaid actions from bearer/body input
- **Exploit path:** attacker can call helper endpoints directly and drive Plaid operations
- **Business impact:** cost abuse, data exposure, unauthorized financial lookups
- **Recommended fix:**
  - shared auth helper with `observe` / `enforce`
  - require valid Supabase JWT before executing Plaid calls
  - add user mismatch checks where caller supplies `userId`
- **Validation:**
  - unauthenticated requests log in `observe`
  - unauthenticated requests fail in `enforce`

### `SEC-003` Browser-readable Plaid access tokens

- **Severity:** Critical
- **Evidence:**
  - `user_financial_data.plaid_access_token` is stored and selected by client code
  - onboarding bank autofill reads the token back in the browser
- **Exploit path:** XSS or compromised browser session can extract a durable Plaid credential
- **Business impact:** unauthorized bank-data retrieval and regulatory/compliance exposure
- **Recommended fix:**
  - move Plaid access tokens to server-only storage
  - never return them to browser code
  - rework autofill through server-side functions only
- **Validation:**
  - no client query selects `plaid_access_token`
  - browser network logs never contain Plaid access tokens

### `SEC-004` Pseudo-encryption of bank account numbers

- **Severity:** Critical
- **Evidence:**
  - bank account values are encoded with `btoa()`
- **Exploit path:** any reader can reverse the value with `atob()`
- **Business impact:** exposed bank account numbers, false sense of protection
- **Recommended fix:**
  - remove client-side encoding pattern
  - move encryption/tokenization server-side with managed key material
- **Validation:**
  - client never writes raw or base64 bank numbers to database
  - server-only encrypted/tokenized storage path exists

### `SEC-005` NDA admin access exposed in frontend trust model

- **Severity:** High
- **Evidence:**
  - admin page used local password logic and `sessionStorage` auth state
- **Exploit path:** browser-side state or bundled logic could be bypassed or replayed
- **Business impact:** exposure of signed NDA records and audit metadata
- **Recommended fix:**
  - authenticate only through server response
  - keep admin secret server-side
  - make admin session memory-only until a stronger server-side admin auth model replaces it
- **Validation:**
  - password is not embedded in client bundle
  - page does not auto-auth based on `sessionStorage`

### `SEC-006` Open redirect through auth flow

- **Severity:** High
- **Evidence:**
  - auth entrypoints used `redirect` query input directly
- **Exploit path:** phishing link can bounce a trusted login flow into attacker-controlled destination
- **Business impact:** credential phishing and user-trust damage
- **Recommended fix:**
  - accept only same-origin internal redirects
  - default to safe in-app destination on invalid input
- **Validation:**
  - `/login?redirect=https://evil.example` lands on safe internal fallback

### `SEC-007` Stripe checkout redirect origin trusted request header

- **Severity:** High
- **Evidence:**
  - checkout functions used raw `Origin` header to compose success/cancel URLs
- **Exploit path:** crafted cross-origin request can poison Stripe return destination
- **Business impact:** redirect abuse around payment flow
- **Recommended fix:**
  - validate origin against allowed production origins
  - fall back to canonical site URL when invalid
- **Validation:**
  - untrusted origin produces canonical site return URL

### `SEC-008` Verification return URL accepted from request body

- **Severity:** High
- **Evidence:**
  - verification session accepted caller-provided `returnUrl`
- **Exploit path:** attacker can attempt redirect tampering after identity flow
- **Business impact:** trust erosion and flow hijack risk
- **Recommended fix:**
  - sanitize to allowed origin list
  - default to canonical verification completion path
- **Validation:**
  - untrusted return URL resolves to canonical site path

### `SEC-009` Onboarding progression trusts browser storage

- **Severity:** High
- **Evidence:**
  - `financial_link_skipped` and `financial_verification_complete` in `sessionStorage`
  - step gating honors those browser-set values
- **Exploit path:** user can set flags manually and bypass financial-step guardrail
- **Business impact:** inconsistent onboarding truth and weakened compliance posture
- **Recommended fix:**
  - move progression truth to server-backed record
  - treat browser storage only as UX cache, never authorization state
- **Validation:**
  - manual `sessionStorage` mutation does not change server-authorized access

### `SEC-010` Insecure browser-side LLM fallbacks remain in source

- **Severity:** High
- **Evidence:**
  - deprecated browser-side OpenAI/Gemini paths still exist in source
- **Exploit path:** accidental runtime use exposes vendor keys to browser/network tools
- **Business impact:** API key leakage and cost abuse
- **Recommended fix:**
  - remove or hard-disable browser-direct AI paths
  - keep only server/edge-function execution paths
- **Validation:**
  - production bundle contains no direct OpenAI browser calls for investor flows

### `SEC-011` Wildcard CORS on sensitive endpoints

- **Severity:** Medium
- **Evidence:**
  - shared CORS headers use `Access-Control-Allow-Origin: *`
- **Exploit path:** permissive browser access broadens abuse surface
- **Business impact:** easier cross-origin probing and misuse
- **Recommended fix:**
  - add origin allowlist with `observe` then `enforce`
- **Validation:**
  - disallowed origins are logged first, then blocked when enabled

### `SEC-012` CSP still allows risky script execution modes

- **Severity:** Medium
- **Evidence:**
  - enforced CSP includes `unsafe-inline` and `unsafe-eval`
- **Exploit path:** XSS impact is amplified
- **Business impact:** larger blast radius for any injected script
- **Recommended fix:**
  - introduce stricter `Content-Security-Policy-Report-Only`
  - phase out inline/eval dependencies before enforcement
- **Validation:**
  - report-only telemetry shows no legitimate breakage before enforcement

---

## Remediation Roadmap

### P0

- rotate exposed secrets and remove tracked secret material
- enforce server-side truth for NDA admin access
- add auth controls to Plaid helper functions
- stop returning or reading Plaid access tokens in browser code
- remove client-side pseudo-encryption of bank data

### P1

- sanitize all auth and payment redirects/origins
- move onboarding progression checks to server truth
- harden verification and calendar flows
- disable insecure browser-direct AI fallbacks

### P2

- move CORS from wildcard to allowlist with rollout flags
- tighten CSP with report-only first
- add rate-limit and anomaly telemetry on sensitive flows

---

## Validation Checklist For Each Fix PR

- baseline current prod behavior before deploy
- deploy with reversible configuration where behavior could block users
- run smoke checks for login, onboarding, Plaid, NDA, Stripe, and CEO booking
- inspect logs for false positives during `observe`
- promote to `enforce` only after no meaningful regression is observed

---

## Current Implementation Status

This repo update begins the direct-to-production hardening path with:

- auth redirect sanitization on frontend auth entrypoints
- server-side NDA admin authentication shift away from client-trusted state
- validated origin/return URL handling for Stripe and verification flows
- shared observe/enforce auth scaffolding for Plaid helper functions

The remaining P0 items still need code changes before the investor surface can be considered hardened.
