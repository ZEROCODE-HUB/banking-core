import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Eye, Loader2 } from "lucide-react";
import { CDATDetailModal } from "./CDATDetailModal";
import { obtenerColeccion } from "@/supabase/database";
import { supabase } from "@/supabase/config";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Convierte cualquier fecha (ISO string, Date, Timestamp serializado) en Date
const parseDate = (value: any): Date | null => {
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
    const fecha = new Date(value.seconds * 1000);
    return isNaN(fecha.getTime()) ? null : fecha;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const fecha = new Date(value);
    return isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
};

// Función para formatear fecha
const formatearFecha = (value: any) => {
  const fecha = parseDate(value);
  if (!fecha) return 'Sin fecha';
  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Función para formatear moneda
const formatearMoneda = (monto: number) => {
  const valor = Number(monto);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number.isFinite(valor) ? valor : 0);
};

// Función para capitalizar primera letra
const capitalizeFirst = (str?: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Formato compacto para el eje Y de la gráfica
const formatAxisValue = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
};

type StatusFilter = "Todos" | "Activo" | "Finalizado" | "Pendiente de firma" | "Eliminado";
type SearchType = "todos" | "nombre" | "documento" | "id";
type Granularidad = "meses" | "años";

interface CdatRow {
  id: string;
  idCdat: number | null;
  nombreusuario: string;
  documentousuario: string;
  inversion: number;
  ganancias: number;
  rendimiento: number;
  ea: number;
  tiempo: number;
  estado: string;
  fechaApertura: any;
  fechaFinalizacion: any;
  firmado: boolean;
  retefuenteMonto: number;
  retefuentePorcentaje: number;
  tipooperacion: string;
  origenrecursos: string;
  saldoDisponible: number;
  archivos: string[];
  comprobantes: string[];
  observaciones: string;
}

// Fila cruda de Supabase (snake_case) -> modelo de la vista
const mapCdat = (row: any): CdatRow => ({
  id: row.id,
  idCdat: row.id_cdat ?? null,
  nombreusuario: row.nombreusuario || '',
  documentousuario: row.documentousuario || '',
  inversion: Number(row.inversion) || 0,
  ganancias: Number(row.ganancias) || 0,
  rendimiento: Number(row.rendimiento) || 0,
  ea: Number(row.ea) || 0,
  tiempo: Number(row.tiempo) || 0,
  estado: row.estado || '',
  fechaApertura: row.fecha_apertura ?? null,
  fechaFinalizacion: row.fecha_finalizacion ?? null,
  firmado: row.firmado === true,
  retefuenteMonto: Number(row.retefuente_monto) || 0,
  retefuentePorcentaje: Number(row.retefuenteporcentaje) || 0,
  tipooperacion: row.tipooperacion || '',
  origenrecursos: row.origenrecursos || '',
  saldoDisponible: Number(row.saldo_disponible) || 0,
  archivos: Array.isArray(row.archivos) ? row.archivos : [],
  comprobantes: Array.isArray(row.comprobantes) ? row.comprobantes : [],
  observaciones: row.observaciones || '',
});

// `CDATDetailModal` sigue esperando los nombres camelCase del modelo anterior
const toModalCdat = (cdat: CdatRow | null) => cdat ? {
  id: cdat.id,
  nombreusuario: cdat.nombreusuario,
  firmado: cdat.firmado,
  Inversion: cdat.inversion,
  Ganancias: cdat.ganancias,
  Rendimiento: cdat.rendimiento,
  FechaApertura: cdat.fechaApertura,
  FechaFinalizacion: cdat.fechaFinalizacion,
  Tiempo: cdat.tiempo,
  RetefuenteMonto: cdat.retefuenteMonto,
  Retefuenteporcentaje: cdat.retefuentePorcentaje || undefined,
  EA: cdat.ea,
  Tipooperacion: cdat.tipooperacion,
  origenrecursos: cdat.origenrecursos,
  saldoDisponible: cdat.saldoDisponible,
  Archivos: cdat.archivos,
  comprobantes: cdat.comprobantes,
  observaciones: cdat.observaciones,
} : undefined;

