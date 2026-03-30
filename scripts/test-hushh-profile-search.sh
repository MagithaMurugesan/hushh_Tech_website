#!/bin/bash
# Test script for hushh-profile-search API
# Exact same functionality as the React app

SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
ANON_KEY="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "❌ Set SUPABASE_URL/SUPABASE_ANON_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY before running this script."
  exit 1
fi

echo "🔍 Testing Hushh Profile Search API..."
echo ""

# Test with sample data
curl -X POST "${SUPABASE_URL}/functions/v1/hushh-profile-search" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Elon Musk",
    "email": "elon@tesla.com",
    "country": "United States",
    "contact": "+1234567890"
  }' | jq .

echo ""
echo "✅ Test complete!"
echo ""
echo "API Endpoint: ${SUPABASE_URL}/functions/v1/hushh-profile-search"
echo "Method: POST"
echo "Required fields: name, email"
echo "Optional fields: country, contact"
