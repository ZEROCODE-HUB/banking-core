import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Eye, X, Calendar, Clock, DollarSign, FileText, Loader2 } from "lucide-react";
import { CDATDetailModal } from "./CDATDetailModal";
import { obtenerColeccion } from "@/supabase/database";
import { Timestamp } from "firebase/firestore";
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';

// Mock chart data
const chartData = [
  { month: 'Enero', aperturados: 13000, anticipos: 14000 },
  { month: 'Febrero', aperturados: 6000, anticipos: 5000 },
  { month: 'Marzo', aperturados: 15000, anticipos: 17000 },
  { month: 'Abril', aperturados: 16000, anticipos: 10000 },
  { month: 'Mayo', aperturados: 10000, anticipos: 4000 },
  { month: 'Junio', aperturados: 9000, anticipos: 8000 },
  { month: 'Julio', aperturados: 5000, anticipos: 17000 },
  { month: 'Agosto', aperturados: 15000, anticipos: 17000 },
  { month: 'Septiembre', aperturados: 4000, anticipos: 8000 },
  { month: 'Octubre', aperturados: 9000, anticipos: 8000 },
  { month: 'Noviembre', aperturados: 13000, anticipos: 14000 },
];

// Función para formatear fecha
const formatearFecha = (timestamp: any) => {
  try {
    let fecha;
    
    if (timestamp && typeof timestamp.toDate === 'function') {
      fecha = timestamp.toDate();
    } else if (timestamp && timestamp.seconds) {
      fecha = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      fecha = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      fecha = new Date(timestamp);
    } else {
      return 'Sin fecha';
    }
    
    if (isNaN(fecha.getTime())) {
      return 'Fecha inválida';
    }
    
    return fecha.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'Error fecha';
  }
};

// Función para formatear moneda
const formatearMoneda = (monto: number) => {
  if (!monto) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(monto);
};

// Función para capitalizar primera letra
const capitalizeFirst = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Mock table data
const mockEstadoGeneralData = [
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Activo" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Activo" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Activo" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Activo" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Activo" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Finalizado" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Finalizado" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Eliminado" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Eliminado" },
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000.00", fechaInicio: "12/01/2025", fechaFin: "12/01/2025", tiempo: "12 meses", porcentaje: "14.3%", estado: "Activo" },
];

type StatusFilter = "Todos" | "Activo" | "Finalizado" | "Eliminado";

export function EstadoGeneralCDATSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("Activo");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [cdatsData, setCdatsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCDAT, setSelectedCDAT] = useState<any>(null);

  // Cargar todos los CDATs desde Firebase
  const cargarCDATs = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Cargando CDATs...');
      
      const cdats = await obtenerColeccion('Cdats');
      console.log('📊 CDATs encontrados:', cdats.length);
      
      // Debug: Ver todos los estados únicos en los datos
      const estadosUnicos = [...new Set(cdats.map((c: any) => c.Estado))];
      console.log('🏷️ Estados únicos encontrados:', estadosUnicos);
      
      setCdatsData(cdats);
      
    } catch (error) {
      console.error('❌ Error cargando CDATs:', error);
      toast({
        title: "Error",
        description: "Error al cargar los CDATs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarCDATs();
  }, []);

  // Filtrar CDATs basado en búsqueda y estado
  const filteredCDATs = cdatsData.filter(cdat => {
    const matchesSearch = !searchTerm || 
      cdat.nombreusuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cdat.documentousuario?.includes(searchTerm) ||
      cdat.idCdat?.toString().includes(searchTerm);
    
    const matchesStatus = statusFilter === "Todos" || 
      cdat.Estado?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Ordenar por fecha más reciente primero
  const sortedCDATs = [...filteredCDATs].sort((a, b) => {
    const fechaA = a.FechaApertura?.seconds || a.FechaApertura?.getTime?.() || 0;
    const fechaB = b.FechaApertura?.seconds || b.FechaApertura?.getTime?.() || 0;
    return fechaB - fechaA; // Más reciente primero
  });

  // Paginación
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCDATs = sortedCDATs.slice(startIndex, startIndex + itemsPerPage);

  // Reset página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Contar por estado (case insensitive)
  const activoCount = cdatsData.filter(d => d.Estado?.toLowerCase() === "activo").length;
  const finalizadoCount = cdatsData.filter(d => d.Estado?.toLowerCase() === "finalizado").length;
  const eliminadoCount = cdatsData.filter(d => d.Estado?.toLowerCase() === "eliminado").length;
  const pendienteFirmaCount = cdatsData.filter(d => d.Estado?.toLowerCase() === "pendiente de firma").length;

  const getStatusColor = (estado: string) => {
    const estadoLower = estado.toLowerCase();
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

  const handleView = (cdat: any) => {
    setSelectedCDAT(cdat);
    setShowDetailModal(true);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-end gap-4 mb-6">
        <div className="flex-1 max-w-[280px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Tipo de búsqueda</Label>
          <Select defaultValue="identificacion">
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="identificacion">Identificación</SelectItem>
              <SelectItem value="cedula">Cédula de ciudadanía</SelectItem>
              <SelectItem value="pasaporte">Pasaporte</SelectItem>
              <SelectItem value="permanencia">Permiso de permanencia</SelectItem>
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
          onClick={() => setSearchTerm('')}
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
            <Select defaultValue="meses">
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
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Bar dataKey="aperturados" fill="hsl(var(--sidebar-background))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="anticipos" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
              Todos ({mockEstadoGeneralData.length})
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
                  <TableCell className="text-foreground">{cdat.idCdat}</TableCell>
                  <TableCell className="text-foreground">{cdat.nombreusuario || '-'}</TableCell>
                  <TableCell className="text-foreground">{cdat.documentousuario || '-'}</TableCell>
                  <TableCell className="text-foreground">{formatearMoneda(cdat.Inversion)}</TableCell>
                  <TableCell className="text-foreground">{formatearFecha(cdat.FechaApertura)}</TableCell>
                  <TableCell className="text-foreground">{formatearFecha(cdat.FechaFinalizacion)}</TableCell>
                  <TableCell className="text-foreground">{cdat.Tiempo || '-'}</TableCell>
                  <TableCell className="text-foreground">{cdat.EA ? `${cdat.EA}%` : '-'}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      getStatusColor(cdat.Estado)
                    )}>
                      {capitalizeFirst(cdat.Estado)}
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
        <div className="flex items-center justify-center mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm">&lt;</span>
            </button>
            
            {[1, 2, 3].map(page => (
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
            
            <span className="text-muted-foreground">...</span>
            
            <button
              onClick={() => setCurrentPage(16)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium border border-border hover:bg-muted"
            >
              16
            </button>
            
            <button 
              onClick={() => setCurrentPage(p => Math.min(16, p + 1))}
              disabled={currentPage === 16}
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
        cdat={selectedCDAT}
      />
    </div>
  );
}
