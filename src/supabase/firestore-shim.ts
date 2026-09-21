// Shim Firestore -> Supabase para no reescribir 10 archivos complejos
// Permite que `import { collection, query, where, getDocs } from "firebase/firestore"` siga funcionando
// pero ejecutando contra Supabase tablas reales (31 tablas ya existentes).
import { supabase } from './config';

const TABLE_MAP: Record<string, string> = {
  'user': 'user_profiles',
  'users': 'user_profiles',
  'empresa': 'empresa',
  'ahorros': 'ahorros',
  'transactions': 'transactions',
  'Cdats': 'cdats',
  'cdats': 'cdats',
  'Services': 'services',
  'services': 'services',
  'HabilitarCredito': 'habilitar_credito',
  'creditoSolicitadoEmpresa': 'credito_solicitado_empresa',
  'confirmacionretiros': 'confirmacionretiros',
  'ahorros_ingresos': 'ahorros_ingresos',
};

const FIELD_MAP: Record<string, string> = {
  'UserID': 'user_ref',
  'SavingsType': 'savings_type',
  'montoTotal': 'monto_total',
  'TotalSavingValue': 'total_saving_value',
  'totalDeposits': 'total_deposits',
  'AhorrosDocPdf1': 'ahorros_doc_pdf1',
  'UserName': 'user_name',
  'Idusuario': 'idusuario',
  'idusuario': 'idusuario',
  'ahorrosId': 'ahorros_id',
  'firebaseDate': 'firebase_date',
  'transactionType': 'transaction_type',
  'ServiceMainType': 'service_main_type',
  'TypesOfProductName': 'types_of_product_name',
  'EA': 'ea',
  'MV': 'mv',
  'estado': 'estado',
  'tipodecredito': 'tipodecredito',
  'fechaSolicitud': 'fecha_solicitud',
  'nombre': 'nombre',
  'uid': 'uid',
  'email': 'email',
  'phone_number': 'phone_number',
  'telefono1': 'telefono1',
  'nit': 'nit',
  'id': 'id',
  'CompayName': 'compay_name',
  'CompanyNIT': 'company_nit',
};

function mapTable(t: string) { return TABLE_MAP[t] ?? t; }
function mapField(f: string) { return FIELD_MAP[f] ?? f; }

// Tipos internos
type WhereClause = { _where: true; field: string; op: string; value: any };
type OrderClause = { _order: true; field: string; dir: 'asc' | 'desc' };

export function collection(_db: any, tableName: string) {
  return { _type: 'collection' as const, table: mapTable(tableName) };
}

export function doc(_db: any, ...path: string[]) {
  // doc(db, 'user', uid)  o doc(db, 'Services', id)
  // path puede ser ['user','uid'] o con 3 segmentos
  if (path.length === 2) return { _type: 'doc' as const, table: mapTable(path[0]), id: path[1], path: path.join('/') };
  if (path.length === 1) return { _type: 'doc' as const, table: '', id: path[0], path: path[0] };
  // doc(collectionRef, id) no usado aquí
  return { _type: 'doc' as const, table: mapTable(path[0]), id: path[path.length - 1], path: path.join('/') };
}

export function where(field: string, op: string, value: any): WhereClause {
  return { _where: true, field: mapField(field), op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): OrderClause {
  return { _order: true, field: mapField(field), dir };
}

export function limit(n: number) {
  return { _limit: true, n };
}

export function query(collectionRef: any, ...clauses: any[]) {
  const wheres: WhereClause[] = [];
  let order: OrderClause | null = null;
  let lim: number | null = null;
  for (const c of clauses) {
    if (c?._where) wheres.push(c);
    else if (c?._order) order = c;
    else if (c?._limit) lim = c.n;
  }
  return { _type: 'query' as const, table: collectionRef.table, wheres, order, limit: lim };
}

// Helper para aplicar wheres a query supabase
function applyWheres(q: any, wheres: WhereClause[]) {
  let builder = q;
  for (const w of wheres) {
    const f = w.field;
    const v = w.value;
    switch (w.op) {
      case '==': builder = builder.eq(f, v); break;
      case '!=': builder = builder.neq(f, v); break;
      case '>=': builder = builder.gte(f, v); break;
      case '<=': builder = builder.lte(f, v); break;
      case '>': builder = builder.gt(f, v); break;
      case '<': builder = builder.lt(f, v); break;
      case 'in': builder = builder.in(f, v); break;
      case 'not-in': builder = builder.not(f, 'in', `(${v.join(',')})`); break;
      case 'array-contains': builder = builder.contains(f, v); break;
      default: builder = builder.eq(f, v);
    }
  }
  return builder;
}

export async function getDocs(ref: any) {
  const table = ref.table;
  if (!table) throw new Error('getDocs: tabla no definida');

  let q: any = supabase.from(table).select('*');

  if (ref._type === 'query') {
    q = applyWheres(q, ref.wheres ?? []);
    if (ref.order) q = q.order(ref.order.field, { ascending: ref.order.dir === 'asc' });
    if (ref.limit) q = q.limit(ref.limit);
  } else if (ref._type === 'collection') {
    // sin filtros
  }

  const { data, error } = await q;
  if (error) throw error;

  const docs = (data ?? []).map((row: any) => {
    // Añadir aliases camelCase para compatibilidad con código que espera Firestore
    const aliased: any = { ...row };
    if (row.savings_type !== undefined) aliased.SavingsType = row.savings_type;
    if (row.monto_total !== undefined) aliased.montoTotal = row.monto_total;
    if (row.ahorros_doc_pdf1 !== undefined) aliased.AhorrosDocPdf1 = row.ahorros_doc_pdf1;
    if (row.compay_name !== undefined) aliased.CompayName = row.compay_name;
    if (row.company_nit !== undefined) aliased.CompanyNIT = row.company_nit;
    if (row.user_ref !== undefined) aliased.UserID = row.user_ref;
    if (row.firebase_date !== undefined) aliased.firebaseDate = row.firebase_date ? { toDate: () => new Date(row.firebase_date), seconds: Math.floor(new Date(row.firebase_date).getTime()/1000) } : row.firebase_date;
    if (row.transaction_type !== undefined) aliased.transactionType = row.transaction_type;
    if (row.ahorros_id !== undefined) aliased.ahorrosId = row.ahorros_id;
    return {
      id: row.id,
      data: () => aliased,
      exists: () => true,
      ref: { id: row.id },
    };
  });

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: any) => docs.forEach(cb),
    // compat para snap.docs.forEach
    [Symbol.iterator]: function* () { for (const d of docs) yield d; },
  } as any;
}

