# Roles, verificación y RLS

Estas migraciones acompañan al cambio de código de roles. El binario funciona
antes y después de aplicarlas: detecta si existen `role` y `verification_status`
y, si no, usa el esquema heredado (`user_type`, `confirmacion_verificado`).

## Orden de aplicación

1. `20261102_01_roles.sql` — puede aplicarse ahora.
2. `20261102_02_rls.sql` — **solo después de probarla en staging**.

La segunda migración activa RLS y revoca el acceso anónimo. Aplicarla por primera
vez directamente en producción puede dejar sin acceso a una pantalla que no
estuvimos en condiciones de probar.

## Cómo aplicarlas

Con la CLI de Supabase, desde la raíz del repositorio:

```bash
supabase db push
```

O, en el panel de Supabase, abrir **SQL Editor**, pegar el contenido del archivo
`01`, ejecutarlo, y repetir con `02`.

No hace falta la `service_role` key en el frontend. La aplicación sigue usando la
clave anónima con la sesión del usuario; RLS decide qué puede hacer esa sesión.

## Verificación después de `01`

```sql
-- Todos los perfiles deben tener un rol canónico.
select role, count(*) from public.user_profiles group by role;

-- La cola debe mostrar los expedientes enviados, no los roles.
select email, role, verification_status
from public.user_profiles
where verification_status = 'submitted';

-- Andrés tenía documento pero ningún rol; ahora debe aparecer.
select email, role, verification_status
from public.user_profiles
where email = 'andres@zerocode.la';
```

Resultado esperado: ningún `role` nulo, ningún valor fuera de
`crm_superadmin`, `admin`, `supervisor`, `customer`, y Andrés en `submitted`.

## Verificación después de `02`

Iniciar sesión con cada rol y confirmar:

| Caso | Resultado esperado |
|---|---|
| Sin sesión, leer `user_profiles` con la clave anónima | 0 filas o error de permiso |
| Cliente abre `/personas/verificaciones` por URL | redirige a `/dashboard` |
| Cliente abre `/personas/roles` por URL | redirige a `/dashboard` |
| Supervisor aprueba una verificación | permitido |
| Supervisor intenta cambiar un rol | bloqueado por el trigger |
| CRM SuperAdmin cambia un rol | permitido y aparece en `role_audit` |
| CRM SuperAdmin intenta quitarse el último rol | bloqueado |

Si algo falla, ejecutar `20261102_02_rls_rollback.sql` y luego, si es necesario,
`20261102_01_roles_rollback.sql`. El rollback de `02` restaura los grants
permisivos anteriores; úsalo solo como recuperación temporal.

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
- Las tablas de negocio quedan restringidas al personal porque este repositorio
  es una consola interna. Cuando exista un portal de clientes harán falta
  políticas de lectura por propietario.
