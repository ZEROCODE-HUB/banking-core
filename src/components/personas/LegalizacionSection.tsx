import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Eye, Trash2, X, AlertTriangle, Calendar, Clock, DollarSign, FileText, Loader2 } from "lucide-react";
import { obtenerColeccion, obtenerSubcoleccion, actualizarDocumento } from "@/supabase/database";
import { auth } from "@/supabase/config";
import { Timestamp } from "firebase/firestore";
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
    
    // Si es un Timestamp de Firebase
    if (timestamp && typeof timestamp.toDate === 'function') {
      fecha = timestamp.toDate();
    }
    // Si es un objeto con seconds (Timestamp serializado)
    else if (timestamp && timestamp.seconds) {
      fecha = new Date(timestamp.seconds * 1000);
    }
    // Si es un Date object
    else if (timestamp instanceof Date) {
      fecha = timestamp;
    }
    // Si es un string o number
    else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      fecha = new Date(timestamp);
    }
    // Si es null o undefined
    else {
      return 'Sin fecha';
    }
    
    // Verificar que la fecha sea válida
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
    
    // Si es un Timestamp de Firebase
    if (createdDate && typeof createdDate.toDate === 'function') {
      fecha = createdDate.toDate();
    }
    // Si es un objeto con seconds (Timestamp serializado)
    else if (createdDate && createdDate.seconds) {
      fecha = new Date(createdDate.seconds * 1000);
    }
    // Si es un Date object
    else if (createdDate instanceof Date) {
      fecha = createdDate;
    }
    // Si es un string o number
    else if (typeof createdDate === 'string' || typeof createdDate === 'number') {
      fecha = new Date(createdDate);
    }
    // Si no hay fecha
    else {
      return '-';
    }
    
    // Verificar que la fecha sea válida
    if (isNaN(fecha.getTime())) {
      return '-';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - fecha.getTime();
    
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
      // Si hay días, mostrar días + horas:minutos
      const totalHours = diffDays * 24 + diffHours;
      return `${totalHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
    } else {
      // Solo horas:minutos:segundos
      return `${diffHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('Error calculando tiempo:', error);
    return '-';
  }
};

