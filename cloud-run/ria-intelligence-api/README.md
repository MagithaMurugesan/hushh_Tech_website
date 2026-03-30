# Hushh RIA Intelligence API

Standalone Python API for advisor lookup and public-web dossier generation.

## What This API Does

This API is query-first.

Client sends only a name or firm query. The backend then:

1. verifies the query against FINRA and SEC public records using Gemini on Vertex AI
2. builds a verified Phase 1 profile internally
3. passes that verified profile into OpenAI Responses API as seed JSON
4. scrapes public image source pages and ranks image candidates with `gpt-5.4-pro`
5. returns the final dossier JSON

This endpoint does not generate DOCX, markdown, HTML, or stored file artifacts.

## Quick Start

Public request body:

```json
{
  "query": "ANA ROUMENOVA CARTER"
}
```

You do not send:

- Phase 1 seed JSON
- FINRA details manually
- CRD number manually
- image/document payloads
- old wrapper fields like `success`, `profile`, `pipeline`, `sources`, or `warnings`

## How To Use This API

This is a synchronous, long-running dossier API.

Client integration should be:

1. send one `POST /v1/ria/profile` request with only `query`
2. keep the request open while the backend completes Phase 1, dossier research, scraping, and image ranking
3. parse the final dossier JSON when the request completes
4. use `verified_profiles`, `key_facts`, and `unverified_or_not_found` to decide what is truly confirmed versus missing

This is not a fire-and-forget endpoint.

Do not:

- send a Phase 1 seed yourself
- retry the same query every few seconds
- assume missing LinkedIn, image, or socials means the whole request failed
- assume `200 OK` means every optional field was found

## Execution Flow

One request goes through these steps:

1. client sends `{ "query": "<advisor or firm name>" }`
2. Gemini on Vertex performs Phase 1 regulatory verification against FINRA and SEC signals
3. backend converts the verified Phase 1 profile into internal seed JSON
4. OpenAI `gpt-5.4` performs dossier research with web search
5. if the primary dossier model is unavailable or returns unusable structured output, backend falls back to `gpt-5-mini`
6. backend fetches source pages and extracts image candidates from:
   - `meta[property="og:image"]`
   - `meta[name="twitter:image"]`
   - `<img>`
7. OpenAI `gpt-5.4-pro` ranks shortlisted images
8. if image ranking fails, backend falls back to locally validated image candidates
9. final dossier JSON is returned

The endpoint stays open until the full flow finishes or the service fails before a usable dossier can be produced.

## Expected Wait Time

This endpoint is intentionally slow compared with a normal CRUD API because it does live verification and research.

Practical guidance:

- treat this as a multi-minute request, not a sub-10-second request
- successful production requests can take roughly `2` to `7` minutes depending on query complexity, upstream retries, and image work
- Cloud Run is deployed with a `600s` request timeout
- the OpenAI client inside the service uses `OPENAI_TIMEOUT_SECONDS=180` per upstream call, and fallback behavior can increase end-to-end latency

Client timeout guidance:

- do not use a client timeout like `30s`, `60s`, `90s`, or `120s`
- `180s` can still be too short for successful requests
- if your platform allows it, use a client timeout close to `600s`
- if you must show progress UI, show long-running states instead of failing early

Good loading copy:

- `Verifying against FINRA and SEC...`
- `Building the public dossier...`
- `Checking source-backed profiles...`
- `Finding public images...`
- `Ranking the strongest public image candidates...`

## Base URL

Production:

```text
https://hushh-ria-intelligence-api-53407187172.us-central1.run.app
```

Local:

```text
http://127.0.0.1:8000
```

## Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Basic liveness check |
| `GET` | `/health` | Primary health check |
| `GET` | `/healthz` | Legacy compatibility alias; avoid depending on this on Cloud Run |
| `POST` | `/v1/ria/profile` | Main dossier-generation route |

## Main Endpoint

### `POST /v1/ria/profile`

#### Request

```json
{
  "query": "ANA ROUMENOVA CARTER"
}
```

#### Request rules

