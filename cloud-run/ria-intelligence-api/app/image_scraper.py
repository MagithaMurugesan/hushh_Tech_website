"""Deterministic web scraper for advisor/firm profile images.

Production-grade module that:
1. Takes verified profile data, model-discovered candidate pages, AND grounded source URLs
2. Filters source URLs for relevance (person/firm name match, team/about pages)
3. Crawls actual pages: LinkedIn, firm website, FINRA BrokerCheck, grounded sources
4. Parses HTML with rich extraction: <img>, srcset, data-src, <picture><source>,
   og:image, twitter:image, JSON-LD image, CSS background-image
5. Scores and ranks images using page-level + image-level heuristics
6. Returns ImageCandidate objects for the existing image pipeline
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

from .models import ImageCandidate, RIAProfile

logger = logging.getLogger(__name__)

SCRAPE_TIMEOUT = 15.0
MAX_CANDIDATES_PER_SOURCE = 4
MAX_TOTAL_CANDIDATES = 10
MAX_GROUNDED_PAGES = 6

# CDN patterns for known platforms
LINKEDIN_IMAGE_PATTERNS = (
    "media.licdn.com",
    "media-exp1.licdn.com",
    "media-exp2.licdn.com",
    "static.licdn.com",
)
TWITTER_IMAGE_PATTERNS = (
    "pbs.twimg.com/profile_images",
    "pbs.twimg.com/media",
)

# Low-value assets to reject before fetching
EXCLUDE_PATTERNS = (
    "favicon", "sprite", "badge", "arrow", "button",
    "spacer", "pixel", "tracking", "analytics",
    "ad-", "ads/", "1x1", "placeholder", "loading",
    "spinner", "social-", "share-",
    ".svg", ".gif", "data:image",
)

# Tiny-asset patterns to reject specifically (favicons, icon fonts, etc.)
TINY_ASSET_PATTERNS = (
    "favicon", "apple-touch-icon", "/ico/", "/icons/",
    "icon-", "-icon.", "16x16", "32x32", "48x48",
    "shortcut icon",
)

# Keywords that suggest a headshot image
HEADSHOT_INDICATORS = (
    "headshot", "portrait", "profile", "photo", "team",
    "advisor", "staff", "bio", "about", "people",
    "professional", "executive", "officer", "director",
    "member", "principal", "founder", "ceo", "president",
)

# Team/about page path segments
TEAM_PAGE_SEGMENTS = (
    "team", "our-team", "about", "people", "staff",
    "advisors", "professionals", "leadership", "bio",
    "about-us", "our-people", "our-advisors", "meet",
    "team-member", "contact",
)

# Page keywords that indicate a person/team page (scores higher)
PERSON_PAGE_KEYWORDS = (
    "team", "advisor", "bio", "profile", "staff",
    "people", "leadership", "professional", "member",
    "about", "meet",
)

# Patterns to filter irrelevant grounded source URLs
IRRELEVANT_DOMAIN_PATTERNS = (
    "wikipedia.org", "youtube.com", "facebook.com",
    "instagram.com", "reddit.com", "yelp.com",
    "glassdoor.com", "indeed.com", "bbb.org",
    "maps.google.com", "news.google.com",
)

# CSS background-image regex
CSS_BG_IMAGE_RE = re.compile(
    r"""background-image\s*:\s*url\(\s*['"]?(https?://[^'")]+)['"]?\s*\)""",
    re.IGNORECASE,
)

# srcset entry regex: url followed by optional size descriptor
SRCSET_ENTRY_RE = re.compile(r"([^\s,]+)\s+(\d+)[wx]", re.IGNORECASE)


@dataclass(frozen=True)
class ScrapedCandidate:
    """A candidate image found by scraping a web page."""
    image_url: str
    source_page_url: str
    platform: str
    candidate_type: str  # "headshot" or "logo"
    confidence: int
    reason: str


@dataclass
class ScrapeStats:
    """Observability counters for the image scrape stage."""
    grounded_source_urls_received: int = 0
    grounded_source_urls_relevant: int = 0
    pages_crawled: int = 0
    images_extracted: int = 0
    images_rejected: int = 0
    rejection_reasons: dict[str, int] = field(default_factory=dict)
    selected_class: str | None = None
    null_reason: str | None = None

    def reject(self, reason: str) -> None:
        self.images_rejected += 1
        self.rejection_reasons[reason] = self.rejection_reasons.get(reason, 0) + 1


def create_scraper_client() -> httpx.Client:
    """Create an httpx client configured for HTML scraping."""
    return httpx.Client(
        follow_redirects=True,
        max_redirects=3,
        timeout=SCRAPE_TIMEOUT,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        },
    )


class ImageScraper:
    """Deterministic web scraper that extracts real image URLs from pages."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or create_scraper_client()

    def discover_candidates(
        self,
        profile: RIAProfile,
        *,
        model_candidates: list[ImageCandidate] | None = None,
        gemini_candidates: list[ImageCandidate] | None = None,
        grounded_source_urls: list[str] | None = None,
    ) -> list[ImageCandidate]:
        """Discover image candidates from all available sources.

        Scrapes real web pages using verified profile data.
        Crawls relevant grounded source URLs from upstream dossier research.
        Merges scraped candidates with any model candidates.
        Returns a ranked list of ImageCandidate objects.
        """
        stats = ScrapeStats()
        scraped: list[ScrapedCandidate] = []
        person_name = profile.fullName or ""
        firm_name = profile.currentFirm or ""
        upstream_candidates = model_candidates if model_candidates is not None else gemini_candidates
        visited_pages: set[str] = set()

        # 1. FINRA BrokerCheck page (highest trust for individuals)
        if profile.crdNumber and profile.existsOnFinra:
            results = self._scrape_finra_brokercheck(profile.crdNumber, person_name)
            scraped.extend(results)
            stats.pages_crawled += 1

        # 2. LinkedIn public profile
        if profile.linkedinUrl:
            visited_pages.add(_canonicalize_url(profile.linkedinUrl))
            results = self._scrape_page_rich(
                url=profile.linkedinUrl,
                person_name=person_name,
                platform="linkedin",
            )
            scraped.extend(results)
            stats.pages_crawled += 1

        # 3. Firm website (main + team/about subpages)
        if profile.websiteUrl:
            visited_pages.add(_canonicalize_url(profile.websiteUrl))
            results, pages = self._scrape_firm_website(
                website_url=profile.websiteUrl,
                person_name=person_name,
                firm_name=firm_name,
                visited_pages=visited_pages,
            )
            scraped.extend(results)
            stats.pages_crawled += pages

        # 4. Twitter / X profile
        if profile.twitterUrl:
            visited_pages.add(_canonicalize_url(profile.twitterUrl))
            results = self._scrape_page_rich(
                url=profile.twitterUrl,
                person_name=person_name,
                platform="twitter",
            )
            scraped.extend(results)
            stats.pages_crawled += 1

        # 5. Crawl model-discovered source pages
        for candidate in upstream_candidates or []:
            source_page_url = _normalize_url(candidate.sourcePageUrl)
            if not source_page_url:
                continue

            page_key = _canonicalize_url(source_page_url)
            if page_key in visited_pages:
                continue
            visited_pages.add(page_key)

            platform = _normalize_platform(candidate.platform, source_page_url)
            if platform == "website" and _looks_like_homepage(source_page_url):
                results, pages = self._scrape_firm_website(
                    website_url=source_page_url,
                    person_name=person_name,
                    firm_name=firm_name,
                    visited_pages=visited_pages,
                )
                scraped.extend(results)
                stats.pages_crawled += pages
            else:
                results = self._scrape_page_rich(
                    url=source_page_url,
                    person_name=person_name,
                    platform=platform,
                )
                scraped.extend(results)
                stats.pages_crawled += 1

        # 6. Crawl relevant grounded source URLs from upstream dossier search results
        all_grounded = grounded_source_urls or []
        stats.grounded_source_urls_received = len(all_grounded)
        relevant_urls = _filter_relevant_source_urls(
            all_grounded, person_name, firm_name, profile.otherNames,
        )
        stats.grounded_source_urls_relevant = len(relevant_urls)

        grounded_crawled = 0
        for grounded_url in relevant_urls:
            if grounded_crawled >= MAX_GROUNDED_PAGES:
                break
            page_key = _canonicalize_url(grounded_url)
            if page_key in visited_pages:
                continue
            visited_pages.add(page_key)

            platform = _infer_platform_from_url(grounded_url)
            results = self._scrape_page_rich(
                url=grounded_url,
                person_name=person_name,
                platform=platform,
            )
            scraped.extend(results)
            stats.pages_crawled += 1
            grounded_crawled += 1

        stats.images_extracted = len(scraped)

        # Convert scraped candidates to ImageCandidate objects
        image_candidates = _scraped_to_model_candidates(scraped)

        # Merge with direct model candidates (scraped get priority)
        if upstream_candidates:
            seen_urls = {c.imageUrl for c in image_candidates if c.imageUrl}
            for candidate in upstream_candidates:
                direct_url = _normalize_url(candidate.imageUrl)
                if direct_url and direct_url not in seen_urls:
                    image_candidates.append(
                        candidate.model_copy(update={"imageUrl": direct_url})
                    )
                    seen_urls.add(direct_url)

        final = image_candidates[:MAX_TOTAL_CANDIDATES]

        # Determine selected class and null reason for observability
        if final:
            top = final[0]
            if top.candidateType == "headshot":
                stats.selected_class = f"{top.platform or 'website'}_headshot"
            else:
                stats.selected_class = f"{top.platform or 'website'}_logo"
        else:
            stats.null_reason = (
                "only_tiny_assets" if scraped else "no_relevant_page"
            )

        logger.info(
            "Image scraper completed for profile=%s "
            "grounded_received=%d grounded_relevant=%d "
            "pages_crawled=%d images_extracted=%d "
            "candidates_returned=%d selected_class=%s null_reason=%s",
            person_name,
            stats.grounded_source_urls_received,
            stats.grounded_source_urls_relevant,
            stats.pages_crawled,
            stats.images_extracted,
            len(final),
            stats.selected_class,
            stats.null_reason,
        )

        return final

    # ------------------------------------------------------------------
    # Page scraping methods
    # ------------------------------------------------------------------

    def _scrape_finra_brokercheck(
        self,
        crd_number: str,
        person_name: str,
    ) -> list[ScrapedCandidate]:
        """Scrape FINRA BrokerCheck individual summary page."""
        url = f"https://brokercheck.finra.org/individual/summary/{crd_number}"
        candidates: list[ScrapedCandidate] = []

        try:
            html = self._fetch_html(url)
            if not html:
                return candidates

            soup = BeautifulSoup(html, "lxml")
            candidates = self._extract_all_images(soup, url, "finra", person_name)

        except Exception as exc:  # noqa: BLE001
            logger.info("FINRA BrokerCheck scrape failed for CRD=%s: %s", crd_number, exc)

        return candidates[:MAX_CANDIDATES_PER_SOURCE]

    def _scrape_page_rich(
        self,
        url: str,
        person_name: str,
        platform: str,
    ) -> list[ScrapedCandidate]:
        """Scrape a page using all extraction methods."""
        candidates: list[ScrapedCandidate] = []

        try:
            html = self._fetch_html(url)
            if not html:
                return candidates

            soup = BeautifulSoup(html, "lxml")
            candidates = self._extract_all_images(soup, url, platform, person_name)

        except Exception as exc:  # noqa: BLE001
            logger.info("Page scrape failed for url=%s: %s", url, exc)

        return candidates[:MAX_CANDIDATES_PER_SOURCE]

    def _scrape_firm_website(
        self,
        website_url: str,
        person_name: str,
        firm_name: str,
        visited_pages: set[str] | None = None,
    ) -> tuple[list[ScrapedCandidate], int]:
        """Scrape firm website: main page for logo, then team/about pages for headshots.

        Returns (candidates, pages_crawled).
        """
        candidates: list[ScrapedCandidate] = []
        pages_crawled = 0

        try:
            html = self._fetch_html(website_url)
            if not html:
                return candidates, pages_crawled

            pages_crawled += 1
            soup = BeautifulSoup(html, "lxml")

            # Extract logo from main page (skip tiny favicons, find real logos)
            logo = _extract_best_logo(soup, website_url, firm_name)
            if logo:
                candidates.append(logo)

            # Find team/about page links
            team_urls = _find_team_page_links(soup, website_url)

            if team_urls:
                for team_url in team_urls[:2]:
                    if visited_pages and _canonicalize_url(team_url) in visited_pages:
                        continue
                    if visited_pages is not None:
                        visited_pages.add(_canonicalize_url(team_url))

                    team_candidates = self._scrape_page_rich(
                        url=team_url,
                        person_name=person_name,
                        platform="website",
                    )
                    candidates.extend(team_candidates)
                    pages_crawled += 1
            else:
                # Try headshots on the main page itself
                main_candidates = self._extract_all_images(
                    soup, website_url, "website", person_name,
                )
                candidates.extend(main_candidates)

        except Exception as exc:  # noqa: BLE001
            logger.info("Firm website scrape failed for url=%s: %s", website_url, exc)

        return candidates[:MAX_CANDIDATES_PER_SOURCE], pages_crawled

    def _fetch_html(self, url: str) -> str | None:
        """Fetch HTML content from a URL. Returns None on failure."""
        if not _is_https_url(url):
            return None
        try:
            response = self._client.get(url)
            response.raise_for_status()
            content_type = (response.headers.get("content-type") or "").lower()
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return None
            return response.text
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to fetch HTML from %s: %s", url, exc)
            return None

    # ------------------------------------------------------------------
    # Rich image extraction (all methods combined)
    # ------------------------------------------------------------------

    def _extract_all_images(
        self,
        soup: BeautifulSoup,
        page_url: str,
        platform: str,
        person_name: str,
    ) -> list[ScrapedCandidate]:
        """Extract images using ALL available methods:
        1. og:image meta
        2. twitter:image meta
        3. JSON-LD image
        4. Platform CDN patterns
        5. <picture><source> tags
        6. <img> with srcset (choose largest)
        7. <img> with data-src / data-lazy-src
        8. Standard <img src>
        9. CSS background-image
        """
        candidates: list[ScrapedCandidate] = []
        seen_urls: set[str] = set()

        def _add(c: ScrapedCandidate | None) -> None:
            if c and c.image_url not in seen_urls:
                candidates.append(c)
                seen_urls.add(c.image_url)

        def _add_list(cs: list[ScrapedCandidate]) -> None:
            for c in cs:
                _add(c)

        # 1. og:image
        _add(_extract_og_image(soup, page_url, platform, person_name))

        # 2. twitter:image
        _add(_extract_twitter_image(soup, page_url, platform, person_name))

        # 3. JSON-LD image
        _add_list(_extract_json_ld_images(soup, page_url, platform, person_name))

        # 4. Platform CDN patterns
        _add_list(_extract_cdn_images(soup, page_url, platform, person_name))

        # 5. <picture><source> tags
        _add_list(_extract_picture_sources(soup, page_url, platform, person_name))

        # 6-8. <img> tags (srcset, data-src, standard src)
        for img in soup.find_all("img"):
            img_urls = _resolve_img_urls(img, page_url)
            for img_url in img_urls:
                if img_url in seen_urls:
                    continue
                if _is_excluded_image(img_url):
                    continue
                if _is_tiny_asset(img_url):
                    continue

                alt = (img.get("alt") or "").lower()
                score = _score_image_for_person(img, img_url, alt, person_name)

                if score >= 60:
                    _add(ScrapedCandidate(
                        image_url=img_url,
                        source_page_url=page_url,
                        platform=platform,
                        candidate_type="headshot",
                        confidence=min(score, 96),
                        reason=f"Image on {platform} page (score={score})",
                    ))

        # 9. CSS background-image
        _add_list(_extract_css_background_images(soup, page_url, platform, person_name))

        return candidates


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------


