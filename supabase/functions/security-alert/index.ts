// Supabase Edge Function: security-alert
// Sends an email alert when a login attempt fails.
//
// Setup (one-time):
//   1. Go to https://resend.com and create a free account
//   2. Get your API key from Resend dashboard
//   3. In Supabase dashboard → Project Settings → Edge Functions → Secrets, add:
//      RESEND_API_KEY = re_xxxxxxxx...
//      ADMIN_EMAIL    = tu@email.com
//   4. Deploy: supabase functions deploy security-alert

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, timestamp, platform } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL');

    if (!RESEND_API_KEY || !ADMIN_EMAIL) {
      // Secrets not configured — silently succeed so the app doesn't break
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const date = new Date(timestamp).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Clientes y Stock <noreply@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: '⚠️ Intento de acceso fallido — Clientes y Stock',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #ef4444;">⚠️ Intento de acceso fallido</h2>
            <p>Se registró un intento de inicio de sesión fallido en tu aplicación.</p>
            <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding:6px; color:#666;">Email:</td><td style="padding:6px;"><strong>${email}</strong></td></tr>
              <tr><td style="padding:6px; color:#666;">Fecha/Hora:</td><td style="padding:6px;">${date}</td></tr>
              <tr><td style="padding:6px; color:#666;">Plataforma:</td><td style="padding:6px;">${platform ?? 'desconocida'}</td></tr>
            </table>
            <p style="color:#666; font-size:13px;">Si reconocés este intento, no hay nada que hacer. Si es sospechoso, considerá reforzar la contraseña de la cuenta.</p>
            <p style="color:#aaa; font-size:12px;">— Clientes y Stock</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
