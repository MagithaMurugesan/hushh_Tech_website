from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from .image_scraper import ImageScraper
from .models import (
    DossierPublicImage,
    DossierSubject,
    DossierVerifiedProfile,
    GroundingSource,
    ImageCandidate,
    PublicProfileDossier,
    RIAProfile,
    RIAProfileRequest,
    RankedImagesResponse,
    get_dossier_response_schema,
    get_ranked_images_response_schema,
    get_stage1_response_schema,
)
from .prompts import (
    DOSSIER_SYSTEM_PROMPT,
    IMAGE_RANK_SYSTEM_PROMPT,
    STAGE1_SYSTEM_PROMPT,
    build_dossier_user_prompt,
    build_image_rank_user_prompt,
    build_stage1_user_prompt,
)

logger = logging.getLogger(__name__)

DEFAULT_RIA_PRIMARY_MODEL = "gemini-3.1-pro-preview"
DEFAULT_RIA_FALLBACK_MODEL = "gemini-2.5-pro"
DEFAULT_GOOGLE_CLOUD_LOCATION = "global"
DEFAULT_OPENAI_MODEL = "gpt-5.4"
DEFAULT_OPENAI_IMAGE_RANK_MODEL = "gpt-5.4-mini"
DEFAULT_OPENAI_TIMEOUT_SECONDS = 90.0
MAX_RANK_INPUT_IMAGES = 8
MAX_PUBLIC_IMAGES_RETURNED = 4


class InvalidQueryError(ValueError):
    """Raised when the public query payload is missing or blank."""


class RIAUpstreamError(RuntimeError):
    """Raised when upstream providers cannot produce a usable result."""


@dataclass(frozen=True)
class Stage1GenerationResult:
    query: str
    profile: RIAProfile
    sources: list[GroundingSource]
    used_model: str


@dataclass(frozen=True)
class Phase2GenerationResult:
    dossier: PublicProfileDossier


def create_vertex_client() -> Any:
    project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT must be set before starting the service.")

    location = os.getenv("GOOGLE_CLOUD_LOCATION", DEFAULT_GOOGLE_CLOUD_LOCATION)
    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError as exc:
        raise RuntimeError(
            "google-genai is not installed. Install requirements before starting the service."
        ) from exc

    return genai.Client(
        vertexai=True,
        project=project,
        location=location,
        http_options=genai_types.HttpOptions(api_version="v1"),
    )


def create_openai_client() -> Any:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY must be set before starting the service.")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "openai is not installed. Install requirements before starting the service."
        ) from exc

    timeout = float(os.getenv("OPENAI_TIMEOUT_SECONDS", DEFAULT_OPENAI_TIMEOUT_SECONDS))
    return OpenAI(api_key=api_key, timeout=timeout)


