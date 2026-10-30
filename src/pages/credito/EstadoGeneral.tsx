import React, { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Mail, Phone, Building2, IdCard, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { buscarUsuarioPor, buscarUsuarioPorDocumento, obtenerEmpresaPorRef } from "@/supabase/database";
import { supabase } from "@/supabase/config";
import { cn } from "@/lib/utils";
import { calcularScoring, type DatosCredito } from "@/utils/scoringCredito";

// Normaliza cualquier fecha (ISO string, Date, Timestamp serializado) a Date
const parseFechaValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    try {
      const fecha = (value as { toDate: () => Date }).toDate();
      return isNaN(fecha.getTime()) ? null : fecha;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && typeof (value as { seconds?: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const fecha = new Date(value as string | number);
  return isNaN(fecha.getTime()) ? null : fecha;
};

const numero = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const textoPlano = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

interface CreditApplication {
  id: string;
  nombreCompleto: string;
  numeroDocumento: string;
  fechaSolicitud: string;
  tiempo: string;
  fechaFinalizacion?: string;
  tiempoFinalizacion?: string;
  porcentaje: number;
  estado: CreditStatus;
}

interface HabilitarCreditoRow {
  uid: string;
  id: number;
  nombreCompleto: string;
  numeroDocumento: string;
  fechaSolicitud: string;
  fechaSolicitudRaw: Date | null;
  estado: string;
  tipodecredito: string;
  empresa: string;
  antiguedadEmpresa: string;
  antiguedadUsuario: string;
}

type CreditStatus = 
  | "inicio-solicitud"
  | "en-estudio" 
  | "pre-aprobado"
  | "validacion"
  | "pendiente-firma"
  | "desembolso";

interface StatusTab {
  key: CreditStatus;
  label: string;
  color?: string;
}

const statusTabs: StatusTab[] = [
  { key: "inicio-solicitud", label: "Inicio de solicitud" },
  { key: "en-estudio", label: "En estudio" },
  { key: "pre-aprobado", label: "Pre-aprobado" },
  { key: "validacion", label: "Validación" },
  { key: "pendiente-firma", label: "Pendientes de firma" },
  { key: "desembolso", label: "En desembolso" },
];

const getStatusColor = (status: CreditStatus): string => {
  const colors = {
    "inicio-solicitud": "bg-blue-100 text-blue-800",
    "en-estudio": "bg-yellow-100 text-yellow-800", 
    "pre-aprobado": "bg-green-100 text-green-800",
    "validacion": "bg-purple-100 text-purple-800",
    "pendiente-firma": "bg-orange-100 text-orange-800",
    "desembolso": "bg-emerald-100 text-emerald-800"
  };
  return colors[status];
};

const getStatusLabel = (status: CreditStatus): string => {
  const labels = {
    "inicio-solicitud": "Inicio de solicitud",
    "en-estudio": "En estudio",
    "pre-aprobado": "Pre-aprobado", 
    "validacion": "Validación",
    "pendiente-firma": "Pendiente de firma",
    "desembolso": "En desembolso"
  };
  return labels[status];
};

// ========== INTERFACES PARA EN ESTUDIO ==========
interface EnEstudioRow {
  uid: string;
  nombre: string;
  tipoCredito: string;
  monto: number;
  libre: number;
  total: number;
  viabilidad: number;
  fechaSolicitud: Date;
  
  // Datos de HabilitarCredito
  estadoCivil: string;
  personasDependientes: string;
  adultosAcargo: string;
  tiempoResidiendo: string;
  tipoVivienda: string;
  residencia: string;
  tiempoEmpleo: string;
  tipodeContrato: string;
  interrupcionesLab: string;
  fuentesingreso: string;
  gastosFijos: number;
  promIngresos: number;
  creditosActivos: string;
  cuantoscreditos: string;
  retrasoPagos: string;
  tarjetasActivas: string;
  creditoGota: string;
  pagoOtrasDeudas: number;
  centralRiesgo: string;
  inversionActiva: string;
  mesesApagar: number;
  
  // Datos de empresa (creditoSolicitadoEmpresa)
  empresaNombre: string;
  empresaNit: string;
  empresaCiudad: string;
  tipoContrato: string;
  antiguedadEmpresa: string;
  salarioBase: number;
  totalIngresos: number;
  totalDescuentos: number;
  comisionesSalariales: number;
  bonosNoSalariales: number;
  valorAuxilio: number;
  embargos: boolean;
  valorEmbargos: number;
  libranzas: boolean;
  valorLibranzas: number;
  cantidadLibranzas: number;
  obligacionesInternas: boolean;
  valorInternos: number;
  diasVacaciones: number;
  fechaIngreso: string;
}

interface EnEstudioSummary {
  label: string;
  count: number;
  monto: number;
}

// ========== INTERFACES PARA PRE-APROBADO (mantener original) ==========
interface PreAprobadoRow {
  uid: string;
  nombre: string;
  tipoCredito: string;
  montoAprobado: number;
  plazo: number;
  documento: string;
  email: string;
  telefono: string;
  tiempoTranscurrido: string;
  empresaNit: string;
  empresa: string;
  ciudad: string;
  tipoContrato: string;
}

const preAprobadoMocked: PreAprobadoRow[] = [
  { uid: "pa1", nombre: "Luz Indyra Trinidad Camargo", tipoCredito: "Crédito de libranza", montoAprobado: 15000000, plazo: 12, documento: "24230842", email: "indyra0511@gmail.com", telefono: "573112937733", tiempoTranscurrido: "1 mes y 2 días", empresaNit: "0000000-0", empresa: "Alianza Solidaria", ciudad: "Bogotá - DC", tipoContrato: "Término indefinido" },
  { uid: "pa2", nombre: "José Antonio Siccha Parimango", tipoCredito: "Crédito de libranza", montoAprobado: 20000000, plazo: 24, documento: "80123456", email: "jsiccha@correo.com", telefono: "573001234567", tiempoTranscurrido: "2 meses", empresaNit: "9001234-5", empresa: "Grupo Empresarial S.A.", ciudad: "Medellín", tipoContrato: "Término fijo" },
  { uid: "pa3", nombre: "Daniela Camacho Gutiérrez", tipoCredito: "Crédito libre inversión", montoAprobado: 12000000, plazo: 36, documento: "52987654", email: "dcamacho@email.com", telefono: "573209876543", tiempoTranscurrido: "15 días", empresaNit: "8005678-1", empresa: "Tech Solutions", ciudad: "Cali", tipoContrato: "Prestación de servicios" },
  { uid: "pa4", nombre: "Carlos Andrés Murillo López", tipoCredito: "Crédito compra de cartera", montoAprobado: 40000000, plazo: 48, documento: "79654321", email: "cmurillo@email.com", telefono: "573156789012", tiempoTranscurrido: "3 meses y 5 días", empresaNit: "9007890-3", empresa: "Constructora ABC", ciudad: "Barranquilla", tipoContrato: "Término indefinido" },
  { uid: "pa5", nombre: "María Fernanda López Rojas", tipoCredito: "Crédito de libranza", montoAprobado: 25000000, plazo: 18, documento: "10234567", email: "mflopez@email.com", telefono: "573187654321", tiempoTranscurrido: "5 días", empresaNit: "9002345-6", empresa: "Banco Nacional", ciudad: "Bucaramanga", tipoContrato: "Término indefinido" },
  { uid: "pa6", nombre: "Andrés Felipe Vargas", tipoCredito: "Crédito solidario", montoAprobado: 8000000, plazo: 12, documento: "11345678", email: "avargas@email.com", telefono: "573145678901", tiempoTranscurrido: "1 mes", empresaNit: "8001234-7", empresa: "Cooperativa Sur", ciudad: "Pereira", tipoContrato: "Asociado" },
];

const preAprobadoSummary = [
  { label: "Crédito de libranza", count: 3, monto: 60000000 },
  { label: "Crédito libre inversión", count: 1, monto: 12000000 },
  { label: "Crédito compra de cartera", count: 1, monto: 40000000 },
  { label: "Crédito solidario", count: 1, monto: 8000000 },
];

const formatPesos = (v: number) =>
  "$" + v.toLocaleString("es-CO");

const calcularTiempoTranscurrido = (desde: Date): string => {
  const ahora = new Date();
  let años = ahora.getFullYear() - desde.getFullYear();
  let meses = ahora.getMonth() - desde.getMonth();
  let dias = ahora.getDate() - desde.getDate();
  if (dias < 0) {
    meses--;
    dias += new Date(ahora.getFullYear(), ahora.getMonth(), 0).getDate();
  }
  if (meses < 0) { años--; meses += 12; }
  const partes: string[] = [];
  if (años > 0) partes.push(`${años} año${años > 1 ? "s" : ""}`);
  if (meses > 0) partes.push(`${meses} mes${meses > 1 ? "es" : ""}`);
  if (dias > 0 && años === 0) partes.push(`${dias} día${dias > 1 ? "s" : ""}`);
  return partes.length > 0 ? partes.join(" ") : "Reciente";
};

const tiempoTranscurrido = (desde: Date): string => {
  const ahora = new Date();
  const diffMs = ahora.getTime() - desde.getTime();
  const minutos = Math.floor(diffMs / (1000 * 60));
  const horas   = Math.floor(diffMs / (1000 * 60 * 60));
  const dias    = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const meses   = Math.floor(dias / 30);
  if (meses > 0)  return `${meses}mes ${dias % 30}d`;
  if (dias > 0)   return `${dias}d ${horas % 24}h`;
  if (horas > 0)  return `${horas}h ${minutos % 60}m`;
  return `${minutos}m`;
};

const tiempoTranscurridoFormato = (desde: Date): string => {
  const ahora = new Date();
  const diffMs = ahora.getTime() - desde.getTime();
  const segundos = Math.floor(diffMs / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  
  const h = horas % 24;
  const m = minutos % 60;
  const s = segundos % 60;
  
  if (dias > 0) {
    return `${dias}d ${h}h ${m}m`;
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function EstadoGeneral() {
  const [activeTab, setActiveTab] = useState<CreditStatus>("inicio-solicitud");
  const [searchTerm, setSearchTerm] = useState("");
  const [perfilamientoOpen, setPerfilamientoOpen] = useState(false);
  const [cedulaBusqueda, setCedulaBusqueda] = useState("");
  const [tipoContacto, setTipoContacto] = useState<"email" | "celular" | "cedula">("cedula");
  const [busquedaLoading, setBusquedaLoading] = useState(false);
  const [usuarioEncontrado, setUsuarioEncontrado] = useState<Record<string, unknown> | null>(null);
  const [empresaEncontrada, setEmpresaEncontrada] = useState<string>("");
  const [busquedaError, setBusquedaError] = useState("");
  const [habilitandoLoading, setHabilitandoLoading] = useState(false);
  const [habilitadoOk, setHabilitadoOk] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tipoCredito, setTipoCredito] = useState<string>("");
  const [solicitudes, setSolicitudes] = useState<HabilitarCreditoRow[]>([]);
  const [todasSolicitudes, setTodasSolicitudes] = useState<HabilitarCreditoRow[]>([]);
  const [solicitudesLoading, setSolicitudesLoading] = useState(false);
  const [expandedEnEstudio, setExpandedEnEstudio] = useState<string | null>(null);
  const [activeCreditTab, setActiveCreditTab] = useState<string>("Crédito de libranza");
  const [expandedPreAprobado, setExpandedPreAprobado] = useState<string | null>(null);
  const [activePreAprobadoTab, setActivePreAprobadoTab] = useState<string>("Crédito de libranza");
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleRow, setDetalleRow] = useState<EnEstudioRow | null>(null);
  const [detalleTab, setDetalleTab] = useState<"persona" | "central" | "empresa">("persona");

  // ========== NUEVO: Estados para En Estudio ==========
  const [enEstudioData, setEnEstudioData] = useState<EnEstudioRow[]>([]);
  const [enEstudioLoading, setEnEstudioLoading] = useState(false);
  const [enEstudioSummary, setEnEstudioSummary] = useState<EnEstudioSummary[]>([]);

  // ========== HELPERS DE CARGA ==========
  const usuariosPorIds = useCallback(async (ids: string[]) => {
    const mapa = new Map<string, Record<string, unknown>>();
    const unicos = [...new Set(ids.filter(Boolean))];
    for (let i = 0; i < unicos.length; i += 100) {
      const chunk = unicos.slice(i, i + 100);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, uid, nit, nro_documento, display_name, email, phone_number, created_time")
        .in("id", chunk);
      if (error) {
        console.warn("No se pudieron cargar usuarios");
        continue;
      }
      (data ?? []).forEach((u) => mapa.set(u.id, u));
    }
    return mapa;
  }, []);

  const normalizarEstado = (estado: unknown) =>
    textoPlano(estado).trim().toLowerCase();

  // ========== FETCH SOLICITUDES INICIO ==========
  const fetchSolicitudes = useCallback(async () => {
    setSolicitudesLoading(true);
    try {
      // Una sola lectura: el estado se agrupa en memoria para las pestañas.
      const { data, error } = await supabase
        .from("habilitar_credito")
        .select("*")
        .order("fecha_solicitud", { ascending: false });

      if (error) throw error;

      const filas = data ?? [];
      const usuariosMap = await usuariosPorIds(
        filas.map((f) => textoPlano(f.user_ref) || textoPlano(f.uid))
      );

      const rows: HabilitarCreditoRow[] = filas.map((fila) => {
        const uid = textoPlano(fila.user_ref) || textoPlano(fila.uid);
        const usuario = usuariosMap.get(uid);
        const fecha = parseFechaValue(fila.fecha_solicitud);
        const createdTs =
          parseFechaValue(fila.fecha_registro_app) ?? parseFechaValue(usuario?.created_time);

        return {
          uid: fila.id,
          id: numero(fila.id_field),
          nombreCompleto:
            textoPlano(usuario?.display_name) || textoPlano(fila.nombre) || "N/A",
          numeroDocumento:
            textoPlano(usuario?.nit) ||
            textoPlano(usuario?.nro_documento) ||
            textoPlano(fila.documento) ||
            "N/A",
          fechaSolicitud: fecha ? fecha.toLocaleDateString("es-CO") : "-",
          fechaSolicitudRaw: fecha,
          estado: textoPlano(fila.estado),
          tipodecredito: textoPlano(fila.tipodecredito),
          empresa: textoPlano(fila.empresa) || "-",
          antiguedadEmpresa: "-",
          antiguedadUsuario: createdTs ? calcularTiempoTranscurrido(createdTs) : "-",
        };
      });

      setTodasSolicitudes(rows);
      setSolicitudes(rows.filter((r) => normalizarEstado(r.estado) === "inicio de solicitud"));
    } catch (error) {
      console.error("Error cargando solicitudes");
    } finally {
      setSolicitudesLoading(false);
    }
  }, [usuariosPorIds]);

  // ========== NUEVO: FETCH EN ESTUDIO ==========
  const fetchEnEstudio = useCallback(async () => {
    setEnEstudioLoading(true);
    try {
      // 1. Solicitudes de crédito con estado "En estudio"
      const [habilitarRes, empresaRes] = await Promise.all([
        supabase.from("habilitar_credito").select("*").ilike("estado", "en estudio"),
        supabase.from("credito_solicitado_empresa").select("*"),
      ]);

      if (habilitarRes.error) throw habilitarRes.error;
      if (empresaRes.error) throw empresaRes.error;

      const habilitarFilas = habilitarRes.data ?? [];

      // Índice de datos de empresa por usuario (la tabla no tiene FK: se cruza por
      // user_ref/uid y, como respaldo, por documento).
      const empresaPorUsuario = new Map<string, Record<string, unknown>>();
      (empresaRes.data ?? []).forEach((emp) => {
        [textoPlano(emp.user_ref), textoPlano(emp.uid), textoPlano(emp.documento)]
          .filter(Boolean)
          .forEach((clave) => {
            if (!empresaPorUsuario.has(clave)) empresaPorUsuario.set(clave, emp);
          });
      });

      const usuariosMap = await usuariosPorIds(
        habilitarFilas.map((f) => textoPlano(f.user_ref) || textoPlano(f.uid))
      );

      const rows: EnEstudioRow[] = [];

      for (const data of habilitarFilas) {
        const uid = textoPlano(data.user_ref) || textoPlano(data.uid);
        const usuario = usuariosMap.get(uid);

        const nombreUsuario =
          textoPlano(usuario?.display_name) || textoPlano(data.nombre) || "N/A";

        const datosEmpresa =
          empresaPorUsuario.get(uid) ||
          empresaPorUsuario.get(textoPlano(data.documento)) ||
          {};

        // 4. Construir el objeto row
        const row: EnEstudioRow = {
          uid,
          nombre: nombreUsuario,
          tipoCredito: textoPlano(data.tipodecredito),
          monto: numero(data.monto_solicitud),
          libre: 0, // Se calculará después
          total: 0, // Se calculará después
          viabilidad: 0, // Se calculará después
          fechaSolicitud: parseFechaValue(data.fecha_solicitud) ?? new Date(),

          // Datos de HabilitarCredito
          estadoCivil: textoPlano(data.estado_civil),
          personasDependientes: textoPlano(data.personas_dependientes),
          adultosAcargo: textoPlano(data.adultos_acargo),
          tiempoResidiendo: textoPlano(data.tiempo_residiendo),
          tipoVivienda: textoPlano(data.tipo_vivienda),
          residencia: textoPlano(data.residencia),
          tiempoEmpleo: textoPlano(data.tiempo_empleo),
          tipodeContrato: textoPlano(data.tipode_contrato),
          interrupcionesLab: textoPlano(data.interrupciones_lab),
          fuentesingreso: textoPlano(data.fuentesingreso),
          gastosFijos: numero(data.gastos_fijos ?? data.gastos),
          promIngresos: numero(data.prom_ingresos ?? data.ingreso_promed),
          creditosActivos: textoPlano(data.creditos_activos),
          cuantoscreditos: textoPlano(data.cuantoscreditos),
          retrasoPagos: textoPlano(data.retraso_pagos),
          tarjetasActivas: textoPlano(data.tarjetas_activas),
          creditoGota: textoPlano(data.credito_gota),
          pagoOtrasDeudas: numero(data.pago_otras_deudas),
          centralRiesgo: textoPlano(data.central_riesgo),
          inversionActiva: textoPlano(data.inversion_activa),
          mesesApagar: numero(data.meses_apagar),

          // Datos de empresa (solo columnas existentes en la tabla)
          empresaNombre:
            textoPlano(datosEmpresa.empleador_nombre) ||
            textoPlano(datosEmpresa.empresa) ||
            textoPlano(data.empresa_nombre) ||
            textoPlano(data.empresa),
          empresaNit: "",
          empresaCiudad: "",
          tipoContrato:
            textoPlano(datosEmpresa.tipode_contrato) || textoPlano(data.tipode_contrato),
          antiguedadEmpresa: textoPlano(data.antiguedad_empresa),
          salarioBase: numero(datosEmpresa.ingreso_mensual ?? datosEmpresa.promedioingreso),
          totalIngresos: numero(datosEmpresa.promedioingreso ?? datosEmpresa.ingreso_mensual),
          totalDescuentos: 0,
          comisionesSalariales: 0,
          bonosNoSalariales: 0,
          valorAuxilio: 0,
          embargos: false,
          valorEmbargos: 0,
          libranzas: false,
          valorLibranzas: 0,
          cantidadLibranzas: 0,
          obligacionesInternas: false,
          valorInternos: 0,
          diasVacaciones: 0,
          fechaIngreso: "",
        };
        
        // 5. CALCULAR SCORING AUTOMÁTICAMENTE
        try {
          const datosParaScoring: DatosCredito = {
            montoSolicitud: row.monto,
            mesesApagar: row.mesesApagar,
            estadoCivil: row.estadoCivil,
            personasDependientes: row.personasDependientes,
            adultosAcargo: row.adultosAcargo,
            tiempoResidiendo: row.tiempoResidiendo,
            tipoVivienda: row.tipoVivienda,
            empresaNombre: row.empresaNombre,
            tiempoEmpleo: row.tiempoEmpleo,
            tipodeContrato: row.tipodeContrato,
            interrupcionesLab: row.interrupcionesLab,
            salarioBase: row.salarioBase,
            fuentesingreso: row.fuentesingreso,
            gastosFijos: row.gastosFijos,
            promIngresos: row.promIngresos,
            cuantoscreditos: row.cuantoscreditos,
            retrasoPagos: row.retrasoPagos,
            tarjetasActivas: row.tarjetasActivas,
            centralRiesgo: row.centralRiesgo,
            inversionActiva: row.inversionActiva,
            creditoGota: row.creditoGota,
            pagoOtrasDeudas: row.pagoOtrasDeudas,
          };
          
          const scoring = calcularScoring(datosParaScoring);
          
          // Asignar los valores calculados
          row.libre = scoring.libre;
          row.total = scoring.total;
          row.viabilidad = scoring.viabilidad;
          
        } catch (error) {
          console.error("Error calculando scoring para");
          // Si falla el cálculo, dejar valores por defecto
          row.libre = 0;
          row.total = 0;
          row.viabilidad = 0;
        }
        
        rows.push(row);
      }
      
      setEnEstudioData(rows);
      
      // 5. Calcular resumen por tipo de crédito - INCLUIR TODOS LOS TIPOS
      const tiposCreditoMap = new Map<string, { count: number; monto: number }>();
      
      // Inicializar todos los tipos de crédito en 0
      const todosTiposCredito = [
        "Crédito de libranza",
        "Crédito de libranza y/o Nómina",
        "Crédito libre inversión",
        "Libre inversión",
        "Crédito compra de cartera",
        "Compra de cartera",
        "Crédito solidario",
      ];
      
      todosTiposCredito.forEach(tipo => {
        tiposCreditoMap.set(tipo, { count: 0, monto: 0 });
      });
      
      // Sumar los datos reales
      rows.forEach(row => {
        const existing = tiposCreditoMap.get(row.tipoCredito) || { count: 0, monto: 0 };
        tiposCreditoMap.set(row.tipoCredito, {
          count: existing.count + 1,
          monto: existing.monto + row.monto,
        });
      });
      
      // Convertir a array solo los que tienen solicitudes O los tipos principales
      const tiposPrincipales = [
        "Crédito de libranza y/o Nómina",
        "Libre inversión", 
        "Compra de cartera",
        "Crédito solidario",
      ];
      
      const summary: EnEstudioSummary[] = tiposPrincipales.map(tipo => {
        const data = tiposCreditoMap.get(tipo) || { count: 0, monto: 0 };
        return { label: tipo, count: data.count, monto: data.monto };
      });
      
      setEnEstudioSummary(summary);
      
    } catch (error) {
      console.error("Error fetching en estudio");
    } finally {
      setEnEstudioLoading(false);
    }
  }, [usuariosPorIds]);

  useEffect(() => {
    fetchSolicitudes();
    fetchEnEstudio(); // Cargar datos de en estudio al inicio
  }, [fetchSolicitudes, fetchEnEstudio]);

  // ========== HABILITAR SOLICITUD ==========
  // Upsert manual: la tabla no declara una restricción única por usuario.
  const guardarHabilitacion = async (
    tabla: "habilitar_credito" | "credito_solicitado_empresa",
    uid: string,
    payload: Record<string, unknown>
  ) => {
    const { data: existente, error: errorBusqueda } = await supabase
      .from(tabla)
      .select("id")
      .or(`user_ref.eq.${uid},uid.eq.${uid}`)
      .limit(1)
      .maybeSingle();

    if (errorBusqueda) throw errorBusqueda;

    if (existente?.id) {
      const { error } = await supabase.from(tabla).update(payload).eq("id", existente.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from(tabla).insert(payload);
    if (error) throw error;
  };

  const handleIniciarSolicitud = async () => {
    if (!usuarioEncontrado) return;
    const uid = (usuarioEncontrado.uid || usuarioEncontrado.docId || usuarioEncontrado.id) as string;
    if (!uid) return;
    setHabilitandoLoading(true);
    setConfirmOpen(false);
    try {
      const idAleatorio = Math.floor(100000 + Math.random() * 900000);
      let empresaNomina = "";

      try {
        const { data: ahorro } = await supabase
          .from("ahorros")
          .select("compay_name")
          .eq("user_ref", uid)
          .eq("savings_type", "Linea de Ahorro de nómina")
          .limit(1)
          .maybeSingle();

        empresaNomina = textoPlano(ahorro?.compay_name);
      } catch { /* sin ahorro */ }

      const fechaRegistro = parseFechaValue(usuarioEncontrado.created_time);

      const payload = {
        habilitar: true,
        user_ref: uid,
        uid,
        id_field: idAleatorio,
        nombre: textoPlano(usuarioEncontrado.display_name) || "N/A",
        documento:
          textoPlano(usuarioEncontrado.nit) || textoPlano(usuarioEncontrado.nro_documento),
        tipodecredito: tipoCredito,
        estado: "inicio de solicitud",
        fecha_solicitud: new Date().toISOString(),
        fecha_registro_app: fechaRegistro ? fechaRegistro.toISOString() : null,
        empresa: empresaNomina,
        empresa_nombre: empresaNomina,
      };

      await Promise.all([
        guardarHabilitacion("habilitar_credito", uid, payload),
        guardarHabilitacion("credito_solicitado_empresa", uid, payload),
      ]);

      setHabilitadoOk(true);
      fetchSolicitudes();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      setBusquedaError(`Error al habilitar el crédito (${err.message ?? "sin detalle"}).`);
      console.error("Error en handleIniciarSolicitud");
    } finally {
      setHabilitandoLoading(false);
    }
  };

  // ========== BUSCAR USUARIO ==========
  const handleBuscar = async () => {
    if (!cedulaBusqueda.trim()) return;
    setBusquedaLoading(true);
    setUsuarioEncontrado(null);
    setEmpresaEncontrada("");
    setBusquedaError("");
    setHabilitadoOk(false);
    setTipoCredito("");
    try {
      let usuario: Record<string, unknown> | null = null;
      if (tipoContacto === "cedula") {
        const resultados = await buscarUsuarioPorDocumento(cedulaBusqueda.trim());
        usuario = resultados.length > 0 ? resultados[0] : null;
      } else {
        const campo = tipoContacto === "email" ? "email" : "phone_number";
        usuario = await buscarUsuarioPor(campo, cedulaBusqueda.trim());
      }
      if (usuario) {
        setUsuarioEncontrado(usuario);
        const uidBuscar = (usuario.docId || usuario.uid) as string;
        let empresaNombre = "";

        if (usuario.empresa || usuario.empresaRef) {
          try {
            const emp = await obtenerEmpresaPorRef((usuario.empresa || usuario.empresaRef) as string);
            empresaNombre = (emp as Record<string, unknown>)?.nombreEmpresa as string || "";
          } catch { /* sin empresa */ }
        }

        if (!empresaNombre && uidBuscar) {
          try {
            const { data: ahorro } = await supabase
              .from("ahorros")
              .select("compay_name")
              .eq("user_ref", uidBuscar)
              .eq("savings_type", "Linea de Ahorro de nómina")
              .limit(1)
              .maybeSingle();

            empresaNombre = textoPlano(ahorro?.compay_name);
          } catch { /* sin ahorro */ }
        }

        setEmpresaEncontrada(empresaNombre);
      } else {
        setBusquedaError("No se encontró ningún usuario con ese dato.");
      }
    } catch {
      setBusquedaError("Error al buscar el usuario. Intenta nuevamente.");
    } finally {
      setBusquedaLoading(false);
    }
  };

  const tipoOpciones = [
    { key: "email" as const, label: "Email", placeholder: "Ingrese el correo" },
    { key: "celular" as const, label: "Celular", placeholder: "Ingrese el celular" },
    { key: "cedula" as const, label: "Cédula", placeholder: "Ingrese el número de cédula" },
  ];
  const placeholderActual = tipoOpciones.find(o => o.key === tipoContacto)?.placeholder ?? "";

  const filteredSolicitudes = solicitudes.filter(row =>
    row.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.numeroDocumento.includes(searchTerm)
  );

  // Filas de las pestañas que no tienen vista propia (validación, firma, desembolso)
  const estadoPorTab: Partial<Record<CreditStatus, string>> = {
    "inicio-solicitud": "inicio de solicitud",
    validacion: "validación",
    "pendiente-firma": "pendiente de firma",
    desembolso: "desembolso",
  };

  const filteredPorEstado = (tab: CreditStatus) => {
    const esperado = normalizarEstado(estadoPorTab[tab] ?? tab.replace(/-/g, " "));
    return todasSolicitudes.filter(
      (row) =>
        normalizarEstado(row.estado) === esperado &&
        (row.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.numeroDocumento.includes(searchTerm))
    );
  };

  const tableRows =
    activeTab === "inicio-solicitud" ? filteredSolicitudes : filteredPorEstado(activeTab);

  const countByStatus = (tab: CreditStatus) => {
    if (tab === "en-estudio") return enEstudioData.length;
    if (tab === "pre-aprobado") return preAprobadoMocked.length;
    const esperado = normalizarEstado(estadoPorTab[tab] ?? tab.replace(/-/g, " "));
    return todasSolicitudes.filter((row) => normalizarEstado(row.estado) === esperado).length;
  };

  // Filtrar datos de en estudio por tipo de crédito
  const filteredEnEstudio = enEstudioData.filter(row => row.tipoCredito === activeCreditTab);

  return (
    <MainLayout sidebarType="credito">
      <div className="space-y-6">
        {/* Search bar header */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground whitespace-nowrap">Crédito</h1>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Busca el nombre"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background rounded-2xl border-border"
            />
          </div>
        </div>

        {/* Main content card */}
        <Card className="rounded-3xl border-border">
          <CardHeader className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-foreground">Lista de usuarios</h2>
              <Button
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-bold text-base"
                onClick={() => setPerfilamientoOpen(true)}
              >
                Habilitar perfilamiento
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 pt-0">
            <div className="space-y-8">
              {/* Status tabs */}
              <div className="p-2 bg-muted rounded-2xl border border-border">
                <div className="flex gap-1 justify-end">
                  {statusTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-w-fit",
                        activeTab === tab.key 
                          ? "bg-background text-foreground border border-border shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab.label} (
                        {countByStatus(tab.key)}
                      )
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-border">
                {/* Table header - hidden in En estudio and Pre-aprobado */}
                {activeTab !== "en-estudio" && activeTab !== "pre-aprobado" && (
                  <div className="grid grid-cols-12 bg-muted">
                    <div className="p-4 text-muted-foreground font-medium text-sm">ID</div>
                    <div className="col-span-2 p-4 text-muted-foreground font-medium text-sm">Nombres y Apellidos</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Número de documento</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Fecha de solicitud</div>
                    <div className="col-span-2 p-4 text-muted-foreground font-medium text-sm">Tipo de crédito</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Empresa</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Antigüedad empresa</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Antigüedad usuario</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Tiempo en espera</div>
                    <div className="p-4 text-muted-foreground font-medium text-sm">Estado</div>
                  </div>
                )}

                {/* Table rows */}
                {solicitudesLoading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Cargando...
                  </div>
                ) : activeTab === "en-estudio" ? (
                  <div className="p-0">
                    {/* Summary cards */}
                    {enEstudioLoading ? (
                      <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Cargando datos...
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-4 p-6 pb-0">
                          {enEstudioSummary.map((s) => (
                            <div
                              key={s.label}
                              onClick={() => { setActiveCreditTab(s.label); setExpandedEnEstudio(null); }}
                              className={cn(
                                "flex-1 px-5 py-4 rounded-2xl cursor-pointer transition-colors select-none flex flex-col items-center gap-1.5",
                                activeCreditTab === s.label
                                  ? "bg-[#0B35B8] text-white"
                                  : "bg-white border border-border hover:bg-muted/40"
                              )}
                            >
                              <p className={cn(
                                "text-xl font-medium",
                                activeCreditTab === s.label ? "text-white" : "text-foreground"
                              )} style={{ fontFamily: "Clash Display" }}>
                                {s.label} ({s.count})
                              </p>
                              <p className={cn(
                                "text-base font-medium",
                                activeCreditTab === s.label ? "text-white/70" : "text-muted-foreground"
                              )} style={{ fontFamily: "Clash Display" }}>
                                {formatPesos(s.monto)}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* User rows */}
                        <div className="p-6 space-y-4">
                          {filteredEnEstudio.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No hay solicitudes en estudio en esta categoría</div>
                          ) : (
                            filteredEnEstudio.map((row) => {
                              const isOpen = expandedEnEstudio === row.uid;
                              return (
                                <div key={row.uid} className={cn("rounded-2xl p-6", isOpen ? "bg-[#FAFAFA] border border-border" : "bg-[#FAFAFA]")}>
                                  {/* Header row */}
                                  <div className="flex items-start justify-between">
                                    {/* Left: name + badges */}
                                    <div className="space-y-3">
                                      <p className="text-xl font-bold text-foreground">{row.nombre}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-2 rounded-full text-sm font-medium" style={{ background: "rgba(255,103,0,0.12)", color: "#FF6700" }}>
                                          {row.tipoCredito}
                                        </span>
                                        <span className="px-2.5 py-2 rounded-full text-sm font-medium" style={{ background: "rgba(9,121,214,0.12)", color: "#0979D6" }}>
                                          En estudio
                                        </span>
                                        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-full" style={{ background: "rgba(233,179,2,0.15)" }}>
                                          <Clock size={14} className="text-[#E9B302]" />
                                          <span className="text-sm font-medium text-foreground">
                                            {tiempoTranscurridoFormato(row.fechaSolicitud)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: stats + chevron */}
                                    <div className="flex items-center gap-4">
                                      <div className="w-[240px] px-5 py-3.5 bg-white rounded-2xl">
                                        <p className="text-xl font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>{formatPesos(row.monto)}</p>
                                        <p className="text-sm font-medium text-muted-foreground">Monto de solicitud de crédito</p>
                                      </div>
                                      <div className="w-[150px] px-5 py-3.5 bg-white rounded-2xl">
                                        <p className="text-xl font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>{row.libre}%</p>
                                        <p className="text-sm font-medium text-muted-foreground">Libre</p>
                                      </div>
                                      <div className="w-[150px] px-5 py-3.5 bg-white rounded-2xl">
                                        <p className="text-xl font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>{row.total}%</p>
                                        <p className="text-sm font-medium text-muted-foreground">Total</p>
                                      </div>
                                      <div className="w-[150px] px-5 py-3.5 rounded-2xl" style={{ background: "#E5EAF4" }}>
                                        <p className="text-xl font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>{row.viabilidad}%</p>
                                        <p className="text-sm font-medium text-muted-foreground">Viabilidad</p>
                                      </div>
                                      <button
                                        onClick={() => setExpandedEnEstudio(isOpen ? null : row.uid)}
                                        className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-border hover:bg-muted/50 transition-colors"
                                      >
                                        {isOpen ? <ChevronUp size={18} className="text-foreground" /> : <ChevronDown size={18} className="text-foreground" />}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expanded detail */}
                                  {isOpen && (
                                    <>
                                      <div className="flex gap-4 mt-6">
                                        {/* Col 1: Info usuario */}
                                        <div className="flex-1 bg-white rounded-2xl p-4 pt-5 space-y-5">
                                          <p className="text-base font-bold text-foreground">Información de usuario</p>
                                          <div className="space-y-3">
                                            {[
                                              ["Salario:", formatPesos(row.salarioBase)],
                                              ["Total ingresos:", formatPesos(row.totalIngresos)],
                                              ["Total gastos:", formatPesos(row.gastosFijos)],
                                              ["Salario disponible:", formatPesos(row.salarioBase - row.gastosFijos)],
                                            ].map(([k, v]) => (
                                              <div key={k} className="flex justify-between text-sm">
                                                <span className="text-muted-foreground font-medium">{k}</span>
                                                <span className="font-medium text-foreground">{v}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="h-px" style={{ background: "rgba(38,38,50,0.08)" }} />
                                          <div className="space-y-2">
                                            {[
                                              ["Monto de solicitud de crédito","5%","0.15%"],
                                              ["Básica","5%","0.15%"],
                                              ["Estabilidad laboral","25%","0.78%"],
                                              ["Información financiera","5%","0.92%"],
                                              ["Información crediticia","5%","0.15%"],
                                            ].map(([label, pct, res]) => (
                                              <div key={label} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{ background: "#F5F5F5" }}>
                                                <span className="text-sm font-medium text-foreground">{label}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm text-muted-foreground">%:</span>
                                                  <span className="text-sm font-medium text-foreground">{pct}</span>
                                                  <div className="w-px h-2 bg-[#DDDDDD]" />
                                                  <span className="text-sm text-muted-foreground">Resultado:</span>
                                                  <span className="text-sm font-medium text-foreground">{res}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Col 2: Centrales de riesgo */}
                                        <div className="flex-1 bg-white rounded-2xl p-4 pt-5 space-y-5">
                                          <p className="text-base font-bold text-foreground">Calculo de información centrales de riesgo</p>
                                          <div className="space-y-3">
                                            {[
                                              ["Salario:", formatPesos(row.salarioBase)],
                                              ["Total ingresos:", formatPesos(row.totalIngresos)],
                                              ["Total gastos:", formatPesos(row.gastosFijos)],
                                              ["Salario disponible:", formatPesos(row.salarioBase - row.gastosFijos)],
                                            ].map(([k, v]) => (
                                              <div key={k} className="flex justify-between text-sm">
                                                <span className="text-muted-foreground font-medium">{k}</span>
                                                <span className="font-medium text-foreground">{v}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="h-px" style={{ background: "rgba(38,38,50,0.08)" }} />
                                          <div className="space-y-2">
                                            {[
                                              ["Monto de solicitud de crédito","5%","0.15%"],
                                              ["Básica","5%","0.15%"],
                                              ["Estabilidad laboral","25%","0.78%"],
                                              ["Información financiera","5%","0.92%"],
                                              ["Información crediticia","5%","0.15%"],
                                            ].map(([label, pct, res]) => (
                                              <div key={label} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{ background: "#F5F5F5" }}>
                                                <span className="text-sm font-medium text-foreground">{label}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm text-muted-foreground">%:</span>
                                                  <span className="text-sm font-medium text-foreground">{pct}</span>
                                                  <div className="w-px h-2 bg-[#DDDDDD]" />
                                                  <span className="text-sm text-muted-foreground">Resultado:</span>
                                                  <span className="text-sm font-medium text-foreground">{res}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Col 3: Laboral + Resultado */}
                                        <div className="flex-1 bg-white rounded-2xl p-4 pt-5 space-y-5">
                                          <div>
                                            <div className="flex items-center justify-between mb-10">
                                              <p className="text-base font-bold text-foreground">Información laboral (empresa)</p>
                                              <span className="text-sm font-bold" style={{ color: "#E9B302" }}>En espera</span>
                                            </div>
                                            <button className="w-[314px] mx-auto block py-2.5 px-3.5 rounded-xl text-base font-bold" style={{ background: "#FFF4EC", color: "#FF6700" }}>
                                              Iniciar solicitud
                                            </button>
                                          </div>
                                          <div className="h-px" style={{ background: "rgba(38,38,50,0.08)" }} />
                                          <div>
                                            <p className="text-base font-bold text-foreground mb-5">Resultado de estudio</p>
                                            <div className="space-y-3">
                                              {[
                                                ["Monto solicitado:", formatPesos(row.monto)],
                                                ["Tiempo solicitado:", `${row.mesesApagar} meses`],
                                                ["Monto aprobado:", "-"],
                                                ["Tiempo aprobado:", "-"],
                                              ].map(([k, v]) => (
                                                <div key={k} className="flex justify-between text-sm">
                                                  <span className="text-muted-foreground font-medium">{k}</span>
                                                  <span className="font-medium text-foreground">{v}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action buttons */}
                                      <div className="flex items-center justify-center gap-4 mt-8">
                                        <Button
                                          variant="outline"
                                          className="w-[216px] h-[52px] rounded-xl border-foreground/10 text-base font-bold"
                                          onClick={() => { setDetalleRow(row); setDetalleTab("persona"); setDetalleOpen(true); }}
                                        >
                                          Ver detalles
                                        </Button>
                                        <button
                                          className="w-[216px] h-[52px] rounded-xl text-base font-bold"
                                          style={{ background: "#FFEEEE", color: "#FF4F4F" }}
                                        >
                                          Rechazar
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : activeTab === "pre-aprobado" ? (
                  <div className="p-0">
                    {/* Summary cards */}
                    <div className="flex gap-4 p-6 pb-0">
                      {preAprobadoSummary.map((s) => (
                        <div
                          key={s.label}
                          onClick={() => { setActivePreAprobadoTab(s.label); setExpandedPreAprobado(null); }}
                          className={cn(
                            "flex-1 px-5 py-4 rounded-2xl cursor-pointer transition-colors select-none flex flex-col items-center gap-1.5",
                            activePreAprobadoTab === s.label
                              ? "bg-[#0B35B8] text-white"
                              : "bg-white border border-border hover:bg-muted/40"
                          )}
                        >
                          <p className={cn(
                            "text-xl font-medium",
                            activePreAprobadoTab === s.label ? "text-white" : "text-foreground"
                          )} style={{ fontFamily: "Clash Display" }}>
                            {s.label} ({s.count})
                          </p>
                          <p className={cn(
                            "text-base font-medium",
                            activePreAprobadoTab === s.label ? "text-white/70" : "text-muted-foreground"
                          )} style={{ fontFamily: "Clash Display" }}>
                            {formatPesos(s.monto)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* User rows */}
                    <div className="p-6 space-y-4">
                      {preAprobadoMocked.filter(r => r.tipoCredito === activePreAprobadoTab).length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No hay solicitudes pre-aprobadas en esta categoría</div>
                      ) : (
                        preAprobadoMocked.filter(r => r.tipoCredito === activePreAprobadoTab).map((row) => {
                          const isOpen = expandedPreAprobado === row.uid;
                          return (
                            <div key={row.uid} className="bg-[#FAFAFA] rounded-2xl p-6">
                              {/* Header row */}
                              <div className="flex items-start justify-between">
                                {/* Left: name, badge, info */}
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <p className="text-xl font-bold text-foreground">{row.nombre}</p>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: "rgba(233,179,2,0.15)" }}>
                                      <Clock size={14} className="text-[#E9B302]" />
                                      <span className="text-sm font-medium text-foreground">{row.tiempoTranscurrido}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-foreground">
                                    <div className="flex items-center gap-2">
                                      <IdCard size={16} className="text-foreground" />
                                      <span>{row.documento}</span>
                                    </div>
                                    <div className="w-px h-2.5 bg-[#DDDDDD]" />
                                    <div className="flex items-center gap-2">
                                      <Mail size={16} className="text-foreground" />
                                      <span>{row.email}</span>
                                    </div>
                                    <div className="w-px h-2.5 bg-[#DDDDDD]" />
                                    <div className="flex items-center gap-2">
                                      <Phone size={16} className="text-foreground" />
                                      <span>{row.telefono}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: plazo, monto, chevron */}
                                <div className="flex items-center gap-4">
                                  <div className="px-5 py-3.5 bg-white rounded-2xl">
                                    <p className="text-xl font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>{row.plazo} meses</p>
                                    <p className="text-sm font-medium text-muted-foreground">Tiempo</p>
                                  </div>
                                  <div className="px-5 py-3.5 rounded-2xl" style={{ background: "rgba(9,121,214,0.08)" }}>
                                    <p className="text-xl font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>{formatPesos(row.montoAprobado)}</p>
                                    <p className="text-sm font-medium text-muted-foreground">Monto pre-aprobado</p>
                                  </div>
                                  <button
                                    onClick={() => setExpandedPreAprobado(isOpen ? null : row.uid)}
                                    className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-border hover:bg-muted/50 transition-colors"
                                  >
                                    {isOpen ? <ChevronUp size={18} className="text-foreground" /> : <ChevronDown size={18} className="text-foreground" />}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded detail */}
                              {isOpen && (
                                <>
                                  <div className="h-px bg-border my-5" />

                                  {/* Datos de empresa */}
                                  <div className="space-y-4">
                                    <p className="text-base font-medium text-foreground" style={{ fontFamily: "Clash Display" }}>Datos de empresa</p>
                                    <div className="bg-white rounded-2xl p-4">
                                      <div className="grid grid-cols-4 gap-8">
                                        <div className="space-y-1">
                                          <p className="text-sm text-muted-foreground">NIT de la empresa</p>
                                          <p className="text-base font-medium text-foreground">{row.empresaNit}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-sm text-muted-foreground">Empresa</p>
                                          <p className="text-base font-medium text-foreground">{row.empresa}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-sm text-muted-foreground">Ciudad</p>
                                          <p className="text-base font-medium text-foreground">{row.ciudad}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-sm text-muted-foreground">Tipo de contrato</p>
                                          <p className="text-base font-medium text-foreground">{row.tipoContrato}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex items-center justify-center gap-4 mt-8">
                                    <Button
                                      variant="outline"
                                      className="w-[216px] h-[52px] rounded-xl border-foreground/10 text-base font-bold"
                                    >
                                      Ver estudio previo
                                    </Button>
                                    <Button
                                      className="w-[216px] h-[52px] rounded-xl text-base font-bold text-white"
                                      style={{ background: "#FF6700" }}
                                    >
                                      Crear Crédito
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : tableRows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No se encontraron solicitudes
                  </div>
                ) : (
                  tableRows.map((row) => (
                    <div
                      key={row.uid}
                      className="grid grid-cols-12 bg-background border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="p-4 font-medium text-foreground text-sm">{row.id}</div>
                      <div className="col-span-2 p-4 text-foreground text-sm">{row.nombreCompleto}</div>
                      <div className="p-4 text-foreground text-sm">{row.numeroDocumento}</div>
                      <div className="p-4 text-foreground text-sm">{row.fechaSolicitud}</div>
                      <div className="col-span-2 p-4 text-foreground text-sm">{row.tipodecredito || "-"}</div>
                      <div className="p-4 text-foreground text-sm">{row.empresa || "-"}</div>
                      <div className="p-4 text-foreground text-sm">{row.antiguedadEmpresa || "-"}</div>
                      <div className="p-4 text-foreground text-sm">{row.antiguedadUsuario || "-"}</div>
                      <div className="p-4 text-foreground text-sm">
                        {row.fechaSolicitudRaw ? (
                          <span style={{ background: "rgba(233,179,2,0.15)", color: "#b45309", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {tiempoTranscurrido(row.fechaSolicitudRaw)}
                          </span>
                        ) : "-"}
                      </div>
                      <div className="p-4">
                        <Badge variant="secondary" className="px-2 py-1 text-xs bg-blue-100 text-blue-800">
                          {row.estado}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Habilitar perfilamiento */}
      <Dialog open={perfilamientoOpen} onOpenChange={setPerfilamientoOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Habilitar perfilamiento</DialogTitle>
            <DialogDescription className="sr-only">
              Busca un usuario por cedula, correo o celular y habilita la solicitud de credito.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <Input
              placeholder={placeholderActual}
              value={cedulaBusqueda}
              onChange={(e) => setCedulaBusqueda(e.target.value)}
              className="rounded-xl flex-1"
            />
            <Select value={tipoContacto} onValueChange={(v) => { setTipoContacto(v as typeof tipoContacto); setCedulaBusqueda(""); }}>
              <SelectTrigger className="rounded-xl w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="celular">Celular</SelectItem>
                <SelectItem value="cedula">Cédula</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="bg-primary text-primary-foreground rounded-xl px-5 font-semibold"
              onClick={handleBuscar}
              disabled={busquedaLoading || !cedulaBusqueda.trim()}
            >
              {busquedaLoading ? <Loader2 size={16} className="animate-spin" /> : "Buscar"}
            </Button>
          </div>

          {/* Resultado */}
          {busquedaError && (
            <p className="text-sm text-destructive mt-3">{busquedaError}</p>
          )}
          {usuarioEncontrado && (
            <div className="mt-4 p-5 rounded-2xl border border-border bg-background shadow-sm">
              <p className="text-base font-semibold text-foreground mb-4">
                {(usuarioEncontrado.display_name as string) || "N/A"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Correo electrónico</p>
                    <p className="text-sm font-medium text-foreground break-all">{(usuarioEncontrado.email as string) || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <IdCard size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Identificación</p>
                    <p className="text-sm font-medium text-foreground">{(usuarioEncontrado.nit as string) || (usuarioEncontrado.id as string) || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm font-medium text-foreground">{(usuarioEncontrado.phone_number as string) || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="text-sm font-medium text-foreground">{empresaEncontrada || "Sin empresa"}</p>
                  </div>
                </div>
              </div>
              {!habilitadoOk && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-foreground mb-3">Tipo de crédito</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Crédito de libranza y/o Nómina",
                      "Libre inversión",
                      "Compra de cartera",
                      "Crédito solidario",
                    ].map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setTipoCredito(tipo)}
                        className={cn(
                          "text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                          tipoCredito === tipo
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-muted/50 text-foreground hover:border-primary/50 hover:bg-muted"
                        )}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-5 flex justify-center">
                {habilitadoOk ? (
                  <div className="w-full text-center py-3 rounded-2xl bg-green-100 text-green-700 font-semibold text-base">
                    ✓ Crédito habilitado correctamente
                  </div>
                ) : (
                  <Button
                    className="bg-primary text-primary-foreground rounded-2xl px-10 py-3 font-semibold text-base w-full"
                    onClick={() => setConfirmOpen(true)}
                    disabled={habilitandoLoading || !tipoCredito}
                  >
                    {habilitandoLoading ? <Loader2 size={16} className="animate-spin" /> : "Iniciar solicitud"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">Confirmar habilitación</DialogTitle>
            <DialogDescription className="sr-only">
              Confirma la habilitacion del credito para el usuario seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-center space-y-1">
            <p className="text-sm text-muted-foreground">Vas a habilitar crédito para</p>
            <p className="text-base font-semibold text-foreground">
              {usuarioEncontrado ? ((usuarioEncontrado.display_name as string) || "este usuario") : ""}
            </p>
            {tipoCredito && (
              <p className="text-sm text-muted-foreground mt-1">
                Tipo: <span className="font-medium text-foreground">{tipoCredito}</span>
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground rounded-xl font-semibold"
              onClick={handleIniciarSolicitud}
              disabled={habilitandoLoading}
            >
              {habilitandoLoading ? <Loader2 size={16} className="animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Detalles */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-5xl w-full rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogDescription className="sr-only">
            Detalle del estudio de credito con informacion de persona, central de riesgo y empresa.
          </DialogDescription>
          {detalleRow && (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 bg-white border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-medium text-foreground" style={{fontFamily:"Clash Display"}}>
                      {detalleRow.nombre}
                    </span>
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium" style={{background:"rgba(255,103,0,0.12)", color:"#FF6700"}}>
                      {detalleRow.tipoCredito}
                    </span>
                  </div>
                </div>
                {/* Tab bar */}
                <div className="flex gap-3">
                  {(["persona","central","empresa"] as const).map((t) => {
                    const labels = { persona:"Persona", central:"Central de riesgo", empresa:"Empresa" };
                    return (
                      <button
                        key={t}
                        onClick={() => setDetalleTab(t)}
                        className={cn(
                          "flex-1 py-3 rounded-2xl text-lg font-medium transition-colors",
                          detalleTab === t
                            ? "bg-primary text-white"
                            : "bg-white border border-border text-foreground hover:bg-muted/40"
                        )}
                        style={{fontFamily:"Clash Display"}}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-white border-b border-border">
                {[
                  { val: `${detalleRow.libre}%`, label: "Libre" },
                  { val: `${detalleRow.total}%`, label: "Total" },
                  { val: `${detalleRow.viabilidad}%`, label: "Viabilidad" },
                ].map(({ val, label }) => (
                  <div key={label} className="bg-muted rounded-2xl py-4 flex flex-col items-center gap-1">
                    <span className="text-2xl font-medium text-foreground" style={{fontFamily:"Clash Display"}}>{val}</span>
                    <span className="text-sm text-muted-foreground font-medium">{label}</span>
                  </div>
                ))}
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4 bg-white">

                {/* ===== PERSONA TAB ===== */}
                {detalleTab === "persona" && (
                  <>
                    {/* Sección: Monto de solicitud */}
                    <SectionCard
                      title="Monto de solicitud de crédito"
                      porcentaje="5%"
                      resultado="0.15%"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <FieldCard label="Monto de solicitud de crédito" value={formatPesos(detalleRow.monto)} puntaje={3} />
                        <FieldCard label="¿En cuántos meses deseas pagar?" value={`${detalleRow.mesesApagar} meses`} puntaje={3} />
                      </div>
                    </SectionCard>

                    {/* Sección: Básica */}
                    <SectionCard title="Básica" porcentaje="5%" resultado="0.15%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="Estado civil" value={detalleRow.estadoCivil || "N/A"} puntaje={3} />
                        <FieldCard label="¿Cuántas personas dependen económicamente de usted?" value={detalleRow.personasDependientes || "N/A"} puntaje={3} />
                        <FieldCard label="¿Tiene personas menores de edad y adultos mayores?" value={detalleRow.adultosAcargo || "N/A"} puntaje={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <FieldCard label="¿Cuánto tiempo lleva reside en esa dirección?" value={detalleRow.tiempoResidiendo || "N/A"} puntaje={3} />
                        <FieldCard label="¿La casa es arrendada, propia o familiar?" value={detalleRow.tipoVivienda || "N/A"} puntaje={3} />
                      </div>
                    </SectionCard>

                    {/* Sección: Estabilidad laboral */}
                    <SectionCard title="Estabilidad laboral" porcentaje="25%" resultado="0.78%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="¿Cuáles es el nombre de su empleador o empresa?" value={detalleRow.empresaNombre || "N/A"} puntaje={3} />
                        <FieldCard label="¿Cuánto tiempo lleva laborando?" value={detalleRow.tiempoEmpleo || "N/A"} puntaje={5} />
                        <FieldCard label="¿Cuál es su salario?" value={formatPesos(detalleRow.salarioBase)} puntaje={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <FieldCard label="¿Qué tipo de contrato tiene?" value={detalleRow.tipodeContrato || "N/A"} puntaje={2} />
                        <FieldCard label="¿Ha tenido interrupciones laborales en los últimos 18 meses?" value={detalleRow.interrupcionesLab || "N/A"} puntaje={1} />
                      </div>
                    </SectionCard>

                    {/* Sección: Información financiera */}
                    <SectionCard title="Información financiera" porcentaje="25%" resultado="0.92%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="Otras fuentes de ingreso" value={detalleRow.fuentesingreso || "N/A"} puntaje={5} />
                        <FieldCard label="¿Cuál es su valor mensual de sus gastos fijos?" value={formatPesos(detalleRow.gastosFijos)} puntaje={1} />
                        <FieldCard label="¿Cuál es su promedio mensual de sus fuentes de ingreso?" value={formatPesos(detalleRow.promIngresos)} puntaje={2} />
                      </div>
                    </SectionCard>

                    {/* Sección: Información crediticia */}
                    <SectionCard title="Información crediticia" porcentaje="5%" resultado="0.75%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="¿Cuántos créditos activos tiene actualmente?" value={detalleRow.cuantoscreditos || "N/A"} puntaje={5} />
                        <FieldCard label="¿Ha tenido retraso en pago de obligaciones en los últimos 3 meses?" value={detalleRow.retrasoPagos || "N/A"} puntaje={5} />
                        <FieldCard label="¿Cuántas tarjetas de crédito tiene actualmente?" value={detalleRow.tarjetasActivas || "N/A"} puntaje={5} />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <FieldCard label='¿Ha hecho uso de créditos informales o "gota a gota"?' value={detalleRow.creditoGota || "N/A"} puntaje={2} />
                        <FieldCard label="¿Cuánto paga por créditos actualmente (en proporción al ingreso)?" value={formatPesos(detalleRow.pagoOtrasDeudas)} puntaje={3} />
                        <FieldCard label="¿Ha tenido reportes negativos en centrales de riesgo en los últimos 12 meses?" value={detalleRow.centralRiesgo || "N/A"} puntaje={5} />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <FieldCard label="¿Tiene inversiones activas?" value={detalleRow.inversionActiva || "N/A"} puntaje={2} />
                      </div>
                    </SectionCard>
                  </>
                )}

                {/* ===== CENTRAL DE RIESGO TAB ===== */}
                {detalleTab === "central" && (
                  <>
                    <SectionCard title="Monto de solicitud de crédito" porcentaje="5%" resultado="0.15%">
                      <div className="grid grid-cols-2 gap-3">
                        <FieldCard label="Monto de solicitud de crédito" value={formatPesos(detalleRow.monto)} puntaje={3} />
                        <FieldCard label="¿En cuántos meses deseas pagar?" value={`${detalleRow.mesesApagar} meses`} puntaje={3} />
                      </div>
                    </SectionCard>

                    <SectionCard title="Básica" porcentaje="5%" resultado="0.15%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="Estado civil" value={detalleRow.estadoCivil || "N/A"} puntaje={3} />
                        <FieldCard label="¿Cuántas personas dependen económicamente de usted?" value={detalleRow.personasDependientes || "N/A"} puntaje={3} />
                        <FieldCard label="¿Tiene personas menores de edad y adultos mayores?" value={detalleRow.adultosAcargo || "N/A"} puntaje={3} />
                      </div>
                    </SectionCard>

                    <SectionCard title="Estabilidad laboral" porcentaje="25%" resultado="0.78%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="¿Cuáles es el nombre de su empleador o empresa?" value={detalleRow.empresaNombre || "N/A"} puntaje={3} />
                        <FieldCard label="¿Cuánto tiempo lleva laborando?" value={detalleRow.tiempoEmpleo || "N/A"} puntaje={5} />
                        <FieldCard label="¿Cuál es su salario?" value={formatPesos(detalleRow.salarioBase)} puntaje={3} />
                      </div>
                    </SectionCard>

                    <SectionCard title="Información financiera" porcentaje="25%" resultado="0.82%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="Otras fuentes de ingreso" value={detalleRow.fuentesingreso || "N/A"} puntaje={5} />
                        <FieldCard label="¿Cuál es su valor mensual de sus gastos fijos?" value={formatPesos(detalleRow.gastosFijos)} puntaje={1} />
                        <FieldCard label="¿Cuál es su promedio mensual de sus fuentes de ingreso?" value={formatPesos(detalleRow.promIngresos)} puntaje={2} />
                      </div>
                    </SectionCard>

                    <SectionCard title="Información crediticia" porcentaje="5%" resultado="0.75%">
                      <div className="grid grid-cols-3 gap-3">
                        <FieldCard label="¿Cuántos créditos activos tiene actualmente?" value={detalleRow.cuantoscreditos || "N/A"} puntaje={5} />
                        <FieldCard label="¿Ha tenido retraso en pago de obligaciones en los últimos 3 meses?" value={detalleRow.retrasoPagos || "N/A"} puntaje={5} />
                        <FieldCard label="¿Cuántas tarjetas de crédito tiene actualmente?" value={detalleRow.tarjetasActivas || "N/A"} puntaje={5} />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <FieldCard label='¿Ha hecho uso de créditos informales o "gota a gota"?' value={detalleRow.creditoGota || "N/A"} puntaje={2} />
                        <FieldCard label="¿Cuánto paga por créditos actualmente (en proporción al ingreso)?" value={formatPesos(detalleRow.pagoOtrasDeudas)} puntaje={3} />
                        <FieldCard label="¿Ha tenido reportes negativos en centrales de riesgo en los últimos 12 meses?" value={detalleRow.centralRiesgo || "N/A"} puntaje={5} />
                      </div>
                      <div className="mt-3">
                        <FieldCard label="¿Tiene inversiones activas?" value={detalleRow.inversionActiva || "N/A"} puntaje={2} />
                      </div>
                    </SectionCard>
                  </>
                )}

                {/* ===== EMPRESA TAB ===== */}
                {detalleTab === "empresa" && (
                  <>
                    {/* Verificar si hay datos de empresa */}
                    {!detalleRow.salarioBase && !detalleRow.totalIngresos && !detalleRow.tipoContrato ? (
                      <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Building2 size={32} className="text-muted-foreground" />
                        </div>
                        <p className="text-xl font-medium text-foreground mb-2">Aún no se tienen datos de la empresa</p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                          Los datos laborales y de empresa se cargarán cuando el usuario complete la información empresarial
                        </p>
                      </div>
                    ) : (
                      <>
                        <SectionCard title="Estabilidad y vinculación" porcentaje="35%">
                          <div className="grid grid-cols-2 gap-3">
                            <FieldCard label="Tipo de contrato" value={detalleRow.tipoContrato || "N/A"} puntaje={30} />
                            <FieldCard label="¿Antigüedad en el empresa?" value={detalleRow.antiguedadEmpresa || "N/A"} puntaje={5} />
                          </div>
                        </SectionCard>

                        <SectionCard title="Ingresos" porcentaje="30%">
                          <div className="grid grid-cols-2 gap-3">
                            <FieldCard label="Comisiones/Bonos Salariales" value={formatPesos(detalleRow.comisionesSalariales)} puntaje={15} />
                            <FieldCard label="Bonos No Salariales" value={formatPesos(detalleRow.bonosNoSalariales)} puntaje={15} />
                          </div>
                        </SectionCard>

                        <SectionCard title="Financiera colaborador" porcentaje="10%">
                          <div className="grid grid-cols-2 gap-3">
                            <FieldCard label="¿Tiene libranzas?" value={detalleRow.libranzas ? `Si (${detalleRow.cantidadLibranzas})` : "No"} puntaje={10} />
                            <FieldCard label="¿Tiene embargos?" value={detalleRow.embargos ? "Si" : "No"} puntaje={10} />
                          </div>
                        </SectionCard>

                        <SectionCard title='Garantía "oculta"' porcentaje="10%">
                          <div className="grid grid-cols-1 gap-3">
                            <FieldCard label="Días de vacaciones acumulados" value={`${detalleRow.diasVacaciones} días`} puntaje={10} />
                          </div>
                        </SectionCard>

                        <div className="p-6 bg-muted/40 rounded-2xl border border-border">
                          <p className="text-base font-bold text-foreground mb-4">Información financiera laboral</p>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: "Salario básico mensual", value: formatPesos(detalleRow.salarioBase) },
                              { label: "Comisiones / Extras", value: formatPesos(detalleRow.comisionesSalariales) },
                              { label: "Auxilios No Salariales", value: formatPesos(detalleRow.valorAuxilio) },
                              { label: "Total Descuentos", value: formatPesos(detalleRow.totalDescuentos) },
                              { label: "Valor Libranzas", value: formatPesos(detalleRow.valorLibranzas) },
                              { label: "Valor Embargos", value: formatPesos(detalleRow.valorEmbargos) },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                <span className="text-sm font-medium text-foreground">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}

/* ── helpers ── */
function SectionCard({
  title,
  porcentaje,
  resultado,
  children,
}: {
  title: string;
  porcentaje?: string;
  resultado?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 bg-muted/40 rounded-2xl border border-border">
      <div className="flex items-center justify-between mb-5">
        <span className="text-lg font-medium text-foreground" style={{fontFamily:"Clash Display"}}>{title}</span>
        <div className="flex items-center gap-2">
          {porcentaje && (
            <span className="px-3 py-1.5 bg-white rounded-xl text-sm text-muted-foreground">
              %: <span className="font-medium text-foreground">{porcentaje}</span>
            </span>
          )}
          {resultado && (
            <span className="px-3 py-1.5 rounded-xl text-sm text-muted-foreground" style={{background:"rgba(0,106,216,0.10)"}}>
              Resultado: <span className="font-medium text-foreground">{resultado}</span>
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function FieldCard({ label, value, puntaje }: { label: string; value: string; puntaje: number }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white rounded-2xl px-4 py-3.5">
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-xs text-muted-foreground leading-snug">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
      <div className="shrink-0 px-3 py-1.5 bg-muted rounded-xl flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xs text-muted-foreground">Puntaje:</span>
        <span className="text-sm font-bold text-foreground" style={{fontFamily:"Clash Display"}}>{puntaje}</span>
      </div>
    </div>
  );
}