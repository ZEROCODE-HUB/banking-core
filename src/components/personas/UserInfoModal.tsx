import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface UserInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData?: any;
  ahorrosData?: any[];
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

interface InfoSectionProps {
  title: string;
  children: React.ReactNode;
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="bg-muted/50 rounded-lg p-4">
        {children}
      </div>
    </div>
  );
}

export function UserInfoModal({ open, onOpenChange, userData, ahorrosData }: UserInfoModalProps) {
  // Obtener la línea de ahorro de nómina más reciente
  const ahorroNomina = (() => {
    const lineas = (ahorrosData || []).filter(a => a.SavingsType === 'Linea de Ahorro de nómina');
    if (!lineas.length) return null;
    return lineas.sort((a, b) => {
      const fechaA = a.fechacreacion?.seconds ?? 0;
      const fechaB = b.fechacreacion?.seconds ?? 0;
      return fechaB - fechaA;
    })[0];
  })();
  const formatDate = (dateValue) => {
    if (!dateValue) return 'No disponible';
    
    // Si es un objeto Timestamp de Firebase (con seconds)
    if (dateValue.seconds) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString('es-ES');
    }
    
    // Si ya es un Date
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('es-ES');
    }
    
    // Si es string
    if (typeof dateValue === 'string') {
      return dateValue;
    }
    
    return 'No disponible';
  };

  const formatCurrency = (value) => {
    if (!value) return '$0';
    // Los números vienen como string en Firebase, convertir primero
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
    if (isNaN(numValue)) return '$0';
    return '$' + numValue.toLocaleString('es-ES');
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold">Información adicional</DialogTitle>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </DialogHeader>
        
        <div className="p-6 pt-4">
          {/* Datos de registro */}
          <InfoSection title="Datos de registro">
            <div className="grid grid-cols-4 gap-4">
              <InfoRow label="Tipo de documento" value={userData?.tipoDocumento || 'No disponible'} />
              <InfoRow label="Número de documento" value={userData?.nroDocumento || userData?.id || 'No disponible'} />
              <InfoRow label="Fecha de expedición del documento" value={formatDate(userData?.fechaExpedicion)} />
              <InfoRow label="Ciudad de expedición del documento" value={userData?.ciudadExpedicion || 'No disponible'} />
            </div>
          </InfoSection>

          {/* Datos personales */}
          <InfoSection title="Datos personales">
            <div className="grid grid-cols-4 gap-4">
              <InfoRow label="Nombres y Apellidos" value={userData?.display_name || 'No disponible'} />
              <InfoRow label="Sexo" value={userData?.Genero || 'No especificado'} />
              <InfoRow label="Fecha de nacimiento" value={formatDate(userData?.fecha_nacimiento)} />
              <InfoRow label="Ciudad de nacimiento" value={userData?.ciudad_nacimiento || 'No disponible'} />
            </div>
          </InfoSection>

          {/* Datos de residencia */}
          <InfoSection title="Datos de residencia">
            <div className="grid grid-cols-3 gap-4">
              <InfoRow label="Dirección de residencia" value={userData?.direccion || 'No disponible'} />
              <InfoRow label="Barrio" value={userData?.barrio || 'No disponible'} />
              <InfoRow label="Ciudad de residencia" value={userData?.ciudad || 'No disponible'} />
            </div>
          </InfoSection>

          {/* Actividad económica */}
          <InfoSection title="Actividad económica">
            <div className="grid grid-cols-5 gap-4">
              <InfoRow label="Actividad" value={userData?.ocupacion || 'No especificado'} />
              <InfoRow label="Total ingresos mensuales" value={formatCurrency(userData?.ingresos)} />
              <InfoRow label="Total egresos mensuales" value={formatCurrency(userData?.egresos)} />
              <InfoRow label="Total activos" value={formatCurrency(userData?.activos)} />
              <InfoRow label="Total pasivos" value={formatCurrency(userData?.patrimonio)} />
            </div>
          </InfoSection>

          {/* Contacto */}
          <InfoSection title="Contacto">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Número de WhatsApp" value={userData?.phone_number || userData?.telefono1 || 'No disponible'} />
              <InfoRow label="Correo electrónico" value={userData?.email || 'No disponible'} />
            </div>
          </InfoSection>

          {/* Documento */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Documento</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="h-40 bg-muted flex items-center justify-center">
                  {userData?.fotofrontal ? (
                    <img src={userData.fotofrontal} alt="Documento frontal" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">No disponible</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-card text-center">
                  <span className="text-sm text-foreground">Frontal</span>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="h-40 bg-muted flex items-center justify-center">
                  {userData?.fototrasera ? (
                    <img src={userData.fototrasera} alt="Documento reverso" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">No disponible</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-card text-center">
                  <span className="text-sm text-foreground">Reverso</span>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="h-40 bg-muted flex items-center justify-center">
                  {userData?.fotoperfil ? (
                    <img src={userData.fotoperfil} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">No disponible</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-card text-center">
                  <span className="text-sm text-foreground">Selfie</span>
                </div>
              </div>
            </div>
          </div>

          {/* Datos de declaración y origen de recursos */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <InfoSection title="Datos de declaración">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">¿Es usted una persona políticamente expuesta (Decreto 830 de 2021)?.</p>
                  <p className="text-sm font-medium text-foreground">{userData?.figPPE ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">¿Tiene familiares hasta segundo grado de consanguinidad, segundo de afinidad y primero civil que sean PEP's?</p>
                  <p className="text-sm font-medium text-foreground">{userData?.figRelativasPPE ? 'Sí' : 'No'}</p>
                </div>
              </div>
            </InfoSection>

            <InfoSection title="Datos de origen de recursos">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Los recursos que entregaré en Ahorro y demás servicios provienen de las siguientes fuentes.</p>
                <p className="text-sm font-medium text-foreground">{userData?.fundsSource?.[0] || 'Salario'}</p>
              </div>
            </InfoSection>
          </div>

          {/* Datos de empresa */}
          {ahorroNomina && (
            <InfoSection title="Datos de empresa">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <InfoRow label="NIT de la empresa" value={ahorroNomina.CompanyNIT || 'No disponible'} />
                <InfoRow label="Empresa" value={ahorroNomina.CompayName || 'No disponible'} />
                <InfoRow label="Ciudad" value={ahorroNomina.Ubicaciontrabajo || 'No disponible'} />
                <InfoRow label="Tipo de contrato" value={ahorroNomina.TypeOfContact || 'No disponible'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Monto ahorrado" value={formatCurrency(ahorroNomina.Total_Savings_PreApproval)} />
                <InfoRow label="Profesión" value="-" />
              </div>
            </InfoSection>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <Button variant="outline" className="px-8 border-primary text-primary hover:bg-primary/10">
              Editar
            </Button>
            <Button variant="outline" className="px-8 border-border text-foreground hover:bg-muted">
              Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
