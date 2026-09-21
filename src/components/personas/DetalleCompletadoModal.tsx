import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

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
}

interface DetalleCompletadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudData | null;
}

export function DetalleCompletadoModal({ open, onOpenChange, solicitud }: DetalleCompletadoModalProps) {
  if (!solicitud) return null;
  // Función para obtener el color del estado
  const getStatusColor = (estado: string) => {
    switch (estado) {
      case "Completado":
        return "bg-green-100 text-green-600";
      case "Rechazado":
        return "bg-red-100 text-red-600";
      case "Pendiente":
        return "bg-yellow-100 text-yellow-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl w-[95vw] p-6 bg-card">
        <DialogHeader className="flex flex-row items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-semibold text-foreground">Detalles</DialogTitle>
            <span className={`px-4 py-1.5 rounded-full text-xs font-medium ${getStatusColor(solicitud.estado)}`}>
              {solicitud.estado}
            </span>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground transition-colors">
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

          {/* Canal de pago y Fecha */}
          <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Canal de pago</p>
                <div className="bg-card rounded-xl p-4">
                  <p className="text-sm text-foreground">{solicitud.canalPago || "Banco de Occidente"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Fecha de pago de retiro</p>
                <div className="bg-card rounded-xl p-4">
                  <p className="text-sm text-foreground">{solicitud.fechaPago || solicitud.fechaSolicitud}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Observaciones</p>
              <div className="bg-card rounded-xl p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {solicitud.observaciones || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
