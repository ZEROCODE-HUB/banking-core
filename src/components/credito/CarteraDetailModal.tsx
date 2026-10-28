import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortfolioStatus =
  | "al-dia"
  | "vencido"
  | "mora-temprana"
  | "mora-tardia"
  | "castigo";

export interface CreditPortfolio {
  id: string;
  nombreCompleto: string;
  numeroDocumento: string;
  montoCredito: number;
  saldoPendiente: number;
  fechaDesembolso: string;
  fechaVencimiento: string;
  cuotasPagadas: number;
  cuotasTotales: number;
  estadoCartera: PortfolioStatus;
  diasMora: number;
}

interface CarteraDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: CreditPortfolio | null;
}

const STATUS_LABEL: Record<PortfolioStatus, string> = {
  "al-dia": "Al día",
  "vencido": "Vencido",
  "mora-temprana": "Mora temprana",
  "mora-tardia": "Mora tardía",
  "castigo": "Castigo",
};

const STATUS_COLOR: Record<PortfolioStatus, string> = {
  "al-dia": "bg-green-100 text-green-800",
  "vencido": "bg-red-100 text-red-800",
  "mora-temprana": "bg-yellow-100 text-yellow-800",
  "mora-tardia": "bg-orange-100 text-orange-800",
  "castigo": "bg-gray-100 text-gray-800",
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function CarteraDetailModal({ open, onOpenChange, credit }: CarteraDetailModalProps) {
  if (!credit) return null;

  const saldoPagado = Math.max(0, credit.montoCredito - credit.saldoPendiente);
  const progreso = credit.cuotasTotales > 0
    ? Math.min(100, Math.round((credit.cuotasPagadas / credit.cuotasTotales) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-2xl w-[95vw] p-6 bg-card"
      >
        <DialogHeader className="flex flex-row items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-semibold text-foreground">
              Detalle de cartera
            </DialogTitle>
            <span className={cn("px-4 py-1.5 rounded-full text-xs font-medium", STATUS_COLOR[credit.estadoCartera])}>
              {STATUS_LABEL[credit.estadoCartera]}
            </span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-[#F8F8FA] rounded-xl p-5">
            <div className="grid grid-cols-2 gap-6">
              <DetailItem label="ID" value={credit.id} />
              <DetailItem label="Número de documento" value={credit.numeroDocumento} />
              <DetailItem label="Nombres y apellidos" value={credit.nombreCompleto} />
              <DetailItem label="Días de mora" value={credit.diasMora > 0 ? String(credit.diasMora) : "-"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
              <DetailItem label="Monto del crédito" value={formatCurrency(credit.montoCredito)} />
              <DetailItem label="Saldo pendiente" value={formatCurrency(credit.saldoPendiente)} />
              <DetailItem label="Saldo pagado" value={formatCurrency(saldoPagado)} />
            </div>
            <div className="bg-[#F8F8FA] rounded-xl p-5 space-y-4">
              <DetailItem label="Fecha de desembolso" value={credit.fechaDesembolso} />
              <DetailItem label="Fecha de vencimiento" value={credit.fechaVencimiento} />
              <DetailItem
                label="Cuotas"
                value={`${credit.cuotasPagadas} / ${credit.cuotasTotales}`}
              />
            </div>
          </div>

          <div className="bg-[#F8F8FA] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Progreso de pago</p>
              <p className="text-sm text-muted-foreground">{progreso}%</p>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
