-- MOCK COMPLETO para usuario 123123123 (David Isaac Alcántara Avalos) - a0000000-0000-0000-0000-000000000001
-- Ejecutar en SQL Editor después de supabase-mock-seed.sql
-- Crea: 3 líneas ahorro, 2 créditos, 2 CDAT, documentos, comentarios, historial

-- Verificar usuario existe
-- select * from user_profiles where nit='123123123';

-- 1. TERCERA LÍNEA DE AHORRO (ya tiene Los Mejores y Nómina, añadimos Permanente)
insert into ahorros (id, firestore_id, user_ref, user_id, user_name, user_email, user_telephone_number, user_nit, savings_type, monto_total, total_saving_value, total_deposits, ahorros_doc_pdf1, compay_name, company_nit, company, tipo_cuenta_name, ea, fechacreacion, created_at, updated_at, transactions, last_deposit)
values
  (gen_random_uuid(), 'mock_ahorro_123_3', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'David Isaac Alcántara Avalos', 'mock1@alianza.com', '573001112233', '123123123', 'Ahorro permanente', 2500000, 2500000, 2500000, 'https://example.com/mock_doc_permanente_123.pdf', 'Alianza Solidaria Mock', '900123456-1', (select id::text from empresa where nit='900123456-1' limit 1), 'Permanente', 8.5, now() - interval '10 days', now(), now(), '[]'::jsonb, now())
on conflict (id) do nothing;

-- 2. SEGUNDA LÍNEA CRÉDITO (ya tiene 1 en habilitar_credito mock_hab_1, añadimos 2 más)
insert into habilitar_credito (id, firestore_id, uid, user_ref, tipodecredito, estado, fecha_solicitud, empresa, antiguedad_empresa, habilitar, created_at, updated_at)
values
  (gen_random_uuid(), 'mock_hab_123_2', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Crédito compra de cartera', 'En estudio', now() - interval '3 days', 'Alianza Solidaria Mock', now() - interval '1 year', true, now(), now()),
  (gen_random_uuid(), 'mock_hab_123_3', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Crédito solidario', 'pre-aprobado', now() - interval '1 day', 'Alianza Solidaria Mock', now() - interval '6 months', true, now(), now())
on conflict (id) do nothing;

-- También en tabla credito (si existe como tabla separada)
-- Intenta insertar 2 créditos formales si la tabla existe
insert into credito (id, firestore_id, created_at, updated_at)
values (gen_random_uuid(), 'mock_credito_123_1', now(), now()), (gen_random_uuid(), 'mock_credito_123_2', now(), now())
on conflict (id) do nothing;

-- 3. SEGUNDO CDAT (ya tiene mock_cdat_1, añadimos otro para tener 2)
insert into cdats (id, firestore_id, idusuario, inversion, ea, tiempo, rendimiento, created_at, updated_at)
values
  (gen_random_uuid(), 'mock_cdat_123_2', 'a0000000-0000-0000-0000-000000000001', 8000000, 9.2, 120, 240000, now() - interval '5 days', now())
on conflict (id) do nothing;

-- Cuenta CDAT asociada
insert into cuenta_cdat (id, firestore_id, created_at, updated_at)
values (gen_random_uuid(), 'mock_cuenta_cdat_123_1', now(), now()), (gen_random_uuid(), 'mock_cuenta_cdat_123_2', now(), now())
on conflict (id) do nothing;

-- Movimientos CDAT para el segundo
insert into confirmacionretiros (id, firestore_id, monto, tipodeoperacion, estados, fecharetiro, nombreusuario, nitusuario, celusuario, emailusuario, fecha_solicitud, created_at, updated_at)
values (gen_random_uuid(), 'mock_conf_123_2', 50000, 'Retiro parcial', 'completado', now() - interval '1 day', 'David Isaac Alcántara Avalos', '123123123', '573001112233', 'mock1@alianza.com', now() - interval '1 day', now(), now())
on conflict (id) do nothing;

-- 4. HISTORIAL / TRANSACCIONES EXTRA (para pestaña Historial - son transactions)
-- 3 transacciones más para el usuario 123 (2 depósitos, 1 retiro adicional)
insert into transactions (id, firestore_id, amount, status, transaction_type, ahorros_id, firebase_date, currency, created_at, updated_at)
select gen_random_uuid(), 'mock_hist_123_1', 750000, 'APPROVED', 'Depositado', (select id from ahorros where firestore_id='mock_ahorro_1' limit 1), now() - interval '7 days', 'COP', now(), now() union all
select gen_random_uuid(), 'mock_hist_123_2', 120000, 'APPROVED', 'Withdrawal', (select id from ahorros where firestore_id='mock_ahorro_1' limit 1), now() - interval '6 days', 'COP', now(), now() union all
select gen_random_uuid(), 'mock_hist_123_3', 400000, 'APPROVED', 'Depositado', (select id from ahorros where firestore_id='mock_ahorro_123_3' limit 1), now() - interval '2 days', 'COP', now(), now();

-- 5. COMENTARIOS (pestaña Comentarios) - tabla comentarios
insert into comentarios (id, firestore_id, created_at, updated_at)
values (gen_random_uuid(), 'mock_com_123_1', now(), now()), (gen_random_uuid(), 'mock_com_123_2', now(), now()), (gen_random_uuid(), 'mock_com_123_3', now(), now())
on conflict (id) do nothing;

-- 6. DOCUMENTOS - ya están en ahorros.ahorros_doc_pdf1 y user_profiles.verification_pdf
-- Actualizar usuario con documentos adicionales para pestaña Documentos
update user_profiles set verification_pdf = 'https://example.com/mock_docs/123123123_verification.pdf' where id='a0000000-0000-0000-0000-000000000001';

-- 7. VEHÍCULOS e INFORMACIÓN ADICIONAL - Estas pestañas son MOCK hardcodeado en código
-- VehiculosSection.tsx:32 tiene array fijo vehiculosData con 2 vehículos (VUS-123, HKL-612) - ya se ve sin DB
-- Información adicional viene de user_profiles campos (dirección, etc.) - actualizar perfil
update user_profiles set
  -- si existen columnas adicionales, descomentar:
  -- direccion = 'Calle 45 # 12-34 Bogotá',
  -- ciudad = 'Bogotá',
  updated_at = now()
where id='a0000000-0000-0000-0000-000000000001';

-- Verificación final para 123123123
select 'ahorros' as tabla, count(*) from ahorros where user_nit='123123123' union all
select 'transactions_hist', count(*) from transactions where ahorros_id::text in (select id::text from ahorros where user_nit='123123123') union all
select 'cdats', count(*) from cdats where idusuario='a0000000-0000-0000-0000-000000000001' union all
select 'habilitar_credito', count(*) from habilitar_credito where uid='a0000000-0000-0000-0000-000000000001' union all
select 'comentarios', count(*) from comentarios where firestore_id like 'mock_com_123%';
