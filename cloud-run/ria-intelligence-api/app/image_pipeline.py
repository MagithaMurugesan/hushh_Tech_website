from __future__ import annotations

import io
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable
from urllib.parse import quote, urlparse

import httpx
from PIL import Image, UnidentifiedImageError

from .models import ImageCandidate, RIAProfile

logger = logging.getLogger(__name__)

DEFAULT_IMAGE_REFRESH_DAYS = 30
DEFAULT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_IMAGE_BUCKET = ""
DEFAULT_FETCH_TIMEOUT_SECONDS = 20.0
MIN_HEADSHOT_DIMENSION = 200
MIN_LOGO_DIMENSION = 120
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
TEAM_PAGE_KEYWORDS = (
    "advisor",
    "advisors",
    "bio",
    "leadership",
    "our-team",
    "people",
    "professional",
    "professionals",
    "staff",
    "team",
)
ABOUT_PAGE_KEYWORDS = ("about", "company", "firm", "leadership")
TWITTER_DOMAINS = {"twitter.com", "www.twitter.com", "x.com", "www.x.com"}
LINKEDIN_DOMAINS = {"linkedin.com", "www.linkedin.com"}


@dataclass(frozen=True)
class FetchedImage:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int
    final_url: str


@dataclass(frozen=True)
class ImageResolutionResult:
    public_url: str | None
    warnings: list[str]


class HTTPImageFetcher:
    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(
            follow_redirects=True,
            max_redirects=3,
            timeout=DEFAULT_FETCH_TIMEOUT_SECONDS,
            headers={"User-Agent": "hushh-ria-intelligence-api/1.0"},
        )

    def fetch(self, url: str, max_bytes: int) -> FetchedImage:
        if not _is_https_url(url):
            raise ValueError("candidate image URL must use https")

        with self._client.stream("GET", url) as response:
            response.raise_for_status()
            final_url = str(response.url)
            if not _is_https_url(final_url):
                raise ValueError("image redirect chain ended on a non-https URL")

            content_type = _normalize_content_type(response.headers.get("content-type"))
            if content_type not in ALLOWED_CONTENT_TYPES:
                raise ValueError(f"unsupported content type: {content_type or 'unknown'}")

            size_header = response.headers.get("content-length")
            if size_header and int(size_header) > max_bytes:
                raise ValueError("image exceeds maximum allowed size")

            chunks: list[bytes] = []
            total = 0
            for chunk in response.iter_bytes():
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError("image exceeds maximum allowed size")
                chunks.append(chunk)

        data = b"".join(chunks)
        width, height = _inspect_image_dimensions(data, content_type)
        return FetchedImage(
            data=data,
            content_type=content_type,
            extension=ALLOWED_CONTENT_TYPES[content_type],
            width=width,
            height=height,
            final_url=final_url,
        )

    def is_publicly_accessible(self, url: str) -> bool:
        if not _is_https_url(url):
            return False

        try:
            with self._client.stream("GET", url, headers={"Range": "bytes=0-0"}) as response:
                if response.status_code not in (200, 206):
                    return False
                content_type = _normalize_content_type(response.headers.get("content-type"))
                return content_type in ALLOWED_CONTENT_TYPES
        except Exception:  # noqa: BLE001 - non-critical validation path
            return False


class GCSImageStore:
    def __init__(
        self,
        bucket_name: str,
        *,
        client: object | None = None,
        now_fn: Callable[[], datetime] | None = None,
    ) -> None:
        if not bucket_name:
            raise ValueError("bucket_name is required")

        self._now_fn = now_fn or (lambda: datetime.now(timezone.utc))
        self.bucket_name = bucket_name

        if client is None:
            try:
                from google.cloud import storage
            except ImportError as exc:
                raise RuntimeError(
                    "google-cloud-storage is not installed. Install requirements before starting the service."
                ) from exc
            client = storage.Client()

        self._client = client
        self._bucket = self._client.bucket(bucket_name)

    def get_fresh_public_url(self, base_object_key: str, refresh_days: int) -> str | None:
        cutoff = self._now_fn() - timedelta(days=refresh_days)
        freshest: tuple[datetime, str] | None = None

        for extension in ALLOWED_CONTENT_TYPES.values():
            object_name = f"{base_object_key}.{extension}"
            blob = self._bucket.blob(object_name)
            if not blob.exists(client=self._client):
                continue
            blob.reload(client=self._client)
            updated = blob.updated
            if updated is None:
                continue
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if updated < cutoff:
                continue
            if freshest is None or updated > freshest[0]:
                freshest = (updated, object_name)

        if freshest is None:
            return None

        return self.public_url(freshest[1])

    def upload_image(
        self,
        *,
        base_object_key: str,
        extension: str,
        data: bytes,
        content_type: str,
    ) -> str:
        object_name = f"{base_object_key}.{extension}"
        blob = self._bucket.blob(object_name)
        blob.cache_control = "public, max-age=86400"
        blob.upload_from_string(data, content_type=content_type)

        for other_extension in ALLOWED_CONTENT_TYPES.values():
            if other_extension == extension:
                continue
            stale_blob = self._bucket.blob(f"{base_object_key}.{other_extension}")
            if stale_blob.exists(client=self._client):
                stale_blob.delete(client=self._client)

        return self.public_url(object_name)

    def public_url(self, object_name: str) -> str:
        quoted_name = quote(object_name, safe="/")
        return f"https://storage.googleapis.com/{self.bucket_name}/{quoted_name}"


