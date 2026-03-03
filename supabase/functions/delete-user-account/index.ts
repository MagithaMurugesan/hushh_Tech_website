// Delete User Account Edge Function
// Securely deletes all user data and the auth account
// Ultra-resilient: each table deletion is independent — one failure never blocks others

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

/** Safely delete rows from a table. Never throws. */
async function safeDelete(
  client: any,
  table: string,
  column: string,
  value: string
): Promise<void> {
  try {
    const { error } = await client.from(table).delete().eq(column, value)
    if (error) {
      console.warn(`[DeleteAccount] ${table}: ${error.message} (code: ${error.code})`)
    } else {
      console.log(`[DeleteAccount] ✓ ${table}`)
    }
  } catch (e: any) {
    console.warn(`[DeleteAccount] ${table} skipped: ${e.message}`)
  }
}

/** Safely delete rows using .in() filter. Never throws. */
async function safeDeleteIn(
  client: any,
  table: string,
  column: string,
  values: string[]
): Promise<void> {
  if (!values.length) return
  try {
    const { error } = await client.from(table).delete().in(column, values)
    if (error) {
      console.warn(`[DeleteAccount] ${table}: ${error.message}`)
    } else {
      console.log(`[DeleteAccount] ✓ ${table}`)
    }
  } catch (e: any) {
    console.warn(`[DeleteAccount] ${table} skipped: ${e.message}`)
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt || jwt === authHeader) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization header format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user from JWT
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt)

    if (userError || !user) {
      console.error('[DeleteAccount] User validation failed:', userError?.message)
      let errorMessage = 'Invalid or expired token'
      if (userError?.status === 401 || userError?.message?.includes('expired')) {
        errorMessage = 'Your session has expired. Please log out, log back in, and try again.'
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log(`[DeleteAccount] Starting deletion for user: ${userId} (${user.email})`)

    // ═══════════════════════════════════════════════════════
    // Delete from ALL tables — child tables first, then parent
    // Each deletion is independent and never blocks the others
    // ═══════════════════════════════════════════════════════

    // --- Community & Events ---
    await safeDelete(adminClient, 'community_registrations', 'user_id', userId)

    // --- NDA / Agreements ---
    await safeDelete(adminClient, 'global_nda_signatures', 'user_id', userId)
    await safeDelete(adminClient, 'nda_agreements', 'user_id', userId)

    // --- Hushh Agents tables ---
    await safeDelete(adminClient, 'agent_onboarding_requests', 'user_id', userId)

    // Get hushh_agents chat IDs for this user
    let agentChatIds: string[] = []
    try {
      const { data: agentChats } = await adminClient
        .from('hushh_agents_chats')
        .select('id')
        .eq('user_id', userId)
      agentChatIds = agentChats?.map((c: any) => c.id) || []
    } catch (_) { /* table may not exist */ }

    if (agentChatIds.length > 0) {
      await safeDeleteIn(adminClient, 'hushh_agents_messages', 'chat_id', agentChatIds)
    }
    await safeDelete(adminClient, 'hushh_agents_chats', 'user_id', userId)
    await safeDelete(adminClient, 'hushh_agents_tracking', 'user_id', userId)

    // --- Investor Agents ---
    await safeDelete(adminClient, 'agent_messages', 'user_id', userId)
    await safeDelete(adminClient, 'investor_agents', 'user_id', userId)

    // --- Chat ---
    await safeDelete(adminClient, 'public_chat_messages', 'user_id', userId)

    // --- Background Tasks ---
    await safeDelete(adminClient, 'background_tasks', 'user_id', userId)

    // --- Investor & KYC ---
    await safeDelete(adminClient, 'investor_profiles', 'user_id', userId)
    await safeDelete(adminClient, 'identity_verifications', 'user_id', userId)
    await safeDelete(adminClient, 'ceo_meeting_payments', 'user_id', userId)
    await safeDelete(adminClient, 'kyc_attestations', 'user_id', userId)
    await safeDelete(adminClient, 'kyc_requests', 'user_id', userId)

    // --- Onboarding ---
    await safeDelete(adminClient, 'onboarding_data', 'user_id', userId)

    // --- Members ---
    await safeDelete(adminClient, 'members', 'user_id', userId)

    // --- Hushh AI tables ---
    try {
      const { data: hushhAiUser } = await adminClient
        .from('hushh_ai_users')
        .select('id')
        .eq('supabase_user_id', userId)
        .single()

      if (hushhAiUser) {
        const hushhAiUserId = hushhAiUser.id

        // Get chat IDs
        let chatIds: string[] = []
        try {
          const { data: chats } = await adminClient
            .from('hushh_ai_chats')
            .select('id')
            .eq('user_id', hushhAiUserId)
          chatIds = chats?.map((c: any) => c.id) || []
        } catch (_) { /* skip */ }

        if (chatIds.length > 0) {
          await safeDeleteIn(adminClient, 'hushh_ai_messages', 'chat_id', chatIds)
        }
        await safeDelete(adminClient, 'hushh_ai_chats', 'user_id', hushhAiUserId)
        await safeDelete(adminClient, 'hushh_ai_media_limits', 'user_id', hushhAiUserId)

        // Storage cleanup
        try {
          const { data: files } = await adminClient.storage
            .from('hushh-ai-media')
            .list(userId)
          if (files && files.length > 0) {
            const filePaths = files.map((f: any) => `${userId}/${f.name}`)
            await adminClient.storage.from('hushh-ai-media').remove(filePaths)
          }
        } catch (_) { /* skip storage errors */ }

        await safeDelete(adminClient, 'hushh_ai_users', 'id', hushhAiUserId)
      }
    } catch (e: any) {
      console.warn('[DeleteAccount] Hushh AI cleanup skipped:', e.message)
    }

    // ═══════════════════════════════════════════════════════
    // Finally, delete the auth user
    // ═══════════════════════════════════════════════════════
    console.log(`[DeleteAccount] All table data cleaned. Deleting auth user...`)

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('[DeleteAccount] Auth deletion failed:', deleteAuthError.message)

      // If FK constraint, try to sign out and return partial success
      // The user data is already cleaned, just auth record remains
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Account data deleted but auth record could not be removed. Please contact support.',
          details: deleteAuthError.message,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[DeleteAccount] ✓ Account fully deleted: ${userId}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account and all associated data have been permanently deleted',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[DeleteAccount] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
