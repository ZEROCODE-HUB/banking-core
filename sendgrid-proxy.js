import 'dotenv/config';
import http from 'http';
import https from 'https';
import url from 'url';

const PORT = 3001;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// Template para código OTP
const OTP_TEMPLATE = {
  "from": {
    "email": "notificaciones@alianzacapital.co"
  },
  "reply_to": {
    "email": "info@alianzacapital.co"
  },
  "content": [
    {
      "type": "text/html",
      "value": "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Código OTP transacción interna</title></head><body style=\"margin:0;padding:20px;background-color:#f5f5f5;font-family:Arial,sans-serif\"><div style=\"max-width:700px;margin:0 auto;background-color:#ffffff;padding:40px\"><p style=\"font-size:14px;color:#000;line-height:1.6;margin:20px 0\"><b>CODIGO DE VALIDACION DE TRANSACCION</b></p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Asunto: Código OTP transacción interna ({{nombreUsuario}})</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Para completar la validación de la transacción que está realizando en su cuenta de Alianza Capital, le enviamos su código de verificación:</p><div style=\"text-align:center;margin:30px 0\"><span style=\"font-size:40px;font-weight:bold;letter-spacing:2px\">{{otp}}</span><p style=\"margin-top:10px;font-size:14px\">Código OTP</p></div><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Este código es personal y de un solo uso. Por motivos de seguridad, <b>no lo comparta con nadie</b>, ni siquiera con personal de Alianza Capital.</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Si usted no ha iniciado esta operación, comuníquese de inmediato con nuestro equipo de soporte.</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\"><b>Detalles de la transacción:</b></p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:5px 0\">Tipo de operación: <b>{{tipoOperacion}}</b><br>Valor: <b>{{valorTransaccion}}</b><br>Id transacción: <b>{{idTransaccion}}</b><br>Nombre de usuario: <b>{{nombreCompleto}}</b><br>Numero documento: <b>{{numeroDocumento}}</b><br>Tipo de documento: <b>{{tipoDocumento}}</b><br>Cuenta: <b>{{lineaAhorro}} {{numeroDocumento}}</b></p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Detalles de transacción: <b>{{detallesTransaccion}}</b></p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Gracias por ayudarnos a mantener la seguridad de su cuenta.</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\"><b>Equipo Alianza Capital</b><br>www.alianzacapital.com<br>info@alianzacapital.co</p><p style=\"font-size:13px;color:#666;line-height:1.6;margin:20px 0;font-style:italic\">Este es un mensaje automático, por favor no lo responda directamente.</p></div></body></html>"
    }
  ]
};

// Template para confirmación de transacción
const CONFIRMATION_TEMPLATE = {
  "from": {
    "email": "notificaciones@alianzacapital.co"
  },
  "reply_to": {
    "email": "info@alianzacapital.co"
  },
  "content": [
    {
      "type": "text/html", 
      "value": "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Notificación de movimiento</title></head><body style=\"margin:0;padding:20px;background-color:#f5f5f5;font-family:Arial,sans-serif\"><div style=\"max-width:700px;margin:0 auto;background-color:#ffffff;padding:40px\"><p style=\"font-size:14px;color:#000;line-height:1.6;margin:20px 0\">Estimado(a) <b>{{nombreUsuario}}</b>,</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Le informamos que se ha registrado un movimiento en su cuenta de Alianza Capital el día <b>{{fecha}}</b>:</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\"><b>Detalles del movimiento:</b></p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:5px 0\">Tipo de movimiento: <b>{{tipoMovimiento}}</b><br>Valor: <b>{{valorTransaccion}}</b><br>Id transacción: <b>{{idTransaccion}}</b><br>Cuenta: <b>{{lineaAhorro}} {{numeroCuenta}}</b><br>Detalles: <b>{{detallesTransaccion}}</b></p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Este movimiento fue realizado de manera interna dentro del ecosistema de Alianza Capital y no requiere acción adicional de su parte.</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Puede consultar el detalle completo de la transacción ingresando a su cuenta en la app o plataforma web.</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\">Gracias por confiar en Alianza Capital.</p><p style=\"font-size:14px;color:#333;line-height:1.6;margin:20px 0\"><b>Equipo Alianza Capital</b><br>www.alianzacapital.com<br>info@alianzacapital.co</p><p style=\"font-size:13px;color:#666;line-height:1.6;margin:20px 0;font-style:italic\">Este es un mensaje automático, por favor no lo responda directamente.</p></div></body></html>"
    }
  ]
};