class RIAIntelligenceService:
    def __init__(
        self,
        vertex_client: Any | None = None,
        openai_client: Any | None = None,
        primary_model: str | None = None,
        fallback_model: str | None = None,
        openai_model: str | None = None,
        openai_image_rank_model: str | None = None,
        image_scraper: ImageScraper | None = None,
    ) -> None:
        self.primary_model = primary_model or os.getenv(
            "RIA_PRIMARY_MODEL",
            DEFAULT_RIA_PRIMARY_MODEL,
        )
        self.fallback_model = fallback_model or os.getenv(
            "RIA_FALLBACK_MODEL",
            DEFAULT_RIA_FALLBACK_MODEL,
        )
        self.openai_model = openai_model or os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
        self.openai_image_rank_model = openai_image_rank_model or os.getenv(
            "OPENAI_IMAGE_RANK_MODEL",
            DEFAULT_OPENAI_IMAGE_RANK_MODEL,
        )
        self._vertex_client = vertex_client or create_vertex_client()
        self._openai_client = openai_client or create_openai_client()
        self._image_scraper = image_scraper or ImageScraper()

    def get_ria_profile(self, payload: str | dict[str, Any] | RIAProfileRequest) -> PublicProfileDossier:
        query = _validate_query_payload(payload)
        stage1 = self._run_stage1(query)
        if not stage1.profile.existsOnFinra:
            return self._build_not_found_dossier(stage1)

        try:
            phase2 = self._run_phase2(stage1.profile)
        except Exception as exc:  # noqa: BLE001 - final output depends on a usable dossier
            logger.warning("Phase 2 dossier generation failed for query=%s: %s", query, exc)
            raise RIAUpstreamError(
                f"Unable to generate a source-backed dossier from OpenAI. {exc}"
            ) from exc

        return self._build_completed_dossier(stage1, phase2)

    def _run_stage1(self, query: str) -> Stage1GenerationResult:
        errors: list[str] = []
        for model_id in self._vertex_model_chain():
            try:
                response = self._vertex_client.models.generate_content(
                    model=model_id,
                    contents=build_stage1_user_prompt(query),
                    config={
                        "system_instruction": STAGE1_SYSTEM_PROMPT,
                        "temperature": 0.1,
                        "max_output_tokens": 8192,
                        "response_mime_type": "application/json",
                        "response_schema": get_stage1_response_schema(),
                        "tools": [{"google_search": {}}],
                    },
                )
                payload = _parse_json_object(_vertex_response_text(response))
                profile = RIAProfile.model_validate(_sanitize_stage1_payload(payload))
                sources = _extract_vertex_sources(response)
                logger.info(
                    "Stage 1 completed query=%s model=%s existsOnFinra=%s sources=%d",
                    query,
                    model_id,
                    profile.existsOnFinra,
                    len(sources),
                )
                return Stage1GenerationResult(query=query, profile=profile, sources=sources, used_model=model_id)
            except Exception as exc:  # noqa: BLE001 - model chain fallback
                logger.warning("Stage 1 model failed query=%s model=%s error=%s", query, model_id, exc)
                errors.append(f"{model_id}: {exc}")

        raise RIAUpstreamError(
            "Unable to verify advisor or firm via FINRA/SEC search. "
            + " | ".join(errors)
        )

    def _run_phase2(self, verified_profile: RIAProfile) -> Phase2GenerationResult:
        draft = self._research_dossier(verified_profile)
        profile_for_images = _merge_seed_profile_with_dossier_links(
            verified_profile,
            draft.verified_profiles,
        )
        image_candidates = self._discover_image_candidates(profile_for_images, draft.public_images)

        if image_candidates:
            try:
                public_images = self._rank_public_images(verified_profile, image_candidates)
            except Exception as exc:  # noqa: BLE001 - degrade safely for image stage
                logger.warning("Image ranking failed for %s: %s", verified_profile.fullName, exc)
                public_images = _fallback_public_images(image_candidates)
                draft = draft.model_copy(
                    update={
                        "unverified_or_not_found": _dedupe_strings(
                            [
                                *draft.unverified_or_not_found,
                                "OpenAI image ranking failed; using locally validated image fallback candidates.",
                            ]
                        )
                    }
                )
        else:
            public_images = []

        dossier = draft.model_copy(update={"public_images": public_images})
        if not public_images:
            dossier = dossier.model_copy(
                update={
                    "unverified_or_not_found": _dedupe_strings(
                        [
                            *dossier.unverified_or_not_found,
                            "No confidently verified public image could be confirmed.",
                        ]
                    )
                }
            )

        return Phase2GenerationResult(dossier=dossier)

    def _research_dossier(self, seed_profile: RIAProfile) -> PublicProfileDossier:
        response = self._openai_client.responses.create(
            model=self.openai_model,
            tools=[{"type": "web_search"}],
            include=["web_search_call.action.sources"],
            instructions=DOSSIER_SYSTEM_PROMPT,
            input=build_dossier_user_prompt(seed_profile),
            text={
                "format": {
                    "type": "json_schema",
                    "name": "public_profile_dossier",
                    "strict": True,
                    "schema": get_dossier_response_schema(),
                }
            },
        )
        payload = _parse_json_object(_openai_response_text(response))
        dossier = PublicProfileDossier.model_validate(_normalize_dossier_payload(payload, seed_profile))
        logger.info(
            "Generated dossier for subject=%s verified_profiles=%d key_facts=%d public_images=%d",
            dossier.subject.full_name,
            len(dossier.verified_profiles),
            len(dossier.key_facts),
            len(dossier.public_images),
        )
        return dossier

    def _discover_image_candidates(
        self,
        profile: RIAProfile,
        public_images: list[DossierPublicImage],
    ) -> list[ImageCandidate]:
        seed_candidates = [
            ImageCandidate(
                imageUrl=image.image_url,
                sourcePageUrl=image.source_page_url,
                platform=_infer_platform(image.source_page_url or image.image_url),
                candidateType=_map_public_image_kind_to_candidate_type(image.kind),
                confidence=92,
            )
            for image in public_images
            if _is_https_url(image.source_page_url) and _is_https_url(image.image_url)
        ]
        grounded_urls = _dedupe_strings(
            [
                *[
                    image.source_page_url
                    for image in public_images
                    if _is_https_url(image.source_page_url)
                ],
                *[
                    (profile_link.sourcePageUrl or profile_link.imageUrl or "")
                    for profile_link in _profile_links_to_seed_candidates(
                        public_images=[],
                        verified_profiles=_extract_verified_profiles_from_profile(profile),
                    )
                    if _is_https_url(profile_link.sourcePageUrl or profile_link.imageUrl or "")
                ],
            ]
        )

        return self._image_scraper.discover_candidates(
            profile,
            model_candidates=seed_candidates,
            grounded_source_urls=grounded_urls,
        )

    def _rank_public_images(
        self,
        seed_profile: RIAProfile,
        candidates: list[ImageCandidate],
    ) -> list[DossierPublicImage]:
        shortlist = _prepare_rank_shortlist(candidates)
        if not shortlist:
            return []

        image_inputs = [
            {"type": "input_image", "image_url": candidate.imageUrl}
            for candidate in shortlist
            if candidate.imageUrl
        ]
        response = self._openai_client.responses.create(
            model=self.openai_image_rank_model,
            instructions=IMAGE_RANK_SYSTEM_PROMPT,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": build_image_rank_user_prompt(seed_profile, shortlist)},
                        *image_inputs,
                    ],
                }
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "ranked_public_images",
                    "strict": True,
                    "schema": get_ranked_images_response_schema(),
                }
            },
        )
        payload = _parse_json_object(_openai_response_text(response))
        ranked = RankedImagesResponse.model_validate(
            _normalize_ranked_images_payload(payload, shortlist)
        )
        return ranked.public_images[:MAX_PUBLIC_IMAGES_RETURNED]

    def _build_not_found_dossier(self, stage1: Stage1GenerationResult) -> PublicProfileDossier:
        reason = stage1.profile.reasonIfNotExists or "No confident FINRA or SEC match was found for the query."
        return PublicProfileDossier(
            subject=DossierSubject(
                full_name=stage1.profile.fullName or stage1.query,
                crd_number=None,
                current_firm=None,
                location=None,
            ),
            executive_summary=reason,
            verified_profiles=[],
            public_images=[],
            key_facts=[],
            unverified_or_not_found=[reason],
            prompts_used=[],
        )

    def _build_completed_dossier(
        self,
        stage1: Stage1GenerationResult,
        phase2: Phase2GenerationResult,
    ) -> PublicProfileDossier:
        dossier = phase2.dossier
        merged_verified_profiles = _merge_verified_profiles_with_stage1_sources(
            stage1.sources,
            dossier.verified_profiles,
        )
        return dossier.model_copy(
            update={
                "subject": DossierSubject(
                    full_name=stage1.profile.fullName or dossier.subject.full_name or stage1.query,
                    crd_number=stage1.profile.crdNumber or dossier.subject.crd_number,
                    current_firm=stage1.profile.currentFirm or dossier.subject.current_firm,
                    location=stage1.profile.location or dossier.subject.location,
                ),
                "verified_profiles": merged_verified_profiles,
                "unverified_or_not_found": _dedupe_strings(dossier.unverified_or_not_found),
                "prompts_used": _dedupe_strings(dossier.prompts_used),
            }
        )

    def _vertex_model_chain(self) -> list[str]:
        models = [self.primary_model, self.fallback_model]
        unique_models: list[str] = []
        for model_id in models:
            if model_id and model_id not in unique_models:
                unique_models.append(model_id)
        return unique_models


