#!/bin/bash
# NDA Notification Function Test Script
# Tests the nda-signed-notification Supabase Edge Function

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing NDA Signed Notification Function${NC}"
echo "================================================"

# Supabase project settings
SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/nda-signed-notification"

SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}❌ Set SUPABASE_URL/SUPABASE_ANON_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY before running this script.${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Test 1: OPTIONS Preflight Request${NC}"
echo "-----------------------------------"
PREFLIGHT_RESPONSE=$(curl -s -X OPTIONS "$FUNCTION_URL" \
  -H "Origin: https://hushh.ai" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  -w "\n%{http_code}" 2>&1)

PREFLIGHT_CODE=$(echo "$PREFLIGHT_RESPONSE" | tail -1)
if [ "$PREFLIGHT_CODE" = "200" ]; then
  echo -e "${GREEN}✅ CORS Preflight: PASSED (Status: $PREFLIGHT_CODE)${NC}"
else
  echo -e "${RED}❌ CORS Preflight: FAILED (Status: $PREFLIGHT_CODE)${NC}"
fi

echo ""
echo -e "${YELLOW}Test 2: Missing Required Fields${NC}"
echo "--------------------------------"
MISSING_FIELDS_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"ndaVersion": "v1.0"}' \
  -w "\n%{http_code}" 2>&1)

MISSING_CODE=$(echo "$MISSING_FIELDS_RESPONSE" | tail -1)
MISSING_BODY=$(echo "$MISSING_FIELDS_RESPONSE" | head -n -1)
if [ "$MISSING_CODE" = "400" ]; then
  echo -e "${GREEN}✅ Missing Fields Validation: PASSED (Status: $MISSING_CODE)${NC}"
  echo "   Response: $MISSING_BODY"
else
  echo -e "${RED}❌ Missing Fields Validation: FAILED (Status: $MISSING_CODE)${NC}"
  echo "   Response: $MISSING_BODY"
fi

echo ""
echo -e "${YELLOW}Test 3: Valid NDA Notification (Sends Real Email!)${NC}"
echo "---------------------------------------------------"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VALID_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"signerName\": \"Test User - Automated Test\",
    \"signerEmail\": \"test@hushh.ai\",
    \"signedAt\": \"$TIMESTAMP\",
    \"ndaVersion\": \"v1.0-test\",
    \"signerIp\": \"127.0.0.1\",
    \"userId\": \"test-user-$(date +%s)\"
  }" \
  -w "\n%{http_code}" 2>&1)

VALID_CODE=$(echo "$VALID_RESPONSE" | tail -1)
VALID_BODY=$(echo "$VALID_RESPONSE" | head -n -1)
if [ "$VALID_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Valid Notification: PASSED (Status: $VALID_CODE)${NC}"
  echo "   Response: $VALID_BODY"
  echo ""
  echo -e "${GREEN}📧 Email should be sent to manish@hushh.ai and ankit@hushh.ai${NC}"
else
  echo -e "${RED}❌ Valid Notification: FAILED (Status: $VALID_CODE)${NC}"
  echo "   Response: $VALID_BODY"
fi

echo ""
echo -e "${YELLOW}Test 4: Notification with PDF URL${NC}"
echo "----------------------------------"
TIMESTAMP2=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PDF_URL_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"signerName\": \"PDF Test User\",
    \"signerEmail\": \"pdftest@hushh.ai\",
    \"signedAt\": \"$TIMESTAMP2\",
    \"ndaVersion\": \"v1.0\",
    \"pdfUrl\": \"https://hushh.ai/sample-nda.pdf\",
    \"userId\": \"pdf-test-$(date +%s)\"
  }" \
  -w "\n%{http_code}" 2>&1)

PDF_CODE=$(echo "$PDF_URL_RESPONSE" | tail -1)
PDF_BODY=$(echo "$PDF_URL_RESPONSE" | head -n -1)
if [ "$PDF_CODE" = "200" ]; then
  echo -e "${GREEN}✅ PDF URL Notification: PASSED (Status: $PDF_CODE)${NC}"
  echo "   Response: $PDF_BODY"
else
  echo -e "${RED}❌ PDF URL Notification: FAILED (Status: $PDF_CODE)${NC}"
  echo "   Response: $PDF_BODY"
fi

echo ""
echo "================================================"
echo -e "${YELLOW}📊 Test Summary${NC}"
echo "================================================"
echo "Function URL: $FUNCTION_URL"
echo "Tests completed at: $(date)"
echo ""
echo "Note: Tests 3 & 4 send real emails to manish@hushh.ai and ankit@hushh.ai"
echo "Check their inboxes to verify email delivery."
