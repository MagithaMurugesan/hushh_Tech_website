"""Tests for the upgraded image scraper with rich extraction methods."""

from __future__ import annotations

import json
import unittest

import httpx
from bs4 import BeautifulSoup

from app.image_scraper import (
    ImageScraper,
    _extract_best_logo,
    _extract_css_background_images,
    _extract_json_ld_images,
    _extract_og_image,
    _extract_picture_sources,
    _extract_twitter_image,
    _filter_relevant_source_urls,
    _is_tiny_asset,
    _parse_srcset_largest,
    _resolve_img_urls,
)
from app.models import ImageCandidate, RIAProfile


def _make_profile(**overrides) -> RIAProfile:
    defaults = {
        "existsOnFinra": True,
        "crdNumber": "12345",
        "fullName": "Jane Doe",
        "currentFirm": "Northstar Advisors",
        "location": "Tampa, Florida",
    }
    defaults.update(overrides)
    return RIAProfile.model_validate(defaults)


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


class SrcsetTests(unittest.TestCase):
    """Tests for srcset parsing — should choose the largest valid asset."""

    def test_srcset_chooses_largest_width_descriptor(self):
        url, width = _parse_srcset_largest(
            "https://example.com/small.jpg 400w, https://example.com/large.jpg 1200w",
            "https://example.com",
        )
        self.assertEqual(url, "https://example.com/large.jpg")
        self.assertEqual(width, 1200)

    def test_srcset_with_three_entries(self):
        url, width = _parse_srcset_largest(
            "thumb.jpg 200w, medium.jpg 600w, full.jpg 1800w",
            "https://example.com/",
        )
        self.assertEqual(url, "https://example.com/full.jpg")
        self.assertEqual(width, 1800)

    def test_srcset_with_x_descriptors(self):
        url, width = _parse_srcset_largest(
            "photo.jpg 1x, photo@2x.jpg 2x",
            "https://example.com/",
        )
        self.assertEqual(url, "https://example.com/photo@2x.jpg")
        self.assertEqual(width, 2)

    def test_srcset_no_descriptors_fallback(self):
        url, width = _parse_srcset_largest(
            "https://example.com/only.jpg",
            "https://example.com",
        )
        self.assertEqual(url, "https://example.com/only.jpg")
        self.assertEqual(width, 0)

    def test_srcset_empty(self):
        url, width = _parse_srcset_largest("", "https://example.com")
        self.assertIsNone(url)
        self.assertEqual(width, 0)


class ImgUrlResolutionTests(unittest.TestCase):
    """Tests for _resolve_img_urls — srcset, data-src, data-lazy-src, standard src."""

    def test_data_src_extracted(self):
        html = '<img data-src="https://example.com/lazy-photo.jpg" src="data:image/gif;base64,R0lGOD">'
        soup = _soup(html)
        img = soup.find("img")
        urls = _resolve_img_urls(img, "https://example.com")
        self.assertIn("https://example.com/lazy-photo.jpg", urls)
        # data: URLs should be excluded
        self.assertTrue(all(not u.startswith("data:") for u in urls))

    def test_data_lazy_src_extracted(self):
        html = '<img data-lazy-src="https://example.com/lazy.jpg" src="placeholder.png">'
        soup = _soup(html)
        img = soup.find("img")
        urls = _resolve_img_urls(img, "https://example.com")
        self.assertIn("https://example.com/lazy.jpg", urls)

    def test_srcset_img_tag(self):
        html = '<img srcset="https://example.com/sm.jpg 400w, https://example.com/lg.jpg 1200w" src="https://example.com/sm.jpg">'
        soup = _soup(html)
        img = soup.find("img")
        urls = _resolve_img_urls(img, "https://example.com")
        # Should pick the largest from srcset
        self.assertIn("https://example.com/lg.jpg", urls)

    def test_data_srcset_extracted(self):
        html = '<img data-srcset="https://example.com/a.jpg 800w, https://example.com/b.jpg 1600w">'
        soup = _soup(html)
        img = soup.find("img")
        urls = _resolve_img_urls(img, "https://example.com")
        self.assertIn("https://example.com/b.jpg", urls)

    def test_relative_src_resolved(self):
        html = '<img src="/images/photo.jpg">'
        soup = _soup(html)
        img = soup.find("img")
        urls = _resolve_img_urls(img, "https://example.com")
        self.assertIn("https://example.com/images/photo.jpg", urls)


