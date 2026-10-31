import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserInfoModal } from "@/components/personas/UserInfoModal";
import { NovedadSaldoModal } from "@/components/personas/NovedadSaldoModal";
import { CDATSection } from "@/components/personas/CDATSection";
import { VehiculosSection } from "@/components/personas/VehiculosSection";
import { HistorialSection } from "@/components/personas/HistorialSection";
import { CDATDetailModal } from "@/components/personas/CDATDetailModal";
import { buscarUsuarioPor, obtenerEmpresaPorRef, obtenerAhorrosPorUsuario, calcularTotalAhorrado, obtenerCdatsPorUsuario, calcularTotalDepositosAhorro, obtenerTransaccionesAhorro, obtenerMovimientosCdat } from "@/supabase/database";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { User, Phone, Mail, Building2, ArrowRight, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wallet, Eye } from "lucide-react";
import { supabase } from "@/supabase/config";

const tabs = [
  "Ahorro",
  "Crédito", 
  "CDAT",
  "Documentos",
  "Comentarios",
  "Vehículos",
  "Historial",
  "Información adicional",
];

const savingsSubTabs = ["Ahorro de nómina", "Ahorro permanente", "Ahorro con propósito"];

interface Movimiento {
  id: number;
  fecha: string;
  monto: string;
  tipo: "Depositado" | "Debitado";
  estado: string;
  banco: string;
  // Details for Depositado
  idAutorizacion?: string;
  detalle?: string;
  // Details for Debitado
  estadoMovimiento?: string;
  tipoMovimiento?: string;
  tipoCuenta?: string;
  nombreApellido?: string;
  idTransaccion?: string;
  numeroCuenta?: string;
  fechaPagoRetiro?: string;
  observaciones?: string;
}

