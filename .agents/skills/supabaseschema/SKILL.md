---
name: supabaseschema
description: Supabase database schema reference to guide safe migration from Firebase to Supabase
license: Apache-2.0
compatibility: Node.js 18+
metadata:
  environment: staging
  team: backend-infrastructure
  version: 1.2.0
---

## Table `ahorros_ingresos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `monto` | `numeric` |  Nullable |
| `fecha` | `timestamptz` |  Nullable |
| `cuenta_ahorro` | `uuid` |  Nullable |
| `status` | `text` |  Nullable |
| `comprobante` | `text` |  Nullable |
| `oculto` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `ahorros`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `monto_total` | `numeric` |  Nullable |
| `user_ref` | `uuid` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `tipo_cuenta_name` | `text` |  Nullable |
| `fechacreacion` | `timestamptz` |  Nullable |
| `codigo` | `int4` |  Nullable |
| `total_saving_value` | `numeric` |  Nullable |
| `savings_type` | `text` |  Nullable |
| `company_nit` | `text` |  Nullable |
| `compay_name` | `text` |  Nullable |
| `type_of_contact` | `text` |  Nullable |
| `ahorro_series_number` | `int4` |  Nullable |
| `ahorros_doc_pdf1` | `text` |  Nullable |
| `ahorros_doc_pdf2` | `text` |  Nullable |
| `user_email` | `text` |  Nullable |
| `user_id` | `text` |  Nullable |
| `user_telephone_number` | `text` |  Nullable |
| `user_name` | `text` |  Nullable |
| `user_dirccion` | `text` |  Nullable |
| `user_cludad` | `text` |  Nullable |
| `user_departmento` | `text` |  Nullable |
| `user_pais` | `text` |  Nullable |
| `pdf` | `text` |  Nullable |
| `service_` | `text` |  Nullable |
| `total_savings_pre_approval` | `numeric` |  Nullable |
| `company` | `text` |  Nullable |
| `main_pdf` | `text` |  Nullable |
| `transactions` | `jsonb` |  Nullable |
| `taxes` | `numeric` |  Nullable |
| `last_deposit` | `timestamptz` |  Nullable |
| `last_withdrawal` | `timestamptz` |  Nullable |
| `user_nit` | `text` |  Nullable |
| `total_deposits` | `numeric` |  Nullable |
| `antiguedad` | `text` |  Nullable |
| `salario` | `text` |  Nullable |
| `ubicaciontrabajo` | `text` |  Nullable |
| `excepcion_pago_mes` | `timestamptz` |  Nullable |
| `numero_orden` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `bank_accounts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `bank_name` | `text` |  Nullable |
| `account_type` | `text` |  Nullable |
| `account_number` | `text` |  Nullable |
| `user_ref` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `banks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `bank_name` | `text` |  Nullable |
| `bank_logo` | `text` |  Nullable |
| `order_ref` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `carruselconvenios`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `nombre` | `text` |  Nullable |
| `foto` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `categoriasconvenios`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `nombre` | `text` |  Nullable |
| `imagenprincipal` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `cdat`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `monto` | `numeric` |  Nullable |
| `fecha` | `timestamptz` |  Nullable |
| `plazo_meses` | `int4` |  Nullable |
| `user_ref` | `text` |  Nullable |
| `comprobante` | `text` |  Nullable |
| `cuenta_cdat` | `text` |  Nullable |
| `status` | `text` |  Nullable |
| `oculto` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `cdats`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `idusuario` | `uuid` |  Nullable |
| `idadmin` | `text` |  Nullable |
| `inversion` | `numeric` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `tiempo` | `int4` |  Nullable |
| `rendimiento` | `numeric` |  Nullable |
| `retefuente_monto` | `numeric` |  Nullable |
| `retefuenteporcentaje` | `numeric` |  Nullable |
| `ganancias` | `numeric` |  Nullable |
| `fecha_apertura` | `timestamptz` |  Nullable |
| `fecha_finalizacion` | `timestamptz` |  Nullable |
| `estado` | `text` |  Nullable |
| `archivos` | `_text` |  Nullable |
| `tipooperacion` | `text` |  Nullable |
| `origenrecursos` | `text` |  Nullable |
| `observaciones` | `text` |  Nullable |
| `comprobantes` | `_text` |  Nullable |
| `firma` | `text` |  Nullable |
| `firmado` | `bool` |  Nullable |
| `fechacreacion` | `timestamptz` |  Nullable |
| `nombreusuario` | `text` |  Nullable |
| `documentousuario` | `text` |  Nullable |
| `user_email` | `text` |  Nullable |
| `saldo_disponible` | `numeric` |  Nullable |
| `id_cdat` | `int4` |  Nullable |
| `motivo_eliminado` | `text` |  Nullable |
| `is_ahorro_cdat` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `codigos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `codigoretiroscdat` | `int4` |  Nullable |
| `codigocdat` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `comentarios`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `tipo` | `text` |  Nullable |
| `comentario` | `text` |  Nullable |
| `creator_name` | `text` |  Nullable |
| `usuario_ref` | `text` |  Nullable |
| `fecha` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `autor` | `text` |  Nullable |
| `texto` | `text` |  Nullable |

## Table `confirmacionretiros`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `usuariosid` | `text` |  Nullable |
| `estados` | `text` |  Nullable |
| `id_field` | `int4` |  Nullable |
| `numbredebanco` | `text` |  Nullable |
| `tipodecuenta` | `text` |  Nullable |
| `cuentanumero` | `text` |  Nullable |
| `fecharetiro` | `timestamptz` |  Nullable |
| `observaciones` | `text` |  Nullable |
| `monto` | `numeric` |  Nullable |
| `tipodeoperacion` | `text` |  Nullable |
| `nombreusuario` | `text` |  Nullable |
| `nitusuario` | `text` |  Nullable |
| `fecha_solicitud` | `timestamptz` |  Nullable |
| `id_cdat` | `int4` |  Nullable |
| `celusuario` | `text` |  Nullable |
| `emailusuario` | `text` |  Nullable |
| `chanelpay` | `text` |  Nullable |
| `isahorrocdat` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `credito`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `monto_total` | `numeric` |  Nullable |
| `cantidad_cuotas` | `int4` |  Nullable |
| `estado_lista` | `_text` |  Nullable |
| `fecha_lista` | `_timestamptz` |  Nullable |
| `user_ref` | `text` |  Nullable |
| `is_finalizado` | `bool` |  Nullable |
| `monto_lista` | `_numeric` |  Nullable |
| `tipo_credito_name` | `text` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `fechacreacion` | `timestamptz` |  Nullable |
| `codigo` | `int4` |  Nullable |
| `accountno` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `credito_solicitado_empresa`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `habilitar` | `bool` |  Nullable |
| `user_ref` | `text` |  Nullable |
| `id_field` | `int4` |  Nullable |
| `nombre` | `text` |  Nullable |
| `documento` | `text` |  Nullable |
| `fecha_solicitud` | `timestamptz` |  Nullable |
| `empresa` | `text` |  Nullable |
| `antiguedad_empresa` | `timestamptz` |  Nullable |
| `fecha_registro_app` | `timestamptz` |  Nullable |
| `estado_civil` | `text` |  Nullable |
| `personas_dependientes` | `text` |  Nullable |
| `adultos_acargo` | `text` |  Nullable |
| `residencia` | `text` |  Nullable |
| `tiempo_residiendo` | `text` |  Nullable |
| `tipo_vivienda` | `text` |  Nullable |
| `empleador_nombre` | `text` |  Nullable |
| `tiempo_empleo` | `text` |  Nullable |
| `tipode_contrato` | `text` |  Nullable |
| `interrupciones_lab` | `text` |  Nullable |
| `creditos_activos` | `text` |  Nullable |
| `pago_otras_deudas` | `text` |  Nullable |
| `retraso_pagos` | `text` |  Nullable |
| `tarjetas_activas` | `text` |  Nullable |
| `central_riesgo` | `text` |  Nullable |
| `inversion_activa` | `text` |  Nullable |
| `credito_gota` | `text` |  Nullable |
| `meses_apagar` | `text` |  Nullable |
| `estado` | `text` |  Nullable |
| `tipodecredito` | `text` |  Nullable |
| `uid` | `text` |  Nullable |
| `nombreapp` | `text` |  Nullable |
| `ingreso_mensual` | `int4` |  Nullable |
| `promedioingreso` | `int4` |  Nullable |
| `monto_solicitud` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `cuenta_cdat`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `user_ref` | `uuid` |  Nullable |
| `plazo_meses` | `int4` |  Nullable |
| `tipo_cuenta` | `text` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `monto_total` | `numeric` |  Nullable |
| `fecha_retiro` | `timestamptz` |  Nullable |
| `fechacreacion` | `timestamptz` |  Nullable |
| `codigocuenta` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `cuota_creditos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `credito_ref` | `text` |  Nullable |
| `estado` | `text` |  Nullable |
| `monto` | `numeric` |  Nullable |
| `fecha_pago` | `timestamptz` |  Nullable |
| `comprobante` | `text` |  Nullable |
| `oculto` | `bool` |  Nullable |
| `cuotayinteres` | `numeric` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `deposit`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `depositdate` | `text` |  Nullable |
| `deposited_money` | `numeric` |  Nullable |
| `bank` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `empresa`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `razonsocial` | `text` |  Nullable |
| `nit` | `text` |  Nullable |
| `correo` | `text` |  Nullable |
| `telefono1` | `text` |  Nullable |
| `telefono2` | `text` |  Nullable |
| `actividad` | `text` |  Nullable |
| `numero_empleados` | `int4` |  Nullable |
| `pais` | `text` |  Nullable |
| `departamento` | `text` |  Nullable |
| `ciudad` | `text` |  Nullable |
| `direccion` | `text` |  Nullable |
| `web` | `text` |  Nullable |
| `empleados` | `_text` |  Nullable |
| `signed_document` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `empresa_representative`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `empresa_ref` | `text` |  Nullable |
| `empresa_nit` | `text` |  Nullable |
| `name` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `typo_de_documento` | `text` |  Nullable |
| `numero_de_documento` | `text` |  Nullable |
| `fecha_de_documento` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `habilitar_credito`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `habilitar` | `bool` |  Nullable |
| `user_ref` | `text` |  Nullable |
| `id_field` | `int4` |  Nullable |
| `nombre` | `text` |  Nullable |
| `documento` | `text` |  Nullable |
| `fecha_solicitud` | `timestamptz` |  Nullable |
| `empresa` | `text` |  Nullable |
| `antiguedad_empresa` | `timestamptz` |  Nullable |
| `fecha_registro_app` | `timestamptz` |  Nullable |
| `estado` | `text` |  Nullable |
| `tipodecredito` | `text` |  Nullable |
| `uid` | `text` |  Nullable |
| `nombreapp` | `text` |  Nullable |
| `estado_civil` | `text` |  Nullable |
| `personas_dependientes` | `text` |  Nullable |
| `adultos_acargo` | `text` |  Nullable |
| `residencia` | `text` |  Nullable |
| `tiempo_residiendo` | `text` |  Nullable |
| `tipo_vivienda` | `text` |  Nullable |
| `empresa_nombre` | `text` |  Nullable |
| `tiempo_empleo` | `text` |  Nullable |
| `ingreso_promed` | `int4` |  Nullable |
| `tipode_contrato` | `text` |  Nullable |
| `interrupciones_lab` | `text` |  Nullable |
| `creditos_activos` | `text` |  Nullable |
| `cuantoscreditos` | `text` |  Nullable |
| `gastos` | `int4` |  Nullable |
| `fuentesingreso` | `text` |  Nullable |
| `prom_ingresos` | `int4` |  Nullable |
| `pago_otras_deudas` | `int4` |  Nullable |
| `gastos_fijos` | `int4` |  Nullable |
| `retraso_pagos` | `text` |  Nullable |
| `tarjetas_activas` | `text` |  Nullable |
| `central_riesgo` | `text` |  Nullable |
| `inversion_activa` | `text` |  Nullable |
| `credito_gota` | `text` |  Nullable |
| `monto_solicitud` | `int4` |  Nullable |
| `meses_apagar` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `listaconvenios`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `nombre_empresa` | `text` |  Nullable |
| `ciudad` | `text` |  Nullable |
| `logo` | `text` |  Nullable |
| `sitioweb` | `text` |  Nullable |
| `imagenes` | `_text` |  Nullable |
| `descripcion` | `text` |  Nullable |
| `beneficio` | `text` |  Nullable |
| `logodetalles` | `text` |  Nullable |
| `nombre_ig` | `text` |  Nullable |
| `numerowhatsapp` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `novedades_ahorros`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `usuario_ref` | `uuid` |  Nullable |
| `nombreusuario` | `text` |  Nullable |
| `numero_documento` | `text` |  Nullable |
| `motivo` | `text` |  Nullable |
| `fecha` | `timestamptz` |  Nullable |
| `estado` | `text` |  Nullable |
| `valor_ahorrado` | `numeric` |  Nullable |
| `ahorro_ref` | `uuid` |  Nullable |
| `correousuario` | `text` |  Nullable |
| `empresaid` | `text` |  Nullable |
| `idnovedad` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `retiros_cdat`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `monto` | `numeric` |  Nullable |
| `fecharetiro` | `timestamptz` |  Nullable |
| `estado` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `services`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `service_main_type` | `text` |  Nullable |
| `types_of_product_name` | `text` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `mv` | `numeric` |  Nullable |
| `user_ref` | `text` |  Nullable |
| `product_number` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `solicitante`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `display_name` | `text` |  Nullable |
| `nombre` | `text` |  Nullable |
| `apellido` | `text` |  Nullable |
| `fecha` | `timestamptz` |  Nullable |
| `empresa` | `text` |  Nullable |
| `usuario_ref` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `solicitudes_nuevas_empresas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `nombre_empresa` | `text` |  Nullable |
| `nit_empresa` | `text` |  Nullable |
| `numerode_telefono` | `int4` |  Nullable |
| `correo_corporativo` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `tipo_cuenta_ahorro`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `name` | `text` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `tipo_cuenta_credito`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `name` | `text` |  Nullable |
| `ea` | `numeric` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `transactions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `process_url` | `text` |  Nullable |
| `reference_id` | `text` |  Nullable |
| `amount` | `numeric` |  Nullable |
| `currency` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `status` | `text` |  Nullable |
| `date` | `text` |  Nullable |
| `request_id` | `int4` |  Nullable |
| `user_accounts` | `jsonb` |  Nullable |
| `buyer_id` | `text` |  Nullable |
| `transaction_type` | `text` |  Nullable |
| `withdrawal_info` | `jsonb` |  Nullable |
| `ahorros_id` | `text` |  Nullable |
| `firebase_date` | `timestamptz` |  Nullable |
| `user_ref` | `uuid` |  Nullable |
| `user_name` | `text` |  Nullable |
| `last_updated` | `timestamptz` |  Nullable |
| `amount_from_total` | `numeric` |  Nullable |
| `amount_from_savings` | `numeric` |  Nullable |
| `ahorros_ref` | `uuid` |  Nullable |
| `bank` | `text` |  Nullable |
| `authorization_ref` | `text` |  Nullable |
| `message` | `text` |  Nullable |
| `date_from_pse` | `timestamptz` |  Nullable |
| `empresa_admin_set_date` | `timestamptz` |  Nullable |
| `empresa_id` | `text` |  Nullable |
| `sub_payment` | `bool` |  Nullable |
| `user_id_number` | `text` |  Nullable |
| `confirmation_date` | `timestamptz` |  Nullable |
| `observation` | `text` |  Nullable |
| `chanel_pay` | `text` |  Nullable |
| `user_email` | `text` |  Nullable |
| `user_phone` | `text` |  Nullable |
| `savingtipe` | `text` |  Nullable |
| `is_ahorro_cdat` | `bool` |  Nullable |
| `is_novedad_saldo` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `user_profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `display_name` | `text` |  Nullable |
| `photo_url` | `text` |  Nullable |
| `uid` | `text` |  Nullable |
| `created_time` | `timestamptz` |  Nullable |
| `phone_number` | `text` |  Nullable |
| `id_field` | `text` |  Nullable |
| `empresa` | `text` |  Nullable |
| `pais` | `text` |  Nullable |
| `nombre` | `text` |  Nullable |
| `apellido` | `text` |  Nullable |
| `departamento` | `text` |  Nullable |
| `ciudad` | `text` |  Nullable |
| `direccion` | `text` |  Nullable |
| `cargo` | `text` |  Nullable |
| `telefono1` | `text` |  Nullable |
| `telefono2` | `text` |  Nullable |
| `moneda` | `text` |  Nullable |
| `nit` | `text` |  Nullable |
| `cuenta_ahorro_document` | `text` |  Nullable |
| `cuenta_credito_document` | `text` |  Nullable |
| `cuenta_cdat_document` | `text` |  Nullable |
| `cuenta_ahorro_ref` | `text` |  Nullable |
| `cuenta_credito_ref` | `text` |  Nullable |
| `cuenta_cdat` | `text` |  Nullable |
| `tipo_vinculacion` | `text` |  Nullable |
| `tipo_documento` | `text` |  Nullable |
| `nro_documento` | `text` |  Nullable |
| `ciudad_expedicion` | `text` |  Nullable |
| `politicamente_expuesto` | `text` |  Nullable |
| `tiene_familiares` | `text` |  Nullable |
| `fuente_ingreso` | `text` |  Nullable |
| `autorizo_alianza1` | `text` |  Nullable |
| `autorizo_alianza2` | `text` |  Nullable |
| `autorizo_alianza3` | `text` |  Nullable |
| `fecha_expedicion` | `timestamptz` |  Nullable |
| `cdatfecha` | `timestamptz` |  Nullable |
| `ahorrofecha` | `timestamptz` |  Nullable |
| `creditofecha` | `timestamptz` |  Nullable |
| `empresaref` | `text` |  Nullable |
| `codigoahorro` | `int4` |  Nullable |
| `codigocredito` | `int4` |  Nullable |
| `codigocdat` | `int4` |  Nullable |
| `fotofrontal` | `text` |  Nullable |
| `fototrasera` | `text` |  Nullable |
| `fotoperfil` | `text` |  Nullable |
| `genero` | `text` |  Nullable |
| `confirmacion_verificado` | `bool` |  Nullable |
| `ocupacion` | `text` |  Nullable |
| `fecha_nacimiento` | `timestamptz` |  Nullable |
| `ciudad_nacimiento` | `text` |  Nullable |
| `is_have_saving_account` | `bool` |  Nullable |
| `user_type` | `text` |  Nullable |
| `accountnumber` | `text` |  Nullable |
| `verification_pdf` | `text` |  Nullable |
| `barrio` | `text` |  Nullable |
| `flg_ppe` | `bool` |  Nullable |
| `flg_relatives_ppe` | `bool` |  Nullable |
| `funds_source` | `_text` |  Nullable |
| `digite_otras_fuentes` | `text` |  Nullable |
| `relative_fullname` | `text` |  Nullable |
| `relative_id` | `text` |  Nullable |
| `last_login` | `timestamptz` |  Nullable |
| `egresos` | `text` |  Nullable |
| `activos` | `text` |  Nullable |
| `patrimonio` | `text` |  Nullable |
| `ingresos` | `text` |  Nullable |
| `recurrencia` | `text` |  Nullable |
| `verificacionusuario` | `text` |  Nullable |
| `tienecdat` | `bool` |  Nullable |
| `empresanuevaahorro` | `text` |  Nullable |
| `habilitar` | `bool` |  Nullable |
| `monto_pre_aprobado` | `int4` |  Nullable |
| `respuesta_credito` | `bool` |  Nullable |
| `perfil_credito` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `version`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `current_version` | `int4` |  Nullable |
| `version_current` | `text` |  Nullable |
| `version_android` | `text` |  Nullable |
| `veriontesfligth` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `withdrawal`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `firestore_id` | `text` |  Nullable |
| `country` | `text` |  Nullable |
| `customername` | `text` |  Nullable |
| `accounttype` | `text` |  Nullable |
| `accountnumber` | `text` |  Nullable |
| `amounttowithdraw` | `numeric` |  Nullable |
| `date` | `timestamptz` |  Nullable |
| `bank_name` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `vehiculos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `placa` | `text` |  |
| `titular` | `text` |  Nullable |
| `tipo` | `text` |  Nullable |
| `soat` | `jsonb` |  Nullable |
| `tecnicomecanica` | `jsonb` |  Nullable |
| `seguro` | `jsonb` |  Nullable |
| `firestore_id` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## RLS Policies

