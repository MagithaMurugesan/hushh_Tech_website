#!/bin/bash
# Test script for Resume Analysis Agent
# This script tests the complete flow: Edge Function → Gemini AI → Supabase → Email

set -e

echo "🧪 Resume Analysis Agent Test Script"
echo "======================================"
echo ""

# Configuration
SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
ENDPOINT="${SUPABASE_URL}/functions/v1/resume-analysis-agent"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Set SUPABASE_URL/SUPABASE_ANON_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY before running this script."
  exit 1
fi

# Test user info - UPDATE THIS EMAIL TO YOUR EMAIL
TEST_EMAIL="ankit@hushh.ai"
TEST_USER_ID="test-user-$(date +%s)"

echo "📧 Test Email: ${TEST_EMAIL}"
echo "👤 Test User ID: ${TEST_USER_ID}"
echo "🔗 Endpoint: ${ENDPOINT}"
echo ""

# Create a simple text-based resume as base64
# This is a sample resume text that will be analyzed
SAMPLE_RESUME_TEXT="
ANKIT KUMAR SINGH
Software Engineer | Full Stack Developer
ankit@hushh.ai | +91-9876543210 | San Francisco, CA

PROFESSIONAL SUMMARY
Innovative Full Stack Developer with 6+ years of experience building scalable web applications.
Expert in React, Next.js, Node.js, and cloud technologies. Led teams of 5-10 developers.
Delivered projects that increased revenue by 150% and reduced costs by 40%.

EXPERIENCE

Senior Software Engineer | Hushh Labs | 2022 - Present
- Architected and built AI-powered privacy platform serving 50,000+ users
- Reduced API response times by 60% through optimization and caching
- Led implementation of real-time features using WebSockets and Supabase
- Mentored 4 junior developers, improving team velocity by 35%

Software Engineer | Tech Startup Inc | 2019 - 2022
- Developed customer-facing React applications with 99.9% uptime
- Implemented CI/CD pipelines reducing deployment time by 70%
- Built RESTful APIs handling 1M+ requests per day

Junior Developer | WebDev Agency | 2017 - 2019
- Created responsive websites for 25+ clients
- Improved SEO rankings by 200% through optimization

EDUCATION
Bachelor of Technology in Computer Science
Indian Institute of Technology | 2013 - 2017 | GPA: 3.8/4.0

SKILLS
Languages: JavaScript, TypeScript, Python, SQL
Frontend: React, Next.js, Vue.js, Tailwind CSS, Chakra UI
Backend: Node.js, Express, FastAPI, GraphQL
Cloud: AWS, GCP, Supabase, Vercel, Docker, Kubernetes
AI/ML: OpenAI, Gemini, LangChain, Vector Databases

CERTIFICATIONS
- AWS Solutions Architect Professional
- Google Cloud Professional Developer
"

# Convert text to base64
RESUME_BASE64=$(echo -n "${SAMPLE_RESUME_TEXT}" | base64 | tr -d '\n')

echo "📄 Creating test resume (text/plain format)..."
echo "   Size: $(echo -n "${SAMPLE_RESUME_TEXT}" | wc -c) bytes"
echo ""

# Build JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "resumeBase64": "${RESUME_BASE64}",
  "mimeType": "text/plain",
  "userEmail": "${TEST_EMAIL}",
  "userId": "${TEST_USER_ID}",
  "coachId": "victor",
  "fileName": "test-resume.txt"
}
EOF
)

echo "🚀 Calling Resume Analysis Agent Edge Function..."
echo "   This may take 30-60 seconds (AI analysis + email sending)..."
echo ""

# Make the API call
START_TIME=$(date +%s)

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d "${JSON_PAYLOAD}")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Extract HTTP status code (last line) and response body (everything before last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "⏱️  Duration: ${DURATION} seconds"
echo "📊 HTTP Status: ${HTTP_CODE}"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS! Resume Analysis Complete!"
  echo ""
  echo "📋 Response:"
  echo "$BODY" | jq '.'
  echo ""
  
  # Extract key info
  OVERALL_SCORE=$(echo "$BODY" | jq -r '.analysis.scores.overall // "N/A"')
  ATS_SCORE=$(echo "$BODY" | jq -r '.analysis.scores.ats // "N/A"')
  EMAIL_SENT=$(echo "$BODY" | jq -r '.emailSent // false')
  
  echo "📈 Scores:"
  echo "   Overall: ${OVERALL_SCORE}/100"
  echo "   ATS: ${ATS_SCORE}/100"
  echo ""
  
  if [ "$EMAIL_SENT" = "true" ]; then
    echo "✉️  Email sent successfully to ${TEST_EMAIL}!"
    echo "   Check your inbox for the Resume Analysis Report!"
  else
    echo "⚠️  Email was NOT sent (check Edge Function logs for errors)"
  fi
  
else
  echo "❌ FAILED! HTTP ${HTTP_CODE}"
  echo ""
  echo "Error Response:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""
  
  if [ "$HTTP_CODE" = "404" ]; then
    echo "💡 The Edge Function may not be deployed yet."
    echo "   Run: npx supabase functions deploy resume-analysis-agent"
  elif [ "$HTTP_CODE" = "500" ]; then
    echo "💡 Check the Edge Function logs:"
    echo "   npx supabase functions logs resume-analysis-agent"
  fi
fi

echo ""
echo "======================================"
echo "🧪 Test Complete!"
