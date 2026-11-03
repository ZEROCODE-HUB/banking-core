import { supabase } from '@/supabase/config';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const REFRESH_MARGIN_SECONDS = 60;

const getAccessToken = async (forceRefresh = false) => {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) return data.session.access_token;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return null;

  const session = data.session;
  if (!session?.access_token) return null;

  // Refrescar antes de que expire evita enviar un token que el proxy rechaza
  // justo mientras Supabase lo está renovando.
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 <= Date.now() + REFRESH_MARGIN_SECONDS * 1000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) return refreshed.session.access_token;
  }

  return session.access_token;
};

const parseResult = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const postJson = async (path, payload) => {
  let token = await getAccessToken();
  if (!token) token = await getAccessToken(true);

  if (!token) {
    return { success: false, error: 'La sesión no está disponible. Vuelve a iniciar sesión.' };
  }

  const send = (accessToken) =>
    fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

  try {
    let response = await send(token);
    let result = await parseResult(response);

    // El access token pudo vencer entre getSession y la petición. Se renueva
    // una sola vez y se reintenta la misma operación.
    if (response.status === 401) {
      const refreshedToken = await getAccessToken(true);
      if (refreshedToken) {
        response = await send(refreshedToken);
        result = await parseResult(response);
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: result?.error || 'El servicio de correo no respondió correctamente.',
      };
    }

    return result ?? { success: false, error: 'Respuesta vacía del servicio de correo.' };
  } catch {
    return { success: false, error: 'No se pudo conectar con el servicio de correo.' };
  }
};

// El navegador solo pide que se emita y envíe el OTP. El código nunca vuelve
// en la respuesta: lo genera y lo guarda el servidor.
export const solicitarOtpNovedad = async ({
  ahorrosId,
  operationType,
  amount,
  detail,
  idempotencyKey,
  novedadId,
}) => {
  return postJson('/novedad-saldo/solicitar-otp', {
    ahorrosId,
    operationType,
    amount,
    detail,
    idempotencyKey,
    novedadId,
  });
};

// La confirmación se arma en el servidor a partir de la novedad aplicada. Así
// el navegador no puede cambiar el destinatario ni los datos del movimiento.
export const enviarConfirmacionTransaccion = async ({ novedadId }) => {
  if (!novedadId) {
    return { success: false, error: 'Falta la referencia de la novedad.' };
  }
  return postJson('/novedad-saldo/confirmacion', { novedadId });
};
