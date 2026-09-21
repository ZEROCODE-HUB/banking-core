import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Settings, FileText, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditPortfolio {
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

type PortfolioStatus = 
  | "al-dia"
  | "vencido"
  | "mora-temprana"
  | "mora-tardia"
  | "castigo";

interface StatusFilter {
  key: PortfolioStatus | "todos";
  label: string;
  count: number;
  color?: string;
}

const statusFilters: StatusFilter[] = [
  { key: "todos", label: "Todos", count: 45 },
  { key: "al-dia", label: "Al día", count: 32 },
  { key: "vencido", label: "Vencido", count: 8 },
  { key: "mora-temprana", label: "Mora temprana", count: 3 },
  { key: "mora-tardia", label: "Mora tardía", count: 2 },
  { key: "castigo", label: "Castigo", count: 0 },
];

const mockedPortfolio: CreditPortfolio[] = [
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
    diasMora: 0
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
    diasMora: 15
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
    diasMora: 0
  }
];

const getStatusColor = (status: PortfolioStatus): string => {
  const colors = {
    "al-dia": "bg-green-100 text-green-800",
    "vencido": "bg-red-100 text-red-800",
    "mora-temprana": "bg-yellow-100 text-yellow-800",
    "mora-tardia": "bg-orange-100 text-orange-800",
    "castigo": "bg-gray-100 text-gray-800"
  };
  return colors[status];
};

const getStatusLabel = (status: PortfolioStatus): string => {
  const labels = {
    "al-dia": "Al día",
    "vencido": "Vencido",
    "mora-temprana": "Mora temprana",
    "mora-tardia": "Mora tardía",
    "castigo": "Castigo"
  };
  return labels[status];
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount);
};

export default function Cartera() {
  const [activeFilter, setActiveFilter] = useState<PortfolioStatus | "todos">("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPortfolio = mockedPortfolio.filter(credit => {
    const matchesSearch = 
      credit.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credit.numeroDocumento.includes(searchTerm) ||
      credit.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = activeFilter === "todos" || credit.estadoCartera === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Calculate summary statistics
  const totalCartera = mockedPortfolio.reduce((sum, credit) => sum + credit.saldoPendiente, 0);
  const creditosActivos = mockedPortfolio.length;
  const creditosVencidos = mockedPortfolio.filter(c => c.estadoCartera === "vencido").length;
  const montoVencido = mockedPortfolio
    .filter(c => c.estadoCartera === "vencido")
    .reduce((sum, credit) => sum + credit.saldoPendiente, 0);

  return (
    <MainLayout sidebarType="credito" pageTitle="Cartera">
      <div className="space-y-8">
        {/* Statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="rounded-2xl border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cartera</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(totalCartera)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <FileText className="text-green-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Créditos Activos</p>
                  <p className="text-lg font-bold text-foreground">{creditosActivos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <FileText className="text-red-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                  <p className="text-lg font-bold text-foreground">{creditosVencidos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="text-orange-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monto Vencido</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(montoVencido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-9">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder="Buscar por nombre, documento o ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-13 bg-background rounded-2xl border-border"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-13 w-13 rounded-2xl border-border"
          >
            <Settings size={24} className="text-foreground" />
          </Button>
        </div>

        {/* Main content card */}
        <Card className="rounded-3xl border-border">
          <CardHeader className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-foreground">Cartera de créditos</h2>
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-xl px-4 py-2">
                  Exportar reporte
                </Button>
                <Button className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-bold text-base">
                  Gestión de cobranza
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 pt-0">
            <div className="space-y-8">
              {/* Status filters */}
              <div className="p-2 bg-muted rounded-2xl border border-border">
                <div className="flex gap-1">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-w-fit",
                        activeFilter === filter.key 
                          ? "bg-background text-foreground border border-border shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-border">
                {/* Table header */}
                <div className="grid grid-cols-12 bg-muted">
                  <div className="p-4 text-muted-foreground font-medium text-sm">ID</div>
                  <div className="col-span-2 p-4 text-muted-foreground font-medium text-sm">Nombres y Apellidos</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Documento</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Monto Crédito</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Saldo Pendiente</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Fecha Desembolso</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Vencimiento</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Cuotas</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Días Mora</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm">Estado</div>
                  <div className="p-4 text-muted-foreground font-medium text-sm text-center">Acciones</div>
                </div>

                {/* Table rows */}
                {filteredPortfolio.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No se encontraron créditos para los filtros seleccionados
                  </div>
                ) : (
                  filteredPortfolio.map((credit) => (
                    <div 
                      key={credit.id} 
                      className="grid grid-cols-12 bg-background border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="p-4 font-medium text-foreground text-sm">{credit.id}</div>
                      <div className="col-span-2 p-4 text-foreground text-sm">{credit.nombreCompleto}</div>
                      <div className="p-4 text-foreground text-sm">{credit.numeroDocumento}</div>
                      <div className="p-4 text-foreground text-sm">{formatCurrency(credit.montoCredito)}</div>
                      <div className="p-4 text-foreground text-sm">{formatCurrency(credit.saldoPendiente)}</div>
                      <div className="p-4 text-foreground text-sm">{credit.fechaDesembolso}</div>
                      <div className="p-4 text-foreground text-sm">{credit.fechaVencimiento}</div>
                      <div className="p-4 text-foreground text-sm">{credit.cuotasPagadas}/{credit.cuotasTotales}</div>
                      <div className="p-4 text-foreground text-sm">
                        {credit.diasMora > 0 ? credit.diasMora : "-"}
                      </div>
                      <div className="p-4">
                        <Badge variant="secondary" className={cn("px-3 py-1", getStatusColor(credit.estadoCartera))}>
                          {getStatusLabel(credit.estadoCartera)}
                        </Badge>
                      </div>
                      <div className="p-4 flex justify-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <FileText size={14} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}