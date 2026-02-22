// signal-return-report — Report a return for an ACH transaction
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const clientTransactionId = body.clientTransactionId || body.client_transaction_id;
    const returnCode = body.returnCode || body.return_code;

    if (!clientTransactionId || !returnCode) {
      return new Response(
        JSON.stringify({ error: 'clientTransactionId and returnCode are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';
    const baseUrl = `https://${PLAID_ENV}.plaid.com`;

    const plaidBody: Record<string, any> = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      client_transaction_id: clientTransactionId,
      return_code: returnCode,
    };

    if (body.returned_at) plaidBody.returned_at = body.returned_at;

    const response = await fetch(`${baseUrl}/signal/return/report`, {
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
