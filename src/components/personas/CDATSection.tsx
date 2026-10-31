import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, Wallet } from "lucide-react";
import { CDATDetailModal } from "./CDATDetailModal";

interface CDATMovimiento {
  id: number;
  fecha: string;
  monto: string;
  estado: string;
  banco: string;
  tipo: string;
  idTransaccion?: string;
  fechaPago?: string;
  detalle?: string;
  observaciones?: string;
}

interface CDAT {
  id: string;
  totalRecibir: string;
  inversion: string;
  ganancias: string;
  fechaVencimiento: string;
  estado: "Activo" | "Finalizado";
  movimientos: CDATMovimiento[];
}

const cdatData: CDAT[] = [
  {
    id: "#123123213",
    totalRecibir: "$ 11.441.500",
    inversion: "$ 10.000.000",
    ganancias: "$ 1.441.500",
    fechaVencimiento: "12/12/2024",
    estado: "Activo",
    movimientos: [
      { id: 1, fecha: "12/09/2024  11:11", monto: "$ -664.950", estado: "Pendiente", banco: "Banco Davivienda", tipo: "Debitado" },
      { 
        id: 2, 
        fecha: "12/09/2024  11:11", 
        monto: "$ 10.000.000", 
        estado: "Depositado", 
        banco: "Banco de Occidente", 
        tipo: "Transferencia",
        idTransaccion: "8231293",
        fechaPago: "20/01/2025",
        detalle: "Aprobada"
      },
      { 
        id: 3, 
        fecha: "12/09/2024  11:11", 
        monto: "$ 10.000.000", 
        estado: "Depositado", 
        banco: "Banco de Occidente", 
        tipo: "Transferencia",
        idTransaccion: "8231293",
        fechaPago: "20/01/2025",
        detalle: "Aprobada",
        observaciones: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
      },
    ]
  },
  {
    id: "#123123213",
    totalRecibir: "$ 11.441.500",
    inversion: "$ 10.000.000",
    ganancias: "$ 1.441.500",
    fechaVencimiento: "12/12/2024",
    estado: "Finalizado",
    movimientos: []
  },
  {
    id: "#123123213",
    totalRecibir: "$ 11.441.500",
    inversion: "$ 10.000.000",
    ganancias: "$ 1.441.500",
    fechaVencimiento: "12/12/2024",
    estado: "Activo",
    movimientos: []
  },
];

const subTabs = ["Todos (14)", "Activos (4)", "Finalizados (10)"];

