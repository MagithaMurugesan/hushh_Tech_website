// signal-decision-report — Report whether an ACH transaction was initiated
import { corsHeaders } from '../_shared/cors.ts';

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

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';
    const baseUrl = `https://${PLAID_ENV}.plaid.com`;

    const plaidBody: Record<string, any> = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
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

    const response = await fetch(`${baseUrl}/signal/decision/report`, {
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
