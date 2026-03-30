// exchange-public-token — Exchange Plaid public token for access token
import { corsHeaders } from '../_shared/cors.ts';
import { getPlaidConfig } from '../_shared/plaid.ts';
import { authenticateEdgeRequest } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const publicToken = body.publicToken || body.public_token;
    const userId = body.userId || body.user_id;

    const authFailure = await authenticateEdgeRequest(req, {
      label: 'exchange-public-token',
      expectedUserId: userId || null,
    });
    if (authFailure) return authFailure;

    if (!publicToken) {
      return new Response(
        JSON.stringify({ error: 'publicToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const plaid = getPlaidConfig();

    const response = await fetch(`${plaid.baseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secret,
        public_token: publicToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[exchange-public-token] Plaid error:', data);
      return new Response(
        JSON.stringify({ error: data.error_message || 'Failed to exchange token', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        item_id: data.item_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[exchange-public-token] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
