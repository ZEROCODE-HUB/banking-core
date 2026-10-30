import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { obtenerTransaccionesPorEstadoRetiro, obtenerColeccion, obtenerSubcoleccion } from "@/supabase/database";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, History } from "lucide-react";
import { buildHomeNavigation } from "@/config/navigation";

interface TransactionCardProps {
  title: string;
  count: number;
  amount: string;
  onReview?: () => void;
  loading?: boolean;
}

function TransactionCard({ title, count, amount, onReview, loading }: TransactionCardProps) {
  return (
    <div className="bg-[#F0F0F2] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-muted-foreground font-normal">{title}</h3>
        <History size={20} className="text-muted-foreground" />
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="text-muted-foreground">Cargando...</span>
          </div>
        ) : (
          <>
            <span className="text-5xl font-light text-foreground">{count}</span>
            <div className="h-8 w-px bg-border"></div>
            <span className="text-2xl text-teal-500 font-medium">+ {amount}</span>
          </>
        )}
      </div>
      <button 
        onClick={onReview}
        className="flex items-center gap-1 text-primary text-sm font-medium hover:underline"
        disabled={loading}
      >
        Revisar <ArrowRight size={14} />
      </button>
    </div>
  );
}

interface MenuItemProps {
  icon: string;
  label: string;
  onClick?: () => void;
}

function MenuItem({ icon, label, onClick }: MenuItemProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <img src={icon} alt={label} className="w-6 h-6 object-contain" />
        </div>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Estado para los retiros pendientes
  const [retirosPendientes, setRetirosPendientes] = useState({ count: 0, amount: 0 });
  const [loadingRetiros, setLoadingRetiros] = useState(true);
  
  // Estado para los retiros CDAT pendientes
  const [retirosCDATpendientes, setRetirosCDATpendientes] = useState({ count: 0, amount: 0 });
  const [loadingRetirosCDAT, setLoadingRetirosCDAT] = useState(true);

  // Obtener nombre del usuario - priorizar display_name de la BD
  const userName = user?.userData?.display_name || user?.displayName || "Usuario";

  // 🔧 DEBUG temporal - eliminar después de verificar

  // Función para cargar retiros CDAT pendientes
  const cargarRetirosCDATpendientes = async () => {
    try {
      setLoadingRetirosCDAT(true);
      
      // Usar la misma lógica que RetirosCDATSection
      const cdats = await obtenerColeccion('Cdats');
      
      // Cargar retiros de todos los CDATs EN PARALELO
      const promesasRetiros = cdats.map(async (cdat) => {
        try {
          const retiros = await obtenerSubcoleccion(`Cdats/${cdat.id}`, 'confirmacionretiros');
          
          // Filtrar solo los de tipo "retiro" y estado pendiente
          const retirosPendientes = retiros.filter(retiro => {
            const esRetiro = retiro.tipodeoperacion === "retiro";
            const esPendiente = retiro.estados === 'pendiente'; // Cambio aquí: estados (no Estado) y === 'pendiente' (no includes)
            
            
            return esRetiro && esPendiente;
          });
          
          
          return retirosPendientes;
          
        } catch (error) {
          console.warn("Error cargando retiros del CDAT");
          return [];
        }
      });
      
      // Esperar todas las consultas y aplanar el resultado
      const resultados = await Promise.all(promesasRetiros);
      const todosLosRetirosCDAT = resultados.flat();
      
      // Calcular monto total
      const montoTotal = todosLosRetirosCDAT.reduce((total, retiro) => {
        const amount = retiro.monto || 0; // Cambio aquí: monto (no Monto)
        return total + amount;
      }, 0);
      
      
      setRetirosCDATpendientes({
        count: todosLosRetirosCDAT.length,
        amount: montoTotal
      });
      
    } catch (error) {
      console.error("❌ Error cargando retiros CDAT pendientes");
      setRetirosCDATpendientes({ count: 0, amount: 0 });
    } finally {
      setLoadingRetirosCDAT(false);
    }
  };
  const cargarRetirosPendientes = async () => {
    try {
      setLoadingRetiros(true);
      
      // Usar la misma función que funciona en Retiro de ahorros
      const transacciones = await obtenerTransaccionesPorEstadoRetiro('PENDING');
      
      // Calcular monto total
      const montoTotal = transacciones.reduce((total, transaccion) => {
        const amount = transaccion.amount || 0;
        return total + amount;
      }, 0);
      
      
      setRetirosPendientes({
        count: transacciones.length,
        amount: montoTotal
      });
      
    } catch (error) {
      console.error("❌ Error cargando retiros pendientes");
      setRetirosPendientes({ count: 0, amount: 0 });
    } finally {
      setLoadingRetiros(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarRetirosPendientes();
    cargarRetirosCDATpendientes();
  }, []);

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const menuItems = buildHomeNavigation({ includeHome: false });

  return (
    <div className="min-h-screen bg-background">
      <TopHeader />
      
      <main className="px-6 lg:px-10 pb-6 pt-2">
        {/* Welcome */}
        <div className="mb-6">
          <p className="text-muted-foreground text-base mb-1">Bienvenido,</p>
          <h1 className="text-4xl font-semibold text-foreground">{userName}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column - Transactions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Transacciones ACH */}
            <section className="bg-card rounded-2xl p-6">
              <h2 className="text-base font-medium text-foreground mb-4">Transacciones ACH</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TransactionCard 
                  title="Retiros pendientes de ahorros"
                  count={loadingRetiros ? 0 : retirosPendientes.count}
                  amount={loadingRetiros ? "$ 0" : formatCurrency(retirosPendientes.amount).replace('$', '$ ')}
                  loading={loadingRetiros}
                  onReview={() => navigate("/personas/retiro-ahorros")}
                />
                <TransactionCard 
                  title="Retiros pendientes de CDAT"
                  count={loadingRetirosCDAT ? 0 : retirosCDATpendientes.count}
                  amount={loadingRetirosCDAT ? "$ 0" : formatCurrency(retirosCDATpendientes.amount).replace('$', '$ ')}
                  loading={loadingRetirosCDAT}
                  onReview={() => navigate("/personas/cdat?seccion=retiros-cdat")}
                />
              </div>
            </section>

            {/* Solicitudes */}
            <section className="bg-card rounded-2xl p-6">
              <h2 className="text-base font-medium text-foreground mb-4">Solicitudes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TransactionCard 
                  title="Solicitudes pendientes de creditos"
                  count={0}
                  amount="$ 0.000"
                  onReview={() => navigate("/personas/solicitudes?seccion=creditos")}
                />
              </div>
            </section>
          </div>

          {/* Right Column - Menu */}
          <div className="space-y-2">
            {menuItems.map((item, index) => (
              <MenuItem 
                key={index} 
                icon={item.icon} 
                label={item.label}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