def _extract_og_image(
    soup: BeautifulSoup,
    page_url: str,
    platform: str,
    person_name: str,
) -> ScrapedCandidate | None:
    """Extract og:image meta tag as a candidate."""
    og_tag = soup.find("meta", property="og:image")
    if not og_tag or not isinstance(og_tag, Tag):
        return None

    og_url = (og_tag.get("content") or "").strip()
    if not og_url:
        return None

    og_url = urljoin(page_url, og_url)
    if not _is_https_url(og_url):
        return None
    if _is_excluded_image(og_url) or _is_tiny_asset(og_url):
        return None

    confidence = 92 if platform == "linkedin" else 80
    candidate_type = "headshot"

    if "logo" in og_url.lower():
        candidate_type = "logo"
        confidence = 75

    return ScrapedCandidate(
        image_url=og_url,
        source_page_url=page_url,
        platform=platform,
        candidate_type=candidate_type,
        confidence=confidence,
        reason=f"og:image from {platform} page",
    )


def _extract_twitter_image(
    soup: BeautifulSoup,
    page_url: str,
    platform: str,
    person_name: str,
) -> ScrapedCandidate | None:
    """Extract twitter:image meta tag as a candidate."""
    # Try both name= and property= variants
    tw_tag = soup.find("meta", attrs={"name": "twitter:image"})
    if not tw_tag or not isinstance(tw_tag, Tag):
        tw_tag = soup.find("meta", property="twitter:image")
    if not tw_tag or not isinstance(tw_tag, Tag):
        return None

    tw_url = (tw_tag.get("content") or "").strip()
    if not tw_url:
        return None

    tw_url = urljoin(page_url, tw_url)
    if not _is_https_url(tw_url):
        return None
    if _is_excluded_image(tw_url) or _is_tiny_asset(tw_url):
        return None

    candidate_type = "logo" if "logo" in tw_url.lower() else "headshot"
    confidence = 78

    return ScrapedCandidate(
        image_url=tw_url,
        source_page_url=page_url,
        platform=platform,
        candidate_type=candidate_type,
        confidence=confidence,
        reason=f"twitter:image from {platform} page",
    )


