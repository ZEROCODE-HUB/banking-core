import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, Eye, MessageCircle } from "lucide-react";
import { CambiarEstadoModal } from "@/components/personas/CambiarEstadoModal";
import { DetalleCompletadoModal } from "@/components/personas/DetalleCompletadoModal";
import { cn } from "@/lib/utils";
import { CrearCDATSection } from "@/components/personas/CrearCDATSection";
import { LegalizacionSection } from "@/components/personas/LegalizacionSection";
import { RetirosCDATSection } from "@/components/personas/RetirosCDATSection";
import { EstadoGeneralCDATSection } from "@/components/personas/EstadoGeneralCDATSection";
import { 
  obtenerTransaccionesPorEstadoRetiro,
  obtenerDocumento
} from "@/supabase/database";

// Mock data
const mockRetiroAhorrosData = [
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", monto: "$ 10.000", entidad: "Bancolombia", fecha: "12/01/2025", estado: "Pendiente de retiro", tiempo: "24:59:32" },
  { id: "#123123214", nombre: "María José González López", documento: "987654321", monto: "$ 25.000", entidad: "Banco de Bogotá", fecha: "13/01/2025", estado: "Completado", tiempo: "-" },
  { id: "#123123215", nombre: "Carlos Eduardo Ruiz Parra", documento: "456789123", monto: "$ 50.000", entidad: "Davivienda", fecha: "14/01/2025", estado: "Rechazado", tiempo: "48:30:15" },
];

type MainMenuType = "Ahorros" | "Crédito" | "CDAT";
type SubMenuType = "Retiro de ahorros" | "Estado general" | "Cartera" | "Crear CDAT" | "Legalización" | "Retiros";