export async function getDoc(ref: any) {
  // ref puede ser doc ref o DocumentReference firestore con .path
  let table = ref.table;
  let id = ref.id;
  // Si es DocumentReference original de firestore con .path/id, intentar extraer
  if (!table && ref.path) {
    const parts = String(ref.path).split('/');
    table = mapTable(parts[0]);
    id = parts[1] ?? ref.id;
  }
  // Si es referencia tipo "user/uid" pasada como string path
  if (ref.path && ref.path.includes('/')) {
    const parts = ref.path.split('/');
    table = mapTable(parts[0]);
    id = parts[1];
  }

  if (!table || !id) {
    // fallback: intentar usar ref.id directamente en user_profiles
    table = table || 'user_profiles';
  }

  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return { exists: () => false, data: () => null, id } as any;
  return {
    id: data.id,
    exists: () => true,
    data: () => data,
  } as any;
}

export async function addDoc(collectionRef: any, data: any) {
  const table = collectionRef.table;
  const payload = { ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  // Mapear campos camelCase a snake si vienen de Firebase
  const mapped: any = {};
  for (const [k, v] of Object.entries(payload)) {
    mapped[mapField(k)] = v;
  }
  const { data: inserted, error } = await supabase.from(table).insert(mapped).select().single();
  if (error) throw error;
  return { id: inserted.id } as any;
}

export async function updateDoc(docRef: any, data: any) {
  const table = docRef.table ?? mapTable(docRef.path?.split('/')[0] ?? 'user_profiles');
  const id = docRef.id;
  const mapped: any = {};
  for (const [k, v] of Object.entries(data)) {
    // increment y serverTimestamp no existen en supabase, convertir
    if (v && typeof v === 'object' && (v as any)._increment) {
      // leer actual y sumar
      const { data: cur } = await supabase.from(table).select(mapField(k)).eq('id', id).single();
      const curVal = Number((cur as any)?.[mapField(k)] ?? 0);
      mapped[mapField(k)] = curVal + Number((v as any)._increment);
    } else {
      mapped[mapField(k)] = v;
    }
  }
  mapped.updated_at = new Date().toISOString();
  const { error } = await supabase.from(table).update(mapped).eq('id', id);
  if (error) throw error;
}

export async function setDoc(docRef: any, data: any, opts?: any) {
  const table = docRef.table ?? mapTable(docRef.path?.split('/')[0] ?? 'user_profiles');
  const id = docRef.id;
  const mapped: any = { id };
  for (const [k, v] of Object.entries(data)) mapped[mapField(k)] = v;
  mapped.updated_at = new Date().toISOString();
  if (!mapped.created_at) mapped.created_at = new Date().toISOString();
  const { error } = await supabase.from(table).upsert(mapped, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteDoc(docRef: any) {
  const table = docRef.table;
  const { error } = await supabase.from(table).delete().eq('id', docRef.id);
  if (error) throw error;
}

// Utilidades Firestore
export function increment(n: number) { return { _increment: n }; }
export function serverTimestamp() { return new Date().toISOString(); }
export const Timestamp = {
  now: () => ({ toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) }),
  fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000) }),
};

// Para compatibilidad con `import { Timestamp } from "firebase/firestore"` usado como tipo
export type TimestampType = any;
