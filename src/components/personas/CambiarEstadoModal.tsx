import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { X, AlertTriangle, ArrowRight, Check, CalendarIcon } from "lucide-react";
import { actualizarEstadoTransaccion } from "@/supabase/database";
import { supabase } from "@/supabase/config";
import { useToast } from "@/hooks/use-toast";

interface SolicitudData {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: string;
  producto: string;
  transaccionId: string;
  fechaSolicitud: string;
  monto: string;
  estado: string;
  canalPago?: string;
  fechaPago?: string;
  observaciones?: string;
  docId?: string;
  subcoleccionPath?: string;
  transaccionCompleta?: any;
  cdatId?: string;
  montoRaw?: number;
}

interface CambiarEstadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudData | null;
  onEstadoChanged?: () => void;
}

type ModalStep = "seleccion" | "completado" | "rechazado" | "confirmacion";
type NuevoEstado = "Completado" | "Rechazado" | null;

export function CambiarEstadoModal({ open, onOpenChange, solicitud, onEstadoChanged }: CambiarEstadoModalProps) {
  const [step, setStep] = useState<ModalStep>("seleccion");
  const [nuevoEstado, setNuevoEstado] = useState<NuevoEstado>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Completado fields
  const [canalPago, setCanalPago] = useState<"Banco de Occidente" | "Corresponsal">("Banco de Occidente");
  const [fechaPago, setFechaPago] = useState<Date | undefined>(new Date());
  const [fechaPagoConfirm, setFechaPagoConfirm] = useState<Date | undefined>(new Date());
  const [observacionesCompletado, setObservacionesCompletado] = useState("");
  
  // Rechazado fields
  const [observacionesRechazado, setObservacionesRechazado] = useState("");

  if (!solicitud) return null;

  const handleSelectEstado = (estado: NuevoEstado) => {
    setNuevoEstado(estado);
    if (estado === "Completado") {
      setStep("completado");
    } else if (estado === "Rechazado") {
      setStep("rechazado");
    }
  };

  const handleEjecutarCambio = () => {
    setStep("confirmacion");
  };

  const handleConfirmar = async () => {
    if (!solicitud.docId) {
      toast({
        title: "Error",
        description: "No se encontró el ID de la transacción",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (solicitud.subcoleccionPath) {
        // Retiro de CDAT: la fila vive en `confirmacionretiros`.
        const datosSubcoleccion: any = {
          estados: nuevoEstado === "Completado" ? "completado" : "rechazado",
          observaciones: nuevoEstado === "Completado" ? observacionesCompletado : observacionesRechazado,
          updated_at: new Date().toISOString(),
        };
        if (nuevoEstado === "Completado") {
          datosSubcoleccion.chanelpay = canalPago;
          const fechaPagoFinal = fechaPagoConfirm ?? fechaPago;
          if (fechaPagoFinal) datosSubcoleccion.fecharetiro = fechaPagoFinal.toISOString();
        }
        const { error } = await supabase
          .from('confirmacionretiros')
          .update(datosSubcoleccion)
          .eq('id', solicitud.docId);
        if (error) throw error;

        // Si se rechaza, devolver el monto al saldo disponible del CDAT.
        if (nuevoEstado === "Rechazado" && solicitud.cdatId && solicitud.montoRaw) {
          const { data: cdatRow, error: cdatError } = await supabase
            .from('cdats')
            .select('saldo_disponible')
            .eq('id', solicitud.cdatId)
            .maybeSingle();
          if (cdatError) throw cdatError;

          if (cdatRow) {
            const nuevoSaldo = Number((cdatRow as any).saldo_disponible ?? 0) + Number(solicitud.montoRaw);
            const { error: updateError } = await supabase
              .from('cdats')
              .update({ saldo_disponible: nuevoSaldo, updated_at: new Date().toISOString() })
              .eq('id', solicitud.cdatId);
            if (updateError) throw updateError;
          }
        }
      } else {
        // Transacción normal en `transactions`.
        const nuevoStatus = nuevoEstado === "Completado" ? "APPROVED" : "REJECTED";
        const datosAdicionales: any = {
          observation: nuevoEstado === "Completado" ? observacionesCompletado : observacionesRechazado,
        };
        if (nuevoEstado === "Completado") {
          datosAdicionales.chanel_pay = canalPago;
          const fechaPagoFinal = fechaPagoConfirm ?? fechaPago;
          if (fechaPagoFinal) datosAdicionales.confirmation_date = fechaPagoFinal.toISOString();
        }
        await actualizarEstadoTransaccion(solicitud.docId, nuevoStatus, datosAdicionales);
      }
      
      toast({
        title: "Estado actualizado",
        description: `La transacción ha sido marcada como ${nuevoEstado?.toLowerCase()}`,
      });

      // Notificar al componente padre para recargar datos
      onEstadoChanged?.();
      handleClose();
      
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      toast({
        title: "Error",
        description: (error as any)?.message || "No se pudo actualizar el estado de la transacción",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    if (step === "confirmacion") {
      setStep(nuevoEstado === "Completado" ? "completado" : "rechazado");
    } else {
      setStep("seleccion");
      setNuevoEstado(null);
    }
  };

  const handleClose = () => {
    setStep("seleccion");
    setNuevoEstado(null);
    onOpenChange(false);
  };

  // Confirmation modal
  if (step === "confirmacion") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent aria-describedby={undefined} className="max-w-md p-6 bg-card">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-foreground">Cambiar estado</DialogTitle>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </DialogHeader>

          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Importante</h3>
            <p className="text-sm text-muted-foreground text-center">
              Al realizar esta acción, no podrás volver a modificar el estado.
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleConfirmar}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Actualizando...
                </div>
              ) : (
                "Si, aceptar"
              )}
            </Button>
            <Button 
              onClick={handleVolver}
              disabled={loading}
              variant="outline" 
              className="flex-1 border-border"
            >
              Volver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl p-8 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between mb-6">
          <DialogTitle className="text-xl font-semibold text-foreground">Cambiar estado</DialogTitle>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </DialogHeader>

        {/* Datos de usuario */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Datos de usuario</h3>
            <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nombres y Apellidos</p>
                  <p className="text-sm font-medium text-foreground">{solicitud.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Número de teléfono</p>
                  <p className="text-sm font-medium text-foreground">{solicitud.telefono}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Número de documento</p>
                  <p className="text-sm font-medium text-foreground">{solicitud.documento}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Correo electrónico</p>
                  <p className="text-sm font-medium text-foreground">{solicitud.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Datos bancarios y Información Alianza */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Datos bancarios de retiro</h3>
              <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Banco</p>
                    <p className="text-sm font-medium text-foreground">{solicitud.banco}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Número de cuenta</p>
                    <p className="text-sm font-medium text-foreground">{solicitud.numeroCuenta}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tipo de cuenta</p>
                  <p className="text-sm font-medium text-foreground">{solicitud.tipoCuenta}</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Información Alianza</h3>
              <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Producto</p>
                    <p className="text-sm font-medium text-foreground">{solicitud.producto}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ID de transacción</p>
                    <p className="text-sm font-medium text-foreground">{solicitud.transaccionId}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hora y fecha de solicitud</p>
                  <p className="text-sm font-medium text-foreground">{solicitud.fechaSolicitud}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Monto */}
          <div className="bg-[#F8F8FA] rounded-xl py-6 text-center">
            <p className="text-3xl font-bold text-foreground">{solicitud.monto}</p>
            <p className="text-sm text-muted-foreground mt-1">Monto</p>
          </div>

          {/* Nuevo estado */}
          <div className="bg-[#F8F8FA] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Nuevo estado</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectEstado("Completado")}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl transition-all bg-card",
                  nuevoEstado === "Completado" && "ring-1 ring-green-500"
                )}
              >
                <span className="text-sm font-medium text-foreground">Completado</span>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  nuevoEstado === "Completado" 
                    ? "bg-green-500 text-white" 
                    : "border-2 border-muted-foreground/30"
                )}>
                  {nuevoEstado === "Completado" && <Check size={14} />}
                </div>
              </button>
              <button
                onClick={() => handleSelectEstado("Rechazado")}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl transition-all bg-card",
                  nuevoEstado === "Rechazado" && "ring-1 ring-green-500"
                )}
              >
                <span className="text-sm font-medium text-foreground">Rechazado</span>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  nuevoEstado === "Rechazado" 
                    ? "bg-green-500 text-white" 
                    : "border-2 border-muted-foreground/30"
                )}>
                  {nuevoEstado === "Rechazado" && <Check size={14} />}
                </div>
              </button>
            </div>
          </div>

          {/* Form fields based on selection */}
          {step === "completado" && (
            <>
              {/* Estado change indicator */}
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                  Pendiente de retiro
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-600">
                  Completado
                </span>
              </div>

              {/* Canal de pago */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Canal de pago</h3>
                <div className="bg-[#F0F0F2] rounded-full p-1.5 flex">
                  <button
                    onClick={() => setCanalPago("Banco de Occidente")}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-full transition-all font-medium text-sm text-center",
                      canalPago === "Banco de Occidente"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Banco de Occidente
                  </button>
                  <button
                    onClick={() => setCanalPago("Corresponsal")}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-full transition-all font-medium text-sm text-center",
                      canalPago === "Corresponsal"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Corresponsal
                  </button>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Fecha de pago de retiro</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-[#F8F8FA] border-0 h-12",
                          !fechaPago && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaPago ? format(fechaPago, "dd/MM/yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaPago}
                        onSelect={setFechaPago}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Confirma la fecha de pago de retiro</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-[#F8F8FA] border-0 h-12",
                          !fechaPagoConfirm && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaPagoConfirm ? format(fechaPagoConfirm, "dd/MM/yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaPagoConfirm}
                        onSelect={setFechaPagoConfirm}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Observaciones</label>
                <Textarea 
                  value={observacionesCompletado}
                  onChange={(e) => setObservacionesCompletado(e.target.value)}
                  placeholder="Ingrese las observaciones para el estado completado..."
                  className="bg-[#F8F8FA] border-0 min-h-[120px] resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <Button 
                  onClick={handleEjecutarCambio}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-sm font-medium"
                >
                  Ejecutar cambio de estado
                </Button>
                <Button 
                  onClick={handleVolver}
                  variant="outline" 
                  className="flex-1 border-border h-12 text-sm font-medium"
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}

          {step === "rechazado" && (
            <>
              {/* Estado change indicator */}
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                  Pendiente de retiro
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                  Rechazado
                </span>
              </div>

              {/* Observaciones */}
              <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Observaciones</label>
                  <Textarea 
                    value={observacionesRechazado}
                    onChange={(e) => setObservacionesRechazado(e.target.value)}
                    placeholder="Ingrese las observaciones para el rechazo..."
                    className="bg-card border-0 min-h-[120px] resize-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <Button 
                  onClick={handleEjecutarCambio}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-sm font-medium"
                >
                  Ejecutar cambio de estado
                </Button>
                <Button 
                  onClick={handleVolver}
                  variant="outline" 
                  className="flex-1 border-border h-12 text-sm font-medium"
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
