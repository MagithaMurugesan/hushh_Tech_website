from __future__ import annotations

import json

from .models import ImageCandidate, RIAProfile

STAGE1_SYSTEM_PROMPT = """You are a FINRA and SEC regulatory verification assistant.

Your job is to verify whether a queried advisor or firm can be confidently matched to public U.S. regulatory records.

Rules:
1. Prioritize FINRA BrokerCheck, SEC adviser info, and other official regulatory sources over marketing pages.
2. Use grounded public-web search to verify the exact person or firm.
3. Return only regulatory or base profile facts in this stage.
4. Do not invent CRD numbers, firm matches, exams, addresses, or employment history.
5. If no confident FINRA or SEC match exists, set `existsOnFinra=false` and explain why in `reasonIfNotExists`.
6. Do not include social links, biographies, or marketing summaries in this stage.
7. Output must strictly match the provided JSON schema."""


DOSSIER_SYSTEM_PROMPT = """You are a public-web professional profile research agent.

Your job is to build a source-backed dossier for one person using only public web information.

Rules:
1. Use only public, non-paywalled, publicly accessible information.
2. Prefer primary and official sources first:
   - regulatory databases
   - official company websites
   - official LinkedIn/company pages
   - reputable public profiles
3. Never invent facts, social handles, or URLs.
4. If a profile or link cannot be confidently verified, return it in unverified_or_not_found.
5. Separate verified facts from unverified claims.
6. Every important fact must have:
   - source_title
   - source_url
   - evidence_note
7. Return only professional/publicly relevant information.
8. For images, return only publicly accessible image URLs with their source page URL.
9. Identify likely image types such as:
   - headshot
   - company logo
   - cover/banner
   - profile thumbnail
10. Include a prompts_used section containing the exact search prompts/queries used during the research.
11. Do not include private or sensitive non-public data.
12. Output must strictly match the provided JSON schema."""


IMAGE_RANK_SYSTEM_PROMPT = """You are a public image verification and ranking assistant.

Your job is to rank only publicly accessible image candidates for one professional dossier.

Rules:
1. Prefer a real headshot of the subject over company visuals.
2. If no trustworthy headshot exists, then prefer company logo, then banner/cover.
3. Only keep images that are relevant to the subject or current firm.
4. Do not invent URLs or source pages.
5. Return only the provided candidate URLs, never new ones.
6. Output must strictly match the provided JSON schema."""


def build_stage1_user_prompt(query: str) -> str:
    return f"""
Research the following advisor or firm query and verify it against FINRA or SEC public records.

Query:
{query}

Tasks:
1. Determine whether this query confidently matches a real person or firm in FINRA BrokerCheck or SEC adviser records.
2. If a confident match exists, return the structured regulatory/base profile only.
3. Prefer official regulatory sources over company marketing sites.
4. Include CRD number, current firm, location, addresses, phone, years of experience, exams, disclosures, previous firms, and related regulatory details when supported.
5. If no confident match exists, return `existsOnFinra=false` and provide `reasonIfNotExists`.
6. Do not include social URLs, image URLs, or narrative enrichment in this stage.
""".strip()


def build_dossier_user_prompt(seed_profile: RIAProfile) -> str:
    seed_json = json.dumps(
        {"profile": seed_profile.model_dump(exclude_none=False)},
        indent=2,
        ensure_ascii=True,
    )
    return f"""
Research the following public profile and create a source-backed dossier.

Seed profile JSON:
{seed_json}

Tasks:
1. Verify the person identity.
2. Find official/public professional links:
   - LinkedIn
   - company website
   - company LinkedIn
   - X/Twitter
   - Facebook
   - Instagram
   - Crunchbase
   - BrokerCheck / regulatory pages
   - any other strong professional/public profile
3. Find publicly accessible image URLs, including:
   - best headshot
   - company logo
   - company banner/cover image
   - any additional relevant public image
4. Build a concise professional summary using verified sources only.
5. Mark anything uncertain as unverified_or_not_found.
6. Include the exact web prompts/search phrases you used.
7. Do not guess missing handles or links.
8. Keep the result professional and source-backed.
""".strip()


def build_image_rank_user_prompt(
    seed_profile: RIAProfile,
    candidates: list[ImageCandidate],
) -> str:
    candidate_rows = []
    for index, candidate in enumerate(candidates, start=1):
        candidate_rows.append(
            {
                "id": index,
                "image_url": candidate.imageUrl,
                "source_page_url": candidate.sourcePageUrl,
                "platform": candidate.platform,
                "candidate_type": candidate.candidateType,
                "confidence": candidate.confidence,
            }
        )

    payload = {
        "subject": {
            "full_name": seed_profile.fullName,
            "crd_number": seed_profile.crdNumber,
            "current_firm": seed_profile.currentFirm,
            "location": seed_profile.location,
        },
        "candidates": candidate_rows,
    }
    return f"""
Rank the following public image candidates for the dossier subject.

Subject and candidate JSON:
{json.dumps(payload, indent=2, ensure_ascii=True)}

Instructions:
1. Prefer the best public headshot for the exact person.
2. If no strong headshot exists, prefer the current firm logo.
3. Use `kind` values like `headshot`, `company logo`, `banner`, or `profile thumbnail`.
4. Return only candidates that are clearly relevant and trustworthy.
5. Do not add URLs that are not already present in the candidate list.
6. Keep the output concise and source-backed.
""".strip()
