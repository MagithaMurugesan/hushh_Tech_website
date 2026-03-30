from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
from threading import Lock
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request

from .models import HealthResponse, PublicProfileDossier
from .service import (
    DEFAULT_RIA_FALLBACK_MODEL,
    DEFAULT_RIA_PRIMARY_MODEL,
    InvalidQueryError,
    RIAIntelligenceService,
    RIAUpstreamError,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app(service: RIAIntelligenceService | None = None) -> FastAPI:
    configured_primary = service.primary_model if service else os.getenv("RIA_PRIMARY_MODEL", DEFAULT_RIA_PRIMARY_MODEL)
    configured_fallback = service.fallback_model if service else os.getenv("RIA_FALLBACK_MODEL", DEFAULT_RIA_FALLBACK_MODEL)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.service_ready = False
        app.state.startup_init_ms = None
        app.state.instance_first_request_pending = True
        app.state.instance_first_request_lock = Lock()

        startup_started_at = perf_counter()
        try:
            initialized_service = service or RIAIntelligenceService()
            startup_init_ms = round((perf_counter() - startup_started_at) * 1000, 2)
            app.state.ria_service = initialized_service
            app.state.service_ready = True
            app.state.startup_init_ms = startup_init_ms
            logger.info(
                "RIA service startup complete service=%s primary_model=%s fallback_model=%s startup_init_ms=%.2f service_initialized=true",
                "hushh-ria-intelligence-api",
                initialized_service.primary_model,
                initialized_service.fallback_model,
                startup_init_ms,
            )
            yield
        except Exception:  # noqa: BLE001 - startup failure should fail the instance
            startup_init_ms = round((perf_counter() - startup_started_at) * 1000, 2)
            logger.exception(
                "RIA service startup failed service=%s primary_model=%s fallback_model=%s startup_init_ms=%.2f service_initialized=false",
                "hushh-ria-intelligence-api",
                configured_primary,
                configured_fallback,
                startup_init_ms,
            )
            raise
        finally:
            app.state.service_ready = False

    app = FastAPI(
        title="Hushh RIA Intelligence API",
        version="1.0.0",
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def log_request_lifecycle(request: Request, call_next):
        request_started_at = perf_counter()
        with request.app.state.instance_first_request_lock:
            instance_first_request = request.app.state.instance_first_request_pending
            if request.app.state.instance_first_request_pending:
                request.app.state.instance_first_request_pending = False

        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001 - preserve framework error handling
            duration_ms = round((perf_counter() - request_started_at) * 1000, 2)
            logger.exception(
                "Request failed method=%s path=%s duration_ms=%.2f instance_first_request=%s",
                request.method,
                request.url.path,
                duration_ms,
                instance_first_request,
            )
            raise

        duration_ms = round((perf_counter() - request_started_at) * 1000, 2)
        logger.info(
            "Request completed method=%s path=%s status_code=%s duration_ms=%.2f instance_first_request=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            instance_first_request,
        )
        return response

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "service": "hushh-ria-intelligence-api",
            "status": "ok",
        }

    # Cloud Run can conflict with some `*z` URL paths, so `/health` is the
    # stable public health endpoint and `/healthz` stays as a compatibility alias.
    @app.get("/health", response_model=HealthResponse)
    @app.get("/health/", response_model=HealthResponse, include_in_schema=False)
    @app.get("/healthz", response_model=HealthResponse, include_in_schema=False)
    @app.get("/healthz/", response_model=HealthResponse, include_in_schema=False)
    async def health(request: Request) -> HealthResponse:
        ria_service = _require_service(request)
        return HealthResponse(
            status="ok",
            service="hushh-ria-intelligence-api",
            primaryModel=ria_service.primary_model,
            fallbackModel=ria_service.fallback_model,
        )

    @app.post("/v1/ria/profile", response_model=PublicProfileDossier)
    def generate_ria_profile(payload: dict, request: Request) -> PublicProfileDossier:
        try:
            return _require_service(request).get_ria_profile(payload)
        except InvalidQueryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RIAUpstreamError as exc:
            logger.warning("Upstream Phase 1 failure: %s", exc)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001 - convert to API-safe response
            logger.exception("Unexpected error while generating RIA profile")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    return app


def _require_service(request: Request) -> RIAIntelligenceService:
    ria_service = getattr(request.app.state, "ria_service", None)
    service_ready = bool(getattr(request.app.state, "service_ready", False))
    if ria_service is None or not service_ready:
        raise HTTPException(status_code=503, detail="Service is still initializing")
    return ria_service


app = create_app()
