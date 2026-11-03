import 'dotenv/config';
import http from 'http';
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

process.on('uncaughtException', () => {
  console.error('ERROR no controlado en el servicio de correo');
});
process.on('unhandledRejection', () => {
  console.error('Promesa rechazada en el servicio de correo');
});

const PORT = Number(process.env.MAIL_PROXY_PORT || 3001);
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MAIL_PROVIDER = (process.env.MAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'sendgrid')).toLowerCase();
const MAIL_FROM = process.env.MAIL_FROM || 'notificaciones@alianzacapital.co';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || 'info@alianzacapital.co';
const OTP_MAILBOX = process.env.NOVEDAD_OTP_EMAIL || 'novedaddesaldo@alianzacapital.co';
const OTP_CC = (process.env.NOVEDAD_OTP_CC || '')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);
const OTP_TTL_MINUTES = 10;

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminClient = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const MAIL_ERROR = 'No se pudo enviar el correo. Intente nuevamente o revise la configuración del proveedor.';

function mailErrorMessage(error) {
  const status = error?.providerStatus;
  const providerMessage = String(error?.providerMessage || '');

  if (status === 401) {
    return 'La API key del proveedor de correo no es válida.';
  }
  if (status === 429) {
    return 'El proveedor de correo alcanzó el límite de envíos. Intenta más tarde.';
  }
  if (status === 403 && /domain is not verified/i.test(providerMessage)) {
    return 'El dominio del remitente no está verificado en Resend. Verifica alianzacapital.co o usa onboarding@resend.dev en desarrollo.';
  }
  if (status === 403 && /testing emails to your own email address/i.test(providerMessage)) {
    return 'Resend está en modo de prueba y solo puede enviar al correo del propietario de la cuenta. Verifica el dominio o usa ese correo como destinatario.';
  }
  return MAIL_ERROR;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 100_000) {
        reject(new Error('Cuerpo de la petición demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

async function getSessionUser(token) {
  if (!token) return null;
  const { data, error } = await anonClient.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function getActorRole(userId) {
  if (!adminClient) return null;
  const { data, error } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data?.role ?? null;
}

const STAFF_ROLES = new Set(['crm_superadmin', 'admin', 'supervisor']);
const NOVEDAD_CREATOR_ROLES = new Set(['crm_superadmin', 'admin']);

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function formatCop(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildOtpEmail({ reference, operationLabel, amount, detail, userName }) {
  const safeReference = escapeHtml(reference);
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Código OTP novedad de saldo</title></head>
<body style="margin:0;padding:20px;background-color:#f5f5f5;font-family:Arial,sans-serif">
  <div style="max-width:700px;margin:0 auto;background-color:#ffffff;padding:40px">
    <p style="font-size:14px;color:#000;line-height:1.6;margin:20px 0"><b>CODIGO DE VALIDACION DE NOVEDAD DE SALDO</b></p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Referencia: <b>${safeReference}</b></p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Tipo de operación: <b>${escapeHtml(operationLabel)}</b><br>
    Valor: <b>${escapeHtml(formatCop(amount))}</b><br>
    Usuario destino: <b>${escapeHtml(userName)}</b><br>
    Detalle: <b>${escapeHtml(detail)}</b></p>
    <div style="text-align:center;margin:30px 0">
      <span style="font-size:40px;font-weight:bold;letter-spacing:6px">{{OTP}}</span>
      <p style="margin-top:10px;font-size:14px">Código OTP</p>
    </div>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">El código vence en ${OTP_TTL_MINUTES} minutos. Es personal y de un solo uso. No lo comparta con nadie.</p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Si usted no ha iniciado esta operación, comuníquese de inmediato con nuestro equipo de soporte.</p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:20px 0;font-style:italic">Este es un mensaje automático, por favor no lo responda directamente.</p>
  </div>
</body>
</html>`;
}

function buildConfirmationEmail({ reference, operationLabel, amount, detail, userName }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Confirmación de movimiento</title></head>
<body style="margin:0;padding:20px;background-color:#f5f5f5;font-family:Arial,sans-serif">
  <div style="max-width:700px;margin:0 auto;background-color:#ffffff;padding:40px">
    <p style="font-size:14px;color:#000;line-height:1.6;margin:20px 0">Estimado(a) <b>${escapeHtml(userName)}</b>,</p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Le informamos que se ha registrado un movimiento en su cuenta de Alianza Capital:</p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:5px 0">Tipo de movimiento: <b>${escapeHtml(operationLabel)}</b><br>
    Valor: <b>${escapeHtml(formatCop(amount))}</b><br>
    Referencia: <b>${escapeHtml(reference)}</b><br>
    Detalles: <b>${escapeHtml(detail)}</b></p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Este movimiento fue realizado de manera interna dentro del ecosistema de Alianza Capital y no requiere acción adicional de su parte.</p>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0"><b>Equipo Alianza Capital</b><br>www.alianzacapital.com<br>info@alianzacapital.co</p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:20px 0;font-style:italic">Este es un mensaje automático, por favor no lo responda directamente.</p>
  </div>
</body>
</html>`;
}

async function sendWithResend({ to, cc, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Falta RESEND_API_KEY para el proveedor Resend');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      cc: cc?.length ? cc : undefined,
      subject,
      html,
      reply_to: MAIL_REPLY_TO,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let providerMessage = '';
    try {
      providerMessage = JSON.parse(body)?.message || '';
    } catch {
      providerMessage = '';
    }
    const error = new Error(`Resend respondió con estado ${response.status}`);
    error.providerStatus = response.status;
    error.providerMessage = providerMessage;
    throw error;
  }
}

async function sendWithSendGrid({ to, cc, subject, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('Falta SENDGRID_API_KEY para el proveedor SendGrid');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          cc: cc?.length ? cc.map((email) => ({ email })) : undefined,
          subject,
        },
      ],
      from: { email: MAIL_FROM },
      reply_to: { email: MAIL_REPLY_TO },
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let providerMessage = '';
    try {
      providerMessage = JSON.parse(body)?.errors?.[0]?.message || JSON.parse(body)?.message || '';
    } catch {
      providerMessage = '';
    }
    const error = new Error(`SendGrid respondió con estado ${response.status}`);
    error.providerStatus = response.status;
    error.providerMessage = providerMessage;
    throw error;
  }
}

async function sendMail(message) {
  if (MAIL_PROVIDER === 'resend') {
    return sendWithResend(message);
  }
  if (MAIL_PROVIDER === 'sendgrid') {
    return sendWithSendGrid(message);
  }
  throw new Error('Proveedor de correo no soportado');
}

function operationLabel(operationType) {
  return operationType === 'add' ? 'Depósito' : 'Débito';
}

async function loadNovedad(novedadId) {
  if (!adminClient) return null;
  const { data, error } = await adminClient
    .from('novedades_saldo')
    .select(
      'id, reference, status, requested_by, ahorros_id, operation_type, amount, detail, target_user_name, target_user_email',
    )
    .eq('id', novedadId)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function handleSolicitarOtp(req, res) {
  if (!adminClient) {
    sendJson(res, 503, {
      success: false,
      error: 'El servicio de OTP no está configurado: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.',
    });
    return;
  }

  const token = getBearerToken(req);
  const user = await getSessionUser(token);
  if (!user) {
    sendJson(res, 401, { success: false, error: 'Sesión no válida.' });
    return;
  }

  const role = await getActorRole(user.id);
  if (!NOVEDAD_CREATOR_ROLES.has(role)) {
    sendJson(res, 403, { success: false, error: 'No autorizado para crear novedades de saldo.' });
    return;
  }

  const body = await readBody(req);
  let novedadId = body.novedadId || null;

  if (!novedadId) {
    const ahorrosId = body.ahorrosId;
    const operationType = body.operationType;
    const amount = Number(body.amount);
    const detail = typeof body.detail === 'string' ? body.detail.trim() : '';

    if (!ahorrosId || !['add', 'debit'].includes(operationType) || !Number.isFinite(amount) || amount <= 0 || !detail) {
      sendJson(res, 400, { success: false, error: 'Datos de la novedad incompletos.' });
      return;
    }

    const client = userClient(token);
    const { data, error } = await client.rpc('crear_novedad_saldo', {
      p_ahorros_id: ahorrosId,
      p_operation_type: operationType,
      p_amount: amount,
      p_detail: detail,
      p_idempotency_key: body.idempotencyKey || null,
    });

    if (error) {
      sendJson(res, 400, { success: false, error: error.message || 'No se pudo crear la novedad.' });
      return;
    }

    novedadId = data?.id;
  }

  const novedad = await loadNovedad(novedadId);
  if (!novedad) {
    sendJson(res, 404, { success: false, error: 'Novedad de saldo no encontrada.' });
    return;
  }

  if (novedad.requested_by !== user.id) {
    sendJson(res, 403, { success: false, error: 'La novedad pertenece a otro usuario.' });
    return;
  }

  if (!['pending_otp', 'otp_sent', 'expired'].includes(novedad.status)) {
    sendJson(res, 409, {
      success: false,
      error: 'La novedad ya no admite un código nuevo. Verifica su estado.',
    });
    return;
  }

  const otp = generateOtp();

  const { data: otpData, error: otpError } = await adminClient.rpc('registrar_otp_novedad', {
    p_novedad_id: novedad.id,
    p_otp: otp,
    p_ttl_minutes: OTP_TTL_MINUTES,
  });

  if (otpError) {
    sendJson(res, 400, { success: false, error: otpError.message || 'No se pudo registrar el OTP.' });
    return;
  }

  const html = buildOtpEmail({
    reference: novedad.reference,
    operationLabel: operationLabel(novedad.operation_type),
    amount: novedad.amount,
    detail: novedad.detail,
    userName: novedad.target_user_name,
  }).replace('{{OTP}}', otp);

  try {
    await sendMail({
      to: OTP_MAILBOX,
      cc: OTP_CC,
      subject: `Código OTP novedad de saldo ${novedad.reference}`,
      html,
    });
  } catch (error) {
    console.error(`Error enviando el correo con el OTP de la novedad (estado ${error?.providerStatus ?? 'desconocido'})`);
    sendJson(res, 502, { success: false, error: mailErrorMessage(error) });
    return;
  }

  sendJson(res, 200, {
    success: true,
    novedadId: novedad.id,
    reference: otpData?.reference || novedad.reference,
    expiresAt: otpData?.expires_at || null,
  });
}

async function handleConfirmacion(req, res) {
  if (!adminClient) {
    sendJson(res, 503, { success: false, error: 'El servicio de correo no está configurado.' });
    return;
  }

  const token = getBearerToken(req);
  const user = await getSessionUser(token);
  if (!user) {
    sendJson(res, 401, { success: false, error: 'Sesión no válida.' });
    return;
  }

  const role = await getActorRole(user.id);
  if (!STAFF_ROLES.has(role)) {
    sendJson(res, 403, { success: false, error: 'No autorizado para enviar confirmaciones.' });
    return;
  }

  const body = await readBody(req);
  if (!body.novedadId) {
    sendJson(res, 400, { success: false, error: 'Falta la referencia de la novedad.' });
    return;
  }

  const novedad = await loadNovedad(body.novedadId);
  if (!novedad) {
    sendJson(res, 404, { success: false, error: 'Novedad de saldo no encontrada.' });
    return;
  }

  if (novedad.status !== 'applied') {
    sendJson(res, 409, { success: false, error: 'La novedad todavía no está aplicada.' });
    return;
  }

  if (!novedad.target_user_email) {
    sendJson(res, 200, { success: false, error: 'La cuenta no tiene correo registrado.' });
    return;
  }

  const html = buildConfirmationEmail({
    reference: novedad.reference,
    operationLabel: operationLabel(novedad.operation_type),
    amount: novedad.amount,
    detail: novedad.detail,
    userName: novedad.target_user_name,
  });

  try {
    await sendMail({
      to: novedad.target_user_email,
      subject: `Movimiento por ${formatCop(novedad.amount)} en su cuenta Alianza Capital`,
      html,
    });
  } catch (error) {
    console.error(`Error enviando la confirmación de la novedad (estado ${error?.providerStatus ?? 'desconocido'})`);
    sendJson(res, 502, { success: false, error: mailErrorMessage(error) });
    return;
  }

  sendJson(res, 200, { success: true });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Método no permitido' });
    return;
  }

  try {
    if (req.url === '/novedad-saldo/solicitar-otp') {
      await handleSolicitarOtp(req, res);
    } else if (req.url === '/novedad-saldo/confirmacion') {
      await handleConfirmacion(req, res);
    } else {
      sendJson(res, 404, { error: 'Endpoint no encontrado' });
    }
  } catch (error) {
    console.error('Error procesando la petición del servicio de correo');
    if (!res.headersSent) {
      sendJson(res, 500, {
        success: false,
        error: error?.message === 'JSON inválido' ? 'JSON inválido' : 'Error interno del servicio de correo.',
      });
    }
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Servicio de correo escuchando en el puerto ${PORT}\n`);
});