def _extract_json_ld_images(
    soup: BeautifulSoup,
    page_url: str,
    platform: str,
    person_name: str,
) -> list[ScrapedCandidate]:
    """Extract image field from JSON-LD <script type="application/ld+json"> blocks."""
    candidates: list[ScrapedCandidate] = []

    for script_tag in soup.find_all("script", type="application/ld+json"):
        text = script_tag.get_text(strip=True)
        if not text:
            continue
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, ValueError):
            continue

        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            image_val = item.get("image")
            if not image_val:
                continue

            # image can be a string URL or an object with .url
            urls: list[str] = []
            if isinstance(image_val, str):
                urls.append(image_val)
            elif isinstance(image_val, dict):
                url_val = image_val.get("url") or image_val.get("contentUrl")
                if isinstance(url_val, str):
                    urls.append(url_val)
            elif isinstance(image_val, list):
                for entry in image_val:
                    if isinstance(entry, str):
                        urls.append(entry)
                    elif isinstance(entry, dict):
                        url_val = entry.get("url") or entry.get("contentUrl")
                        if isinstance(url_val, str):
                            urls.append(url_val)

            for raw_url in urls:
                abs_url = urljoin(page_url, raw_url.strip())
                if not _is_https_url(abs_url):
                    continue
                if _is_excluded_image(abs_url) or _is_tiny_asset(abs_url):
                    continue

                # Determine type from JSON-LD @type
                ld_type = (item.get("@type") or "").lower()
                candidate_type = "headshot" if ld_type in {"person", "profilepage"} else "logo"
                confidence = 82 if candidate_type == "headshot" else 74

                candidates.append(ScrapedCandidate(
                    image_url=abs_url,
                    source_page_url=page_url,
                    platform=platform,
                    candidate_type=candidate_type,
                    confidence=confidence,
                    reason=f"JSON-LD image (@type={ld_type or 'unknown'})",
                ))

    return candidates