const movimientos: Movimiento[] = [
  { 
    id: 1,
    fecha: "18/12/2025", 
    monto: "$ 1.000", 
    tipo: "Depositado", 
    estado: "Completado", 
    banco: "Transferencia interna",
    idAutorizacion: "3476474",
    detalle: "test"
  },
  { 
    id: 2,
    fecha: "18/12/2025", 
    monto: "-$ 1.073.367", 
    tipo: "Debitado", 
    estado: "Fallido", 
    banco: "BANCO DAVIVIENDA",
    estadoMovimiento: "Rechazado",
    tipoMovimiento: "Retiro",
    tipoCuenta: "Cuenta de ahorros",
    nombreApellido: "Montaño Jhonatan",
    idTransaccion: "5749662",
    numeroCuenta: "123451",
    fechaPagoRetiro: "18/12/2025",
    observaciones: "test"
  },
  { id: 3, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "1234567", detalle: "Depósito normal" },
  { id: 4, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Rechazado", banco: "Banco Davivienda", idAutorizacion: "2345678", detalle: "Error en cuenta" },
  { id: 5, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "3456789", detalle: "Completado" },
  { id: 6, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "4567890", detalle: "Ok" },
  { id: 7, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "5678901", detalle: "Procesado" },
  { id: 8, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "6789012", detalle: "Exitoso" },
  { id: 9, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "7890123", detalle: "Aprobado" },
  { id: 10, fecha: "12/09/2024  11:11", monto: "$ -664.950", tipo: "Depositado", estado: "Exitoso", banco: "Banco Davivienda", idAutorizacion: "8901234", detalle: "Ok" },
];

export default function ConsultarUsuarioDetalle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const initialData = location.state || {};

  const [searchType, setSearchType] = useState(initialData.searchType || 'Cédula');
  const [searchValue, setSearchValue] = useState(initialData.searchValue || '');
  const [isSearching, setIsSearching] = useState(false);
  const [userData, setUserData] = useState(initialData.userData || null);
  const [empresaData, setEmpresaData] = useState(initialData.empresaData || null);
  const [ahorrosData, setAhorrosData] = useState([]);
  const [totalAhorrado, setTotalAhorrado] = useState(0);
  const [totalBeneficios, setTotalBeneficios] = useState(0);
  const [totalRetirado, setTotalRetirado] = useState(0);
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [cdatsData, setCdatsData] = useState([]);
  const [totalCdatInversion, setTotalCdatInversion] = useState(0);
  const [totalCdatGanancias, setTotalCdatGanancias] = useState(0);

  useEffect(() => {
    if (!initialData.userData) {
      navigate('/personas/consultar');
    }
  }, [initialData.userData, navigate]);

  // Cargar datos de ahorro y CDAT cuando se carga el componente con datos iniciales
  useEffect(() => {
    if (initialData.userData?.uid && ahorrosData.length === 0) {
      cargarDatosAhorro(initialData.userData.uid);
      cargarDatosCdat(initialData.userData.uid);
    }
  }, [initialData.userData, ahorrosData]);

  const formatAmount = (amount) => {
    if (!amount || isNaN(amount)) return '$ 0';
    
    // Redondear hacia arriba (equivalente a ceil)
    const rounded = Math.ceil(Number(amount));
    
    // Convertir a string
    const amountStr = rounded.toString();
    let result = '';
    let count = 0;
    
    // Agregar separadores de miles con punto
    for (let i = amountStr.length - 1; i >= 0; i--) {
      result = amountStr[i] + result;
      count++;
      if (count % 3 === 0 && i !== 0) {
        result = '.' + result;
      }
    }
    
    return '$ ' + result;
  };

  const handleBuscar = async () => {
    try {
      const valor = searchValue.trim();
      setIsSearching(true);
      if (!valor || !searchType) {
        toast({ title: "Error", description: "Complete todos los campos", variant: "destructive" });
        return;
      }

      let campo;
      if (searchType === 'Email') campo = 'email';
      else if (searchType === 'Celular') campo = 'phone_number';
      else if (searchType === 'Cédula') campo = 'nit';

      if (!campo) {
        toast({ title: "Error", description: "Tipo de búsqueda no válido", variant: "destructive" });
        return;
      }

      const usuario = await buscarUsuarioPor(campo, valor);
      
      if (usuario) {
        let empresa = null;
        if (usuario.empresa) {
          empresa = await obtenerEmpresaPorRef(usuario.empresa);
        }
        setUserData(usuario);
        setEmpresaData(empresa);
        setSearchValue(valor);
        
        // Cargar datos de ahorro
        if (usuario.uid) {
          await cargarDatosAhorro(usuario.uid);
          await cargarDatosCdat(usuario.uid);
        }
        
        toast({ title: "Éxito", description: "Usuario encontrado" });
      } else {
        toast({ title: "Error", description: "Usuario no encontrado", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo completar la búsqueda",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getPlaceholder = () => {
    if (searchType === 'Email') return 'Escribe el email';
    if (searchType === 'Celular') return 'Escribe el número de celular';
    if (searchType === 'Cédula') return 'Escribe el número de cédula';
  };

  const getLabel = () => {
    if (searchType === 'Email') return 'Ingrese el email';
    if (searchType === 'Celular') return 'Ingrese el celular';
    if (searchType === 'Cédula') return 'Ingrese el número de cédula';
  };

  const [activeTab, setActiveTab] = useState("Ahorro");
  const [activeSavingsTab, setActiveSavingsTab] = useState("");
  const [ahorroSeleccionado, setAhorroSeleccionado] = useState(null);
  const [totalAhorradoCalculado, setTotalAhorradoCalculado] = useState(0);
  const [calculandoTotal, setCalculandoTotal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2025); // 📅 Estado para selector de año
  const [otpCode, setOtpCode] = useState(["1", "4", "2", "7", "6", "6"]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showNovedadModal, setShowNovedadModal] = useState(false);
  const [showPausaModal, setShowPausaModal] = useState(false);
  const [expandedMovimientos, setExpandedMovimientos] = useState<string[]>([]);

  // Estados para movimientos
  const [transacciones, setTransacciones] = useState([]);
  const [cargandoTransacciones, setCargandoTransacciones] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [transaccionExpandida, setTransaccionExpandida] = useState(null);
  const [filtroAccion, setFiltroAccion] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const transaccionesPorPagina = 10;

  // 📅 Funciones para selector de año
  const cambiarYear = (incremento) => {
    const nuevoYear = selectedYear + incremento;
    if (nuevoYear >= 2024 && nuevoYear <= 2030) {
      setSelectedYear(nuevoYear);
    }
  };

  // Estados para CDAT (solo los nuevos, cdatsData ya existe)
  const [cdatSeleccionado, setCdatSeleccionado] = useState(null);
  const [cargandoCdats, setCargandoCdats] = useState(false);
  const [filtroCdatEstado, setFiltroCdatEstado] = useState('todos'); // 'todos', 'activos', 'finalizados'
  const [movimientosCdat, setMovimientosCdat] = useState([]);
  const [movimientoCdatExpandido, setMovimientoCdatExpandido] = useState(null);
  const [showCdatDetailModal, setShowCdatDetailModal] = useState(false);
  const [selectedCdatForModal, setSelectedCdatForModal] = useState(null);

  // Establecer el primer tab de ahorros automáticamente
  useEffect(() => {
    if (ahorrosData && ahorrosData.length > 0 && !activeSavingsTab) {
      setActiveSavingsTab(ahorrosData[0].SavingsType);
    }
  }, [ahorrosData, activeSavingsTab]);

  // Seleccionar primer ahorro por defecto
  useEffect(() => {
    if (ahorrosData && ahorrosData.length > 0 && !ahorroSeleccionado) {
      setAhorroSeleccionado(ahorrosData[0]);
    }
  }, [ahorrosData, ahorroSeleccionado]);

  // 🔄 MODIFICADO: Calcular total ahorrado filtrado por año del ahorro seleccionado
  useEffect(() => {
    const calcularTotal = async () => {
      if (!ahorroSeleccionado) {
        setTotalAhorradoCalculado(0);
        return;
      }
      
      setCalculandoTotal(true);
      try {
        // Obtener rango de fechas según año seleccionado
        const { fechaInicio, fechaFin } = obtenerRangoFechas();
        
        // Calcular depósitos filtrados por fecha
        const total = await calcularDepositosPorFecha(ahorroSeleccionado.id, fechaInicio, fechaFin);
        setTotalAhorradoCalculado(total);
      } catch (error) {
        console.error("Error al calcular total");
        setTotalAhorradoCalculado(0);
      } finally {
        setCalculandoTotal(false);
      }
    };
    
    calcularTotal();
  }, [ahorroSeleccionado, selectedYear]); // 👈 Agregado selectedYear como dependencia

  // 🆕 Calcular total retirado filtrado por año
  useEffect(() => {
    const calcularRetirado = async () => {
      if (!userData?.uid) {
        setTotalRetirado(0);
        return;
      }
      
      try {
        const total = await calcularTotalRetirado(userData.uid, selectedYear);
        setTotalRetirado(total);
      } catch (error) {
        console.error("Error al calcular total retirado");
        setTotalRetirado(0);
      }
    };
    
    calcularRetirado();
  }, [userData?.uid, selectedYear]); // Recalcular cuando cambie el usuario o el año

  // Cargar transacciones cuando cambia el ahorro seleccionado
  useEffect(() => {
    const cargarTransacciones = async () => {
      if (!ahorroSeleccionado) {
        setTransacciones([]);
        return;
      }
      
      setCargandoTransacciones(true);
      try {
        const trans = await obtenerTransaccionesAhorro(ahorroSeleccionado.id);
        setTransacciones(trans);
        setPaginaActual(1); // Reset a página 1
      } catch (error) {
        console.error("Error al cargar transacciones");
        setTransacciones([]);
      } finally {
        setCargandoTransacciones(false);
      }
    };
    
    cargarTransacciones();
  }, [ahorroSeleccionado]);

  // 🆕 Recargar datos cuando cambia el año seleccionado
  useEffect(() => {
    if (userData?.uid) {
      cargarDatosAhorro(userData.uid);
    }
  }, [selectedYear]);

  const handleViewDetails = () => {
    setShowUserModal(true);
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      let date;
      
      // Si trae un método toDate (timestamp heredado)
      if (dateValue && dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      }
      // Si es un timestamp (número)
      else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      }
      // Si es un string
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      }
      // Si ya es un objeto Date
      else if (dateValue instanceof Date) {
        date = dateValue;
      }
      else {
        return 'N/A';
      }
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      return date.toLocaleDateString('es-CO');
    } catch (error) {
      console.error("Error al formatear fecha");
      return 'N/A';
    }
  };

  const formatearFechaTransaccion = (fechaTransaccion) => {
    if (!fechaTransaccion) return '';
    const fecha = fechaTransaccion.toDate ? fechaTransaccion.toDate() : new Date(fechaTransaccion);
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = value?.toDate ? value.toDate() : new Date(value);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('es-CO');
  };

  // Filtrar transacciones del mes actual (solo para info en badge)
  const transaccionesEsteMes = useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const añoActual = ahora.getFullYear();
    
    return transacciones.filter(t => {
      if (!t.firebase_date) return false;
      const fecha = t.firebase_date.toDate ? t.firebase_date.toDate() : new Date(t.firebase_date);
      return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    });
  }, [transacciones]);

  // Filtrar transacciones según los dropdowns
  const transaccionesFiltradas = useMemo(() => {
    return transacciones.filter(transaccion => {
      // Filtro por acción
      if (filtroAccion !== "todos") {
        if (filtroAccion === "deposito") {
          // Incluir tanto "Depositado" como transacciones PSE y otros tipos de depósito
          if (transaccion.transactionType !== "Depositado" && 
              transaccion.transactionType !== "PSE" && 
              transaccion.transactionType !== "Deposit") return false;
        }
        if (filtroAccion === "retiro" && transaccion.transactionType !== "Withdrawal") return false;
      }
      
      // Filtro por estado
      if (filtroEstado !== "todos") {
        if (filtroEstado === "exitoso" && transaccion.status !== "APPROVED") return false;
        if (filtroEstado === "rechazado" && transaccion.status !== "REJECTED") return false;
        if (filtroEstado === "pendiente" && transaccion.status !== "PENDING") return false;
      }
      
      return true;
    });
  }, [transacciones, filtroAccion, filtroEstado]);

  // Resetear paginación cuando cambien los filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroAccion, filtroEstado]);

  // useEffect para cargar cuando se selecciona el tab CDAT
  useEffect(() => {
    if (activeTab === 'CDAT' && cdatsData.length === 0) {
      cargarCdats();
    }
  }, [activeTab]);

  // Paginación sobre transacciones FILTRADAS
  const indexInicio = (paginaActual - 1) * transaccionesPorPagina;
  const indexFin = indexInicio + transaccionesPorPagina;
  const transaccionesPaginaActual = transaccionesFiltradas.slice(indexInicio, indexFin);
  const totalPaginas = Math.ceil(transaccionesFiltradas.length / transaccionesPorPagina);

  // 🔄 MODIFICADA: Función calcularBeneficiosAhorro para filtrar por fechas
  const calcularBeneficiosAhorro = (ahorro) => {
    if (!ahorro?.transactions || !Array.isArray(ahorro.transactions)) return 0;
    
    // Obtener rango de fechas según año seleccionado
    const { fechaInicio, fechaFin } = obtenerRangoFechas();
    
    return ahorro.transactions.reduce((total, t) => {
      // Parsear fecha de la transacción
      let fechaTransaccion = null;
      
      if (t.date) {
        if (t.date.toDate && typeof t.date.toDate === 'function') {
          fechaTransaccion = t.date.toDate();
        } else if (t.date instanceof Date) {
          fechaTransaccion = t.date;
        } else if (typeof t.date === 'string') {
          fechaTransaccion = new Date(t.date);
        }
      }
      
      // Verificar si está en el rango de fechas
      const dentroDelRango = fechaTransaccion && 
                            fechaTransaccion >= fechaInicio && 
                            fechaTransaccion <= fechaFin;
      
      // Solo sumar si está dentro del rango
      if (dentroDelRango) {
        return total + (Number(t.fullBenefit) || 0);
      }
      
      return total;
    }, 0);
  };

  const toggleMovimiento = (id: number) => {
    const idStr = String(id);
    setExpandedMovimientos(prev => 
      prev.includes(idStr) ? prev.filter(i => i !== idStr) : [...prev, idStr]
    );
  };

  // 🆕 Función para calcular total retirado con filtro de año
  const calcularTotalRetirado = async (userUID, selectedYear) => {
    try {
      const startTime = Date.now();

      // 1. Obtener todas las cuentas de ahorro del usuario (SIN FILTROS)
      const ahorros = await obtenerAhorrosPorUsuario(userUID);
      if (!ahorros || ahorros.length === 0) {
        return 0;
      }

      
      // 2. Obtener IDs de todas las cuentas
      const ahorrosIds = ahorros.map(ahorro => ahorro.id);
      
      // 3. Obtener rango de fechas según año seleccionado
      let fechaInicio, fechaFin;
      if (selectedYear === 2025) {
        fechaInicio = new Date('2024-01-01T00:00:00.000Z');
        fechaFin = new Date('2025-12-31T23:59:59.999Z');
      } else if (selectedYear === 2026) {
        fechaInicio = new Date('2026-01-01T00:00:00.000Z');
        fechaFin = new Date('2026-12-31T23:59:59.999Z');
      } else {
        // Fallback: todos los datos
        fechaInicio = new Date('2020-01-01T00:00:00.000Z');
        fechaFin = new Date('2030-12-31T23:59:59.999Z');
      }


      let totalRetirado = 0;
      
      // 4. Procesar en chunks de 10 para mantener las consultas pequeñas
      const chunkSize = 10;
      for (let i = 0; i < ahorrosIds.length; i += chunkSize) {
        const chunk = ahorrosIds.slice(i, i + chunkSize);

        try {
          // Consultar transacciones de retiro CON FILTRO DE FECHA
          const { data: retiros, error } = await supabase
            .from('transactions')
            .select('amount')
            .in('ahorros_id', chunk)
            .eq('transaction_type', 'Withdrawal')
            .in('status', ['APPROVED', 'PENDING'])
            .gte('firebase_date', fechaInicio.toISOString())
            .lte('firebase_date', fechaFin.toISOString());

          if (error) throw error;

          totalRetirado += (retiros ?? []).reduce(
            (sum, row: any) => sum + (Number(row.amount) || 0),
            0
          );

        } catch (error) {
          console.warn("Error en chunk");
        }
      }

      const duration = Date.now() - startTime;

      return totalRetirado;
    } catch (error) {
      console.error("❌ Error calculando total retirado");
      return 0;
    }
  };

  // 🆕 Función genérica para calcular total del primer enero de un año específico
  const calcularTotalDelPrimerEnero = (ahorro, año) => {
    if (!ahorro?.transactions || !Array.isArray(ahorro.transactions)) return 0;

    // Buscar transacciones del 1 de enero del año especificado
    const primerEnero = new Date(año, 0, 1); // 1 de enero del año especificado
    
    return ahorro.transactions.reduce((total, t) => {
      // Parsear fecha de la transacción
      let fechaTransaccion = null;
      
      if (t.date) {
        if (t.date.toDate && typeof t.date.toDate === 'function') {
          fechaTransaccion = t.date.toDate();
        } else if (t.date instanceof Date) {
          fechaTransaccion = t.date;
        } else if (typeof t.date === 'string') {
          fechaTransaccion = new Date(t.date);
        }
      }

      // Si es del 1 de enero del año especificado, sumar totalBefore
      if (fechaTransaccion && 
          fechaTransaccion.getFullYear() === año &&
          fechaTransaccion.getMonth() === 0 && // Enero (0-indexed)
          fechaTransaccion.getDate() === 1) { // Día 1
        const totalBefore = Number(t.totalBefore) || 0;
        return total + totalBefore;
      }

      return total;
    }, 0);
  };

  // 🆕 Función para calcular total del año anterior
  const calcularTotalAnioAnterior = (ahorro) => {
    // Si está en 2025, mostrar 0
    if (selectedYear === 2025) return 0;
    
    // Para 2026+, buscar transacciones del 1 de enero del año seleccionado
    return calcularTotalDelPrimerEnero(ahorro, selectedYear);
  };

  // 🆕 Función para obtener rango de fechas según año seleccionado
  const obtenerRangoFechas = () => {
    if (selectedYear === 2025) {
      return {
        fechaInicio: new Date('2024-01-01T00:00:00.000Z'),
        fechaFin: new Date('2025-12-31T23:59:59.999Z')
      };
    } else if (selectedYear === 2026) {
      return {
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-12-31T23:59:59.999Z')
      };
    }
    // Fallback: todos los datos
    return {
      fechaInicio: new Date('2020-01-01T00:00:00.000Z'),
      fechaFin: new Date('2030-12-31T23:59:59.999Z')
    };
  };

  // 🆕 Calcular depósitos filtrados por fecha
  const calcularDepositosPorFecha = async (ahorroId, fechaInicio, fechaFin) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('ahorros_id', ahorroId)
        .eq('transaction_type', 'Depositado')
        .eq('status', 'APPROVED')
        .gte('firebase_date', fechaInicio.toISOString())
        .lte('firebase_date', fechaFin.toISOString());

      if (error) throw error;

      return (data ?? []).reduce((total, row: any) => total + (Number(row.amount) || 0), 0);
    } catch (error) {
      console.error("Error calculando depósitos");
      return 0;
    }
  };

  // 🆕 Calcular beneficios filtrados por fecha (desde array interno)
  const calcularBeneficiosPorFecha = (transactions, fechaInicio, fechaFin) => {
    if (!transactions || !Array.isArray(transactions)) return 0;
    
    return transactions.reduce((total, t) => {
      // Parsear fecha
      let fechaTransaccion = null;
      
      if (t.date) {
        if (t.date.toDate && typeof t.date.toDate === 'function') {
          fechaTransaccion = t.date.toDate();
        } else if (t.date instanceof Date) {
          fechaTransaccion = t.date;
        } else if (typeof t.date === 'string') {
          fechaTransaccion = new Date(t.date);
        }
      }
      
      // Verificar si está en rango
      const dentroDelRango = fechaTransaccion && 
                            fechaTransaccion >= fechaInicio && 
                            fechaTransaccion <= fechaFin;
      
      if (dentroDelRango) {
        return total + (Number(t.fullBenefit) || 0);
      }
      
      return total;
    }, 0);
  };

  // 🔄 MODIFICADA: Función cargarDatosAhorro - Saldo total SIN filtro
  const cargarDatosAhorro = async (userUID) => {
    try {
      
      // Obtener rango de fechas según año seleccionado
      const { fechaInicio, fechaFin } = obtenerRangoFechas();
      
      // Obtener TODAS las cuentas de ahorro del usuario (sin filtro de monto)
      const ahorros = await obtenerAhorrosPorUsuario(userUID);
      // Solo mostrar los que tienen el PDF de ahorro con contenido (firmados)
      const ahorrosFirmados = ahorros.filter((a: any) => a.ahorros_doc_pdf1 && a.ahorros_doc_pdf1.trim() !== '');

      if (ahorrosFirmados.length > 0) {
        setAhorrosData(ahorrosFirmados);
        
        // Calcular totales
        let totalDepositado = 0;
        let totalBenef = 0;
        let totalSaldo = 0; // 👈 SUMA DE montoTotal (sin filtro de fecha)
        
        for (const ahorro of ahorrosFirmados) {
          // Depósitos filtrados por fecha
          const depositos = await calcularDepositosPorFecha(ahorro.id, fechaInicio, fechaFin);
          totalDepositado += depositos;
          
          // Beneficios filtrados por fecha (desde array interno)
          const beneficios = calcularBeneficiosPorFecha(ahorro.transactions, fechaInicio, fechaFin);
          totalBenef += beneficios;
          
          // 🔄 SALDO TOTAL: Suma de monto_total (como antes, SIN filtro de fecha)
          totalSaldo += Number(ahorro.monto_total || 0);
        }
        
        
        setTotalAhorrado(totalDepositado);
        setTotalBeneficios(totalBenef);
        setSaldoTotal(totalSaldo); // 👈 Suma directa de montoTotal
      } else {
        setAhorrosData([]);
        setAhorroSeleccionado(null);
        setTotalAhorrado(0);
        setTotalBeneficios(0);
        setSaldoTotal(0);
      }
    } catch (error) {
      console.error("Error al cargar datos de ahorro");
      setAhorrosData([]);
      setTotalAhorrado(0);
      setTotalBeneficios(0);
      setSaldoTotal(0);
    }
  };

  const cargarDatosCdat = async (userUID) => {
    try {
      const cdats = await obtenerCdatsPorUsuario(userUID);

      setCdatsData(cdats);

      if (cdats.length > 0) {
        let totalInv = 0;
        let totalGan = 0;

        cdats.forEach((cdat) => {
          totalInv += Number(cdat.inversion) || 0;
          totalGan += Number(cdat.ganancias) || 0;
        });

        setTotalCdatInversion(totalInv);
        setTotalCdatGanancias(totalGan);
      } else {
        setTotalCdatInversion(0);
        setTotalCdatGanancias(0);
      }
    } catch (error) {
      console.error("Error al cargar datos de CDAT");
      setTotalCdatInversion(0);
      setTotalCdatGanancias(0);
    }
  };

  const formatearMontoTransaccion = (transaccion) => {
    const monto = Math.abs(transaccion.amount);
    const formateado = formatAmount(monto);
    
    if (transaccion.transactionType === 'Withdrawal') {
      return `-${formateado}`;
    }
    return formateado;
  };

  const traducirTipoTransaccion = (tipo) => {
    const traducciones = {
      'Withdrawal': 'Debitado',
      'Depositado': 'Depositado'
    };
    return traducciones[tipo] || tipo;
  };

  const traducirEstado = (estado) => {
    const traducciones = {
      'APPROVED': 'Completado',
      'REJECTED': 'Rechazado',
      'PENDING': 'Pendiente'
    };
    return traducciones[estado] || estado;
  };

  // ═══════════════════════════════════════════════════════════
  // FUNCIONES PARA CDAT
  // ═══════════════════════════════════════════════════════════

  // Cargar CDATś al seleccionar tab
  const cargarCdats = async () => {
    if (!userData?.uid) return;
    
    setCargandoCdats(true);
    try {
      const cdats = await obtenerCdatsPorUsuario(userData.uid);
      setCdatsData(cdats);
      
      // Auto-seleccionar el primer CDAT
      if (cdats.length > 0) {
        setCdatSeleccionado(cdats[0]);
        // Cargar movimientos del primer CDAT
        const movimientos = await obtenerMovimientosCdat(cdats[0].id);
        setMovimientosCdat(movimientos);
      }
    } catch (error) {
      console.error("Error al cargar CDATś");
    } finally {
      setCargandoCdats(false);
    }
  };

  // Filtrar CDATś por estado
  const cdatsFiltrados = useMemo(() => {
    if (filtroCdatEstado === 'todos') {
      return cdatsData;
    } else if (filtroCdatEstado === 'activos') {
      return cdatsData.filter(c => c.estado === 'Activo');
    } else if (filtroCdatEstado === 'finalizados') {
      return cdatsData.filter(c => c.estado === 'Finalizado');
    }
    return cdatsData;
  }, [cdatsData, filtroCdatEstado]);

  // Contar por estado
  const contadorCdats = useMemo(() => {
    return {
      todos: cdatsData.length,
      activos: cdatsData.filter(c => c.estado === 'Activo').length,
      finalizados: cdatsData.filter(c => c.estado === 'Finalizado').length
    };
  }, [cdatsData]);

  // Calcular total a recibir
  const calcularTotalRecibir = (cdat) => {
    return (Number(cdat.inversion) || 0) + (Number(cdat.ganancias) || 0);
  };

  // Traducir tipo de operación
  const traducirTipoOperacionCdat = (tipo) => {
    const traducciones = {
      'entrante': 'Depositado',
      'saliente': 'Debitado'
    };
    return traducciones[tipo] || tipo;
  };

  // Traducir estado de movimiento
  const traducirEstadoCdat = (estado) => {
    const traducciones = {
      'completado': 'Completado',
      'pendiente': 'Pendiente',
      'rechazado': 'Rechazado'
    };
    return traducciones[estado] || estado;
  };

  // Formatear monto con signo para movimientos
  const formatearMontoCdat = (movimiento) => {
    const monto = Math.abs(movimiento.monto || 0);
    const formateado = formatAmount(monto);
    
    if (movimiento.tipodeoperacion === 'saliente') {
      return `-${formateado}`;
    }
    return formateado;
  };

  // Cambiar CDAT seleccionado y cargar sus movimientos
  const seleccionarCdat = async (cdat) => {
    setCdatSeleccionado(cdat);
    setMovimientoCdatExpandido(null);
    
    const movimientos = await obtenerMovimientosCdat(cdat.id);
    setMovimientosCdat(movimientos);
  };

  // Abrir modal de detalle CDAT (como en el original)
  const handleViewCdatDetails = (cdat) => {
    setSelectedCdatForModal(cdat);
    setShowCdatDetailModal(true);
  };

  return (
    <MainLayout sidebarType="personas">
      <PageHeader title="Consultar usuarios" showMenuButton={false} />

      <div className="flex gap-6">
        {/* Search Form */}
        <Card className="bg-card border-0 w-[280px] flex-shrink-0">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-foreground font-normal">Buscar por</Label>
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Celular">Celular</SelectItem>
                  <SelectItem value="Cédula">Cédula</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-foreground font-normal">{getLabel()}</Label>
              <Input 
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={getPlaceholder()} 
                className="bg-background border-border"
              />
            </div>

            <Button
              onClick={handleBuscar}
              disabled={isSearching}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {isSearching ? "Buscando..." : "Buscar"}
            </Button>
          </CardContent>
        </Card>

        {/* Client Data */}
        <Card className="bg-card border-0 flex-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-foreground">Datos del cliente</h3>
              <button 
                onClick={handleViewDetails}
                className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
              >
                Ver detalles <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nombre y apellidos</p>
                  <p className="text-sm font-medium text-foreground">{userData?.display_name || 'No disponible'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium text-foreground">{userData?.phone_number || userData?.telefono1 || 'No disponible'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Correo electrónico</p>
                  <p className="text-sm font-medium text-foreground">{userData?.email || 'No disponible'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Identificación</p>
                  <p className="text-sm font-medium text-foreground">{userData?.id || userData?.nit || 'No disponible'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm font-medium text-foreground">
                    {ahorrosData?.find(a => a.savings_type === "Linea de Ahorro de nómina")?.compay_name || empresaData?.razonsocial || 'Sin empresa'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authorization */}
        <Card className="bg-card border-0 w-[320px] flex-shrink-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-foreground">Autorización</h3>
              <Select defaultValue="supervisor">
                <SelectTrigger className="w-[120px] bg-background border-border">
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              {/* Timer Circle */}
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={176}
                    strokeDashoffset={176 * 0.28}
                    className="text-green-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-foreground">12:43</span>
              </div>
              
              {/* OTP Input */}
              <div className="flex-1">
                <div className="flex gap-1 mb-1">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      value={digit}
                      onChange={(e) => {
                        const newCode = [...otpCode];
                        newCode[index] = e.target.value.slice(-1);
                        setOtpCode(newCode);
                      }}
                      className="w-8 h-10 text-center border border-border rounded-md bg-background text-foreground text-sm font-medium"
                      maxLength={1}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  ¿No te llegó ningún código?{" "}
                  <button className="text-primary font-medium">Reenviar código (59)</button>
                </p>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Clave dinámica</p>
              <p className="text-2xl font-bold text-foreground">98123</p>
            </div>
            
            <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
              Validar código
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* Ahorrado */}
        <Card className="bg-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Ahorrado</h4>
              {/* Selector de año */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => cambiarYear(-1)}
                  disabled={selectedYear <= 2024}
                  className="text-[#FF6B2C] hover:text-[#e55a24] disabled:text-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                >
                  &lt;
                </button>
                <span className="mx-1 text-xs font-medium text-foreground min-w-[40px] text-center">
                  {selectedYear}
                </span>
                <button
                  onClick={() => cambiarYear(1)}
                  disabled={selectedYear >= 2030}
                  className="text-[#FF6B2C] hover:text-[#e55a24] disabled:text-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                >
                  &gt;
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-muted-foreground">Año anterior</span>
                </div>
                <span className="text-sm font-medium text-foreground">{formatAmount(ahorroSeleccionado ? calcularTotalAnioAnterior(ahorroSeleccionado) : 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-muted-foreground">Total ahorrado</span>
                </div>
                <span className="text-sm font-medium text-foreground">{formatAmount(totalAhorrado)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-muted-foreground">Total retirado</span>
                </div>
                <span className="text-sm font-medium text-foreground">-{formatAmount(totalRetirado)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-muted-foreground">Beneficios</span>
                </div>
                <span className="text-sm font-medium text-foreground">{formatAmount(totalBeneficios)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-muted-foreground">Saldo total</span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatAmount(selectedYear === 2025 && ahorroSeleccionado ? calcularTotalDelPrimerEnero(ahorroSeleccionado, 2026) : saldoTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Crédito */}
        <Card className="bg-card border-0">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-3">Crédito</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="text-sm text-muted-foreground">Total crédito</span>
                </div>
                <span className="text-sm font-medium text-foreground">$ 0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="text-sm text-muted-foreground">Saldo vencido</span>
                </div>
                <span className="text-sm font-medium text-foreground">$ 0</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* CDAT */}
        <Card className="bg-card border-0">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-3">CDAT</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-sm text-muted-foreground">Inversión</span>
                </div>
                <span className="text-sm font-medium text-foreground">{formatAmount(totalCdatInversion)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-sm text-muted-foreground">Ganancias</span>
                </div>
                <span className="text-sm font-medium text-foreground">{formatAmount(totalCdatGanancias)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mt-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-card border-0 text-foreground hover:bg-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content - AHORRO */}
      {activeTab === "Ahorro" && (
        <div className="mt-6 bg-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-foreground">Líneas de ahorro</h3>
            <div className="flex gap-2">
              {ahorrosData && ahorrosData.length > 0 ? (
                ahorrosData.map((ahorro) => (
                  <button 
                    key={ahorro.id}
                    onClick={() => {
                      setActiveSavingsTab(ahorro.SavingsType);
                      setAhorroSeleccionado(ahorro);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      ahorroSeleccionado?.id === ahorro.id
                        ? "bg-muted border border-border text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ahorro.SavingsType}
                  </button>
                ))
              ) : (
                <p>No hay líneas de ahorro</p>
              )}
            </div>
          </div>

          {/* Savings Line Card */}
          <div className="bg-muted/50 rounded-xl p-6">
            {ahorroSeleccionado && (
              <div className="flex items-center gap-6 mb-6">
                <div>
                  <h4 className="text-base font-medium text-foreground">Línea de {ahorroSeleccionado.SavingsType}</h4>
                  <p className="text-sm text-muted-foreground">Fecha de apertura: {formatDate(ahorroSeleccionado.fechacreacion)}  |  Nro: {ahorroSeleccionado.ea || 9}% E.A</p>
                </div>
                {user?.userType === "CRM SuperAdmin" && (
                  <button 
                    onClick={() => setShowNovedadModal(true)}
                    className="px-3 py-1 rounded-full border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    Novedad de saldo
                  </button>
                )}
                <div className="ml-auto flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{formatAmount(ahorroSeleccionado.montoTotal || 0)}</p>
                    <p className="text-xs text-muted-foreground">Mi saldo</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{ahorroSeleccionado.ea || 9}% E.A</p>
                    <p className="text-xs text-muted-foreground">Efectivo anual</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">
                      {calculandoTotal ? 'Calculando...' : formatAmount(totalAhorradoCalculado)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total ahorrado</p>
                  </div>
                  <div className="text-center bg-primary text-primary-foreground px-4 py-2 rounded-lg">
                    <p className="text-xl font-bold">{formatAmount(calcularBeneficiosAhorro(ahorroSeleccionado))}</p>
                    <p className="text-xs">Beneficios</p>
                  </div>
                </div>
              </div>
            )}

            {/* Movimientos Section */}
            <div className="pt-2">
              {ahorroSeleccionado?.SavingsType === "Linea de Ahorro de nómina" && (
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-base font-bold text-foreground">{formatAmount(ahorroSeleccionado?.total_savings_pre_approval || 0)}</p>
                    <p className="text-xs text-muted-foreground">Mi saldo Ahorrado</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h4 className="text-base font-medium text-foreground">Movimientos</h4>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Acción</span>
                    <Select value={filtroAccion} onValueChange={setFiltroAccion}>
                      <SelectTrigger className="w-[120px] bg-background border-border">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="deposito">Depositado</SelectItem>
                        <SelectItem value="retiro">Debitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                      <SelectTrigger className="w-[120px] bg-background border-border">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="exitoso">Completado</SelectItem>
                        <SelectItem value="rechazado">Rechazado</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mb-2">
                <span className="text-sm font-medium text-primary">
                  Este mes ({transaccionesEsteMes.length})
                </span>
              </div>

              {/* Tabla de Movimientos Dinámicos */}
              <div className="space-y-2">
                {cargandoTransacciones ? (
                  <p className="text-center py-4 text-muted-foreground">Cargando movimientos...</p>
                ) : transaccionesPaginaActual.length > 0 ? (
                  <>
                    {transaccionesPaginaActual.map((transaccion) => {
                      const isExpanded = transaccionExpandida === transaccion.id;
                      return (
                        <div key={transaccion.id} className="bg-card rounded-lg overflow-hidden">
                          <div 
                            className="flex items-center py-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setTransaccionExpandida(isExpanded ? null : transaccion.id)}
                          >
                            <span className="flex-1 text-sm text-muted-foreground">
                              {formatearFechaTransaccion(transaccion.firebase_date)}
                            </span>
                            <span className={`flex-1 text-sm font-medium ${
                              transaccion.transactionType === 'Withdrawal' ? "text-foreground" : "text-primary"
                            }`}>
                              {formatearMontoTransaccion(transaccion)}
                            </span>
                            <span className="flex-1 text-sm text-muted-foreground">
                              {traducirTipoTransaccion(transaccion.transactionType)}
                            </span>
                            <span className={`flex-1 text-sm ${
                              transaccion.status === "APPROVED" ? "text-muted-foreground" : "text-destructive"
                            }`}>
                              {traducirEstado(transaccion.status)}
                            </span>
                            <span className="flex-1 text-sm text-muted-foreground text-right">
                              {transaccion.is_ahorro_cdat ? 'CDAT' : 
                               transaccion.is_novedad_saldo ? 'Transferencia interna' : 
                               transaccion.transactionType === 'Depositado' ? 'PSE' : 
                               transaccion.transactionType === 'Withdrawal' ? (transaccion.withdrawal_info?.bankName || transaccion.bank || 'Transferencia interna') : 
                               (transaccion.bank || 'Transferencia interna')}
                            </span>
                            <button
                              aria-label="Ver movimientos de la transacción"
                              aria-expanded={isExpanded}
                              className="ml-4 p-1 hover:bg-muted rounded"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                          
                          {/* Detalles expandibles */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 bg-muted/30 border-t border-border">
                              {(transaccion.transactionType === 'Depositado' || transaccion.is_novedad_saldo === true) ? (
                                // SOLO 3 CAMPOS - DEPOSITADO O NOVEDAD DE SALDO
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">ID de autorización (CUS)</p>
                                    <p className="text-sm font-medium text-foreground">{transaccion.authorization_ref || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Banco</p>
                                    <p className="text-sm font-medium text-foreground">{transaccion.is_novedad_saldo || transaccion.is_ahorro_cdat ? 'Alianza Capital' : (transaccion.withdrawal_info?.bankName || transaccion.bank || 'N/A')}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Detalle</p>
                                    <p className="text-sm font-medium text-foreground">{transaccion.message || 'Bono Test'}</p>
                                  </div>
                                </div>
                              ) : (
                                // DETALLE COMPLETO - OTROS CASOS
                                <>
                                  {/* Grid 3x2 con los 6 campos principales */}
                                  <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div>
                                      <p className="text-xs text-muted-foreground">ID de Transacción</p>
                                      <p className="text-sm font-medium text-foreground">{transaccion.authorization_ref || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Número de cuenta</p>
                                      <p className="text-sm font-medium text-foreground">{transaccion.withdrawal_info?.accountNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Tipo de cuenta</p>
                                      <p className="text-sm font-medium text-foreground">{transaccion.withdrawal_info?.accountType || 'Cuenta de ahorros'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Estado del movimiento</p>
                                      <p className="text-sm font-medium text-foreground">{traducirEstado(transaccion.status)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Nombre y Apellidos</p>
                                      <p className="text-sm font-medium text-foreground">{transaccion.user_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Fecha pago retiro</p>
                                      <p className="text-sm font-medium text-foreground">{formatearFechaTransaccion(transaccion.firebase_date)}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Observaciones en fila separada */}
                                  <div className="mt-4 pt-4 border-t border-border">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Observaciones</p>
                                      <p className="text-sm font-medium text-foreground">{transaccion.observation || transaccion.message || 'N/A'}</p>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Paginación Dinámica */}
                    {totalPaginas > 1 && (
                      <div className="flex justify-center mt-6">
                        <nav className="flex items-center gap-1">
                          <button 
                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                            aria-label="Página anterior"
                            disabled={paginaActual === 1}
                            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          
                          {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => {
                            let pagina;
                            if (totalPaginas <= 5) {
                              pagina = i + 1;
                            } else if (paginaActual <= 3) {
                              pagina = i + 1;
                            } else if (paginaActual >= totalPaginas - 2) {
                              pagina = totalPaginas - 4 + i;
                            } else {
                              pagina = paginaActual - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pagina}
                                onClick={() => setPaginaActual(pagina)}
                                className={`w-8 h-8 flex items-center justify-center text-sm font-medium ${
                                  paginaActual === pagina 
                                    ? 'rounded border border-border text-foreground' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {pagina}
                              </button>
                            );
                          })}
                          
                          {totalPaginas > 5 && paginaActual < totalPaginas - 2 && (
                            <>
                              <span className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground">...</span>
                              <button
                                onClick={() => setPaginaActual(totalPaginas)}
                                className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground hover:text-foreground"
                              >
                                {totalPaginas}
                              </button>
                            </>
                          )}
                          
                          <button 
                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                            aria-label="Página siguiente"
                            disabled={paginaActual === totalPaginas}
                            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </nav>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">No hay movimientos registrados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "CDAT" && (
        <div className="mt-6 bg-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-foreground">CDAT</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroCdatEstado('todos')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filtroCdatEstado === 'todos'
                    ? "bg-muted border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({contadorCdats.todos})
              </button>
              <button
                onClick={() => setFiltroCdatEstado('activos')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filtroCdatEstado === 'activos'
                    ? "bg-muted border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Activos ({contadorCdats.activos})
              </button>
              <button
                onClick={() => setFiltroCdatEstado('finalizados')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filtroCdatEstado === 'finalizados'
                    ? "bg-muted border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Finalizados ({contadorCdats.finalizados})
              </button>
            </div>
          </div>

          {cargandoCdats ? (
            <p className="text-center py-8 text-muted-foreground">Cargando CDATś...</p>
          ) : cdatsFiltrados.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay CDATś</p>
          ) : (
            <div className="bg-muted/50 rounded-xl p-6 space-y-4">
              {cdatsFiltrados.map((cdat, index) => {
                const cdatKey = `${cdat.id}-${index}`;
                const isDetailsExpanded = expandedMovimientos.includes(`details-${cdatKey}`);
                const isMovimientosExpanded = expandedMovimientos.includes(`movimientos-${cdatKey}`);
                
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
                          <span className="text-xs text-muted-foreground">
                            {cdat.is_ahorro_cdat ? `INV-AP#${cdat.id_cdat}` : `INV-CB#${cdat.id_cdat}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            cdat.estado === "Activo" 
                              ? "bg-green-100 text-green-700" 
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {cdat.estado || 'Sin estado'}
                          </span>
                          <button
                            onClick={() => handleViewCdatDetails(cdat)}
                            aria-label="Ver detalles del CDAT"
                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => {
                              const key = `details-${cdatKey}`;
                              setExpandedMovimientos(prev => 
                                prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
                              );
                            }}
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
                            <p className="text-base font-bold text-foreground">{formatAmount(calcularTotalRecibir(cdat))}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5">Inversión</p>
                            <p className="text-base font-bold text-foreground">{formatAmount(Number(cdat.inversion) || 0)}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5">Ganancias</p>
                            <p className="text-base font-bold text-foreground">{formatAmount(Number(cdat.ganancias) || 0)}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5">Fecha de vencimiento</p>
                            <p className="text-base font-bold text-foreground">
                              {cdat.fecha_finalizacion ? formatDate(cdat.fecha_finalizacion) : 'N/A'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Movimientos Header - Always visible, independent toggle */}
                    <div 
                      className="px-4 py-2.5 border-t border-border flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => {
                        const key = `movimientos-${cdatKey}`;
                        setExpandedMovimientos(prev => 
                          prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
                        );
                        if (!isMovimientosExpanded) {
                          seleccionarCdat(cdat);
                        }
                      }}
                    >
                      <h4 className="text-sm font-medium text-foreground">Movimientos</h4>
                      {isMovimientosExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Expanded Movimientos */}
                    {isMovimientosExpanded && cdatSeleccionado?.id === cdat.id && movimientosCdat.length > 0 && (
                      <div className="px-4 pb-4">
                        <p className="text-xs font-medium text-primary mb-2">Este mes</p>
                        <div className="space-y-1.5">
                          {movimientosCdat.map((mov) => {
                            const isMovExpanded = movimientoCdatExpandido === mov.id;
                            return (
                              <div key={mov.id} className="bg-muted/30 rounded-lg overflow-hidden">
                                <div 
                                  className="flex items-center py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => setMovimientoCdatExpandido(
                                    movimientoCdatExpandido === mov.id ? null : mov.id
                                  )}
                                >
                                  <span className="flex-1 text-sm text-muted-foreground">
                                    {formatDateTime(mov.fecharetiro)}
                                  </span>
                                  <span className={`flex-1 text-sm font-medium ${
                                    mov.tipodeoperacion === 'saliente' ? "text-foreground" : "text-primary"
                                  }`}>
                                    {formatearMontoCdat(mov)}
                                  </span>
                                  <span className="flex-1 text-sm text-muted-foreground">
                                    {traducirEstadoCdat(mov.estados)}
                                  </span>
                                  <span className="flex-1 text-sm text-muted-foreground">
                                    {traducirTipoOperacionCdat(mov.tipodeoperacion)}
                                  </span>
                                  <button
                                    aria-label="Ver movimientos del CDAT"
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
                                        <p className="text-sm font-medium text-foreground">{mov.id_field ?? mov.id}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Banco</p>
                                        <p className="text-sm font-medium text-foreground">{mov.numbredebanco || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Fecha</p>
                                        <p className="text-sm font-medium text-foreground">
                                          {formatDate(mov.fecharetiro)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Detalle</p>
                                        <p className="text-sm font-medium text-foreground">{traducirEstadoCdat(mov.estados)}</p>
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
          )}
        </div>
      )}

      {activeTab === "Documentos" && (
        <div className="mt-6 bg-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-medium text-foreground">Documentos</h3>
          </div>

          <div className="space-y-6">
            {/* Líneas de ahorro */}
            {ahorrosData && ahorrosData.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-6">
                <h4 className="text-sm font-medium text-foreground mb-4 text-blue-600">Líneas de ahorro</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {ahorrosData.filter(ahorro => ahorro.AhorrosDocPdf1).map((ahorro, index) => (
                    <div key={ahorro.id} className="bg-card rounded-lg p-4 border border-border">
                      <h5 className="font-medium text-foreground mb-2">{ahorro.SavingsType}</h5>
                      <p className="text-xs text-muted-foreground mb-3">Línea de {ahorro.SavingsType}</p>
                      <p className="text-xs text-muted-foreground mb-3">Nro: {ahorro.ea || 9}% E.A</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => window.open(ahorro.AhorrosDocPdf1, '_blank')}
                          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors"
                        >
                          Descargar documento
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {ahorrosData.filter(ahorro => ahorro.AhorrosDocPdf1).length === 0 && (
                  <p className="text-center py-4 text-muted-foreground text-sm">No hay documentos de ahorro disponibles</p>
                )}
              </div>
            )}

            {/* Líneas de CDAT */}
            {cdatsData && cdatsData.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-6">
                <h4 className="text-sm font-medium text-foreground mb-4 text-blue-600">Líneas de CDAT</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cdatsData.filter(cdat => cdat.firma).map((cdat, index) => (
                    <div key={cdat.id} className="bg-card rounded-lg p-4 border border-border">
                      <h5 className="font-medium text-foreground mb-2">CDAT</h5>
                      <p className="text-xs text-muted-foreground mb-3">Inversión: {formatAmount(Number(cdat.inversion) || 0)}</p>
                      <p className="text-xs text-muted-foreground mb-3">{cdat.ea}% E.A</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => window.open(cdat.firma, '_blank')}
                          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors"
                        >
                          Descargar firma
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {cdatsData.filter(cdat => cdat.firma).length === 0 && (
                  <p className="text-center py-4 text-muted-foreground text-sm">No hay documentos de CDAT disponibles</p>
                )}
              </div>
            )}

            {/* Registro */}
            {userData && userData.verification_pdf && (
              <div className="bg-muted/50 rounded-xl p-6">
                <h4 className="text-sm font-medium text-foreground mb-4 text-blue-600">Registro</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <h5 className="font-medium text-foreground mb-2">Documento de registro</h5>
                    <p className="text-xs text-muted-foreground mb-3">Verificación de usuario</p>
                    <p className="text-xs text-muted-foreground mb-3">Usuario: {userData.display_name || 'No disponible'}</p>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => window.open(userData.verification_pdf, '_blank')}
                        className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors"
                      >
                        Descargar registro
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje si no hay documentos */}
            {(!ahorrosData || ahorrosData.filter(ahorro => ahorro.AhorrosDocPdf1).length === 0) &&
             (!cdatsData || cdatsData.filter(cdat => cdat.firma).length === 0) &&
             (!userData || !userData.verification_pdf) && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay documentos disponibles para este usuario</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Vehículos" && <VehiculosSection />}

      {activeTab === "Historial" && <HistorialSection docId={userData?.uid} />}

      {activeTab === "Información adicional" && (
        <div className="mt-6">
          <Button onClick={() => setShowUserModal(true)}>
            Ver información adicional
          </Button>
        </div>
      )}

      {/* User Info Modal */}
      <UserInfoModal open={showUserModal} onOpenChange={setShowUserModal} userData={userData} ahorrosData={ahorrosData} />
      
      {/* Novedad de Saldo Modal */}
      <NovedadSaldoModal 
        open={showNovedadModal} 
        onOpenChange={setShowNovedadModal}
        userName={userData?.display_name || "Usuario no disponible"}
        accountType={ahorroSeleccionado?.SavingsType || "Tipo de cuenta no disponible"}
        currentBalance={formatAmount(ahorroSeleccionado?.montoTotal || 0)}
        userData={userData}
        authenticatedUser={{
          display_name: "Administrador del Sistema",
          email: "admin@alianzacapital.co",
          role: "admin"
        }}
        ahorroSeleccionado={ahorroSeleccionado}
      />

      {/* CDAT Detail Modal */}
      <CDATDetailModal 
        open={showCdatDetailModal} 
        onOpenChange={setShowCdatDetailModal}
        cdat={selectedCdatForModal ? {
          id: selectedCdatForModal.id,
          nombreusuario: selectedCdatForModal.nombreusuario,
          firmado: selectedCdatForModal.firmado,
          Inversion: Number(selectedCdatForModal.inversion) || 0,
          Ganancias: Number(selectedCdatForModal.ganancias) || 0,
          Rendimiento: Number(selectedCdatForModal.rendimiento) || 0,
          FechaApertura: selectedCdatForModal.fecha_apertura,
          FechaFinalizacion: selectedCdatForModal.fecha_finalizacion,
          Tiempo: Number(selectedCdatForModal.tiempo) || 0,
          RetefuenteMonto: Number(selectedCdatForModal.retefuente_monto) || 0,
          EA: Number(selectedCdatForModal.ea) || 0,
          Tipooperacion: selectedCdatForModal.tipooperacion,
          origenrecursos: selectedCdatForModal.origenrecursos,
          saldoDisponible: Number(selectedCdatForModal.saldo_disponible) || 0,
          Archivos: selectedCdatForModal.archivos || [],
          comprobantes: selectedCdatForModal.comprobantes || [],
          observaciones: selectedCdatForModal.observaciones || ""
        } : undefined}
      />

      {/* Modal de Funcionalidad en Pausa */}
      <Dialog open={showPausaModal} onOpenChange={setShowPausaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">⏸</span>
              </div>
              Funcionalidad en pausa
            </DialogTitle>
            <DialogDescription className="mt-4">
              Esta funcionalidad está temporalmente deshabilitada.
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
    </MainLayout>
  );
}