class ImagePipeline:
    def __init__(
        self,
        *,
        bucket_name: str | None = None,
        refresh_days: int | None = None,
        max_bytes: int | None = None,
        store: GCSImageStore | None = None,
        storage_client: object | None = None,
        fetcher: HTTPImageFetcher | None = None,
        now_fn: Callable[[], datetime] | None = None,
    ) -> None:
        self.bucket_name = bucket_name or os.getenv("RIA_IMAGE_BUCKET", DEFAULT_IMAGE_BUCKET)
        self.refresh_days = int(
            refresh_days
            if refresh_days is not None
            else os.getenv("RIA_IMAGE_REFRESH_DAYS", DEFAULT_IMAGE_REFRESH_DAYS)
        )
        self.max_bytes = int(
            max_bytes
            if max_bytes is not None
            else os.getenv("RIA_IMAGE_MAX_BYTES", DEFAULT_IMAGE_MAX_BYTES)
        )
        self._fetcher = fetcher or HTTPImageFetcher()
        self._store_error: str | None = None
        self._store: GCSImageStore | None = store

        if self._store is None and self.bucket_name:
            try:
                self._store = GCSImageStore(
                    self.bucket_name,
                    client=storage_client,
                    now_fn=now_fn,
                )
            except Exception as exc:  # noqa: BLE001 - defer to runtime warning path
                logger.warning("Image store initialization failed: %s", exc)
                self._store_error = str(exc)

    def resolve_image(
        self,
        *,
        profile: RIAProfile,
        image_candidates: list[ImageCandidate] | None,
    ) -> ImageResolutionResult:
        if not image_candidates:
            return ImageResolutionResult(public_url=None, warnings=[])

        if not self.bucket_name:
            return ImageResolutionResult(
                public_url=None,
                warnings=["Image enrichment skipped because RIA_IMAGE_BUCKET is not configured."],
            )

        if self._store is None:
            return ImageResolutionResult(
                public_url=None,
                warnings=[f"Image enrichment skipped because storage is unavailable. {self._store_error}"],
            )

        ranked_candidates = _rank_candidates(image_candidates)
        if not ranked_candidates:
            return ImageResolutionResult(
                public_url=None,
                warnings=["No valid public image candidate passed deterministic validation."],
            )

        for candidate in ranked_candidates:
            base_object_key = _build_base_object_key(profile, candidate)
            if base_object_key is None:
                logger.info("Skipping image candidate because no stable object key could be derived.")
                continue

            fresh_public_url = self._store.get_fresh_public_url(base_object_key, self.refresh_days)
            if fresh_public_url:
                if self._fetcher.is_publicly_accessible(fresh_public_url):
                    return ImageResolutionResult(public_url=fresh_public_url, warnings=[])
                logger.warning("Stored image exists but is not publicly accessible: %s", fresh_public_url)
                return ImageResolutionResult(
                    public_url=None,
                    warnings=["Stored image exists but is not publicly accessible from GCS."],
                )

            try:
                fetched = self._fetcher.fetch(candidate.imageUrl or "", self.max_bytes)
                _validate_dimensions(candidate, fetched)
                public_url = self._store.upload_image(
                    base_object_key=base_object_key,
                    extension=fetched.extension,
                    data=fetched.data,
                    content_type=fetched.content_type,
                )
            except Exception as exc:  # noqa: BLE001 - keep trying lower-priority candidates
                logger.info(
                    "Image candidate rejected for profile=%s source=%s reason=%s",
                    profile.fullName or profile.currentFirm or profile.crdNumber,
                    candidate.sourcePageUrl,
                    exc,
                )
                continue

            if not self._fetcher.is_publicly_accessible(public_url):
                logger.warning("Uploaded image is not publicly accessible from GCS: %s", public_url)
                return ImageResolutionResult(
                    public_url=None,
                    warnings=["Image uploaded to GCS but public delivery is blocked by bucket or org policy."],
                )

            logger.info(
                "Selected image for profile=%s candidateType=%s sourcePage=%s publicUrl=%s",
                profile.fullName or profile.currentFirm or profile.crdNumber,
                candidate.candidateType,
                candidate.sourcePageUrl,
                public_url,
            )
            return ImageResolutionResult(public_url=public_url, warnings=[])

        return ImageResolutionResult(
            public_url=None,
            warnings=["No valid public image candidate passed deterministic validation."],
        )