export function LegalizacionSection() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [cdatData, setCdatData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [documentoFilter, setDocumentoFilter] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("identificacion");
  const [retirosSelectedItem, setRetirosSelectedItem] = useState<any[]>([]);

  // Cargar datos de CDATs pendientes de firma
  const cargarCDATs = async () => {
    try {
      setIsLoading(true);
      const cdats = await obtenerColeccion('Cdats');
      
      // Filtrar solo los CDATs pendientes de firma
      const cdatsPendientesFirma = cdats.filter(cdat => 
        cdat.Estado === "Pendiente de firma"
      );
      
      console.log('CDATs pendientes de firma:', cdatsPendientesFirma);
      setCdatData(cdatsPendientesFirma);
    } catch (error) {
      console.error('Error al cargar CDATs:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los CDATs pendientes de firma",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar CDATs por documento
  const buscarCDATs = async () => {
    if (!documentoFilter.trim()) {
      // Si no hay filtro, cargar todos los pendientes de firma
      await cargarCDATs();
      return;
    }

    try {
      setIsLoading(true);
      const cdats = await obtenerColeccion('Cdats');
      
      // Filtrar por documento y estado
      const cdatsFiltrados = cdats.filter(cdat => 
        cdat.Estado === "Pendiente de firma" &&
        (cdat.documentousuario?.toString().includes(documentoFilter) ||
         cdat.nombreusuario?.toLowerCase().includes(documentoFilter.toLowerCase()))
      );
      
      setCdatData(cdatsFiltrados);
      
      if (cdatsFiltrados.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron CDATs pendientes de firma con ese criterio",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
      toast({
        title: "Error en búsqueda",
        description: "Hubo un problema buscando los CDATs",
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

  // Filter data - ahora solo filtramos localmente los datos ya cargados
  const filteredData = documentoFilter 
    ? cdatData.filter(cdat => 
        cdat.documentousuario?.toString().includes(documentoFilter) ||
        cdat.nombreusuario?.toLowerCase().includes(documentoFilter.toLowerCase())
      )
    : cdatData;

  // Count by status - solo contamos pendientes de firma
  const pendienteFirmaCount = filteredData.length;

  const getStatusColor = (estado: string) => {
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

  // Cargar retiros de un CDAT específico
  const cargarRetirosCDAT = async (cdatId: string) => {
    try {
      console.log('🔄 Cargando retiros para CDAT:', cdatId);
      const retiros = await obtenerSubcoleccion(`Cdats/${cdatId}`, 'RetirosCdat');
      console.log('✅ Retiros cargados:', retiros);
      
      // Ordenar por fecha de retiro
      return retiros.sort((a, b) => {
        const fechaA = a.Fecharetiro?.toDate ? a.Fecharetiro.toDate() : new Date(a.Fecharetiro);
        const fechaB = b.Fecharetiro?.toDate ? b.Fecharetiro.toDate() : new Date(b.Fecharetiro);
        return fechaA.getTime() - fechaB.getTime();
      });
    } catch (error) {
      console.error('❌ Error cargando retiros para CDAT', cdatId, ':', error);
      return [];
    }
  };

  const handleView = async (row: any) => {
    setSelectedItem(row);
    setShowViewModal(true);
    
    // Cargar retiros del CDAT
    if (row.id) {
      const retiros = await cargarRetirosCDAT(row.id);
      setRetirosSelectedItem(retiros);
    }
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

      console.log("� Cambiando estado del CDAT:", selectedItem.id, "Motivo:", deleteReason);
      
      // Actualizar el documento cambiando el estado a "Eliminado" y agregando el motivo
      await actualizarDocumento('Cdats', selectedItem.id, {
        Estado: "Eliminado",
        motivoEliminado: deleteReason.trim(),
        fechaEliminacion: new Date()
      });
      
      // Actualizar la lista local removiendo el item (ya que solo mostramos "Pendiente de firma")
      setCdatData(prevData => prevData.filter(cdat => cdat.id !== selectedItem.id));
      
      // Mostrar mensaje de éxito
      toast({
        title: "CDAT Marcado como Eliminado",
        description: `El CDAT #${selectedItem.idCdat} ha sido marcado como eliminado`,
        variant: "default",
      });
      
      // Cerrar modal y limpiar
      setShowDeleteModal(false);
      setDeleteReason("");
      setSelectedItem(null);
      
    } catch (error) {
      console.error("❌ Error actualizando estado del CDAT:", error);
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
          <Label className="text-sm text-foreground font-normal">Tipo de documento</Label>
          <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
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
          <Label className="text-sm text-foreground font-normal">Número de cédula</Label>
          <Input 
            placeholder="Escribe el número de cédula o nombre" 
            value={documentoFilter}
            onChange={(e) => setDocumentoFilter(e.target.value)}
            className="bg-card border-border"
            onKeyPress={(e) => e.key === 'Enter' && buscarCDATs()}
          />
        </div>

        <Button 
          onClick={buscarCDATs}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-12"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Buscando...
            </>
          ) : (
            'Buscar'
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
            {filteredData.map((cdat, index) => (
              <TableRow key={cdat.id || index} className="border-b border-border">
                <TableCell className="text-foreground font-medium">
                  {cdat.idCdat
                    ? `#${cdat.idCdat} ${cdat.isAhorroCdat ? 'AP' : 'CB'}`
                    : 'N/A'}
                </TableCell>
                <TableCell className="text-foreground">{cdat.nombreusuario || 'N/A'}</TableCell>
                <TableCell className="text-foreground">{cdat.documentousuario || 'N/A'}</TableCell>
                <TableCell className="text-foreground">{formatCurrency(cdat.Inversion || 0)}</TableCell>
                <TableCell className="text-foreground">{formatDate(cdat.FechaApertura || cdat.fechaCreacion)}</TableCell>
                <TableCell>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    getStatusColor(cdat.Estado || 'Desconocido')
                  )}>
                    {cdat.Estado || 'Desconocido'}
                  </span>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    {calculateTimeElapsed(cdat.fechaCreacion)}
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

      {/* View Details Modal */}
      <Dialog open={showViewModal} onOpenChange={(open) => {
        setShowViewModal(open);
        if (!open) {
          setRetirosSelectedItem([]);
        }
      }}>
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
                    {selectedItem.Estado || 'Estado desconocido'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowViewModal(false)}
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
                    {formatCurrency((selectedItem.Inversion || 0) + (selectedItem.Ganancias || 0))}
                  </p>
                  <p className="text-sm text-sidebar-foreground/80 text-center">Total a recibir</p>
                </div>
                
                {/* Investment + Earnings */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 bg-card rounded-xl py-2 px-4 text-center">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(selectedItem.Inversion || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Inversión</p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-primary text-xl font-bold">+</span>
                  </div>
                  <div className="flex-1 bg-card rounded-xl py-2 px-4 text-center">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(selectedItem.Ganancias || 0)}
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
                        {formatDate(selectedItem.FechaApertura)}
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
                        {selectedItem.Tiempo || 0} meses
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
                        {formatDate(selectedItem.FechaFinalizacion)}
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
                        -{formatCurrency(selectedItem.RetefuenteMonto || 0)}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Retefuente {Math.round((selectedItem.Retefuenteporcentaje || 0.04) * 100)}%
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {selectedItem.EA || 0}% E.A
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
                        {formatCurrency(selectedItem.Rendimiento || 0)}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Rendimientos</p>
                  </div>
                </div>
                
                {/* Anticipated withdrawals */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">Disponibilidad de retiros anticipados</h4>
                    <span className="text-sm font-bold text-primary">{formatCurrency(selectedItem.Ganancias || 0)}</span>
                  </div>
                  <div className="space-y-1">
                    {retirosSelectedItem.length > 0 ? (
                      retirosSelectedItem.map((retiro, index) => {
                        const fechaRetiro = retiro.Fecharetiro?.toDate ? 
                          retiro.Fecharetiro.toDate() : 
                          new Date(retiro.Fecharetiro);
                        const esUltimoRetiro = index === retirosSelectedItem.length - 1;
                        
                        return (
                          <div key={index} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
                            <div>
                              <p className="text-sm text-foreground">{formatDate(retiro.Fecharetiro)}</p>
                              <p className="text-xs text-muted-foreground">
                                {esUltimoRetiro ? `Anticipo ${index + 1} + capital inicial` : `Anticipo ${index + 1}`}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {formatCurrency(retiro.Monto || 0)}
                            </p>
                          </div>
                        );
                      })
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
                  <p className="text-sm text-foreground">{selectedItem.Tipooperacion || 'N/A'}</p>
                </div>
              </div>
              
              <div className="space-y-1 mb-3">
                <Label className="text-sm text-muted-foreground font-normal">Valor de la operación</Label>
                <div className="bg-card rounded-lg p-2.5">
                  <p className="text-sm text-foreground">{formatCurrency(selectedItem.Inversion || 0)}</p>
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
                          {archivo.includes('firebasestorage') ? `Archivo ${index + 1}` : archivo}
                        </span>
                        {archivo.includes('firebasestorage') && (
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
                  {selectedItem.Archivos && selectedItem.Archivos.length > 0 ? (
                    selectedItem.Archivos.map((archivo: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 bg-card rounded-lg px-3 py-1.5">
                        <FileText size={14} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {archivo.includes('firebasestorage') ? `Documento PDF ${index + 1}` : archivo}
                        </span>
                        {archivo.includes('firebasestorage') && (
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