// Serie mensual/anual: inversión aperturada vs. anticipos (retiros) solicitados
const buildChartData = (
  cdats: CdatRow[],
  retiros: any[],
  granularidad: Granularidad,
) => {
  const hoy = new Date();
  const buckets: Array<{ key: string; month: string; aperturados: number; anticipos: number }> = [];

  if (granularidad === 'años') {
    for (let i = 4; i >= 0; i--) {
      const year = hoy.getFullYear() - i;
      buckets.push({ key: String(year), month: String(year), aperturados: 0, anticipos: 0 });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      buckets.push({
        key: `${fecha.getFullYear()}-${fecha.getMonth()}`,
        month: `${MONTHS_SHORT[fecha.getMonth()]} ${String(fecha.getFullYear()).slice(2)}`,
        aperturados: 0,
        anticipos: 0,
      });
    }
  }

  const porKey = new Map(buckets.map(b => [b.key, b]));

  const keyDe = (value: any) => {
    const fecha = parseDate(value);
    if (!fecha) return null;
    return granularidad === 'años'
      ? String(fecha.getFullYear())
      : `${fecha.getFullYear()}-${fecha.getMonth()}`;
  };

  cdats.forEach(cdat => {
    const bucket = porKey.get(keyDe(cdat.fechaApertura) ?? '');
    if (bucket) bucket.aperturados += cdat.inversion;
  });

  retiros.forEach(retiro => {
    const bucket = porKey.get(
      keyDe(retiro.fecha_solicitud ?? retiro.fecharetiro ?? retiro.created_at) ?? '',
    );
    if (bucket) bucket.anticipos += Number(retiro.monto) || 0;
  });

  return buckets;
};

