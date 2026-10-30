/**
 * Origen de datos de la cartera de créditos.
 *
 * El interruptor por defecto es "mock". Para probar contra la base:
 *
 *   VITE_CREDIT_PORTFOLIO_SOURCE=database
 *
 * La vista (`Cartera.tsx`) todavía no consume este módulo. Se deja así a
 * propósito: encenderlo cuando el cliente confirme las reglas de negocio.
 */

import { supabase } from "@/supabase/config";
import type { CreditPortfolio } from "@/components/credito/CarteraDetailModal";
import {
  computeCuotasPagadas,
  computeDiasMora,
  computeEstadoCartera,
  computeFechaVencimiento,
  computeSaldoPendiente,
  displayName,
  formatDateCO,
  toCreditPortfolio,
  type CreditoRecord,
  type CuotaRecord,
  type CreditPortfolioDraft,
  type UnresolvedCredit,
  type UserProfileRecord,
} from "./creditMetrics";
import { mockPortfolio } from "./mockPortfolio";

export type CreditPortfolioSource = "mock" | "database";

const configuredSource = import.meta.env.VITE_CREDIT_PORTFOLIO_SOURCE;

export const creditPortfolioSource: CreditPortfolioSource =
  configuredSource === "database" ? "database" : "mock";

export interface CreditPortfolioLoadResult {
  source: CreditPortfolioSource;
  resolved: CreditPortfolio[];
  unresolved: UnresolvedCredit[];
  /** Mensaje fijo, sin datos del usuario ni del error original. */
  error?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => UUID_PATTERN.test(value);

/**
 * Claves posibles de `cuota_creditos.credito_ref`. El contrato no está
 * definido, así que se consultan las tres y se agrupan sin duplicar.
 */
function creditKeys(credit: CreditoRecord): string[] {
  const keys = [credit.id];
  if (credit.firestore_id) keys.push(credit.firestore_id);
  if (credit.codigo != null) keys.push(String(credit.codigo));
  return keys;
}

function indexProfiles(profiles: UserProfileRecord[]): Map<string, UserProfileRecord> {
  const index = new Map<string, UserProfileRecord>();
  for (const profile of profiles) {
    index.set(profile.id, profile);
    if (profile.uid) index.set(profile.uid, profile);
    if (profile.firestore_id) index.set(profile.firestore_id, profile);
  }
  return index;
}

async function loadProfiles(refs: string[]): Promise<UserProfileRecord[]> {
  if (refs.length === 0) return [];

  const uuidRefs = refs.filter(isUuid);
  const otherRefs = refs.filter((ref) => !isUuid(ref));

  const results: UserProfileRecord[] = [];

  if (uuidRefs.length > 0) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, firestore_id, uid, display_name, nombre, apellido, nro_documento")
      .in("id", uuidRefs);
    results.push(...((data ?? []) as UserProfileRecord[]));
  }

  if (otherRefs.length > 0) {
    const { data: byUid } = await supabase
      .from("user_profiles")
      .select("id, firestore_id, uid, display_name, nombre, apellido, nro_documento")
      .in("uid", otherRefs);
    results.push(...((byUid ?? []) as UserProfileRecord[]));

    const { data: byFirestoreId } = await supabase
      .from("user_profiles")
      .select("id, firestore_id, uid, display_name, nombre, apellido, nro_documento")
      .in("firestore_id", otherRefs);
    results.push(...((byFirestoreId ?? []) as UserProfileRecord[]));
  }

  const unique = new Map<string, UserProfileRecord>();
  for (const profile of results) unique.set(profile.id, profile);
  return [...unique.values()];
}

async function loadCuotas(keys: string[]): Promise<CuotaRecord[]> {
  if (keys.length === 0) return [];

  const { data } = await supabase
    .from("cuota_creditos")
    .select("id, credito_ref, estado, monto, fecha_pago, comprobante, oculto, cuotayinteres")
    .in("credito_ref", keys);

  const rows = (data ?? []) as CuotaRecord[];
  const unique = new Map<string, CuotaRecord>();
  for (const row of rows) {
    if (!row.oculto) unique.set(row.id, row);
  }
  return [...unique.values()];
}