def _validate_query_payload(payload: str | dict[str, Any] | RIAProfileRequest) -> str:
    if isinstance(payload, str):
        candidate = {"query": payload}
    elif isinstance(payload, RIAProfileRequest):
        return payload.query
    elif isinstance(payload, dict):
        candidate = payload
    else:
        raise InvalidQueryError("A request body with `query` is required.")

    try:
        request = RIAProfileRequest.model_validate(candidate)
    except Exception as exc:  # noqa: BLE001
        if isinstance(candidate, dict):
            query = candidate.get("query")
            if isinstance(query, str) and not query.strip():
                raise InvalidQueryError("query must not be blank") from exc
        raise InvalidQueryError("A request body with `query` is required.") from exc
    return request.query


def _sanitize_stage1_payload(payload: dict[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {
        "existsOnFinra": bool(payload.get("existsOnFinra", False)),
    }

    scalar_fields = [
        "crdNumber",
        "secNumber",
        "fullName",
        "currentFirm",
        "location",
        "mainAddress",
        "mailingAddress",
        "phone",
        "establishedIn",
        "companyType",
        "fiscalYearEnd",
        "regulatedBy",
        "reasonIfNotExists",
    ]
    list_fields = [
        "otherNames",
        "examsPassed",
        "stateLicenses",
        "otherRegistrations",
    ]

    for field in scalar_fields:
        value = _string_or_none(payload.get(field))
        if value is not None:
            sanitized[field] = value

    for field in list_fields:
        values = _normalize_string_list(payload.get(field))
        if values:
            sanitized[field] = values

    years_of_experience = _int_or_none(payload.get("yearsOfExperience"))
    if years_of_experience is not None:
        sanitized["yearsOfExperience"] = years_of_experience

    disclosures = payload.get("disclosures")
    if isinstance(disclosures, dict):
        disclosure_payload = {
            key: _int_or_none(disclosures.get(key))
            for key in ("total", "regulatoryEvent", "arbitration")
        }
        disclosure_payload = {
            key: value for key, value in disclosure_payload.items() if value is not None
        }
        if disclosure_payload:
            sanitized["disclosures"] = disclosure_payload

    direct_owners = []
    for item in payload.get("directOwnersAndExecutiveOfficers", []) if isinstance(payload.get("directOwnersAndExecutiveOfficers"), list) else []:
        if not isinstance(item, dict):
            continue
        normalized_item = {
            "name": _string_or_none(item.get("name")),
            "position": _string_or_none(item.get("position")),
            "crdNumber": _string_or_none(item.get("crdNumber")),
        }
        if any(normalized_item.values()):
            direct_owners.append(normalized_item)
    if direct_owners:
        sanitized["directOwnersAndExecutiveOfficers"] = direct_owners

    previous_firms = []
    for item in payload.get("previousFirms", []) if isinstance(payload.get("previousFirms"), list) else []:
        if not isinstance(item, dict):
            continue
        normalized_item = {
            "name": _string_or_none(item.get("name")),
            "crdNumber": _string_or_none(item.get("crdNumber")),
        }
        if any(normalized_item.values()):
            previous_firms.append(normalized_item)
    if previous_firms:
        sanitized["previousFirms"] = previous_firms

    if not sanitized["existsOnFinra"] and not sanitized.get("reasonIfNotExists"):
        sanitized["reasonIfNotExists"] = "No confident FINRA or SEC match was found for the query."

    return sanitized


def _normalize_dossier_payload(payload: dict[str, Any], seed_profile: RIAProfile) -> dict[str, Any]:
    subject = payload.get("subject") if isinstance(payload.get("subject"), dict) else {}
    normalized = {
        "subject": {
            "full_name": seed_profile.fullName or _string_or_default(subject.get("full_name"), ""),
            "crd_number": seed_profile.crdNumber or _nullable_string_or_default(subject.get("crd_number"), None),
            "current_firm": seed_profile.currentFirm or _nullable_string_or_default(subject.get("current_firm"), None),
            "location": seed_profile.location or _nullable_string_or_default(subject.get("location"), None),
        },
        "executive_summary": _string_or_default(
            payload.get("executive_summary"),
            seed_profile.bio or "No executive summary could be generated from verified public sources.",
        ),
        "verified_profiles": _normalize_verified_profiles(payload.get("verified_profiles")),
        "public_images": _normalize_public_images(payload.get("public_images")),
        "key_facts": _normalize_key_facts(payload.get("key_facts")),
        "unverified_or_not_found": _normalize_string_list(payload.get("unverified_or_not_found")),
        "prompts_used": _normalize_string_list(payload.get("prompts_used")),
    }
    if not normalized["prompts_used"]:
        normalized["unverified_or_not_found"] = _dedupe_strings(
            [
                *normalized["unverified_or_not_found"],
                "Exact web prompts/search phrases were not available in the structured model output.",
            ]
        )
    return normalized


def _normalize_verified_profiles(value: Any) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict):
            continue
        platform = _string_or_none(item.get("platform"))
        label = _string_or_none(item.get("label"))
        url = _string_or_none(item.get("url"))
        if not platform or not label or not url or not _is_https_url(url):
            continue
        dedupe_key = (platform.lower(), url)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        profiles.append(
            {
                "platform": platform,
                "label": label,
                "url": url,
                "handle": _string_or_none(item.get("handle")),
                "source_title": _string_or_default(item.get("source_title"), _source_title_from_url(url)),
                "source_url": _string_or_default(item.get("source_url"), url),
                "evidence_note": _string_or_default(
                    item.get("evidence_note"),
                    "Verified through public-web research.",
                ),
            }
        )
    return profiles


def _normalize_public_images(value: Any) -> list[dict[str, Any]]:
    images: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict):
            continue
        image_url = _string_or_none(item.get("image_url"))
        source_page_url = _string_or_none(item.get("source_page_url"))
        if not image_url or not source_page_url:
            continue
        if not _is_https_url(image_url) or not _is_https_url(source_page_url):
            continue
        dedupe_key = (image_url, source_page_url)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        images.append(
            {
                "kind": _string_or_default(item.get("kind"), "headshot"),
                "image_url": image_url,
                "source_page_url": source_page_url,
                "source_title": _string_or_default(
                    item.get("source_title"),
                    _source_title_from_url(source_page_url),
                ),
                "confidence_note": _string_or_default(
                    item.get("confidence_note"),
                    "Candidate returned from public-web research.",
                ),
            }
        )
    return images