export function EstadoGeneralCDATSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Activo");
  const [searchType, setSearchType] = useState<SearchType>("todos");
  const [granularidad, setGranularidad] = useState<Granularidad>("meses");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [cdatsData, setCdatsData] = useState<CdatRow[]>([]);
  const [retirosData, setRetirosData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCDAT, setSelectedCDAT] = useState<CdatRow | null>(null);

  // Cargar CDATs y retiros (para la serie de anticipos)
  const cargarDatos = async () => {
    try {
      setIsLoading(true);

      const [cdats, retirosResult] = await Promise.all([
        obtenerColeccion('Cdats'),
        supabase
          .from('confirmacionretiros')
          .select('monto, fecha_solicitud, fecharetiro, created_at'),
      ]);

      setCdatsData((cdats as any[]).map(mapCdat));

      if (retirosResult.error) {
        console.warn('No se pudieron cargar los retiros para la gráfica:', retirosResult.error);
        setRetirosData([]);
      } else {
        setRetirosData(retirosResult.data ?? []);
      }
    } catch (error) {
      console.error('Error cargando CDATs:', error);
      toast({
        title: "Error",
        description: "Error al cargar los CDATs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrar CDATs basado en búsqueda y estado
  const filteredCDATs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return cdatsData.filter(cdat => {
      const coincideBusqueda = !term || (
        searchType === 'nombre'
          ? cdat.nombreusuario.toLowerCase().includes(term)
          : searchType === 'documento'
            ? String(cdat.documentousuario).toLowerCase().includes(term)
            : searchType === 'id'
              ? String(cdat.idCdat ?? '').includes(term)
              : cdat.nombreusuario.toLowerCase().includes(term) ||
                String(cdat.documentousuario).toLowerCase().includes(term) ||
                String(cdat.idCdat ?? '').includes(term)
      );

      const coincideEstado = statusFilter === "Todos" ||
        cdat.estado.toLowerCase() === statusFilter.toLowerCase();

      return coincideBusqueda && coincideEstado;
    });
  }, [cdatsData, searchTerm, searchType, statusFilter]);

  // Ordenar por fecha más reciente primero
  const sortedCDATs = useMemo(() => {
    return [...filteredCDATs].sort((a, b) => {
      const fechaA = parseDate(a.fechaApertura)?.getTime() ?? 0;
      const fechaB = parseDate(b.fechaApertura)?.getTime() ?? 0;
      return fechaB - fechaA;
    });
  }, [filteredCDATs]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedCDATs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCDATs = sortedCDATs.slice(startIndex, startIndex + itemsPerPage);

  const visiblePages = useMemo(() => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  // Reset página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchType, statusFilter]);

  // Evitar quedar en una página que ya no existe
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Contar por estado (case insensitive)
  const countByEstado = (estado: string) =>
    cdatsData.filter(d => d.estado.toLowerCase() === estado.toLowerCase()).length;

  const activoCount = countByEstado("Activo");
  const finalizadoCount = countByEstado("Finalizado");
  const eliminadoCount = countByEstado("Eliminado");
  const pendienteFirmaCount = countByEstado("Pendiente de firma");

  const chartData = useMemo(
    () => buildChartData(cdatsData, retirosData, granularidad),
    [cdatsData, retirosData, granularidad],
  );
  const hasChartData = chartData.some(d => d.aperturados > 0 || d.anticipos > 0);

  const getStatusColor = (estado?: string) => {
    const estadoLower = (estado || '').toLowerCase();
    switch (estadoLower) {
      case "activo":
        return "bg-green-100 text-green-600";
      case "finalizado":
        return "bg-gray-100 text-gray-600";
      case "eliminado":
        return "bg-red-100 text-red-600";
      case "pendiente de firma":
        return "bg-orange-100 text-orange-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const handleView = (cdat: CdatRow) => {
    setSelectedCDAT(cdat);
    setShowDetailModal(true);
  };

  const limpiarBusqueda = () => {
    setSearchTerm('');
    setSearchType('todos');
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-end gap-4 mb-6">
        <div className="flex-1 max-w-[280px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Buscar por</Label>
          <Select value={searchType} onValueChange={(value) => setSearchType(value as SearchType)}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="nombre">Nombre</SelectItem>
              <SelectItem value="documento">Documento</SelectItem>
              <SelectItem value="id">ID</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-[320px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Buscar CDATs</Label>
          <Input 
            placeholder="Buscar por nombre, documento o ID" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card border-border"
          />
        </div>

        <Button 
          onClick={limpiarBusqueda}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-12"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cargando...
            </>
          ) : (
            'Limpiar'
          )}
        </Button>
      </div>

      {/* Chart Section */}
      <div className="bg-card rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">CDAT</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-sidebar"></div>
              <span className="text-sm text-muted-foreground">Aperturados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-muted-foreground">Anticipos</span>
            </div>
            <Select
              value={granularidad}
              onValueChange={(value) => setGranularidad(value as Granularidad)}
            >
              <SelectTrigger className="w-[120px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meses">Meses</SelectItem>
                <SelectItem value="años">Años</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="h-[300px]">
          {hasChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={formatAxisValue}
                />
                <Bar dataKey="aperturados" fill="hsl(var(--sidebar-background))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="anticipos" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {isLoading ? 'Cargando información...' : 'Sin datos para graficar'}
            </div>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Estado general</h2>
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setStatusFilter("Todos")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                statusFilter === "Todos" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos ({cdatsData.length})
            </button>
            <button
              onClick={() => setStatusFilter("Activo")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                statusFilter === "Activo" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Activos ({activoCount})
            </button>
            <button
              onClick={() => setStatusFilter("Pendiente de firma")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                statusFilter === "Pendiente de firma" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pendientes de firma ({pendienteFirmaCount})
            </button>
            <button
              onClick={() => setStatusFilter("Finalizado")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                statusFilter === "Finalizado" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Finalizados ({finalizadoCount})
            </button>
            <button
              onClick={() => setStatusFilter("Eliminado")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                statusFilter === "Eliminado" 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Eliminados ({eliminadoCount})
            </button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">ID</TableHead>
              <TableHead className="text-muted-foreground font-medium">Nombres y Apellidos</TableHead>
              <TableHead className="text-muted-foreground font-medium">Número de documento</TableHead>
              <TableHead className="text-muted-foreground font-medium">Inversión</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha de inicio</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha de finalización</TableHead>
              <TableHead className="text-muted-foreground font-medium">Tiempo</TableHead>
              <TableHead className="text-muted-foreground font-medium">%</TableHead>
              <TableHead className="text-muted-foreground font-medium">Estado</TableHead>
              <TableHead className="text-muted-foreground font-medium">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index} className="border-b border-border">
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                </TableRow>
              ))
            ) : sortedCDATs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {searchTerm || statusFilter !== "Todos" 
                    ? "No se encontraron CDATs que coincidan con los criterios de búsqueda"
                    : "No hay CDATs registrados"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedCDATs.map((cdat, index) => (
                <TableRow key={cdat.id || index} className="border-b border-border">
                  <TableCell className="text-foreground">{cdat.idCdat ?? '-'}</TableCell>
                  <TableCell className="text-foreground">{cdat.nombreusuario || '-'}</TableCell>
                  <TableCell className="text-foreground">{cdat.documentousuario || '-'}</TableCell>
                  <TableCell className="text-foreground">{formatearMoneda(cdat.inversion)}</TableCell>
                  <TableCell className="text-foreground">{formatearFecha(cdat.fechaApertura)}</TableCell>
                  <TableCell className="text-foreground">{formatearFecha(cdat.fechaFinalizacion)}</TableCell>
                  <TableCell className="text-foreground">{cdat.tiempo ? `${cdat.tiempo} meses` : '-'}</TableCell>
                  <TableCell className="text-foreground">{cdat.ea ? `${cdat.ea}%` : '-'}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      getStatusColor(cdat.estado)
                    )}>
                      {capitalizeFirst(cdat.estado) || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button 
                      onClick={() => handleView(cdat)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Ver detalles"
                    >
                      <Eye size={18} className="text-muted-foreground" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({sortedCDATs.length} CDATs)
          </span>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm">&lt;</span>
            </button>
            
            {visiblePages.map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium",
                  currentPage === page 
                    ? "bg-primary text-primary-foreground" 
                    : "border border-border hover:bg-muted"
                )}
              >
                {page}
              </button>
            ))}
            
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm">&gt;</span>
            </button>
          </div>
        </div>
      </div>

      {/* CDAT Detail Modal */}
      <CDATDetailModal 
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        cdat={toModalCdat(selectedCDAT)}
      />
    </div>
  );
}
