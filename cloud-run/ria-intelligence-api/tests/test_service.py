from __future__ import annotations

import json
import unittest
from types import SimpleNamespace

from app.models import ImageCandidate
from app.service import InvalidQueryError, RIAIntelligenceService, RIAUpstreamError


def make_vertex_response(payload: dict, sources: list[tuple[str, str]] | None = None) -> SimpleNamespace:
    grounding_chunks = [
        {"web": {"title": title, "uri": uri}}
        for title, uri in (sources or [])
    ]
    return SimpleNamespace(
        text=json.dumps(payload),
        candidates=[
            {
                "grounding_metadata": {
                    "grounding_chunks": grounding_chunks,
                }
            }
        ],
    )


def make_openai_response(payload: dict) -> SimpleNamespace:
    return SimpleNamespace(output_text=json.dumps(payload))


class FakeVertexModels:
    def __init__(self, scripted_results: list[object]) -> None:
        self._scripted_results = list(scripted_results)
        self.calls: list[dict[str, object]] = []

    def generate_content(self, **kwargs) -> object:
        self.calls.append(kwargs)
        next_item = self._scripted_results.pop(0)
        if isinstance(next_item, Exception):
            raise next_item
        return next_item


class FakeVertexClient:
    def __init__(self, scripted_results: list[object]) -> None:
        self.models = FakeVertexModels(scripted_results)


class FakeOpenAIResponses:
    def __init__(self, scripted_results: list[object]) -> None:
        self._scripted_results = list(scripted_results)
        self.calls: list[dict[str, object]] = []

    def create(self, **kwargs) -> object:
        self.calls.append(kwargs)
        next_item = self._scripted_results.pop(0)
        if isinstance(next_item, Exception):
            raise next_item
        return next_item


class FakeOpenAIClient:
    def __init__(self, scripted_results: list[object]) -> None:
        self.responses = FakeOpenAIResponses(scripted_results)


class FakeImageScraper:
    def __init__(
        self,
        result: list[ImageCandidate] | None = None,
        *,
        error: Exception | None = None,
    ) -> None:
        self.result = result or []
        self.error = error
        self.calls: list[dict[str, object]] = []

    def discover_candidates(
        self,
        profile,
        *,
        model_candidates=None,
        gemini_candidates=None,
        grounded_source_urls=None,
    ):
        self.calls.append(
            {
                "profile": profile,
                "model_candidates": model_candidates,
                "gemini_candidates": gemini_candidates,
                "grounded_source_urls": grounded_source_urls,
            }
        )
        if self.error is not None:
            raise self.error
        return self.result


def stage1_verified_response() -> SimpleNamespace:
    return make_vertex_response(
        {
            "existsOnFinra": True,
            "crdNumber": "4424794",
            "fullName": "ANA ROUMENOVA CARTER",
            "currentFirm": "LCG CAPITAL ADVISORS, LLC",
            "location": "Tampa, Florida",
            "websiteUrl": "https://cartanaconsulting.com",
            "yearsOfExperience": 17,
            "regulatedBy": "FINRA",
        },
        sources=[
            (
                "BrokerCheck Report - ANA ROUMENOVA CARTER",
                "https://files.brokercheck.finra.org/individual/individual_4424794.pdf",
            )
        ],
    )


def stage2_dossier_response() -> SimpleNamespace:
    return make_openai_response(
        {
            "subject": {
                "full_name": "ANA ROUMENOVA CARTER",
                "crd_number": "4424794",
                "current_firm": "Some Other Firm Should Not Win",
                "location": "Tampa, Florida",
            },
            "executive_summary": "Ana Carter is a finance executive and outsourced FINOP.",
            "verified_profiles": [
                {
                    "platform": "LinkedIn",
                    "label": "Ana Carter LinkedIn profile",
                    "url": "https://www.linkedin.com/in/anacarter01/",
                    "handle": "anacarter01",
                    "source_title": "About Cartana",
                    "source_url": "https://cartanaconsulting.com/about-cartana/",
                    "evidence_note": "Official company page links directly to LinkedIn.",
                },
                {
                    "platform": "Company Website",
                    "label": "Cartana Consulting Solutions",
                    "url": "https://cartanaconsulting.com",
                    "handle": None,
                    "source_title": "Cartana Consulting Solutions",
                    "source_url": "https://cartanaconsulting.com",
                    "evidence_note": "Official company site.",
                },
            ],
            "public_images": [
                {
                    "kind": "headshot",
                    "image_url": "https://images.example/ana-raw.jpg",
                    "source_page_url": "https://cartanaconsulting.com/about-cartana/",
                    "source_title": "About Cartana",
                    "confidence_note": "Public headshot candidate.",
                }
            ],
            "key_facts": [
                {
                    "fact": "Founder of Cartana Consulting Solutions.",
                    "source_title": "About Cartana",
                    "source_url": "https://cartanaconsulting.com/about-cartana/",
                    "evidence_note": "Official company biography.",
                }
            ],
            "unverified_or_not_found": ["No verified public X/Twitter profile was confirmed."],
            "prompts_used": ["Ana Roumenova Carter LinkedIn"],
        }
    )


