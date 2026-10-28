import { supabase } from './config';

/**
 * Capa de acceso a datos sobre Supabase.
 * Tablas: ahorros, transactions, user_profiles (≈ 'user'), empresa, cdats/cdat,
 * confirmacionretiros, services, habilitar_credito, credito_solicitado_empresa, etc.
 *
 * Las filas se normalizan para conservar los alias de campo heredados
 * (camelCase) que aún consumen algunas pantallas del admin.
 */

// Mapeo de nombre de colección heredado -> tabla Supabase
const TABLE_MAP: Record<string, string> = {
  // nombre heredado -> tabla Supabase
  'user': 'user_profiles',        // 'user' singular -> user_profiles
  'users': 'user_profiles',
  'empresa': 'empresa',
  'ahorros': 'ahorros',
  'transactions': 'transactions',
  'Cdats': 'cdats',
  'cdats': 'cdats',
  'Services': 'services',
  'services': 'services',
  'HabilitarCredito': 'habilitar_credito',
  'habilitar_credito': 'habilitar_credito',
  'creditoSolicitadoEmpresa': 'credito_solicitado_empresa',
  'credito_solicitado_empresa': 'credito_solicitado_empresa',
  // subcolección
  'confirmacionretiros': 'confirmacionretiros',
  'RetirosCdat': 'retiros_cdat',
  'retiros_cdat': 'retiros_cdat',
};

// Mapeo de campos heredados camelCase -> columnas snake_case (solo los usados en el admin)
const FIELD_MAP: Record<string, string> = {
  'UserID': 'user_ref',
  'SavingsType': 'savings_type',
  'montoTotal': 'monto_total',
  'TotalSavingValue': 'total_saving_value',
  'totalDeposits': 'total_deposits',
  'AhorrosDocPdf1': 'ahorros_doc_pdf1',
  'UserName': 'user_name',
  'idusuario': 'idusuario', // en cdats ya es snake igual
  'Idusuario': 'idusuario',
  'ahorrosId': 'ahorros_id',
  'transactionType': 'transaction_type',
  'amountFromTotal': 'amount_from_total',
  'ServiceMainType': 'service_main_type',
  'TypesOfProductName': 'types_of_product_name',
  'firestore_id': 'firestore_id',
};

function toSupabaseField(field: string): string {
  return FIELD_MAP[field] ?? field;
}

function toSupabaseTable(collection: string): string {
  return TABLE_MAP[collection] ?? collection;
}

// Helper para normalizar filas: añade id y mantiene los alias heredados que espera la UI
function normalizeRows(rows: any[]): any[] {
  return rows.map(r => {
    const base: any = {
      docId: r.id,
      id: r.id,
      uid: (r as any).uid ?? r.id,
      firestore_id: r.firestore_id,
      ...r,
    };
    // Alias camelCase heredados (ConsultarUsuarioDetalle, Fondos, etc.)
    // ahorros
    if (r.savings_type !== undefined) base.SavingsType = r.savings_type;
    if (r.monto_total !== undefined) base.montoTotal = r.monto_total;
    if (r.ahorros_doc_pdf1 !== undefined) base.AhorrosDocPdf1 = r.ahorros_doc_pdf1;
    if (r.compay_name !== undefined) base.CompayName = r.compay_name;
    if (r.company_nit !== undefined) base.CompanyNIT = r.company_nit;
    if (r.user_ref !== undefined) base.UserID = r.user_ref;
    if (r.user_name !== undefined) base.UserName = r.user_name;
    if (r.fechacreacion !== undefined) base.fechacreacion = r.fechacreacion;
    if (r.total_saving_value !== undefined) base.TotalSavingValue = r.total_saving_value;
    if (r.total_deposits !== undefined) base.totalDeposits = r.total_deposits;
    // cdats
    if (r.idusuario !== undefined) base.Idusuario = r.idusuario;
    if (r.inversion !== undefined) base.Inversion = r.inversion;
    // transactions
    if (r.ahorros_id !== undefined) base.ahorrosId = r.ahorros_id;
    if (r.transaction_type !== undefined) base.transactionType = r.transaction_type;
    // user_profiles
    if (r.display_name !== undefined) base.display_name = r.display_name;
    if (r.phone_number !== undefined) base.phone_number = r.phone_number;
    // asegurar uid final
    base.uid = (r as any).uid ?? r.id;
    return base;
  });
}

