import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { User, Mail, FileText, Phone, Building, Calendar, Clock, DollarSign, Upload, X, Check, ArrowRight, Loader2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buscarUsuarioPor, obtenerEmpresaPorRef, buscarUsuarioPorDocumento } from "@/supabase/database";
import { subirArchivoConFallback, subirPDF } from "@/supabase/storage";
import { supabase } from "@/supabase/config";
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
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mock PDF images for contract step
import contratoImg1 from "@/assets/menu/contabilidad.png";
import contratoImg2 from "@/assets/menu/contabilidad.png";
// Logos usados en el PDF del CDAT (copias locales de los assets originales)
import pdfLogo from "@/assets/pdf-logo.png";
import pdfLogoBW from "@/assets/pdf-logo-bw.png";
import pdfSello from "@/assets/pdf-sello.jpg";
import pdfVigilado from "@/assets/pdf-vigilado.jpg";

interface UploadedFile {
  id: string;
  name: string;
  uploaded: boolean;
  file?: File; // Archivo real para subir a Supabase Storage
}

interface CrearCDATSectionProps {
  onNavigateToLegalizacion?: () => void;
}

export function CrearCDATSection({ onNavigateToLegalizacion }: CrearCDATSectionProps) {
  // Step control
  const [currentStep, setCurrentStep] = useState(1);
  const [visitedSteps, setVisitedSteps] = useState<number[]>([1]); // Track visited steps
  
  // Search state
  const [tipoDocumento, setTipoDocumento] = useState("cedula");
  const [numeroCedula, setNumeroCedula] = useState("");
  const [userFound, setUserFound] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const { toast } = useToast();
  
  // Investment form state
  const [montoInversion, setMontoInversion] = useState("");

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (!raw) { setMontoInversion(""); return; }
    const formatted = Number(raw).toLocaleString('es-CO');
    setMontoInversion(formatted);
  };
  const [tiempoInversion, setTiempoInversion] = useState("");
  const [porcentajeAplicado, setPorcentajeAplicado] = useState("");
  const [fechaApertura, setFechaApertura] = useState<Date>();
  const [calculated, setCalculated] = useState(false);
  
  // Declaration step state
  const [origenRecursos, setOrigenRecursos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); // Archivos paso 1 (después del cálculo)
  const [uploadedFilesStep2, setUploadedFilesStep2] = useState<UploadedFile[]>([]); // Archivos paso 2
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefStep2 = useRef<HTMLInputElement>(null);
  
  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const handleSearch = async () => {
    if (!numeroCedula.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un número de documento",
        variant: "destructive",
      });
      return;
    }

    setSearchLoading(true);
    try {
      let usuarioEncontrado = null;

      if (tipoDocumento === "cedula") {
        // Para cédulas, usar la función específica que busca en nit e id
        const usuarios = await buscarUsuarioPorDocumento(numeroCedula.trim());
        usuarioEncontrado = usuarios.length > 0 ? usuarios[0] : null;
      } else {
        // Para email y teléfono, usar la función general
        const campo = tipoDocumento === "email" ? "email" : "phone_number";
        usuarioEncontrado = await buscarUsuarioPor(campo, numeroCedula.trim());
      }
      
      if (!usuarioEncontrado) {
        toast({
          title: "Usuario no encontrado",
          description: "No se encontró ningún usuario con ese documento",
          variant: "destructive",
        });
        setUserFound(false);
        setUserData(null);
        return;
      }

      const usuario = usuarioEncontrado;
      
      // Obtener información de la empresa si existe
      let empresaInfo = null;
      if (usuario && usuario.empresaRef) {
        try {
          empresaInfo = await obtenerEmpresaPorRef(usuario.empresaRef);
        } catch (error) {
          console.error("Error al obtener empresa:", error);
        }
      }

      // Estructurar datos del usuario
      const datosUsuario = {
        uid: usuario.uid,
        nombre: usuario.display_name || `${usuario.name || ''} ${usuario.lastName || ''}`.trim() || 'N/A',
        email: usuario.email || 'N/A',
        identificacion: usuario.numeroDocumento || usuario.id || usuario.nit || 'N/A',
        telefono: usuario.phone_number || 'N/A',
        empresa: empresaInfo?.nombreEmpresa || 'Sin empresa asignada',
        tipoDocumento: usuario.tipoDocumento || 'N/A',
        ...usuario
      };

      setUserData(datosUsuario);
      setUserFound(true);
      
      toast({
        title: "Usuario encontrado",
        description: `Usuario: ${datosUsuario.nombre}`,
      });

    } catch (error) {
      console.error("Error al buscar usuario:", error);
      toast({
        title: "Error",
        description: "Error al buscar el usuario. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // Calculation results state
  const [calculationData, setCalculationData] = useState({
    totalRecibir: "$ 0",
    inversion: "$ 0",
    ganancias: "$ 0",
    fechaApertura: "",
    tiempo: "",
    fechaFinalizacion: "",
    retefuente: "-$ 0",
    efectivaAnual: "0% E.A",
    rendimientos: "$ 0",
    anticipos: []
  });

  // Función para limpiar la búsqueda
  const clearSearch = () => {
    setUserFound(false);
    setUserData(null);
    setNumeroCedula("");
  };

  // Limpiar búsqueda cuando cambia el tipo de documento
  const handleTipoDocumentoChange = (value: string) => {
    setTipoDocumento(value);
    clearSearch();
  };

  const handleCalculate = () => {
    if (montoInversion && tiempoInversion && porcentajeAplicado && fechaApertura) {
      // Parsear valores
      const inversion = parseFloat(montoInversion.replace(/\./g, "").replace(/[^0-9]/g, ""));
      const tiempo = parseInt(tiempoInversion);
      const ea = parseFloat(porcentajeAplicado);
      
      // Cálculos usando las fórmulas correctas
      const rendimientos = inversion * (ea / 100) * (tiempo / 12);
      const retefuente = rendimientos * 0.04; // 4% actualizado
      const ganancias = rendimientos - retefuente;
      const totalRecibir = inversion + ganancias;
      
      // Calcular fechas
      const fechaInicio = new Date(fechaApertura);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + tiempo);
      
      // Calcular anticipos (cada 3 meses)
      const numAnticipos = tiempo / 3;
      const montoPorAnticipo = ganancias / numAnticipos;
      const anticipos = [];
      
      for (let i = 1; i <= numAnticipos; i++) {
        const fechaAnticipo = new Date(fechaInicio);
        fechaAnticipo.setMonth(fechaAnticipo.getMonth() + (i * 3));
        
        const esUltimoAnticipo = i === numAnticipos;
        const montoAnticipo = esUltimoAnticipo ? montoPorAnticipo + inversion : montoPorAnticipo;
        
        anticipos.push({
          fecha: fechaAnticipo.toLocaleDateString('es-CO'),
          label: `Anticipo ${i}${esUltimoAnticipo ? ' + capital inicial' : ''}`,
          monto: `$ ${montoAnticipo.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`
        });
      }
      
      // Actualizar calculationData con valores reales
      setCalculationData({
        totalRecibir: `$ ${totalRecibir.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`,
        inversion: `$ ${inversion.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`,
        ganancias: `$ ${ganancias.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`,
        fechaApertura: fechaInicio.toLocaleDateString('es-CO'),
        tiempo: `${tiempo} meses`,
        fechaFinalizacion: fechaFin.toLocaleDateString('es-CO'),
        retefuente: `-$ ${retefuente.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`,
        efectivaAnual: `${ea}% E.A`,
        rendimientos: `$ ${rendimientos.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`,
        anticipos
      });
      
      setCalculated(true);
    }
  };

  const handleContinueStep1 = () => {
    setCurrentStep(2);
    setVisitedSteps(prev => {
      if (!prev.includes(2)) {
        return [...prev, 2];
      }
      return prev;
    });
  };

  const handleContinueStep2 = () => {
    // Validar que haya archivos subidos en el paso 2
    if (uploadedFilesStep2.length === 0) {
      toast({
        title: "Error",
        description: "Debes subir al menos un archivo antes de continuar",
        variant: "destructive",
      });
      return;
    }

    // Validar que los campos de texto estén llenos
    if (!origenRecursos.trim() || !observaciones.trim()) {
      toast({
        title: "Error",
        description: "Debes completar todos los campos de texto",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep(3);
    setVisitedSteps(prev => {
      if (!prev.includes(3)) {
        return [...prev, 3];
      }
      return prev;
    });
  };

  // Función para recopilar todos los datos del CDAT
  const recopilarDatosCDAT = () => {
    return {
      // Datos del usuario
      usuario: {
        uid: userData?.uid,
        display_name: userData?.display_name,
        tipoDocumento: userData?.tipoDocumento,
        nit: userData?.nit,
        id: userData?.id,
        fechaExpedicion: userData?.fechaExpedicion,
        ciudadExpedicion: userData?.ciudadExpedicion,
        direccion: userData?.direccion,
        barrio: userData?.barrio,
        email: userData?.email,
        telefono: userData?.telefono,
        empresa: userData?.empresa,
      },
      
      // Datos de la inversión y cálculos
      inversion: {
        montoInversion: montoInversion.replace(/\./g, ""),
        tiempoInversion: parseInt(tiempoInversion),
        porcentajeAplicado: parseFloat(porcentajeAplicado),
        fechaApertura: fechaApertura,
      },
      
      // Resultados calculados
      calculos: calculationData,
      
      // Archivos del paso 1 (comprobante de depósito)
      archivosDeposito: uploadedFiles,
      
      // Datos del paso 2
      declaracion: {
        origenRecursos: origenRecursos,
        observaciones: observaciones,
        archivosOrigen: uploadedFilesStep2, // Archivos de comprobante origen de recursos
      },
      
      // Metadatos
      fechaCreacion: new Date(),
      estado: 'pendiente', // pendiente, aprobado, rechazado
      pasoActual: 'firma', // creado, declaracion, firma, completado
    };
  };

  // Función helper para formatear fechas (ISO, Date o Timestamp serializado)
  const formatearTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      if (typeof timestamp?.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('es-ES');
      }
      if (typeof timestamp?.seconds === 'number') {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('es-ES');
      }
      const fecha = new Date(timestamp);
      if (!isNaN(fecha.getTime())) {
        return fecha.toLocaleDateString('es-ES');
      }
      return String(timestamp);
    } catch {
      return String(timestamp);
    }
  };

  const generarDocumentoCDAT = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      unit: 'mm',
      format: 'letter',
      orientation: 'portrait'
    });
    
    const datosCDAT = recopilarDatosCDAT();
    if (!datosCDAT) return null;
    
    // URLs de imágenes
    const imageUrls = {
      logo: pdfLogo,
      logoBW: pdfLogoBW,
      sello: pdfSello,
      vigilado: pdfVigilado
    };
    
    // Constantes de diseño (basadas en las imágenes)
    const MARGIN_LEFT = 10.5;
    const MARGIN_RIGHT = 10.5;
    const MARGIN_TOP = 5.3;
    const PAGE_WIDTH = 215.9;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    
    const COLORS = {
      azulTitulo: [0, 0, 204] as [number, number, number],
      grisCampo: [240, 240, 240] as [number, number, number],
      blanco: [255, 255, 255] as [number, number, number],
      negro: [0, 0, 0] as [number, number, number],
      naranja: [255, 165, 0] as [number, number, number],
      gris: [100, 100, 100] as [number, number, number]
    };
    
    // Función para cargar imagen
    const loadImage = (url: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          console.warn(`No se pudo cargar: ${url}`);
          resolve('');
        };
        img.src = url;
      });
    };
    
    // Funciones auxiliares
    const crearCampo = (
      x: number, 
      y: number, 
      width: number, 
      etiqueta: string, 
      valor: string,
      valorFontSize: number = 7
    ) => {
      doc.setFillColor(...COLORS.grisCampo);
      doc.rect(x, y, width, 12, 'F');
      doc.setDrawColor(...COLORS.blanco);
      doc.setLineWidth(0.13);
      doc.rect(x, y, width, 12);
      doc.setTextColor(...COLORS.negro);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(etiqueta, x + 1, y + 2.5);
      doc.setFontSize(valorFontSize);
      doc.text(valor, x + 1, y + 8);
    };
    
    const crearTituloSeccion = (y: number, texto: string) => {
      doc.setFillColor(...COLORS.azulTitulo);
      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 5, 'F');
      doc.setTextColor(...COLORS.blanco);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('  ' + texto, MARGIN_LEFT + 1, y + 3.5);
    };
    
    const crearHeader = (titulo: string) => {
      let yPos = MARGIN_TOP + 5;
      
      if (logoImg) {
        try {
          doc.addImage(logoImg, 'PNG', MARGIN_LEFT, yPos, 42, 23);
        } catch (e) {
          console.warn('Error agregando logo');
        }
      }
      
      doc.setDrawColor(...COLORS.naranja);
      doc.setLineWidth(0.8);
      doc.line(MARGIN_LEFT + 48, yPos + 3, MARGIN_LEFT + 48, yPos + 18);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.negro);
      const lineasTitulo = doc.splitTextToSize(titulo, 65);
      let tituloY = yPos + 5;
      lineasTitulo.forEach((linea: string) => {
        doc.text(linea, MARGIN_LEFT + 53, tituloY);
        tituloY += 4;
      });
      
      if (logoBWImg) {
        try {
          doc.addImage(logoBWImg, 'PNG', PAGE_WIDTH - MARGIN_RIGHT - 20, 0, 10, 18);
        } catch (e) {
          console.warn('Error agregando logo BW');
        }
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const fecha = new Date().toLocaleDateString('es-ES');
      doc.text(fecha, PAGE_WIDTH - MARGIN_RIGHT - 11, yPos + 20, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Fecha apertura', PAGE_WIDTH - MARGIN_RIGHT - 11, yPos + 25, { align: 'center' });
      
      return yPos + 30;
    };
    
    // Cargar imágenes
    const [logoImg, logoBWImg, selloImg, vigiladoImg] = await Promise.all([
      loadImage(imageUrls.logo),
      loadImage(imageUrls.logoBW),
      loadImage(imageUrls.sello),
      loadImage(imageUrls.vigilado)
    ]);
    
    // ===== PÁGINA 1: APERTURA DE CONTRATO =====
    
    let yPos = crearHeader('APERTURA DE CONTRATO\nDE AHORRO A TÉRMINO\nCDAT');
    
    // INFORMACIÓN DEL ASOCIADO
    crearTituloSeccion(yPos, 'INFORMACIÓN DEL ASOCIADO');
    yPos += 7;
    
    crearCampo(MARGIN_LEFT, yPos, CONTENT_WIDTH, 'Nombres y Apellidos', datosCDAT.usuario?.display_name || 'N/A', 7);
    yPos += 13;
    
    // 4 columnas: Tipo doc, Número doc, Fecha exp, Ciudad exp
    const col1W = 34, col2W = 34, col3W = 34, col4W = 92.9;
    let xPos = MARGIN_LEFT;
    
    crearCampo(xPos, yPos, col1W, 'Tipo de documento', datosCDAT.usuario?.tipoDocumento || 'N/A', 6.5);
    xPos += col1W;
    crearCampo(xPos, yPos, col2W, 'Número de documento', datosCDAT.usuario?.nit || datosCDAT.usuario?.id || 'N/A', 6.5);
    xPos += col2W;
    crearCampo(xPos, yPos, col3W, 'Fecha de expedición', formatearTimestamp(datosCDAT.usuario?.fechaExpedicion), 6.5);
    xPos += col3W;
    crearCampo(xPos, yPos, col4W, 'Ciudad y depto. de expedición', datosCDAT.usuario?.ciudadExpedicion || 'N/A', 6.5);
    yPos += 13;
    
    crearCampo(MARGIN_LEFT, yPos, CONTENT_WIDTH, 'Dirección de residencia', datosCDAT.usuario?.direccion || 'N/A', 7);
    yPos += 13;
    
    crearCampo(MARGIN_LEFT, yPos, 152, 'Ciudad y depto. de residencia', datosCDAT.usuario?.ciudadExpedicion || 'N/A', 6.5);
    crearCampo(MARGIN_LEFT + 152, yPos, 42.9, 'Barrio', datosCDAT.usuario?.barrio || 'N/A', 6.5);
    yPos += 15;
    
    // DATOS DE CONTACTO
    crearTituloSeccion(yPos, 'DATOS DE CONTACTO Y FIRMA ELECTRÓNICA');
    yPos += 6;
    
    crearCampo(MARGIN_LEFT, yPos, 109.9, 'Correo electrónico', datosCDAT.usuario?.email || 'N/A', 6.5);
    crearCampo(MARGIN_LEFT + 109.9, yPos, 42.5, 'WhatsApp', datosCDAT.usuario?.telefono || 'N/A', 6.5);
    crearCampo(MARGIN_LEFT + 152.4, yPos, 42.5, 'Otro teléfono', datosCDAT.usuario?.telefono || 'N/A', 6.5);
    yPos += 18;
    
    // INVERSIÓN FINANCIERA
    crearTituloSeccion(yPos, 'INVERSIÓN FINANCIERA');
    yPos += 6;
    
    // 6 columnas: Depósito, E.A, Meses, Moneda, Fecha inicio, Fecha final
    xPos = MARGIN_LEFT;
    
    // Formatear monto sin decimales
    const montoFormateado = `$${Number(datosCDAT.inversion?.montoInversion || 0).toLocaleString('es-CO')}`;
    crearCampo(xPos, yPos, 55, 'Depósito', montoFormateado, 7);
    xPos += 55;
    
    crearCampo(xPos, yPos, 14.5, 'E.A', `${datosCDAT.inversion?.porcentajeAplicado || 0}%`, 5.5);
    xPos += 14.5;
    
    crearCampo(xPos, yPos, 14.5, 'Meses', String(datosCDAT.inversion?.tiempoInversion || 0), 5.5);
    xPos += 14.5;
    
    crearCampo(xPos, yPos, 14.5, 'Moneda', 'COP', 5.5);
    xPos += 14.5;
    
    // Fecha de inicio - usar fechaApertura
    const fechaInicio = datosCDAT.inversion?.fechaApertura ? 
      datosCDAT.inversion.fechaApertura.toLocaleDateString('es-ES') : 'N/A';
    crearCampo(xPos, yPos, 34.5, 'Fecha de inicio', fechaInicio, 5.5);
    xPos += 34.5;
    
    // Fecha final - calcular sumando meses
    let fechaFinal = 'N/A';
    if (datosCDAT.inversion?.fechaApertura && datosCDAT.inversion?.tiempoInversion) {
      const fechaVencimiento = new Date(datosCDAT.inversion.fechaApertura);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + datosCDAT.inversion.tiempoInversion);
      fechaFinal = fechaVencimiento.toLocaleDateString('es-ES');
    }
    crearCampo(xPos, yPos, 34.5, 'Fecha final', fechaFinal, 5.5);
    yPos += 15;
    
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.negro);
    doc.text('Descripción de inversión', MARGIN_LEFT, yPos);
    yPos += 5;
    
    // Calcular los valores reales
    const monto = Number(datosCDAT.inversion?.montoInversion || 0);
    const tasa = Number(datosCDAT.inversion?.porcentajeAplicado || 0);
    const meses = Number(datosCDAT.inversion?.tiempoInversion || 0);
    
    // Cálculo de rendimiento anual: (monto * tasa) / 100
    const rendimientoAnual = (monto * tasa) / 100;
    // Rendimiento por el período: (rendimientoAnual * meses) / 12
    const rendimiento = Math.round((rendimientoAnual * meses) / 12);
    // Retefuente: 4% sobre el rendimiento
    const retefuente = Math.round(rendimiento * 0.04);
    // Ganancias netas: rendimiento - retefuente
    const ganancias = rendimiento - retefuente;
    // Total a recibir: capital inicial + ganancias
    const total = monto + ganancias;
    
    // Cálculos con símbolo =
    const rendW = 36.5, reteW = 36.5, equalW = 11, gananW = 36.5, totalW = 36.5;
    
    xPos = MARGIN_LEFT;
    crearCampo(xPos, yPos, rendW, 'Rendimiento', `$${rendimiento.toLocaleString('es-CO')}`, 6.5);
    xPos += rendW;
    crearCampo(xPos, yPos, reteW, 'Retefuente', `$${retefuente.toLocaleString('es-CO')}`, 6.5);
    xPos += reteW;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('=', xPos + 5, yPos + 8);
    xPos += equalW;
    
    crearCampo(xPos, yPos, gananW, 'Ganancias', `$${ganancias.toLocaleString('es-CO')}`, 5.5);
    xPos += gananW;
    crearCampo(xPos, yPos, totalW, 'Total a recibir', `$${total.toLocaleString('es-CO')}`, 5.5);
    yPos += 15;
    
    // Nota anticipos
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.negro);
    const notaAnticipos = 'La disponibilidad de anticipos de ganancias será efectiva para retiro, cada 3 meses, desde la apertura.';
    const lineasNota = doc.splitTextToSize(notaAnticipos, CONTENT_WIDTH);
    lineasNota.forEach((linea: string) => {
      doc.text(linea, MARGIN_LEFT, yPos);
      yPos += 3;
    });
    yPos += 2;
    
    // Calcular anticipos
    const anticipoTrimestral = Math.round(ganancias / 4);
    const anticipoFinal = monto + (ganancias - (anticipoTrimestral * 3));
    
    // Anticipos (4 columnas)
    const antW = 48.725;
    xPos = MARGIN_LEFT;
    crearCampo(xPos, yPos, antW, 'Anticipo 1', `$${anticipoTrimestral.toLocaleString('es-CO')}`, 6.5);
    xPos += antW;
    crearCampo(xPos, yPos, antW, 'Anticipo 2', `$${anticipoTrimestral.toLocaleString('es-CO')}`, 6.5);
    xPos += antW;
    crearCampo(xPos, yPos, antW, 'Anticipo 3', `$${anticipoTrimestral.toLocaleString('es-CO')}`, 6.5);
    xPos += antW;
    crearCampo(xPos, yPos, antW, 'Anticipo 4 + Cap. Inicial', `$${anticipoFinal.toLocaleString('es-CO')}`, 6.5);
    yPos += 12;
    
    // Sección DECLARACIÓN Y ACEPTACIÓN
    crearTituloSeccion(yPos, 'DECLARACIÓN Y ACEPTACIÓN');
    yPos += 8;
    
    // Cambiar color del texto a negro para la parte blanca
    doc.setTextColor(...COLORS.negro);
    
    
    const textosDeclaracion = [
      'Solicito la apertura de LÍNEA DE AHORRO CDAT, la cual será usada para propósitos de ahorro y/o inversión de mis recursos.',
      '',
      'Acepto que he leído los términos y condiciones, así como el contenido de reglamento (s) del producto que establece la LÍNEA DE AHORRO CDAT aperturada en Alianza Solidaria de Ahorro y Crédito y que lo ha puesto a disposición de la página web www.alianzacapital.co, así mismo manifiesto que:',
      '',
      '1. He leído y declaro conocer el reglamento (s) que establece las condiciones, las características y que rigen la LÍNEA DE AHORRO CDAT y lo acepto en su integridad de manera libre y espontánea.',
      '',
      '2. Conozco que, en caso de tener dudas al respecto del producto, puedo ingresar a www.alianzacapital.co para obtener más información o puedo contactarme al WhatsApp al 315 779 2999 o al correo info@alianzacapital.co',
      '',
      'De acuerdo con lo anterior, atentamente.'
    ];
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    textosDeclaracion.forEach(texto => {
      if (texto === '') {
        yPos += 1.5;
      } else {
        const lineas = doc.splitTextToSize(texto, CONTENT_WIDTH);
        lineas.forEach((linea: string) => {
          doc.text(linea, MARGIN_LEFT, yPos);
          yPos += 2;
        });
      }
    });
    
    // Footer página 1
    const crearFooter = (pageNum: number) => {
      const footerStartY = 220;
      
      doc.setDrawColor(170, 170, 170);
      doc.setLineDashPattern([1, 1], 0);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN_LEFT, footerStartY, CONTENT_WIDTH, 20);
      doc.setLineDashPattern([], 0);
      
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.gris);
      doc.text('Espacio para firma electrónica', PAGE_WIDTH / 2, footerStartY + 6, { align: 'center' });
      
      const firmaY = footerStartY + 25;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.negro);
      const nombreCorto = (datosCDAT.usuario?.display_name || 'Cliente').substring(0, 35);
      doc.text(nombreCorto, MARGIN_LEFT, firmaY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`CC: ${datosCDAT.usuario?.nit || datosCDAT.usuario?.id || 'N/A'}`, MARGIN_LEFT, firmaY + 4);
      doc.text('FIRMA ELECTRÓNICA', MARGIN_LEFT, firmaY + 8);
      
      const textoEntidad = pageNum === 1 ? 'ALIANZA CAPITAL' : 'Aprobado Oficial de Cumplimiento';
      const subtexto = pageNum === 1 ? 'Dpto. Financiero' : '';
      const textoX = pageNum === 1 ? PAGE_WIDTH - MARGIN_RIGHT - 45 : PAGE_WIDTH - MARGIN_RIGHT - 75;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(textoEntidad, textoX, firmaY);
      
      if (subtexto) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(subtexto, textoX, firmaY + 4);
      }
      
      const selloX = PAGE_WIDTH - MARGIN_RIGHT - 15;
      const selloY = firmaY - 8;
      
      if (selloImg) {
        try {
          doc.addImage(selloImg, 'JPEG', selloX, selloY, 12, 12);
        } catch (e) {
          doc.setDrawColor(...COLORS.negro);
          doc.circle(selloX + 6, selloY + 6, 6);
          doc.setFontSize(6);
          doc.text('SELLO', selloX + 6, selloY + 7, { align: 'center' });
        }
      } else {
        doc.setDrawColor(...COLORS.negro);
        doc.circle(selloX + 6.5, selloY + 6.5, 6);
        doc.setFontSize(6);
        doc.text('SELLO', selloX + 6.5, selloY + 7, { align: 'center' });
      }
      
      const textoLegal = 'La presente constancia constituye una copia simple de su original creado de forma electrónica y almacenado en los sistemas de almacenamiento de Zapsign. Por tal razón este documento no es representativo del valor en depósito y por lo tanto no legitima a su tenedor, no es transferible, ni negociable. Ley 527 de 1999 y el decreto de Ley 019 de 2012, por medio de la cual se define y reglamenta el acceso y uso de los mensajes de datos, del comercio electrónico y de las firmas digitales, y se establecen las entidades de certificación y se dictan otras disposiciones.';
      
      doc.setFontSize(5);
      doc.setTextColor(...COLORS.gris);
      const lineasLegal = doc.splitTextToSize(textoLegal, CONTENT_WIDTH - 5);
      let legalY = firmaY + 15;
      lineasLegal.forEach((linea: string) => {
        doc.text(linea, MARGIN_LEFT, legalY);
        legalY += 2.5;
      });
      
      if (vigiladoImg) {
        try {
          doc.addImage(vigiladoImg, 'JPEG', PAGE_WIDTH - MARGIN_RIGHT - 37, firmaY + 20, 35, 9);
        } catch (e) {
          doc.setDrawColor(...COLORS.negro);
          doc.setLineWidth(0.2);
          doc.rect(PAGE_WIDTH - MARGIN_RIGHT - 37, firmaY + 20, 35, 9);
          doc.setFontSize(4.5);
          doc.setTextColor(...COLORS.negro);
          doc.text('VIGILADO: SUPERINTENDENCIA', PAGE_WIDTH - MARGIN_RIGHT - 19.5, firmaY + 16.5, { align: 'center' });
          doc.text('DE LA ECONOMÍA SOLIDARIA', PAGE_WIDTH - MARGIN_RIGHT - 19.5, firmaY + 19.5, { align: 'center' });
        }
      }
    };
    
    crearFooter(1);
    
    // ===== PÁGINA 2: DECLARACIÓN JURAMENTADA =====
    
    doc.addPage();
    yPos = crearHeader('DECLARACION JURAMENTADA\nDEL ORIGEN DE LOS RECURSOS');
    
    // INFORMACIÓN DEL ASOCIADO (repetir)
    crearTituloSeccion(yPos, 'INFORMACIÓN DEL ASOCIADO');
    yPos += 6;
    
    crearCampo(MARGIN_LEFT, yPos, CONTENT_WIDTH, 'Nombres y Apellidos', datosCDAT.usuario?.display_name || 'N/A', 7);
    yPos += 13;
    
    xPos = MARGIN_LEFT;
    crearCampo(xPos, yPos, col1W, 'Tipo de documento', datosCDAT.usuario?.tipoDocumento || 'N/A', 6.5);
    xPos += col1W;
    crearCampo(xPos, yPos, col2W, 'Número de documento', datosCDAT.usuario?.nit || datosCDAT.usuario?.id || 'N/A', 6.5);
    xPos += col2W;
    crearCampo(xPos, yPos, col3W, 'Fecha de expedición', formatearTimestamp(datosCDAT.usuario?.fechaExpedicion), 6.5);
    xPos += col3W;
    crearCampo(xPos, yPos, col4W, 'Ciudad y depto. de expedición', datosCDAT.usuario?.ciudadExpedicion || 'N/A', 6.5);
    yPos += 11;
    
    crearCampo(MARGIN_LEFT, yPos, CONTENT_WIDTH, 'Dirección de residencia', datosCDAT.usuario?.direccion || 'N/A', 7);
    yPos += 11;
    
    crearCampo(MARGIN_LEFT, yPos, 152, 'Ciudad y depto. de residencia', datosCDAT.usuario?.ciudadExpedicion || 'N/A', 6.5);
    crearCampo(MARGIN_LEFT + 152, yPos, 42.9, 'Barrio', datosCDAT.usuario?.barrio || 'N/A', 6.5);
    yPos += 15;
    
    // DATOS DE CONTACTO (repetir)
    crearTituloSeccion(yPos, 'DATOS DE CONTACTO Y FIRMA ELECTRÓNICA');
    yPos += 6;
    
    crearCampo(MARGIN_LEFT, yPos, 109.9, 'Correo electrónico', datosCDAT.usuario?.email || 'N/A', 6.5);
    crearCampo(MARGIN_LEFT + 109.9, yPos, 42.5, 'WhatsApp', datosCDAT.usuario?.telefono || 'N/A', 6.5);
    crearCampo(MARGIN_LEFT + 152.4, yPos, 42.5, 'Otro teléfono', datosCDAT.usuario?.telefono || 'N/A', 6.5);
    yPos += 15;
    
    // DESCRIPCIÓN DE MOVIMIENTO
    crearTituloSeccion(yPos, 'DESCRIPCIÓN DE MOVIMIENTO');
    yPos += 6;
    
    // Formatear el monto con formato colombiano
    const valorOperacion = `$${Number(datosCDAT.inversion?.montoInversion || 0).toLocaleString('es-CO')}`;
    
    crearCampo(MARGIN_LEFT, yPos, 97.45, 'Tipo de operación', 'Apertura de CDAT', 6.5);
    crearCampo(MARGIN_LEFT + 97.45, yPos, 97.45, 'Valor de la operación', valorOperacion, 6.5);
    yPos += 13;
    
    // Usar los datos del paso 2 - origen de recursos
    const origenRecursosTexto = datosCDAT.declaracion?.origenRecursos || 'Salario y ahorros personales';
    console.log('DEBUG - Origen recursos:', origenRecursosTexto);
    crearCampo(MARGIN_LEFT, yPos, CONTENT_WIDTH, 'Origen de los recursos', origenRecursosTexto, 7);
    yPos += 18;
    
    // Declaración juramentada
    const textoJurado = 'Indico que todas las declaraciones contenidas en este documento las rindo bajo la gravedad del juramento y con conocimiento de las implicaciones legales que esto conlleva, así mismo declaro que el origen de los recursos, no provienen de ninguna actividad ilícita de las contempladas en el código penal colombiano o en cualquier norma que lo modifique o adicione.';
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const lineasJurado = doc.splitTextToSize(textoJurado, CONTENT_WIDTH);
    lineasJurado.forEach((linea: string) => {
      doc.text(linea, MARGIN_LEFT, yPos);
      yPos += 2.5;
    });
    yPos += 8;
    
    // Observaciones - usar los datos del paso 2
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones de la entidad financiera', MARGIN_LEFT, yPos);
    yPos += 5;
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    // Usar las observaciones del paso 2
    const observacionesTexto = datosCDAT.declaracion?.observaciones || 'Cliente verificado. Documentación completa y validada. Sin observaciones adicionales.';
    console.log('DEBUG - Observaciones:', observacionesTexto);
    const lineasObs = doc.splitTextToSize(observacionesTexto, CONTENT_WIDTH);
    lineasObs.forEach((linea: string) => {
      doc.text(linea, MARGIN_LEFT, yPos);
      yPos += 2.5;
    });
    
    crearFooter(2);
    
    return doc;
  };

  const handleEnviarParaFirma = async () => {
    try {
      setIsGeneratingPreview(true);
      
      // Verificar autenticación antes de empezar
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      if (authError || !currentUser) {
        throw new Error('Debes iniciar sesión para crear un CDAT.');
      }
      
      console.log('🔐 Usuario autenticado:', {
        uid: currentUser.id,
        email: currentUser.email
      });
      
      // Recopilar todos los datos del CDAT
      const datosCDAT = recopilarDatosCDAT();
      console.log('📊 Datos del CDAT recopilados:', datosCDAT);
      
      if (!datosCDAT) {
        throw new Error('No se pudieron recopilar los datos del CDAT');
      }

      console.log('📄 Generando PDF...');
      const pdfDoc = await generarDocumentoCDAT();
      if (!pdfDoc) {
        throw new Error('No se pudo generar el PDF');
      }
      
      // Convertir PDF a blob
      const pdfBlob = pdfDoc.output('blob');
      console.log('📄 PDF generado:', Math.round(pdfBlob.size / 1024), 'KB');
      
      // Subir PDF con nombre simple como FlutterFlow
      const timestamp = Date.now();
      const fileName = `${timestamp}000.pdf`; // Formato similar a FlutterFlow
      const userId = datosCDAT.usuario?.uid || 'unknown';
      
      let pdfUrl = '';
      let pdfInfo = null;
      
      console.log('🔄 Intentando subir PDF:', fileName);
      try {
        pdfInfo = await subirPDF(pdfBlob, fileName, userId);
        pdfUrl = pdfInfo.url;
        
        if (pdfInfo.isLocalFallback) {
          console.log('📋 PDF guardado como base64 (fallback activo)');
          console.log('💾 Archivo disponible en localStorage:', pdfInfo.storageKey);
          toast({
            title: "PDF Guardado (Fallback)",
            description: "PDF guardado en modo fallback. El almacenamiento no está disponible.",
            variant: "default",
          });
        } else if (pdfInfo.hasError) {
          console.warn('⚠️ PDF con error pero CDAT continuará:', pdfInfo.error);
          toast({
            title: "PDF con problemas",
            description: "Hubo problemas con el PDF pero el CDAT se creará.",
            variant: "default",
          });
        } else {
          console.log('✅ PDF subido exitosamente!');
          console.log('🔗 URL:', pdfInfo.url);
          toast({
            title: "PDF Subido",
            description: "PDF subido exitosamente al almacenamiento.",
            variant: "default",
          });
        }
      } catch (storageError) {
        console.error('❌ Error total con PDF:', storageError);
        
        // Generar nombre de fallback de emergencia
        pdfUrl = `EMERGENCY_PDF_${fileName}`;
        
        toast({
          title: "PDF Error",
          description: "Hubo un problema subiendo el PDF al almacenamiento.",
          variant: "destructive",
        });
      }
      
      // Calcular valores para el CDAT
      const monto = Number(datosCDAT.inversion?.montoInversion || 0);
      const tasa = Number(datosCDAT.inversion?.porcentajeAplicado || 0);
      const meses = Number(datosCDAT.inversion?.tiempoInversion || 0);
      
      // Cálculos financieros
      const rendimientoAnual = (monto * tasa) / 100;
      const rendimiento = Math.round((rendimientoAnual * meses) / 12);
      const retefuenteMonto = Math.round(rendimiento * 0.04);
      const ganancias = rendimiento - retefuenteMonto;
      
      // Fechas
      const fechaApertura = datosCDAT.inversion?.fechaApertura || new Date();
      const fechaFinalizacion = new Date(fechaApertura);
      fechaFinalizacion.setMonth(fechaFinalizacion.getMonth() + meses);
      
      // Identificadores de Supabase
      const idUsuario = datosCDAT.usuario?.id || datosCDAT.usuario?.uid || null;
      const documentoUsuario = datosCDAT.usuario?.nit || datosCDAT.usuario?.id || '';
      
      // Preparar arrays de archivos
      let archivosArray = []; // Solo archivos de origen de recursos
      let comprobantesArray = [];
      
      // Subir archivos del paso 1 (si existen) - estos van a comprobantes
      if (uploadedFiles && uploadedFiles.length > 0) {
        console.log(`📎 Procesando ${uploadedFiles.length} archivos del paso 1...`);
        for (const file of uploadedFiles) {
          if (file.file) {
            // Declarar fileTimestamp fuera del try para que esté disponible en catch
            const fileTimestamp = Date.now() + Math.floor(Math.random() * 1000);
            try {
              // Usar nombres simples conservando la extensión original
              const ext = file.file.name.split('.').pop() || 'pdf';
              const resultado = await subirArchivoConFallback(file.file, userId, `${fileTimestamp}000.${ext}`);
              comprobantesArray.push(resultado.url);
              
              if (resultado.isLocalFallback) {
                console.log('📋 Archivo paso 1 guardado como fallback:', resultado.fileName);
              } else if (resultado.hasError) {
                console.warn('⚠️ Archivo paso 1 con error:', resultado.fileName);
              } else {
                console.log('📎 Archivo paso 1 subido a Storage:', resultado.fileName);
              }
            } catch (error) {
              console.warn('⚠️ Error procesando archivo paso 1:', error.message);
              // Crear referencia de emergencia para que el CDAT se pueda crear
              const emergencyRef = `ERROR_ARCHIVO_${fileTimestamp}_${file.file.name}`;
              comprobantesArray.push(emergencyRef);
              console.log('🚨 Archivo paso 1 agregado como referencia de emergencia');
            }
          }
        }
      }
      
      // Subir archivos del paso 2 (origen de recursos) - estos van a Archivos  
      if (uploadedFilesStep2 && uploadedFilesStep2.length > 0) {
        console.log(`📎 Procesando ${uploadedFilesStep2.length} archivos del paso 2 (origen de recursos)...`);
        for (const file of uploadedFilesStep2) {
          if (file.file) {
            // Declarar fileTimestamp fuera del try para que esté disponible en catch
            const fileTimestamp = Date.now() + Math.floor(Math.random() * 1000);
            try {
              // Usar nombres simples conservando la extensión original
              const ext = file.file.name.split('.').pop() || 'pdf';
              const resultado = await subirArchivoConFallback(file.file, userId, `${fileTimestamp}000.${ext}`);
              archivosArray.push(resultado.url); // Estos van a Archivos
              
              if (resultado.isLocalFallback) {
                console.log('📋 Archivo paso 2 guardado como fallback:', resultado.fileName);
              } else if (resultado.hasError) {
                console.warn('⚠️ Archivo paso 2 con error:', resultado.fileName);
              } else {
                console.log('📎 Archivo paso 2 subido a Storage:', resultado.fileName);
              }
            } catch (error) {
              console.warn('⚠️ Error procesando archivo paso 2:', error.message);
              // Crear referencia de emergencia
              const emergencyRef = `ERROR_ARCHIVO_${fileTimestamp}_${file.file.name}`;
              archivosArray.push(emergencyRef);
              console.log('🚨 Archivo paso 2 agregado como referencia de emergencia');
            }
          }
        }
      }
      
      // Crear el CDAT en Supabase
      const cdatData = {
        archivos: archivosArray,
        ea: tasa,
        estado: "Pendiente de firma",
        fecha_apertura: fechaApertura.toISOString(),
        fecha_finalizacion: fechaFinalizacion.toISOString(),
        ganancias,
        idadmin: currentUser.id,
        idusuario: idUsuario,
        inversion: monto,
        rendimiento,
        retefuente_monto: retefuenteMonto,
        retefuenteporcentaje: 0.04,
        tiempo: meses,
        tipooperacion: "Apertura CDAT",
        user_email: datosCDAT.usuario?.email || '',
        comprobantes: comprobantesArray,
        documentousuario: documentoUsuario,
        firmado: false,
        id_cdat: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
        nombreusuario: datosCDAT.usuario?.display_name || '',
        observaciones: datosCDAT.declaracion?.observaciones || '',
        origenrecursos: datosCDAT.declaracion?.origenRecursos || ''
      };
      
      const { data: cdatCreado, error: cdatError } = await supabase
        .from('cdats')
        .insert(cdatData)
        .select('id, id_cdat')
        .single();
      if (cdatError) throw cdatError;
      console.log('✅ CDAT creado con ID:', cdatCreado.id);
      
      // Retiros anticipados: `retiros_cdat` no tiene FK hacia `cdats`, así que
      // no se pueden asociar a este contrato. La vista los calcula desde
      // `tiempo`, `fecha_apertura`, `ganancias` e `inversion`.
      
      // Registrar el depósito inicial en confirmacionretiros
      const depositoInicialData = {
        id_field: Math.floor(Math.random() * (19999 - 10000 + 1)) + 10000,
        celusuario: datosCDAT.usuario?.telefono || '',
        emailusuario: datosCDAT.usuario?.email || '',
        estados: "completado",
        fecha_solicitud: new Date().toISOString(),
        fecharetiro: fechaApertura.toISOString(),
        monto: monto,
        nitusuario: documentoUsuario,
        nombreusuario: datosCDAT.usuario?.display_name || '',
        observaciones: "Transacción completada",
        tipodeoperacion: "entrante",
        usuariosid: idUsuario ? String(idUsuario) : null,
        id_cdat: cdatCreado.id_cdat,
        isahorrocdat: false
      };
      
      const { error: depositoError } = await supabase
        .from('confirmacionretiros')
        .insert(depositoInicialData);
      if (depositoError) {
        console.error('⚠️ CDAT creado pero sin depósito inicial:', depositoError);
        toast({
          title: "CDAT creado con advertencia",
          description: "No se pudo registrar el depósito inicial en confirmacionretiros.",
          variant: "destructive",
        });
      } else {
        console.log('✅ Depósito inicial creado en confirmacionretiros');
      }
      
      // Mostrar modal de éxito
      setShowSuccessModal(true);
      
      toast({
        title: "CDAT Creado Exitosamente",
        description: `CDAT creado con ID: ${cdatCreado.id}. ${pdfInfo?.isBase64 ? 'PDF almacenado en base de datos.' : pdfInfo?.isDownloaded ? 'Archivos descargados automáticamente.' : 'Archivos procesados correctamente.'}`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('❌ Error al crear CDAT:', error);
      
      toast({
        title: "No se pudo crear el CDAT",
        description: (error as any)?.message || "Error desconocido al crear el CDAT",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    // Reset the flow
    setCurrentStep(1);
    setUserFound(false);
    setCalculated(false);
    setNumeroCedula("");
    setMontoInversion("");
    setTiempoInversion("");
    setPorcentajeAplicado("");
    setFechaApertura(undefined);
    setOrigenRecursos("");
    setUploadedFiles([]);
    setUploadedFilesStep2([]);
    setObservaciones("");
    setGeneratedPdfUrl(null);
    // Navigate to Legalización
    onNavigateToLegalizacion?.();
  };

  const handleGeneratePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const pdfDoc = await generarDocumentoCDAT();
      if (pdfDoc) {
        const pdfBlob = pdfDoc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        setGeneratedPdfUrl(pdfUrl);
      }
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      toast({
        title: "Error",
        description: "Error al generar la vista previa del PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        uploaded: true,
        file: file // Agregar el archivo real
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Funciones para archivos del paso 2
  const handleFileUploadStep2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).map((file, index) => ({
        id: `file-step2-${Date.now()}-${index}`,
        name: file.name,
        uploaded: true,
        file: file // Agregar el archivo real
      }));
      setUploadedFilesStep2(prev => [...prev, ...newFiles]);
    }
    if (fileInputRefStep2.current) {
      fileInputRefStep2.current.value = "";
    }
  };

  const handleRemoveFileStep2 = (fileId: string) => {
    setUploadedFilesStep2(prev => prev.filter(f => f.id !== fileId));
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((step) => {
        const isVisited = visitedSteps.includes(step);
        const isCurrent = currentStep === step;
        const isAccessible = isVisited;
        
        return (
          <button
            key={step}
            onClick={() => {
              if (isAccessible) {
                setCurrentStep(step);
              }
            }}
            disabled={!isAccessible}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              isCurrent
                ? "bg-primary text-primary-foreground"
                : isVisited 
                  ? "border border-border text-muted-foreground hover:bg-muted cursor-pointer"
                  : "border border-border text-muted-foreground opacity-50 cursor-not-allowed",
            )}
          >
            {step}
          </button>
        );
      })}
    </div>
  );

  const renderUserInfo = () => (
    <div className="bg-card rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Datos del cliente</h2>
        <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <span className="text-sm">Ver detalles</span>
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="flex items-center gap-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <User size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nombre y apellidos</p>
            <p className="text-sm font-medium text-foreground">{userData?.nombre || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Mail size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Correo electrónico</p>
            <p className="text-sm font-medium text-foreground">{userData?.email || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Identificación</p>
            <p className="text-sm font-medium text-foreground">{userData?.identificacion || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Phone size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Teléfono</p>
            <p className="text-sm font-medium text-foreground">{userData?.telefono || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Building size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Empresa</p>
            <p className="text-sm font-medium text-foreground">{userData?.empresa || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // STEP 1: Investment calculation
  const renderStep1 = () => (
    <>
      {userFound && renderUserInfo()}
      
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Apertura de contrato de ahorro a término CDAT</h2>
          {renderStepIndicator()}
        </div>

        <div className="flex gap-8">
          {/* Left: Investment Form */}
          <div className="w-[360px] flex-shrink-0">
            <h3 className="text-primary font-medium mb-6">Inversión financiera</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-foreground font-normal">Monto de inversión</Label>
                <Input
                  placeholder="$ 10.000.000"
                  value={montoInversion ? `$ ${montoInversion}` : ""}
                  onChange={handleMontoChange}
                  className="bg-muted border-0"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-foreground font-normal">Tiempo de inversión</Label>
                <Select value={tiempoInversion} onValueChange={setTiempoInversion}>
                  <SelectTrigger className="bg-muted border-0">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-foreground font-normal">Porcentaje aplicado</Label>
                <Input
                  placeholder="14.3%"
                  value={porcentajeAplicado}
                  onChange={(e) => setPorcentajeAplicado(e.target.value)}
                  className="bg-muted border-0"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-foreground font-normal">Fecha de apertura</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-muted border-0",
                        !fechaApertura && "text-muted-foreground"
                      )}
                    >
                      {fechaApertura ? format(fechaApertura, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={fechaApertura}
                      onSelect={setFechaApertura}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button
                onClick={handleCalculate}
                className="w-full bg-orange-100 hover:bg-orange-200 text-primary font-medium mt-4"
              >
                Calcular
              </Button>
            </div>
          </div>
          
          {/* Right: Calculation Result */}
          <div className="flex-1 bg-muted/30 rounded-xl p-6">
            {!calculated ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Completa los datos para calcular tu CDAT</p>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-medium text-foreground mb-4">Apertura de contrato de ahorro a término CDAT</h3>
                
                {/* Total to receive - Blue background like sidebar */}
                <div className="bg-sidebar rounded-xl py-4 px-6 mb-4">
                  <p className="text-2xl font-bold text-sidebar-foreground text-center">{calculationData.totalRecibir}</p>
                  <p className="text-sm text-sidebar-foreground/80 text-center">Total a recibir</p>
                </div>
                
                {/* Investment + Earnings - No borders */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 bg-card rounded-xl py-3 px-4 text-center">
                    <p className="text-lg font-bold text-primary">{calculationData.inversion}</p>
                    <p className="text-xs text-muted-foreground">Inversión</p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-primary text-xl font-bold">+</span>
                  </div>
                  <div className="flex-1 bg-card rounded-xl py-3 px-4 text-center">
                    <p className="text-lg font-bold text-primary">{calculationData.ganancias}</p>
                    <p className="text-xs text-muted-foreground">Ganancias</p>
                  </div>
                </div>
                
                {/* Details row - Icons with circular backgrounds */}
                <div className="grid grid-cols-6 gap-3 mb-6">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <Calendar size={12} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{calculationData.fechaApertura}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Fecha de apertura</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <Clock size={12} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{calculationData.tiempo}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Tiempo</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
                        <Calendar size={12} className="text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{calculationData.fechaFinalizacion}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Fecha de finalización</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{calculationData.retefuente}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Retefuente 4%</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{calculationData.efectivaAnual}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Efectiva Anual</p>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <DollarSign size={12} className="text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{calculationData.rendimientos}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Rendimientos</p>
                  </div>
                </div>
                
                {/* Anticipated withdrawals */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-foreground">Disponibilidad de retiros aticipados</h4>
                    <span className="text-sm font-bold text-primary">{calculationData.ganancias}</span>
                  </div>
                  <div className="space-y-3">
                    {calculationData.anticipos.map((anticipo, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
                        <div>
                          <p className="text-sm text-foreground">{anticipo.fecha}</p>
                          <p className="text-xs text-muted-foreground">{anticipo.label}</p>
                        </div>
                        <p className="text-sm font-medium text-foreground">{anticipo.monto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {calculated && (
          <div className="mt-6">
            {/* Upload section */}
            <div className="border-t border-border pt-6 mb-6">
              <h3 className="text-base font-medium text-foreground mb-4">Documentos adicionales</h3>
              
              {/* Uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {uploadedFiles.map((file) => (
                    <div 
                      key={file.id}
                      className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2"
                    >
                      <FileText size={16} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{file.name}</span>
                      <Check size={14} className="text-green-500" />
                      <button 
                        onClick={() => handleRemoveFile(file.id)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload button */}
              <div className="flex justify-center mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 border border-dashed border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Upload size={18} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">Subir comprobante de depósito *</span>
                </button>
              </div>
            </div>
            
            {/* Continue button */}
            <div className="flex justify-center">
              <Button
                onClick={handleContinueStep1}
                disabled={uploadedFiles.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-16 py-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
                {uploadedFiles.length === 0 && (
                  <span className="ml-2 text-xs">(Subir archivo requerido)</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // STEP 2: Declaration and file upload
  const renderStep2 = () => (
    <>
      {renderUserInfo()}
      
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Declaración juramentada del origen de los recursos</h2>
          {renderStepIndicator()}
        </div>
        
        <h3 className="text-primary font-medium mb-6">Descripción del movimiento</h3>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <Label className="text-sm text-foreground font-normal">Tipo de operación</Label>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-foreground">Apertura de CDAT</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-foreground font-normal">Valor de la operación</Label>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-foreground">{calculationData.inversion}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <Label className="text-sm text-foreground font-normal">Origen de recursos *</Label>
            <Textarea
              placeholder="Escribe el origen de los recursos"
              value={origenRecursos}
              onChange={(e) => setOrigenRecursos(e.target.value)}
              className="bg-muted border-0 min-h-[120px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-foreground font-normal">Observaciones Alianza Capital *</Label>
            <Textarea
              placeholder="Ingrese las observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="bg-muted border-0 min-h-[120px] resize-none"
            />
          </div>
        </div>
        
        {/* Uploaded files */}
        {uploadedFilesStep2.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {uploadedFilesStep2.map((file) => (
              <div 
                key={file.id}
                className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2"
              >
                <FileText size={16} className="text-muted-foreground" />
                <span className="text-sm text-foreground">{file.name}</span>
                <Check size={14} className="text-green-500" />
                <button 
                  onClick={() => handleRemoveFileStep2(file.id)}
                  className="hover:text-destructive transition-colors"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Upload button */}
        <div className="flex justify-center mb-6">
          <input
            ref={fileInputRefStep2}
            type="file"
            multiple
            onChange={handleFileUploadStep2}
            className="hidden"
          />
          <button
            onClick={() => fileInputRefStep2.current?.click()}
            className="flex items-center gap-2 px-6 py-3 border border-dashed border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Upload size={18} className="text-muted-foreground" />
            <span className="text-sm text-foreground">Subir comprobante origen de recursos *</span>
          </button>
        </div>
        
        {/* Continue button */}
        <div className="flex justify-center">
          <Button
            onClick={handleContinueStep2}
            disabled={uploadedFilesStep2.length === 0 || !origenRecursos.trim() || !observaciones.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-16 py-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar
            {(uploadedFilesStep2.length === 0 || !origenRecursos.trim() || !observaciones.trim()) && (
              <span className="ml-2 text-xs">({uploadedFilesStep2.length === 0 ? 'Archivo' : 'Textos'} requerido)</span>
            )}
          </Button>
        </div>
      </div>
    </>
  );

  // STEP 3: Contract and signature
  const renderStep3 = () => {
    return (
      <>
        {renderUserInfo()}
      
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Enviar para firma</h2>
          {renderStepIndicator()}
        </div>
        
        {/* PDF Preview Section - Single continuous document with real data */}
        <div className="flex justify-center mb-8">
          <div 
            key={`${userData?.identificacion || numeroCedula}-${montoInversion}-${tiempoInversion}-${porcentajeAplicado}`}
            className="w-[500px] bg-card rounded-lg overflow-hidden shadow-lg"
          >
            <div className="max-h-[600px] overflow-y-auto bg-card p-6">
              {/* Page 1 - Apertura de contrato */}
              <div className="w-full bg-white rounded-lg p-6 text-[8px] leading-tight shadow-sm border border-border/30 mb-6">
                {/* Header Page 1 */}
                <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="text-primary font-bold text-base tracking-tight">ALIANZA</div>
                    <div className="w-2 h-10 bg-primary"></div>
                    <div className="text-[8px] text-gray-800 font-medium leading-tight">
                      <div>APERTURA DE CONTRATO</div>
                      <div>DE AHORRO A TÉRMINO</div>
                      <div>CDAT</div>
                    </div>
                  </div>
                  <div className="w-4 h-8 bg-primary rounded-sm"></div>
                </div>
                <div className="text-right text-gray-800 mb-4">
                  <div className="font-semibold text-[10px]">{fechaApertura ? fechaApertura.toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES')}</div>
                  <div className="text-[8px] text-gray-600">Fecha apertura</div>
                </div>
                
                {/* Información del Asociado */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">INFORMACIÓN DEL ASOCIADO</div>
                </div>
                <div className="text-[6px] text-gray-800 mb-3 pl-2">
                  <div className="font-medium mb-2">{userData?.display_name || 'N/A'}</div>
                  <div className="text-gray-600 grid grid-cols-4 gap-2 text-[5px]">
                    <div>Tipo documento<br/><span className="text-gray-800">{userData?.tipoDocumento || 'N/A'}</span></div>
                    <div>Número documento<br/><span className="text-gray-800">{userData?.nit || userData?.id || 'N/A'}</span></div>
                    <div>Fecha expedición<br/><span className="text-gray-800">{formatearTimestamp(userData?.fechaExpedicion)}</span></div>
                    <div>Ciudad expedición<br/><span className="text-gray-800">{userData?.ciudadExpedicion || 'N/A'}</span></div>
                  </div>
                </div>
                
                {/* Dirección y ubicación */}
                <div className="text-[5px] text-gray-600 mb-3 pl-2">
                  <div className="mb-2">Dirección de residencia<br/><span className="text-gray-800">{userData?.direccion || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Ciudad y depto. de residencia<br/><span className="text-gray-800">{userData?.ciudadExpedicion || 'N/A'}</span></div>
                    <div>Barrio<br/><span className="text-gray-800">{userData?.barrio || 'N/A'}</span></div>
                  </div>
                </div>
                
                {/* Datos de Contacto */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">DATOS DE CONTACTO Y FIRMA ELECTRÓNICA</div>
                </div>
                <div className="text-[5px] text-gray-600 mb-3 pl-2 grid grid-cols-3 gap-2">
                  <div>Correo electrónico<br/><span className="text-gray-800">{userData?.email || 'N/A'}</span></div>
                  <div>WhatsApp<br/><span className="text-gray-800">{userData?.telefono || 'N/A'}</span></div>
                  <div>Otro teléfono<br/><span className="text-gray-800">N/A</span></div>
                </div>
                
                {/* Inversión Financiera */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">INVERSIÓN FINANCIERA</div>
                </div>
                <div className="text-[5px] text-gray-600 pl-2 mb-3">
                  <div className="grid grid-cols-6 gap-1 mb-2">
                    <div>Monto<br/><span className="text-gray-800 font-medium">${Number(montoInversion || 0).toLocaleString('es-CO')}</span></div>
                    <div>E.A<br/><span className="text-gray-800">{porcentajeAplicado || 0}%</span></div>
                    <div>Meses<br/><span className="text-gray-800">{tiempoInversion || 0}</span></div>
                    <div>Moneda<br/><span className="text-gray-800">COP</span></div>
                    <div>Fecha inicio<br/><span className="text-gray-800">{fechaApertura ? fechaApertura.toLocaleDateString('es-ES') : 'N/A'}</span></div>
                    <div>Fecha fin<br/><span className="text-gray-800">{fechaApertura && tiempoInversion ? new Date(fechaApertura.getTime() + (parseInt(tiempoInversion) * 30 * 24 * 60 * 60 * 1000)).toLocaleDateString('es-ES') : 'N/A'}</span></div>
                  </div>
                  <div className="text-[6px] font-medium mb-2">Descripción de inversión</div>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {(() => {
                      const monto = Number(montoInversion || 0);
                      const tasa = Number(porcentajeAplicado || 0);
                      const meses = Number(tiempoInversion || 0);
                      
                      // Cálculo de rendimiento anual: (monto * tasa) / 100
                      const rendimientoAnual = (monto * tasa) / 100;
                      // Rendimiento por el período: (rendimientoAnual * meses) / 12
                      const rendimiento = Math.round((rendimientoAnual * meses) / 12);
                      // Retefuente: 4% sobre el rendimiento
                      const retefuente = Math.round(rendimiento * 0.04);
                      // Ganancias netas: rendimiento - retefuente
                      const ganancias = rendimiento - retefuente;
                      // Total a recibir: capital inicial + ganancias
                      const total = monto + ganancias;
                      
                      return (
                        <>
                          <div>Rendimiento<br/><span className="text-gray-800">${rendimiento.toLocaleString('es-CO')}</span></div>
                          <div>Retefuente<br/><span className="text-gray-800">${retefuente.toLocaleString('es-CO')}</span></div>
                          <div>Ganancias<br/><span className="text-gray-800">${ganancias.toLocaleString('es-CO')}</span></div>
                          <div>Total a recibir<br/><span className="text-gray-800">${total.toLocaleString('es-CO')}</span></div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-[5px] mb-2">La disponibilidad de anticipos de ganancias será efectiva para retiro, cada 3 meses, desde la apertura.</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(() => {
                      const monto = Number(montoInversion || 0);
                      const tasa = Number(porcentajeAplicado || 0);
                      const meses = Number(tiempoInversion || 0);
                      
                      const rendimientoAnual = (monto * tasa) / 100;
                      const rendimiento = Math.round((rendimientoAnual * meses) / 12);
                      const retefuente = Math.round(rendimiento * 0.04);
                      const ganancias = rendimiento - retefuente;
                      
                      // Anticipos trimestrales: ganancias divididas en 4 partes iguales
                      const anticipoTrimestral = Math.round(ganancias / 4);
                      // Último anticipo incluye el capital inicial
                      const anticipoFinal = monto + (ganancias - (anticipoTrimestral * 3));
                      
                      return (
                        <>
                          <div>Anticipo 1<br/><span className="text-gray-800">${anticipoTrimestral.toLocaleString('es-CO')}</span></div>
                          <div>Anticipo 2<br/><span className="text-gray-800">${anticipoTrimestral.toLocaleString('es-CO')}</span></div>
                          <div>Anticipo 3<br/><span className="text-gray-800">${anticipoTrimestral.toLocaleString('es-CO')}</span></div>
                          <div>Anticipo 4 + Cap. Inicial<br/><span className="text-gray-800">${anticipoFinal.toLocaleString('es-CO')}</span></div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Declaración y Aceptación */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">DECLARACIÓN Y ACEPTACIÓN</div>
                </div>
                <div className="text-[6px] text-gray-800 pl-2 leading-relaxed">
                  <p className="mb-2">Solicito la apertura de LÍNEA DE AHORRO CDAT, la cual será usada para propósitos de ahorro y/o inversión de mis recursos.</p>
                  <p className="mb-2">Acepto que he leído los términos y condiciones, así como el contenido de reglamento (s) del producto que establece la LÍNEA DE AHORRO CDAT aperturada en Alianza Solidaria de Ahorro y Crédito.</p>
                  <p className="mb-2">1. He leído y declaro conocer el reglamento (s) que establece las condiciones, las características y que rigen la LÍNEA DE AHORRO CDAT y lo acepto en su integridad de manera libre y espontánea.</p>
                  <p>2. Conozco que, en caso de tener dudas al respecto del producto, puedo ingresar a www.alianzacapital.co para obtener más información o puedo contactarme al WhatsApp al 315 779 2999 o al correo info@alianzacapital.co</p>
                </div>
              </div>
              
              {/* Page 2 - Declaración Juramentada */}
              <div className="w-full bg-white rounded-lg p-6 text-[8px] leading-tight shadow-sm border border-border/30">
                {/* Header Page 2 */}
                <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="text-primary font-bold text-base tracking-tight">ALIANZA</div>
                    <div className="w-2 h-10 bg-primary"></div>
                    <div className="text-[8px] text-gray-800 font-medium leading-tight">
                      <div>DECLARACIÓN JURAMENTADA</div>
                      <div>DEL ORIGEN DE LOS RECURSOS</div>
                    </div>
                  </div>
                  <div className="w-4 h-8 bg-primary rounded-sm"></div>
                </div>
                <div className="text-right text-gray-800 mb-4">
                  <div className="font-semibold text-[10px]">{fechaApertura ? fechaApertura.toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES')}</div>
                  <div className="text-[8px] text-gray-600">Fecha apertura</div>
                </div>
                
                {/* Información del Asociado - Repetir */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">INFORMACIÓN DEL ASOCIADO</div>
                </div>
                <div className="text-[6px] text-gray-800 mb-3 pl-2">
                  <div className="mb-2">Nombres y apellidos<br/><span className="text-gray-800 font-medium">{userData?.nombre || 'N/A'}</span></div>
                  <div className="text-gray-600 grid grid-cols-4 gap-2 text-[5px]">
                    <div>Tipo documento<br/><span className="text-gray-800">{tipoDocumento === 'cedula' ? 'CC' : tipoDocumento === 'email' ? 'Email' : 'Teléfono'}</span></div>
                    <div>Número documento<br/><span className="text-gray-800">{userData?.identificacion || numeroCedula}</span></div>
                    <div>Fecha expedición<br/><span className="text-gray-800">N/A</span></div>
                    <div>Ciudad expedición<br/><span className="text-gray-800">N/A</span></div>
                  </div>
                </div>
                
                {/* Datos de Contacto */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">DATOS DE CONTACTO Y FIRMA ELECTRÓNICA</div>
                </div>
                <div className="text-[5px] text-gray-600 mb-3 pl-2">
                  <div>Correo electrónico<br/><span className="text-gray-800">{userData?.email || 'N/A'}</span></div>
                  <div className="mt-1">WhatsApp: <span className="text-gray-800">{userData?.telefono || 'N/A'}</span></div>
                </div>
                
                {/* Descripción de Movimiento */}
                <div className="bg-blue-600 text-white px-3 py-1 rounded-sm mb-3">
                  <div className="font-medium text-[8px]">DESCRIPCIÓN DE MOVIMIENTO</div>
                </div>
                <div className="text-[5px] text-gray-600 pl-2 mb-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Tipo operación<br/><span className="text-gray-800">Apertura de CDAT</span></div>
                    <div>Valor de la operación<br/><span className="text-gray-800">${Number(montoInversion || 0).toLocaleString('es-CO')}</span></div>
                  </div>
                  <div>Origen de los recursos<br/><span className="text-gray-800">{origenRecursos || 'Salario y ahorros personales'}</span></div>
                </div>
                <div className="text-[5px] text-gray-600 pl-2">
                  <div className="font-medium mb-1">Observaciones de la entidad financiera</div>
                  <div className="text-gray-800">{observaciones || 'Cliente verificado. Documentación completa y validada.'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Send for signature button */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const doc = await generarDocumentoCDAT();
                if (doc) {
                  const datosCDAT = recopilarDatosCDAT();
                  doc.save(`CDAT_${datosCDAT?.usuario?.nit || datosCDAT?.usuario?.id || 'contrato'}.pdf`);
                  toast({
                    title: "Documento Descargado",
                    description: "El documento CDAT se ha descargado correctamente con formato profesional"
                  });
                }
              } catch (error) {
                console.error('Error al generar PDF:', error);
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "No se pudo generar el documento PDF"
                });
              }
            }}
            className="px-8 py-6"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Documento
          </Button>
          
          <Button
            onClick={handleEnviarParaFirma}
            disabled={isGeneratingPreview}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-16 py-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPreview ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              'Enviar para firma'
            )}
          </Button>
        </div>
      </div>
    </>
  );
  };

  return (
    <div>
      {/* Search Section - Always visible */}
      <div className="flex items-end gap-4 mb-6">
        <div className="flex-1 max-w-[280px] space-y-2">
          <Label className="text-sm text-foreground font-normal">Tipo de búsqueda</Label>
          <Select value={tipoDocumento} onValueChange={handleTipoDocumentoChange}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cedula">Cédula de ciudadanía</SelectItem>
              <SelectItem value="email">Correo electrónico</SelectItem>
              <SelectItem value="phone">Número de teléfono</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-[320px] space-y-2">
          <Label className="text-sm text-foreground font-normal">
            {tipoDocumento === "email" ? "Correo electrónico" : 
             tipoDocumento === "phone" ? "Número de teléfono" : "Número de cédula"}
          </Label>
          <Input 
            placeholder={tipoDocumento === "email" ? "ejemplo@correo.com" :
                        tipoDocumento === "phone" ? "573112345678" :
                        "Escribe el número de cédula"} 
            value={numeroCedula}
            onChange={(e) => {
              setNumeroCedula(e.target.value);
              if (!e.target.value.trim() && userFound) {
                clearSearch();
              }
            }}
            className="bg-card border-border"
          />
        </div>

        <Button 
          onClick={handleSearch}
          disabled={searchLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-12"
        >
          {searchLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {searchLoading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {/* Render current step */}
      {userFound && (
        <>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </>
      )}

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={(open) => { if (!open) handleSuccessClose(); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm p-8 bg-card">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-50 rounded-xl flex items-center justify-center mb-4">
              <Check size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-6">¡Documento enviado exitosamente!</h2>
            <Button
              onClick={handleSuccessClose}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-12 py-6"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}