class PictureSourceTests(unittest.TestCase):
    """Tests for <picture><source> extraction."""

    def test_picture_source_picks_largest(self):
        html = """
        <picture>
            <source srcset="https://example.com/small.webp 400w, https://example.com/large.webp 1200w" type="image/webp">
            <img src="https://example.com/fallback.jpg" alt="Jane Doe">
        </picture>
        """
        soup = _soup(html)
        candidates = _extract_picture_sources(soup, "https://example.com", "website", "Jane Doe")
        self.assertTrue(len(candidates) >= 1)
        self.assertEqual(candidates[0].image_url, "https://example.com/large.webp")

    def test_picture_fallback_to_img(self):
        html = """
        <picture>
            <img src="https://example.com/photo.jpg" alt="Jane Doe team headshot">
        </picture>
        """
        soup = _soup(html)
        candidates = _extract_picture_sources(soup, "https://example.com", "website", "Jane Doe")
        # Should pick the <img> fallback with score >= 55
        urls = [c.image_url for c in candidates]
        self.assertIn("https://example.com/photo.jpg", urls)


class TwitterImageTests(unittest.TestCase):
    """Tests for twitter:image meta extraction."""

    def test_twitter_image_name_attr(self):
        html = '<html><head><meta name="twitter:image" content="https://example.com/tw-photo.jpg"></head></html>'
        soup = _soup(html)
        candidate = _extract_twitter_image(soup, "https://example.com", "website", "Jane Doe")
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.image_url, "https://example.com/tw-photo.jpg")
        self.assertEqual(candidate.candidate_type, "headshot")

    def test_twitter_image_property_attr(self):
        html = '<html><head><meta property="twitter:image" content="https://example.com/tw2.jpg"></head></html>'
        soup = _soup(html)
        candidate = _extract_twitter_image(soup, "https://example.com", "website", "Jane")
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.image_url, "https://example.com/tw2.jpg")

    def test_twitter_image_logo_detection(self):
        html = '<html><head><meta name="twitter:image" content="https://example.com/company-logo.png"></head></html>'
        soup = _soup(html)
        candidate = _extract_twitter_image(soup, "https://example.com", "website", "Jane")
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.candidate_type, "logo")

    def test_no_twitter_image(self):
        html = "<html><head><title>No twitter meta</title></head></html>"
        soup = _soup(html)
        candidate = _extract_twitter_image(soup, "https://example.com", "website", "Jane")
        self.assertIsNone(candidate)


class JsonLdTests(unittest.TestCase):
    """Tests for JSON-LD image extraction."""

    def test_person_json_ld_image(self):
        ld = json.dumps({
            "@type": "Person",
            "name": "Jane Doe",
            "image": "https://example.com/jane-headshot.jpg",
        })
        html = f'<script type="application/ld+json">{ld}</script>'
        soup = _soup(html)
        candidates = _extract_json_ld_images(soup, "https://example.com", "website", "Jane Doe")
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].image_url, "https://example.com/jane-headshot.jpg")
        self.assertEqual(candidates[0].candidate_type, "headshot")

    def test_organization_json_ld_image(self):
        ld = json.dumps({
            "@type": "Organization",
            "name": "Northstar Advisors",
            "image": {"url": "https://example.com/org-logo.png"},
        })
        html = f'<script type="application/ld+json">{ld}</script>'
        soup = _soup(html)
        candidates = _extract_json_ld_images(soup, "https://example.com", "website", "Jane")
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].image_url, "https://example.com/org-logo.png")
        self.assertEqual(candidates[0].candidate_type, "logo")

    def test_json_ld_image_array(self):
        ld = json.dumps({
            "@type": "Person",
            "image": [
                "https://example.com/photo1.jpg",
                "https://example.com/photo2.jpg",
            ],
        })
        html = f'<script type="application/ld+json">{ld}</script>'
        soup = _soup(html)
        candidates = _extract_json_ld_images(soup, "https://example.com", "website", "Jane")
        self.assertEqual(len(candidates), 2)

    def test_invalid_json_ld_skipped(self):
        html = '<script type="application/ld+json">not json at all</script>'
        soup = _soup(html)
        candidates = _extract_json_ld_images(soup, "https://example.com", "website", "Jane")
        self.assertEqual(len(candidates), 0)


