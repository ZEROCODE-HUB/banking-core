-- Borrar mocks hardcodeados y crear datos REALES en Supabase para cedula 123123123
-- Ejecutar en SQL Editor

-- 1. Crear tabla vehiculos si no existe (no estaba en las 31 tablas)
create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  placa text not null,
  titular text,
  tipo text check (tipo in ('carro','moto')),
  soat jsonb,
  tecnicomecanica jsonb,
  seguro jsonb,
  firestore_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS off para pruebas (luego crear policies)
alter table public.vehiculos disable row level security;

-- 2. Limpiar vehiculos mock previos para 123123123
delete from public.vehiculos where user_id='a0000000-0000-0000-0000-000000000001';

-- Insertar 2 vehículos REALES para 123123123
insert into public.vehiculos (id, user_id, placa, titular, tipo, soat, tecnicomecanica, seguro, firestore_id)
values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'VUS-123', 'David Isaac Alcántara Avalos', 'carro',
   '{"tipo":"Por crédito","estado":"Activo","fechaCompra":"12/12/2025","fechaVencimiento":"12/12/2026","valor":"$ 10,000.00","proximoPago":"$ 5,000.00","documento":"SOAT_VUS123.pdf"}'::jsonb,
   '{"tipo":"Línea de Ahorro","estado":"Activo","fechaCompra":"12/12/2025","fechaVencimiento":"12/12/2026","documento":"TECNICO_VUS123.pdf"}'::jsonb,
   '{"tipo":"Línea de Ahorro","estado":"Activo","fechaCompra":"12/12/2025","aseguradora":"Pacificos S.A","documento":"SEGURO_VUS123.pdf"}'::jsonb,
   'vehiculo_real_123_1'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'HKL-612', 'David Isaac Alcántara Avalos', 'moto',
   '{"tipo":"Por crédito","estado":"Activo","fechaCompra":"10/01/2026","fechaVencimiento":"10/01/2027","valor":"$ 8,500.00","proximoPago":"$ 4,200.00","documento":"SOAT_HKL612.pdf"}'::jsonb,
   '{"tipo":"Línea de Ahorro","estado":"Activo","fechaCompra":"10/01/2026","fechaVencimiento":"10/01/2027","documento":"TECNICO_HKL612.pdf"}'::jsonb,
   '{"tipo":"Línea de Ahorro","estado":"Activo","fechaCompra":"10/01/2026","aseguradora":"Sura","documento":"SEGURO_HKL612.pdf"}'::jsonb,
   'vehiculo_real_123_2');

-- 3. Comentarios: tabla comentarios existente solo tiene id,firestore_id -> añadir columnas si faltan
alter table public.comentarios add column if not exists user_id uuid references public.user_profiles(id);
alter table public.comentarios add column if not exists autor text;
alter table public.comentarios add column if not exists texto text;
alter table public.comentarios add column if not exists tipo text;
alter table public.comentarios disable row level security;

delete from public.comentarios where firestore_id like 'mock_com_123%';

insert into public.comentarios (id, firestore_id, user_id, autor, texto, tipo, created_at, updated_at)
values
  (gen_random_uuid(), 'com_real_123_1', 'a0000000-0000-0000-0000-000000000001', 'Asesor Alianza', 'Cliente contactado para validación de documentos. Compromiso de entrega 15/01/2026.', 'Gestión', now() - interval '2 days', now()),
  (gen_random_uuid(), 'com_real_123_2', 'a0000000-0000-0000-0000-000000000001', 'Admin Mock', 'Se verificó ingresos y capacidad de ahorro. Perfil aprobado para crédito libranza.', 'Verificación', now() - interval '1 day', now()),
  (gen_random_uuid(), 'com_real_123_3', 'a0000000-0000-0000-0000-000000000001', 'Sistema', 'Información adicional actualizada: dirección y referencias verificadas.', 'Sistema', now(), now());

-- 4. Verificación
select 'vehiculos' as tabla, count(*) from public.vehiculos where user_id='a0000000-0000-0000-0000-000000000001' union all
select 'comentarios', count(*) from public.comentarios where user_id='a0000000-0000-0000-0000-000000000001';
select placa, tipo, soat->>'aseguradora' as aseguradora from public.vehiculos where user_id='a0000000-0000-0000-0000-000000000001';
select autor, texto from public.comentarios where user_id='a0000000-0000-0000-0000-000000000001' order by created_at;
