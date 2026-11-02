import { supabase } from '@/supabase/config';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
};

const postJson = async (path, payload) => {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'La sesión no está disponible. Vuelve a iniciar sesión.' };
  }

  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
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