// ========== CRUD GENERICO ==========

export const obtenerColeccion = async (nombreColeccion: string) => {
  const table = toSupabaseTable(nombreColeccion);
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return normalizeRows(data ?? []);
};

export const obtenerDocumento = async (nombreColeccion: string, id: string) => {
  const table = toSupabaseTable(nombreColeccion);
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return { docId: data.id, id: data.id, ...data };
};

export const agregarDocumento = async (nombreColeccion: string, datos: any) => {
  const table = toSupabaseTable(nombreColeccion);
  const payload = { ...datos, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data.id;
};

export const actualizarDocumento = async (nombreColeccion: string, id: string, datos: any) => {
  const table = toSupabaseTable(nombreColeccion);
  const payload = { ...datos, updated_at: new Date().toISOString() };
  const { error } = await supabase.from(table).update(payload).eq('id', id);
  if (error) throw error;
};

export const eliminarDocumento = async (nombreColeccion: string, id: string) => {
  const table = toSupabaseTable(nombreColeccion);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
};

export const buscarUsuarioPor = async (campo: string, valor: string) => {
  const col = toSupabaseField(campo);
  // Si es búsqueda por id (uuid) y el valor no es uuid, no consultar por id para evitar 22P02
  const isUuidCol = col === 'id';
  const isValidUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(valor);
  if (isUuidCol && !isValidUuid) {
    // fallback: buscar por nit (cédula) cuando se pasa cédula como id
    const { data } = await supabase.from('user_profiles').select('*').eq('nit', valor).limit(1).maybeSingle();
    if (!data) return null;
    return { docId: data.id, id: data.id, uid: data.id, ...data };
  }
  const { data, error } = await supabase.from('user_profiles').select('*').eq(col, valor).limit(1).maybeSingle();
  if (error) {
    // 22P02 invalid input syntax for type uuid -> tratar como no encontrado
    if ((error as any).code === '22P02') return null;
    throw error;
  }
  if (data) return { docId: data.id, id: data.id, uid: data.id, ...data };
  // El número de documento puede estar en `nit` o en `nro_documento`.
  if (col === 'nit') {
    const { data: alt } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('nro_documento', valor)
      .limit(1)
      .maybeSingle();
    if (alt) return { docId: alt.id, id: alt.id, uid: alt.id, ...alt };
  }
  return null;
};

// Crear documento con soporte subcolección: 'cdats/{id}/confirmacionretiros' -> tabla confirmacionretiros con cdat_id
export const crearDocumento = async (rutaColeccion: string, datos: any) => {
  if (!rutaColeccion.includes('/')) {
    return agregarDocumento(rutaColeccion, datos);
  }
  const partes = rutaColeccion.split('/');
  if (partes.length === 3) {
    const [coleccionPrincipal, docId, subcoleccion] = partes;
    const table = toSupabaseTable(subcoleccion);
    // Para confirmacionretiros necesita cdat_id FK
    const payload: any = {
      ...datos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (table === 'confirmacionretiros') {
      payload.cdat_id = docId;
      // id aleatorio 10000-19999 cuando no viene uno
      // Postgres usa uuid/text, generamos id si no viene
      if (!payload.id) {
        payload.id = String(Math.floor(Math.random() * (19999 - 10000 + 1)) + 10000);
        payload.ID = payload.id;
      }
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    }
    // genérico subcolección
    payload[`${coleccionPrincipal}_id`] = docId;
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }
  throw new Error('Formato de ruta no válido');
};

export const obtenerSubcoleccion = async (rutaDocumento: string, nombreSubcoleccion: string) => {
  // rutaDocumento = 'cdats/{id}' -> tabla confirmacionretiros where id_cdat = cdats.id_cdat
  const table = toSupabaseTable(nombreSubcoleccion);
  const docId = rutaDocumento.split('/').pop()!;

  if (table === 'confirmacionretiros') {
    const { data: cdat } = await supabase.from('cdats').select('id_cdat').eq('id', docId).maybeSingle();
    if (!cdat || (cdat as any).id_cdat == null) return [];
    const { data, error } = await supabase
      .from('confirmacionretiros')
      .select('*')
      .eq('id_cdat', (cdat as any).id_cdat);
    if (error) throw error;
    return normalizeRows(data ?? []);
  }

  // intentar columna fk común: cdat_id
  const fkCandidates = ['cdat_id', 'parent_id', 'ahorros_id'];
  for (const fk of fkCandidates) {
    const { data, error } = await supabase.from(table).select('*').eq(fk, docId);
    if (!error && data && data.length > 0) return normalizeRows(data);
  }
  // fallback: seleccionar todo y filtrar vacío
  const { data, error } = await supabase.from(table).select('*').eq('cdat_id', docId);
  if (error) throw error;
  return normalizeRows(data ?? []);
};

// ========== FUNCIONES ESPECIFICAS ==========

export const obtenerEmpresaPorRef = async (refPath: any) => {
  try {
    if (!refPath) return null;
    let empresaId: string | null = null;
    if (typeof refPath === 'string') empresaId = refPath.split('/').pop() ?? refPath;
    else if (refPath?.id) empresaId = refPath.id;
    if (!empresaId) return null;
    const { data, error } = await supabase.from('empresa').select('*').eq('id', empresaId).maybeSingle();
    if (error) return null;
    return data ? { id: data.id, ...data } : null;
  } catch { return null; }
};

export const obtenerAhorrosPorUsuario = async (userUID: string) => {
  // Buscar el ahorro por user_ref y, si no hay, por user_id
  const { data, error } = await supabase.from('ahorros').select('*').eq('user_ref', userUID);
  if (error) {
    // fallback a user_id text column vista en schema
    const { data: d2 } = await supabase.from('ahorros').select('*').eq('user_id', userUID);
    return normalizeRows(d2 ?? []);
  }
  if (!data || data.length === 0) {
    const { data: d2 } = await supabase.from('ahorros').select('*').eq('user_id', userUID);
    return normalizeRows(d2 ?? []);
  }
  return normalizeRows(data);
};

export const calcularTotalAhorrado = async (ahorrosId: string) => {
  // Suma de depósitos aprobados del ahorro
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('ahorros_id', ahorrosId)
    .eq('transaction_type', 'Depositado')
    .eq('status', 'APPROVED');
  if (error) return 0;
  return (data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount ?? 0), 0);
};

// Alias usados en el admin
export const calcularTotalDepositosAhorro = calcularTotalAhorrado;

export const obtenerCdatsPorUsuario = async (userUID: string) => {
  const { data, error } = await supabase.from('cdats').select('*').eq('idusuario', userUID);
  if (error) {
    console.error('Error al obtener CDATs:', error);
    return [];
  }
  return normalizeRows(data ?? []);
};

export const obtenerTransaccionesAhorro = async (ahorrosId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('ahorros_id', ahorrosId)
    .order('firebase_date', { ascending: false });
  if (error) return [];
  return normalizeRows(data ?? []);
};

export const crearTransaccionNovedadSaldo = async (transactionData: any) => {
  const payload = {
    amount: transactionData.amount,
    authorization_ref: transactionData.authorization,
    transaction_type: transactionData.transactionType,
    user_ref: transactionData.userRef,
    currency: 'COP',
    status: 'APPROVED',
    message: transactionData.message,
    savingtipe: transactionData.savingtipe,
    ahorros_id: transactionData.ahorrosId,
    amount_from_savings: 0,
    amount_from_total: transactionData.amountFromTotal,
    empresa_id: transactionData.empresaId ?? 'EMP_DEFAULT',
    firebase_date: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    sub_payment: true,
    is_novedad_saldo: true,
    user_email: transactionData.userEmail,
    user_name: transactionData.userName,
    user_phone: transactionData.userPhone,
    user_id_number: transactionData.userIdNumber ?? 'DOC_DEFAULT',
    withdrawal_info: transactionData.withdrawalInfo ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('transactions').insert(payload).select().single();
  if (error) throw error;
  return data.id;
};

export const actualizarSaldoCuentaAhorro = async (ahorrosId: string, monto: number, operationType: 'add' | 'remove') => {
  // Actualización de saldo: select + update
  const { data: current, error: fetchErr } = await supabase.from('ahorros').select('monto_total, total_saving_value, total_deposits').eq('id', ahorrosId).single();
  if (fetchErr) throw fetchErr;
  const delta = operationType === 'add' ? monto : -monto;
  const updates: any = {
    monto_total: Number(current.monto_total ?? 0) + delta,
    updated_at: new Date().toISOString(),
  };
  if (operationType === 'add') {
    updates.total_saving_value = Number((current as any).total_saving_value ?? 0) + monto;
    updates.total_deposits = Number((current as any).total_deposits ?? 0) + monto;
    updates.last_deposit = new Date().toISOString();
  } else {
    updates.last_withdrawal = new Date().toISOString();
  }
  const { error } = await supabase.from('ahorros').update(updates).eq('id', ahorrosId);
  if (error) throw error;
  return true;
};

export const obtenerMovimientosCdat = async (cdatId: string) => {
  // FK real es confirmacionretiros.id_cdat (integer) -> cdats.id_cdat, no cdat_id
  const { data: cdat } = await supabase.from('cdats').select('id_cdat').eq('id', cdatId).maybeSingle();
  if (!cdat?.id_cdat) return [];
  const { data, error } = await supabase.from('confirmacionretiros').select('*').eq('id_cdat', (cdat as any).id_cdat);
  if (error) return [];
  // ordenar por fecharetiro desc en JS
  const sorted = (data ?? []).sort((a: any, b: any) => {
    const dateA = a.fecharetiro ? new Date(a.fecharetiro) : new Date(0);
    const dateB = b.fecharetiro ? new Date(b.fecharetiro) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
  return normalizeRows(sorted);
};

// Verificaciones / búsquedas
export const obtenerUsuariosVerificados = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .not('verification_pdf', 'is', null)
    .neq('verification_pdf', '')
    .eq('user_type', 'Basic User')
    .neq('confirmacion_verificado', 'true');
  // Supabase schema usa snake_case: ajustamos nombres si difieren
  if (error) {
    // fallback sin filtros estrictos
    const { data: d2 } = await supabase.from('user_profiles').select('*');
    return normalizeRows(d2 ?? []);
  }
  return normalizeRows(data ?? []);
};

export const buscarUsuarioPorEmail = async (email: string) => {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('email', email);
  if (error) return [];
  return normalizeRows(data ?? []);
};

export const buscarUsuarioPorCelular = async (celular: string) => {
  let { data } = await supabase.from('user_profiles').select('*').eq('phone_number', celular);
  if (data && data.length > 0) return normalizeRows(data);
  const { data: d2 } = await supabase.from('user_profiles').select('*').eq('telefono1', celular);
  return normalizeRows(d2 ?? []);
};

export const buscarUsuarioPorDocumento = async (numeroDocumento: string) => {
  const { data } = await supabase.from('user_profiles').select('*').eq('nit', numeroDocumento);
  if (data && data.length > 0) return normalizeRows(data);
  // El número de documento puede estar en `nit` o en `nro_documento`.
  const { data: alt } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('nro_documento', numeroDocumento);
  if (alt && alt.length > 0) return normalizeRows(alt);
  const isValidUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(numeroDocumento);
  if (!isValidUuid) return [];
  const { data: d2 } = await supabase.from('user_profiles').select('*').eq('id', numeroDocumento);
  return normalizeRows(d2 ?? []);
};

export const obtenerTransaccionesPorEstadoRetiro = async (status: string | null = null) => {
  let query = supabase.from('transactions').select('*').eq('transaction_type', 'Withdrawal');
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return [];
  const sorted = (data ?? []).sort((a: any, b: any) => {
    const da = a.firebase_date ? new Date(a.firebase_date) : new Date(0);
    const db = new Date(b.firebase_date ?? 0);
    return db.getTime() - da.getTime();
  });
  return normalizeRows(sorted);
};

export const actualizarObservacionTransaccion = async (transactionId: string, observation: string) => {
  const { error } = await supabase
    .from('transactions')
    .update({ observation, updated_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (error) throw error;
};

export const actualizarEstadoTransaccion = async (transactionId: string, nuevoEstado: string, datosAdicionales: Record<string, any> = {}) => {
  const { data: current } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
  if (!current) throw new Error('Transacción no encontrada');

  // Si es retiro PENDING -> REJECTED devolver saldo
  if (current.transaction_type === 'Withdrawal' && current.status === 'PENDING' && nuevoEstado === 'REJECTED' && (current as any).ahorros_id) {
    await actualizarSaldoCuentaAhorro((current as any).ahorros_id, Number(current.amount), 'add');
  }

  const payload: any = { status: nuevoEstado, last_updated: new Date().toISOString(), updated_at: new Date().toISOString(), ...datosAdicionales };
  const { error } = await supabase.from('transactions').update(payload).eq('id', transactionId);
  if (error) throw error;
  return true;
};