def _normalize_key_facts(value: Any) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict):
            continue
        fact = _string_or_none(item.get("fact"))
        source_title = _string_or_none(item.get("source_title"))
        source_url = _string_or_none(item.get("source_url"))
        evidence_note = _string_or_none(item.get("evidence_note"))
        if not fact or not source_title or not source_url or not evidence_note or not _is_https_url(source_url):
            continue
        dedupe_key = (fact, source_url)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        facts.append(
            {
                "fact": fact,
                "source_title": source_title,
                "source_url": source_url,
                "evidence_note": evidence_note,
            }
        )
    return facts


def _normalize_string_list(value: Any) -> list[str]:
    return _dedupe_strings(
        [item.strip() for item in value if isinstance(item, str) and item.strip()]
        if isinstance(value, list)
        else []
    )


def _merge_verified_profiles_with_stage1_sources(
    stage1_sources: list[GroundingSource],
    verified_profiles: list[DossierVerifiedProfile],
) -> list[DossierVerifiedProfile]:
    merged: list[DossierVerifiedProfile] = []
    seen_urls: set[str] = set()

    for source in stage1_sources:
        if source.uri in seen_urls:
            continue
        seen_urls.add(source.uri)
        merged.append(
            DossierVerifiedProfile(
                platform=_platform_from_source_uri(source.uri),
                label=source.title,
                url=source.uri,
                handle=None,
                source_title=source.title,
                source_url=source.uri,
                evidence_note="Official regulatory source captured during Phase 1 verification.",
            )
        )

    for profile in verified_profiles:
        if profile.url in seen_urls:
            continue
        seen_urls.add(profile.url)
        merged.append(profile)

    return merged