- `query` is required
- `query` must not be blank
- `query` can be an advisor name or firm name
- the client sends only the query string
- the backend builds the verified Phase 1 profile internally

#### Example production request

```bash
curl -sS --max-time 600 -X POST https://hushh-ria-intelligence-api-53407187172.us-central1.run.app/v1/ria/profile \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ANA ROUMENOVA CARTER"
  }'
```

Minimal one-line request:

```bash
curl -sS --max-time 600 -X POST https://hushh-ria-intelligence-api-53407187172.us-central1.run.app/v1/ria/profile -H "Content-Type: application/json" -d '{"query":"ANA ROUMENOVA CARTER"}'
```

#### Example local request

```bash
curl -X POST http://127.0.0.1:8000/v1/ria/profile \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ANA ROUMENOVA CARTER"
  }'
```

## Response Format

The API returns dossier JSON only.

It does not return the old wrapper response.

### Response shape

```json
{
  "subject": {
    "full_name": "ANA ROUMENOVA CARTER",
    "crd_number": "4424794",
    "current_firm": "LCG CAPITAL ADVISORS, LLC",
    "location": "Tampa, Florida"
  },
  "executive_summary": "Ana Carter is a finance executive and outsourced FINOP.",
  "verified_profiles": [
    {
      "platform": "FINRA BrokerCheck",
      "label": "BrokerCheck Report - ANA ROUMENOVA CARTER",
      "url": "https://files.brokercheck.finra.org/individual/individual_4424794.pdf",
      "handle": null,
      "source_title": "BrokerCheck Report - ANA ROUMENOVA CARTER",
      "source_url": "https://files.brokercheck.finra.org/individual/individual_4424794.pdf",
      "evidence_note": "Official regulatory source captured during Phase 1 verification."
    }
  ],
  "public_images": [
    {
      "kind": "headshot",
      "image_url": "https://images.example/ana-final.jpg",
      "source_page_url": "https://cartanaconsulting.com/about-cartana/",
      "source_title": "About Cartana",
      "confidence_note": "Best public headshot among validated candidates."
    }
  ],
  "key_facts": [
    {
      "fact": "Founder of Cartana Consulting Solutions.",
      "source_title": "About Cartana",
      "source_url": "https://cartanaconsulting.com/about-cartana/",
      "evidence_note": "Official company biography."
    }
  ],
  "unverified_or_not_found": [],
  "prompts_used": [
    "Ana Roumenova Carter LinkedIn"
  ]
}
```

### Field meanings

- `subject`: final identity summary. Phase 1 verified values take precedence here.
- `subject.full_name`: final resolved subject name.
- `subject.crd_number`: FINRA CRD number when verified; otherwise `null`.
- `subject.current_firm`: best verified current firm; otherwise `null`.
- `subject.location`: best verified location; otherwise `null`.
- `executive_summary`: source-backed summary generated from verified public evidence.
- `verified_profiles`: official regulatory links plus other confidently verified public profiles.
- `public_images`: validated public image URLs only.
- `public_images.kind`: current image type label such as `headshot`, `company logo`, or `banner`.
- `key_facts`: source-backed facts only.
- `unverified_or_not_found`: missing, ambiguous, or low-confidence items.
- `prompts_used`: search phrases returned by structured model output when available.

## How To Tell If The Response Has Real Data

The response is meant to be read as a source-backed dossier, not just as a bag of strings.

Use these rules:

### Identity is strongly confirmed when

- `subject.full_name` is populated
- `subject.crd_number` is populated for a regulated person or firm
- `verified_profiles` contains official sources such as:
  - FINRA BrokerCheck
  - SEC / IAPD / EDGAR
  - official company website

### LinkedIn and social profiles are confirmed when

- they appear inside `verified_profiles`
- they include a `source_url` and `evidence_note`
- they are not contradicted by `unverified_or_not_found`

Important:

- this API does not guarantee a personal LinkedIn for every advisor
- firm queries often return company LinkedIn and company X/Twitter
- person queries may return no personal social if it cannot be confidently verified

### Images are confirmed when

