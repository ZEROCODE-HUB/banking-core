import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { actualizarDocumento, obtenerEmpresaPorRef } from "@/supabase/database";
import { useToast } from "@/hooks/use-toast";

interface DataFieldProps {
  label: string;
  value: string;
}

function DataField({ label, value }: DataFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

interface DataSectionProps {
  title: string;
  children: React.ReactNode;
}

function DataSection({ title, children }: DataSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="bg-muted/30 rounded-lg p-4">
        {children}
      </div>
    </div>
  );
}

export default function VerificacionDetalle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [userData, setUserData] = useState(location.state?.userData || null);
  const [empresaData, setEmpresaData] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [displayNameEditado, setDisplayNameEditado] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Formatear fecha
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      let date;
      
      // Si es un timestamp de Firebase
      if (dateValue && dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      }
      // Si es un timestamp (número)
      else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      }
      // Si es un string (incluye ISO strings)
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
      console.error('Error al formatear fecha:', error, dateValue);
      return 'N/A';
    }
  };

  // Formatear moneda
  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    // Convertir string a number si es necesario
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numAmount);
  };

  // Inicializar modo edición
  const handleEditar = () => {
    setModoEdicion(true);
    setDisplayNameEditado(userData?.display_name || '');
  };

  // Cancelar edición
  const handleCancelar = () => {
    setModoEdicion(false);
    setDisplayNameEditado('');
  };

  // Guardar cambios
  const handleGuardar = async () => {
    if (!userData || !displayNameEditado.trim()) return;
    
    // Usar el ID del documento de Firebase
    const documentId = userData.docId || userData.id;
    
    setGuardando(true);
    try {
      await actualizarDocumento('user', documentId, {
        display_name: displayNameEditado.trim()
      });
      
      // Actualizar userData local
      setUserData({
        ...userData,
        display_name: displayNameEditado.trim()
      });
      
      toast({
        title: "Nombre actualizado",
        description: "El nombre del usuario ha sido actualizado exitosamente",
        variant: "default"
      });
      
      setModoEdicion(false);
    } catch (error) {
      console.error('Error al actualizar nombre:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el nombre del usuario",
        variant: "destructive"
      });
    } finally {
      setGuardando(false);
    }
  };

  // Si no hay userData, redirigir
  useEffect(() => {
    if (!userData) {
      navigate('/personas/verificaciones');
    } else {
      // Cargar datos de empresa si hay referencia
      const cargarEmpresa = async () => {
        try {
          if (userData.empresaref) {
            const empresa = await obtenerEmpresaPorRef(userData.empresaref);
            setEmpresaData(empresa);
          }
        } catch (error) {
          console.error('Error cargando empresa:', error);
        }
      };
      cargarEmpresa();
    }
  }, [userData, navigate]);

  if (!userData) {
    return null;
  }

  return (
    <MainLayout sidebarType="personas">
      <div className="space-y-6">
        {/* Header con botón regresar */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-foreground hover:bg-muted/50"
          >
            <ArrowLeft size={18} className="mr-2" />
            Regresar
          </Button>
        </div>

        {/* Sección Documento */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Documento</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Frontal */}
              <div className="space-y-2">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                  {userData?.fotofrontal ? (
                    <img 
                      src={userData.fotofrontal} 
                      alt="Documento frontal"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span>No disponible</span>
                    </div>
                  )}
                </div>
                <div className="bg-muted/50 rounded-full py-2 text-center">
                  <span className="text-sm text-muted-foreground">Frontal</span>
                </div>
              </div>

              {/* Reverso */}
              <div className="space-y-2">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                  {userData?.fototrasera ? (
                    <img 
                      src={userData.fototrasera} 
                      alt="Documento reverso"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span>No disponible</span>
                    </div>
                  )}
                </div>
                <div className="bg-muted/50 rounded-full py-2 text-center">
                  <span className="text-sm text-muted-foreground">Reverso</span>
                </div>
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                  {userData?.fotoperfil ? (
                    <img 
                      src={userData.fotoperfil} 
                      alt="Selfie"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span>No disponible</span>
                    </div>
                  )}
                </div>
                <div className="bg-muted/50 rounded-full py-2 text-center">
                  <span className="text-sm text-muted-foreground">Selfie</span>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                className="min-w-[150px] border-border"
                onClick={() => navigate('/personas/verificaciones')}
              >
                Regresar
              </Button>
              
              {!modoEdicion ? (
                <Button 
                  variant="outline"
                  className="min-w-[150px] text-primary border-primary/30 hover:bg-primary/10"
                  onClick={handleEditar}
                >
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="min-w-[100px]"
                    onClick={handleCancelar}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="min-w-[100px] bg-primary hover:bg-primary/90"
                    onClick={handleGuardar}
                    disabled={guardando || !displayNameEditado.trim()}
                  >
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Datos de registro */}
        <DataSection title="Datos de registro">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <DataField label="Tipo de documento" value={userData?.tipoDocumento || 'No disponible'} />
            <DataField label="Numero de documento" value={userData?.nroDocumento || userData?.nit || userData?.id || 'No disponible'} />
            <DataField label="Fecha de expedición del documento" value={formatDate(userData?.fechaExpedicion)} />
            <DataField label="Ciudad de expedición del documento" value={userData?.ciudadExpedicion || 'No disponible'} />
          </div>
        </DataSection>

        {/* Datos personales */}
        <DataSection title="Datos personales">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Nombres y Apellidos</p>
              {modoEdicion ? (
                <input
                  type="text"
                  value={displayNameEditado}
                  onChange={(e) => setDisplayNameEditado(e.target.value)}
                  className="text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 w-full"
                  placeholder="Ingrese el nombre completo"
                />
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {userData?.display_name || `${userData?.nombre || ''} ${userData?.apellido || ''}`.trim() || 'No disponible'}
                </p>
              )}
            </div>
            <DataField label="Sexo" value={userData?.Genero || 'No disponible'} />
            <DataField label="Fecha de nacimiento" value={formatDate(userData?.fecha_nacimiento)} />
            <DataField label="Ciudad de nacimiento" value={userData?.ciudad_nacimiento || 'No disponible'} />
          </div>
        </DataSection>

        {/* Datos de residencia */}
        <DataSection title="Datos de residencia">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DataField label="Dirección de residencia" value={userData?.direccion || 'No disponible'} />
            <DataField label="Barrio" value={userData?.barrio || 'No disponible'} />
            <DataField label="Ciudad de residencia" value={userData?.ciudad || 'No disponible'} />
          </div>
        </DataSection>

        {/* Actividad económica */}
        <DataSection title="Actividad económica">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <DataField label="Actividad" value={userData?.ocupacion || 'No disponible'} />
            <DataField label="Total ingresos mensuales" value={formatCurrency(userData?.ingresos)} />
            <DataField label="Total egresos mensuales" value={formatCurrency(userData?.egresos)} />
            <DataField label="Total activos" value={formatCurrency(userData?.activos)} />
            <DataField label="Total patrimonio" value={formatCurrency(userData?.patrimonio)} />
          </div>
        </DataSection>

        {/* Contacto */}
        <DataSection title="Contacto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataField label="Número de WhatsApp" value={userData?.phone_number || userData?.telefono1 || 'No disponible'} />
            <DataField label="Correo electrónico" value={userData?.email || 'No disponible'} />
          </div>
        </DataSection>

        {/* Datos de declaración y Datos de origen de recursos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DataSection title="Datos de declaración">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DataField 
                label="¿Es usted una persona políticamente expuesta (Decreto 830 de 2021)?" 
                value={userData?.figPPE ? 'Sí' : 'No'} 
              />
              <DataField 
                label="¿Tiene familiares hasta segundo grado de consanguinidad, segundo de afinidad y primero civil que sean PEPs?" 
                value={userData?.figRelativasPPE ? 'Sí' : 'No'} 
              />
            </div>
          </DataSection>

          <DataSection title="Datos de origen de recursos">
            <DataField 
              label="Los recursos que entregaré en Ahorro y demás servicios provienen de las siguientes fuentes." 
              value={userData?.origenRecursos || 'Salario'} 
            />
          </DataSection>
        </div>

        {/* Datos de empresa */}
        <DataSection title="Datos de empresa">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
            <DataField label="NIT de la empresa" value={empresaData?.nit || userData?.nit || 'No disponible'} />
            <DataField label="Empresa" value={empresaData?.razonsocial || userData?.empresa || 'No disponible'} />
            <DataField label="Ciudad" value={empresaData?.ciudad || userData?.ciudad || 'No disponible'} />
            <DataField label="Tipo de contrato" value={userData?.tipoContrato || 'No disponible'} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataField label="Salario" value={formatCurrency(userData?.ingresos)} />
            <DataField label="Profesión" value={userData?.ocupacion || userData?.cargo || 'No disponible'} />
          </div>
        </DataSection>
      </div>
    </MainLayout>
  );
}
