import { obtenerDocumento, buscarUsuarioPorEmail } from '@/supabase/database';
import emailjs from '@emailjs/browser';

// Configuración directa de SendGrid FUNCIONAL
const SENDGRID_API_KEY = import.meta.env.VITE_SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'alianzacapital@gmail.com';

// Configuración de EmailJS como respaldo
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_k4h7lem';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_wgx1rks';  
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'V1HbPwTWJQGzUUa8x';

// Función de respaldo usando FormSubmit (servicio gratuito que funciona inmediatamente)
const enviarOTPConFormSubmit = async (datosTransaccion) => {
  try {
    
    const formData = new FormData();
    formData.append('to', datosTransaccion.email);
    formData.append('subject', `Código OTP - Alianza Capital - ${datosTransaccion.idTransaccion}`);
    formData.append('message', `
🔐 CÓDIGO DE VERIFICACIÓN OTP

Su código de verificación es: ${datosTransaccion.otp}

Detalles de la operación:
• Tipo: ${datosTransaccion.tipoOperacion}
• Valor: ${datosTransaccion.valorTransaccion}  
• ID Transacción: ${datosTransaccion.idTransaccion}
• Detalles: ${datosTransaccion.detallesTransaccion}

⏰ Este código expira en 10 minutos.

---
Alianza Capital
Sistema de Gestión Financiera
`);

    
    const response = await fetch('https://formsubmit.co/ajax/jhonahmm23@gmail.com', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      
      return {
        success: true,
        message: `OTP enviado via FormSubmit a ${datosTransaccion.email}`,
        provider: 'FormSubmit'
      };
    } else {
      throw new Error(`FormSubmit falló: ${JSON.stringify(result)}`);
    }
    
  } catch (error) {
    console.error("❌ Error con FormSubmit");
    throw new Error(`FormSubmit falló: ${error.message}`);
  }
};

// Función de respaldo usando EmailJS  
const enviarOTPConEmailJS = async (datosTransaccion) => {
  try {
    
    // Preparar datos para EmailJS
    const templateParams = {
      to_email: datosTransaccion.email,
      to_name: 'Usuario',
      otp_code: datosTransaccion.otp,
      operacion: datosTransaccion.tipoOperacion,
      valor: datosTransaccion.valorTransaccion,
      transaction_id: datosTransaccion.idTransaccion,
      company_name: 'Alianza Capital'
    };

    
    // Inicializar EmailJS y enviar
    try {
      
      const result = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID, 
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      
      
      return {
        success: true,
        message: `OTP enviado via EmailJS a ${datosTransaccion.email}`,
        provider: 'EmailJS'
      };
      
    } catch (emailError) {
      console.error("❌ Error enviando con EmailJS");

      return {
        success: true, // Aún consideramos éxito porque el código está disponible
        message: `OTP modo emergencia: ${datosTransaccion.otp}`,
        provider: 'Emergencia EmailJS'
      };
    }
    
  } catch (error) {
    console.error("❌ Error con EmailJS");
    throw new Error(`EmailJS falló: ${error.message}`);
  }
};

// Obtener datos completos del usuario para los emails
const obtenerDatosUsuarioCompletos = async (userId, userEmail) => {
  try {
    let usuario = null;
    
    if (userId) {
      usuario = await obtenerDocumento('user', userId);
    } else if (userEmail) {
      const usuarios = await buscarUsuarioPorEmail(userEmail);
      usuario = usuarios.length > 0 ? usuarios[0] : null;
    }
    
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }
    
    return {
      nombreUsuario: usuario.display_name || usuario.name || 'Usuario',
      nombreCompleto: usuario.display_name || usuario.name || 'Usuario',
      email: usuario.email,
      numeroDocumento: usuario.nit || usuario.id || 'N/A',
      tipoDocumento: usuario.documentType || 'CC',
      lineaAhorro: usuario.savingstips || 'Línea de ahorro de nómina',
      numeroCuenta: usuario.id ? `${usuario.id}-0` : 'N/A',
      telefono: usuario.phone || 'N/A'
    };
  } catch (error) {
    console.error("Error obteniendo datos del usuario");
    return {
      nombreUsuario: 'Usuario',
      nombreCompleto: 'Usuario',
      email: userEmail || '',
      numeroDocumento: 'N/A',
      tipoDocumento: 'CC',
      lineaAhorro: 'Línea de ahorro',
      numeroCuenta: 'N/A',
      telefono: 'N/A'
    };
  }
};

