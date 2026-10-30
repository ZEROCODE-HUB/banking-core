require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'notificaciones@alianzasolidaria.co';

sgMail.setApiKey(SENDGRID_API_KEY);

const otpTemplate = (data) => `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Código OTP transacción interna</title></head><body style="margin:0;padding:20px;background-color:#f5f5f5;font-family:Arial,sans-serif"><div style="max-width:700px;margin:0 auto;background-color:#ffffff;padding:40px"><p style="font-size:14px;color:#000;line-height:1.6;margin:20px 0"><b>CODIGO DE VALIDACION DE TRANSACCION</b></p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Asunto: Código OTP transacción interna (<b>${data.nombreUsuario}</b>)</p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Para completar la validación de la transacción que está realizando en su cuenta de Alianza Capital, le enviamos su código de verificación:</p><div style="text-align:center;margin:30px 0"><span style="font-size:40px;font-weight:bold;letter-spacing:2px">${data.otp}</span><p style="margin-top:10px;font-size:14px">Código OTP</p></div><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Este código es personal y de un solo uso. Por motivos de seguridad, <b>no lo comparta con nadie</b>, ni siquiera con personal de Alianza Capital.</p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Si usted no ha iniciado esta operación, comuníquese de inmediato con nuestro equipo de soporte.</p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0"><b>Detalles de la transacción:</b></p><p style="font-size:14px;color:#333;line-height:1.6;margin:5px 0">Tipo de operación: <b>${data.tipoOperacion}</b><br>Valor: <b>${data.valorTransaccion}</b><br>Id transacción: <b>${data.idTransaccion}</b><br>Nombre de usuario: <b>${data.nombreUsuario}</b><br>Detalles: <b>${data.detallesTransaccion}</b></p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Gracias por ayudarnos a mantener la seguridad de su cuenta.</p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0"><b>Equipo Alianza Capital</b><br>www.alianzacapital.com<br>info@alianzacapital.co</p><p style="font-size:13px;color:#666;font-style:italic">Este es un mensaje automático, por favor no lo responda directamente.</p></div></body></html>`;

const confirmationTemplate = (data) => `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Transacción Completada</title></head><body style="margin:0;padding:20px;background-color:#f5f5f5;font-family:Arial,sans-serif"><div style="max-width:700px;margin:0 auto;background-color:#ffffff;padding:40px"><p style="font-size:14px;color:#000;line-height:1.6;margin:20px 0"><b>TRANSACCIÓN COMPLETADA EXITOSAMENTE</b></p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Hola <b>${data.nombreUsuario}</b>, tu <b>${data.tipoMovimiento}</b> fue procesada exitosamente.</p><p style="font-size:14px;color:#333;line-height:1.6;margin:5px 0">Valor: <b>${data.valorTransaccion}</b><br>ID transacción: <b>${data.idTransaccion}</b><br>Fecha: <b>${data.fecha}</b><br>Detalles: <b>${data.detallesTransaccion}</b></p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0">Gracias por confiar en nuestros servicios.</p><p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0"><b>Equipo Alianza Capital</b><br>www.alianzacapital.com<br>info@alianzacapital.co</p><p style="font-size:13px;color:#666;font-style:italic">Este es un mensaje automático, por favor no lo responda directamente.</p></div></body></html>`;

app.post('/send-otp', async (req, res) => {
    try {
        const { email, otp, nombreUsuario, tipoOperacion, valorTransaccion, idTransaccion, detallesTransaccion } = req.body;
        const msg = {
            to: email,
            from: FROM_EMAIL,
            subject: `Código OTP transacción interna`,
            html: otpTemplate({ nombreUsuario, otp, tipoOperacion, valorTransaccion, idTransaccion, detallesTransaccion }),
        };
        await sgMail.send(msg);
        res.json({ success: true, message: 'OTP enviado exitosamente' });
    } catch (error) {
        console.error('❌ Error enviando OTP');
        res.status(500).json({ success: false, error: error.response?.body?.errors?.[0]?.message || error.message });
    }
});

app.post('/send-confirmation', async (req, res) => {
    try {
        const data = req.body;
        const msg = {
            to: data.email,
            from: FROM_EMAIL,
            subject: `Transacción completada - Alianza Capital`,
            html: confirmationTemplate({ ...data, fecha: data.fecha || new Date().toLocaleDateString('es-CO') }),
        };
        await sgMail.send(msg);
        res.json({ success: true, message: 'Confirmación enviada exitosamente' });
    } catch (error) {
        console.error('❌ Error enviando confirmación');
        res.status(500).json({ success: false, error: error.response?.body?.errors?.[0]?.message || error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    process.stdout.write(`Servidor SendGrid escuchando en el puerto ${PORT}\n`);
});