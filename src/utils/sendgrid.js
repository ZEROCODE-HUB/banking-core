const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const enviarCodigoOTP = async (datosTransaccion) => {
  try {
    const response = await fetch(`${SERVER_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:               datosTransaccion.email,
        otp:                 datosTransaccion.otp,
        nombreUsuario:       datosTransaccion.nombreUsuario || 'Administrador',
        tipoOperacion:       datosTransaccion.tipoOperacion || 'Novedad de saldo',
        valorTransaccion:    datosTransaccion.valorTransaccion || '$0',
        idTransaccion:       datosTransaccion.idTransaccion || 'N/A',
        detallesTransaccion: datosTransaccion.detallesTransaccion || '',
      }),
    });
    const result = await response.json();
    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const enviarConfirmacionTransaccion = async (datosTransaccion) => {
  try {
    const response = await fetch(`${SERVER_URL}/send-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:               datosTransaccion.email,
        nombreUsuario:       datosTransaccion.nombreUsuario || 'Usuario',
        tipoMovimiento:      datosTransaccion.tipoMovimiento || 'Movimiento',
        valorTransaccion:    datosTransaccion.valorTransaccion || '$0',
        idTransaccion:       datosTransaccion.idTransaccion || 'N/A',
        detallesTransaccion: datosTransaccion.detallesTransaccion || '',
        fecha:               new Date().toLocaleDateString('es-CO'),
      }),
    });
    const result = await response.json();
    return result.success ? { success: true } : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const formatearMonto = (monto) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(monto);
};