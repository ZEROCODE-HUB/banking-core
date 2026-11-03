# Novedad de saldo v1 — flujo del servidor

## Objetivo

Mover la generación y validación del OTP fuera del navegador y aplicar el
movimiento de saldo y la transacción en una sola operación de base de datos.

## Flujo

1. El operador (staff) completa el formulario y pulsa **Autorización OTP**.
2. El navegador llama a `POST /novedad-saldo/solicitar-otp` en el proxy de
   correo, enviando su JWT de Supabase y un `idempotencyKey` por formulario.
3. El proxy:
   - valida el JWT y el rol del operador;
   - crea la solicitud con `crear_novedad_saldo` usando el JWT del operador, de
     modo que `auth.uid()` sea el actor real;
   - genera un código de seis dígitos;
   - guarda el hash con `registrar_otp_novedad` usando la service role key;
   - envía el código al buzón de operaciones.
4. El navegador recibe solo `novedadId`, `reference` y `expiresAt`. Nunca recibe
   el código.
5. El aprobador escribe el código. El navegador llama a `verificar_otp_novedad`;
   la base compara el hash, controla vencimiento e intentos y marca
   `otp_verified`.
6. El navegador llama a `aplicar_novedad_saldo`. La función bloquea la solicitud
   y la cuenta, valida el saldo, inserta la transacción, actualiza `ahorros` y
   registra el evento. Todo o nada.
7. Si la aplicación fue exitosa, el proxy envía la confirmación al correo del
   cliente. Un fallo del correo no revierte el movimiento.

## Identidades

- **Actor**: se deriva de `auth.uid()` en la base. El navegador no lo elige.
- **Usuario destino**: se deriva de la cuenta de ahorro (`ahorros.user_ref`,
  `user_name`, `user_email`). El navegador tampoco lo elige.

## Reglas

- Crear: `crm_superadmin`, `admin`.
- Verificar y aplicar: `crm_superadmin`, `admin`.
- OTP: seis dígitos, 10 minutos, máximo 5 intentos, reenvío con espera de 30
  segundos.
- Débito: se rechaza si deja `monto_total` en negativo.
- Doble envío de “Finalizar”: devuelve la misma transacción, no duplica.

## Orden de despliegue

1. Aplicar `supabase/migrations/20261102_03_novedades_saldo.sql`.
2. Configurar en el servidor del proxy:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MAIL_PROVIDER` (`resend` o `sendgrid`)
   - la API key del proveedor
   - `NOVEDAD_OTP_EMAIL`
   - `NOVEDAD_OTP_CC` si el OTP debe llevar copia a otra cuenta
3. Reiniciar el proxy.
4. Desplegar el frontend.

Sin el paso 1 el frontend no puede crear ni aplicar novedades. Sin el paso 2 el
proxy responde 503 al pedir el OTP y no envía nada.

## Diagnóstico de correo

El proxy devuelve un mensaje específico para los errores más comunes:

- **Dominio no verificado en Resend:** el remitente debe usar un dominio
  verificado en Resend. Para desarrollo, sin dominio, usa
  `MAIL_FROM=onboarding@resend.dev` y envía solo al correo del propietario de la
  cuenta Resend.
- **Modo de prueba de Resend:** solo permite enviar al correo del propietario.
  Configura `NOVEDAD_OTP_EMAIL` con ese correo y deja `NOVEDAD_OTP_CC` vacío
  mientras no haya un dominio verificado.
- **API key inválida o límite de envíos:** se informa en la respuesta del proxy.
- **Error del correo de confirmación después de aplicar:** la novedad y el saldo
  ya quedaron aplicados; el fallo solo se registra y no revierte el movimiento.

Para producción, verifica `alianzacapital.co` en Resend y vuelve a usar el buzón
de operaciones y la copia configurada. El modo de prueba de Resend no sirve para
entregar al buzón interno si es una dirección distinta a la del propietario.

## Pendientes de negocio

- Confirmar el buzón de operaciones y que el operador que inicia no pueda abrirlo.
- Confirmar si el cliente se notifica siempre o solo en débitos.
- Confirmar si se permite algún sobregiro y quién lo aprueba. La v1 no lo permite.
