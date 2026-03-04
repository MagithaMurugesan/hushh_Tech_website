/**
 * NDA Service
 * Handles all NDA-related API calls for the global NDA gate feature.
 *
 * Performance optimizations:
 * - IP address fetched once and reused (no duplicate ipify calls)
 * - signNDA accepts pre-fetched IP to avoid redundant network call
 */

import config from '../../resources/config/config';

// Supabase function URL for NDA notification
const NDA_NOTIFICATION_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nda-signed-notification`;

export interface NDAStatus {
  hasSignedNda: boolean;
  signedAt: string | null;
  ndaVersion: string | null;
  signerName: string | null;
}

export interface SignNDAResult {
  success: boolean;
  signedAt?: string;
  signerName?: string;
  ndaVersion?: string;
  error?: string;
}

/**
 * Fetch client IP address (best-effort, with timeout).
 * Returns 'unknown' if the fetch fails or takes >3s.
 */
export const fetchClientIP = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * Check if the current user has signed the NDA.
 */
export const checkNDAStatus = async (userId: string): Promise<NDAStatus> => {
  const fallback: NDAStatus = {
    hasSignedNda: false,
    signedAt: null,
    ndaVersion: null,
    signerName: null,
  };

  if (!config.supabaseClient) {
    console.error('[ndaService] Supabase client not initialized');
    return fallback;
  }

  try {
    const { data, error } = await config.supabaseClient.rpc(
      'check_user_nda_status',
      { p_user_id: userId },
    );

    if (error) {
      console.error('[ndaService] check_user_nda_status error:', error);
      return fallback;
    }

    return data as NDAStatus;
  } catch (err) {
    console.error('[ndaService] checkNDAStatus exception:', err);
    return fallback;
  }
};

/**
 * Sign the global NDA.
 * Accepts an optional pre-fetched IP so the caller can avoid a duplicate fetch.
 */
export const signNDA = async (
  signerName: string,
  ndaVersion: string = 'v1.0',
  pdfUrl?: string,
  prefetchedIp?: string,
): Promise<SignNDAResult> => {
  if (!config.supabaseClient) {
    console.error('[ndaService] Supabase client not initialized');
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    // Use pre-fetched IP or fetch once
    const signerIp = prefetchedIp || (await fetchClientIP());

    const { data, error } = await config.supabaseClient.rpc('sign_global_nda', {
      p_signer_name: signerName,
      p_nda_version: ndaVersion,
      p_pdf_url: pdfUrl || null,
      p_signer_ip: signerIp,
    });

    if (error) {
      console.error('[ndaService] sign_global_nda error:', error);
      return { success: false, error: error.message };
    }

    return data as SignNDAResult;
  } catch (err) {
    console.error('[ndaService] signNDA exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

/**
 * Generate personalized NDA PDF using Cloud Run service.
 */
export const generateNDAPdf = async (
  metadata: Record<string, unknown>,
  accessToken: string,
): Promise<{ success: boolean; pdfUrl?: string; blob?: Blob; error?: string }> => {
  try {
    const response = await fetch(
      'https://hushhtech-nda-generation-53407187172.us-central1.run.app/generate-nda',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'jwt-token': accessToken,
        },
        body: JSON.stringify({ metadata }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to generate PDF: ${errorText}` };
    }

    const blob = await response.blob();
    const pdfUrl = URL.createObjectURL(blob);

    return { success: true, pdfUrl, blob };
  } catch (err) {
    console.error('[ndaService] generateNDAPdf error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

/**
 * Send NDA signed notification to manish@hushh.ai and ankit@hushh.ai.
 */
export const sendNDANotification = async (
  signerName: string,
  signerEmail: string,
  signedAt: string,
  ndaVersion: string,
  pdfUrl?: string,
  pdfBlob?: Blob,
  userId?: string,
  signerIp?: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload: Record<string, unknown> = {
      signerName,
      signerEmail,
      signedAt,
      ndaVersion,
      signerIp: signerIp || 'Unknown',
      userId,
    };

    if (pdfUrl) payload.pdfUrl = pdfUrl;

    // Convert PDF blob to base64 for attachment (if provided)
    if (pdfBlob) {
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            '',
          ),
        );
        payload.pdfBase64 = base64;
      } catch (blobErr) {
        console.warn('[ndaService] Could not convert PDF blob to base64:', blobErr);
      }
    }

    const response = await fetch(NDA_NOTIFICATION_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ndaService] NDA notification failed:', errorText);
      return { success: false, error: `Failed to send notification: ${errorText}` };
    }

    const result = await response.json();
    console.log('[ndaService] NDA notification sent successfully:', result);
    return { success: true };
  } catch (err) {
    console.error('[ndaService] sendNDANotification error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

/**
 * Upload signed NDA PDF to Supabase Storage.
 */
export const uploadSignedNDA = async (
  userId: string,
  pdfBlob: Blob,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  if (!config.supabaseClient) {
    console.error('[ndaService] Supabase client not initialized');
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const fileName = `nda_${userId}_${Date.now()}.pdf`;
    const filePath = `signed-ndas/${fileName}`;

    const { error } = await config.supabaseClient.storage
      .from('assets')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error('[ndaService] Upload error:', error);
      return { success: false, error: error.message };
    }

    const { data: urlData } = config.supabaseClient.storage
      .from('assets')
      .getPublicUrl(filePath);

    return { success: true, url: urlData.publicUrl };
  } catch (err) {
    console.error('[ndaService] uploadSignedNDA exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

export default {
  checkNDAStatus,
  signNDA,
  generateNDAPdf,
  sendNDANotification,
  uploadSignedNDA,
  fetchClientIP,
};
