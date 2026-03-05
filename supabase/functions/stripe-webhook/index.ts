import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify Stripe webhook signature
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const body = await req.text();

    // Verify the signature using Stripe's recommended approach
    const encoder = new TextEncoder();
    const parts = signature.split(',');
    const timestampPart = parts.find((p: string) => p.startsWith('t='));
    const sigPart = parts.find((p: string) => p.startsWith('v1='));

    if (!timestampPart || !sigPart) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const timestamp = timestampPart.split('=')[1];
    const expectedSig = sigPart.split('=')[1];

    // Check timestamp tolerance (5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      return new Response(
        JSON.stringify({ error: 'Timestamp outside tolerance' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(stripeWebhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const computedSig = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedSig !== expectedSig) {
      console.error('Stripe signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const event = JSON.parse(body);
    console.log(`Stripe webhook verified: ${event.type}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle Stripe events
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Checkout session completed:', event.data.object.id);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        console.log(`Subscription ${event.type}:`, event.data.object.id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      },
    );
  }
});