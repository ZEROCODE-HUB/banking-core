-- ============================================================================
-- Rollback de 05. Rechazo atómico de retiros de ahorro
--
-- Elimina la función `rechazar_retiro`. No revierte retiros ya rechazados ni
-- saldos ya devueltos. El código de la aplicación debe volver a la versión
-- anterior en el mismo despliegue.
-- ============================================================================

begin;

drop function if exists public.rechazar_retiro(uuid, text);

commit;
