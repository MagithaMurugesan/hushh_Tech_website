// signal-decision-report — Report whether an ACH transaction was initiated
import { corsHeaders } from '../_shared/cors.ts';
import { getPlaidConfig } from '../_shared/plaid.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const clientTransactionId = body.clientTransactionId || body.client_transaction_id;
    const initiated = body.initiated;

    if (!clientTransactionId || initiated === undefined) {
      return new Response(
        JSON.stringify({ error: 'clientTransactionId and initiated are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const plaid = getPlaidConfig();

    const plaidBody: Record<string, any> = {
      client_id: plaid.clientId,
      secret: plaid.secret,
      client_transaction_id: clientTransactionId,
      initiated: initiated,
    };

    // Optional fields
    if (body.days_funds_on_hold !== undefined) plaidBody.days_funds_on_hold = body.days_funds_on_hold;
    if (body.decision_outcome) plaidBody.decision_outcome = body.decision_outcome;
    if (body.payment_method) plaidBody.payment_method = body.payment_method;
    if (body.amount_instantly_available !== undefined) {
      plaidBody.amount_instantly_available = body.amount_instantly_available;
    }

    const response = await fetch(`${plaid.baseUrl}/signal/decision/report`, {
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