def _merge_seed_profile_with_dossier_links(
    seed_profile: RIAProfile,
    verified_profiles: list[DossierVerifiedProfile],
) -> RIAProfile:
    updates: dict[str, Any] = {}
    for profile in verified_profiles:
        platform = profile.platform.strip().lower()
        if platform == "linkedin" and not updates.get("linkedinUrl") and not seed_profile.linkedinUrl:
            updates["linkedinUrl"] = profile.url
        elif platform in {"twitter", "x"} and not updates.get("twitterUrl") and not seed_profile.twitterUrl:
            updates["twitterUrl"] = profile.url
        elif platform == "facebook" and not updates.get("facebookUrl") and not seed_profile.facebookUrl:
            updates["facebookUrl"] = profile.url
        elif platform in {"website", "company website"} and not updates.get("websiteUrl") and not seed_profile.websiteUrl:
            updates["websiteUrl"] = profile.url

    return seed_profile.model_copy(update=updates)


def _prepare_rank_shortlist(candidates: list[ImageCandidate]) -> list[ImageCandidate]:
    shortlist: list[ImageCandidate] = []
    seen: set[str] = set()
    for candidate in candidates:
        if not candidate.imageUrl or not candidate.sourcePageUrl:
            continue
        if not _is_https_url(candidate.imageUrl) or not _is_https_url(candidate.sourcePageUrl):
            continue
        if candidate.imageUrl in seen:
            continue
        seen.add(candidate.imageUrl)
        shortlist.append(candidate)
        if len(shortlist) >= MAX_RANK_INPUT_IMAGES:
            break
    return shortlist


