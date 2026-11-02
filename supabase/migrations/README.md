# Roles, verificación y RLS

Estas migraciones acompañan al cambio de código de roles. El binario funciona
antes y después de aplicarlas: detecta si existen `role` y `verification_status`
y, si no, usa el esquema heredado (`user_type`, `confirmacion_verificado`).

## Decisión de esta fase

RLS queda **desactivado**. La migración de RLS está en `supabase/deferred/` y no
se ejecuta con `supabase db push`, porque esa carpeta no es la de migraciones
activas. Se retomará en una fase de endurecimiento para todas las tablas.

Sí se aplica ahora la guardia de cambios de rol: no es RLS, pero impide que una
sesión que no sea CRM SuperAdmin cambie roles desde la API.

## Orden de aplicación

1. `20261102_01_roles.sql` — esquema de roles, verificación y auditoría.
2. `20261102_02_role_guard.sql` — trigger que protege los cambios de rol.
3. **No aplicar** `deferred/20261102_03_rls.sql` en esta fase.

La segunda migración depende de la primera. Ambas están dentro de una
transacción y son seguras de ejecutar en ese orden.

## Cómo aplicarlas

En el panel de Supabase, abrir **SQL Editor**, pegar el contenido de
`20261102_01_roles.sql`, ejecutarlo, y repetir con
`20261102_02_role_guard.sql`.

Con la CLI de Supabase, desde la raíz del repositorio:

```bash
supabase db push
```

La CLI solo toma `supabase/migrations/`, así que aplicará 01 y 02 y dejará
`supabase/deferred/03` fuera.

No hace falta la `service_role` key en el frontend. La aplicación sigue usando la
clave anónima con la sesión del usuario.

Después de ejecutar las migraciones, recargar el caché de esquema de PostgREST:

```sql
notify pgrst, 'reload schema';
```

## Verificación después de `01`

```sql
-- Columnas nuevas.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
  and column_name in ('role', 'verification_status', 'verification_reviewed_by', 'verification_reviewed_at')
order by column_name;

-- Todos los perfiles deben tener un rol canónico.
select role, count(*) from public.user_profiles group by role order by role;

-- La cola debe mostrar los expedientes enviados, no los roles.
select email, role, verification_status
from public.user_profiles
where verification_status = 'submitted'
order by email;

-- Andrés tenía documento pero ningún rol; ahora debe aparecer.
select email, role, verification_status
from public.user_profiles
where email = 'andres@zerocode.la';
```

Resultado esperado: ningún `role` nulo; valores solo entre `crm_superadmin`,
`admin`, `supervisor` y `customer`; Andrés en `submitted`; la cola con tres
expedientes (los dos mock y Andrés).

## Verificación después de `02`

```sql
-- El trigger debe existir.
select tgname
from pg_trigger
where tgname = 'user_profiles_enforce_role_change';
```

Prueba funcional, con la aplicación:

| Caso | Resultado esperado |
|---|---|
| CRM SuperAdmin cambia un rol desde `/personas/roles` | permitido y aparece en `role_audit` |
| CRM SuperAdmin intenta quitarse el último rol | bloqueado |
| Sesión que no es superadmin intenta cambiar `role` por API | bloqueado por el trigger |
| Sesión que no es superadmin abre `/personas/roles` por URL | redirige a `/dashboard` |

## Qué queda pendiente hasta la fase de RLS

Con RLS desactivado, la base de datos todavía acepta lecturas y escrituras de
cualquier sesión autenticada sobre las tablas de negocio. La guardia de rol solo
protege la columna `role`; no protege saldos, transacciones, vehículos ni
comentarios. Los guards de ruta y los botones ocultos son presentación, no un
límite de seguridad.

La migración diferida `deferred/20261102_03_rls.sql` cierra ese hueco. Antes de
aplicarla hay que probarla en staging y revisar la matriz de roles.

## Rollback

- `20261102_02_role_guard_rollback.sql` elimina el trigger y los helpers.
- `20261102_01_roles_rollback.sql` devuelve `role` a `user_type` y elimina
  `verification_status` y `role_audit`.

Ejecutar primero el rollback de 02 y después el de 01. No ejecutar el rollback de
02 si la migración de RLS ya está aplicada: esa migración reutiliza los helpers.

## Notas de diseño

- `role` responde “qué puede hacer esta cuenta”. `verification_status` responde
  “en qué punto está su expediente”. No se mezclan.
- Un rol ausente o desconocido no concede nada. El valor por defecto es
  `customer`.
- `confirmacion_verificado` se conserva como espejo de compatibilidad mientras
  termina la transición. La fuente nueva es `verification_status`.
- La auditoría se escribe desde la aplicación al cambiar un rol. Un `update`
  manual por SQL no genera fila de auditoría; el trigger solo impide que un
  usuario sin permiso cambie roles o que se elimine el último superadministrador.
- La guardia de rol permite cambios sin JWT (SQL Editor) y con `service_role`,
  para no bloquear migraciones o recuperación manual.
