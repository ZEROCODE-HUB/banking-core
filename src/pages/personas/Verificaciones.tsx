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

interface VerificationCardProps {
  name: string;
  documentNumber: string;
  registrationDate: string;
  userData?: any;
}

function VerificationCard({ name, documentNumber, registrationDate, userData }: VerificationCardProps) {
  const navigate = useNavigate();
  
  const handleNavigation = () => {
    // Limpiar userData para evitar problemas de clonación - solo primitivos
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
      tipoDocumento: userData?.tipoDocumento || null,
      nroDocumento: userData?.nroDocumento || null,
      ciudadExpedicion: userData?.ciudadExpedicion || null,
      
      // Fechas - convertir a strings si existen
      fechaExpedicion: userData?.fechaExpedicion ? 
        (userData.fechaExpedicion.toDate ? userData.fechaExpedicion.toDate().toISOString() : 
         userData.fechaExpedicion.toString()) : null,
      fecha_nacimiento: userData?.fecha_nacimiento ? 
        (userData.fecha_nacimiento.toDate ? userData.fecha_nacimiento.toDate().toISOString() : 
         userData.fecha_nacimiento.toString()) : null,
      created_time: userData?.created_time ? 
        (userData.created_time.toDate ? userData.created_time.toDate().toISOString() : 
         userData.created_time.toString()) : null,
      
      // Personales
      Genero: userData?.Genero || null,
      ciudad_nacimiento: userData?.ciudad_nacimiento || null,
      ocupacion: userData?.ocupacion || null,
      
      // Residencia
      direccion: userData?.direccion || null,
      barrio: userData?.barrio || null,
      ciudad: userData?.ciudad || null,
      departamento: userData?.departamento || null,
      pais: userData?.pais || null,
      
      // Financieros - convertir a strings si son números
      ingresos: userData?.ingresos ? userData.ingresos.toString() : null,
      egresos: userData?.egresos ? userData.egresos.toString() : null,
      activos: userData?.activos ? userData.activos.toString() : null,
      patrimonio: userData?.patrimonio ? userData.patrimonio.toString() : null,
      
      // Booleans de declaración
      figPPE: userData?.figPPE === true,
      figRelativasPPE: userData?.figRelativasPPE === true,
      
      // Empresa
      empresa: userData?.empresa || null,
      empresaref: typeof userData?.empresaref === 'string' ? userData.empresaref : null,
      cargo: userData?.cargo || null,
      tipoContrato: userData?.tipoContrato || null,
      
      // Recursos
      origenRecursos: userData?.origenRecursos || null,
      
      // Imágenes - solo URLs string
      fotofrontal: typeof userData?.fotofrontal === 'string' ? userData.fotofrontal : null,
      fototrasera: typeof userData?.fototrasera === 'string' ? userData.fototrasera : null,
      fotoperfil: typeof userData?.fotoperfil === 'string' ? userData.fotoperfil : null,
      verificationPDF: typeof userData?.verificationPDF === 'string' ? userData.verificationPDF : null,
      
      // Estado
      confirmacion_verificado: userData?.confirmacion_verificado === true,
      userType: userData?.userType || null
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
  const navigate = useNavigate();
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
    try {
      const { obtenerUsuariosVerificados } = await import('@/supabase/database');
      const usuarios = await obtenerUsuariosVerificados();
      setUsuariosVerificados(usuarios); // Mostrar todos los usuarios
    } catch (error) {
      console.error('Error cargando usuarios verificados:', error);
    }
  };
  
  // Buscar usuario y mostrar resultados filtrados
  const buscarUsuario = async () => {
    if (!searchValue.trim()) {
      // Si no hay término de búsqueda, mostrar todos
      cargarUsuariosVerificados();
      return;
    }
    
    setCargando(true);
    try {
      let usuarios = [];
      const { buscarUsuarioPorDocumento, buscarUsuarioPorEmail, buscarUsuarioPorCelular } = await import('@/supabase/database');
      
      if (selectedType === 'email') {
        usuarios = await buscarUsuarioPorEmail(searchValue);
      } else if (selectedType === 'celular') {
        usuarios = await buscarUsuarioPorCelular(searchValue);
      } else if (selectedType === 'cedula') {
        usuarios = await buscarUsuarioPorDocumento(searchValue);
      }
      
      setUsuariosVerificados(usuarios);
      setPaginaActual(1); // Resetear a primera página
      
      if (usuarios.length === 0) {
        alert(`No se encontraron usuarios con ese ${selectedType}`);
      }
    } catch (error) {
      console.error('Error buscando usuario:', error);
      alert('Error al buscar usuario');
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
              <label className="text-sm text-muted-foreground">Tipo de documento</label>
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
                onKeyPress={(e) => e.key === 'Enter' && buscarUsuario()}
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
                  documentNumber={user.nit || user.id || 'Sin documento'}
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