def _normalize_ranked_images_payload(
    payload: dict[str, Any],
    candidates: list[ImageCandidate],
) -> dict[str, Any]:
    candidate_by_image_url = {
        candidate.imageUrl: candidate
        for candidate in candidates
        if candidate.imageUrl and candidate.sourcePageUrl
    }
    public_images: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in payload.get("public_images", []) if isinstance(payload.get("public_images"), list) else []:
        if not isinstance(item, dict):
            continue
        image_url = _string_or_none(item.get("image_url"))
        if not image_url or image_url not in candidate_by_image_url or image_url in seen:
            continue
        candidate = candidate_by_image_url[image_url]
        seen.add(image_url)
        public_images.append(
            {
                "kind": _string_or_default(item.get("kind"), _kind_from_candidate(candidate)),
                "image_url": image_url,
                "source_page_url": _string_or_default(item.get("source_page_url"), candidate.sourcePageUrl or ""),
                "source_title": _string_or_default(
                    item.get("source_title"),
                    _source_title_from_url(candidate.sourcePageUrl or image_url),
                ),
                "confidence_note": _string_or_default(
                    item.get("confidence_note"),
                    f"Ranked from validated public candidate (platform={candidate.platform or 'website'}).",
                ),
            }
        )
    return {"public_images": public_images}


