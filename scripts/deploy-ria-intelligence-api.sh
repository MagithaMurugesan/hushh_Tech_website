#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="hushh-ria-intelligence-api"
REGION="us-central1"
PROJECT_ID=""
SERVICE_ACCOUNT=""
MEMORY="1Gi"
CPU="1"
MIN_INSTANCES="1"
MAX_INSTANCES="10"
CONCURRENCY="8"
TIMEOUT="600s"
GOOGLE_CLOUD_LOCATION="global"
RIA_PRIMARY_MODEL="gemini-3.1-pro-preview"
RIA_FALLBACK_MODEL="gemini-2.5-pro"
OPENAI_MODEL="gpt-5.4"
OPENAI_IMAGE_RANK_MODEL="gpt-5.4-mini"
OPENAI_TIMEOUT_SECONDS="90"
OPENAI_API_KEY_SECRET=""
SOURCE_DIR="cloud-run/ria-intelligence-api"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --service) SERVICE_NAME="$2"; shift 2 ;;
    --service-account) SERVICE_ACCOUNT="$2"; shift 2 ;;
    --memory) MEMORY="$2"; shift 2 ;;
    --cpu) CPU="$2"; shift 2 ;;
    --min-instances) MIN_INSTANCES="$2"; shift 2 ;;
    --max-instances) MAX_INSTANCES="$2"; shift 2 ;;
    --concurrency) CONCURRENCY="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --google-cloud-location) GOOGLE_CLOUD_LOCATION="$2"; shift 2 ;;
    --ria-primary-model) RIA_PRIMARY_MODEL="$2"; shift 2 ;;
    --ria-fallback-model) RIA_FALLBACK_MODEL="$2"; shift 2 ;;
    --openai-model) OPENAI_MODEL="$2"; shift 2 ;;
    --openai-image-rank-model) OPENAI_IMAGE_RANK_MODEL="$2"; shift 2 ;;
    --openai-timeout-seconds) OPENAI_TIMEOUT_SECONDS="$2"; shift 2 ;;
    --openai-api-key-secret) OPENAI_API_KEY_SECRET="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--project PROJECT_ID] [--region REGION] [--service NAME] [--service-account EMAIL] [--google-cloud-location LOCATION] [--ria-primary-model MODEL] [--ria-fallback-model MODEL] [--openai-api-key-secret SECRET_NAME]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "No GCP project configured. Use --project or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR"
  exit 1
fi

echo "===================================================="
echo "Deploying Hushh RIA Intelligence API"
echo "  Project:             $PROJECT_ID"
echo "  Service:             $SERVICE_NAME"
echo "  Region:              $REGION"
echo "  Source:              $SOURCE_DIR"
echo "  Memory / CPU:        $MEMORY / $CPU"
echo "  Min / Max:           $MIN_INSTANCES / $MAX_INSTANCES"
echo "  Concurrency:         $CONCURRENCY"
echo "  Timeout:             $TIMEOUT"
echo "  GCP location:        $GOOGLE_CLOUD_LOCATION"
echo "  RIA primary model:   $RIA_PRIMARY_MODEL"
echo "  RIA fallback model:  $RIA_FALLBACK_MODEL"
echo "  OpenAI model:        $OPENAI_MODEL"
echo "  Image rank model:    $OPENAI_IMAGE_RANK_MODEL"
echo "  OpenAI timeout:      ${OPENAI_TIMEOUT_SECONDS}s"
if [[ -n "$OPENAI_API_KEY_SECRET" ]]; then
  echo "  OpenAI key secret:   $OPENAI_API_KEY_SECRET"
else
  echo "  OpenAI key secret:   (not set; service will require external env/secret injection)"
fi
if [[ -n "$SERVICE_ACCOUNT" ]]; then
  echo "  Service account:     $SERVICE_ACCOUNT"
else
  echo "  Service account:     (Cloud Run default)"
fi
echo "===================================================="

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$PROJECT_ID" >/dev/null

ENV_VARS="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION},RIA_PRIMARY_MODEL=${RIA_PRIMARY_MODEL},RIA_FALLBACK_MODEL=${RIA_FALLBACK_MODEL},OPENAI_MODEL=${OPENAI_MODEL},OPENAI_IMAGE_RANK_MODEL=${OPENAI_IMAGE_RANK_MODEL},OPENAI_TIMEOUT_SECONDS=${OPENAI_TIMEOUT_SECONDS}"

DEPLOY_ARGS=(
  run deploy "$SERVICE_NAME"
  --source "$SOURCE_DIR"
  --project "$PROJECT_ID"
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --memory "$MEMORY"
  --cpu "$CPU"
  --min-instances "$MIN_INSTANCES"
  --max-instances "$MAX_INSTANCES"
  --concurrency "$CONCURRENCY"
  --cpu-boost
  --timeout "$TIMEOUT"
  --set-env-vars "$ENV_VARS"
  --quiet
)

if [[ -n "$OPENAI_API_KEY_SECRET" ]]; then
  DEPLOY_ARGS+=(--set-secrets "OPENAI_API_KEY=${OPENAI_API_KEY_SECRET}:latest")
fi

if [[ -n "$SERVICE_ACCOUNT" ]]; then
  DEPLOY_ARGS+=(--service-account "$SERVICE_ACCOUNT")
fi

gcloud "${DEPLOY_ARGS[@]}"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

echo ""
echo "Deployment complete"
echo "Service URL: $SERVICE_URL"
echo ""
echo "Recommended setup:"
echo "  Store OPENAI_API_KEY in Secret Manager and deploy with --openai-api-key-secret SECRET_NAME."
echo "  Rotate any previously exposed OpenAI API key before production use."
echo "  This deploy helper keeps 1 warm instance and enables startup CPU boost to reduce cold-start latency."
