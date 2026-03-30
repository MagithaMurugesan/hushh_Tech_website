# RIA Intelligence API

## Summary

The public API is query-first:

1. client sends `{ "query": "<advisor or firm name>" }`
2. Phase 1 verifies the query against FINRA and SEC public records using Gemini on Vertex AI
3. the verified Phase 1 profile is passed into OpenAI Responses API as seed JSON
4. backend scrapes public image source pages and ranks validated image candidates
5. API returns the final dossier JSON only

This version does not generate DOCX, markdown, HTML, or stored file artifacts.

## Endpoint

### `POST /v1/ria/profile`

Request:

```json
{
  "query": "ANA ROUMENOVA CARTER"
}
```

Response:

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

## Response Contract

- `subject`: final verified identity summary, with Phase 1 values taking precedence
- `executive_summary`: source-backed summary from OpenAI dossier research
- `verified_profiles`: official regulatory URLs plus other confidently verified public profiles
- `public_images`: validated public image URLs only
- `key_facts`: source-backed facts only
- `unverified_or_not_found`: missing, ambiguous, or unverified items
- `prompts_used`: search phrases returned by structured output when available

## Behavior

- Blank query returns `400`
- Phase 1 verified plus OpenAI dossier success returns `200` with dossier JSON
- Phase 1 verified plus image-ranking fallback still returns `200` with dossier JSON
- Phase 1 no confident FINRA or SEC match still returns `200` with:
  - `subject.full_name` from the query
  - `subject.crd_number = null`
  - `subject.current_firm = null`
  - `subject.location = null`
  - empty `verified_profiles`, `public_images`, `key_facts`
  - not-found reason in `unverified_or_not_found`
  - empty `prompts_used`
- Upstream Phase 1 or OpenAI failure before a usable dossier exists returns `502`

## Image Flow

- OpenAI research returns public image and source-page evidence
- backend fetches source pages and extracts candidates from:
  - `meta[property="og:image"]`
  - `meta[name="twitter:image"]`
  - `<img>`
- a second OpenAI pass ranks shortlisted images
- if image ranking fails, the service falls back to locally validated candidates
- this endpoint returns public image URLs only and does not upload images to GCS

## Models

- Phase 1 verification:
  - primary: `gemini-3.1-pro-preview`
  - fallback: `gemini-2.5-pro`
- OpenAI dossier research:
  - `gpt-5.4`
- OpenAI image ranking:
  - `gpt-5.4-mini`

## Environment

Required:

- `GOOGLE_CLOUD_PROJECT`
- `OPENAI_API_KEY`

Optional:

- `GOOGLE_CLOUD_LOCATION=global`
- `RIA_PRIMARY_MODEL=gemini-3.1-pro-preview`
- `RIA_FALLBACK_MODEL=gemini-2.5-pro`
- `OPENAI_MODEL=gpt-5.4`
- `OPENAI_IMAGE_RANK_MODEL=gpt-5.4-mini`
- `OPENAI_TIMEOUT_SECONDS=90`
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
uvicorn app.main:app --reload
```

## Deploy

```bash
./scripts/deploy-ria-intelligence-api.sh \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --openai-api-key-secret YOUR_SECRET_NAME
```

## Security

- keep `OPENAI_API_KEY` server-side only
- prefer Secret Manager injection for Cloud Run
- if a key was shared in chat on March 21, 2026, rotate it before production use