def _fallback_public_images(candidates: list[ImageCandidate]) -> list[DossierPublicImage]:
    images: list[DossierPublicImage] = []
    for candidate in _prepare_rank_shortlist(candidates)[:MAX_PUBLIC_IMAGES_RETURNED]:
        images.append(
            DossierPublicImage(
                kind=_kind_from_candidate(candidate),
                image_url=candidate.imageUrl or "",
                source_page_url=candidate.sourcePageUrl or "",
                source_title=_source_title_from_url(candidate.sourcePageUrl or candidate.imageUrl or ""),
                confidence_note=(
                    f"Validated from a public {candidate.platform or 'website'} source page "
                    f"with scraper confidence {candidate.confidence or 0}."
                ),
            )
        )
    return images


def _profile_links_to_seed_candidates(
    public_images: list[DossierPublicImage],
    verified_profiles: list[DossierVerifiedProfile],
) -> list[ImageCandidate]:
    candidates: list[ImageCandidate] = []
    for profile in verified_profiles:
        platform = profile.platform.strip().lower()
        candidate_type = "logo"
        if platform in {"linkedin", "twitter", "x"}:
            candidate_type = "headshot"
        candidates.append(
            ImageCandidate(
                imageUrl=None,
                sourcePageUrl=profile.url,
                platform=_infer_platform(profile.url),
                candidateType=candidate_type,
                confidence=90,
            )
        )
    for image in public_images:
        candidates.append(
            ImageCandidate(
                imageUrl=image.image_url,
                sourcePageUrl=image.source_page_url,
                platform=_infer_platform(image.source_page_url or image.image_url),
                candidateType=_map_public_image_kind_to_candidate_type(image.kind),
                confidence=92,
            )
        )
    return candidates


def _extract_verified_profiles_from_profile(profile: RIAProfile) -> list[DossierVerifiedProfile]:
    records: list[DossierVerifiedProfile] = []
    mappings = [
        ("LinkedIn", profile.linkedinUrl),
        ("Twitter", profile.twitterUrl),
        ("Facebook", profile.facebookUrl),
        ("Website", profile.websiteUrl),
    ]
    for platform, url in mappings:
        if not url or not _is_https_url(url):
            continue
        records.append(
            DossierVerifiedProfile(
                platform=platform,
                label=platform,
                url=url,
                handle=None,
                source_title=_source_title_from_url(url),
                source_url=url,
                evidence_note="Seed profile link carried into image verification.",
            )
        )
    return records


def _vertex_response_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if callable(text):
        text = text()
    if isinstance(text, str) and text.strip():
        return text.strip()

    response_data = _to_plain_data(response)
    if isinstance(response_data, dict):
        raw_text = response_data.get("text")
        if isinstance(raw_text, str) and raw_text.strip():
            return raw_text.strip()

        candidates = response_data.get("candidates") or []
        for item in candidates:
            if not isinstance(item, dict):
                continue
            content = item.get("content") or {}
            parts = content.get("parts") or []
            for part in parts:
                if not isinstance(part, dict):
                    continue
                part_text = part.get("text")
                if isinstance(part_text, str) and part_text.strip():
                    return part_text.strip()

    raise ValueError("Vertex AI returned an empty response body")


def _openai_response_text(response: Any) -> str:
    text = getattr(response, "output_text", None)
    if callable(text):
        text = text()
    if isinstance(text, str) and text.strip():
        return text.strip()

    response_data = _to_plain_data(response)
    if isinstance(response_data, dict):
        output_text = response_data.get("output_text")
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()

        output = response_data.get("output") or []
        text_parts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content") or []
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") in {"output_text", "text"} and isinstance(block.get("text"), str):
                    text_parts.append(block["text"])
        if text_parts:
            return "\n".join(text_parts).strip()

    raise ValueError("OpenAI Responses API returned an empty response body")