function groupCuotasByCredit(
  credits: CreditoRecord[],
  cuotas: CuotaRecord[]
): Map<string, CuotaRecord[]> {
  const byRef = new Map<string, CuotaRecord[]>();
  for (const cuota of cuotas) {
    if (!cuota.credito_ref) continue;
    const list = byRef.get(cuota.credito_ref) ?? [];
    list.push(cuota);
    byRef.set(cuota.credito_ref, list);
  }

  const grouped = new Map<string, CuotaRecord[]>();
  for (const credit of credits) {
    const seen = new Set<string>();
    const list: CuotaRecord[] = [];
    for (const key of creditKeys(credit)) {
      for (const cuota of byRef.get(key) ?? []) {
        if (seen.has(cuota.id)) continue;
        seen.add(cuota.id);
        list.push(cuota);
      }
    }
    grouped.set(credit.id, list);
  }
  return grouped;
}

function toDraft(
  credit: CreditoRecord,
  cuotas: CuotaRecord[],
  profile: UserProfileRecord | null
): CreditPortfolioDraft {
  return {
    id: credit.codigo != null ? String(credit.codigo) : credit.firestore_id ?? credit.id,
    nombreCompleto: displayName(profile),
    numeroDocumento: profile?.nro_documento ?? null,
    montoCredito: credit.monto_total != null ? Number(credit.monto_total) : null,
    saldoPendiente: computeSaldoPendiente(cuotas),
    fechaDesembolso: formatDateCO(credit.fechacreacion),
    fechaVencimiento: computeFechaVencimiento(),
    cuotasPagadas: computeCuotasPagadas(cuotas),
    cuotasTotales: credit.cantidad_cuotas ?? null,
    estadoCartera: computeEstadoCartera(),
    diasMora: computeDiasMora(),
  };
}

async function loadFromDatabase(): Promise<CreditPortfolioLoadResult> {
  try {
    const { data: creditData } = await supabase.from("credito").select("*");
    const credits = (creditData ?? []) as CreditoRecord[];

    const refs = [
      ...new Set(
        credits
          .map((credit) => credit.user_ref)
          .filter((ref): ref is string => typeof ref === "string" && ref.length > 0)
      ),
    ];

    const [profiles, cuotas] = await Promise.all([
      loadProfiles(refs),
      loadCuotas([...new Set(credits.flatMap(creditKeys))]),
    ]);

    const profileIndex = indexProfiles(profiles);
    const cuotasByCredit = groupCuotasByCredit(credits, cuotas);

    const resolved: CreditPortfolio[] = [];
    const unresolved: UnresolvedCredit[] = [];

    for (const credit of credits) {
      const profile = credit.user_ref ? profileIndex.get(credit.user_ref) ?? null : null;
      const draft = toDraft(credit, cuotasByCredit.get(credit.id) ?? [], profile);
      const result = toCreditPortfolio(draft);

      if (result.value) resolved.push(result.value);
      else unresolved.push({ id: draft.id, missing: result.missing });
    }

    return { source: "database", resolved, unresolved };
  } catch {
    return {
      source: "database",
      resolved: [],
      unresolved: [],
      error: "No se pudo leer la cartera desde la base de datos",
    };
  }
}

/**
 * Punto de entrada único. Con el interruptor en "mock" devuelve exactamente
 * los mismos datos de ejemplo que usa la página hoy.
 */
export async function loadCreditPortfolio(): Promise<CreditPortfolioLoadResult> {
  if (creditPortfolioSource === "mock") {
    return { source: "mock", resolved: mockPortfolio, unresolved: [] };
  }
  return loadFromDatabase();
}