- `public_images` is non-empty
- each image includes:
  - `image_url`
  - `source_page_url`
  - `source_title`
  - `confidence_note`

Important:

- `public_images` can contain a logo, banner, branch photo, or headshot
- do not assume the first image is always a personal headshot
- always inspect `kind`
- if no trustworthy headshot exists, the service may still return company imagery

### Missing data is explicitly called out when

- `unverified_or_not_found` contains explanations like:
  - no confidently verifiable LinkedIn profile found
  - no public headshot found
  - no X/Twitter profile verified
  - fallback model or fallback image ranking was used

That means the service is telling you what it could not prove, which is expected behavior and not necessarily a failure.

## Quick Response Review Checklist

After you receive a response, check it in this order:

1. `subject`
   - did the API identify the right person or firm?
2. `verified_profiles`
   - do official regulatory or official-site URLs appear?
3. `key_facts`
   - do facts include `source_url` and `evidence_note`?
4. `public_images`
   - are any images present, and what is the `kind`?
5. `unverified_or_not_found`
   - what did the API explicitly fail to verify?

If `verified_profiles` and `key_facts` are populated, you are getting real source-backed data even if LinkedIn, socials, or headshot are missing.

## Handy `jq` Check

This is a useful command for quickly checking whether the response contains subject resolution, profiles, images, and explicit gaps:

```bash
curl -sS --max-time 600 https://hushh-ria-intelligence-api-53407187172.us-central1.run.app/v1/ria/profile \
  -H "Content-Type: application/json" \
  -d '{"query":"ANA ROUMENOVA CARTER"}' | jq '{
    subject,
    verified_profiles: [.verified_profiles[]? | {platform, url}],
    public_images: [.public_images[]? | {kind, image_url}],
    missing: .unverified_or_not_found
  }'
```

## Important Contract Notes

Clients should treat this response as partially complete by design.

This API does not guarantee that every person will have:

- a personal LinkedIn URL
- a personal headshot
- phone number
- website
- role
- categories
- specialties
- social handles on every platform

Missing or uncertain data is represented by:

- `null` values inside `subject`
- empty arrays such as `verified_profiles`, `public_images`, or `key_facts`
- explanatory strings inside `unverified_or_not_found`

Client integrations should therefore:

- not assume any optional field will exist
- treat `public_images` as optional
- allow partial dossier success
- use `unverified_or_not_found` to explain gaps
- keep long request timeouts and loading UI for this endpoint

## HTTP Behavior

### `200 OK`

Returned when the service produced a usable dossier JSON, including partial results.

Cases:

- Phase 1 verified and OpenAI dossier succeeded
- Phase 1 verified and image ranking fell back to locally validated candidates
- Phase 1 found no confident FINRA or SEC match, but the API still returned a valid empty-ish dossier shape

### `400 Bad Request`

Returned when the request body is invalid.

Example:

- `query` missing
- `query` blank

### `502 Bad Gateway`

Returned when upstream Phase 1 or OpenAI processing failed before a usable dossier could be produced.

## No-Match Behavior

If no confident FINRA or SEC match is found, the API still returns `200` with this shape:

- `subject.full_name` is filled from the query
- `subject.crd_number = null`
- `subject.current_firm = null`
- `subject.location = null`
- `verified_profiles = []`
- `public_images = []`
- `key_facts = []`
- `unverified_or_not_found` contains the reason
- `prompts_used = []`

## Health Checks

Production:

```bash
curl -sS -i https://hushh-ria-intelligence-api-53407187172.us-central1.run.app/health
```

Local:

```bash
curl -sS -i http://127.0.0.1:8000/health
```

Prefer `/health` for monitors and uptime checks.

If `/health` returns `200` but dossier requests are still slow, that usually means the service is alive and waiting on upstream model work or image extraction.

## Internal Processing Flow

The request path is:

1. client sends `{ "query": "<name or firm>" }`
2. Gemini on Vertex performs Phase 1 regulatory verification
3. backend converts verified Phase 1 profile into seed JSON
4. OpenAI `gpt-5.4` performs public-web dossier research
5. backend fetches public source pages and extracts image candidates from:
   - `meta[property="og:image"]`
   - `meta[name="twitter:image"]`
   - `<img>`
