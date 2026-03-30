from __future__ import annotations

import io
import unittest

import httpx
from PIL import Image

from app.image_pipeline import (
    DEFAULT_IMAGE_MAX_BYTES,
    FetchedImage,
    HTTPImageFetcher,
    ImagePipeline,
)
from app.models import ImageCandidate, RIAProfile


def make_image_bytes(*, size: tuple[int, int], image_format: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGB", size, color=(12, 34, 56))
    image.save(buffer, format=image_format)
    return buffer.getvalue()


class FakeStore:
    def __init__(self, fresh_urls: dict[str, str] | None = None) -> None:
        self.fresh_urls = fresh_urls or {}
        self.uploads: list[dict[str, object]] = []

    def get_fresh_public_url(self, base_object_key: str, refresh_days: int) -> str | None:
        return self.fresh_urls.get(base_object_key)

    def upload_image(
        self,
        *,
        base_object_key: str,
        extension: str,
        data: bytes,
        content_type: str,
    ) -> str:
        self.uploads.append(
            {
                "base_object_key": base_object_key,
                "extension": extension,
                "data": data,
                "content_type": content_type,
            }
        )
        return f"https://storage.googleapis.com/test-bucket/{base_object_key}.{extension}"


class FakeFetcher:
    def __init__(
        self,
        *,
        fetch_results: dict[str, object] | None = None,
        public_access: dict[str, bool] | None = None,
    ) -> None:
        self.fetch_results = fetch_results or {}
        self.public_access = public_access or {}
        self.fetch_calls: list[str] = []
        self.access_calls: list[str] = []

    def fetch(self, url: str, max_bytes: int) -> FetchedImage:
        del max_bytes
        self.fetch_calls.append(url)
        result = self.fetch_results[url]
        if isinstance(result, Exception):
            raise result
        return result

    def is_publicly_accessible(self, url: str) -> bool:
        self.access_calls.append(url)
        return self.public_access.get(url, True)


class ImagePipelineTests(unittest.TestCase):
    def test_headshot_candidate_is_uploaded_to_advisor_path(self) -> None:
        profile = RIAProfile(
            existsOnFinra=True,
            fullName="Jane Doe",
            currentFirm="Northstar Advisors",
            crdNumber="12345",
        )
        headshot_url = "https://media.example/jane.jpg"
        logo_url = "https://cdn.example/logo.png"
        store = FakeStore()
        fetcher = FakeFetcher(
            fetch_results={
                headshot_url: FetchedImage(
                    data=make_image_bytes(size=(600, 600), image_format="JPEG"),
                    content_type="image/jpeg",
                    extension="jpg",
                    width=600,
                    height=600,
                    final_url=headshot_url,
                ),
                logo_url: FetchedImage(
                    data=make_image_bytes(size=(300, 300)),
                    content_type="image/png",
                    extension="png",
                    width=300,
                    height=300,
                    final_url=logo_url,
                ),
            }
        )
        pipeline = ImagePipeline(bucket_name="test-bucket", store=store, fetcher=fetcher)

        result = pipeline.resolve_image(
            profile=profile,
            image_candidates=[
                ImageCandidate(
                    imageUrl=logo_url,
                    sourcePageUrl="https://northstar.example/about",
                    platform="website",
                    candidateType="logo",
                    confidence=93,
                ),
                ImageCandidate(
                    imageUrl=headshot_url,
                    sourcePageUrl="https://www.linkedin.com/in/jane-doe",
                    platform="linkedin",
                    candidateType="headshot",
                    confidence=98,
                ),
            ],
        )

        self.assertEqual(
            result.public_url,
            "https://storage.googleapis.com/test-bucket/ria-images/advisors/12345/profile.jpg",
        )
        self.assertEqual(result.warnings, [])
        self.assertEqual(fetcher.fetch_calls, [headshot_url])
        self.assertEqual(
            store.uploads[0]["base_object_key"],
            "ria-images/advisors/12345/profile",
        )

    def test_logo_fallback_is_used_when_headshot_is_too_small(self) -> None:
        profile = RIAProfile(
            existsOnFinra=True,
            fullName="Northstar Advisors",
            currentFirm="Northstar Advisors",
        )
        headshot_url = "https://northstar.example/team/jane.jpg"
        logo_url = "https://northstar.example/assets/logo.png"
        store = FakeStore()
        fetcher = FakeFetcher(
            fetch_results={
                headshot_url: FetchedImage(
                    data=make_image_bytes(size=(180, 180)),
                    content_type="image/png",
                    extension="png",
                    width=180,
                    height=180,
                    final_url=headshot_url,
                ),
                logo_url: FetchedImage(
                    data=make_image_bytes(size=(240, 240)),
                    content_type="image/png",
                    extension="png",
                    width=240,
                    height=240,
                    final_url=logo_url,
                ),
            }
        )
        pipeline = ImagePipeline(bucket_name="test-bucket", store=store, fetcher=fetcher)

        result = pipeline.resolve_image(
            profile=profile,
            image_candidates=[
                ImageCandidate(
                    imageUrl=headshot_url,
                    sourcePageUrl="https://northstar.example/team/jane-doe",
                    platform="website",
                    candidateType="headshot",
                    confidence=96,
                ),
                ImageCandidate(
                    imageUrl=logo_url,
                    sourcePageUrl="https://northstar.example/about",
                    platform="website",
                    candidateType="logo",
                    confidence=92,
                ),
            ],
        )

        self.assertEqual(
            result.public_url,
            "https://storage.googleapis.com/test-bucket/ria-images/firms/northstar-advisors/logo.png",
        )
        self.assertEqual(fetcher.fetch_calls, [headshot_url, logo_url])
        self.assertEqual(
            store.uploads[0]["base_object_key"],
            "ria-images/firms/northstar-advisors/logo",
        )

    def test_existing_fresh_image_is_reused_without_fetching(self) -> None:
        profile = RIAProfile(existsOnFinra=True, fullName="Jane Doe", crdNumber="12345")
        fresh_url = "https://storage.googleapis.com/test-bucket/ria-images/advisors/12345/profile.jpg"
        store = FakeStore(fresh_urls={"ria-images/advisors/12345/profile": fresh_url})
        fetcher = FakeFetcher(public_access={fresh_url: True})
        pipeline = ImagePipeline(bucket_name="test-bucket", store=store, fetcher=fetcher)

        result = pipeline.resolve_image(
            profile=profile,
            image_candidates=[
                ImageCandidate(
                    imageUrl="https://media.example/jane.jpg",
                    sourcePageUrl="https://www.linkedin.com/in/jane-doe",
                    platform="linkedin",
                    candidateType="headshot",
                    confidence=97,
                )
            ],
        )

        self.assertEqual(result.public_url, fresh_url)
        self.assertEqual(result.warnings, [])
        self.assertEqual(fetcher.fetch_calls, [])
        self.assertEqual(store.uploads, [])

    def test_public_gcs_access_failure_returns_warning(self) -> None:
        profile = RIAProfile(existsOnFinra=True, fullName="Jane Doe", crdNumber="12345")
        candidate_url = "https://media.example/jane.jpg"
        uploaded_url = "https://storage.googleapis.com/test-bucket/ria-images/advisors/12345/profile.jpg"
        store = FakeStore()
        fetcher = FakeFetcher(
            fetch_results={
                candidate_url: FetchedImage(
                    data=make_image_bytes(size=(400, 400), image_format="JPEG"),
                    content_type="image/jpeg",
                    extension="jpg",
                    width=400,
                    height=400,
                    final_url=candidate_url,
                )
            },
            public_access={uploaded_url: False},
        )
        pipeline = ImagePipeline(bucket_name="test-bucket", store=store, fetcher=fetcher)

        result = pipeline.resolve_image(
            profile=profile,
            image_candidates=[
                ImageCandidate(
                    imageUrl=candidate_url,
                    sourcePageUrl="https://www.linkedin.com/in/jane-doe",
                    platform="linkedin",
                    candidateType="headshot",
                    confidence=97,
                )
            ],
        )

        self.assertIsNone(result.public_url)
        self.assertEqual(
            result.warnings,
            ["Image uploaded to GCS but public delivery is blocked by bucket or org policy."],
        )

    def test_http_image_fetcher_rejects_invalid_content_types_and_oversized_images(self) -> None:
        valid_png = make_image_bytes(size=(220, 220))

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/html":
                return httpx.Response(
                    200,
                    headers={"content-type": "text/html"},
                    text="<html>not an image</html>",
                )
            if request.url.path == "/svg":
                return httpx.Response(
                    200,
                    headers={"content-type": "image/svg+xml"},
                    text="<svg></svg>",
                )
            if request.url.path == "/oversized":
                return httpx.Response(
                    200,
                    headers={
                        "content-type": "image/png",
                        "content-length": str(DEFAULT_IMAGE_MAX_BYTES + 1),
                    },
                    content=valid_png,
                )
            return httpx.Response(
                200,
                headers={"content-type": "image/png"},
                content=valid_png,
            )

        client = httpx.Client(
            transport=httpx.MockTransport(handler),
            follow_redirects=True,
            max_redirects=3,
        )
        fetcher = HTTPImageFetcher(client=client)

        with self.assertRaises(ValueError):
            fetcher.fetch("https://example.com/html", DEFAULT_IMAGE_MAX_BYTES)

        with self.assertRaises(ValueError):
            fetcher.fetch("https://example.com/svg", DEFAULT_IMAGE_MAX_BYTES)

        with self.assertRaises(ValueError):
            fetcher.fetch("https://example.com/oversized", DEFAULT_IMAGE_MAX_BYTES)

        fetched = fetcher.fetch("https://example.com/ok", DEFAULT_IMAGE_MAX_BYTES)
        self.assertEqual(fetched.content_type, "image/png")
        self.assertEqual((fetched.width, fetched.height), (220, 220))


if __name__ == "__main__":
    unittest.main()
