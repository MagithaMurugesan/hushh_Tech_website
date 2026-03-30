// signal-return-report — Report a return for an ACH transaction
import { corsHeaders } from '../_shared/cors.ts';
import { getPlaidConfig } from '../_shared/plaid.ts';

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

    const plaid = getPlaidConfig();

    const plaidBody: Record<string, any> = {
      client_id: plaid.clientId,
      secret: plaid.secret,
      client_transaction_id: clientTransactionId,
      return_code: returnCode,
    };

    if (body.returned_at) plaidBody.returned_at = body.returned_at;

    const response = await fetch(`${plaid.baseUrl}/signal/return/report`, {
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
