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
import { Search } from "lucide-react";
import { buscarUsuarioPor, obtenerEmpresaPorRef } from "@/supabase/database";
import { useToast } from "@/hooks/use-toast";

const SEARCH_TYPES = [
  { value: "cedula", label: "Cédula" },
  { value: "email", label: "Email" },
  { value: "celular", label: "Celular" },
];

export default function ConsultarUsuarios() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState("cedula");
  const [searchValue, setSearchValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const getDynamicLabel = () => {
    switch (selectedType) {
      case "email":
        return "Ingrese el email";
      case "celular":
        return "Ingrese el celular";
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
      default:
        return "Escribe el número de cédula";
    }
  };

  const handleSearch = async () => {
    const valor = searchValue.trim();

    if (!valor) {
      toast({
        title: "Error",
        description: "Ingrese un valor para buscar",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const campo =
        selectedType === "email" ? "email" :
        selectedType === "celular" ? "phone_number" :
        "nit";
      const searchType =
        selectedType === "email" ? "Email" :
        selectedType === "celular" ? "Celular" :
        "Cédula";

      const usuario = await buscarUsuarioPor(campo, valor);

      if (!usuario) {
        toast({
          title: "Error",
          description: "Usuario no encontrado",
          variant: "destructive",
        });
        return;
      }

      let empresa = null;
      if (usuario.empresa) {
        empresa = await obtenerEmpresaPorRef(usuario.empresa);
      }

      navigate("/personas/consultar/detalle", {
        state: {
          userData: JSON.parse(JSON.stringify(usuario)),
          empresaData: empresa ? JSON.parse(JSON.stringify(empresa)) : null,
          searchType,
          searchValue: valor,
        },
      });
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

  return (
    <MainLayout sidebarType="personas">
      <PageHeader title="Consultar usuarios" showMenuButton={false} />

      <div className="flex gap-6">
        {/* Search Form */}
        <Card className="bg-card border-0 w-[280px] flex-shrink-0">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-foreground font-normal">Buscar por</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
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
                onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearch()}
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

        {/* Search help */}
        <Card className="bg-card border-0 flex-1 min-h-[200px]">
          <CardContent className="p-6">
            <div className="h-full min-h-[152px] flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Busca un usuario para ver su detalle</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Puedes buscar por cédula, correo electrónico o celular. Al encontrar una coincidencia
                se abrirá el detalle del cliente con sus ahorros, CDAT, documentos e historial.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
