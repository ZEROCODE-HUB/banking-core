import 'dotenv/config';

process.on('uncaughtException', (err) => { console.error('ERROR:', err); });
process.on('unhandledRejection', (err) => { console.error('REJECTION:', err); });

import express from 'express';
import cors from 'cors';
import sgMail from '@sendgrid/mail';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'notificaciones@alianzasolidaria.co'; // ✅ Email verificado en SendGrid

sgMail.setApiKey(SENDGRID_API_KEY);

// Template HTML para OTP
const otpTemplate = (data) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Verificación - Alianza Capital</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .otp-code { font-size: 36px; font-weight: bold; text-align: center; background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 6px; color: #1976d2; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Código de Verificación OTP</h2>
            <p>Alianza Capital - Core Bancario</p>
        </div>
        <div class="content">
            <h3>Hola ${data.nombreUsuario},</h3>
            <p>Se ha solicitado una <strong>${data.tipoOperacion}</strong> en la cuenta de ahorro.</p>
            <div class="otp-code">${data.otp}</div>
            <p><strong>⚠️ Importante:</strong> Este código es válido por 10 minutos y es de un solo uso.</p>
            <div class="details">
                <h4>Detalles de la transacción:</h4>
                <p><strong>Valor:</strong> ${data.valorTransaccion}</p>
                <p><strong>ID Transacción:</strong> ${data.idTransaccion}</p>
                <p><strong>Detalles:</strong> ${data.detallesTransaccion}</p>
            </div>
            <p>Si no solicitaste esta operación, contacta inmediatamente con soporte.</p>
        </div>
        <div class="footer">
            <p>© 2026 Alianza Capital. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
`;

// Template HTML para confirmación
const confirmationTemplate = (data) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transacción Completada - Alianza Capital</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>✅ Transacción Completada</h2>
            <p>Alianza Capital - Core Bancario</p>
        </div>
        <div class="content">
            <h3>Hola ${data.nombreUsuario},</h3>
            <p>Tu <strong>${data.tipoMovimiento}</strong> ha sido procesada exitosamente.</p>
            <div class="details">
                <h4>Detalles:</h4>
                <p><strong>Valor:</strong> ${data.valorTransaccion}</p>
                <p><strong>ID Transacción:</strong> ${data.idTransaccion}</p>
                <p><strong>Fecha:</strong> ${data.fecha}</p>
                <p><strong>Detalles:</strong> ${data.detallesTransaccion}</p>
            </div>
            <p>Gracias por confiar en nuestros servicios.</p>
        </div>
        <div class="footer">
            <p>© 2026 Alianza Capital. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
`;

// Endpoint para enviar OTP
app.post('/send-otp', async (req, res) => {
    try {
        const { email, otp, nombreUsuario, tipoOperacion, valorTransaccion, idTransaccion, detallesTransaccion } = req.body;

        console.log(`📧 Enviando OTP a: ${email} - Código: ${otp}`);

        const msg = {
            to: email,
            from: FROM_EMAIL, // ✅ Email verificado
            subject: `Código de Verificación OTP - Alianza Capital`,
            html: otpTemplate({ nombreUsuario, otp, tipoOperacion, valorTransaccion, idTransaccion, detallesTransaccion }),
            // ✅ SANDBOX_MODE DESACTIVADO - envío real
        };

        await sgMail.send(msg);
        console.log(`✅ OTP enviado exitosamente a: ${email}`);

        res.json({ success: true, message: 'OTP enviado exitosamente' });

    } catch (error) {
        console.error('❌ Error enviando OTP:', error.response?.body || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.body?.errors?.[0]?.message || error.message
        });
    }
});

// Endpoint para enviar confirmación
app.post('/send-confirmation', async (req, res) => {
    try {
        const data = req.body;

        const msg = {
            to: data.email,
            from: FROM_EMAIL, // ✅ Email verificado
            subject: `Transacción completada - ${data.idTransaccion} - Alianza Capital`,
            html: confirmationTemplate({
                ...data,
                fecha: data.fecha || new Date().toLocaleDateString('es-CO')
            }),
        };

        await sgMail.send(msg);
        console.log(`✅ Confirmación enviada a: ${data.email}`);

        res.json({ success: true, message: 'Confirmación enviada exitosamente' });

    } catch (error) {
        console.error('❌ Error enviando confirmación:', error.response?.body || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.body?.errors?.[0]?.message || error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor SendGrid corriendo en http://localhost:${PORT}`);
    console.log(`📧 From: ${FROM_EMAIL}`);
    console.log(`📬 Endpoints: POST /send-otp | POST /send-confirmation`);
});