def _extract_vertex_sources(response: Any) -> list[GroundingSource]:
    response_data = _to_plain_data(response)
    if not isinstance(response_data, dict):
        return []

    sources: list[GroundingSource] = []
    for candidate in response_data.get("candidates", []) if isinstance(response_data.get("candidates"), list) else []:
        if not isinstance(candidate, dict):
            continue
        grounding_metadata = candidate.get("grounding_metadata") or candidate.get("groundingMetadata") or {}
        if not isinstance(grounding_metadata, dict):
            continue
        chunks = grounding_metadata.get("grounding_chunks") or grounding_metadata.get("groundingChunks") or []
        for chunk in chunks if isinstance(chunks, list) else []:
            if not isinstance(chunk, dict):
                continue
            web = chunk.get("web") or chunk.get("retrievedContext") or {}
            if not isinstance(web, dict):
                continue
            title = _string_or_none(web.get("title"))
            uri = _string_or_none(web.get("uri") or web.get("url"))
            if title and uri and _is_https_url(uri):
                sources.append(GroundingSource(title=title, uri=uri))

    return _dedupe_sources(sources)


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = _strip_json_fences(text)
    for candidate in (cleaned, _extract_json_fragment(cleaned)):
        try:
            payload = json.loads(candidate)
        except (TypeError, json.JSONDecodeError, ValueError):
            continue
        if isinstance(payload, dict):
            return payload
    raise ValueError("Provider did not return a JSON object")


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


def _extract_json_fragment(text: str) -> str:
    starts = [index for index in (text.find("{"), text.find("[")) if index != -1]
    if not starts:
        return text
    start = min(starts)
    object_end = text.rfind("}")
    array_end = text.rfind("]")
    end = max(object_end, array_end)
    if end < start:
        return text
    return text[start : end + 1].strip()


def _to_plain_data(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_to_plain_data(item) for item in value]
    if isinstance(value, tuple):
        return [_to_plain_data(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_plain_data(item) for key, item in value.items()}
    if hasattr(value, "model_dump"):
        return _to_plain_data(value.model_dump(exclude_none=True))
    if hasattr(value, "__dict__"):
        return {
            key: _to_plain_data(item)
            for key, item in vars(value).items()
            if not key.startswith("_")
        }
    return value


def _string_or_none(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _string_or_default(value: Any, default: str) -> str:
    normalized = _string_or_none(value)
    return normalized if normalized is not None else default


def _nullable_string_or_default(value: Any, default: str | None) -> str | None:
    normalized = _string_or_none(value)
    if normalized is not None:
        return normalized
    return default


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            return int(stripped)
    return None


def _dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _dedupe_sources(sources: list[GroundingSource]) -> list[GroundingSource]:
    deduped: list[GroundingSource] = []
    seen: set[tuple[str, str]] = set()
    for source in sources:
        key = (source.title.strip(), source.uri.strip())
        if not key[0] or not key[1] or key in seen:
            continue
        seen.add(key)
        deduped.append(source)
    return deduped


def _kind_from_candidate(candidate: ImageCandidate) -> str:
    if candidate.candidateType == "logo":
        return "company logo"
    if (candidate.platform or "").lower() in {"linkedin", "twitter", "x"}:
        return "headshot"
    return "headshot" if candidate.candidateType == "headshot" else "company logo"


def _map_public_image_kind_to_candidate_type(kind: str | None) -> str:
    normalized = (kind or "").strip().lower()
    if "logo" in normalized or "banner" in normalized:
        return "logo"
    return "headshot"


def _source_title_from_url(url: str) -> str:
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "") or "source"
    return domain


def _platform_from_source_uri(uri: str) -> str:
    uri_lower = uri.lower()
    if "brokercheck" in uri_lower or "finra.org" in uri_lower:
        return "FINRA BrokerCheck"
    if "sec.gov" in uri_lower or "adviserinfo" in uri_lower:
        return "SEC"
    return "Regulatory Source"


def _infer_platform(url: str | None) -> str:
    if not url:
        return "website"
    host = (urlparse(url).netloc or "").lower()
    if "linkedin.com" in host:
        return "linkedin"
    if "twitter.com" in host or "x.com" in host:
        return "twitter"
    if "facebook.com" in host:
        return "facebook"
    if "brokercheck.finra.org" in host or "finra.org" in host:
        return "finra"
    return "website"


def _is_https_url(value: str | None) -> bool:
    if not value or not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)
