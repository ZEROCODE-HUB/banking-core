/**
 * Adaptador de datos para la cartera de créditos.
 *
 * Este módulo NO se usa todavía desde la interfaz. Existe para separar las
 * fórmulas de negocio (pendientes de definición del cliente) del acceso a
 * datos, de modo que la integración no obligue a reescribir la página.
 *
 * Reglas deliberadamente sin definir:
 *  - saldo pendiente: se calcula sumando cuotas no pagadas, pero el
 *    vocabulario de `cuota_creditos.estado` aún no está confirmado.
 *  - fecha de vencimiento: no existe en el esquema; depende de la
 *    periodicidad del crédito, que tampoco está confirmada.
 *  - días de mora y estado de cartera: dependen de umbrales de negocio.
 *
 * Cuando el cliente responda, se implementan aquí y se eliminan los `null`
 * documentados. El resto del código no cambia.
 */

import type { CreditPortfolio, PortfolioStatus } from "@/components/credito/CarteraDetailModal";

export interface CreditoRecord {
  id: string;
  firestore_id: string | null;
  monto_total: number | null;
  cantidad_cuotas: number | null;
  estado_lista: string[] | null;
  fecha_lista: string[] | null;
  monto_lista: number[] | null;
  user_ref: string | null;
  is_finalizado: boolean | null;
  tipo_credito_name: string | null;
  ea: number | null;
  fechacreacion: string | null;
  codigo: number | null;
  accountno: string | null;
}

export interface CuotaRecord {
  id: string;
  credito_ref: string | null;
  estado: string | null;
  monto: number | null;
  fecha_pago: string | null;
  comprobante: string | null;
  oculto: boolean | null;
  cuotayinteres: number | null;
}

export interface UserProfileRecord {
  id: string;
  firestore_id: string | null;
  uid: string | null;
  display_name: string | null;
  nombre: string | null;
  apellido: string | null;
  nro_documento: string | null;
}

/**
 * Fila ya mapeada pero todavía no validada. Los campos en `null` son huecos
 * conocidos, no ceros: la interfaz nunca debe mostrar un cero inventado.
 */
export interface CreditPortfolioDraft {
  id: string;
  nombreCompleto: string | null;
  numeroDocumento: string | null;
  montoCredito: number | null;
  saldoPendiente: number | null;
  fechaDesembolso: string | null;
  fechaVencimiento: string | null;
  cuotasPagadas: number | null;
  cuotasTotales: number | null;
  estadoCartera: PortfolioStatus | null;
  diasMora: number | null;
}

export interface UnresolvedCredit {
  id: string;
  missing: string[];
}

const ESTADOS_PAGADA = new Set([
  "pagada",
  "pagado",
  "pago",
  "completada",
  "completado",
  "paid",
]);

const ESTADOS_PENDIENTE = new Set([
  "pendiente",
  "pendientes",
  "por pagar",
  "no pagada",
  "no pagado",
  "unpaid",
]);

export type EstadoCuota = "pagada" | "pendiente" | "desconocido";

/**
 * Normaliza el estado de una cuota. Si el valor no está en ninguna lista se
 * devuelve "desconocido" en lugar de asumir pendiente, porque asumir inflaría
 * el saldo y la mora.
 */
export function normalizeEstadoCuota(estado: string | null | undefined): EstadoCuota {
  if (!estado) return "desconocido";
  const value = estado.trim().toLowerCase();
  if (ESTADOS_PAGADA.has(value)) return "pagada";
  if (ESTADOS_PENDIENTE.has(value)) return "pendiente";
  return "desconocido";
}

/**
 * Saldo pendiente = suma de cuotas no pagadas.
 *
 * Devuelve `null` si no hay cuotas o si algún estado es desconocido, para no
 * publicar un saldo que parezca correcto y no lo sea.
 */
export function computeSaldoPendiente(cuotas: CuotaRecord[]): number | null {
  if (cuotas.length === 0) return null;

  let total = 0;
  for (const cuota of cuotas) {
    const estado = normalizeEstadoCuota(cuota.estado);
    if (estado === "desconocido") return null;
    if (estado === "pagada") continue;
    const monto = cuota.monto ?? cuota.cuotayinteres;
    if (monto == null) return null;
    total += Number(monto);
  }
  return total;
}

/**
 * Cuotas pagadas. Devuelve `null` si el vocabulario de estados no permite
 * decidirlo con certeza.
 */
export function computeCuotasPagadas(cuotas: CuotaRecord[]): number | null {
  if (cuotas.length === 0) return null;
  let pagadas = 0;
  for (const cuota of cuotas) {
    const estado = normalizeEstadoCuota(cuota.estado);
    if (estado === "desconocido") return null;
    if (estado === "pagada") pagadas += 1;
  }
  return pagadas;
}

/**
 * Fecha de vencimiento: pendiente.
 *
 * No existe columna en `credito` y la periodicidad (mensual, quincenal, etc.)
 * no está almacenada. Se deja para la respuesta del cliente.
 */
export function computeFechaVencimiento(): null {
  return null;
}

/**
 * Días de mora: pendiente.
 *
 * Requiere saber si `cuota_creditos.fecha_pago` es la fecha de vencimiento o
 * la fecha en que se pagó, y cuál es el día de corte.
 */
export function computeDiasMora(): null {
  return null;
}

/**
 * Estado de cartera: pendiente.
 *
 * Requiere los umbrales de mora temprana, mora tardía y castigo.
 */
export function computeEstadoCartera(): null {
  return null;
}

export function formatDateCO(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function displayName(profile: UserProfileRecord | null): string | null {
  if (!profile) return null;
  const full = [profile.nombre, profile.apellido].filter(Boolean).join(" ").trim();
  return (profile.display_name || full || null) as string | null;
}

/**
 * Convierte un borrador en la forma que consume la interfaz. Solo devuelve un
 * valor cuando todos los campos están resueltos; si falta alguno, informa
 * cuáles para que el problema sea visible y no se rellene con ceros.
 */
export function toCreditPortfolio(draft: CreditPortfolioDraft): {
  value: CreditPortfolio | null;
  missing: string[];
} {
  const missing = (
    [
      "nombreCompleto",
      "numeroDocumento",
      "montoCredito",
      "saldoPendiente",
      "fechaDesembolso",
      "fechaVencimiento",
      "cuotasPagadas",
      "cuotasTotales",
      "estadoCartera",
      "diasMora",
    ] as const
  ).filter((field) => draft[field] == null);

  if (missing.length > 0) return { value: null, missing };

  return {
    value: {
      id: draft.id,
      nombreCompleto: draft.nombreCompleto as string,
      numeroDocumento: draft.numeroDocumento as string,
      montoCredito: draft.montoCredito as number,
      saldoPendiente: draft.saldoPendiente as number,
      fechaDesembolso: draft.fechaDesembolso as string,
      fechaVencimiento: draft.fechaVencimiento as string,
      cuotasPagadas: draft.cuotasPagadas as number,
      cuotasTotales: draft.cuotasTotales as number,
      estadoCartera: draft.estadoCartera as PortfolioStatus,
      diasMora: draft.diasMora as number,
    },
    missing: [],
  };
}
