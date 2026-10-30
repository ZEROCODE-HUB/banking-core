import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HistorialSectionProps {
  docId: string;
}

interface AhorroItem {
  id: string;
  SavingsType: string;
  fechacreacion: any;
  montoTotal: number;
  Estado: string;
}

interface CDATItem {
  id: string;
  nombreusuario: string;
  documentousuario: string;
  Inversion: number;
  fechacreacion: any;
  Estado: string;
  firmado: boolean;
}

function Pagination() {
  return (
    <div className="flex justify-center mt-6">
      <nav className="flex items-center gap-1">
        <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded border border-border text-sm font-medium text-foreground">1</button>
        <button className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground hover:text-foreground">2</button>
        <button className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground hover:text-foreground">3</button>
        <span className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground">...</span>
        <button className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground hover:text-foreground">16</button>
        <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  );
}

function getAhorroStatusColor(estado: string) {
  switch (estado) {
    case "Activo":
      return "bg-green-100 text-green-700";
    case "Inactivo":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getCDATStatusColor(estado: string) {
  switch (estado) {
    case "Activo":
      return "bg-green-100 text-green-700";
    case "Pendiente de firma":
      return "bg-orange-100 text-orange-600";
    case "Inactivo":
      return "bg-red-100 text-red-600";
    case "Eliminado":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function HistorialSection({ docId }: HistorialSectionProps) {
  const [ahorroFilter, setAhorroFilter] = useState("todos");
  const [cdatFilter, setCdatFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todos");
  const [ahorros, setAhorros] = useState<AhorroItem[]>([]);
  const [cdats, setCdats] = useState<CDATItem[]>([]);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: any): string => {
    if (!date) return '';
    
    try {
      let dateObj;
      if (date.toDate && typeof date.toDate === 'function') {
        // Objeto timestamp con método toDate()
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        // String or other format
        dateObj = new Date(date);
      }
      
      return dateObj.toLocaleDateString('es-CO');
    } catch (error) {
      console.error("Error formatting date");
      return '';
    }
  };

  const cargarAhorros = async () => {
    try {
      const { obtenerAhorrosPorUsuario } = await import('@/supabase/database');
      const ahorrosData = await obtenerAhorrosPorUsuario(docId);
      const firmados = (ahorrosData || []).filter((a: any) => a.AhorrosDocPdf1 && a.AhorrosDocPdf1.trim() !== '');
      setAhorros(firmados);
    } catch (error) {
      console.error("Error cargando ahorros");
    }
  };

  const cargarCdats = async () => {
    try {
      const { obtenerCdatsPorUsuario } = await import('@/supabase/database');
      const cdatsData = await obtenerCdatsPorUsuario(docId);
      setCdats(cdatsData || []);
    } catch (error) {
      console.error("Error cargando CDATś");
    }
  };


  useEffect(() => {
    if (docId) {
      cargarAhorros();
      cargarCdats();
    }
  }, [docId]);

  const filteredAhorros = ahorros.filter(ahorro => {
    if (ahorro.SavingsType === "Linea de Ahorro de nómina") return false;
    if (ahorroFilter === "todos") return true;
    return ahorroFilter === "activo";
  });

  const filteredEmpresa = ahorros.filter(ahorro => {
    if (ahorro.SavingsType !== "Linea de Ahorro de nómina") return false;
    if (empresaFilter === "todos") return true;
    return empresaFilter === "activo";
  });

  const filteredCdats = cdats.filter(cdat => {
    if (cdatFilter === "todos") return true;
    
    switch (cdatFilter) {
      case "activo":
        return cdat.Estado?.toLowerCase() === "activo";
      case "pendiente-firma":
        return cdat.Estado?.toLowerCase() === "pendiente de firma";
      case "inactivo":
        return cdat.Estado?.toLowerCase() === "inactivo";
      case "eliminado":
        return cdat.Estado?.toLowerCase() === "eliminado";
      default:
        return true;
    }
  });

  return (
    <div className="mt-6 space-y-6">
      {/* Ahorros Table */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Ahorros</h3>
          <Select value={ahorroFilter} onValueChange={setAhorroFilter}>
            <SelectTrigger className="w-[120px] bg-background border-border">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Nombre del producto</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Fecha de apertura</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Monto Total Ahorro</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredAhorros.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-4 text-sm text-foreground">{item.SavingsType}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{formatDate(item.fechacreacion)}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{formatAmount(item.montoTotal)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getAhorroStatusColor("Activo")}`}>
                      Activo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination />
      </div>

      {/* Empresa (Línea de Ahorro de Nómina) Table */}
      {filteredEmpresa.length > 0 && (
        <div className="bg-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">Empresa</h3>
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="w-[120px] bg-background border-border">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Nombre del producto</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Fecha de apertura</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Monto Total Ahorro</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmpresa.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-3 px-4 text-sm text-foreground">{item.SavingsType}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{(item as any).CompayName || '-'}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{formatDate(item.fechacreacion)}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{formatAmount(item.montoTotal)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getAhorroStatusColor("Activo")}`}>
                        Activo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination />
        </div>
      )}

      {/* CDAT Table */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">CDAT</h3>
          <Select value={cdatFilter} onValueChange={setCdatFilter}>
            <SelectTrigger className="w-[120px] bg-background border-border">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="pendiente-firma">Pendiente de firma</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="eliminado">Eliminado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Nombres y apellidos</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Tipo de documento</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Inversión</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Fecha de solicitud</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredCdats.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-4 text-sm text-foreground">{item.nombreusuario}</td>
                  <td className="py-3 px-4 text-sm text-foreground">Cédula de Ciudadanía</td>
                  <td className="py-3 px-4 text-sm text-foreground">{formatAmount(item.Inversion)}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{formatDate(item.fechacreacion)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getCDATStatusColor(item.Estado)}`}>
                      {item.Estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination />
      </div>
    </div>
  );
}
