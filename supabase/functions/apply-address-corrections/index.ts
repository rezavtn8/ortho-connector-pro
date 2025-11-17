import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface AddressUpdate {
  id: string;
  address: string;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`apply-address-corrections: ${req.method} request [${requestId}]`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log(`apply-address-corrections: Auth header present: ${!!authHeader} [${requestId}]`);
    
    if (!authHeader) {
      console.error(`apply-address-corrections: Missing Authorization header [${requestId}]`);
      console.error(`apply-address-corrections: Available headers: ${JSON.stringify([...req.headers.keys()])} [${requestId}]`);
      throw new Error('No authorization header');
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create client with user's token for auth verification
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized');
    }
    
    console.log(`apply-address-corrections: Authenticated user ${user.id} [${requestId}]`);

    // Parse request body
    const { updates } = await req.json();
    
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('updates must be a non-empty array');
    }

    console.log(`apply-address-corrections: Applying ${updates.length} address updates [${requestId}]`);

    // Batch update addresses
    let successCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const update of updates as AddressUpdate[]) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('patient_sources')
          .update({ address: update.address })
          .eq('id', update.id)
          .eq('created_by', user.id);

        if (updateError) {
          errors.push({
            id: update.id,
            error: updateError.message
          });
        } else {
          successCount++;
        }
      } catch (error) {
        errors.push({
          id: update.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`apply-address-corrections: Updated ${successCount} of ${updates.length} addresses [${requestId}]`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: successCount,
        total: updates.length,
        errors: errors.length > 0 ? errors : undefined,
        requestId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`apply-address-corrections: Error [${requestId}]:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
