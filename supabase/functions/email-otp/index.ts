/**
 * Email OTP Edge Function for Hushh Agent
 * 
 * Endpoints:
 * POST /send    - Send OTP to email
 * POST /verify  - Verify OTP and create session
 * POST /logout  - Invalidate session
 * GET  /session - Validate session token
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Gmail API helpers (copied from sales-mailer/gmail.ts)
function base64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

async function getGmailAccessToken(
  serviceAccountEmail: string,
  privateKey: string,
  userToImpersonate: string
): Promise<string> {
  const scopes = ["https://www.googleapis.com/auth/gmail.send"];
  const signedJwt = await createSignedJWT(serviceAccountEmail, privateKey, userToImpersonate, scopes);

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
    throw new Error(`Failed to get Gmail access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendOTPEmail(
  to: string,
  otp: string,
  serviceAccountEmail: string,
  privateKey: string,
  senderEmail: string
): Promise<boolean> {
  try {
    const accessToken = await getGmailAccessToken(serviceAccountEmail, privateKey, senderEmail);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center; }
    .logo { font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .content { padding: 40px 32px; }
    .title { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0 0 16px 0; }
    .text { font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 32px 0; }
    .otp-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; font-family: 'Monaco', 'Consolas', monospace; }
    .expiry { font-size: 14px; color: #888; margin-top: 12px; }
    .footer { padding: 24px 32px; background: #f8f9fa; text-align: center; }
    .footer-text { font-size: 13px; color: #888; margin: 0; }
    .warning { font-size: 13px; color: #dc3545; margin-top: 24px; padding: 12px; background: #fff5f5; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🤫 Hushh Agent</div>
    </div>
    <div class="content">
      <h1 class="title">Your Verification Code</h1>
      <p class="text">Use the code below to sign in to Hushh Agent. This code will expire in 5 minutes.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="expiry">Valid for 5 minutes</div>
      </div>
      <p class="warning">⚠️ Never share this code with anyone. Hushh will never ask for your verification code.</p>
    </div>
    <div class="footer">
      <p class="footer-text">© 2024 Hushh.ai — AI-Powered Resume Coaching</p>
    </div>
  </div>
</body>
</html>`;

    const boundary = `boundary_${Date.now()}`;
    const emailLines = [
      `From: Hushh Agent <${senderEmail}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(`🔐 Your Hushh Agent Login Code: ${otp}`)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      `Your Hushh Agent verification code is: ${otp}`,
      ``,
      `This code expires in 5 minutes.`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(htmlContent))),
      ``,
      `--${boundary}--`,
    ];

    const rawMessage = emailLines.join("\r\n");
    const encodedMessage = base64urlEncode(rawMessage);

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Gmail API error:", error);
      return false;
    }

    console.log(`OTP email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate session token (UUID-based)
function generateSessionToken(): string {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}

// Hash OTP for storage (simple hash for quick lookup)
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + Deno.env.get("OTP_SALT") || "hushh-agent-otp");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gmail credentials
    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
    const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL") || "noreply@hushh.ai";

    // Route: Send OTP
    if (path === "send" && req.method === "POST") {
      const { email } = await req.json();

      if (!email || !email.includes("@")) {
        return new Response(
          JSON.stringify({ success: false, error: "Valid email required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate OTP
      const otp = generateOTP();
      const otpHash = await hashOTP(otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store OTP in database
      const { error: insertError } = await supabase
        .from("hushh_agent_email_otps")
        .insert({
          email: email.toLowerCase(),
          otp_hash: otpHash,
          expires_at: expiresAt.toISOString(),
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
        });

      if (insertError) {
        console.error("Failed to store OTP:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to generate OTP" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send OTP via email
      if (!serviceAccountEmail || !privateKey) {
        console.error("Gmail credentials not configured");
        return new Response(
          JSON.stringify({ success: false, error: "Email service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailSent = await sendOTPEmail(email, otp, serviceAccountEmail, privateKey, senderEmail);

      if (!emailSent) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to send email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent to email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: Verify OTP
    if (path === "verify" && req.method === "POST") {
      const { email, otp } = await req.json();

      if (!email || !otp) {
        return new Response(
          JSON.stringify({ success: false, error: "Email and OTP required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otpHash = await hashOTP(otp);

      // Find valid OTP
      const { data: otpRecord, error: otpError } = await supabase
        .from("hushh_agent_email_otps")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("otp_hash", otpHash)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        // Check if too many attempts
        const { data: recentAttempts } = await supabase
          .from("hushh_agent_email_otps")
          .select("attempts")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (recentAttempts && recentAttempts.attempts >= 3) {
          return new Response(
            JSON.stringify({ success: false, error: "Too many attempts. Please request a new OTP." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Increment attempt count
        await supabase
          .from("hushh_agent_email_otps")
          .update({ attempts: (recentAttempts?.attempts || 0) + 1 })
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);

        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired OTP" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark OTP as verified
      await supabase
        .from("hushh_agent_email_otps")
        .update({ verified: true })
        .eq("id", otpRecord.id);

      // Create or get user
      const { data: existingUser } = await supabase
        .from("hushh_agent_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .single();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        // Update last login
        await supabase
          .from("hushh_agent_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", userId);
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from("hushh_agent_users")
          .insert({
            email: email.toLowerCase(),
            firebase_uid: `email_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`, // Unique ID for email users
          })
          .select()
          .single();

        if (createError || !newUser) {
          console.error("Failed to create user:", createError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newUser.id;
      }

      // Create session
      const sessionToken = generateSessionToken();
      const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { error: sessionError } = await supabase
        .from("hushh_agent_email_sessions")
        .insert({
          user_id: userId,
          session_token: sessionToken,
          expires_at: sessionExpiry.toISOString(),
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
        });

      if (sessionError) {
        console.error("Failed to create session:", sessionError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user data
      const { data: userData } = await supabase
        .from("hushh_agent_users")
        .select("*")
        .eq("id", userId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: userId,
            email: email.toLowerCase(),
            displayName: userData?.display_name || null,
            premiumTier: userData?.premium_tier || "free",
          },
          sessionToken,
          expiresAt: sessionExpiry.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: Validate Session
    if (path === "session" && req.method === "GET") {
      const authHeader = req.headers.get("authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "No session token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session, error: sessionError } = await supabase
        .from("hushh_agent_email_sessions")
        .select("*, hushh_agent_users(*)")
        .eq("session_token", sessionToken)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last used
      await supabase
        .from("hushh_agent_email_sessions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", session.id);

      const user = session.hushh_agent_users;

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            phoneNumber: user.phone_number,
            displayName: user.display_name,
            premiumTier: user.premium_tier,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route: Logout
    if (path === "logout" && req.method === "POST") {
      const authHeader = req.headers.get("authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (sessionToken) {
        await supabase
          .from("hushh_agent_email_sessions")
          .update({ is_active: false })
          .eq("session_token", sessionToken);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Logged out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown route
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Email OTP error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
