-- Seed MOCK para supabase clon sshwmioyfhgmaxunffgq
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Este seed refleja exactamente lo que espera el admin:
-- FondosIndependientes.tsx:116 SavingsType='Linea de Ahorro Los Mejores', montoTotal>=200000
-- PortafolioServicios usa Services, EstadoGeneral usa habilitar_credito
-- No toca auth.users (crear usuarios auth a mano después, ver PASO 4)

-- 0. Limpiar mocks previos (opcional, comentar si no quieres borrar)
-- delete from confirmacionretiros where firestore_id like 'mock%';
-- delete from transactions where firestore_id like 'mock%';
-- delete from ahorros where firestore_id like 'mock%';
-- delete from cdats where firestore_id like 'mock%';
-- delete from habilitar_credito where firestore_id like 'mock%';
-- delete from services where firestore_id like 'mock%';

-- Necesitas primero tener al menos 1 empresa
insert into empresa (id, firestore_id, nit, razonsocial, correo, ciudad, departamento, pais, direccion, telefono1, created_at, updated_at)
values 
  (gen_random_uuid(), 'mock_empresa_1', '900123456-1', 'Alianza Solidaria Mock', 'mock@alianzasolidaria.com', 'Bogotá', 'Cundinamarca', 'Colombia', 'Calle 100 # 15-20', '6011234567', now(), now()),
  (gen_random_uuid(), 'mock_empresa_2', '800987654-2', 'Tech Solutions Mock', 'mock@techsolutions.com', 'Medellín', 'Antioquia', 'Colombia', 'Carrera 50 # 40-10', '6049876543', now(), now())
on conflict (id) do nothing;

-- Guardar IDs de empresas para FK (los reutilizamos por nombre)
-- Para user_profiles necesitamos ids que coincidan con auth.users si quieres login.
-- OPCION A: mocks sin login (solo visualización en ConsultarUsuarios, Fondos, etc.)
-- Creamos 3 user_profiles con uuids fijos para referenciar desde ahorros

-- UUIDs fijos para mocks (cambiar si ya existen)
-- a0000000-0000-0000-0000-000000000001 etc.

insert into user_profiles (id, firestore_id, email, display_name, user_type, phone_number, nit, verification_pdf, confirmacion_verificado, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'mock_user_1', 'mock1@alianza.com', 'David Isaac Alcántara Avalos', 'Basic User', '573001112233', '123123123', 'mock_verification.pdf', false, now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'mock_user_2', 'mock2@alianza.com', 'Luz Indyra Trinidad Camargo', 'Basic User', '573112937733', '24230842', 'mock_verification2.pdf', false, now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'mock_user_3', 'mock_admin@alianza.com', 'Admin Mock', 'Admin', '573009998877', '999888777', null, true, now(), now())
on conflict (id) do nothing;

-- services (PortafolioServicios.tsx:87 TypesOfProductName, EA, MV, ServiceMainType)
insert into services (id, firestore_id, types_of_product_name, ea, mv, service_main_type, created_at, updated_at)
values
  (gen_random_uuid(), 'mock_service_1', 'Cuenta Los Mejores Mock', 9.5, 0.76, 'Ahorros', now(), now()),
  (gen_random_uuid(), 'mock_service_2', 'Crédito de Libranza Mock', 18.0, 1.39, 'Credito', now(), now()),
  (gen_random_uuid(), 'mock_service_3', 'CDAT 90 días Mock', 8.0, 0.64, 'CDAT', now(), now())
on conflict (id) do nothing;

