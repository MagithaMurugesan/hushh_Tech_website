/**
 * NDA Admin Fetch Edge Function
 * 
 * Fetches all signed NDA records from onboarding_data table.
 * Uses service role key to bypass RLS.
 * Password protected - requires admin password in request body.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const getAdminPassword = () => Deno.env.get("NDA_ADMIN_PASSWORD") || "123456";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { password, highlightUserId } = body;

    // Verify password
    if (password !== getAdminPassword()) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - incorrect password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch all NDA records where nda_signed_at is not null
    // Using correct column names: legal_first_name, legal_last_name (no email in this table)
    const { data, error: fetchError } = await supabase
      .from('onboarding_data')
      .select('user_id, legal_first_name, legal_last_name, nda_signed_at, nda_version, nda_signer_ip, nda_signer_name, nda_pdf_url')
      .not('nda_signed_at', 'is', null)
      .order('nda_signed_at', { ascending: false });

    if (fetchError) {
      console.error("Error fetching NDA records:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Transform the data to match expected format
    const transformedData = (data || []).map((record: { 
      user_id: string; 
      legal_first_name: string | null; 
      legal_last_name: string | null; 
      nda_signed_at: string; 
      nda_version: string | null; 
      nda_signer_ip: string | null; 
      nda_signer_name: string | null; 
      nda_pdf_url: string | null;
    }) => ({
      user_id: record.user_id,
      full_name: [record.legal_first_name, record.legal_last_name].filter(Boolean).join(' ') || record.nda_signer_name || 'N/A',
      email: 'N/A', // Email not stored in onboarding_data table
      nda_signed_at: record.nda_signed_at,
      nda_version: record.nda_version,
      nda_signer_ip: record.nda_signer_ip,
      nda_signer_name: record.nda_signer_name,
      nda_pdf_url: record.nda_pdf_url,
    }));

    console.log(`Fetched ${transformedData.length} NDA records`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        records: transformedData,
        count: transformedData.length,
        highlightUserId: highlightUserId || null,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    console.error("Error in nda-admin-fetch:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