class CssBackgroundImageTests(unittest.TestCase):
    """Tests for CSS background-image extraction."""

    def test_background_image_with_name_match(self):
        html = '''
        <div class="team-member" style="background-image: url(https://example.com/jane-headshot.jpg)">
            <h3>Jane Doe</h3>
            <p>Financial Advisor</p>
        </div>
        '''
        soup = _soup(html)
        candidates = _extract_css_background_images(soup, "https://example.com", "website", "Jane Doe")
        self.assertTrue(len(candidates) >= 1)
        self.assertEqual(candidates[0].image_url, "https://example.com/jane-headshot.jpg")
        self.assertEqual(candidates[0].candidate_type, "headshot")
        self.assertGreaterEqual(candidates[0].confidence, 78)

    def test_background_image_with_quotes(self):
        html = '''<div style="background-image: url('https://example.com/bg-photo.jpg')">Content</div>'''
        soup = _soup(html)
        candidates = _extract_css_background_images(soup, "https://example.com", "website", "Someone Else")
        self.assertTrue(len(candidates) >= 1)
        self.assertEqual(candidates[0].image_url, "https://example.com/bg-photo.jpg")

    def test_no_background_image(self):
        html = '<div style="color: red;">No bg image</div>'
        soup = _soup(html)
        candidates = _extract_css_background_images(soup, "https://example.com", "website", "Jane")
        self.assertEqual(len(candidates), 0)


class TinyAssetRejectionTests(unittest.TestCase):
    """Tests for favicon/tiny icon rejection."""

    def test_favicon_is_tiny(self):
        self.assertTrue(_is_tiny_asset("https://example.com/favicon.ico"))
        self.assertTrue(_is_tiny_asset("https://example.com/favicon-32x32.png"))

    def test_apple_touch_icon_is_tiny(self):
        self.assertTrue(_is_tiny_asset("https://example.com/apple-touch-icon.png"))

    def test_small_icons_detected(self):
        self.assertTrue(_is_tiny_asset("https://example.com/icon-16x16.png"))
        self.assertTrue(_is_tiny_asset("https://example.com/assets/icons/check.png"))

    def test_real_images_not_tiny(self):
        self.assertFalse(_is_tiny_asset("https://example.com/team/jane-doe-headshot.jpg"))
        self.assertFalse(_is_tiny_asset("https://example.com/images/company-logo.png"))

    def test_best_logo_skips_favicon_picks_real_logo(self):
        html = """
        <html>
        <head>
            <link rel="shortcut icon" href="https://example.com/favicon.ico">
            <link rel="apple-touch-icon" sizes="180x180" href="https://example.com/apple-touch-icon.png">
        </head>
        <body>
            <img src="https://example.com/images/company-logo-512.png" alt="Company Logo" class="site-logo" width="512" height="128">
        </body>
        </html>
        """
        soup = _soup(html)
        logo = _extract_best_logo(soup, "https://example.com", "Example Corp")
        self.assertIsNotNone(logo)
        # Should pick the large logo, not the favicon/apple-touch-icon
        self.assertEqual(logo.image_url, "https://example.com/images/company-logo-512.png")
        self.assertEqual(logo.candidate_type, "logo")


class GroundedSourceFilterTests(unittest.TestCase):
    """Tests for filtering grounded source URLs for relevance."""

    def test_person_name_in_url_is_relevant(self):
        urls = [
            "https://northstar.example/team/jane-doe",
            "https://unrelated.example/random-page",
        ]
        relevant = _filter_relevant_source_urls(urls, "Jane Doe", "Northstar Advisors", None)
        self.assertIn("https://northstar.example/team/jane-doe", relevant)
        self.assertNotIn("https://unrelated.example/random-page", relevant)

    def test_firm_name_in_url_is_relevant(self):
        urls = ["https://example.com/northstar-advisors-review"]
        relevant = _filter_relevant_source_urls(urls, "Jane Doe", "Northstar Advisors", None)
        self.assertIn("https://example.com/northstar-advisors-review", relevant)

    def test_team_keyword_in_path_is_relevant(self):
        urls = ["https://somefirm.example/about-us"]
        relevant = _filter_relevant_source_urls(urls, "Jane Doe", "Acme", None)
        self.assertIn("https://somefirm.example/about-us", relevant)

    def test_linkedin_profile_is_relevant(self):
        urls = ["https://www.linkedin.com/in/jane-doe-12345"]
        relevant = _filter_relevant_source_urls(urls, "Jane Doe", "Acme", None)
        self.assertIn("https://www.linkedin.com/in/jane-doe-12345", relevant)

    def test_irrelevant_domains_filtered(self):
        urls = [
            "https://en.wikipedia.org/wiki/Financial_advisor",
            "https://www.youtube.com/watch?v=123",
            "https://www.facebook.com/page",
            "https://www.reddit.com/r/investing",
        ]
        relevant = _filter_relevant_source_urls(urls, "Jane Doe", "Acme", None)
        self.assertEqual(len(relevant), 0)

    def test_aliases_considered(self):
        urls = ["https://firm.example/team/jane-smith"]
        relevant = _filter_relevant_source_urls(
            urls, "Jane Doe", "Acme",
            other_names=["Jane Smith", "J. Doe"],
        )
        self.assertIn("https://firm.example/team/jane-smith", relevant)

    def test_finra_and_sec_always_relevant(self):
        urls = [
            "https://brokercheck.finra.org/individual/summary/12345",
            "https://www.sec.gov/cgi-bin/browse-ia?action=getcompany",
        ]
        relevant = _filter_relevant_source_urls(urls, "Nobody", "Nonexistent", None)
        self.assertEqual(len(relevant), 2)

    def test_duplicates_deduped(self):
        urls = [
            "https://example.com/team/jane-doe",
            "https://example.com/team/jane-doe",
            "https://example.com/team/jane-doe/",
        ]
        relevant = _filter_relevant_source_urls(urls, "Jane Doe", "Acme", None)
        # Should have at most 2 (with and without trailing slash)
        self.assertLessEqual(len(relevant), 2)


