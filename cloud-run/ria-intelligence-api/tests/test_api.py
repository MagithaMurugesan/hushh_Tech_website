from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import create_app
from app.models import PublicProfileDossier
from app.service import InvalidQueryError, RIAUpstreamError


def make_response() -> PublicProfileDossier:
    return PublicProfileDossier.model_validate(
        {
            "subject": {
                "full_name": "Ana Roumenova Carter",
                "crd_number": "4424794",
                "current_firm": "LCG CAPITAL ADVISORS, LLC",
                "location": "Tampa, Florida",
            },
            "executive_summary": "Ana Carter summary",
            "verified_profiles": [
                {
                    "platform": "LinkedIn",
                    "label": "LinkedIn",
                    "url": "https://www.linkedin.com/in/anacarter01/",
                    "handle": "anacarter01",
                    "source_title": "LinkedIn",
                    "source_url": "https://www.linkedin.com/in/anacarter01/",
                    "evidence_note": "Matched name and firm.",
                }
            ],
            "public_images": [],
            "key_facts": [],
            "unverified_or_not_found": [],
            "prompts_used": ["Ana Roumenova Carter LinkedIn"],
        }
    )


class FakeService:
    def __init__(self) -> None:
        self.payloads: list[dict] = []

    @property
    def primary_model(self) -> str:
        return "gemini-3.1-pro-preview"

    @property
    def fallback_model(self) -> str:
        return "gemini-2.5-pro"

    def get_ria_profile(self, payload: dict) -> PublicProfileDossier:
        self.payloads.append(payload)
        return make_response()


class InvalidQueryService(FakeService):
    def get_ria_profile(self, payload: dict) -> PublicProfileDossier:
        raise InvalidQueryError("query must not be blank")


class ErrorService(FakeService):
    def get_ria_profile(self, payload: dict) -> PublicProfileDossier:
        raise RIAUpstreamError("stage 1 unavailable")


class ConstructibleService(FakeService):
    init_count = 0
    last_instance: "ConstructibleService | None" = None

    def __init__(self) -> None:
        super().__init__()
        type(self).init_count += 1
        type(self).last_instance = self

    @classmethod
    def reset(cls) -> None:
        cls.init_count = 0
        cls.last_instance = None


class APITests(unittest.TestCase):
    def test_health_endpoint(self) -> None:
        with TestClient(create_app(service=FakeService())) as client:
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["primaryModel"], "gemini-3.1-pro-preview")

    def test_healthz_alias(self) -> None:
        with TestClient(create_app(service=FakeService())) as client:
            response = client.get("/healthz")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_profile_route_accepts_query_payload_and_returns_dossier(self) -> None:
        service = FakeService()
        with TestClient(create_app(service=service)) as client:
            response = client.post(
                "/v1/ria/profile",
                json={"query": "ANA ROUMENOVA CARTER"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["subject"]["full_name"], "Ana Roumenova Carter")
        self.assertEqual(response.json()["executive_summary"], "Ana Carter summary")
        self.assertEqual(service.payloads[0]["query"], "ANA ROUMENOVA CARTER")

    def test_profile_route_maps_invalid_query_to_400(self) -> None:
        with TestClient(create_app(service=InvalidQueryService())) as client:
            response = client.post("/v1/ria/profile", json={"query": "   "})

        self.assertEqual(response.status_code, 400)
        self.assertIn("query", response.text)

    def test_profile_route_maps_upstream_failures_to_502(self) -> None:
        with TestClient(create_app(service=ErrorService())) as client:
            response = client.post(
                "/v1/ria/profile",
                json={"query": "Jane Doe"},
            )

        self.assertEqual(response.status_code, 502)
        self.assertIn("stage 1 unavailable", response.text)

    def test_app_startup_initializes_service_before_first_request(self) -> None:
        ConstructibleService.reset()

        with patch("app.main.RIAIntelligenceService", ConstructibleService):
            with TestClient(create_app()) as client:
                self.assertEqual(ConstructibleService.init_count, 1)
                self.assertTrue(client.app.state.service_ready)
                self.assertIs(client.app.state.ria_service, ConstructibleService.last_instance)

                response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ConstructibleService.init_count, 1)

    def test_repeated_requests_reuse_single_initialized_service_instance(self) -> None:
        ConstructibleService.reset()

        query_payload = {"query": "Jane Doe"}
        with patch("app.main.RIAIntelligenceService", ConstructibleService):
            with TestClient(create_app()) as client:
                startup_service = client.app.state.ria_service

                first_response = client.post("/v1/ria/profile", json=query_payload)
                second_response = client.post("/v1/ria/profile", json=query_payload)

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(ConstructibleService.init_count, 1)
        self.assertIs(startup_service, ConstructibleService.last_instance)
        self.assertEqual(len(ConstructibleService.last_instance.payloads), 2)

    def test_first_request_flag_is_true_once_per_instance(self) -> None:
        with TestClient(create_app(service=FakeService())) as client:
            self.assertTrue(client.app.state.instance_first_request_pending)

            first_response = client.get("/health")
            first_request_pending_after = client.app.state.instance_first_request_pending
            second_response = client.get("/health")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(first_request_pending_after)
        self.assertFalse(client.app.state.instance_first_request_pending)


if __name__ == "__main__":
    unittest.main()