class RIAIntelligenceServiceTests(unittest.TestCase):
    def test_stage1_verified_then_phase2_success_returns_dossier(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient([stage1_verified_response()]),
            openai_client=FakeOpenAIClient(
                [
                    stage2_dossier_response(),
                    make_openai_response(
                        {
                            "public_images": [
                                {
                                    "kind": "headshot",
                                    "image_url": "https://images.example/ana-final.jpg",
                                    "source_page_url": "https://cartanaconsulting.com/about-cartana/",
                                    "source_title": "About Cartana",
                                    "confidence_note": "Best public headshot.",
                                }
                            ]
                        }
                    ),
                ]
            ),
            image_scraper=FakeImageScraper(
                result=[
                    ImageCandidate(
                        imageUrl="https://images.example/ana-final.jpg",
                        sourcePageUrl="https://cartanaconsulting.com/about-cartana/",
                        platform="website",
                        candidateType="headshot",
                        confidence=97,
                    )
                ]
            ),
        )

        result = service.get_ria_profile({"query": "ANA ROUMENOVA CARTER"})

        self.assertEqual(result.subject.full_name, "ANA ROUMENOVA CARTER")
        self.assertEqual(result.subject.crd_number, "4424794")
        self.assertEqual(result.subject.current_firm, "LCG CAPITAL ADVISORS, LLC")
        self.assertEqual(result.subject.location, "Tampa, Florida")
        self.assertEqual(result.executive_summary, "Ana Carter is a finance executive and outsourced FINOP.")
        self.assertEqual(result.verified_profiles[0].platform, "FINRA BrokerCheck")
        self.assertEqual(result.verified_profiles[0].url, "https://files.brokercheck.finra.org/individual/individual_4424794.pdf")
        self.assertEqual(result.verified_profiles[1].url, "https://www.linkedin.com/in/anacarter01/")
        self.assertEqual(result.public_images[0].image_url, "https://images.example/ana-final.jpg")
        self.assertEqual(result.key_facts[0].fact, "Founder of Cartana Consulting Solutions.")
        self.assertEqual(result.prompts_used, ["Ana Roumenova Carter LinkedIn"])
        self.assertIn("No verified public X/Twitter profile was confirmed.", result.unverified_or_not_found)

    def test_stage1_not_found_skips_phase2(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient(
                [
                    make_vertex_response(
                        {
                            "existsOnFinra": False,
                            "reasonIfNotExists": "No confident FINRA or SEC match was found for the query.",
                        }
                    )
                ]
            ),
            openai_client=FakeOpenAIClient([]),
            image_scraper=FakeImageScraper(),
        )

        result = service.get_ria_profile({"query": "Unknown Person"})

        self.assertEqual(result.subject.full_name, "Unknown Person")
        self.assertIsNone(result.subject.crd_number)
        self.assertEqual(result.verified_profiles, [])
        self.assertEqual(result.public_images, [])
        self.assertEqual(result.key_facts, [])
        self.assertEqual(result.prompts_used, [])
        self.assertIn("No confident FINRA or SEC match was found", result.unverified_or_not_found[0])

    def test_missing_query_raises_invalid_query(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient([]),
            openai_client=FakeOpenAIClient([]),
            image_scraper=FakeImageScraper(),
        )

        with self.assertRaises(InvalidQueryError):
            service.get_ria_profile({})

    def test_blank_query_raises_invalid_query(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient([]),
            openai_client=FakeOpenAIClient([]),
            image_scraper=FakeImageScraper(),
        )

        with self.assertRaises(InvalidQueryError):
            service.get_ria_profile({"query": "   "})

    def test_stage1_full_failure_raises_upstream_error(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient(
                [
                    RuntimeError("primary unavailable"),
                    RuntimeError("fallback unavailable"),
                ]
            ),
            openai_client=FakeOpenAIClient([]),
            image_scraper=FakeImageScraper(),
        )

        with self.assertRaises(RIAUpstreamError):
            service.get_ria_profile({"query": "ANA ROUMENOVA CARTER"})

    def test_phase2_failure_raises_upstream_error(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient([stage1_verified_response()]),
            openai_client=FakeOpenAIClient([RuntimeError("openai unavailable")]),
            image_scraper=FakeImageScraper(),
        )

        with self.assertRaises(RIAUpstreamError):
            service.get_ria_profile({"query": "ANA ROUMENOVA CARTER"})

    def test_image_ranking_failure_falls_back_to_local_public_image(self) -> None:
        service = RIAIntelligenceService(
            vertex_client=FakeVertexClient([stage1_verified_response()]),
            openai_client=FakeOpenAIClient(
                [
                    stage2_dossier_response(),
                    RuntimeError("vision ranking unavailable"),
                ]
            ),
            image_scraper=FakeImageScraper(
                result=[
                    ImageCandidate(
                        imageUrl="https://images.example/ana-final.jpg",
                        sourcePageUrl="https://cartanaconsulting.com/about-cartana/",
                        platform="website",
                        candidateType="headshot",
                        confidence=95,
                    )
                ]
            ),
        )

        result = service.get_ria_profile({"query": "ANA ROUMENOVA CARTER"})

        self.assertEqual(result.public_images[0].image_url, "https://images.example/ana-final.jpg")
        self.assertTrue(
            any("OpenAI image ranking failed" in warning for warning in result.unverified_or_not_found)
        )


if __name__ == "__main__":
    unittest.main()