def _build_base_object_key(profile: RIAProfile, candidate: ImageCandidate) -> str | None:
    if candidate.candidateType == "logo":
        firm_name = profile.currentFirm or profile.fullName
        if not firm_name:
            return None
        return f"ria-images/firms/{_slugify(firm_name)}/logo"

    advisor_id = profile.crdNumber or profile.fullName
    if not advisor_id:
        return None
    return f"ria-images/advisors/{_slugify(advisor_id)}/profile"


def _rank_candidates(candidates: list[ImageCandidate]) -> list[ImageCandidate]:
    deduped: dict[str, ImageCandidate] = {}
    for candidate in candidates:
        image_url = (candidate.imageUrl or "").strip()
        source_page_url = (candidate.sourcePageUrl or "").strip()
        if not image_url or not source_page_url:
            continue
        if not _is_https_url(image_url) or not _is_https_url(source_page_url):
            continue
        if candidate.candidateType not in {"headshot", "logo"}:
            continue
        if candidate.confidence is not None and candidate.confidence < 90:
            continue
        deduped.setdefault(image_url, candidate)

    return sorted(deduped.values(), key=_candidate_sort_key)


def _candidate_sort_key(candidate: ImageCandidate) -> tuple[int, int, str]:
    priority = 99
    platform = (candidate.platform or "").strip().lower()
    source = urlparse(candidate.sourcePageUrl or "")
    domain = (source.netloc or "").lower()
    path = (source.path or "").lower()

    if candidate.candidateType == "headshot":
        if platform == "linkedin" or _domain_matches(domain, LINKEDIN_DOMAINS):
            priority = 0
        elif platform in {"twitter", "x"} or _domain_matches(domain, TWITTER_DOMAINS):
            priority = 1
        elif any(keyword in path for keyword in TEAM_PAGE_KEYWORDS):
            priority = 2
        elif any(keyword in path for keyword in ABOUT_PAGE_KEYWORDS + TEAM_PAGE_KEYWORDS):
            priority = 3
        else:
            priority = 3
    elif candidate.candidateType == "logo":
        priority = 4

    confidence_rank = -(candidate.confidence or 0)
    return (priority, confidence_rank, candidate.imageUrl or "")


def _validate_dimensions(candidate: ImageCandidate, fetched: FetchedImage) -> None:
    minimum = MIN_LOGO_DIMENSION if candidate.candidateType == "logo" else MIN_HEADSHOT_DIMENSION
    if fetched.width < minimum or fetched.height < minimum:
        raise ValueError(
            f"image dimensions {fetched.width}x{fetched.height} are below the minimum {minimum}x{minimum}"
        )


def _inspect_image_dimensions(data: bytes, content_type: str) -> tuple[int, int]:
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError(f"decoded image format is not supported: {image.format}")
            width, height = image.size
    except UnidentifiedImageError as exc:
        raise ValueError(f"response body was not a valid raster image for {content_type}") from exc
    return width, height


def _normalize_content_type(value: str | None) -> str:
    if not value:
        return ""
    return value.split(";", 1)[0].strip().lower()


def _is_https_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return parsed.scheme == "https" and bool(parsed.netloc)


def _domain_matches(domain: str, options: set[str]) -> bool:
    if domain in options:
        return True
    return any(domain.endswith(f".{option}") for option in options)


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return normalized or "unknown"