### `bank_accounts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `delete_own_bank_accounts` | DELETE | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |
| `insert_own_bank_accounts` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_ref)` |
| `select_own_bank_accounts` | SELECT | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |

### `ahorros`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `ahorros_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |
| `insert_own_ahorros` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_ref)` |
| `select_own_ahorros` | SELECT | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |
| `update_own_ahorros` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |

### `banks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `select_banks_authenticated` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `ahorros_ingresos`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `select_own_ahorros_ingresos` | SELECT | public | PERMISSIVE | `(cuenta_ahorro IN ( SELECT ahorros.id    FROM ahorros   WHERE (ahorros.user_ref = auth.uid())))` | — |

### `carruselconvenios`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `convenios_select_public` | SELECT | public | PERMISSIVE | `true` | — |

### `categoriasconvenios`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `categorias_select_public` | SELECT | public | PERMISSIVE | `true` | — |

### `cdats`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `insert_own_cdats` | INSERT | public | PERMISSIVE | — | `(auth.uid() = idusuario)` |
| `select_own_cdats` | SELECT | public | PERMISSIVE | `(auth.uid() = idusuario)` | — |

### `cuenta_cdat`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `select_own_cuenta_cdat` | SELECT | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |

### `empresa`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `empresa_select_public` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `novedades_ahorros`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `select_own_novedades_ahorros` | SELECT | public | PERMISSIVE | `(auth.uid() = usuario_ref)` | — |

### `transactions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `insert_own_transactions` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_ref)` |
| `select_own_transactions` | SELECT | public | PERMISSIVE | `(auth.uid() = user_ref)` | — |

### `services`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `select_services_authenticated` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `user_profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `insert_own_profile` | INSERT | public | PERMISSIVE | — | `(auth.uid() = id)` |
| `select_own_profile` | SELECT | public | PERMISSIVE | `(auth.uid() = id)` | — |
| `update_own_profile` | UPDATE | public | PERMISSIVE | `(auth.uid() = id)` | — |

## Refactoring Directives for AI Agent
1. **Strict Field Alignment:** Match payload keys strictly to the column names in these tables (including historical typos like `compay_name`).
2. **Type Coercion:** Parse all legacy Firestore timestamp objects into valid ISO 8601 strings for `timestamptz` columns (`fecha`, `created_at`, `updated_at`).
3. **Relational Keys:** Always use `user_ref` (UUID) for relational joins and foreign key filters, ignoring `user_id` (text) for new queries.
4. **JSON Handling:** Validate the `transactions` column on `ahorros` as `z.array(z.record(z.unknown()))` using Zod before submitting updates.