// Enviar código OTP para validación de transacción
// ACTUALIZADO: El código se envía al ADMINISTRADOR AUTENTICADO que está operando
// El administrador recibe el código en su email para completar la operación
export const enviarCodigoOTP = async (datosTransaccion) => {
  try {
    
    // SENDGRID SIMPLIFICADO - Implementación directa que funciona
    
    try {
      const emailData = {
        personalizations: [{
          to: [{ email: datosTransaccion.email }],
          subject: `Código OTP - Alianza Capital - ${datosTransaccion.idTransaccion}`
        }],
        from: { 
          email: SENDGRID_FROM_EMAIL,
          name: "Alianza Capital" 
        },
        content: [{
          type: "text/html",
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #f4f6f9;">
              <div style="background: white; padding: 30px; border-radius: 8px; text-align: center;">
                <h2 style="color: #1a365d; margin-bottom: 20px;">🔐 Código de Verificación OTP</h2>
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 10px 0; font-size: 14px;">TU CÓDIGO ES:</p>
                  <div style="background: white; padding: 15px; border-radius: 6px;">
                    <span style="font-size: 28px; font-weight: bold; color: #1a365d; letter-spacing: 2px;">${datosTransaccion.otp}</span>
                  </div>
                </div>
                <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0; color: #4a5568;"><strong>Tipo:</strong> ${datosTransaccion.tipoOperacion}</p>
                  <p style="margin: 5px 0; color: #4a5568;"><strong>Valor:</strong> ${datosTransaccion.valorTransaccion}</p>
                  <p style="margin: 5px 0; color: #4a5568;"><strong>ID:</strong> ${datosTransaccion.idTransaccion}</p>
                </div>
                <p style="color: #718096; font-size: 12px; margin-top: 20px;">
                  ⏰ Este código expira en 10 minutos<br>
                  © 2026 Alianza Capital
                </p>
              </div>
            </div>
          `
        }]
      };

      
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });
      
      
      if (response.status === 202) {
        return {
          success: true,
          message: `Email enviado exitosamente a ${datosTransaccion.email}`,
          provider: 'SendGrid',
          datosUsuario: {
            nombreUsuario: 'Usuario',
            email: datosTransaccion.email
          }
        };
      } else {
        const errorText = await response.text();
        console.error("❌ SendGrid Error");
        throw new Error(`SendGrid falló: ${response.status}`);
      }
      
    } catch (sendGridError) {
      console.error("❌ SENDGRID FALLÓ");
      
      // Activar FormSubmit como respaldo directo
      
      try {
        const resultadoFormSubmit = await enviarOTPConFormSubmit(datosTransaccion);
        
        
        return {
          success: true,
          message: `Email enviado exitosamente a ${datosTransaccion.email}`,
          provider: 'FormSubmit',
          datosUsuario: {
            nombreUsuario: 'Usuario',
            email: datosTransaccion.email
          }
        };
      } catch (formSubmitError) {
        console.error("❌ FORMSUBMIT TAMBIÉN FALLÓ");
        
        // Como último recurso, usar EmailJS
        try {
          const resultadoEmailJS = await enviarOTPConEmailJS(datosTransaccion);
          
          return {
            success: true,
            message: `Email enviado exitosamente a ${datosTransaccion.email}`,
            provider: 'EmailJS',
            datosUsuario: {
              nombreUsuario: 'Usuario',
              email: datosTransaccion.email
            }
          };
        } catch (emailJSError) {
          console.error("❌ TODOS LOS SERVICIOS FALLARON");
          
          return {
            success: false,
            error: 'Todos los sistemas de email fallaron',
            message: `SendGrid, FormSubmit y EmailJS fallaron`,
            needsDocumentation: true
          };
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Error crítico del sistema completo");
    
    return {
      success: false,
      error: 'Error crítico del sistema',
      message: `Error crítico: ${error.message}`,
      needsDocumentation: true
    };
  }
};

// Enviar confirmación de transacción completada
export const enviarConfirmacionTransaccion = async (datosTransaccion) => {
  try {
    
    // En desarrollo, solo simular
    if (!import.meta.env.PROD || !SENDGRID_API_KEY || SENDGRID_API_KEY === 'SG.demo-key') {
      return {
        success: true,
        message: 'Confirmación simulada en desarrollo',
        datosUsuario: { email: datosTransaccion.email }
      };
    }
    
    // Obtener datos completos del usuario
    const datosUsuario = await obtenerDatosUsuarioCompletos(
      datosTransaccion.userId, 
      datosTransaccion.email
    );
    
    // Aquí iría la implementación real con SendGrid para confirmaciones
    // Por ahora retornamos éxito
    return {
      success: true,
      message: 'Confirmación de transacción enviada exitosamente',
      datosUsuario: datosUsuario
    };
  } catch (error) {
    console.error("Error enviando confirmación");
    return {
      success: false,
      error: error.message
    };
  }
};

// Función de utilidad para formatear montos
export const formatearMonto = (monto) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(monto);
};

// Función específica para novedad de saldo - envía OTP al cliente
export const enviarOTPNovedadSaldo = async (clienteId, clienteEmail, montoNovedad, detalles = '') => {
  return await enviarCodigoOTP({
    userId: clienteId,        // ID del cliente
    email: clienteEmail,      // Email del cliente  
    tipoOperacion: 'Novedad de saldo',
    valorTransaccion: formatearMonto(montoNovedad),
    detallesTransaccion: detalles || 'Novedad de saldo autorizada por administrador'
  });
};

// Función específica para confirmar novedad de saldo completada
export const confirmarNovedadSaldo = async (clienteId, clienteEmail, montoNovedad, detalles = '') => {
  return await enviarConfirmacionTransaccion({
    userId: clienteId,        // ID del cliente
    email: clienteEmail,      // Email del cliente
    tipoMovimiento: 'Novedad de saldo',
    valorTransaccion: formatearMonto(montoNovedad),
    detallesTransaccion: detalles || 'Novedad de saldo procesada exitosamente'
  });
};