/**
 * Shared Plaid Configuration — Used by all Plaid edge functions
 * 
 * Validates PLAID_ENV and provides the base URL + credentials.
 * Centralizes config so every edge function stays consistent.
 */

const VALID_ENVS = ['sandbox', 'production'] as const;
type PlaidEnv = typeof VALID_ENVS[number];

export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: PlaidEnv;
  baseUrl: string;
}

/** Get validated Plaid config from environment variables */
export const getPlaidConfig = (): PlaidConfig => {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  const env = (Deno.env.get('PLAID_ENV') || 'sandbox') as string;

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  }

  if (!VALID_ENVS.includes(env as PlaidEnv)) {
    throw new Error(
      `Invalid PLAID_ENV: "${env}". Must be one of: ${VALID_ENVS.join(', ')}`,
    );
  }

  return {
    clientId,
    secret,
    env: env as PlaidEnv,
    baseUrl: `https://${env}.plaid.com`,
  };
};

/** Standard Plaid API request headers */
export const plaidHeaders = {
  'Content-Type': 'application/json',
};

/** Check if we're running in production */
export const isProduction = (): boolean => {
  return (Deno.env.get('PLAID_ENV') || 'sandbox') === 'production';
};
