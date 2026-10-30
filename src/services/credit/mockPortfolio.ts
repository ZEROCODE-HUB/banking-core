import type { CreditPortfolio } from "@/components/credito/CarteraDetailModal";

/**
 * Datos de ejemplo de la cartera. Viven fuera de la página para que el
 * adaptador (`creditPortfolioSource`) pueda reutilizarlos y para que el día
 * que lleguen datos reales solo cambie el origen, no la vista.
 */
export const mockPortfolio: CreditPortfolio[] = [
  {
    id: "CR-001",
    nombreCompleto: "Ana María Vásquez Torres",
    numeroDocumento: "1025698741",
    montoCredito: 5000000,
    saldoPendiente: 3200000,
    fechaDesembolso: "15/01/2026",
    fechaVencimiento: "15/01/2027",
    cuotasPagadas: 3,
    cuotasTotales: 12,
    estadoCartera: "al-dia",
    diasMora: 0,
  },
  {
    id: "CR-002",
    nombreCompleto: "José Fernando Ruiz Parra",
    numeroDocumento: "1052471693",
    montoCredito: 8000000,
    saldoPendiente: 6800000,
    fechaDesembolso: "10/12/2025",
    fechaVencimiento: "10/12/2026",
    cuotasPagadas: 2,
    cuotasTotales: 12,
    estadoCartera: "vencido",
    diasMora: 15,
  },
  {
    id: "CR-003",
    nombreCompleto: "Claudia Patricia Moreno Silva",
    numeroDocumento: "1058623719",
    montoCredito: 3500000,
    saldoPendiente: 2100000,
    fechaDesembolso: "20/11/2025",
    fechaVencimiento: "20/11/2026",
    cuotasPagadas: 4,
    cuotasTotales: 12,
    estadoCartera: "al-dia",
    diasMora: 0,
  },
];
