import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/supabase/config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import { UserDetailModal } from "@/components/fondos/UserDetailModal";
import { cn } from "@/lib/utils";

const SAVINGS_TYPE = "Linea de Ahorro Los Mejores";
const MONTO_MINIMO = 200000;
const CHUNK_SIZE = 100;

interface StatCardProps {
  value: string;
  label: string;
  highlight?: boolean;
}

function StatCard({ value, label, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl px-5 py-4 bg-card",
      highlight && "bg-[#E5E7EB]"
    )}>
      <p className="text-lg font-bold text-foreground">
        {value}
      </p>
      <p className="text-sm text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

interface AhorroRow {
  id: string;
  user_ref: string | null;
  user_name: string | null;
  monto_total: number | null;
  savings_type: string | null;
  ahorros_doc_pdf1: string | null;
  fechacreacion: string | null;
}

interface AhorroTableData {
  id: string;
  documento: string; // nit o id del user
  telefono: string; // phone_number del user
  nombre: string; // user_name del ahorro
  saldoActual: number; // monto_total del ahorro
  ahorrado: number; // suma de transacciones Depositado/APPROVED
  retirado: number; // suma de transacciones Withdrawal/APPROVED+PENDING
  beneficios: number; // cálculo EA 9% sobre depósitos (solo 2026)
}

// Convierte ISO string, Date o Timestamp serializado en Date
const parseFecha = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    try {
      const fecha = value.toDate();
      return isNaN(fecha.getTime()) ? null : fecha;
    } catch {
      return null;
    }
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const fecha = new Date(value);
  return isNaN(fecha.getTime()) ? null : fecha;
};