// Función para reemplazar placeholders en template
function replacePlaceholders(template, data) {
  let html = template.content[0].value;
  
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, data[key] || '');
  });
  
  return {
    ...template,
    content: [{ ...template.content[0], value: html }]
  };
}

// Función para generar código OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const server = http.createServer((req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);

        if (req.url === '/send-otp') {
          handleSendOTP(requestData, res);
        } else if (req.url === '/send-confirmation') {
          handleSendConfirmation(requestData, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
        }
        
      } catch (error) {
        console.error('❌ Error parsing JSON');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON inválido: ' + error.message }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Método no permitido' }));
  }
});

// Manejar envío de código OTP
function handleSendOTP(data, res) {
  // Usar el OTP que viene del frontend, no generar uno nuevo
  const otp = data.otp || generateOTP();
  
  // Preparar datos para el template
  const templateData = {
    nombreUsuario: data.nombreUsuario || 'Usuario',
    otp: otp,
    tipoOperacion: data.tipoOperacion || 'Novedad de saldo',
    valorTransaccion: data.valorTransaccion || '$0',
    idTransaccion: data.idTransaccion || 'N/A',
    nombreCompleto: data.nombreCompleto || data.nombreUsuario,
    numeroDocumento: data.numeroDocumento || 'N/A',
    tipoDocumento: data.tipoDocumento || 'CC',
    lineaAhorro: data.lineaAhorro || 'Línea de ahorro',
    numeroCuenta: data.numeroCuenta || 'N/A',
    detallesTransaccion: data.detallesTransaccion || 'Transacción interna'
  };
  
  // Crear email con template personalizado
  const emailTemplate = replacePlaceholders(OTP_TEMPLATE, templateData);
  
  const emailData = {
    "personalizations": [
      {
        "to": [{ "email": data.email }],
        "subject": `Código OTP transacción interna (${data.nombreUsuario || 'Usuario'})`
      }
    ],
    ...emailTemplate
  };
  
  sendEmailToSendGrid(emailData, res);
}

// Manejar envío de confirmación
function handleSendConfirmation(data, res) {
  const templateData = {
    nombreUsuario: data.nombreUsuario || 'Usuario',
    fecha: data.fecha || new Date().toLocaleDateString('es-CO'),
    tipoMovimiento: data.tipoMovimiento || 'Movimiento interno',
    valorTransaccion: data.valorTransaccion || '$0',
    idTransaccion: data.idTransaccion || 'N/A',
    lineaAhorro: data.lineaAhorro || 'Línea de ahorro',
    numeroCuenta: data.numeroCuenta || 'N/A',
    detallesTransaccion: data.detallesTransaccion || 'Transacción completada'
  };
  
  const emailTemplate = replacePlaceholders(CONFIRMATION_TEMPLATE, templateData);
  
  const emailData = {
    "personalizations": [
      {
        "to": [{ "email": data.email }],
        "subject": `${data.tipoMovimiento || 'Movimiento'} por ${data.valorTransaccion || '$0'} en su cuenta Alianza Capital`
      }
    ],
    ...emailTemplate
  };
  
  sendEmailToSendGrid(emailData, res);
}

// Enviar email a SendGrid
function sendEmailToSendGrid(emailData, res) {
  const sendGridData = JSON.stringify(emailData);
  
  const options = {
    hostname: 'api.sendgrid.com',
    port: 443,
    path: '/v3/mail/send',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(sendGridData)
    }
  };

  // Hacer la petición a SendGrid
  const sgReq = https.request(options, (sgRes) => {
    let responseData = '';

    sgRes.on('data', (chunk) => {
      responseData += chunk;
    });
    
    sgRes.on('end', () => {
      const success = sgRes.statusCode >= 200 && sgRes.statusCode < 300;
      
      if (!success) {
        console.error('❌ Error en SendGrid');
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: success,
        status: sgRes.statusCode,
        message: success ? 'Email enviado exitosamente' : 'Error enviando email',
        data: responseData
      }));
    });
  });

  sgReq.on('error', (error) => {
    console.error('💥 Error de conexión con SendGrid');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: error.message
    }));
  });

  sgReq.write(sendGridData);
  sgReq.end();
}

server.listen(PORT, () => {
  process.stdout.write(`Servidor proxy SendGrid escuchando en el puerto ${PORT}\n`);
});