def _extract_cdn_images(
    soup: BeautifulSoup,
    page_url: str,
    platform: str,
    person_name: str,
) -> list[ScrapedCandidate]:
    """Extract images from known CDN patterns (LinkedIn, Twitter)."""
    candidates: list[ScrapedCandidate] = []

    for img in soup.find_all("img"):
        img_urls = _resolve_img_urls(img, page_url)
        for img_url in img_urls:
            parsed = urlparse(img_url)
            domain = (parsed.netloc or "").lower()

            if platform == "linkedin" and any(p in domain for p in LINKEDIN_IMAGE_PATTERNS):
                if _is_excluded_image(img_url):
                    continue
                candidates.append(ScrapedCandidate(
                    image_url=img_url,
                    source_page_url=page_url,
                    platform="linkedin",
                    candidate_type="headshot",
                    confidence=95,
                    reason="LinkedIn CDN profile image",
                ))

            if platform in {"twitter", "x"} and any(p in img_url for p in TWITTER_IMAGE_PATTERNS):
                candidates.append(ScrapedCandidate(
                    image_url=img_url,
                    source_page_url=page_url,
                    platform="twitter",
                    candidate_type="headshot",
                    confidence=93,
                    reason="Twitter/X CDN profile image",
                ))

    return candidates


def _extract_picture_sources(
    soup: BeautifulSoup,
    page_url: str,
    platform: str,
    person_name: str,
) -> list[ScrapedCandidate]:
    """Extract images from <picture><source> elements."""
    candidates: list[ScrapedCandidate] = []

    for picture in soup.find_all("picture"):
        best_url = None
        best_width = 0

        # Check <source> children
        for source in picture.find_all("source"):
            srcset = (source.get("srcset") or "").strip()
            if not srcset:
                continue
            url, width = _parse_srcset_largest(srcset, page_url)
            if url and width > best_width:
                best_url = url
                best_width = width

        # Fallback to <img> inside <picture>
        if not best_url:
            img = picture.find("img")
            if img and isinstance(img, Tag):
                urls = _resolve_img_urls(img, page_url)
                if urls:
                    best_url = urls[0]

        if not best_url or not _is_https_url(best_url):
            continue
        if _is_excluded_image(best_url) or _is_tiny_asset(best_url):
            continue

        alt = ""
        img_tag = picture.find("img")
        if img_tag and isinstance(img_tag, Tag):
            alt = (img_tag.get("alt") or "").lower()

        score = _score_image_for_person(img_tag or picture, best_url, alt, person_name)
        if score >= 55:
            candidates.append(ScrapedCandidate(
                image_url=best_url,
                source_page_url=page_url,
                platform=platform,
                candidate_type="headshot",
                confidence=min(score, 94),
                reason=f"<picture><source> image (score={score})",
            ))

    return candidates


