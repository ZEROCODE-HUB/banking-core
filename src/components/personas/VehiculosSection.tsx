import { useEffect, useState } from "react";
import { Calendar, Car, Bike, Download, User, Mail, CreditCard, Phone } from "lucide-react";
import { supabase } from "@/supabase/config";

interface Vehiculo {
  placa: string;
  titular: string;
  tipo: "carro" | "moto";
  soat: {
    tipo: string;
    estado: string;
    fechaCompra: string;
    fechaVencimiento: string;
    valor: string;
    proximoPago: string;
    documento: string;
  };
  tecnicomecanica: {
    tipo: string;
    estado: string;
    fechaCompra: string;
    fechaVencimiento: string;
    documento: string;
  };
  seguro: {
    tipo: string;
    estado: string;
    fechaCompra: string;
    aseguradora: string;
    documento: string;
  };
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function DocumentRow({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
          <span className="text-red-600 text-xs font-bold">PDF</span>
        </div>
        <span className="text-sm text-foreground">{name}</span>
      </div>
      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
        <Download className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

export function VehiculosSection() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehiculos = async () => {
      try {
        // Intenta traer de Supabase tabla vehiculos (creada para cedula 123123123)
        const { data, error } = await supabase.from("vehiculos").select("*").order("created_at", { ascending: true });
        if (!error && data && data.length > 0) {
          const mapped: Vehiculo[] = data.map((row: any) => ({
            placa: row.placa,
            titular: row.titular,
            tipo: row.tipo,
            soat: row.soat,
            tecnicomecanica: row.tecnicomecanica,
            seguro: row.seguro,
          }));
          setVehiculos(mapped);
        } else {
          // Fallback vacío - si no hay datos en Supabase no muestra mock hardcodeado
          setVehiculos([]);
        }
      } catch (e) {
        console.error("Error cargando vehiculos");
        setVehiculos([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVehiculos();
  }, []);

  if (loading) {
    return <div className="mt-6 p-6 bg-card rounded-xl text-center text-muted-foreground">Cargando vehículos...</div>;
  }

  if (vehiculos.length === 0) {
    return (
      <div className="mt-6 space-y-6">
        <div className="bg-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <InfoItem icon={User} label="Nombre y apellidos" value="David Isaac Alcántara Avalos" />
            <InfoItem icon={Mail} label="Correo electrónico" value="mock1@alianza.com" />
            <InfoItem icon={CreditCard} label="Identificación" value="123123123" />
            <InfoItem icon={Phone} label="Teléfono" value="573001112233" />
          </div>
        </div>
        <div className="bg-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Sin vehículos registrados para esta cédula. Inserta en Supabase tabla vehiculos.</p>
          <p className="text-xs text-muted-foreground mt-2">SQL: supabase-vehiculos-comentarios-reales.sql</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between">
          <InfoItem icon={User} label="Nombre y apellidos" value="David Isaac Alcántara Avalos" />
          <InfoItem icon={Mail} label="Correo electrónico" value="mock1@alianza.com" />
          <InfoItem icon={CreditCard} label="Identificación" value="123123123" />
          <InfoItem icon={Phone} label="Teléfono" value="573001112233" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {vehiculos.map((vehiculo, index) => (
          <div key={index} className="bg-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-foreground">{vehiculo.placa}</h3>
                <p className="text-sm text-muted-foreground">{vehiculo.titular}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                {vehiculo.tipo === "carro" ? <Car className="w-6 h-6 text-muted-foreground" /> : <Bike className="w-6 h-6 text-muted-foreground" />}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">SOAT</h4>
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">{vehiculo.soat.tipo}</span>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">{vehiculo.soat.estado}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha compra</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.soat.fechaCompra}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de vencimiento</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.soat.fechaVencimiento}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">$</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor SOAT</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.soat.valor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">$</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Próximo pago</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.soat.proximoPago}</p>
                  </div>
                </div>
              </div>
              <DocumentRow name={vehiculo.soat.documento} />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">Tecnicomecánica</h4>
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">{vehiculo.tecnicomecanica.tipo}</span>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">{vehiculo.tecnicomecanica.estado}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha compra</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.tecnicomecanica.fechaCompra}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de vencimiento</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.tecnicomecanica.fechaVencimiento}</p>
                  </div>
                </div>
              </div>
              <DocumentRow name={vehiculo.tecnicomecanica.documento} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">Seguro todo riesgo</h4>
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">{vehiculo.seguro.tipo}</span>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">{vehiculo.seguro.estado}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha compra</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.seguro.fechaCompra}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Aseguradora</p>
                    <p className="text-sm font-medium text-foreground">{vehiculo.seguro.aseguradora}</p>
                  </div>
                </div>
              </div>
              <DocumentRow name={vehiculo.seguro.documento} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
