// identity-match — Match user identity against bank account owner data
// Returns: match scores (0-100) for name, email, phone, address
import { corsHeaders } from '../_shared/cors.ts';
import { getPlaidConfig } from '../_shared/plaid.ts';
import { authenticateEdgeRequest } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authFailure = await authenticateEdgeRequest(req, {
      label: 'identity-match',
    });
    if (authFailure) return authFailure;

    const body = await req.json();
    const accessToken = body.accessToken || body.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'accessToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const plaid = getPlaidConfig();

    // Build user object for matching (all fields optional)
    const user: Record<string, any> = {};
    if (body.legal_name) user.legal_name = body.legal_name;
    if (body.phone_number) user.phone_number = body.phone_number;
    if (body.email_address) user.email_address = body.email_address;
    if (body.address) user.address = body.address;

    const plaidBody: Record<string, any> = {
      client_id: plaid.clientId,
      secret: plaid.secret,
      access_token: accessToken,
    };

    // Only include user if at least one field provided
    if (Object.keys(user).length > 0) {
      plaidBody.user = user;
    }

    const response = await fetch(`${plaid.baseUrl}/identity/match`, {
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