-- ahorros (FondosIndependientes.tsx:116 requiere SavingsType='Linea de Ahorro Los Mejores', monto_total>=200000, ahorros_doc_pdf1 !='')
insert into ahorros (id, firestore_id, user_ref, user_id, user_name, user_email, user_telephone_number, user_nit, savings_type, monto_total, total_saving_value, total_deposits, ahorros_doc_pdf1, compay_name, company_nit, company, tipo_cuenta_name, ea, fechacreacion, created_at, updated_at, transactions, last_deposit)
values
  (gen_random_uuid(), 'mock_ahorro_1', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'David Isaac Alcántara Avalos', 'mock1@alianza.com', '573001112233', '123123123', 'Linea de Ahorro Los Mejores', 8500000, 8500000, 8500000, 'https://example.com/mock_doc1.pdf', 'Alianza Solidaria Mock', '900123456-1', (select id::text from empresa where nit='900123456-1' limit 1), 'Los Mejores', 9.5, now() - interval '30 days', now(), now(), '[]'::jsonb, now()),
  (gen_random_uuid(), 'mock_ahorro_2', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Luz Indyra Trinidad Camargo', 'mock2@alianza.com', '573112937733', '24230842', 'Linea de Ahorro Los Mejores', 420000, 420000, 420000, 'https://example.com/mock_doc2.pdf', 'Tech Solutions Mock', '800987654-2', (select id::text from empresa where nit='800987654-2' limit 1), 'Los Mejores', 9.5, now() - interval '15 days', now(), now(), '[]'::jsonb, now()),
  (gen_random_uuid(), 'mock_ahorro_3', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'David Isaac Alcántara Avalos', 'mock1@alianza.com', '573001112233', '123123123', 'Linea de Ahorro de nómina', 1200000, 1200000, 1200000, '', 'Alianza Solidaria Mock', '900123456-1', (select id::text from empresa where nit='900123456-1' limit 1), 'Nómina', 5.0, now() - interval '60 days', now(), now(), '[]'::jsonb, now())
on conflict (id) do nothing;

-- transactions (src/firebase/database.js:219 requiere ahorros_id, transaction_type Depositado/Withdrawal, status APPROVED, firebase_date, amount)
-- Usamos los ahorros mock creados arriba: tomar ids dinámicamente pero aquí con subselect
-- Para simplificar: insertamos 5 transacciones enlazadas a mock_ahorro_1 y mock_ahorro_2

-- Transacciones mock: 3 depósitos APPROVED + 2 retiros
with ahorro_ids as (
  select id, firestore_id from ahorros where firestore_id in ('mock_ahorro_1','mock_ahorro_2')
)
insert into transactions (id, firestore_id, amount, status, transaction_type, ahorros_id, firebase_date, currency, created_at, updated_at)
select gen_random_uuid(), 'mock_tx_dep_' || row_number() over (), 500000, 'APPROVED', 'Depositado', (select id from ahorros where firestore_id='mock_ahorro_1' limit 1), now() - interval '20 days', 'COP', now(), now() union all
select gen_random_uuid(), 'mock_tx_dep2', 300000, 'APPROVED', 'Depositado', (select id from ahorros where firestore_id='mock_ahorro_1' limit 1), now() - interval '10 days', 'COP', now(), now() union all
select gen_random_uuid(), 'mock_tx_dep3', 200000, 'APPROVED', 'Depositado', (select id from ahorros where firestore_id='mock_ahorro_2' limit 1), now() - interval '5 days', 'COP', now(), now() union all
select gen_random_uuid(), 'mock_tx_ret1', 150000, 'APPROVED', 'Withdrawal', (select id from ahorros where firestore_id='mock_ahorro_1' limit 1), now() - interval '2 days', 'COP', now(), now() union all
select gen_random_uuid(), 'mock_tx_pend1', 80000, 'PENDING', 'Withdrawal', (select id from ahorros where firestore_id='mock_ahorro_2' limit 1), now() - interval '1 day', 'COP', now(), now();

-- cdats (cdats table tiene idusuario uuid, inversion, ea, tiempo, rendimiento)
insert into cdats (id, firestore_id, idusuario, inversion, ea, tiempo, rendimiento, created_at, updated_at)
values
  (gen_random_uuid(), 'mock_cdat_1', 'a0000000-0000-0000-0000-000000000001', 5000000, 8.5, 90, 105000, now(), now()),
  (gen_random_uuid(), 'mock_cdat_2', 'a0000000-0000-0000-0000-000000000002', 10000000, 9.0, 180, 440000, now(), now())
on conflict (id) do nothing;

-- confirmacionretiros (subcolección de cdats) -> id_cdat es integer, usar null para mock
insert into confirmacionretiros (id, firestore_id, monto, tipodeoperacion, estados, fecharetiro, nombreusuario, nitusuario, celusuario, emailusuario, fecha_solicitud, created_at, updated_at)
values (gen_random_uuid(), 'mock_conf_1', 100000, 'Retiro parcial', 'PENDING', now() - interval '3 days', 'David Isaac Alcántara Avalos', '123123123', '573001112233', 'mock1@alianza.com', now() - interval '3 days', now(), now());

-- habilitar_credito (EstadoGeneral.tsx:270 estado='inicio de solicitud' o 'En estudio', tipodecredito, fecha_solicitud, uid)
insert into habilitar_credito (id, firestore_id, uid, user_ref, tipodecredito, estado, fecha_solicitud, empresa, antiguedad_empresa, habilitar, created_at, updated_at)
values
  (gen_random_uuid(), 'mock_hab_1', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Crédito de libranza', 'inicio de solicitud', now() - interval '5 days', 'Alianza Solidaria Mock', now() - interval '2 years', true, now(), now()),
  (gen_random_uuid(), 'mock_hab_2', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Libre inversión', 'En estudio', now() - interval '10 days', 'Tech Solutions Mock', now() - interval '1 year', true, now(), now())
on conflict (id) do nothing;

-- Verificación: conteo mocks
select 'ahorros' as tabla, count(*) from ahorros where firestore_id like 'mock%' union all
select 'transactions', count(*) from transactions where firestore_id like 'mock%' union all
select 'cdats', count(*) from cdats where firestore_id like 'mock%' union all
select 'habilitar_credito', count(*) from habilitar_credito where firestore_id like 'mock%' union all
select 'services', count(*) from services where firestore_id like 'mock%';
