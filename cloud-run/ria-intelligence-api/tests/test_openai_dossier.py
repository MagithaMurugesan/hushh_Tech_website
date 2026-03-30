from __future__ import annotations

import unittest

from app.models import ImageCandidate, RIAProfile
from app.prompts import (
    DOSSIER_SYSTEM_PROMPT,
    IMAGE_RANK_SYSTEM_PROMPT,
    STAGE1_SYSTEM_PROMPT,
    build_dossier_user_prompt,
    build_image_rank_user_prompt,
    build_stage1_user_prompt,
)
from app.service import _normalize_dossier_payload, _parse_json_object


class DossierPromptTests(unittest.TestCase):
    def test_stage1_prompt_contains_query_and_regulatory_instructions(self) -> None:
        prompt = build_stage1_user_prompt("ANA ROUMENOVA CARTER")

        self.assertIn("ANA ROUMENOVA CARTER", prompt)
        self.assertIn("FINRA or SEC public records", prompt)
        self.assertIn("Do not include social URLs", prompt)
        self.assertIn("regulatory verification assistant", STAGE1_SYSTEM_PROMPT)

    def test_dossier_prompt_contains_seed_context_and_tasks(self) -> None:
        profile = RIAProfile.model_validate(
            {
                "existsOnFinra": True,
                "fullName": "ANA ROUMENOVA CARTER",
                "currentFirm": "LCG CAPITAL ADVISORS, LLC",
                "location": "Tampa, Florida",
                "crdNumber": "4424794",
                "websiteUrl": "https://cartanaconsulting.com",
            }
        )

        prompt = build_dossier_user_prompt(profile)

        self.assertIn('"fullName": "ANA ROUMENOVA CARTER"', prompt)
        self.assertIn('"crdNumber": "4424794"', prompt)
        self.assertIn("Find official/public professional links", prompt)
        self.assertIn("Find publicly accessible image URLs", prompt)
        self.assertIn("exact web prompts/search phrases", prompt)
        self.assertIn("source-backed dossier", DOSSIER_SYSTEM_PROMPT)

    def test_image_rank_prompt_contains_subject_and_candidates(self) -> None:
        profile = RIAProfile.model_validate(
            {
                "existsOnFinra": True,
                "fullName": "ANA ROUMENOVA CARTER",
                "crdNumber": "4424794",
                "currentFirm": "LCG CAPITAL ADVISORS, LLC",
                "location": "Tampa, Florida",
            }
        )
        prompt = build_image_rank_user_prompt(
            profile,
            [
                ImageCandidate(
                    imageUrl="https://images.example/ana.jpg",
                    sourcePageUrl="https://www.linkedin.com/in/ana-carter",
                    platform="linkedin",
                    candidateType="headshot",
                    confidence=97,
                )
            ],
        )

        self.assertIn('"full_name": "ANA ROUMENOVA CARTER"', prompt)
        self.assertIn('"image_url": "https://images.example/ana.jpg"', prompt)
        self.assertIn("Prefer the best public headshot", prompt)
        self.assertIn("public image verification and ranking assistant", IMAGE_RANK_SYSTEM_PROMPT)


class DossierParsingTests(unittest.TestCase):
    def test_parse_json_object_extracts_prose_wrapped_json(self) -> None:
        text = """
        I found a usable dossier.
        {
          "subject": {"full_name": "ANA ROUMENOVA CARTER", "crd_number": "4424794", "current_firm": "LCG CAPITAL ADVISORS, LLC", "location": "Tampa, Florida"},
          "executive_summary": "Ana Carter summary",
          "verified_profiles": [],
          "public_images": [],
          "key_facts": [],
          "unverified_or_not_found": [],
          "prompts_used": ["ana carter linkedin"]
        }
        """

        payload = _parse_json_object(text)

        self.assertEqual(payload["subject"]["full_name"], "ANA ROUMENOVA CARTER")
        self.assertEqual(payload["prompts_used"], ["ana carter linkedin"])

    def test_normalize_dossier_payload_fills_from_seed(self) -> None:
        profile = RIAProfile.model_validate(
            {
                "existsOnFinra": True,
                "fullName": "ANA ROUMENOVA CARTER",
                "currentFirm": "LCG CAPITAL ADVISORS, LLC",
                "location": "Tampa, Florida",
                "crdNumber": "4424794",
            }
        )

        payload = _normalize_dossier_payload(
            {
                "subject": {
                    "full_name": "Wrong Name",
                    "crd_number": "99999",
                    "current_firm": "Wrong Firm",
                    "location": "Wrong City",
                },
                "verified_profiles": [],
            },
            profile,
        )

        self.assertEqual(payload["subject"]["full_name"], "ANA ROUMENOVA CARTER")
        self.assertEqual(payload["subject"]["crd_number"], "4424794")
        self.assertEqual(payload["subject"]["current_firm"], "LCG CAPITAL ADVISORS, LLC")
        self.assertEqual(payload["subject"]["location"], "Tampa, Florida")
        self.assertEqual(payload["verified_profiles"], [])
        self.assertEqual(payload["public_images"], [])
        self.assertIn("Exact web prompts/search phrases were not available", payload["unverified_or_not_found"][0])


if __name__ == "__main__":
    unittest.main()
