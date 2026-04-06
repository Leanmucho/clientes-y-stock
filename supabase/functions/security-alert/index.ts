// PEGAR ESTE CÓDIGO EN: Supabase → Edge Functions → resend-email → Code → Deploy
// ─────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')!;

// Rate limiting en memoria: max 1 alerta por email cada 5 minutos
const alertCooldown = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getGeoInfo(ip: string): Promise<{ country: string; city: string; region: string }> {
  try {
    if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) {
      return { country: 'Local / Development', city: '-', region: '-' };
    }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city,status`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    if (data.status === 'success') {
      return { country: data.country ?? '-', city: data.city ?? '-', region: data.regionName ?? '-' };
    }
  } catch {}
  return { country: 'Desconocido', city: '-', region: '-' };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, timestamp, platform } = await req.json();

    // Rate limiting: no enviar más de 1 email por dirección cada 5 min
    const now = Date.now();
    const lastAlert = alertCooldown.get(email) ?? 0;
    if (now - lastAlert < COOLDOWN_MS) {
      return new Response(JSON.stringify({ ok: true, skipped: 'cooldown' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    alertCooldown.set(email, now);

    // Extraer IP real del cliente (Supabase pasa esto en los headers)
    const xff = req.headers.get('x-forwarded-for') ?? '';
    const ip  = xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocida';

    // Geolocalización via ip-api.com (gratuito, sin API key)
    const geo = await getGeoInfo(ip);

    const date = new Date(timestamp).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const platformLabel: Record<string, string> = {
      ios: '📱 iOS',
      android: '📱 Android',
      web: '🌐 Web',
    };

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Clientes y Stock <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: `⚠️ Intento de acceso fallido — ${email}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #f8f9fa; padding: 24px; border-radius: 12px;">
            <div style="background: #fff; border-radius: 10px; padding: 24px; border-left: 4px solid #ef4444;">
              <h2 style="margin: 0 0 16px; color: #ef4444; font-size: 18px;">⚠️ Intento de acceso fallido</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 8px 4px; color: #666; width: 140px;">Email intentado</td>
                  <td style="padding: 8px 4px; font-weight: 600;">${email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 8px 4px; color: #666;">Fecha y hora</td>
                  <td style="padding: 8px 4px;">${date} (ARG)</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 8px 4px; color: #666;">IP de origen</td>
                  <td style="padding: 8px 4px; font-family: monospace;">${ip}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 8px 4px; color: #666;">País</td>
                  <td style="padding: 8px 4px;">🌍 ${geo.country}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 8px 4px; color: #666;">Ciudad / Región</td>
                  <td style="padding: 8px 4px;">${geo.city}, ${geo.region}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 4px; color: #666;">Plataforma</td>
                  <td style="padding: 8px 4px;">${platformLabel[platform] ?? platform ?? 'desconocida'}</td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; font-size: 12px; color: #999;">
                Si reconocés este intento, no hay nada que hacer.<br>
                Si es sospechoso, cambiá la contraseña de esa cuenta inmediatamente.
              </p>
            </div>
            <p style="text-align: center; font-size: 11px; color: #aaa; margin-top: 16px;">Clientes y Stock — Monitoreo de seguridad</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('security-alert error:', e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
