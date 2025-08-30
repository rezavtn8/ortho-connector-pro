import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: 'Manager' | 'Front Desk' | 'Marketing Rep';
  clinicName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { email, role, clinicName }: InvitationRequest = await req.json();

    // Validate input
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'Email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user info and verify they have admin access
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's clinic info
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('clinic_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has admin access
    if (profile.role !== 'Owner') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation already exists for this email and clinic
    const { data: existingInvitation } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('email', email)
      .eq('clinic_id', profile.clinic_id)
      .eq('status', 'pending')
      .maybeSingle();

    let invitationToken: string;

    if (existingInvitation) {
      invitationToken = existingInvitation.token;
      
      // Update expiry date
      await supabase
        .from('user_invitations')
        .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', existingInvitation.id);
    } else {
      // Create new invitation
      const { data: invitation, error: invitationError } = await supabase
        .from('user_invitations')
        .insert({
          clinic_id: profile.clinic_id,
          email,
          role,
          invited_by: user.id
        })
        .select('token')
        .single();

      if (invitationError || !invitation) {
        console.error('Error creating invitation:', invitationError);
        return new Response(
          JSON.stringify({ error: 'Failed to create invitation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      invitationToken = invitation.token;
    }

    // Create invitation link
    const invitationLink = `${req.headers.get('origin') || 'https://your-app.com'}/invite/${invitationToken}`;

    // Send invitation email
    const emailResponse = await resend.emails.send({
      from: "Patient Source Tracker <invitations@yourdomain.com>",
      to: [email],
      subject: `You're invited to join ${clinicName || 'our clinic'} on Patient Source Tracker`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h1 style="color: #333; text-align: center;">You're Invited!</h1>
          
          <p>Hi there,</p>
          
          <p>You've been invited to join <strong>${clinicName || 'the clinic'}</strong> as a <strong>${role}</strong> on Patient Source Tracker.</p>
          
          <p>With this role, you'll have access to:</p>
          <ul>
            <li>View and manage patient sources</li>
            <li>Track marketing visits and analytics</li>
            <li>Monitor patient flow and statistics</li>
            <li>Collaborate with your team</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">
            ${invitationLink}
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This invitation will expire in 7 days. If you have any questions, please contact your clinic administrator.
          </p>
          
          <p>Best regards,<br>The Patient Source Tracker Team</p>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error('Error sending email:', emailResponse.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent successfully',
        invitationId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);