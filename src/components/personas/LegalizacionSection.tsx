import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Eye, Trash2, X, AlertTriangle, Calendar, Clock, DollarSign, FileText, Loader2 } from "lucide-react";
import { obtenerColeccion, actualizarDocumento } from "@/supabase/database";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Función para formatear moneda colombiana
const formatCurrency = (amount: number) => {
  const valor = Number(amount);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number.isFinite(valor) ? valor : 0).replace('COP', '$');
};

// Convierte cualquier fecha (ISO string, Date, Timestamp serializado) en Date
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
const formatDate = (value: any) => {
  const fecha = parseFecha(value);
  if (!fecha) return 'Sin fecha';
  return fecha.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Función para calcular tiempo transcurrido
const calculateTimeElapsed = (value: any) => {
  const fecha = parseFecha(value);
  if (!fecha) return '-';

  const diffMs = Date.now() - fecha.getTime();

  // Si la diferencia es negativa, la fecha es futura
  if (diffMs < 0) {
    return 'Fecha futura';
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  // Formato HH:MM:SS como en solicitudes
  if (diffDays > 0) {
    const totalHours = diffDays * 24 + diffHours;
    return `${totalHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
  }
  return `${diffHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
};

// Retiros anticipados programados a partir del plazo del CDAT (cada 3 meses)
const calcularRetirosProgramados = (cdat: any) => {
  const plazoMeses = Number(cdat?.tiempo) || 0;
  const cantidadRetiros = Math.floor(plazoMeses / 3);
  const fechaApertura = parseFecha(cdat?.fecha_apertura);
  if (cantidadRetiros < 1 || !fechaApertura) return [];

  const gananciasTotal = Number(cdat?.ganancias) || 0;
  const inversion = Number(cdat?.inversion) || 0;
  const gananciaPorRetiro = Math.floor(gananciasTotal / cantidadRetiros);

  return Array.from({ length: cantidadRetiros }, (_, i) => {
    const numero = i + 1;
    const fecha = new Date(fechaApertura);
    fecha.setMonth(fechaApertura.getMonth() + numero * 3);
    const esUltimo = numero === cantidadRetiros;
    return {
      numero,
      fecha,
      monto: esUltimo ? gananciaPorRetiro + inversion : gananciaPorRetiro,
      esUltimo,
    };
  });
};

const esUrl = (archivo: string) => /^https?:\/\//i.test(archivo || '');

export function LegalizacionSection() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [cdatData, setCdatData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"todos" | "nombre" | "documento">("todos");
  const itemsPerPage = 10;

  // Cargar datos de CDATs pendientes de firma
  const cargarCDATs = async () => {
    try {
      setIsLoading(true);
      const cdats = await obtenerColeccion('Cdats');

      // Filtrar solo los CDATs pendientes de firma
      const cdatsPendientesFirma = (cdats as any[]).filter(cdat =>
        String(cdat.estado || '').toLowerCase() === 'pendiente de firma'
      );

      setCdatData(cdatsPendientesFirma);
    } catch (error) {
      console.error("Error al cargar CDATs");
      toast({
        title: "Error",
        description: "No se pudieron cargar los CDATs pendientes de firma",
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

  // Filtrar localmente por nombre o documento
  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return cdatData;
    return cdatData.filter(cdat => {
      const nombre = String(cdat.nombreusuario || '').toLowerCase();
      const documento = String(cdat.documentousuario || '');
      if (searchType === 'nombre') return nombre.includes(term);
      if (searchType === 'documento') return documento.includes(term);
      return nombre.includes(term) || documento.includes(term);
    });
  }, [cdatData, searchTerm, searchType]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

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

  // Resetear página al cambiar los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchType]);

  // Evitar quedar en una página que ya no existe
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Count by status - solo contamos pendientes de firma
  const pendienteFirmaCount = filteredData.length;

  const getStatusColor = (estado?: string) => {
    switch (estado) {
      case "Pendiente de firma":
        return "bg-orange-100 text-orange-600";
      case "Pendiente de depósito":
        return "bg-orange-100 text-orange-600";
      case "Activo":
        return "bg-green-100 text-green-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Retiros anticipados: `retiros_cdat` no tiene FK al CDAT, así que se
  // calculan desde el plazo del contrato (misma lógica que CDATDetailModal).
  const retirosProgramados = useMemo(
    () => (selectedItem ? calcularRetirosProgramados(selectedItem) : []),
    [selectedItem],
  );

  const handleView = (row: any) => {
    setSelectedItem(row);
    setShowViewModal(true);
  };

  const handleDeleteClick = (row: any) => {
    setSelectedItem(row);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (!selectedItem?.id || !deleteReason.trim()) {
        toast({
          title: "Error",
          description: "Debe proporcionar un motivo para la eliminación",
          variant: "destructive",
        });
        return;
      }

      // Actualizar el documento cambiando el estado a "Eliminado" y agregando el motivo
      await actualizarDocumento('Cdats', selectedItem.id, {
        estado: "Eliminado",
        motivo_eliminado: deleteReason.trim()
      });
      
      // Actualizar la lista local removiendo el item (ya que solo mostramos "Pendiente de firma")
      setCdatData(prevData => prevData.filter(cdat => cdat.id !== selectedItem.id));
      
      // Mostrar mensaje de éxito
      toast({
        title: "CDAT Marcado como Eliminado",
        description: `El CDAT #${selectedItem.id_cdat} ha sido marcado como eliminado`,
        variant: "default",
      });
      
      // Cerrar modal y limpiar
      setShowDeleteModal(false);
      setDeleteReason("");
      setSelectedItem(null);
      
    } catch (error) {
      console.error("❌ Error actualizando estado del CDAT");
      toast({
        title: "Error al actualizar",
        description: `No se pudo cambiar el estado del CDAT: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-end gap-4 mb-6">
        <div className="flex-1 max-w-[280px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Buscar por</Label>
          <Select value={searchType} onValueChange={(value) => setSearchType(value as "todos" | "nombre" | "documento")}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="nombre">Nombre</SelectItem>
              <SelectItem value="documento">Documento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-[320px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Buscar CDATs</Label>
          <Input 
            placeholder="Escribe el número de cédula o nombre" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card border-border"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                cargarCDATs();
              }
            }}
          />
        </div>

        <Button 
          onClick={() => {
            setSearchTerm('');
            setSearchType('todos');
            cargarCDATs();
          }}
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
          <h2 className="text-lg font-semibold text-foreground">CDAT - Pendientes de Firma</h2>
          
          {/* Status Info */}
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 text-orange-600 px-4 py-2 rounded-lg text-sm font-medium">
              Pendientes de firma ({pendienteFirmaCount})
            </div>
            {isLoading && (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Cargando CDATs pendientes de firma...</p>
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hay CDATs pendientes de firma</p>
          </div>
        ) : (

        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">ID</TableHead>
              <TableHead className="text-muted-foreground font-medium">Nombres y Apellidos</TableHead>
              <TableHead className="text-muted-foreground font-medium">Número de documento</TableHead>
              <TableHead className="text-muted-foreground font-medium">Inversión</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha de solicitud</TableHead>
              <TableHead className="text-muted-foreground font-medium">Estado</TableHead>
              <TableHead className="text-muted-foreground font-medium">Tiempo</TableHead>
              <TableHead className="text-muted-foreground font-medium">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((cdat, index) => (
              <TableRow key={cdat.id || index} className="border-b border-border">
                <TableCell className="text-foreground font-medium">
                  {cdat.id_cdat
                    ? `#${cdat.id_cdat} ${cdat.is_ahorro_cdat ? 'AP' : 'CB'}`
                    : 'N/A'}
                </TableCell>
                <TableCell className="text-foreground">{cdat.nombreusuario || 'N/A'}</TableCell>
                <TableCell className="text-foreground">{cdat.documentousuario || 'N/A'}</TableCell>
                <TableCell className="text-foreground">{formatCurrency(cdat.inversion || 0)}</TableCell>
                <TableCell className="text-foreground">{formatDate(cdat.fecha_apertura || cdat.fechacreacion)}</TableCell>
                <TableCell>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    getStatusColor(cdat.estado || 'Desconocido')
                  )}>
                    {cdat.estado || 'Desconocido'}
                  </span>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    {calculateTimeElapsed(cdat.fechacreacion || cdat.created_at)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleView(cdat)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Ver detalles"
                    >
                      <Eye size={18} className="text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(cdat)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Eliminar CDAT"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({filteredData.length} CDATs)
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

      {/* View Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-4xl p-0 bg-card overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">
            Detalles del CDAT - {selectedItem?.nombreusuario || 'Usuario'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Información completa del CDAT incluyendo inversión, ganancias, fechas y archivos
          </DialogDescription>
          {selectedItem && (
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    {selectedItem.nombreusuario || 'Usuario desconocido'}
                  </h2>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                    {selectedItem.estado || 'Estado desconocido'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowViewModal(false)}
                  aria-label="Cerrar"
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Contract section */}
              <div className="bg-muted/50 rounded-xl p-4 mb-4">
                <h3 className="text-base font-semibold text-foreground mb-3">
                  Apertura de contrato de ahorro a término CDAT
                </h3>
                
                {/* Total to receive */}
                <div className="bg-sidebar rounded-xl py-3 px-6 mb-3">
                  <p className="text-2xl font-bold text-sidebar-foreground text-center">
                    {formatCurrency((Number(selectedItem.inversion) || 0) + (Number(selectedItem.ganancias) || 0))}
                  </p>
                  <p className="text-sm text-sidebar-foreground/80 text-center">Total a recibir</p>
                </div>
                
                {/* Investment + Earnings */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 bg-card rounded-xl py-2 px-4 text-center">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(selectedItem.inversion || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Inversión</p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-primary text-xl font-bold">+</span>
                  </div>
                  <div className="flex-1 bg-card rounded-xl py-2 px-4 text-center">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(selectedItem.ganancias || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ganancias</p>
                  </div>
                </div>
                
                {/* Details row */}
                <div className="grid grid-cols-6 gap-3 mb-4">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <Calendar size={12} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {formatDate(selectedItem.fecha_apertura)}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Fecha de apertura</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <Clock size={12} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {selectedItem.tiempo || 0} meses
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Tiempo</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <Calendar size={12} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {formatDate(selectedItem.fecha_finalizacion)}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Fecha de finalización</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        -{formatCurrency(selectedItem.retefuente_monto || 0)}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Retefuente {Math.round((selectedItem.retefuenteporcentaje || 0.04) * 100)}%
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {selectedItem.ea || 0}% E.A
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Efectiva Anual</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {formatCurrency(selectedItem.rendimiento || 0)}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Rendimientos</p>
                  </div>
                </div>
                
                {/* Anticipated withdrawals */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">Disponibilidad de retiros anticipados</h4>
                    <span className="text-sm font-bold text-primary">{formatCurrency(selectedItem.ganancias || 0)}</span>
                  </div>
                  <div className="space-y-1">
                    {retirosProgramados.length > 0 ? (
                      retirosProgramados.map((retiro) => (
                        <div key={retiro.numero} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
                          <div>
                            <p className="text-sm text-foreground">{formatDate(retiro.fecha)}</p>
                            <p className="text-xs text-muted-foreground">
                              {retiro.esUltimo ? `Anticipo ${retiro.numero} + capital inicial` : `Anticipo ${retiro.numero}`}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(retiro.monto)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No hay retiros programados para este CDAT
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Declaration section */}
              <div className="bg-muted/50 rounded-xl p-4">
              <h3 className="text-base font-semibold text-foreground mb-3">Declaración juramentada del origen de los recursos</h3>
              
              <div className="space-y-1 mb-3">
                <Label className="text-sm text-muted-foreground font-normal">Tipo de operación</Label>
                <div className="bg-card rounded-lg p-2.5">
                  <p className="text-sm text-foreground">{selectedItem.tipooperacion || 'N/A'}</p>
                </div>
              </div>
              
              <div className="space-y-1 mb-3">
                <Label className="text-sm text-muted-foreground font-normal">Valor de la operación</Label>
                <div className="bg-card rounded-lg p-2.5">
                  <p className="text-sm text-foreground">{formatCurrency(selectedItem.inversion || 0)}</p>
                </div>
              </div>
              
              <div className="space-y-1 mb-3">
                <Label className="text-sm text-muted-foreground font-normal">Origen de recursos</Label>
                <div className="bg-card rounded-lg p-2.5">
                  <p className="text-sm text-foreground">{selectedItem.origenrecursos || 'No especificado'}</p>
                </div>
              </div>
              
              <div className="space-y-1 mb-3">
                <Label className="text-sm text-muted-foreground font-normal">Observaciones</Label>
                <div className="bg-card rounded-lg p-2.5">
                  <p className="text-sm text-foreground">{selectedItem.observaciones || 'Sin observaciones'}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground font-normal">Comprobantes de Origen de recursos</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.comprobantes && selectedItem.comprobantes.length > 0 ? (
                    selectedItem.comprobantes.map((archivo: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 bg-card rounded-lg px-3 py-1.5">
                        <FileText size={14} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {esUrl(archivo) ? `Archivo ${index + 1}` : archivo}
                        </span>
                        {esUrl(archivo) && (
                          <a 
                            href={archivo} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs"
                          >
                            Ver
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No hay comprobantes cargados</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-1 mt-4">
                <Label className="text-sm text-muted-foreground font-normal">Archivos del CDAT</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.archivos && selectedItem.archivos.length > 0 ? (
                    selectedItem.archivos.map((archivo: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 bg-card rounded-lg px-3 py-1.5">
                        <FileText size={14} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {esUrl(archivo) ? `Documento PDF ${index + 1}` : archivo}
                        </span>
                        {esUrl(archivo) && (
                          <a 
                            href={archivo} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs"
                          >
                            Ver PDF
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No hay archivos cargados</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md p-6 bg-card">
          <DialogTitle className="sr-only">
            Confirmar eliminación de CDAT
          </DialogTitle>
          <DialogDescription className="sr-only">
            Diálogo para confirmar la eliminación del CDAT seleccionado
          </DialogDescription>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-50 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">¿Estás seguro de eliminar este CDAT?</h2>
            <p className="text-sm text-muted-foreground mb-6">Al realizar esta acción, todos los datos se eliminarán completamente.</p>
            
            <div className="w-full bg-muted/50 rounded-xl p-4 mb-6">
              <Label className="text-sm text-foreground font-medium mb-2 block text-left">Motivo de eliminación</Label>
              <Textarea
                placeholder="Escribe el motivo"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="bg-card border-0 min-h-[100px] resize-none"
              />
            </div>
            
            <div className="flex gap-3 w-full">
              <Button
                onClick={handleConfirmDelete}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                Sí, eliminar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}