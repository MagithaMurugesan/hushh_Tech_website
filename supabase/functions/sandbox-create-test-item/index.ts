/**
 * sandbox-create-test-item — Bypass Plaid Link for sandbox testing
 * 
 * Uses /sandbox/public_token/create to create a test Item,
 * exchanges for access_token, fetches all 3 products (balance,
 * investments, assets), and saves to user_financial_data.
 * 
 * SANDBOX ONLY — will fail in production.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { getPlaidConfig } from '../_shared/plaid.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const userId = body.userId || body.user_id;
    const institutionId = body.institutionId || 'ins_109508'; // First Platypus Bank

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const plaid = getPlaidConfig();

    // Only allow in sandbox
    if (plaid.env !== 'sandbox') {
      return new Response(
        JSON.stringify({ error: 'This endpoint is only available in sandbox mode' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[sandbox-test] Creating test item for user ${userId} at ${institutionId}`);

    // ─── Step 1: Create sandbox public token ───
    const createRes = await fetch(`${plaid.baseUrl}/sandbox/public_token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secret,
        institution_id: institutionId,
        initial_products: ['assets', 'auth', 'transactions', 'investments'],
        options: {
          override_username: 'user_good',
          override_password: 'pass_good',
        },
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      console.error('[sandbox-test] Failed to create public token:', createData);
      return new Response(
        JSON.stringify({ error: createData.error_message || 'Failed to create sandbox token', details: createData }),
        { status: createRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const publicToken = createData.public_token;
    console.log('[sandbox-test] ✅ Public token created');

    // ─── Step 2: Exchange for access token ───
    const exchangeRes = await fetch(`${plaid.baseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secret,
        public_token: publicToken,
      }),
    });

    const exchangeData = await exchangeRes.json();
    if (!exchangeRes.ok) {
      console.error('[sandbox-test] Failed to exchange token:', exchangeData);
      return new Response(
        JSON.stringify({ error: exchangeData.error_message || 'Failed to exchange token', details: exchangeData }),
        { status: exchangeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = exchangeData.access_token;
    const itemId = exchangeData.item_id;
    console.log(`[sandbox-test] ✅ Access token obtained, item: ${itemId}`);

    // ─── Step 3: Fetch all 3 products in parallel ───
    const plaidHeaders = { 'Content-Type': 'application/json' };
    const authBody = JSON.stringify({ client_id: plaid.clientId, secret: plaid.secret, access_token: accessToken });

    const [balanceRes, investRes, assetRes] = await Promise.allSettled([
      // Balance
      fetch(`${plaid.baseUrl}/accounts/balance/get`, {
        method: 'POST', headers: plaidHeaders, body: authBody,
      }).then(r => r.json()),

      // Investments
      fetch(`${plaid.baseUrl}/investments/holdings/get`, {
        method: 'POST', headers: plaidHeaders, body: authBody,
      }).then(r => r.json()),

      // Asset Report (create)
      fetch(`${plaid.baseUrl}/asset_report/create`, {
        method: 'POST',
        headers: plaidHeaders,
        body: JSON.stringify({
          client_id: plaid.clientId,
          secret: plaid.secret,
          access_tokens: [accessToken],
          days_requested: 90,
        }),
      }).then(r => r.json()),
    ]);

    // Parse results
    const balance = balanceRes.status === 'fulfilled' && !balanceRes.value.error_code
      ? { available: true, data: balanceRes.value, error: null }
      : { available: false, data: null, error: balanceRes.status === 'fulfilled' ? balanceRes.value.error_message : 'Network error' };

    const investments = investRes.status === 'fulfilled' && !investRes.value.error_code
      ? { available: true, data: investRes.value, error: null }
      : { available: false, data: null, error: investRes.status === 'fulfilled' ? investRes.value.error_message : 'Network error' };

    const assets = assetRes.status === 'fulfilled' && !assetRes.value.error_code
      ? { available: true, data: assetRes.value, error: null }
      : { available: false, data: null, error: assetRes.status === 'fulfilled' ? assetRes.value.error_message : 'Network error' };

    const productsAvailable = [balance, investments, assets].filter(p => p.available).length;
    const status = productsAvailable === 3 ? 'complete' : productsAvailable > 0 ? 'partial' : 'failed';

    console.log(`[sandbox-test] Products: balance=${balance.available}, investments=${investments.available}, assets=${assets.available}`);

    // ─── Step 4: Save to user_financial_data ───
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let saved = false;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Save to plaid_items
        await supabase.from('plaid_items').upsert({
          user_id: userId,
          access_token: accessToken,
          item_id: itemId,
          institution_name: 'First Platypus Bank',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'item_id' });

        // Save to user_financial_data
        const fetchErrors: Record<string, string> = {};
        if (balance.error) fetchErrors.balance = balance.error;
        if (investments.error) fetchErrors.investments = investments.error;
        if (assets.error) fetchErrors.assets = assets.error;

        await supabase.from('user_financial_data').upsert({
          user_id: userId,
          plaid_item_id: itemId,
          institution_name: 'First Platypus Bank',
          institution_id: institutionId,
          balances: balance.data,
          investments: investments.data,
          asset_report: assets.data,
          asset_report_token: assets.data?.asset_report_token || null,
          available_products: {
            balance: balance.available,
            assets: assets.available,
            investments: investments.available,
          },
          status,
          fetch_errors: Object.keys(fetchErrors).length > 0 ? fetchErrors : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        saved = true;
        console.log('[sandbox-test] ✅ Data saved to Supabase');
      } catch (saveErr) {
        console.error('[sandbox-test] Save error:', saveErr);
      }
    }

    // ─── Return result ───
    return new Response(
      JSON.stringify({
        success: true,
        item_id: itemId,
        institution: { name: 'First Platypus Bank', id: institutionId },
        products: {
          balance: { available: balance.available, accounts: balance.data?.accounts?.length || 0, error: balance.error },
          investments: { available: investments.available, holdings: investments.data?.holdings?.length || 0, error: investments.error },
          assets: { available: assets.available, token: assets.data?.asset_report_token || null, error: assets.error },
        },
        summary: {
          products_available: productsAvailable,
          products_total: 3,
          status,
          saved_to_db: saved,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[sandbox-test] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