def _extract_css_background_images(
    soup: BeautifulSoup,
    page_url: str,
    platform: str,
    person_name: str,
) -> list[ScrapedCandidate]:
    """Extract images from inline CSS background-image on divs/sections."""
    candidates: list[ScrapedCandidate] = []

    for element in soup.find_all(style=True):
        style = element.get("style") or ""
        match = CSS_BG_IMAGE_RE.search(style)
        if not match:
            continue

        bg_url = urljoin(page_url, match.group(1).strip())
        if not _is_https_url(bg_url):
            continue
        if _is_excluded_image(bg_url) or _is_tiny_asset(bg_url):
            continue

        # Check nearby text for person name
        nearby_text = (element.get_text() or "").lower()
        name_lower = person_name.lower().strip()
        name_parts = [p for p in name_lower.split() if len(p) > 2]

        confidence = 65
        candidate_type = "headshot"

        if name_lower and name_lower in nearby_text:
            confidence = 85
        elif name_parts and any(part in nearby_text for part in name_parts):
            confidence = 78

        # Check classes/id for headshot signals
        cls = " ".join(element.get("class", []) if isinstance(element.get("class"), list) else [])
        el_id = element.get("id") or ""
        attrs_text = f"{cls} {el_id} {bg_url}".lower()
        if any(kw in attrs_text for kw in HEADSHOT_INDICATORS):
            confidence = max(confidence, 75)

        if "logo" in attrs_text:
            candidate_type = "logo"
            confidence = min(confidence, 72)

        if confidence >= 65:
            candidates.append(ScrapedCandidate(
                image_url=bg_url,
                source_page_url=page_url,
                platform=platform,
                candidate_type=candidate_type,
                confidence=confidence,
                reason=f"CSS background-image (confidence={confidence})",
            ))

    return candidates


