// signal-evaluate — Evaluate ACH transaction return risk via Plaid Signal
// Returns: risk scores (1-99), core attributes, ruleset result
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const accessToken = body.accessToken || body.access_token;
    const accountId = body.accountId || body.account_id;
    const clientTransactionId = body.clientTransactionId || body.client_transaction_id;
    const amount = body.amount;

    if (!accessToken || !accountId || !clientTransactionId || amount === undefined) {
      return new Response(
        JSON.stringify({ error: 'accessToken, accountId, clientTransactionId, and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';
    const baseUrl = `https://${PLAID_ENV}.plaid.com`;

    // Build request body
    const plaidBody: Record<string, any> = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      access_token: accessToken,
      account_id: accountId,
      client_transaction_id: clientTransactionId,
      amount: amount,
    };

    // Optional fields
    if (body.clientUserId || body.client_user_id) {
      plaidBody.client_user_id = body.clientUserId || body.client_user_id;
    }
    if (body.is_recurring !== undefined) plaidBody.is_recurring = body.is_recurring;
    if (body.default_payment_method) plaidBody.default_payment_method = body.default_payment_method;
    if (body.ruleset_key) plaidBody.ruleset_key = body.ruleset_key;

    // Optional user info for better accuracy
    if (body.user) plaidBody.user = body.user;
    // Optional device info
    if (body.device) plaidBody.device = body.device;

    const response = await fetch(`${baseUrl}/signal/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plaidBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error_message, error_code: data.error_code }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
