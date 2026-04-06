// PEGAR EN: Supabase → Edge Functions → resend-email → Code → Deploy
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')!;

// Rate limiting: 1 alerta por (tipo+email) cada N minutos
const cooldownMap = new Map<string, number>();
const COOLDOWN_FAILED  = 5  * 60 * 1000; // 5 min entre alertas de fallo
const COOLDOWN_SUCCESS = 60 * 60 * 1000; // 1 hora entre alertas de login exitoso

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getGeoInfo(ip: string) {
  try {
    if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) {
      return { country: 'Local / Dev', city: '-', region: '-' };
    }
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,regionName,city,status`,
      { signal: AbortSignal.timeout(3000) }
    );
    const d = await res.json();
    if (d.status === 'success') {
      return { country: d.country ?? '-', city: d.city ?? '-', region: d.regionName ?? '-' };
    }
  } catch {}
  return { country: 'Desconocido', city: '-', region: '-' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type = 'failed', email, userId, timestamp, platform } = await req.json();
    const isSuccess = type === 'success';

    // Rate limiting por tipo + email
    const cooldownKey = `${type}:${email}`;
    const now = Date.now();
    const lastAlert = cooldownMap.get(cooldownKey) ?? 0;
    const cooldown = isSuccess ? COOLDOWN_SUCCESS : COOLDOWN_FAILED;

    if (now - lastAlert < cooldown) {
      return new Response(JSON.stringify({ ok: true, skipped: 'cooldown' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    cooldownMap.set(cooldownKey, now);

    // IP y geolocalización
    const xff = req.headers.get('x-forwarded-for') ?? '';
    const ip  = xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocida';
    const geo = await getGeoInfo(ip);

    const date = new Date(timestamp).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const platformLabel: Record<string, string> = {
      ios: '📱 iOS', android: '📱 Android', web: '🌐 Web',
    };

    const borderColor = isSuccess ? '#22c55e' : '#ef4444';
    const icon        = isSuccess ? '✅' : '⚠️';
    const title       = isSuccess ? 'Inicio de sesión exitoso' : 'Intento de acceso fallido';
    const subject     = `${icon} ${title} — ${email}`;
    const footerNote  = isSuccess
      ? 'Si no fuiste vos, cerrá esa sesión desde Supabase inmediatamente.'
      : 'Si es sospechoso, cambiá la contraseña de esa cuenta inmediatamente.';

    const userRow = isSuccess && userId
      ? `<tr style="border-bottom:1px solid #f0f0f0;">
           <td style="padding:8px 4px;color:#666;width:140px;">ID de usuario</td>
           <td style="padding:8px 4px;font-family:monospace;font-size:12px;">${userId}</td>
         </tr>`
      : '';

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px;">
        <div style="background:#fff;border-radius:10px;padding:24px;border-left:4px solid ${borderColor};">
          <h2 style="margin:0 0 16px;color:${borderColor};font-size:18px;">${icon} ${title}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;width:140px;">Email</td>
              <td style="padding:8px 4px;font-weight:600;">${email}</td>
            </tr>
            ${userRow}
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">Fecha y hora</td>
              <td style="padding:8px 4px;">${date} (ARG)</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">IP de origen</td>
              <td style="padding:8px 4px;font-family:monospace;">${ip}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">País</td>
              <td style="padding:8px 4px;">🌍 ${geo.country}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">Ciudad / Región</td>
              <td style="padding:8px 4px;">${geo.city}, ${geo.region}</td>
            </tr>
            <tr>
              <td style="padding:8px 4px;color:#666;">Plataforma</td>
              <td style="padding:8px 4px;">${platformLabel[platform] ?? platform ?? 'desconocida'}</td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#999;">${footerNote}</p>
        </div>
        <p style="text-align:center;font-size:11px;color:#aaa;margin-top:16px;">Clientes y Stock — Monitoreo de seguridad</p>
      </div>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Clientes y Stock <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject,
        html,
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