class OgImageTests(unittest.TestCase):
    """Tests for og:image extraction (backward compat)."""

    def test_og_image_extracted(self):
        html = '<html><head><meta property="og:image" content="https://example.com/og-photo.jpg"></head></html>'
        soup = _soup(html)
        candidate = _extract_og_image(soup, "https://example.com", "website", "Jane")
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.image_url, "https://example.com/og-photo.jpg")

    def test_og_image_logo_detected(self):
        html = '<html><head><meta property="og:image" content="https://example.com/site-logo.png"></head></html>'
        soup = _soup(html)
        candidate = _extract_og_image(soup, "https://example.com", "website", "Jane")
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.candidate_type, "logo")


class IntegrationTests(unittest.TestCase):
    """Integration tests for the full ImageScraper.discover_candidates flow."""

    def test_grounded_sources_are_passed_and_crawled(self):
        """When grounded source URLs are passed, relevant ones are crawled."""
        profile = _make_profile(websiteUrl=None, linkedinUrl=None, twitterUrl=None)

        # Create a mock client that returns a team page with a headshot
        transport = httpx.MockTransport(self._make_team_page_handler("Jane Doe"))
        client = httpx.Client(transport=transport)
        scraper = ImageScraper(client=client)

        candidates = scraper.discover_candidates(
            profile,
            grounded_source_urls=[
                "https://northstar.example/team/jane-doe",
                "https://en.wikipedia.org/wiki/Financial_advisor",  # should be filtered
            ],
        )

        # Should have found candidates from the team page
        urls = [c.imageUrl for c in candidates]
        self.assertTrue(
            any("jane-doe-headshot" in url for url in urls),
            f"Expected headshot URL in {urls}",
        )

    def test_no_candidates_returns_empty(self):
        """When no relevant pages exist, returns empty list."""
        profile = _make_profile(
            websiteUrl=None, linkedinUrl=None, twitterUrl=None, crdNumber=None,
        )
        transport = httpx.MockTransport(lambda req: httpx.Response(404))
        client = httpx.Client(transport=transport)
        scraper = ImageScraper(client=client)

        candidates = scraper.discover_candidates(profile)
        self.assertEqual(len(candidates), 0)

    def _make_team_page_handler(self, person_name: str):
        name_slug = person_name.lower().replace(" ", "-")

        def handler(request: httpx.Request) -> httpx.Response:
            html = f"""
            <html>
            <head>
                <meta property="og:image" content="https://northstar.example/images/{name_slug}-headshot.jpg">
                <meta name="twitter:image" content="https://northstar.example/images/{name_slug}-tw.jpg">
                <script type="application/ld+json">
                {{"@type": "Person", "name": "{person_name}", "image": "https://northstar.example/images/{name_slug}-ld.jpg"}}
                </script>
            </head>
            <body>
                <div class="team-member" style="background-image: url('https://northstar.example/images/{name_slug}-bg.jpg')">
                    <h3>{person_name}</h3>
                </div>
                <img src="https://northstar.example/images/{name_slug}-photo.jpg" alt="{person_name} headshot" width="300" height="300">
            </body>
            </html>
            """
            return httpx.Response(
                200,
                content=html.encode(),
                headers={"Content-Type": "text/html"},
            )

        return handler


if __name__ == "__main__":
    unittest.main()
