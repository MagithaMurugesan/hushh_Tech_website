// NDA Signed Notification Service
// Sends email notification to manish@hushh.ai and ankit@hushh.ai when user signs NDA
// Uses Gmail API with Service Account (Domain-Wide Delegation)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Recipients for NDA notifications
const NDA_NOTIFICATION_RECIPIENTS = [
  'manish@hushh.ai',
  'ankit@hushh.ai',
  'neelesh1@hushh.ai'
];

interface NDANotificationPayload {
  signerName: string;
  signerEmail: string;
  signedAt: string;
  ndaVersion: string;
  signerIp?: string;
  pdfUrl?: string;
  pdfBase64?: string;
  userId?: string;
}

// Base64URL encoding utilities
function base64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Create a signed JWT for Google Service Account authentication
 */
async function createSignedJWT(
  serviceAccountEmail: string,
  privateKey: string,
  userToImpersonate: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    sub: userToImpersonate,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
    scope: scopes.join(" "),
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyPem = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const privateKeyBuffer = Uint8Array.from(atob(privateKeyPem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64urlEncode(new Uint8Array(signature));
  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Get an access token using the Service Account JWT
 */
async function getAccessToken(
  serviceAccountEmail: string,
  privateKey: string,
  userToImpersonate: string
): Promise<string> {
  const scopes = ["https://www.googleapis.com/auth/gmail.send"];

  const signedJwt = await createSignedJWT(
    serviceAccountEmail,
    privateKey,
    userToImpersonate,
    scopes
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Encode content to base64 with line breaks
 */
function encodeBase64WithLineBreaks(content: string): string {
  const base64 = btoa(unescape(encodeURIComponent(content)));
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.slice(i, i + 76));
  }
  return lines.join("\r\n");
}

/**
 * Create RFC 2822 formatted email with optional PDF attachment
 */
function createEmailMessage(
  from: string,
  recipients: string[],
  subject: string,
  htmlContent: string,
  pdfBase64?: string,
  pdfFileName?: string
): string {
  const boundary = `boundary_${Date.now()}`;
  const encodedHtml = encodeBase64WithLineBreaks(htmlContent);
  
  const emailLines = [
    `From: Hushh NDA Notifications <${from}>`,
    `To: ${recipients.join(", ")}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
  ];

  if (pdfBase64 && pdfFileName) {
    // Email with attachment
    emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    emailLines.push(``);
    emailLines.push(`--${boundary}`);
    emailLines.push(`Content-Type: text/html; charset="UTF-8"`);
    emailLines.push(`Content-Transfer-Encoding: base64`);
    emailLines.push(``);
    emailLines.push(encodedHtml);
    emailLines.push(``);
    emailLines.push(`--${boundary}`);
    emailLines.push(`Content-Type: application/pdf; name="${pdfFileName}"`);
    emailLines.push(`Content-Disposition: attachment; filename="${pdfFileName}"`);
    emailLines.push(`Content-Transfer-Encoding: base64`);
    emailLines.push(``);
    emailLines.push(pdfBase64);
    emailLines.push(``);
    emailLines.push(`--${boundary}--`);
  } else {
    // Email without attachment
    emailLines.push(`Content-Type: text/html; charset="UTF-8"`);
    emailLines.push(`Content-Transfer-Encoding: base64`);
    emailLines.push(``);
    emailLines.push(encodedHtml);
  }

  return emailLines.join("\r\n");
}

/**
 * Send email using Gmail API
 */
async function sendGmailEmail(
  recipients: string[],
  subject: string,
  htmlContent: string,
  pdfBase64?: string,
  pdfFileName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL") || "ankit@hushh.ai";

    if (!serviceAccountEmail || !privateKey) {
      return { success: false, error: "Missing Google Service Account credentials" };
    }

    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

    console.log(`Sending NDA notification email from ${senderEmail} to ${recipients.join(", ")}`);

    const accessToken = await getAccessToken(
      serviceAccountEmail,
      formattedPrivateKey,
      senderEmail
    );

    const rawMessage = createEmailMessage(
      senderEmail,
      recipients,
      subject,
      htmlContent,
      pdfBase64,
      pdfFileName
    );

    const encodedMessage = base64urlEncode(rawMessage);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedMessage }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gmail API error:", error);
      return { success: false, error: `Gmail API error: ${error}` };
    }

    const result = await response.json();
    console.log(`NDA notification sent successfully, message ID: ${result.id}`);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: NDANotificationPayload = await req.json();
    
    const { 
      signerName, 
      signerEmail, 
      signedAt, 
      ndaVersion, 
      signerIp = 'Unknown',
      pdfUrl,
      pdfBase64,
      userId
    } = payload;

    if (!signerName || !signerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: signerName, signerEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the signed date
    const signedDate = new Date(signedAt).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    });

    const subject = `[Hushh NDA] Agreement Signed by ${signerName}`;
    
    // Create professional HTML email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background-color: #000000; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
              NDA Agreement Signed
            </h1>
            <p style="color: #888888; margin: 8px 0 0 0; font-size: 14px;">
              Hushh Technologies Inc.
            </p>
          </div>

          <!-- Content -->
          <div style="padding: 32px;">
            <p style="color: #0B1120; font-size: 16px; margin: 0 0 24px 0;">
              A new user has signed the Non-Disclosure Agreement on the Hushh platform.
            </p>

            <!-- Signer Details Card -->
            <div style="background-color: #F8FAFC; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #000000;">
              <h2 style="color: #0B1120; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                Signer Information
              </h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Name:</td>
                  <td style="padding: 8px 0; color: #0B1120; font-size: 14px; font-weight: 600;">${signerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Email:</td>
                  <td style="padding: 8px 0; color: #0B1120; font-size: 14px;">
                    <a href="mailto:${signerEmail}" style="color: #0A84FF; text-decoration: none;">${signerEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Signed At:</td>
                  <td style="padding: 8px 0; color: #0B1120; font-size: 14px;">${signedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">NDA Version:</td>
                  <td style="padding: 8px 0; color: #0B1120; font-size: 14px;">${ndaVersion}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">IP Address:</td>
                  <td style="padding: 8px 0; color: #0B1120; font-size: 14px;">${signerIp}</td>
                </tr>
                ${userId ? `
                <tr>
                  <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">User ID:</td>
                  <td style="padding: 8px 0; color: #0B1120; font-size: 14px; font-family: monospace;">${userId}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${pdfUrl ? `
            <!-- PDF Link -->
            <div style="background-color: #EEF2FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">📄</span>
                <div>
                  <p style="margin: 0; color: #0B1120; font-size: 14px; font-weight: 600;">Signed NDA Document</p>
                  <a href="${pdfUrl}" style="color: #0A84FF; font-size: 13px; text-decoration: none;">
                    View/Download PDF →
                  </a>
                </div>
              </div>
            </div>
            ` : ''}

            ${pdfBase64 ? `
            <!-- Attachment Notice -->
            <div style="background-color: #ECFDF5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #059669; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">📎</span>
                The signed NDA PDF is attached to this email.
              </p>
            </div>
            ` : ''}

            <!-- Action Buttons -->
            <div style="text-align: center; margin-top: 32px;">
              <a href="https://supabase.com/dashboard/project/ibsisfnjxeowvdtvgzff/editor/29410?schema=public" 
                 style="display: inline-block; background-color: #0A0A0A; color: #ffffff; 
                        padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 14px; margin-right: 12px;">
                View All NDA Agreements
              </a>
              <a href="https://hushh.ai/hushh-user-profile" 
                 style="display: inline-block; background-color: #ffffff; color: #0A0A0A; 
                        padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 14px; border: 2px solid #0A0A0A;">
                View User Profiles
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #F8FAFC; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 12px; margin: 0;">
              This is an automated notification from Hushh Technologies Inc.
            </p>
            <p style="color: #6B7280; font-size: 12px; margin: 8px 0 0 0;">
              © ${new Date().getFullYear()} Hushh Technologies Inc. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Prepare PDF attachment info
    let pdfFileName: string | undefined;
    if (pdfBase64) {
      const safeFileName = signerName.replace(/[^a-zA-Z0-9]/g, '_');
      pdfFileName = `NDA_${safeFileName}_${new Date().toISOString().split('T')[0]}.pdf`;
    }

    // Send email
    const result = await sendGmailEmail(
      NDA_NOTIFICATION_RECIPIENTS,
      subject,
      html,
      pdfBase64,
      pdfFileName
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`NDA notification sent for: ${signerName} (${signerEmail})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `NDA notification sent to ${NDA_NOTIFICATION_RECIPIENTS.join(', ')}`,
        recipients: NDA_NOTIFICATION_RECIPIENTS,
        messageId: result.messageId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('NDA notification error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to send NDA notification' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
