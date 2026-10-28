import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Calendar, Clock, DollarSign, FileText } from "lucide-react";

interface CDATDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cdat?: {
    id: string;
    nombreusuario: string;
    firmado: boolean;
    Inversion: number;
    Ganancias: number;
    Rendimiento: number;
    FechaApertura: any;
    FechaFinalizacion: any;
    Tiempo: number;
    RetefuenteMonto: number;
    Retefuenteporcentaje?: number;
    EA: number;
    Tipooperacion: string;
    origenrecursos: string;
    saldoDisponible: number;
    Archivos: string[];
    comprobantes: string[];
    observaciones: string;
  };
}

export function CDATDetailModal({ open, onOpenChange, cdat }: CDATDetailModalProps) {
  if (!cdat) return null;

  // Función para formatear montos
  const formatAmount = (amount: number) => {
    const value = Number(amount);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
  };

  // Función para formatear fechas
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO');
  };

  // Calcular total a recibir
  const totalARecibir = (Number(cdat.Inversion) || 0) + (Number(cdat.Ganancias) || 0);

  // Estado de firma
  const estadoFirma = cdat.firmado ? 'Firmado' : 'Pendiente de firma';
  const estadoColor = cdat.firmado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';

  // Calcular retiros anticipados basado en el plazo
  const calcularRetirosAnticipados = () => {
    const plazoMeses = Number(cdat.Tiempo) || 0;
    const cantidadRetiros = Math.floor(plazoMeses / 3); // Cada 3 meses un retiro
    if (cantidadRetiros < 1 || !cdat.FechaApertura) return [];

    const retiros = [];
    
    const fechaApertura = cdat.FechaApertura.toDate ? cdat.FechaApertura.toDate() : new Date(cdat.FechaApertura);
    if (isNaN(fechaApertura.getTime())) return [];

    const gananciasTotal = Number(cdat.Ganancias) || 0;
    const gananciaPorRetiro = Math.floor(gananciasTotal / cantidadRetiros);
    
    for (let i = 1; i <= cantidadRetiros; i++) {
      const fechaRetiro = new Date(fechaApertura);
      fechaRetiro.setMonth(fechaApertura.getMonth() + (i * 3)); // Cada 3 meses
      
      // El último retiro incluye el capital inicial + la ganancia correspondiente
      const monto = i === cantidadRetiros ? 
        gananciaPorRetiro + cdat.Inversion : 
        gananciaPorRetiro;
      
      retiros.push({
        fecha: fechaRetiro.toLocaleDateString('es-CO'),
        descripcion: i === cantidadRetiros ? `Anticipo ${i} + capital inicial` : `Anticipo ${i}`,
        valor: formatAmount(monto)
      });
    }
    
    return retiros;
  };

  const retirosAnticipados = calcularRetirosAnticipados();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-background border-0">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">{cdat.nombreusuario}</h2>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${estadoColor}`}>
                {estadoFirma}
              </span>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Main Card */}
          <div className="bg-muted/30 rounded-xl p-6 mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Apertura de contrato de ahorro a término CDAT
            </h3>

            {/* Total a recibir */}
            <div className="bg-primary rounded-xl p-4 mb-4 text-center">
              <p className="text-2xl font-bold text-primary-foreground">{formatAmount(totalARecibir)}</p>
              <p className="text-sm text-primary-foreground/80">Total a recibir</p>
            </div>

            {/* Inversión + Ganancias */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 bg-card rounded-lg p-4 text-center border border-border">
                <p className="text-lg font-bold text-primary">{formatAmount(cdat.Inversion)}</p>
                <p className="text-xs text-muted-foreground">Inversión</p>
              </div>
              <span className="text-primary font-bold text-xl">+</span>
              <div className="flex-1 bg-card rounded-lg p-4 text-center border border-border">
                <p className="text-lg font-bold text-primary">{formatAmount(cdat.Ganancias)}</p>
                <p className="text-xs text-muted-foreground">Ganancias</p>
              </div>
            </div>

            {/* Info Row */}
            <div className="grid grid-cols-6 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{formatDate(cdat.FechaApertura)}</p>
                <p className="text-xs text-muted-foreground">Fecha de apertura</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{cdat.Tiempo} meses</p>
                <p className="text-xs text-muted-foreground">Tiempo</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{formatDate(cdat.FechaFinalizacion)}</p>
                <p className="text-xs text-muted-foreground">Fecha de finalización</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-orange-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-foreground">-{formatAmount(cdat.RetefuenteMonto)}</p>
                <p className="text-xs text-muted-foreground">Retefuente {Math.round((cdat.Retefuenteporcentaje || 0.04) * 100)}%</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-orange-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{cdat.EA}% E.A</p>
                <p className="text-xs text-muted-foreground">Efectiva Anual</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-orange-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{formatAmount(cdat.Rendimiento)}</p>
                <p className="text-xs text-muted-foreground">Rendimientos</p>
              </div>
            </div>
          </div>

          {/* Disponibilidad de retiros anticipados */}
          <div className="bg-muted/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-foreground">Disponibilidad de retiros anticipados</h4>
              <span className="text-lg font-bold text-orange-500">{formatAmount(cdat.Ganancias)}</span>
            </div>
            <div className="space-y-0">
              {retirosAnticipados.map((retiro, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{retiro.fecha}</p>
                    <p className="text-xs text-muted-foreground">{retiro.descripcion}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{retiro.valor}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Declaración juramentada */}
          <div className="bg-muted/30 rounded-xl p-6">
            <h4 className="text-base font-semibold text-foreground mb-4">
              Declaración juramentada del origen de los recursos
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tipo de operación</p>
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <p className="text-sm text-foreground">{cdat.Tipooperacion}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Valor de la operación</p>
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <p className="text-sm text-foreground">{formatAmount(cdat.Inversion)}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Origen de recursos</p>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground">{cdat.origenrecursos}</p>
              </div>
            </div>

            {cdat.observaciones && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <p className="text-sm text-foreground">{cdat.observaciones}</p>
                </div>
              </div>
            )}

            {cdat.Archivos && cdat.Archivos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Comprobantes de depósito</p>
                <div className="grid grid-cols-2 gap-2">
                  {cdat.Archivos.map((archivo, index) => (
                    <a 
                      key={index} 
                      href={archivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 hover:bg-muted/70 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-xs text-foreground">Comprobante {index + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {cdat.comprobantes && cdat.comprobantes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Comprobantes de Origen de recursos</p>
                <div className="grid grid-cols-2 gap-2">
                  {cdat.comprobantes.map((comprobante, index) => (
                    <a 
                      key={index} 
                      href={comprobante}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 hover:bg-muted/70 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-xs text-foreground">Comprobante {index + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}