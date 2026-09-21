import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { UserInfoModal } from "@/components/personas/UserInfoModal";
import { User, Phone, Mail, Building2, ArrowRight } from "lucide-react";
import { buscarUsuarioPor, obtenerEmpresaPorRef } from "@/supabase/database";
import { useToast } from "@/hooks/use-toast";

const tabs = [
  "Ahorro",
  "Crédito",
  "CDAT",
  "Comentarios",
  "Vehículos",
  "Historial",
  "Información adicional",
];

export default function ConsultarUsuarios() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Ahorro");
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedType, setSelectedType] = useState("cedula");
  const [searchValue, setSearchValue] = useState("");
  const [userData, setUserData] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    try {
      setIsSearching(true);
      const valor = searchValue;
      const tipo = selectedType === 'email' ? 'Email' : selectedType === 'celular' ? 'Celular' : 'Cédula';
      
      if (!valor || !tipo) {
        toast({ title: "Error", description: "Complete todos los campos", variant: "destructive" });
        return;
      }

      let campo;
      if (tipo === 'Email') campo = 'email';
      else if (tipo === 'Celular') campo = 'phone_number';
      else if (tipo === 'Cédula') campo = 'nit';

      const usuario = await buscarUsuarioPor(campo, valor);
      
      if (usuario) {
        let empresa = null;
        if (usuario.empresa) {
          empresa = await obtenerEmpresaPorRef(usuario.empresa);
        }
        
        navigate('/personas/consultar/detalle', { 
          state: { 
            userData: JSON.parse(JSON.stringify(usuario)),
            empresaData: empresa ? JSON.parse(JSON.stringify(empresa)) : null,
            searchType: tipo,
            searchValue: valor
          } 
        });
      } else {
        toast({ title: "Error", description: "Usuario no encontrado", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewDetails = () => {
    setShowUserModal(true);
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

  return (
    <MainLayout sidebarType="personas">
      <PageHeader title="Consultar usuarios" showMenuButton={false} />

      <div className="flex gap-6">
        {/* Search Form */}
        <Card className="bg-card border-0 w-[280px] flex-shrink-0">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-foreground font-normal">Tipo de documento</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-background border-border">
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
              <Label className="text-sm text-foreground font-normal">{getDynamicLabel()}</Label>
              <Input 
                placeholder={getDynamicPlaceholder()} 
                className="bg-background border-border"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>

            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {isSearching ? "Buscando..." : "Buscar"}
            </Button>
          </CardContent>
        </Card>

        {/* Right side - User Data or Placeholder */}
        <Card className="bg-card border-0 flex-1 min-h-[200px]">
          <CardContent className="p-6">
            {userData ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Datos del cliente</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Nombre</p>
                      <p className="text-sm font-medium">
                        {userData.display_name || `${userData.nombre || ''} ${userData.apellido || ''}`.trim() || 'No disponible'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{userData.email || 'No disponible'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      <p className="text-sm font-medium">{userData.phone_number || 'No disponible'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Identificación</p>
                      <p className="text-sm font-medium">{userData.nroDocumento || 'No disponible'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Empresa</p>
                      <p className="text-sm font-medium">{userData.empresa || 'No disponible'}</p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleViewDetails}
                  className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  Ver detalles completos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>Realiza una búsqueda para ver los resultados</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mt-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-card border-0 text-foreground hover:bg-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* User Info Modal */}
      <UserInfoModal open={showUserModal} onOpenChange={setShowUserModal} />
    </MainLayout>
  );
}
