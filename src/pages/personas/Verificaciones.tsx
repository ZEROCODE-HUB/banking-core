import { useState, useEffect } from "react";
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
import { CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface VerificationCardProps {
  name: string;
  documentNumber: string;
  registrationDate: string;
  userData?: any;
}

function VerificationCard({ name, documentNumber, registrationDate, userData }: VerificationCardProps) {
  const navigate = useNavigate();

  const toIsoString = (value: any) => {
    if (!value) return null;
    const date = value.toDate ? value.toDate() : new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };
  
  const handleNavigation = () => {
    // Solo primitivos: el state de react-router no admite objetos complejos.
    const cleanUserData = {
      // IDs y referencias
      docId: userData?.docId || null,
      id: userData?.id || null,
      uid: userData?.uid || null,
      
      // Información básica
      display_name: userData?.display_name || null,
      nombre: userData?.nombre || null,
      apellido: userData?.apellido || null,
      email: userData?.email || null,
      phone_number: userData?.phone_number || null,
      telefono1: userData?.telefono1 || null,
      nit: userData?.nit || null,
      
      // Documentos
      tipo_documento: userData?.tipo_documento || null,
      nro_documento: userData?.nro_documento || null,
      ciudad_expedicion: userData?.ciudad_expedicion || null,
      
      // Fechas - convertir a ISO strings si existen
      fecha_expedicion: toIsoString(userData?.fecha_expedicion),
      fecha_nacimiento: toIsoString(userData?.fecha_nacimiento),
      created_time: toIsoString(userData?.created_time),
      
      // Personales
      genero: userData?.genero || null,
      ciudad_nacimiento: userData?.ciudad_nacimiento || null,
      ocupacion: userData?.ocupacion || null,
      
      // Residencia
      direccion: userData?.direccion || null,
      barrio: userData?.barrio || null,
      ciudad: userData?.ciudad || null,
      departamento: userData?.departamento || null,
      pais: userData?.pais || null,
      
      // Financieros - convertir a strings si son números
      ingresos: userData?.ingresos != null ? String(userData.ingresos) : null,
      egresos: userData?.egresos != null ? String(userData.egresos) : null,
      activos: userData?.activos != null ? String(userData.activos) : null,
      patrimonio: userData?.patrimonio != null ? String(userData.patrimonio) : null,
      
      // Booleans de declaración
      flg_ppe: userData?.flg_ppe === true,
      flg_relatives_ppe: userData?.flg_relatives_ppe === true,
      
      // Empresa
      empresa: userData?.empresa || null,
      empresaref: typeof userData?.empresaref === 'string' ? userData.empresaref : null,
      cargo: userData?.cargo || null,
      tipo_vinculacion: userData?.tipo_vinculacion || null,
      
      // Recursos
      funds_source: userData?.funds_source || null,
      digite_otras_fuentes: userData?.digite_otras_fuentes || null,
      
      // Imágenes - solo URLs string
      fotofrontal: typeof userData?.fotofrontal === 'string' ? userData.fotofrontal : null,
      fototrasera: typeof userData?.fototrasera === 'string' ? userData.fototrasera : null,
      fotoperfil: typeof userData?.fotoperfil === 'string' ? userData.fotoperfil : null,
      verification_pdf: typeof userData?.verification_pdf === 'string' ? userData.verification_pdf : null,
      
      // Estado
      confirmacion_verificado: userData?.confirmacion_verificado === true,
      user_type: userData?.user_type || null
    };
    
    navigate("/personas/verificaciones/detalle", {
      state: { userData: cleanUserData }
    });
  };
  
  return (
    <Card className="bg-primary/5 border-none">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">{name}</h3>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <CreditCard size={14} />
          <span>{documentNumber}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Fecha de registro: {registrationDate}
        </p>
        <Button 
          variant="outline" 
          className="text-primary border-primary/30 hover:bg-primary/10 bg-primary/5"
          onClick={handleNavigation}
        >
          Iniciar la verificación
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Verificaciones() {
  const { toast } = useToast();
  const [usuariosVerificados, setUsuariosVerificados] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [selectedType, setSelectedType] = useState("cedula");
  const [cargando, setCargando] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const usuariosPorPagina = 9; // 3 filas de 3 usuarios
  
  // Formatear fecha
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };
  
  // Cargar usuarios verificados
  const cargarUsuariosVerificados = async () => {
    setCargando(true);
    try {
      const { obtenerUsuariosVerificados } = await import('@/supabase/database');
      const usuarios = await obtenerUsuariosVerificados();
      setUsuariosVerificados(usuarios); // Mostrar todos los usuarios
      setPaginaActual(1);
    } catch (error) {
      console.error("Error cargando usuarios verificados");
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setCargando(false);
    }
  };
  
  // Buscar usuario y mostrar resultados filtrados
  const buscarUsuario = async () => {
    const valor = searchValue.trim();

    if (!valor) {
      // Si no hay término de búsqueda, mostrar todos
      await cargarUsuariosVerificados();
      return;
    }
    
    setCargando(true);
    try {
      let usuarios = [];
      const { buscarUsuarioPorDocumento, buscarUsuarioPorEmail, buscarUsuarioPorCelular } = await import('@/supabase/database');
      
      if (selectedType === 'email') {
        usuarios = await buscarUsuarioPorEmail(valor);
      } else if (selectedType === 'celular') {
        usuarios = await buscarUsuarioPorCelular(valor);
      } else {
        usuarios = await buscarUsuarioPorDocumento(valor);
      }
      
      setUsuariosVerificados(usuarios);
      setPaginaActual(1); // Resetear a primera página
      
      if (usuarios.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron usuarios con ese criterio",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error buscando usuario");
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo completar la búsqueda",
        variant: "destructive",
      });
    } finally {
      setCargando(false);
    }
  };
  
  const getDynamicLabel = () => {
    switch (selectedType) {
      case "email":
        return "Ingrese el email";
      case "celular":
        return "Ingrese el celular";
      case "cedula":
        return "Ingrese el número de cédula";
      default:
        return "Ingrese el número de cédula";
    }
  };

  const getDynamicPlaceholder = () => {
    switch (selectedType) {
      case "email":
        return "Escribe el email";
      case "celular":
        return "Escribe el número de celular";
      case "cedula":
        return "Escribe el número de cédula";
      default:
        return "Escribe el número de cédula";
    }
  };
  
  useEffect(() => {
    cargarUsuariosVerificados();
  }, []);
  
  // Cálculos de paginación
  const totalPaginas = Math.ceil(usuariosVerificados.length / usuariosPorPagina);
  const indiceInicio = (paginaActual - 1) * usuariosPorPagina;
  const indiceFin = indiceInicio + usuariosPorPagina;
  const usuariosPaginados = usuariosVerificados.slice(indiceInicio, indiceFin);
  
  const cambiarPagina = (nuevaPagina) => {
    setPaginaActual(nuevaPagina);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <MainLayout sidebarType="personas">
      <Card className="bg-card border-border mb-6">
        <CardContent className="p-6">
          <PageHeader title="Verificación de identificación afiliado" showMenuButton={false} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Buscar por</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="celular">Celular</SelectItem>
                  <SelectItem value="cedula">Cédula</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{getDynamicLabel()}</label>
              <Input
                placeholder={getDynamicPlaceholder()}
                className="bg-background"
                value={searchValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchValue(value);
                  // Si el input está vacío, mostrar todos los usuarios
                  if (!value.trim()) {
                    cargarUsuariosVerificados();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!cargando) buscarUsuario();
                  }
                }}
              />
            </div>

            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-10"
              onClick={buscarUsuario}
              disabled={cargando}
            >
              {cargando ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          {/* Recientes */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">Usuarios Verificados</h2>
              <span className="text-sm text-muted-foreground">
                {usuariosVerificados.length} usuario{usuariosVerificados.length !== 1 ? 's' : ''} encontrado{usuariosVerificados.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {usuariosPaginados.map((user, index) => (
                <VerificationCard 
                  key={user.id || index} 
                  name={user.display_name || user.nombre || 'Sin nombre'}
                  documentNumber={user.nro_documento || user.nit || user.id || 'Sin documento'}
                  registrationDate={formatDate(user.created_time)}
                  userData={user}
                />
              ))}
            </div>
            
            {usuariosVerificados.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay usuarios verificados
              </div>
            )}
            
            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex justify-center mt-8">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cambiarPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
                      <Button
                        key={numero}
                        variant={paginaActual === numero ? "default" : "outline"}
                        size="sm"
                        onClick={() => cambiarPagina(numero)}
                        className="w-10"
                      >
                        {numero}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cambiarPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
