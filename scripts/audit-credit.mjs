/**
 * Auditoría de solo lectura de las tablas de crédito.
 *
 * Responde las preguntas que bloquean la integración de Cartera:
 *   - ¿Hay datos reales o solo filas de ejemplo?
 *   - ¿Qué columnas están vacías?
 *   - ¿Contra qué columna de `user_profiles` resuelve `credito.user_ref`?
 *   - ¿A qué apunta `cuota_creditos.credito_ref` (id, firestore_id o codigo)?
 *   - ¿Qué valores toma `cuota_creditos.estado`?
 *
 * No imprime correos, nombres, documentos ni identificadores de usuario: solo
 * conteos y etiquetas de estado, para que la salida se pueda compartir.
 *
 * Uso:
 *   node scripts/audit-credit.mjs
 *
 * Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.
 */

import "dotenv/config";

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "")
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/$/, "");
const key = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "")
  .trim()
  .replace(/^["']|["']$/g, "");

if (!url || !key) {
  process.stderr.write("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env\n");
  process.exit(1);
}

// `console.log` está prohibido en este repositorio; la salida del script se
// escribe directamente en stdout.
const line = (text = "") => process.stdout.write(`${text}\n`);
const section = (title) => line(`\n=== ${title} ===`);

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

async function fetchAll(table, select = "*") {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${to}`,
        "Range-Unit": "items",
      },
    });

    if (!response.ok) {
      throw new Error(`${table}: HTTP ${response.status}`);
    }

    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

const count = (rows, predicate) => rows.filter(predicate).length;
const present = (rows, field) => count(rows, (row) => row[field] !== null && row[field] !== undefined && row[field] !== "");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let credits;
let cuotas;
let profiles;

try {
  [credits, cuotas, profiles] = await Promise.all([
    fetchAll("credito"),
    fetchAll("cuota_creditos"),
    fetchAll("user_profiles"),
  ]);
} catch (error) {
  process.stderr.write(`No se pudo leer la base: ${error.message}\n`);
  process.exit(1);
}

section("Volumen");
line(`credito:              ${credits.length} filas`);
line(`cuota_creditos:       ${cuotas.length} filas`);
line(`user_profiles:        ${profiles.length} filas`);

const mockCredits = count(credits, (row) => String(row.firestore_id ?? "").startsWith("mock_"));
const demoCuotas = count(
  cuotas,
  (row) => ["demo", "demo 2"].includes(String(row.estado ?? "").toLowerCase())
);
line(`credito con firestore_id "mock_*": ${mockCredits}`);
line(`cuota_creditos con estado "demo":  ${demoCuotas}`);

section("credito: cobertura de columnas");
for (const field of [
  "monto_total",
  "cantidad_cuotas",
  "estado_lista",
  "fecha_lista",
  "monto_lista",
  "user_ref",
  "fechacreacion",
  "codigo",
  "ea",
  "tipo_credito_name",
]) {
  const filled = present(credits, field);
  const percent = credits.length === 0 ? 0 : Math.round((filled / credits.length) * 100);
  line(`${field.padEnd(18)} ${String(filled).padStart(5)} / ${credits.length} (${percent}%)`);
}

const creationDates = credits
  .map((row) => row.fechacreacion)
  .filter(Boolean)
  .sort();
line(
  `fechacreacion: ${creationDates.length === 0 ? "sin datos" : `${creationDates[0]} .. ${creationDates[creationDates.length - 1]}`}`
);

section("cuota_creditos: valores de estado");
const estadoCounts = new Map();
for (const row of cuotas) {
  const value = row.estado == null ? "(null)" : String(row.estado);
  estadoCounts.set(value, (estadoCounts.get(value) ?? 0) + 1);
}
if (estadoCounts.size === 0) line("sin filas");
for (const [value, total] of [...estadoCounts.entries()].sort((a, b) => b[1] - a[1])) {
  line(`${JSON.stringify(value)}: ${total}`);
}
line(`credito_ref vacío: ${count(cuotas, (row) => !row.credito_ref)} / ${cuotas.length}`);
line(`monto vacío:       ${count(cuotas, (row) => row.monto == null)} / ${cuotas.length}`);
line(`fecha_pago vacía:  ${count(cuotas, (row) => !row.fecha_pago)} / ${cuotas.length}`);

section("cuota_creditos.credito_ref: ¿a qué apunta?");
const byId = new Map(credits.map((row) => [row.id, row.id]));
const byFirestore = new Map(
  credits.filter((row) => row.firestore_id).map((row) => [row.firestore_id, row.id])
);
const byCodigo = new Map(
  credits.filter((row) => row.codigo != null).map((row) => [String(row.codigo), row.id])
);

let refId = 0;
let refFirestore = 0;
let refCodigo = 0;
let refNone = 0;
for (const row of cuotas) {
  const ref = row.credito_ref;
  if (!ref) continue;
  if (byId.has(ref)) refId += 1;
  else if (byFirestore.has(ref)) refFirestore += 1;
  else if (byCodigo.has(ref)) refCodigo += 1;
  else refNone += 1;
}
line(`coincide con credito.id:          ${refId}`);
line(`coincide con credito.firestore_id: ${refFirestore}`);
line(`coincide con credito.codigo:       ${refCodigo}`);
line(`no coincide con ninguna:           ${refNone}`);

section("credito.user_ref: ¿contra qué resuelve?");
const refs = credits
  .map((row) => row.user_ref)
  .filter((value) => typeof value === "string" && value.length > 0);
line(`user_ref presente: ${refs.length} / ${credits.length}`);
line(`con forma de UUID: ${refs.filter((value) => UUID_PATTERN.test(value)).length}`);
line(`con otra forma:    ${refs.filter((value) => !UUID_PATTERN.test(value)).length}`);

const profileIndex = new Map();
for (const profile of profiles) {
  profileIndex.set(profile.id, profile);
  if (profile.uid) profileIndex.set(profile.uid, profile);
  if (profile.firestore_id) profileIndex.set(profile.firestore_id, profile);
  if (profile.codigocredito != null) profileIndex.set(String(profile.codigocredito), profile);
}

const uniqueRefs = [...new Set(refs)];
const matched = uniqueRefs.filter((ref) => profileIndex.has(ref)).length;
line(`user_ref distintos: ${uniqueRefs.length}`);
line(`resueltos en user_profiles (id / uid / firestore_id / codigocredito): ${matched}`);
line(`sin resolver: ${uniqueRefs.length - matched}`);

const matchedBy = { id: 0, uid: 0, firestore_id: 0, codigocredito: 0 };
for (const ref of uniqueRefs) {
  const profile = profileIndex.get(ref);
  if (!profile) continue;
  if (profile.id === ref) matchedBy.id += 1;
  else if (profile.uid === ref) matchedBy.uid += 1;
  else if (profile.firestore_id === ref) matchedBy.firestore_id += 1;
  else matchedBy.codigocredito += 1;
}
line(`  por id:           ${matchedBy.id}`);
line(`  por uid:          ${matchedBy.uid}`);
line(`  por firestore_id: ${matchedBy.firestore_id}`);
line(`  por codigocredito:${matchedBy.codigocredito}`);

section("Cobertura de la cartera");
const creditsWithCuotas = new Set(cuotas.map((row) => row.credito_ref).filter(Boolean));
const conCuotas = count(credits, (row) =>
  [row.id, row.firestore_id, row.codigo != null ? String(row.codigo) : null]
    .filter(Boolean)
    .some((ref) => creditsWithCuotas.has(ref))
);
line(`creditos con al menos una cuota asociada: ${conCuotas} / ${credits.length}`);
line(`creditos sin cuotas:                     ${credits.length - conCuotas} / ${credits.length}`);

section("Veredicto");
const hasRealCredits = credits.length > 0 && mockCredits < credits.length;
const hasJoin = matched > 0;
const hasCuotaLink = refId + refFirestore + refCodigo > 0;

line(`¿hay créditos que no sean de ejemplo?      ${hasRealCredits ? "sí" : "NO"}`);
line(`¿user_ref resuelve a un perfil?            ${hasJoin ? "sí" : "NO"}`);
line(`¿credito_ref resuelve a un crédito?        ${hasCuotaLink ? "sí" : "NO"}`);
line(
  `¿se puede integrar Cartera sin reglas nuevas? ${
    hasRealCredits && hasJoin && hasCuotaLink ? "sí" : "NO"
  }`
);
line("\nReglas que siguen pendientes: saldo pendiente, fecha de vencimiento,");
line("días de mora, umbrales de estado de cartera y castigo.");