export function CDATSection() {
  const [activeSubTab, setActiveSubTab] = useState("Todos (14)");
  const [expandedCDATDetails, setExpandedCDATDetails] = useState<string[]>([]);
  const [expandedCDATMovimientos, setExpandedCDATMovimientos] = useState<string[]>([]);
  const [expandedMovimientos, setExpandedMovimientos] = useState<number[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCDAT, setSelectedCDAT] = useState<CDAT | null>(null);

  const toggleCDATDetails = (id: string, index: number) => {
    const key = `${id}-${index}`;
    setExpandedCDATDetails(prev => 
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const toggleCDATMovimientos = (id: string, index: number) => {
    const key = `${id}-${index}`;
    setExpandedCDATMovimientos(prev => 
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const toggleMovimiento = (id: number) => {
    setExpandedMovimientos(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleViewDetails = (cdat: CDAT) => {
    setSelectedCDAT(cdat);
    setShowDetailModal(true);
  };

  return (
    <div className="mt-6 bg-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-foreground">CDAT</h3>
        <div className="flex gap-2">
          {subTabs.map((subTab) => (
            <button
              key={subTab}
              onClick={() => setActiveSubTab(subTab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeSubTab === subTab
                  ? "bg-muted border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {subTab}
            </button>
          ))}
        </div>
      </div>

      {/* CDAT Cards */}
      <div className="bg-muted/50 rounded-xl p-6 space-y-4">
        {cdatData.map((cdat, index) => {
          const cdatKey = `${cdat.id}-${index}`;
          const isDetailsExpanded = expandedCDATDetails.includes(cdatKey);
          const isMovimientosExpanded = expandedCDATMovimientos.includes(cdatKey);
          
          return (
            <div key={cdatKey} className="bg-card rounded-xl border-0 shadow-sm overflow-hidden">
              {/* CDAT Header */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">CDAT</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">ID {cdat.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      cdat.estado === "Activo" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-orange-100 text-orange-700"
                    }`}>
                      {cdat.estado}
                    </span>
                    <button
                      onClick={() => handleViewDetails(cdat)}
                      aria-label="Ver detalles del CDAT"
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => toggleCDATDetails(cdat.id, index)}
                      aria-label="Ver movimientos del CDAT"
                      aria-expanded={isDetailsExpanded}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      {isDetailsExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stats Grid - Collapsible */}
                {isDetailsExpanded && (
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Total a recibir</p>
                      <p className="text-base font-bold text-foreground">{cdat.totalRecibir}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Inversión</p>
                      <p className="text-base font-bold text-foreground">{cdat.inversion}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Ganancias</p>
                      <p className="text-base font-bold text-foreground">{cdat.ganancias}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Fecha de vencimiento</p>
                      <p className="text-base font-bold text-foreground">{cdat.fechaVencimiento}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Movimientos Header - Always visible, independent toggle */}
              <div 
                className="px-4 py-2.5 border-t border-border flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggleCDATMovimientos(cdat.id, index)}
              >
                <h4 className="text-sm font-medium text-foreground">Movimientos</h4>
                {isMovimientosExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {/* Expanded Movimientos */}
              {isMovimientosExpanded && cdat.movimientos.length > 0 && (
                <div className="px-4 pb-4">
                  <p className="text-xs font-medium text-primary mb-2">Este mes</p>
                  <div className="space-y-1.5">
                    {cdat.movimientos.map((mov) => {
                      const isMovExpanded = expandedMovimientos.includes(mov.id);
                      return (
                        <div key={mov.id} className="bg-muted/30 rounded-lg overflow-hidden">
                          <div 
                            className="flex items-center py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleMovimiento(mov.id)}
                          >
                            <span className="flex-1 text-sm text-muted-foreground">{mov.fecha}</span>
                            <span className={`flex-1 text-sm font-medium ${
                              mov.monto.includes("-") ? "text-foreground" : "text-primary"
                            }`}>
                              {mov.monto}
                            </span>
                            <span className="flex-1 text-sm text-muted-foreground">{mov.estado}</span>
                            <span className="flex-1 text-sm text-muted-foreground">{mov.tipo}</span>
                            <button
                              aria-label="Ver movimientos"
                              aria-expanded={isMovExpanded}
                              className="ml-4 p-1 hover:bg-muted rounded"
                            >
                              {isMovExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>

                          {isMovExpanded && (
                            <div className="px-4 pb-4 pt-2 bg-card border-t border-border">
                              <div className="grid grid-cols-4 gap-4 mb-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">ID de transacción</p>
                                  <p className="text-sm font-medium text-foreground">{mov.idTransaccion || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Banco</p>
                                  <p className="text-sm font-medium text-foreground">{mov.banco}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Fecha</p>
                                  <p className="text-sm font-medium text-foreground">{mov.fechaPago || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Detalle</p>
                                  <p className="text-sm font-medium text-foreground">{mov.detalle || "-"}</p>
                                </div>
                              </div>
                              {mov.observaciones && (
                                <div className="mt-3">
                                  <p className="text-xs text-muted-foreground mb-1">Observaciones:</p>
                                  <p className="text-sm text-muted-foreground">{mov.observaciones}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CDAT Detail Modal */}
      <CDATDetailModal 
        open={showDetailModal} 
        onOpenChange={setShowDetailModal}
        cdat={selectedCDAT ? {
          id: selectedCDAT.id,
          nombreusuario: '',
          firmado: false,
          Inversion: parseFloat(selectedCDAT.inversion.replace(/[^0-9.-]+/g, '')) || 0,
          Ganancias: parseFloat(selectedCDAT.ganancias.replace(/[^0-9.-]+/g, '')) || 0,
          Rendimiento: 0,
          FechaApertura: null,
          FechaFinalizacion: selectedCDAT.fechaVencimiento,
          Tiempo: 0,
          RetefuenteMonto: 0,
          EA: 0,
          Tipooperacion: '',
          origenrecursos: '',
          saldoDisponible: 0,
          Archivos: [],
          comprobantes: [],
          observaciones: ''
        } : undefined}
      />
    </div>
  );
}
