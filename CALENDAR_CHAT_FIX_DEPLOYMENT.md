# Calendar Chat Fix - Deployment Guide

## Bug Fixed
**Issue**: Chat interface wasn't sending calendar invites even though curl API test worked.

**Root Cause**: The organizerEmail logic used `userId?.includes('@')` which accepted any email domain. But the Service Account with Domain-Wide Delegation can ONLY impersonate @hushh.ai domain users. When users logged in with gmail.com accounts (like `ankitkumarsingh97593@gmail.com`), the calendar creation failed silently.

**Fix Applied**: Changed to `userId?.endsWith('@hushh.ai')` with fallback to `ankit@hushh.ai`

## Status
- ✅ Fix committed: `ae2a200`
- ✅ Pushed to GitHub main branch
- ⏳ **PENDING: Deploy edge function**

## Deploy the Edge Function

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/jzlqypqhtrsedupaefap/functions
2. Find `hushh-ai-chat` function
3. Click "Deploy new version"
4. Upload `supabase/functions/hushh-ai-chat/` folder

### Option 2: CLI with Fresh Token
1. Generate a new access token at https://supabase.com/dashboard/account/tokens
2. Run:
```bash
SUPABASE_ACCESS_TOKEN=<your-new-token> npx supabase functions deploy hushh-ai-chat --project-ref jzlqypqhtrsedupaefap
```

### Option 3: Terminal Login
Open a terminal and run:
```bash
npx supabase login
npx supabase functions deploy hushh-ai-chat --project-ref jzlqypqhtrsedupaefap
```

## Test After Deployment
1. Go to https://hushh.ai/hushh-ai or the chat interface
2. Login with your gmail account
3. Ask: "Schedule a meeting with test@example.com tomorrow at 3pm"
4. Verify email invite is received at ankit@hushh.ai

## Technical Details
File: `supabase/functions/hushh-ai-chat/index.ts`

Before:
```javascript
const organizerEmail = userId?.includes('@') ? userId : 'ankit@hushh.ai';
```

After:
```javascript
const organizerEmail = userId?.endsWith('@hushh.ai') ? userId : 'ankit@hushh.ai';
```

This ensures only @hushh.ai domain users are used as organizers (required for Domain-Wide Delegation).
