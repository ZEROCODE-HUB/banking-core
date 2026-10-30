import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, LogOut, ChevronUp, Play, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import logoAlianza from "@/assets/logo-alianza.png";
import menuIcon from "@/assets/menu-icon.png";
import contabilidadIcon from "@/assets/menu/contabilidad.png";
import * as XLSX from "xlsx";
import { excelreporteCopy } from "@/utils/excelReportes";
import { excelreporte } from "@/utils/excelReportesAhorro";

import { buildHomeNavigation } from "@/config/navigation";

const homeMenuItems = buildHomeNavigation();

export default function ContabilidadAhorro() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [cc, setCc] = useState("");
  const [fechaInicial, setFechaInicial] = useState<Date | undefined>(undefined);
  const [fechaFinal, setFechaFinal] = useState<Date | undefined>(undefined);
  const [showHomeMenu, setShowHomeMenu] = useState(false);
  const [contabilidadExpanded, setContabilidadExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isGeneratingAhorro, setIsGeneratingAhorro] = useState(false);
  const [progressAhorro, setProgressAhorro] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowHomeMenu(false);
      }
    }

    if (showHomeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHomeMenu]);

  const handleDescargarAhorro = async () => {
    if (isGeneratingAhorro) return; // Evitar doble click
    
    try {
      setIsGeneratingAhorro(true);
      setProgressAhorro(0);
      
      // Validar que se hayan ingresado fechas
      if (!fechaInicial || !fechaFinal) {
        toast({
          title: "Fechas requeridas",
          description: "Por favor selecciona la fecha inicial y final para generar el reporte",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      
      // Función de callback para reportar progreso
      const onProgress = (progressPercent: number, message: string) => {
        setProgressAhorro(progressPercent);
        console.log(`Progreso Ahorro: ${progressPercent}% - ${message}`);
      };
      
      // Usar la función de reportes de ahorro con los parámetros del formulario
      await excelreporte(
        cc.trim() !== '' ? cc : null, // CC o null para todos
        null, // nombre (parámetro legacy)
        fechaInicial, // fecha inicial
        fechaFinal, // fecha final
        onProgress // callback de progreso
      );
      
      setProgressAhorro(100);
      
      toast({
        title: "Reporte de Ahorro generado con éxito",
        description: "El archivo Excel se ha descargado correctamente",
        duration: 3000,
      });
      
    } catch (error) {
      console.error("Error generando reporte Ahorro:", error);
      toast({
        title: "Error al generar reporte",
        description: error.message || "Ocurrió un error al generar el archivo Excel",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsGeneratingAhorro(false);
      setProgressAhorro(0);
    }
  };

  const handleDescargarMarketing = async () => {
    if (isGenerating) return; // Evitar doble click
    
    try {
      setIsGenerating(true);
      setProgress(0);
      
      // Función de callback para reportar progreso
      const onProgress = (progressPercent: number, message: string) => {
        setProgress(progressPercent);
        console.log(`Progreso: ${progressPercent}% - ${message}`);
      };
      
      // Usar la función mejorada de Excel que filtra correctamente por documentos firmados
      await excelreporteCopy(null, null, null, null, onProgress); // Pasar callback de progreso
      
      setProgress(100);
      
      toast({
        title: "Reporte de Marketing generado con éxito",
        description: "El archivo Excel se ha descargado correctamente",
        duration: 3000,
      });
      
    } catch (error) {
      console.error("Error generando reporte Excel:", error);
      toast({
        title: "Error al generar reporte",
        description: error.message || "Ocurrió un error al generar el archivo Excel",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      console.clear(); // Limpiar consola al cerrar sesión
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex flex-col h-screen w-72 sticky top-0">
        {/* Blue background container */}
        <div className="bg-sidebar rounded-r-3xl flex flex-col" style={{ minHeight: 280 }}>
          {/* Header */}
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center">
              <img src={logoAlianza} alt="Core Bancario" className="w-6 h-6 object-contain" />
            </div>
            <div className="text-left">
              <h1 className="font-bold text-lg leading-tight text-sidebar-foreground">Core</h1>
              <p className="text-sm text-sidebar-foreground/80">Bancario</p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-white/20 mb-4"></div>

          {/* Navigation */}
          <nav className="flex-1 py-2">
            <div className="mb-4">
              <h2 className="px-4 mb-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
                CONTABILIDAD
              </h2>
              
              {/* Menu container */}
              <div className="mx-2 bg-white/10 backdrop-blur-sm rounded-xl p-2">
                <ul className="space-y-1">
                  {/* Contabilidad parent item */}
                  <li>
                    <button
                      onClick={() => setContabilidadExpanded(!contabilidadExpanded)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground transition-all"
                    >
                      <img src={contabilidadIcon} alt="Contabilidad" className="w-5 h-5 object-contain" />
                      <span className="flex-1 text-left font-medium">Contabilidad</span>
                      <ChevronUp 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          !contabilidadExpanded && "rotate-180"
                        )} 
                      />
                    </button>
                    {contabilidadExpanded && (
                      <ul className="mt-1 ml-6 space-y-1">
                        <li>
                          <button
                            className="flex items-center gap-2 pl-2 py-2 text-sm transition-colors rounded-lg text-sidebar-foreground font-semibold"
                          >
                            <Play size={10} className="fill-current" />
                            Descargas
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* User Profile - Outside blue area */}
        <div className="mt-auto p-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" />
              <AvatarFallback>
                {user?.displayName 
                  ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  : user?.email 
                  ? user.email.slice(0, 2).toUpperCase()
                  : "U"
                }
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-foreground">
                {user?.userData?.display_name || user?.displayName || user?.email || "Usuario"}
              </p>
              <p className="text-xs text-muted-foreground truncate">Usuario administrador</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors w-full bg-red-50 rounded-xl py-3 justify-center"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Content Card */}
        <div className="m-4">
          <div className="bg-card rounded-2xl p-8 relative">
            {/* Top Header with hamburger menu */}
            <div className="absolute top-6 right-6" ref={menuRef}>
              <button 
                onClick={() => setShowHomeMenu(!showHomeMenu)}
                className="w-10 h-10 bg-background text-foreground rounded-lg flex items-center justify-center hover:bg-muted transition-colors border border-border"
              >
                <img src={menuIcon} alt="Menu" className="w-5 h-5 object-contain" />
              </button>
              
              {/* Home Menu Dropdown */}
              {showHomeMenu && (
                <div 
                  className="absolute right-0 top-12 w-72 bg-card rounded-xl shadow-xl border border-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="p-3">
                    {homeMenuItems.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          navigate(item.path);
                          setShowHomeMenu(false);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" />
                          </div>
                          <span className="font-medium text-sm text-foreground">{item.label}</span>
                        </div>
                        <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold text-foreground mb-8">Contabilidad</h1>

            {/* Ahorro Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Ahorro</h2>
              
              {/* Progress Bar */}
              {isGeneratingAhorro && (
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Generando reporte de ahorros...</span>
                    <span className="text-sm font-medium text-primary">{progressAhorro}%</span>
                  </div>
                  <Progress value={progressAhorro} className="h-2" />
                </div>
              )}
              
              {/* Form */}
              <div className="flex items-end gap-4 mb-4">
                {/* CC Input */}
                <div className="flex-1">
                  <label className="block text-sm font-normal text-foreground mb-2">CC</label>
                  <Input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    className="h-12 border-border bg-background rounded-lg"
                    placeholder="Ingrese la cédula del usuario"
                    disabled={isGeneratingAhorro}
                  />
                </div>

                {/* Fecha Inicial */}
                <div className="flex-1">
                  <label className="block text-sm font-normal text-foreground mb-2">Fecha inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isGeneratingAhorro}
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal border-border bg-background",
                          !fechaInicial && "text-muted-foreground",
                          isGeneratingAhorro && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaInicial ? format(fechaInicial, "dd/MM/yyyy") : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaInicial}
                        onSelect={(date) => date && setFechaInicial(date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Fecha Final */}
                <div className="flex-1">
                  <label className="block text-sm font-normal text-foreground mb-2">Fecha final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isGeneratingAhorro}
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal border-border bg-background",
                          !fechaFinal && "text-muted-foreground",
                          isGeneratingAhorro && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaFinal ? format(fechaFinal, "dd/MM/yyyy") : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaFinal}
                        onSelect={(date) => date && setFechaFinal(date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Descargar Button for Ahorro - En la misma fila */}
                <div className="flex-shrink-0">
                  <Button
                    onClick={handleDescargarAhorro}
                    disabled={isGeneratingAhorro}
                    className="h-12 px-8 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingAhorro ? "Generando..." : "Descargar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Marketing Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Marketing</h2>
              
              {/* Progress Bar */}
              {isGenerating && (
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Generando reporte...</span>
                    <span className="text-sm font-medium text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              {/* Descargar Button for Marketing */}
              <div className="flex justify-start">
                <Button
                  onClick={handleDescargarMarketing}
                  disabled={isGenerating}
                  className="h-12 px-8 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? "Generando..." : "Descargar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
