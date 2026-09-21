import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";
import { 
  RefreshCw,
  Eye,
  Settings,
  MessageCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { CambiarEstadoModal } from "@/components/personas/CambiarEstadoModal";
import { DetalleCompletadoModal } from "@/components/personas/DetalleCompletadoModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CrearCDATSection } from "@/components/personas/CrearCDATSection";
import { LegalizacionSection } from "@/components/personas/LegalizacionSection";
import { RetirosCDATSection } from "@/components/personas/RetirosCDATSection";
import { EstadoGeneralCDATSection } from "@/components/personas/EstadoGeneralCDATSection";
import { 
  obtenerTransaccionesPorEstadoRetiro,
  obtenerDocumento
} from "@/supabase/database";

// Helpers locales
const calcularTiempoTranscurrido = (timestamp: any): string => {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatFecha = (timestamp: any): string => {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const formatMonto = (amount: number): string =>
  `$ ${new Intl.NumberFormat('es-CO').format(amount || 0)}`;

const STATUS_MAP: Record<string, string> = {
  PENDING: "Pendiente de retiro",
  APPROVED: "Completado",
  REJECTED: "Rechazado",
};

// Mock data for Retiro de Ahorros
const mockRetiroAhorrosData = [
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", monto: "$ 10.000", entidad: "Bancolombia", fecha: "12/01/2025", estado: "Pendiente de retiro", tiempo: "24:59:32" },
  { id: "#123123214", nombre: "María José González López", documento: "987654321", monto: "$ 25.000", entidad: "Banco de Bogotá", fecha: "13/01/2025", estado: "Completado", tiempo: "-" },
  { id: "#123123215", nombre: "Carlos Eduardo Ruiz Parra", documento: "456789123", monto: "$ 50.000", entidad: "Davivienda", fecha: "14/01/2025", estado: "Rechazado", tiempo: "48:30:15" },
];

// Mock data for Ahorros (Solicitudes)
const mockAhorrosData = [
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", monto: "$ 10.000", entidad: "Bancolombia", fecha: "12/01/2025", estado: "Pendiente de retiro", tiempo: "24:59:32" },
  { id: "#123123214", nombre: "Ana María Torres Silva", documento: "456789123", monto: "$ 15.000", entidad: "BBVA", fecha: "13/01/2025", estado: "Completado", tiempo: "-" },
];

// Mock data for CDAT
const mockCDATData = [
  { id: "#123123213", nombre: "David Isaac Alcántara Avalos", documento: "123123123", inversion: "$ 10.000", fecha: "12/01/2025", estado: "Pendiente de depósito", tiempo: "24:59:32" },
  { id: "#123123214", nombre: "Laura Patricia Mendoza Cruz", documento: "789123456", inversion: "$ 50.000", fecha: "13/01/2025", estado: "Aprobado", tiempo: "-" },
];

type MainMenuType = "Solicitudes" | "Retiros" | "Crédito" | "CDAT";
type SolicitudesSubMenuType = "Ahorros" | "Créditos" | "CDAT";
type AhorrosSubMenuType = "Retiro de ahorros";
type CDATSubMenuType = "Crear CDAT" | "Legalización" | "Retiros" | "Estado general";

export default function Solicitudes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  
  // Menu state - determine based on current route
  const [activeMainMenu, setActiveMainMenu] = useState<MainMenuType>(() => {
    if (location.pathname.includes('retiro-ahorros')) return "Retiros";
    if (location.pathname.includes('/personas/cdat') || location.pathname.includes('consultar-ahorros')) return "CDAT";
    if (location.pathname.includes('credito')) return "Crédito";
    return "Solicitudes";
  });

  // Sync menu when route changes
  useEffect(() => {
    if (location.pathname.includes('retiro-ahorros')) setActiveMainMenu("Retiros");
    else if (location.pathname.includes('/personas/cdat') || location.pathname.includes('consultar-ahorros')) setActiveMainMenu("CDAT");
    else if (location.pathname.includes('credito')) setActiveMainMenu("Crédito");
    else setActiveMainMenu("Solicitudes");
  }, [location.pathname]);

  // Detect Solicitudes subsection from URL
  const solicitudesSeccion = location.search.includes('seccion=creditos') ? "Créditos"
    : location.search.includes('seccion=cdat') ? "CDAT"
    : "Ahorros"; // default
  
  const [activeSolicitudesSubMenu, setActiveSolicitudesSubMenu] = useState<SolicitudesSubMenuType>("Ahorros");
  const [activeAhorrosSubMenu, setActiveAhorrosSubMenu] = useState<AhorrosSubMenuType>("Retiro de ahorros");
  const [activeCDATSubMenu, setActiveCDATSubMenu] = useState<CDATSubMenuType>("Crear CDAT");
  
  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Solicitudes search
  const [tipoDocumento, setTipoDocumento] = useState("Identificación");
  const [numeroCedula, setNumeroCedula] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  
  // Data states
  const [retiroAhorrosData, setRetiroAhorrosData] = useState([]);
  const [retiroAhorrosEnriquecidos, setRetiroAhorrosEnriquecidos] = useState([]);
  const [solicitudesAhorrosData, setSolicitudesAhorrosData] = useState([]);
  const [solicitudesCDATData, setSolicitudesCDATData] = useState([]);
  const [loadingRetiroAhorros, setLoadingRetiroAhorros] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showPausaModal, setShowPausaModal] = useState(false);
  const [observacionesTexto, setObservacionesTexto] = useState('');

  // URL-based navigation state
  const isCrearCDAT = activeMainMenu === "CDAT" && (!location.search || location.search.includes("seccion=crear-cdat"));
  const isLegalizacion = location.search.includes("seccion=legalizacion");
  const isRetirosCDAT = location.search.includes("seccion=retiros-cdat");
  const isEstadoGeneral = location.search.includes("seccion=estado-general-cdat");
  const isRetiroAhorros = activeMainMenu === "Retiros";
  const isSolicitudes = activeMainMenu === "Solicitudes";

  // Page title logic
  const getPageTitle = () => {
    if (isCrearCDAT) return "Crear CDAT";
    if (isLegalizacion) return "Legalización CDAT";
    if (isRetirosCDAT) return "Retiros CDAT";
    if (isEstadoGeneral) return "Estado General CDAT";
    if (activeMainMenu === "Retiros") return "Retiro de Ahorros";
    if (activeMainMenu === "Crédito") return "Crédito";
    if (activeMainMenu === "CDAT") return `CDAT`;
    if (activeMainMenu === "Solicitudes") return `Solicitudes - ${solicitudesSeccion}`;
    return "Solicitudes";
  };

  // Navigation handlers
  const handleNavigateToLegalizacion = () => {
    navigate("?seccion=legalizacion");
  };

  const handleNavigateToCrearCDAT = () => {
    navigate("?seccion=crear-cdat");
  };

  const handleBackToEstadoGeneral = () => {
    navigate("?seccion=estado-general-cdat");
  };

  // Data loading functions
  const cargarRetiroAhorros = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setRefreshing(true);
    } else {
      setLoadingRetiroAhorros(true);
    }
    
    try {
      const raw = await obtenerTransaccionesPorEstadoRetiro();
      const mapped = raw.map((t: any) => ({
        id: `#${t.docId.slice(-6).toUpperCase()}`,
        docId: t.docId,
        nombre: t.userName || "",
        documento: t.userIdNumber || "",
        monto: formatMonto(t.amount),
        entidad: t.withdrawalInfo?.bankName || "",
        fecha: formatFecha(t.firebaseDate),
        estado: STATUS_MAP[t.status] || t.status,
        tiempo: t.status === "PENDING" ? calcularTiempoTranscurrido(t.firebaseDate) : "-",
        producto: t.savingtipe || "Nómina",
        telefono: t.userPhone || "",
        email: t.userEmail || "",
        numeroCuenta: t.withdrawalInfo?.accountNumber || "",
        tipoCuenta: t.withdrawalInfo?.accountType || "",
        transaccionId: t.authorization || t.docId,
      }));
      setRetiroAhorrosData(mapped);
      setRetiroAhorrosEnriquecidos(mapped);
    } catch (error) {
      console.error('Error al cargar transacciones de retiro de ahorros:', error);
    } finally {
      setLoadingRetiroAhorros(false);
      setRefreshing(false);
    }
  };

  const cargarTransaccionesSolicitudesAhorros = async () => {
    try {
      const raw = await obtenerTransaccionesPorEstadoRetiro();
      const mapped = raw.map((t: any) => ({
        id: `#${t.docId.slice(-6).toUpperCase()}`,
        docId: t.docId,
        nombre: t.userName || "",
        documento: t.userIdNumber || "",
        monto: formatMonto(t.amount),
        entidad: t.withdrawalInfo?.bankName || "",
        fecha: formatFecha(t.firebaseDate),
        estado: STATUS_MAP[t.status] || t.status,
        tiempo: t.status === "PENDING" ? calcularTiempoTranscurrido(t.firebaseDate) : "-",
        producto: t.savingtipe || "Nómina",
        telefono: t.userPhone || "",
        email: t.userEmail || "",
        numeroCuenta: t.withdrawalInfo?.accountNumber || "",
        tipoCuenta: t.withdrawalInfo?.accountType || "",
        transaccionId: t.authorization || t.docId,
      }));
      setSolicitudesAhorrosData(mapped);
    } catch (error) {
      console.error('Error al cargar solicitudes de ahorros:', error);
    }
  };

  const cargarSolicitudesCDAT = async() => {
    try {
      setSolicitudesCDATData(mockCDATData);
    } catch (error) {
      console.error('Error al cargar solicitudes CDAT:', error);
    }
  };

  // Effect to load data when menu changes
  useEffect(() => {
    if (activeMainMenu === "Retiros") {
      cargarRetiroAhorros();
    } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "Ahorros") {
      cargarTransaccionesSolicitudesAhorros();
    } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "CDAT") {
      cargarSolicitudesCDAT();
    }
    // Reset filter, search and page when switching sections
    setStatusFilter("PENDING");
    setCurrentPage(1);
    setNumeroCedula("");
    setDocumentSearch("");
  }, [activeMainMenu, activeSolicitudesSubMenu]);

  // Reset page to 1 whenever the filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Search handler
  const handleBuscar = () => {
    setDocumentSearch(numeroCedula.trim());
    setCurrentPage(1);
  };

  // Manual refresh function
  const handleRefresh = () => {
    if (activeMainMenu === "Retiros") {
      cargarRetiroAhorros(true);
    } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "Ahorros") {
      cargarTransaccionesSolicitudesAhorros();
    }
  };

  // Count functions
  const getRetiroAhorrosCounts = () => {
    const data = retiroAhorrosEnriquecidos.length > 0 ? retiroAhorrosEnriquecidos : retiroAhorrosData;
    return {
      pendiente: data.filter(item => item.estado === "Pendiente de retiro").length,
      rechazado: data.filter(item => item.estado === "Rechazado").length,
      completado: data.filter(item => item.estado === "Completado").length
    };
  };

  const { pendiente: pendienteCount, rechazado: rechazadoCount, completado: completadoCount } = getRetiroAhorrosCounts();

  // Modal handlers
  const handleEstadoChange = (transaction) => {
    setSelectedTransaction(transaction);
    setShowEstadoModal(true);
  };

  const handleVerDetalle = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetalleModal(true);
  };

  const handleObservaciones = (transaction) => {
    setSelectedTransaction(transaction);
    setObservacionesTexto(transaction.observations || '');
    setShowObservacionesModal(true);
  };

  // Filter data based on current status filter and active section
  const getFilteredData = () => {
    let data;
    if (isSolicitudes) {
      if (solicitudesSeccion === "Créditos") return [];
      if (solicitudesSeccion === "CDAT") return mockCDATData;
      data = solicitudesAhorrosData;
    } else {
      // Retiros
      data = retiroAhorrosEnriquecidos.length > 0 ? retiroAhorrosEnriquecidos : retiroAhorrosData;
    }
    if (statusFilter !== "ALL") {
      const statusMap: Record<string, string> = {
        "PENDING": "Pendiente de retiro",
        "COMPLETED": "Completado",
        "REJECTED": "Rechazado"
      };
      data = data.filter((item: any) => item.estado === statusMap[statusFilter]);
    }
    if (documentSearch) {
      const q = documentSearch.toLowerCase();
      data = data.filter((item: any) =>
        (item.documento || "").toLowerCase().includes(q) ||
        (item.nombre || "").toLowerCase().includes(q)
      );
    }
    return data;
  };

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <MainLayout sidebarType="credito" pageTitle={getPageTitle()}>
      <div className="space-y-6">
        {/* CDAT Sections */}
        {isLegalizacion ? (
          <LegalizacionSection />
        ) : isRetirosCDAT ? (
          <RetirosCDATSection />
        ) : isEstadoGeneral ? (
          <EstadoGeneralCDATSection />
        ) : isCrearCDAT ? (
          <CrearCDATSection onNavigateToLegalizacion={handleNavigateToLegalizacion} />
        ) : (
          <>
            {/* ── SOLICITUDES VIEW ── */}
            {isSolicitudes && (
              <>
                {/* Search bar */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Tipo de documento</span>
                    <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Identificación">Identificación</SelectItem>
                        <SelectItem value="Cédula de extranjería">Cédula de extranjería</SelectItem>
                        <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Número de cédula</span>
                    <Input
                      placeholder="Escribe el número de cédula o nombre"
                      value={numeroCedula}
                      onChange={(e) => { setNumeroCedula(e.target.value); if (!e.target.value.trim()) setDocumentSearch(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                      className="w-72"
                    />
                  </div>
                  <Button onClick={handleBuscar} className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                    Buscar
                  </Button>
                </div>

                {/* Table */}
                <div className="bg-card rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">Solicitudes</h3>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 h-8 text-sm border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="PENDING">Pendiente</SelectItem>
                        <SelectItem value="COMPLETED">Completado</SelectItem>
                        <SelectItem value="REJECTED">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nombres y Apellidos</TableHead>
                        <TableHead>Numero de documento</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Entidad bancaria</TableHead>
                        <TableHead>Fecha de solicitud</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Tiempo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.id}</TableCell>
                          <TableCell>{item.nombre}</TableCell>
                          <TableCell>{item.documento}</TableCell>
                          <TableCell>{item.monto}</TableCell>
                          <TableCell>{item.entidad}</TableCell>
                          <TableCell>{item.fecha}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              item.estado === "Completado" && "bg-green-100 text-green-700",
                              item.estado === "Pendiente de retiro" && "bg-yellow-100 text-yellow-700",
                              item.estado === "Rechazado" && "bg-red-100 text-red-700"
                            )}>
                              {item.estado}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.estado !== "Completado" ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                {item.tiempo}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 px-6 py-4 border-t border-border">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        ‹
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-lg text-sm",
                            currentPage === page
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {page}
                        </button>
                      ))}
                      {totalPages > 5 && (
                        <><span className="text-muted-foreground px-1">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted"
                        >
                          {totalPages}
                        </button></>
                      )}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── RETIRO DE AHORROS VIEW ── */}
            {isRetiroAhorros && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-card rounded-xl p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-muted-foreground mb-2">Pendiente de retiro</p>
                    <p className="text-4xl font-bold text-foreground">{pendienteCount}</p>
                  </div>
                  <div className="bg-card rounded-xl p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-muted-foreground mb-2">Rechazado</p>
                    <p className="text-4xl font-bold text-foreground">{rechazadoCount}</p>
                  </div>
                  <div className="bg-card rounded-xl p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-muted-foreground mb-2">Completado</p>
                    <p className="text-4xl font-bold text-foreground">{completadoCount}</p>
                  </div>
                </div>

                {/* Search bar */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Tipo de documento</span>
                    <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Identificación">Identificación</SelectItem>
                        <SelectItem value="Cédula de extranjería">Cédula de extranjería</SelectItem>
                        <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Número de cédula</span>
                    <Input
                      placeholder="Escribe el número de cédula"
                      value={numeroCedula}
                      onChange={(e) => { setNumeroCedula(e.target.value); if (!e.target.value.trim()) setDocumentSearch(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                      className="w-72"
                    />
                  </div>
                  <Button onClick={handleBuscar} className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                    Buscar
                  </Button>
                </div>

                {/* Table */}
                <div className="bg-card rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">Retiros</h3>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 h-8 text-sm border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="PENDING">Pendiente</SelectItem>
                        <SelectItem value="COMPLETED">Completado</SelectItem>
                        <SelectItem value="REJECTED">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nombres y Apellidos</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Número de documento</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Entidad bancaria</TableHead>
                        <TableHead>Fecha de solicitud</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Tiempo</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.id}</TableCell>
                          <TableCell>{item.nombre}</TableCell>
                          <TableCell>{item.producto || "Nómina"}</TableCell>
                          <TableCell>{item.documento}</TableCell>
                          <TableCell>{item.monto}</TableCell>
                          <TableCell>{item.entidad}</TableCell>
                          <TableCell>{item.fecha}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              item.estado === "Completado" && "bg-green-100 text-green-700",
                              item.estado === "Pendiente de retiro" && "bg-yellow-100 text-yellow-700",
                              item.estado === "Rechazado" && "bg-red-100 text-red-700"
                            )}>
                              {item.estado}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.estado !== "Completado" ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                {item.tiempo}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.estado === "Pendiente de retiro" ? (
                              <button
                                onClick={() => handleEstadoChange(item)}
                                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70"
                                title="Cambiar estado"
                              >
                                <Settings className="h-4 w-4 text-muted-foreground" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVerDetalle(item)}
                                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70"
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 px-6 py-4 border-t border-border">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        ‹
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-lg text-sm",
                            currentPage === page
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {page}
                        </button>
                      ))}
                      {totalPages > 5 && (
                        <>
                          <span className="text-muted-foreground px-1">...</span>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Modals */}
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

        {/* Observaciones Modal */}
        <Dialog open={showObservacionesModal} onOpenChange={setShowObservacionesModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Observaciones</DialogTitle>
              <DialogDescription>
                Observaciones para la transacción {selectedTransaction?.id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="observaciones">Observaciones:</Label>
                <textarea
                  id="observaciones"
                  className="w-full mt-1 p-2 border rounded-md min-h-[100px]"
                  value={observacionesTexto}
                  onChange={(e) => setObservacionesTexto(e.target.value)}
                  placeholder="Ingrese las observaciones..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowObservacionesModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  // Save observations logic here
                  setShowObservacionesModal(false);
                }}>
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pausa Modal */}
        <Dialog open={showPausaModal} onOpenChange={setShowPausaModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Función en Pausa</DialogTitle>
              <DialogDescription>
                Esta funcionalidad se encuentra temporalmente pausada.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 p-4 bg-orange-50 rounded-lg border-l-4 border-orange-300">
              <p className="text-sm text-orange-800">
                <strong>¿Necesitas asistencia?</strong> Contacta al administrador del sistema para obtener más información o soporte técnico.
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowPausaModal(false)} className="bg-primary hover:bg-primary/90">
                Entendido
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}