export default function SolicitudesCredito() {
  const [activeMainMenu, setActiveMainMenu] = useState<MainMenuType>("Crédito");
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenuType>("Estado general");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [retiroAhorrosData, setRetiroAhorrosData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCount, setShowCount] = useState("10");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);

  // Helper functions
  const getPageTitle = () => {
    if (activeMainMenu === "Crédito") {
      return activeSubMenu === "Estado general" ? "Estado General - Crédito" : "Cartera - Crédito";
    }
    if (activeMainMenu === "Ahorros") {
      return "Retiro de Ahorros";
    }
    if (activeMainMenu === "CDAT") {
      return `CDAT - ${activeSubMenu}`;
    }
    return "Crédito";
  };

  const cargarRetiroAhorros = async () => {
    setLoading(true);
    try {
      // Usar mock data por ahora
      setRetiroAhorrosData(mockRetiroAhorrosData);
    } catch (error) {
      console.error('Error al cargar retiro de ahorros:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainMenu === "Ahorros") {
      cargarRetiroAhorros();
    }
  }, [activeMainMenu]);

  const filteredData = retiroAhorrosData
    .filter(item => {
      const matchesStatus = statusFilter === "todos" ||
                           item.estado === statusFilter;
      return matchesStatus;
    })
    .slice(0, parseInt(showCount));

  const getStatusCounts = () => {
    return {
      pendiente: retiroAhorrosData.filter(item => item.estado === "Pendiente de retiro").length,
      completado: retiroAhorrosData.filter(item => item.estado === "Completado").length,
      rechazado: retiroAhorrosData.filter(item => item.estado === "Rechazado").length
    };
  };

  const counts = getStatusCounts();

  const mapToSolicitud = (item: any) => ({
    id: item.id,
    nombre: item.nombre,
    documento: item.documento,
    telefono: item.telefono || "",
    email: item.email || "",
    banco: item.entidad || "",
    numeroCuenta: item.numeroCuenta || "",
    tipoCuenta: item.tipoCuenta || "",
    producto: item.producto || "Retiro de ahorros",
    transaccionId: item.transaccionId || item.id,
    fechaSolicitud: item.fecha,
    monto: item.monto,
    estado: item.estado,
    docId: item.docId || "",
    transaccionCompleta: item,
  });

  const handleVerDetalle = (item: any) => {
    setSelectedTransaction(mapToSolicitud(item));
    setShowDetalleModal(true);
  };

  const handleEstadoChange = (item: any) => {
    setSelectedTransaction(mapToSolicitud(item));
    setShowEstadoModal(true);
  };

  const handleRefresh = () => {
    cargarRetiroAhorros();
  };

  const getBadgeVariant = (estado: string) => {
    if (estado === "Completado") return "default";
    if (estado === "Rechazado") return "destructive";
    return "secondary";
  };

  const renderContent = () => {
    // CDAT Sections
    if (activeMainMenu === "CDAT") {
      switch (activeSubMenu) {
        case "Crear CDAT":
          return <CrearCDATSection onNavigateToLegalizacion={() => setActiveSubMenu("Legalización")} />;
        case "Legalización":
          return <LegalizacionSection />;
        case "Retiros":
          return <RetirosCDATSection />;
        default:
          return <EstadoGeneralCDATSection />;
      }
    }

    // Crédito sections - redirect to dedicated pages
    if (activeMainMenu === "Crédito") {
      if (activeSubMenu === "Estado general") {
        window.location.href = "/credito/estado-general";
        return null;
      } else if (activeSubMenu === "Cartera") {
        window.location.href = "/credito/cartera";
        return null;
      }
    }

    // Ahorros - Retiro de ahorros 
    if (activeMainMenu === "Ahorros") {
      return (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <Card className="rounded-2xl border-border">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Pendiente de retiro</p>
                <p className="text-4xl font-bold text-foreground">{counts.pendiente}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Rechazado</p>
                <p className="text-4xl font-bold text-foreground">{counts.rechazado}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Completado</p>
                <p className="text-4xl font-bold text-foreground">{counts.completado}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-9 rounded-lg border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Pendiente de retiro">Pendiente</SelectItem>
                    <SelectItem value="Completado">Completado</SelectItem>
                    <SelectItem value="Rechazado">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar:</span>
                <Select value={showCount} onValueChange={setShowCount}>
                  <SelectTrigger className="w-20 h-9 rounded-lg border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={loading || refreshing}
              className="flex items-center gap-2 text-sm"
            >
              <RefreshCw className={cn("h-4 w-4", (loading || refreshing) && "animate-spin")} />
              {refreshing ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>

          {/* Table */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-2xl">
                {/* Header */}
                <div className="grid grid-cols-10 bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">
                  <div>ID</div>
                  <div className="col-span-2">Nombres y Apellidos</div>
                  <div>Documento</div>
                  <div>Monto</div>
                  <div>Entidad bancaria</div>
                  <div>Fecha de solicitud</div>
                  <div>Estado</div>
                  <div>Tiempo</div>
                  <div>Acciones</div>
                </div>

                {/* Rows */}
                {filteredData.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No se encontraron registros
                  </div>
                ) : (
                  filteredData.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-10 px-4 py-3 border-t border-border hover:bg-muted/50 transition-colors items-center text-sm"
                    >
                      <div className="font-medium">{item.id}</div>
                      <div className="col-span-2">{item.nombre}</div>
                      <div>{item.documento}</div>
                      <div>{item.monto}</div>
                      <div>{item.entidad}</div>
                      <div>{item.fecha}</div>
                      <div>
                        <Badge variant={getBadgeVariant(item.estado)} className="text-xs">
                          {item.estado}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        {item.estado !== "Completado" && item.tiempo !== "-" ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                            {item.tiempo}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerDetalle(item)}
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={15} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleEstadoChange(item)}
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors"
                          title="Cambiar estado"
                        >
                          <MessageCircle size={15} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <CambiarEstadoModal
            open={showEstadoModal}
            onOpenChange={setShowEstadoModal}
            solicitud={selectedTransaction}
            onEstadoChanged={() => {
              setShowEstadoModal(false);
              handleRefresh();
            }}
          />

          <DetalleCompletadoModal
            open={showDetalleModal}
            onOpenChange={setShowDetalleModal}
            solicitud={selectedTransaction}
          />
        </>
      );
    }

    return null;
  };

  return (
    <MainLayout sidebarType="credito" pageTitle={getPageTitle()}>
      <div className="space-y-6">
        {renderContent()}
      </div>
    </MainLayout>
  );
}