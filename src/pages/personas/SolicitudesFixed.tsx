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
  actualizarObservacionTransaccion
} from "@/supabase/database";
import { supabase } from "@/supabase/config";

// Helpers locales
// Duración calculada a partir de timestamps de la base de datos. No usa
// intervalos: se recalcula solo al cargar o refrescar la tabla.
const calcularDuracion = (inicio: any, fin?: any): string => {
  if (!inicio) return "-";
  const start = inicio?.toDate ? inicio.toDate().getTime() : new Date(inicio).getTime();
  if (!Number.isFinite(start)) return "-";

  let end: number;
  if (fin) {
    end = fin?.toDate ? fin.toDate().getTime() : new Date(fin).getTime();
    if (!Number.isFinite(end)) return "-";
  } else {
    // Sin fecha de cierre (solicitud pendiente): foto del tiempo transcurrido
    // al momento de cargar la tabla.
    end = Date.now();
  }

  const diff = Math.max(0, end - start);
  const totalHoras = Math.floor(diff / 3600000);
  const dias = Math.floor(totalHoras / 24);
  const h = totalHoras % 24;
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const reloj = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return dias > 0 ? `${dias}d ${reloj}` : reloj;
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

// Normaliza una fila de `transactions` a la forma que consumen la tabla y los modales.
// Lee columnas snake_case reales de Supabase y expone los alias que espera la UI.
const mapTransaccionRetiro = (t: any) => {
  const withdrawal = t.withdrawal_info ?? {};
  const banco = withdrawal.bankName || t.bank || "";
  const fechaCierre = t.confirmation_date ?? t.last_updated ?? t.updated_at;

  return {
    id: `#${String(t.docId).slice(-6).toUpperCase()}`,
    docId: t.docId,
    nombre: t.user_name || "",
    documento: t.user_id_number || "",
    monto: formatMonto(Number(t.amount) || 0),
    montoRaw: Number(t.amount) || 0,
    entidad: banco,
    banco,
    fecha: formatFecha(t.firebase_date),
    fechaSolicitud: formatFecha(t.firebase_date),
    fechaTransaccion: t.firebase_date,
    fechaPago: t.confirmation_date ? formatFecha(t.confirmation_date) : "",
    estado: STATUS_MAP[t.status] || t.status,
    // Pendiente: tiempo transcurrido desde la fecha de solicitud (foto al cargar).
    // Rechazado: duración hasta la última actualización registrada en la BD.
    // Completado: no aplica.
    tiempo: t.status === "PENDING"
      ? calcularDuracion(t.firebase_date)
      : t.status === "REJECTED"
        ? calcularDuracion(t.firebase_date, fechaCierre)
        : "-",
    producto: t.savingtipe || "",
    telefono: t.user_phone || "",
    email: t.user_email || "",
    numeroCuenta: withdrawal.accountNumber || "",
    tipoCuenta: withdrawal.accountType || "",
    canalPago: t.chanel_pay || "",
    observaciones: t.observation || "",
    transaccionId: t.authorization_ref || t.docId,
  };
};

type MainMenuType = "Solicitudes" | "Retiros" | "Crédito" | "CDAT";
type SolicitudesSubMenuType = "Ahorros" | "Créditos" | "CDAT";

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
  
  const [activeSolicitudesSubMenu, setActiveSolicitudesSubMenu] = useState<SolicitudesSubMenuType>(solicitudesSeccion);

  // Keep the submenu state aligned with the URL (?seccion=ahorros|creditos|cdat)
  useEffect(() => {
    setActiveSolicitudesSubMenu(solicitudesSeccion);
  }, [solicitudesSeccion]);
  
  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Solicitudes search
  const [numeroCedula, setNumeroCedula] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  
  // Data states
  const [retiroAhorrosData, setRetiroAhorrosData] = useState([]);
  const [retiroAhorrosEnriquecidos, setRetiroAhorrosEnriquecidos] = useState([]);
  const [solicitudesAhorrosData, setSolicitudesAhorrosData] = useState([]);
  const [solicitudesCDATData, setSolicitudesCDATData] = useState([]);
  const [solicitudesCreditosData, setSolicitudesCreditosData] = useState([]);
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
  const isCDATView = isSolicitudes && solicitudesSeccion === "CDAT";

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
      const mapped = raw.map(mapTransaccionRetiro);
      setRetiroAhorrosData(mapped);
      setRetiroAhorrosEnriquecidos(mapped);
    } catch (error) {
      console.error("Error al cargar transacciones de retiro de ahorros");
    } finally {
      setLoadingRetiroAhorros(false);
      setRefreshing(false);
    }
  };

  const cargarTransaccionesSolicitudesAhorros = async () => {
    try {
      const raw = await obtenerTransaccionesPorEstadoRetiro();
      const mapped = raw.map(mapTransaccionRetiro);
      setSolicitudesAhorrosData(mapped);
    } catch (error) {
      console.error("Error al cargar solicitudes de ahorros");
    }
  };

  const cargarSolicitudesCDAT = async () => {
    try {
      const { data, error } = await supabase
        .from('cdats')
        .select('id,id_cdat,idusuario,inversion,ea,tiempo,rendimiento,fecha_apertura,fecha_finalizacion,estado,nombreusuario,documentousuario,created_at');

      if (error) throw error;

      const mapped = (data ?? []).map((c: any) => ({
        id: `#${String(c.id_cdat ?? c.id).slice(-6).toUpperCase()}`,
        docId: c.id,
        nombre: c.nombreusuario || "",
        documento: c.documentousuario || "",
        inversion: formatMonto(Number(c.inversion) || 0),
        monto: formatMonto(Number(c.inversion) || 0),
        entidad: "",
        fecha: formatFecha(c.fecha_apertura ?? c.created_at),
        estado: c.estado || "",
        tiempo: c.tiempo ? `${c.tiempo} meses` : "-",
      }));

      setSolicitudesCDATData(mapped);
    } catch (error) {
      console.error("Error al cargar solicitudes CDAT");
      setSolicitudesCDATData([]);
    }
  };

  const cargarSolicitudesCreditos = async () => {
    try {
      const { data, error } = await supabase
        .from('credito_solicitado_empresa')
        .select('id,id_field,nombre,documento,fecha_solicitud,empresa,estado,tipodecredito,monto_solicitud,created_at');

      if (error) throw error;

      const mapped = (data ?? []).map((c: any) => {
        const fechaSolicitud = c.fecha_solicitud ?? c.created_at;
        return {
          id: `#${String(c.id_field ?? c.id).slice(-6).toUpperCase()}`,
          docId: c.id,
          nombre: c.nombre || "",
          documento: c.documento || "",
          monto: formatMonto(Number(c.monto_solicitud) || 0),
          entidad: c.empresa || "",
          fecha: formatFecha(fechaSolicitud),
          estado: c.estado || "",
          fechaTransaccion: fechaSolicitud,
          tiempo: calcularDuracion(fechaSolicitud),
          producto: c.tipodecredito || "",
        };
      });

      setSolicitudesCreditosData(mapped);
    } catch (error) {
      console.error("Error al cargar solicitudes de crédito");
      setSolicitudesCreditosData([]);
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
    } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "Créditos") {
      cargarSolicitudesCreditos();
    }
    // Reset filter, search and page when switching sections
    // CDAT y Créditos no usan estados de retiro, así que arrancan sin filtro.
    const nextFilter = activeMainMenu === "Solicitudes" &&
      (activeSolicitudesSubMenu === "CDAT" || activeSolicitudesSubMenu === "Créditos")
      ? "ALL"
      : "PENDING";
    setStatusFilter(nextFilter);
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
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeMainMenu === "Retiros") {
        await cargarRetiroAhorros();
      } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "Ahorros") {
        await cargarTransaccionesSolicitudesAhorros();
      } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "CDAT") {
        await cargarSolicitudesCDAT();
      } else if (activeMainMenu === "Solicitudes" && activeSolicitudesSubMenu === "Créditos") {
        await cargarSolicitudesCreditos();
      }
    } finally {
      setRefreshing(false);
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
    setObservacionesTexto(transaction.observaciones || '');
    setShowObservacionesModal(true);
  };

  const handleGuardarObservaciones = async () => {
    if (!selectedTransaction?.docId) return;
    try {
      await actualizarObservacionTransaccion(selectedTransaction.docId, observacionesTexto);
      setShowObservacionesModal(false);
      await handleRefresh();
    } catch (error) {
      console.error("Error al guardar observaciones");
    }
  };

  // Filter data based on current status filter and active section
  const matchesStatusFilter = (estado: string) => {
    if (statusFilter === "ALL") return true;
    const value = (estado || "").toLowerCase();
    if (statusFilter === "PENDING") return value.includes("pendiente") || value.includes("inicio");
    if (statusFilter === "COMPLETED") {
      return value.includes("complet") || value.includes("aprob") ||
        value.includes("activo") || value.includes("finaliz");
    }
    if (statusFilter === "REJECTED") {
      return value.includes("rechaz") || value.includes("eliminad");
    }
    return true;
  };

  const estadoBadgeClass = (estado: string) => {
    const value = (estado || "").toLowerCase();
    if (value.includes("complet") || value.includes("aprob") || value === "activo") {
      return "bg-green-100 text-green-700";
    }
    if (value.includes("pendiente")) return "bg-yellow-100 text-yellow-700";
    if (value.includes("rechaz") || value.includes("eliminad")) return "bg-red-100 text-red-700";
    if (value.includes("finaliz")) return "bg-gray-100 text-gray-700";
    return "bg-muted text-muted-foreground";
  };

  const getFilteredData = () => {
    let data: any[];
    if (isSolicitudes) {
      if (solicitudesSeccion === "Créditos") {
        data = solicitudesCreditosData;
      } else if (solicitudesSeccion === "CDAT") {
        data = solicitudesCDATData;
      } else {
        data = solicitudesAhorrosData;
      }
    } else {
      // Retiros
      data = retiroAhorrosEnriquecidos.length > 0 ? retiroAhorrosEnriquecidos : retiroAhorrosData;
    }
    data = data.filter((item: any) => matchesStatusFilter(item.estado));
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
                    <div className="flex items-center gap-2">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        title="Actualizar"
                      >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nombres y Apellidos</TableHead>
                        <TableHead>Numero de documento</TableHead>
                        <TableHead>{isCDATView ? "Inversión" : "Monto"}</TableHead>
                        {!isCDATView && (
                          <TableHead>
                            {solicitudesSeccion === "Créditos" ? "Empresa" : "Entidad bancaria"}
                          </TableHead>
                        )}
                        <TableHead>Fecha de solicitud</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>{isCDATView ? "Plazo" : "Tiempo"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item, index) => (
                        <TableRow key={item.docId || index}>
                          <TableCell className="font-medium">{item.id}</TableCell>
                          <TableCell>{item.nombre}</TableCell>
                          <TableCell>{item.documento}</TableCell>
                          <TableCell>{isCDATView ? item.inversion : item.monto}</TableCell>
                          {!isCDATView && <TableCell>{item.entidad}</TableCell>}
                          <TableCell>{item.fecha}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              estadoBadgeClass(item.estado)
                            )}>
                              {item.estado}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{item.tiempo}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={isCDATView ? 7 : 8}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No hay registros para mostrar
                          </TableCell>
                        </TableRow>
                      )}
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
                    <div className="flex items-center gap-2">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        title="Actualizar"
                      >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      </Button>
                    </div>
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
                        <TableRow key={item.docId || index}>
                          <TableCell className="font-medium">{item.id}</TableCell>
                          <TableCell>{item.nombre}</TableCell>
                          <TableCell>{item.producto || "-"}</TableCell>
                          <TableCell>{item.documento}</TableCell>
                          <TableCell>{item.monto}</TableCell>
                          <TableCell>{item.entidad}</TableCell>
                          <TableCell>{item.fecha}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              estadoBadgeClass(item.estado)
                            )}>
                              {item.estado}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{item.tiempo}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
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
                              <button
                                onClick={() => handleObservaciones(item)}
                                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70"
                                title="Observaciones"
                              >
                                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                            {loadingRetiroAhorros ? "Cargando..." : "No hay registros para mostrar"}
                          </TableCell>
                        </TableRow>
                      )}
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
                <Button onClick={handleGuardarObservaciones}>
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