6. OpenAI `gpt-5.4-pro` ranks shortlisted public images
7. final dossier JSON is returned

## Troubleshooting Slow Or Hanging Requests

If another team says "the API is taking too long", ask them to check these things first:

1. confirm they are calling:
   - `POST /v1/ria/profile`
   - with `{ "query": "..." }`
2. confirm their client timeout is not too low
3. confirm `/health` returns `200`
4. confirm they are parsing dossier JSON, not the old wrapper response

Recommended incident details to capture:

- query used
- exact request timestamp
- client timeout value
- final HTTP status
- response body if present

Interpretation:

- `200` with partial arrays or missing LinkedIn/image is still a successful dossier response
- `400` means bad input
- `502` means upstream processing failed before a usable dossier could be produced
- long wait plus eventual `200` is normal for this endpoint

## Image Behavior

- `public_images` always contains public source URLs only
- this endpoint does not upload images to GCS
- this endpoint does not return storage URLs
- if OpenAI image ranking fails, the service falls back to locally validated candidates
- image classification can still be partial, so clients should not assume the first image is always a perfect personal headshot

## Models

- Phase 1 verification:
  - primary: `gemini-3.1-pro-preview`
  - fallback: `gemini-2.5-pro`
- OpenAI dossier research:
  - `gpt-5.4`
- OpenAI image ranking:
  - `gpt-5.4-pro`

## Environment

Required:

- `GOOGLE_CLOUD_PROJECT`
- `OPENAI_API_KEY`

Optional:

- `GOOGLE_CLOUD_LOCATION=global`
- `RIA_PRIMARY_MODEL=gemini-3.1-pro-preview`
- `RIA_FALLBACK_MODEL=gemini-2.5-pro`
- `OPENAI_MODEL=gpt-5.4`
- `OPENAI_FALLBACK_MODEL=gpt-5-mini`
- `OPENAI_IMAGE_RANK_MODEL=gpt-5.4-pro`
- `OPENAI_TIMEOUT_SECONDS=180`
- `OPENAI_RESEARCH_REASONING_EFFORT=low`
- `OPENAI_IMAGE_RANK_REASONING_EFFORT=medium`
- `PORT=8080`

## Local Run

```bash
cd cloud-run/ria-intelligence-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
export GOOGLE_CLOUD_LOCATION=global
export OPENAI_API_KEY=YOUR_OPENAI_KEY
export RIA_PRIMARY_MODEL=gemini-3.1-pro-preview
export RIA_FALLBACK_MODEL=gemini-2.5-pro
export OPENAI_MODEL=gpt-5.4
export OPENAI_FALLBACK_MODEL=gpt-5-mini
export OPENAI_IMAGE_RANK_MODEL=gpt-5.4-pro
export OPENAI_RESEARCH_REASONING_EFFORT=low
export OPENAI_IMAGE_RANK_REASONING_EFFORT=medium
uvicorn app.main:app --reload
```

## Deploy

```bash
./scripts/deploy-ria-intelligence-api.sh \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --openai-api-key-secret YOUR_SECRET_NAME
```

## Server-Side OpenAI Key

Keep the OpenAI key on the server side only.

Recommended production setup:

1. store the key in GCP Secret Manager
2. grant the Cloud Run service account `roles/secretmanager.secretAccessor`
3. deploy with `--openai-api-key-secret YOUR_SECRET_NAME`

Example:

```bash
./scripts/deploy-ria-intelligence-api.sh \
  --project hushone-app \
  --region us-central1 \
  --openai-api-key-secret ria-intelligence-openai-api-key
```

The live service is configured this way, so `OPENAI_API_KEY` is injected into Cloud Run from Secret Manager instead of being kept in source or frontend code.

## Security Note

Do not hardcode OpenAI keys in source, docs, or scripts.

If an OpenAI key was shared in chat on **March 21, 2026**, rotate it before production use and move it into Secret Manager.
