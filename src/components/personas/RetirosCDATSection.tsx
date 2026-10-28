import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Eye, Settings } from "lucide-react";
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
import { CambiarEstadoModal } from "@/components/personas/CambiarEstadoModal";
import { DetalleCompletadoModal } from "@/components/personas/DetalleCompletadoModal";

// Función para formatear moneda colombiana
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('COP', '$');
};

// Función para formatear fecha
const formatDate = (timestamp: any) => {
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
    
    if (!isNaN(fecha.getTime())) {
      return fecha.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
    return 'Fecha inválida';
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'Error fecha';
  }
};

// Función para calcular tiempo transcurrido
const calculateTimeElapsed = (createdDate: any) => {
  try {
    let fecha;
    
    if (createdDate && typeof createdDate.toDate === 'function') {
      fecha = createdDate.toDate();
    } else if (createdDate && createdDate.seconds) {
      fecha = new Date(createdDate.seconds * 1000);
    } else if (createdDate instanceof Date) {
      fecha = createdDate;
    } else if (typeof createdDate === 'string' || typeof createdDate === 'number') {
      fecha = new Date(createdDate);
    } else {
      return '-';
    }
    
    if (isNaN(fecha.getTime())) {
      return '-';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - fecha.getTime();
    
    if (diffMs < 0) {
      return 'Fecha futura';
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffDays > 0) {
      const totalHours = diffDays * 24 + diffHours;
      return `${totalHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${diffHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('Error calculando tiempo:', error);
    return '-';
  }
};

// Función para capitalizar la primera letra
const capitalizeFirst = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// ID visible del retiro: `id_field` es el consecutivo de negocio, `id` el uuid.
const getRetiroId = (retiro: any) => retiro?.id_field ?? retiro?.id ?? '';

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

export function RetirosCDATSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [retirosData, setRetirosData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [showCambiarEstadoModal, setShowCambiarEstadoModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);

  // Filtrar retiros basado en búsqueda y estado
  const filteredRetiros = retirosData.filter(retiro => {
    const matchesSearch = !searchTerm || 
      retiro.nombreusuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      retiro.emailusuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      retiro.celusuario?.includes(searchTerm) ||
      getRetiroId(retiro)?.toString().includes(searchTerm) ||
      retiro.idCDAT?.toString().includes(searchTerm);
    
    const matchesStatus = statusFilter === "Todos" || 
      capitalizeFirst(retiro.estados) === statusFilter;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const orden = { pendiente: 0, rechazado: 1, completado: 2 };
    return (orden[a.estados?.toLowerCase()] ?? 3) - (orden[b.estados?.toLowerCase()] ?? 3);
  });

  // Paginación
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRetiros = filteredRetiros.slice(startIndex, startIndex + itemsPerPage);

  // Reset página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Cargar todos los retiros de `confirmacionretiros`, agrupados por CDAT
  const cargarRetiros = async () => {
    try {
      setIsLoading(true);

      // Primero obtener todos los CDATs
      const cdats = await obtenerColeccion('Cdats');

      // Cargar retiros de todos los CDATs EN PARALELO
      const promesasRetiros = (cdats as any[]).map(async (cdat) => {
        const idCdat = cdat.id_cdat;
        if (idCdat === null || idCdat === undefined) return [];

        const { data, error } = await supabase
          .from('confirmacionretiros')
          .select('*')
          .eq('id_cdat', idCdat);

        if (error) {
          console.warn(`Error cargando retiros del CDAT ${cdat.id}:`, error);
          return [];
        }

        // Filtrar solo los de tipo "retiro"
        return (data ?? [])
          .filter((retiro: any) => retiro.tipodeoperacion === 'retiro')
          .map((retiro: any) => ({
            ...retiro,
            idCDAT: idCdat,
            cdatInfo: {
              id: cdat.id,
              idCdat,
              nombreusuario: cdat.nombreusuario
            }
          }));
      });

      // Esperar todas las consultas y aplanar el resultado
      const resultados = await Promise.all(promesasRetiros);
      const todosLosRetiros = resultados.flat();

      setRetirosData(todosLosRetiros);
      
    } catch (error) {
      console.error('❌ Error cargando retiros:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los retiros",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarRetiros();
  }, []);

  // Count by status usando filteredRetiros
  const pendienteCount = retirosData.filter(d => d.estados === "pendiente").length;
  const rechazadoCount = retirosData.filter(d => d.estados === "rechazado").length;
  const completadoCount = retirosData.filter(d => d.estados === "completado").length;

  const getStatusColor = (estado: string) => {
    const estadoLower = estado.toLowerCase();
    switch (estadoLower) {
      case "pendiente":
        return "bg-orange-100 text-orange-600";
      case "rechazado":
        return "bg-red-100 text-red-600";
      case "completado":
        return "bg-green-100 text-green-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Modal handlers
  const handleOpenCambiarEstado = (retiro: any) => {
    setSelectedSolicitud({
      id: String(getRetiroId(retiro)),
      docId: retiro.id,
      subcoleccionPath: `Cdats/${retiro.cdatInfo?.id}/confirmacionretiros`,
      cdatId: retiro.cdatInfo?.id,
      montoRaw: retiro.monto,
      nombre: retiro.nombreusuario,
      documento: retiro.nitusuario || 'N/A',
      telefono: retiro.celusuario || 'N/A',
      email: retiro.emailusuario || 'N/A',
      banco: retiro.numbredebanco,
      numeroCuenta: retiro.cuentanumero || 'N/A',
      tipoCuenta: retiro.tipodecuenta || 'N/A',
      producto: 'CDAT',
      transaccionId: String(getRetiroId(retiro)),
      fechaSolicitud: formatDate(retiro.fecha_solicitud),
      monto: formatearMoneda(retiro.monto),
      estado: capitalizeFirst(retiro.estados),
    });
    setShowCambiarEstadoModal(true);
  };

  const handleOpenDetalle = (retiro: any) => {
    setSelectedSolicitud({
      id: String(getRetiroId(retiro)),
      nombre: retiro.nombreusuario,
      documento: retiro.nitusuario || 'N/A',
      telefono: retiro.celusuario || 'N/A',
      email: retiro.emailusuario || 'N/A',
      banco: retiro.numbredebanco,
      numeroCuenta: retiro.cuentanumero || 'N/A',
      tipoCuenta: retiro.tipodecuenta || 'N/A',
      producto: 'CDAT',
      transaccionId: String(getRetiroId(retiro)),
      fechaSolicitud: formatDate(retiro.fecha_solicitud),
      monto: formatearMoneda(retiro.monto),
      estado: capitalizeFirst(retiro.estados),
      canalPago: retiro.chanelpay || 'N/A',
      fechaPago: formatDate(retiro.fecharetiro),
      observaciones: retiro.observaciones || 'Sin observaciones registradas'
    });
    setShowDetalleModal(true);
  };

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Pendiente de retiro</p>
          <p className="text-4xl font-bold text-foreground">{isLoading ? '-' : pendienteCount}</p>
        </div>
        <div className="bg-card rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Rechazado</p>
          <p className="text-4xl font-bold text-foreground">{isLoading ? '-' : rechazadoCount}</p>
        </div>
        <div className="bg-card rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Completado</p>
          <p className="text-4xl font-bold text-foreground">{isLoading ? '-' : completadoCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 mb-6">
        <div className="flex-1 max-w-[280px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Tipo de documento</Label>
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
          <Label className="text-sm text-foreground font-normal">Buscar retiros</Label>
          <Input 
            placeholder="Buscar por nombre, email, cédula o ID" 
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

      {/* Table */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Retiros</h2>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-background border-border">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
                <SelectItem value="Completado">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">ID</TableHead>
              <TableHead className="text-muted-foreground font-medium">Nombres y Apellidos</TableHead>
              <TableHead className="text-muted-foreground font-medium">Producto</TableHead>
              <TableHead className="text-muted-foreground font-medium">Monto</TableHead>
              <TableHead className="text-muted-foreground font-medium">Entidad bancaria</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha de solicitud</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha de retiro</TableHead>
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
                </TableRow>
              ))
            ) : filteredRetiros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {searchTerm || statusFilter !== "Todos" 
                    ? "No se encontraron retiros que coincidan con los criterios de búsqueda"
                    : "No hay retiros registrados"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRetiros.map((retiro, index) => (
                <TableRow key={retiro.id || index} className="border-b border-border">
                  <TableCell className="text-foreground">{getRetiroId(retiro)}</TableCell>
                  <TableCell className="text-foreground">{retiro.nombreusuario || '-'}</TableCell>
                  <TableCell className="text-foreground">CDAT {retiro.idCDAT}</TableCell>
                  <TableCell className="text-foreground">{formatearMoneda(retiro.monto)}</TableCell>
                  <TableCell className="text-foreground">{retiro.numbredebanco || '-'}</TableCell>
                  <TableCell className="text-foreground">{formatDate(retiro.fecha_solicitud)}</TableCell>
                  <TableCell className="text-foreground">{formatDate(retiro.fecharetiro)}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      getStatusColor(capitalizeFirst(retiro.estados))
                    )}>
                      {capitalizeFirst(retiro.estados)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {retiro.estados === "completado" ? (
                      <button 
                        onClick={() => handleOpenDetalle(retiro)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Ver detalles"
                      >
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                    ) : retiro.estados === "pendiente" ? (
                      <button 
                        onClick={() => handleOpenCambiarEstado(retiro)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Cambiar estado"
                      >
                        <Settings size={18} className="text-muted-foreground" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleOpenDetalle(retiro)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Ver detalles"
                      >
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-[70px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">por página</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {Math.ceil(filteredRetiros.length / itemsPerPage)} 
              ({filteredRetiros.length} retiros)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            
            {Array.from({ length: Math.min(5, Math.ceil(filteredRetiros.length / itemsPerPage)) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  disabled={isLoading}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium",
                    currentPage === page 
                      ? "bg-primary text-primary-foreground" 
                      : "border border-border hover:bg-muted",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {page}
                </button>
              );
            })}
            
            <button 
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRetiros.length / itemsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(filteredRetiros.length / itemsPerPage) || isLoading}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedSolicitud && (
        <>
          <CambiarEstadoModal 
            open={showCambiarEstadoModal}
            onOpenChange={setShowCambiarEstadoModal}
            solicitud={selectedSolicitud}
            onEstadoChanged={cargarRetiros}
          />
          <DetalleCompletadoModal 
            open={showDetalleModal}
            onOpenChange={setShowDetalleModal}
            solicitud={selectedSolicitud}
          />
        </>
      )}
    </div>
  );
}
