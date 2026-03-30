from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DisclosureSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int | None = None
    regulatoryEvent: int | None = None
    arbitration: int | None = None


class DirectOwnerExecutiveOfficer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    position: str | None = None
    crdNumber: str | None = None


class PreviousFirm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    crdNumber: str | None = None


class ImageCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    imageUrl: str | None = None
    sourcePageUrl: str | None = None
    platform: str | None = None
    candidateType: Literal["headshot", "logo"] | None = None
    confidence: int | None = None


class SocialProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: str
    url: str

    @field_validator("platform", "url")
    @classmethod
    def strip_required_value(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("social profile fields must not be blank")
        return normalized


class SeedProfileRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: "RIAProfile"


class RIAProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    existsOnFinra: bool = False
    imageUrl: str | None = None
    crdNumber: str | None = None
    secNumber: str | None = None
    fullName: str | None = None
    otherNames: list[str] | None = None
    currentFirm: str | None = None
    location: str | None = None
    mainAddress: str | None = None
    mailingAddress: str | None = None
    phone: str | None = None
    establishedIn: str | None = None
    companyType: str | None = None
    fiscalYearEnd: str | None = None
    regulatedBy: str | None = None
    yearsOfExperience: int | None = None
    linkedinUrl: str | None = None
    twitterUrl: str | None = None
    facebookUrl: str | None = None
    websiteUrl: str | None = None
    bio: str | None = None
    examsPassed: list[str] | None = None
    stateLicenses: list[str] | None = None
    otherRegistrations: list[str] | None = None
    disclosures: DisclosureSummary | None = None
    directOwnersAndExecutiveOfficers: list[DirectOwnerExecutiveOfficer] | None = None
    previousFirms: list[PreviousFirm] | None = None
    education: list[str] | None = None
    languagesSpoken: list[str] | None = None
    servicesOffered: list[str] | None = None
    certifications: list[str] | None = None
    aum: str | None = None
    numberOfAccounts: int | None = None
    numberOfEmployees: int | None = None
    feeStructure: list[str] | None = None
    accountMinimum: str | None = None
    custodians: list[str] | None = None
    investmentPhilosophy: str | None = None
    clientTypes: list[str] | None = None
    compensationArrangements: list[str] | None = None
    affiliations: list[str] | None = None
    awardsAndRecognitions: list[str] | None = None
    specialties: list[str] | None = None
    publicationsAndMedia: list[str] | None = None
    reasonIfNotExists: str | None = None


class GeminiEnrichment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    linkedinUrl: str | None = None
    twitterUrl: str | None = None
    imageUrl: str | None = None
    summary: str | None = None
    fullBio: str | None = None
    socialProfiles: list[SocialProfile] = Field(default_factory=list)

    def to_profile_updates(self) -> dict[str, Any]:
        updates: dict[str, Any] = {}
        if self.linkedinUrl:
            updates["linkedinUrl"] = self.linkedinUrl
        if self.twitterUrl:
            updates["twitterUrl"] = self.twitterUrl

        lower_socials = {
            profile.platform.strip().lower(): profile.url
            for profile in self.socialProfiles
            if profile.platform and profile.url
        }
        if "linkedin" in lower_socials and "linkedinUrl" not in updates:
            updates["linkedinUrl"] = lower_socials["linkedin"]
        if "twitter" in lower_socials and "twitterUrl" not in updates:
            updates["twitterUrl"] = lower_socials["twitter"]
        if "x" in lower_socials and "twitterUrl" not in updates:
            updates["twitterUrl"] = lower_socials["x"]
        if "facebook" in lower_socials:
            updates["facebookUrl"] = lower_socials["facebook"]
        return updates


class ImageDiscoveryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    imageCandidates: list[ImageCandidate] = Field(default_factory=list)


class GroundingSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    uri: str


class PipelineStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    finra: Literal["verified", "not_found", "failed"]
    web: Literal["completed", "skipped", "failed"]


class ModelUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    primary: str
    used: str
    fallbackUsed: bool


class RIAProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1)

    @field_validator("query")
    @classmethod
    def strip_query(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("query must not be blank")
        return normalized


class RIAProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    profile: RIAProfile
    enriched: GeminiEnrichment = Field(default_factory=GeminiEnrichment)
    pipeline: PipelineStatus
    model: ModelUsage
    sources: list[GroundingSource] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]
    service: str
    primaryModel: str
    fallbackModel: str


class DossierSubject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str
    crd_number: str | None = None
    current_firm: str | None = None
    location: str | None = None


class DossierVerifiedProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: str
    label: str
    url: str
    handle: str | None = None
    source_title: str
    source_url: str
    evidence_note: str


class DossierPublicImage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    image_url: str
    source_page_url: str
    source_title: str
    confidence_note: str


class DossierKeyFact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fact: str
    source_title: str
    source_url: str
    evidence_note: str


class PublicProfileDossier(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: DossierSubject
    executive_summary: str
    verified_profiles: list[DossierVerifiedProfile] = Field(default_factory=list)
    public_images: list[DossierPublicImage] = Field(default_factory=list)
    key_facts: list[DossierKeyFact] = Field(default_factory=list)
    unverified_or_not_found: list[str] = Field(default_factory=list)
    prompts_used: list[str] = Field(default_factory=list)


class RankedImagesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    public_images: list[DossierPublicImage] = Field(default_factory=list)


SeedProfileRequest.model_rebuild()


def _scalar_schema(kind: str, *, nullable: bool = True) -> dict[str, Any]:
    schema: dict[str, Any] = {"type": kind}
    if nullable:
        schema["nullable"] = True
    return schema


def _array_schema(items: dict[str, Any], *, nullable: bool = True) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "type": "ARRAY",
        "items": items,
    }
    if nullable:
        schema["nullable"] = True
    return schema


