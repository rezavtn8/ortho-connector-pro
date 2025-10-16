import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { WelcomeEmail } from "./_templates/welcome.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // If webhook secret is configured, verify the webhook signature
    if (hookSecret) {
      const wh = new Webhook(hookSecret);
      try {
        wh.verify(payload, headers);
      } catch (error) {
        console.error("Webhook verification failed:", error);
        return new Response(
          JSON.stringify({ error: "Webhook verification failed" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    const body = JSON.parse(payload);
    
    // Handle auth.users webhook for new user signups
    const userEmail = body.record?.email || body.user?.email;
    const firstName = body.record?.raw_user_meta_data?.first_name || 
                     body.user?.raw_user_meta_data?.first_name;
    
    if (!userEmail) {
      console.error("No email found in webhook payload");
      return new Response(
        JSON.stringify({ error: "No email provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending welcome email to: ${userEmail}`);

    // Render the React email template
    const html = await renderAsync(
      React.createElement(WelcomeEmail, {
        firstName,
        email: userEmail,
      })
    );

    // Send the email via Resend
    const { data, error } = await resend.emails.send({
      from: "Nexora Dental <admin@nexoradental.com>",
      to: [userEmail],
      subject: "Welcome to Nexora Dental!",
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      throw error;
    }

    console.log("Welcome email sent successfully:", data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Welcome email sent",
        data 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          details: error.toString(),
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
