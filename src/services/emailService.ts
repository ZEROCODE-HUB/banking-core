// Configuración del servidor proxy local
const PROXY_CONFIG = {
  proxyUrl: 'http://localhost:3001/send-email',
  apiKey: 'TU_API_KEY_DE_SENDGRID_AQUI', // Reemplazar con tu API Key real
};

// Flag para desarrollo - cambiar a false cuando tengas servidor backend
const USE_MOCK_SERVICE = false; // Cambiado a false para usar servidor real

interface OtpEmailData {
  toEmail: string;
  nombreUsuario: string;
  tipoOperacion: string;
  valorTransaccion: string;
  idTransaccion: string;
  nombreCompleto: string;
  numeroDocumento: string;
  tipoDocumento: string;
  lineaAhorro: string;
  numeroCuenta: string;
  detallesTransaccion: string;
  otp: string;
}

// Mock service para desarrollo
const mockSendOtp = async (data: OtpEmailData): Promise<boolean> => {
  console.log('📧 [MOCK] Simulando envío de OTP:', {
    email: data.toEmail,
    otp: data.otp,
    nombreUsuario: data.nombreUsuario,
    tipoOperacion: data.tipoOperacion,
    valorTransaccion: data.valorTransaccion
  });
  
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simular éxito (puedes cambiar a false para probar errores)
  return true;
};

const mockSendConfirmation = async (data: any): Promise<boolean> => {
  console.log('📧 [MOCK] Simulando envío de confirmación:', {
    email: data.toEmail,
    nombreUsuario: data.nombreUsuario,
    tipoMovimiento: data.tipoMovimiento
  });
  
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return true;
};

export const sendOtpEmail = async (data: OtpEmailData): Promise<boolean> => {
  try {
    // Usar mock service durante desarrollo
    if (USE_MOCK_SERVICE) {
      console.log('🔧 Usando MOCK service para OTP');
      return await mockSendOtp(data);
    }
    
    // Usar el nuevo proxy SendGrid  
    const response = await fetch('http://localhost:3001/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.toEmail,
        otp: data.otp,
        nombreUsuario: data.nombreUsuario,
        tipoOperacion: data.tipoOperacion,
        valorTransaccion: data.valorTransaccion,
        idTransaccion: data.idTransaccion,
        nombreCompleto: data.nombreCompleto,
        numeroDocumento: data.numeroDocumento,
        tipoDocumento: data.tipoDocumento,
        lineaAhorro: data.lineaAhorro,
        numeroCuenta: data.numeroCuenta,
        detallesTransaccion: data.detallesTransaccion
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Email OTP enviado exitosamente a:', data.toEmail);
      return true;
    } else {
      console.error('❌ Error enviando email OTP:', result.error);
      return false;
    }
  } catch (error) {
    console.error('💥 Error en sendOtpEmail:', error);
    return false;
  }
};

export const sendConfirmationEmail = async (data: {
  toEmail: string;
  nombreUsuario: string;
  tipoMovimiento: string;
  valorTransaccion: string;
  idTransaccion: string;
  lineaAhorro: string;
  numeroCuenta: string;
  detallesTransaccion: string;
}): Promise<boolean> => {
  try {
    // Usar mock service durante desarrollo
    if (USE_MOCK_SERVICE) {
      console.log('🔧 Usando MOCK service para confirmación');
      return await mockSendConfirmation(data);
    }
    
    const response = await fetch('http://localhost:3001/send-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.toEmail,
        nombreUsuario: data.nombreUsuario,
        tipoMovimiento: data.tipoMovimiento,
        valorTransaccion: data.valorTransaccion,
        idTransaccion: data.idTransaccion,
        lineaAhorro: data.lineaAhorro,
        numeroCuenta: data.numeroCuenta,
        detallesTransaccion: data.detallesTransaccion,
        fecha: new Date().toLocaleDateString('es-CO')
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Email confirmación enviado exitosamente a:', data.toEmail);
      return true;
    } else {
      console.error('❌ Error enviando email confirmación:', result.error);
      return false;
    }
  } catch (error) {
    console.error('💥 Error en sendConfirmationEmail:', error);
    return false;
  }
};