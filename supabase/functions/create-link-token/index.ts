// create-link-token — Creates a Plaid Link token
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, userEmail, redirectUri, receivedRedirectUri } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';
    const baseUrl = `https://${PLAID_ENV}.plaid.com`;

    // Build Plaid request body
    const plaidBody: Record<string, any> = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      user: { client_user_id: userId, email_address: userEmail },
      client_name: 'Hushh',
      products: ['auth', 'transactions', 'investments', 'assets'],
      country_codes: ['US'],
      language: 'en',
    };

    // OAuth support: redirect_uri for initial call
    if (redirectUri) {
      plaidBody.redirect_uri = redirectUri;
    }

    // OAuth resume: receivedRedirectUri for returning from bank OAuth
    // When resuming, products must NOT be included per Plaid docs
    if (receivedRedirectUri) {
      plaidBody.redirect_uri = receivedRedirectUri;
      delete plaidBody.products; // Plaid requires no products on OAuth resume
    }

    console.log('[create-link-token] OAuth params:', {
      redirectUri: redirectUri || 'none',
      receivedRedirectUri: receivedRedirectUri || 'none',
      isResume: !!receivedRedirectUri,
    });

    const response = await fetch(`${baseUrl}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plaidBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[create-link-token] Plaid error:', data);
      return new Response(
        JSON.stringify({ error: data.error_message || 'Failed to create link token' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ link_token: data.link_token, expiration: data.expiration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[create-link-token] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