const dividirEnChunks = <T,>(items: T[], size = CHUNK_SIZE): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export default function FondosIndependientes() {
  const [activeYear, setActiveYear] = useState("2025");
  const [selectedUser, setSelectedUser] = useState<AhorroTableData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statsData, setStatsData] = useState({
    totalUsuarios: 0,
    usuariosActivos: 0,
    totalSaldoActual: 0,
    totalAhorrado: 0,
    totalRetirado: 0,
    beneficiosAcumulados: 0
  });
  const [loading, setLoading] = useState(false);
  const [tablaData, setTablaData] = useState<AhorroTableData[]>([]);
  const [tablaDataCompleta, setTablaDataCompleta] = useState<AhorroTableData[]>([]);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState("");

  // Función para obtener rango de fechas según año activo
  const obtenerRangoFechas = () => {
    if (activeYear === '2025') {
      // Para 2025: incluir 2024 Y 2025
      return {
        fechaInicio: new Date('2024-01-01T00:00:00.000Z'),
        fechaFin: new Date('2025-12-31T23:59:59.999Z')
      };
    } else if (activeYear === '2026') {
      // Para 2026: incluir solo 2026
      return {
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-12-31T23:59:59.999Z')
      };
    }
    // Fallback: todos los datos
    return {
      fechaInicio: new Date('2020-01-01T00:00:00.000Z'),
      fechaFin: new Date('2030-12-31T23:59:59.999Z')
    };
  };

  // Función para cargar datos reales (SOLO PARA TARJETAS)
  const cargarDatosReales = async () => {
    try {
      setLoading(true);

      const { fechaInicio, fechaFin } = obtenerRangoFechas();
      const ini = fechaInicio.toISOString();
      const fin = fechaFin.toISOString();

      const [ahorrosActivosRes, depositosRes, retirosRes, ahorrosTodosRes] = await Promise.all([
        supabase
          .from('ahorros')
          .select('id, monto_total, savings_type')
          .eq('savings_type', SAVINGS_TYPE)
          .gte('monto_total', MONTO_MINIMO),
        supabase
          .from('transactions')
          .select('ahorros_id, amount, firebase_date')
          .eq('status', 'APPROVED')
          .eq('transaction_type', 'Depositado')
          .gte('firebase_date', ini)
          .lte('firebase_date', fin),
        supabase
          .from('transactions')
          .select('ahorros_id, amount, firebase_date')
          .eq('status', 'APPROVED')
          .eq('transaction_type', 'Withdrawal')
          .gte('firebase_date', ini)
          .lte('firebase_date', fin),
        supabase
          .from('ahorros')
          .select('id, ahorros_doc_pdf1')
          .eq('savings_type', SAVINGS_TYPE)
          .not('ahorros_doc_pdf1', 'is', null)
          .neq('ahorros_doc_pdf1', ''),
      ]);

      const error = ahorrosActivosRes.error || depositosRes.error || retirosRes.error || ahorrosTodosRes.error;
      if (error) throw error;

      const ahorrosActivos = ahorrosActivosRes.data ?? [];
      const validAhorrosIds = new Set(ahorrosActivos.map(a => a.id));

      const totalAhorradoReal = (depositosRes.data ?? []).reduce((total, tx) => {
        if (!tx.ahorros_id || !validAhorrosIds.has(tx.ahorros_id)) return total;
        return total + (Number(tx.amount) || 0);
      }, 0);

      const totalRetiradoReal = (retirosRes.data ?? []).reduce((total, tx) => {
        if (!tx.ahorros_id || !validAhorrosIds.has(tx.ahorros_id)) return total;
        return total + (Number(tx.amount) || 0);
      }, 0);

      const totalUsuarios = (ahorrosTodosRes.data ?? []).length;
      const usuariosActivos = ahorrosActivos.length;

      // Beneficios: la única fuente disponible es el cálculo sobre depósitos (2026).
      const beneficiosPorId = activeYear === '2026'
        ? await calcularBeneficiosDinamicos2026(ahorrosActivos.map(a => a.id))
        : {};
      const beneficiosAcumuladosReal = Object.values(beneficiosPorId)
        .reduce((total, valor) => total + valor, 0);

      const totalRetiradoParaCalculo = activeYear === '2026' ? 0 : totalRetiradoReal;
      const totalSaldoActualCalculado = totalAhorradoReal + beneficiosAcumuladosReal - totalRetiradoParaCalculo;

      setStatsData({
        totalUsuarios,
        usuariosActivos,
        totalSaldoActual: totalSaldoActualCalculado,
        totalAhorrado: totalAhorradoReal,
        totalRetirado: totalRetiradoParaCalculo,
        beneficiosAcumulados: beneficiosAcumuladosReal
      });

    } catch (error) {
      console.error("❌ Error cargando datos reales");
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatosReales();
  }, [activeYear]);

  // Recargar tabla cuando cambie el año
  useEffect(() => {
    cargarTablaData();
  }, [activeYear]);

  // Filtrar tabla por nombre automáticamente
  useEffect(() => {
    if (!tablaDataCompleta.length) return;

    if (!filtroNombre.trim()) {
      setTablaData(tablaDataCompleta);
    } else {
      const datosFiltrados = tablaDataCompleta.filter(item =>
        item.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
      );
      setTablaData(datosFiltrados);
    }
  }, [filtroNombre, tablaDataCompleta]);

  // Exclusión puntual: Karen Alejandra - transacción del 12/1/2026
  const debeExcluirTransaccion2026 = (amount: number, fechaTransaccion: any): boolean => {
    const fecha = parseFecha(fechaTransaccion);
    if (!fechaTransaccion) return false;

    const fechaExcluir = new Date('2026-01-12T00:00:00.000Z');
    const montoExcluir = 10906529;

    const fechaCoincide = fechaTransaccion.toISOString().split('T')[0] === fechaExcluir.toISOString().split('T')[0];
    const montoCoincide = Math.abs(amount - montoExcluir) < 1;

    return fechaCoincide && montoCoincide;
  };

  // Función optimizada para calcular ahorrado por chunks CON FILTRO DE FECHA
  const calcularAhorradoPorChunks = async (
    ahorrosIds: string[],
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<{ [key: string]: number }> => {
    const totalesPorId: { [key: string]: number } = {};
    ahorrosIds.forEach(id => { totalesPorId[id] = 0; });
    if (ahorrosIds.length === 0) return totalesPorId;

    const ini = fechaInicio.toISOString();
    const fin = fechaFin.toISOString();

    for (const chunk of dividirEnChunks(ahorrosIds)) {
      const { data, error } = await supabase
        .from('transactions')
        .select('ahorros_id, amount, firebase_date')
        .in('ahorros_id', chunk)
        .eq('transaction_type', 'Depositado')
        .eq('status', 'APPROVED')
        .gte('firebase_date', ini)
        .lte('firebase_date', fin);

      if (error) {
        console.warn("Error calculando ahorrado por chunk");
        continue;
      }

      (data ?? []).forEach(tx => {
        const amount = Number(tx.amount);
        if (!tx.ahorros_id || !Number.isFinite(amount)) return;

        if (fechaInicio >= new Date('2026-01-01T00:00:00.000Z')
          && debeExcluirTransaccion2026(amount, tx.firebase_date)) {
          return;
        }

        totalesPorId[tx.ahorros_id] = (totalesPorId[tx.ahorros_id] ?? 0) + amount;
      });
    }

    return totalesPorId;
  };

  // Beneficios dinámicos para 2026 (EA 9%, sobre los depósitos del año)
  const calcularBeneficiosDinamicos2026 = async (ahorrosIds: string[]): Promise<{ [key: string]: number }> => {
    const beneficiosPorId: { [key: string]: number } = {};
    ahorrosIds.forEach(id => { beneficiosPorId[id] = 0; });
    if (ahorrosIds.length === 0) return beneficiosPorId;

    const EA = 0.09;
    const dailyInterestRate = Math.pow(1 + EA, 1 / 365) - 1;
    const fechaActual = new Date();
    const inicio = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const fin = new Date('2026-12-31T23:59:59.999Z').toISOString();

    const depositosPorAhorro: { [key: string]: Array<{ fecha: Date; monto: number }> } = {};
    ahorrosIds.forEach(id => { depositosPorAhorro[id] = []; });

    for (const chunk of dividirEnChunks(ahorrosIds)) {
      const { data, error } = await supabase
        .from('transactions')
        .select('ahorros_id, amount, firebase_date')
        .in('ahorros_id', chunk)
        .eq('transaction_type', 'Depositado')
        .eq('status', 'APPROVED')
        .gte('firebase_date', inicio)
        .lte('firebase_date', fin);

      if (error) {
        console.warn("Error consultando depósitos 2026 por chunk");
        continue;
      }

      (data ?? []).forEach(tx => {
        const amount = Number(tx.amount);
        const fechaDeposito = parseFecha(tx.firebase_date);
        if (!tx.ahorros_id || !Number.isFinite(amount) || !fechaDeposito) return;
        if (!depositosPorAhorro[tx.ahorros_id]) return;
        if (debeExcluirTransaccion2026(amount, tx.firebase_date)) return;

        depositosPorAhorro[tx.ahorros_id].push({ fecha: fechaDeposito, monto: amount });
      });
    }

    Object.entries(depositosPorAhorro).forEach(([ahorroId, depositos]) => {
      if (depositos.length === 0) return;

      depositos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

      let beneficioTotalAhorro = 0;
      let balanceAcumulado = 0;

      for (let i = 0; i < depositos.length; i++) {
        const depositoActual = depositos[i];
        balanceAcumulado += depositoActual.monto;

        // Los beneficios empiezan al día siguiente del depósito
        const fechaInicioBeneficios = new Date(depositoActual.fecha);
        fechaInicioBeneficios.setDate(fechaInicioBeneficios.getDate() + 1);

        let fechaFinPeriodo = i < depositos.length - 1
          ? new Date(depositos[i + 1].fecha)
          : new Date(fechaActual);

        if (fechaInicioBeneficios > fechaActual) continue;
        if (fechaFinPeriodo > fechaActual) fechaFinPeriodo = new Date(fechaActual);

        const diasPeriodo = Math.floor(
          (fechaFinPeriodo.getTime() - fechaInicioBeneficios.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

        if (diasPeriodo <= 0) continue;

        let beneficioPeriodo = 0;
        let balanceDiario = balanceAcumulado;

        for (let dia = 0; dia < diasPeriodo; dia++) {
          const beneficioDiario = balanceDiario * dailyInterestRate;
          const taxedBenefit = beneficioDiario > 2738.9450
            ? beneficioDiario * 0.93 // 7% impuesto
            : beneficioDiario;

          beneficioPeriodo += taxedBenefit;
          balanceDiario += taxedBenefit;
        }

        beneficioTotalAhorro += beneficioPeriodo;
      }

      beneficiosPorId[ahorroId] = beneficioTotalAhorro;
    });

    return beneficiosPorId;
  };

  const calcularRetiradoPorChunks = async (
    ahorrosIds: string[],
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<{ [key: string]: number }> => {
    const totalesPorId: { [key: string]: number } = {};
    ahorrosIds.forEach(id => { totalesPorId[id] = 0; });
    if (ahorrosIds.length === 0) return totalesPorId;

    const ini = fechaInicio.toISOString();
    const fin = fechaFin.toISOString();

    for (const chunk of dividirEnChunks(ahorrosIds)) {
      const { data, error } = await supabase
        .from('transactions')
        .select('ahorros_id, amount')
        .in('ahorros_id', chunk)
        .eq('transaction_type', 'Withdrawal')
        .in('status', ['APPROVED', 'PENDING'])
        .gte('firebase_date', ini)
        .lte('firebase_date', fin);

      if (error) {
        console.warn("Error calculando retirado por chunk");
        continue;
      }

      (data ?? []).forEach(tx => {
        const amount = Number(tx.amount);
        if (!tx.ahorros_id || !Number.isFinite(amount)) return;
        totalesPorId[tx.ahorros_id] = (totalesPorId[tx.ahorros_id] ?? 0) + amount;
      });
    }

    return totalesPorId;
  };

  // Función para cargar datos de la tabla
  const cargarTablaData = async () => {
    try {
      setLoadingTabla(true);

      // 1. Ahorros filtrados: línea "Los Mejores", documento firmado y monto mínimo
      const { data: ahorrosData, error: ahorrosError } = await supabase
        .from('ahorros')
        .select('id, user_ref, user_name, monto_total, savings_type, ahorros_doc_pdf1, fechacreacion')
        .eq('savings_type', SAVINGS_TYPE)
        .not('ahorros_doc_pdf1', 'is', null)
        .neq('ahorros_doc_pdf1', '')
        .gte('monto_total', MONTO_MINIMO)
        .order('fechacreacion', { ascending: false });

      if (ahorrosError) throw ahorrosError;

      const ahorrosValidos = (ahorrosData ?? []) as AhorroRow[];

      if (ahorrosValidos.length === 0) {
        setTablaData([]);
        setTablaDataCompleta([]);
        return;
      }

      const { fechaInicio, fechaFin } = obtenerRangoFechas();
      const ahorrosIds = ahorrosValidos.map(a => a.id);

      // 2. Ahorrado y retirado por ahorro
      const [totalesAhorrado, totalesRetirado] = await Promise.all([
        calcularAhorradoPorChunks(ahorrosIds, fechaInicio, fechaFin),
        calcularRetiradoPorChunks(ahorrosIds, fechaInicio, fechaFin)
      ]);

      // 3. Beneficios: solo 2026 tiene fuente de datos (cálculo EA 9%).
      // Para otros años no existe columna/tabla de beneficios en Supabase.
      const beneficiosTabla = activeYear === '2026'
        ? await calcularBeneficiosDinamicos2026(ahorrosIds)
        : Object.fromEntries(ahorrosIds.map(id => [id, 0]));

      // 4. Datos de usuario en una sola consulta por chunks
      const userIds = [...new Set(
        ahorrosValidos.map(a => a.user_ref).filter((id): id is string => Boolean(id))
      )];
      const usersById = new Map<string, any>();

      for (const chunk of dividirEnChunks(userIds)) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, nit, nro_documento, phone_number')
          .in('id', chunk);
        if (error) {
          console.warn("Error consultando usuarios");
          continue;
        }
        (data ?? []).forEach(user => usersById.set(user.id, user));
      }

      // 6. Construir filas
      const tablaResultados: AhorroTableData[] = ahorrosValidos.map(ahorro => {
        const user = ahorro.user_ref ? usersById.get(ahorro.user_ref) : undefined;

        let saldoActual: number;
        if (activeYear === '2026') {
          saldoActual = (totalesAhorrado[ahorro.id] ?? 0) + (beneficiosTabla[ahorro.id] ?? 0);
        } else {
          saldoActual = Number(ahorro.monto_total) || 0;
        }

        return {
          id: ahorro.id,
          documento: user?.nit || user?.nro_documento || ahorro.user_ref || 'N/A',
          telefono: user?.phone_number || 'N/A',
          nombre: ahorro.user_name || 'Usuario desconocido',
          saldoActual,
          ahorrado: totalesAhorrado[ahorro.id] ?? 0,
          retirado: totalesRetirado[ahorro.id] ?? 0,
          beneficios: beneficiosTabla[ahorro.id] ?? 0
        };
      });

      // 7. Filtrar por actividad en el rango
      const idsConActividad = new Set<string>();
      tablaResultados.forEach(item => {
        if (activeYear === '2026') {
          if (item.ahorrado > 0) idsConActividad.add(item.id);
        } else if (item.ahorrado > 0 || item.retirado > 0) {
          idsConActividad.add(item.id);
        }
      });

      const tablaOrdenada = tablaResultados.filter(item => idsConActividad.has(item.id));

      setTablaDataCompleta(tablaOrdenada);
      setTablaData(tablaOrdenada);

      // 8. Para 2026 las tarjetas se recalculan desde la tabla
      if (activeYear === '2026') {
        const totalSaldoActualTabla = tablaOrdenada.reduce((total, usuario) => total + (usuario.saldoActual || 0), 0);
        const totalAhorradoTabla = tablaOrdenada.reduce((total, usuario) => total + (usuario.ahorrado || 0), 0);
        const beneficiosTablaTotal = tablaOrdenada.reduce((total, usuario) => total + (usuario.beneficios || 0), 0);

        setStatsData(prevStats => ({
          ...prevStats,
          totalSaldoActual: totalSaldoActualTabla,
          totalAhorrado: totalAhorradoTabla,
          totalRetirado: 0,
          beneficiosAcumulados: beneficiosTablaTotal
        }));
      }

    } catch (error) {
      console.error("❌ Error cargando datos de tabla");
      setTablaData([]);
      setTablaDataCompleta([]);
    } finally {
      setLoadingTabla(false);
    }
  };

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    const valor = Number(amount);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number.isFinite(valor) ? valor : 0);
  };

  const handleViewUser = (user: AhorroTableData) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  return (
    <MainLayout sidebarType="fondos" pageTitle="Fondos independientes">

      <div className="bg-card rounded-2xl p-6">
        {/* Fund Info */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Fondos los mejores</h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-3xl font-bold text-muted-foreground/40">F</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Fondo</span>
                <span className="text-sm text-muted-foreground/60">los mejores</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard 
              value={loading ? "..." : statsData.totalUsuarios.toString()} 
              label="Total Usuarios" 
            />
            <StatCard 
              value={loading ? "..." : statsData.usuariosActivos.toString()} 
              label="Usuarios activos" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.totalSaldoActual)} 
              label="Total saldo actual" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.totalAhorrado)} 
              label="Total ahorrado" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.totalRetirado)} 
              label="Total retirado" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.beneficiosAcumulados)} 
              label="Beneficios acumulados" 
              highlight 
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
          {/* Year toggle */}
          <div className="inline-flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveYear("2025")}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                activeYear === "2025" 
                  ? "bg-card text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              2025
            </button>
            <button
              onClick={() => setActiveYear("2026")}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                activeYear === "2026" 
                  ? "bg-card text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              2026
            </button>
          </div>

          <div className="flex gap-3 items-center w-full md:w-auto">
            <Input
              placeholder="Escribe el nombre y/o apellido"
              className="max-w-sm bg-card border-border"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
            />
            <button
              onClick={() => setFiltroNombre("")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8 py-2.5 rounded-xl transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium py-4">Número de documento</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Teléfono</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Nombres y Apellidos</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Saldo actual</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Ahorrado</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Retirado</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Beneficios</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4 text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTabla ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="ml-2">Cargando datos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : tablaData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron datos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                tablaData.map((row) => (
                  <TableRow key={row.id} className="border-b border-border/50 hover:bg-muted/10">
                    <TableCell className="text-foreground py-4">{row.documento}</TableCell>
                    <TableCell className="text-foreground py-4">{row.telefono}</TableCell>
                    <TableCell className="text-foreground py-4">{row.nombre}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.saldoActual)}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.ahorrado)}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.retirado)}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.beneficios)}</TableCell>
                    <TableCell className="text-center py-4">
                      <button 
                        onClick={() => handleViewUser(row)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <UserDetailModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        user={selectedUser}
      />
    </MainLayout>
  );
}