def _extract_best_logo(
    soup: BeautifulSoup,
    page_url: str,
    firm_name: str,
) -> ScrapedCandidate | None:
    """Extract the best firm logo, skipping tiny favicons.

    Prefers: large logo images > apple-touch-icon > standard logo img.
    Rejects: favicon.ico, 16x16, 32x32, icon fonts.
    """
    logo_candidates: list[tuple[str, int, str]] = []  # (url, score, reason)

    # 1. Look for <img> with "logo" in class/id/alt/src
    for img in soup.find_all("img"):
        img_urls = _resolve_img_urls(img, page_url)
        if not img_urls:
            continue
        img_url = img_urls[0]

        attrs_text = " ".join([
            (img.get("alt") or ""),
            " ".join(img.get("class", [])) if isinstance(img.get("class"), list) else (img.get("class") or ""),
            (img.get("id") or ""),
            img_url,
        ]).lower()

        if "logo" not in attrs_text:
            continue
        if _is_tiny_asset(img_url):
            continue

        # Score: larger declared dimensions = better logo
        width = _parse_dimension(img.get("width"))
        height = _parse_dimension(img.get("height"))
        size_score = 0
        if width and height:
            size_score = min(width, height)
        elif width:
            size_score = width
        elif height:
            size_score = height

        logo_candidates.append((img_url, 88 + min(size_score // 50, 5), "Logo <img> tag"))

    # 2. Check for apple-touch-icon (usually 180x180+)
    for link_tag in soup.find_all("link"):
        rel = " ".join(link_tag.get("rel", []))
        href = (link_tag.get("href") or "").strip()
        if not href:
            continue
        abs_url = urljoin(page_url, href)
        if not _is_https_url(abs_url):
            continue

        if "apple-touch-icon" in rel:
            if not _is_tiny_asset(abs_url):
                # Parse sizes attribute if available (e.g. sizes="180x180")
                sizes = (link_tag.get("sizes") or "").lower()
                size_val = 180  # default for apple-touch-icon
                if "x" in sizes:
                    try:
                        size_val = int(sizes.split("x")[0])
                    except (ValueError, IndexError):
                        pass
                logo_candidates.append((abs_url, 82 + min(size_val // 50, 5), "apple-touch-icon"))

    # 3. Pick the highest-scoring non-tiny logo
    if not logo_candidates:
        return None

    logo_candidates.sort(key=lambda t: -t[1])
    best_url, best_score, best_reason = logo_candidates[0]

    return ScrapedCandidate(
        image_url=best_url,
        source_page_url=page_url,
        platform="website",
        candidate_type="logo",
        confidence=best_score,
        reason=best_reason,
    )


# ---------------------------------------------------------------------------
# URL resolution helpers (srcset, data-src, standard src)
# ---------------------------------------------------------------------------


def _resolve_img_urls(img: Tag, base_url: str) -> list[str]:
    """Resolve all available image URLs from an <img> tag.

    Priority: srcset (largest) > data-src/data-lazy-src > src.
    Returns deduplicated list of valid HTTPS URLs.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def _add(url: str | None) -> None:
        if url and url not in seen and _is_https_url(url):
            urls.append(url)
            seen.add(url)

    # 1. srcset — choose largest
    srcset = (img.get("srcset") or "").strip()
    if srcset:
        largest_url, _ = _parse_srcset_largest(srcset, base_url)
        _add(largest_url)

    # 2. data-srcset (lazy-loaded srcset)
    data_srcset = (img.get("data-srcset") or "").strip()
    if data_srcset:
        largest_url, _ = _parse_srcset_largest(data_srcset, base_url)
        _add(largest_url)

    # 3. data-src / data-lazy-src (lazy loading)
    for attr in ("data-src", "data-lazy-src"):
        val = (img.get(attr) or "").strip()
        if val:
            _add(urljoin(base_url, val))

    # 4. Standard src
    src = (img.get("src") or "").strip()
    if src and not src.startswith("data:"):
        _add(urljoin(base_url, src))

    return urls


def _parse_srcset_largest(srcset: str, base_url: str) -> tuple[str | None, int]:
    """Parse a srcset attribute and return (url, width) of the largest entry.

    Supports: "img.jpg 400w, img-large.jpg 1200w" and "img.jpg 1x, img@2x.jpg 2x".
    """
    entries = SRCSET_ENTRY_RE.findall(srcset)
    if entries:
        # [(url, size_str), ...] — pick largest
        best_url = None
        best_size = 0
        for url_part, size_str in entries:
            try:
                size = int(size_str)
            except ValueError:
                continue
            if size > best_size:
                best_size = size
                best_url = urljoin(base_url, url_part.strip())
        return best_url, best_size

    # Fallback: no size descriptors, take the first non-empty entry
    parts = [p.strip().split()[0] for p in srcset.split(",") if p.strip()]
    if parts:
        return urljoin(base_url, parts[0]), 0

    return None, 0


# ---------------------------------------------------------------------------
# Grounded source URL filtering
# ---------------------------------------------------------------------------


def _filter_relevant_source_urls(
    urls: list[str],
    person_name: str,
    firm_name: str,
    other_names: list[str] | None,
) -> list[str]:
    """Filter grounded source URLs to only keep likely-relevant pages.

    Relevance heuristics:
    - URL path contains person name parts or firm name parts
    - URL path contains team/about/leadership keywords
    - Domain is not an irrelevant generic site
    """
    name_lower = person_name.lower().strip()
    firm_lower = firm_name.lower().strip()
    name_parts = [p for p in name_lower.split() if len(p) > 2]
    firm_parts = [p for p in firm_lower.split() if len(p) > 3]

    # Include aliases
    alias_parts: list[str] = []
    for alias in other_names or []:
        alias_parts.extend(p.lower() for p in alias.split() if len(p) > 2)

    all_name_parts = list(set(name_parts + alias_parts))

    relevant: list[str] = []
    seen: set[str] = set()

    for url in urls:
        if not isinstance(url, str) or not _is_https_url(url):
            continue

        canonical = _canonicalize_url(url)
        if canonical in seen:
            continue
        seen.add(canonical)

        parsed = urlparse(url)
        domain = (parsed.netloc or "").lower()
        path = (parsed.path or "").lower()
        full = f"{domain}{path}"

        # Skip irrelevant domains
        if any(d in domain for d in IRRELEVANT_DOMAIN_PATTERNS):
            continue

        # Score relevance
        is_relevant = False

        # Person name in URL
        if all_name_parts and any(part in full for part in all_name_parts):
            is_relevant = True

        # Firm name in URL
        if firm_parts and any(part in full for part in firm_parts):
            is_relevant = True

        # Team/about/leadership keywords in path
        if any(kw in path for kw in TEAM_PAGE_SEGMENTS):
            is_relevant = True

        # FINRA/SEC regulatory pages
        if "finra.org" in domain or "sec.gov" in domain or "brokercheck" in full:
            is_relevant = True

        # LinkedIn profiles
        if "linkedin.com" in domain and "/in/" in path:
            is_relevant = True

        if is_relevant:
            relevant.append(url)

    return relevant


# ---------------------------------------------------------------------------
# Scoring and helpers
# ---------------------------------------------------------------------------


def _find_team_page_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Find links to team/about pages from the navigation. Returns up to 3."""
    found: list[str] = []
    seen: set[str] = set()

    for a_tag in soup.find_all("a", href=True):
        href = (a_tag.get("href") or "").strip()
        if not href or href == "#":
            continue

        link_text = (a_tag.get_text() or "").strip().lower()
        href_lower = href.lower()

        for segment in TEAM_PAGE_SEGMENTS:
            if segment in link_text or segment in href_lower:
                full_url = urljoin(base_url, href)
                if _is_https_url(full_url):
                    key = _canonicalize_url(full_url)
                    if key not in seen:
                        found.append(full_url)
                        seen.add(key)
                break

        if len(found) >= 3:
            break

    return found


def _normalize_url(url: str | None) -> str | None:
    if not isinstance(url, str):
        return None
    normalized = url.strip()
    if not normalized or not _is_https_url(normalized):
        return None
    return normalized


def _normalize_platform(platform: str | None, source_page_url: str) -> str:
    normalized = (platform or "").strip().lower()
    if normalized in {"linkedin", "twitter", "x", "website", "news", "other"}:
        return "twitter" if normalized == "x" else normalized
    return _infer_platform_from_url(source_page_url)


def _infer_platform_from_url(url: str) -> str:
    url_lower = url.lower()
    if "linkedin.com" in url_lower or "licdn.com" in url_lower:
        return "linkedin"
    if "twitter.com" in url_lower or "x.com" in url_lower or "twimg.com" in url_lower:
        return "twitter"
    if "finra.org" in url_lower or "brokercheck" in url_lower:
        return "finra"
    return "website"


def _canonicalize_url(url: str) -> str:
    return url.rstrip("/")


def _looks_like_homepage(url: str) -> bool:
    parsed = urlparse(url)
    path = (parsed.path or "").strip("/")
    return not path


def _score_image_for_person(
    element: Tag | None,
    img_url: str,
    alt_text: str,
    person_name: str,
) -> int:
    """Score an image on how likely it is a person's headshot. Returns 0-100."""
    score = 40  # base score

    name_lower = person_name.lower().strip()
    name_parts = [p for p in name_lower.split() if len(p) > 2]
    url_lower = img_url.lower()

    # Name match in alt text (strong signal)
    if name_lower and name_lower in alt_text:
        score += 30
    elif name_parts and any(part in alt_text for part in name_parts):
        score += 20

    # Name match in URL
    if name_parts and any(part in url_lower for part in name_parts):
        score += 10

    # Headshot keywords in URL or alt
    combined = f"{url_lower} {alt_text}"
    if any(kw in combined for kw in HEADSHOT_INDICATORS):
        score += 10

    # Parent element contains person name
    if element is not None:
        parent = element.parent if hasattr(element, "parent") else None
        if parent and name_parts:
            parent_text = (parent.get_text() or "").lower()
            if any(part in parent_text for part in name_parts):
                score += 15

        # Image dimensions from attributes
        width = _parse_dimension(element.get("width") if hasattr(element, "get") else None)
        height = _parse_dimension(element.get("height") if hasattr(element, "get") else None)
        if width and height:
            if width >= 150 and height >= 150:
                score += 5
            ratio = max(width, height) / max(min(width, height), 1)
            if ratio <= 1.5:
                score += 5

    return min(score, 100)


def _is_excluded_image(url: str) -> bool:
    """Check if a URL matches common non-person image patterns."""
    url_lower = url.lower()
    return any(pattern in url_lower for pattern in EXCLUDE_PATTERNS)


def _is_tiny_asset(url: str) -> bool:
    """Check if a URL is likely a tiny favicon/icon that should be skipped."""
    url_lower = url.lower()
    return any(pattern in url_lower for pattern in TINY_ASSET_PATTERNS)


def _is_https_url(value: str) -> bool:
    """Check if a string is a valid HTTPS URL."""
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return parsed.scheme == "https" and bool(parsed.netloc)


def _parse_dimension(value: object) -> int | None:
    """Parse a width/height attribute to an integer."""
    if value is None:
        return None
    try:
        return int(str(value).replace("px", "").strip())
    except (ValueError, TypeError):
        return None


def _scraped_to_model_candidates(
    scraped: list[ScrapedCandidate],
) -> list[ImageCandidate]:
    """Convert ScrapedCandidate objects to ImageCandidate model objects.

    Deduplicates by image URL, keeping highest confidence. Sorts descending.
    """
    best: dict[str, ScrapedCandidate] = {}
    for sc in scraped:
        existing = best.get(sc.image_url)
        if existing is None or sc.confidence > existing.confidence:
            best[sc.image_url] = sc

    sorted_candidates = sorted(best.values(), key=lambda c: -c.confidence)

    return [
        ImageCandidate(
            imageUrl=sc.image_url,
            sourcePageUrl=sc.source_page_url,
            platform=sc.platform,
            candidateType=sc.candidate_type,
            confidence=sc.confidence,
        )
        for sc in sorted_candidates
    ]
