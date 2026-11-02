-- ============================================================================
-- Rollback de 03. Novedad de saldo con OTP del lado del servidor
--
-- Elimina las funciones y las tablas creadas por la migración. No toca
-- `ahorros` ni `transactions`: los movimientos ya aplicados se conservan.
--
-- Si se ejecuta después de haber aplicado novedades reales, se pierde la
-- trazabilidad de solicitudes y eventos. Exporta ambas tablas antes.
-- ============================================================================

begin;

drop function if exists public.aplicar_novedad_saldo(uuid);
drop function if exists public.verificar_otp_novedad(uuid, text);
drop function if exists public.registrar_otp_novedad(uuid, text, integer);
drop function if exists public.crear_novedad_saldo(uuid, text, numeric, text, uuid);

drop table if exists public.novedades_saldo_eventos;
drop table if exists public.novedades_saldo;

drop function if exists public.touch_novedad_saldo_updated_at();

commit;