def _object_schema(
    properties: dict[str, Any],
    *,
    required: list[str] | None = None,
    nullable: bool = True,
) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "type": "OBJECT",
        "properties": properties,
        "propertyOrdering": list(properties.keys()),
    }
    if required:
        schema["required"] = required
    if nullable:
        schema["nullable"] = True
    return schema


def get_stage1_response_schema() -> dict[str, Any]:
    disclosures = _object_schema(
        {
            "total": _scalar_schema("INTEGER"),
            "regulatoryEvent": _scalar_schema("INTEGER"),
            "arbitration": _scalar_schema("INTEGER"),
        }
    )
    owner_officer = _object_schema(
        {
            "name": _scalar_schema("STRING"),
            "position": _scalar_schema("STRING"),
            "crdNumber": _scalar_schema("STRING"),
        },
        required=["name", "position", "crdNumber"],
        nullable=False,
    )
    previous_firm = _object_schema(
        {
            "name": _scalar_schema("STRING"),
            "crdNumber": _scalar_schema("STRING"),
        },
        required=["name", "crdNumber"],
        nullable=False,
    )

    return _object_schema(
        {
            "existsOnFinra": _scalar_schema("BOOLEAN", nullable=False),
            "crdNumber": _scalar_schema("STRING"),
            "secNumber": _scalar_schema("STRING"),
            "fullName": _scalar_schema("STRING"),
            "otherNames": _array_schema(_scalar_schema("STRING", nullable=False)),
            "currentFirm": _scalar_schema("STRING"),
            "location": _scalar_schema("STRING"),
            "mainAddress": _scalar_schema("STRING"),
            "mailingAddress": _scalar_schema("STRING"),
            "phone": _scalar_schema("STRING"),
            "establishedIn": _scalar_schema("STRING"),
            "companyType": _scalar_schema("STRING"),
            "fiscalYearEnd": _scalar_schema("STRING"),
            "regulatedBy": _scalar_schema("STRING"),
            "yearsOfExperience": _scalar_schema("INTEGER"),
            "examsPassed": _array_schema(_scalar_schema("STRING", nullable=False)),
            "stateLicenses": _array_schema(_scalar_schema("STRING", nullable=False)),
            "otherRegistrations": _array_schema(_scalar_schema("STRING", nullable=False)),
            "disclosures": disclosures,
            "directOwnersAndExecutiveOfficers": _array_schema(owner_officer),
            "previousFirms": _array_schema(previous_firm),
            "reasonIfNotExists": _scalar_schema("STRING"),
        },
        required=["existsOnFinra"],
        nullable=False,
    )


def get_stage2_response_schema() -> dict[str, Any]:
    social_profile = _object_schema(
        {
            "platform": _scalar_schema("STRING", nullable=False),
            "url": _scalar_schema("STRING", nullable=False),
        },
        required=["platform", "url"],
        nullable=False,
    )
    return _object_schema(
        {
            "linkedinUrl": _scalar_schema("STRING"),
            "twitterUrl": _scalar_schema("STRING"),
            "imageUrl": _scalar_schema("STRING"),
            "summary": _scalar_schema("STRING"),
            "fullBio": _scalar_schema("STRING"),
            "socialProfiles": _array_schema(social_profile),
        },
        nullable=False,
    )


def get_dossier_response_schema() -> dict[str, Any]:
    verified_profile = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "platform": {"type": "string"},
            "label": {"type": "string"},
            "url": {"type": "string"},
            "handle": {"type": ["string", "null"]},
            "source_title": {"type": "string"},
            "source_url": {"type": "string"},
            "evidence_note": {"type": "string"},
        },
        "required": [
            "platform",
            "label",
            "url",
            "handle",
            "source_title",
            "source_url",
            "evidence_note",
        ],
    }
    public_image = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "kind": {"type": "string"},
            "image_url": {"type": "string"},
            "source_page_url": {"type": "string"},
            "source_title": {"type": "string"},
            "confidence_note": {"type": "string"},
        },
        "required": [
            "kind",
            "image_url",
            "source_page_url",
            "source_title",
            "confidence_note",
        ],
    }
    key_fact = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "fact": {"type": "string"},
            "source_title": {"type": "string"},
            "source_url": {"type": "string"},
            "evidence_note": {"type": "string"},
        },
        "required": ["fact", "source_title", "source_url", "evidence_note"],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "subject": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "full_name": {"type": "string"},
                    "crd_number": {"type": ["string", "null"]},
                    "current_firm": {"type": ["string", "null"]},
                    "location": {"type": ["string", "null"]},
                },
                "required": ["full_name", "crd_number", "current_firm", "location"],
            },
            "executive_summary": {"type": "string"},
            "verified_profiles": {"type": "array", "items": verified_profile},
            "public_images": {"type": "array", "items": public_image},
            "key_facts": {"type": "array", "items": key_fact},
            "unverified_or_not_found": {"type": "array", "items": {"type": "string"}},
            "prompts_used": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "subject",
            "executive_summary",
            "verified_profiles",
            "public_images",
            "key_facts",
            "unverified_or_not_found",
            "prompts_used",
        ],
    }


def get_ranked_images_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "public_images": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "kind": {"type": "string"},
                        "image_url": {"type": "string"},
                        "source_page_url": {"type": "string"},
                        "source_title": {"type": "string"},
                        "confidence_note": {"type": "string"},
                    },
                    "required": [
                        "kind",
                        "image_url",
                        "source_page_url",
                        "source_title",
                        "confidence_note",
                    ],
                },
            }
        },
        "required": ["public_images"],
    }
