import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, ChevronUp, ChevronDown, Play, ArrowRight, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/supabase/config";
import logoAlianza from "@/assets/logo-alianza.png";
import menuIcon from "@/assets/menu-icon.png";
import productosIcon from "@/assets/menu/productos.png";

import { buildHomeNavigation } from "@/config/navigation";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileDialog } from "@/components/profile/ProfileDialog";

const homeMenuItems = buildHomeNavigation();

interface Producto {
  id?: string;
  tipo: string;
  ea: number;
  mv: number;
  category: "ahorros" | "credito" | "cdat";
}

interface EditingProduct {
  category: "ahorros" | "credito" | "cdat";
  index: number;
  producto: Producto;
}

export default function PortafolioServicios() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showHomeMenu, setShowHomeMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [portafolioExpanded, setPortafolioExpanded] = useState(true);
  const [cuentasExpanded, setCuentasExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<"ahorros" | "credito" | "cdat">("ahorros");
  const [nuevoTipo, setNuevoTipo] = useState("");
  const [nuevoEA, setNuevoEA] = useState("");
  const [nuevoMV, setNuevoMV] = useState("");
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Product data from Supabase
  const [ahorros, setAhorros] = useState<Producto[]>([]);
  const [creditos, setCreditos] = useState<Producto[]>([]);
  const [cdats, setCdats] = useState<Producto[]>([]);

  // Cargar datos desde Supabase
  const cargarProductos = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando productos desde Supabase...');
      
      const { data, error } = await supabase.from('services').select('*');
      if (error) throw error;
      
      const services = data ?? [];
      
      console.log('📊 Cantidad de servicios:', services.length);
      
      if (services.length === 0) {
        console.log('⚠️ No se encontraron documentos en la tabla services');
        console.log('🔍 Verificar:');
        console.log('   - Que la tabla se llame exactamente "services"');
        console.log('   - Que existan documentos en Supabase');
        console.log('   - Las políticas RLS de lectura');
        setAhorros([]);
        setCreditos([]);
        setCdats([]);
        return;
      }
      
      const productosAhorros: Producto[] = [];
      const productosCreditos: Producto[] = [];
      const productosCdats: Producto[] = [];
      
      services.forEach((data: any) => {
        console.log('📄 Documento service:', data.id, data);
        console.log('🏷️ service_main_type:', data.service_main_type);
        console.log('📝 types_of_product_name:', data.types_of_product_name);
        console.log('📊 ea:', data.ea);
        console.log('📈 mv:', data.mv);
        
        const producto: Producto = {
          id: data.id,
          tipo: data.types_of_product_name || 'Sin nombre',
          ea: data.ea || 0,
          mv: data.mv || 0,
          category: data.service_main_type === 'Ahorros' ? 'ahorros' : 
                   data.service_main_type === 'CDAT' ? 'cdat' : 'credito'
        };
        
        console.log('✅ Producto procesado:', producto);
        
        if (data.service_main_type === 'Ahorros') {
          productosAhorros.push(producto);
          console.log('💰 Agregado a Ahorros');
        } else if (data.service_main_type === 'CDAT') {
          productosCdats.push(producto);
          console.log('🏦 Agregado a CDAT');
        } else if (data.service_main_type === 'Credito') {
          productosCreditos.push(producto);
          console.log('💳 Agregado a Crédito');
        } else {
          console.log('⚠️ service_main_type no reconocido:', data.service_main_type);
        }
      });
      
      setAhorros(productosAhorros);
      setCreditos(productosCreditos);
      setCdats(productosCdats);
      
      console.log('✅ Productos cargados:');
      console.log('📊 Ahorros:', productosAhorros.length);
      console.log('💳 Créditos:', productosCreditos.length);
      console.log('🏦 CDATs:', productosCdats.length);
      
    } catch (error) {
      console.error('❌ Error cargando productos:', error);
      toast({
        title: "Error al cargar productos",
        description: "No se pudieron cargar los datos desde Supabase",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar productos al montar el componente
  useEffect(() => {
    cargarProductos();
  }, []);

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

  const handleOpenDialog = (category: "ahorros" | "credito" | "cdat") => {
    setCurrentCategory(category);
    setEditingProduct(null);
    setNuevoTipo("");
    setNuevoEA("");
    setNuevoMV("");
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (category: "ahorros" | "credito" | "cdat", index: number, producto: Producto) => {
    setCurrentCategory(category);
    setEditingProduct({ category, index, producto });
    setNuevoTipo(producto.tipo);
    setNuevoEA(producto.ea.toString());
    setNuevoMV(producto.mv.toString());
    setDialogOpen(true);
  };

  // Auto-calcular MV cuando cambie EA
  const handleEAChange = (value: string) => {
    setNuevoEA(value);
    const eaNumber = parseFloat(value);
    if (!isNaN(eaNumber)) {
      const calculatedMV = (eaNumber / 12).toFixed(2);
      setNuevoMV(calculatedMV);
    }
  };

  const handleSubmit = async () => {
    if (!nuevoTipo.trim()) {
      toast({
        title: "Error",
        description: "El tipo de producto es obligatorio",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      setSaving(true);
      
      const nuevoProducto: Producto = {
        tipo: nuevoTipo.trim(),
        ea: parseFloat(nuevoEA) || 0,
        mv: parseFloat(nuevoMV) || 0,
        category: currentCategory,
      };

      if (editingProduct) {
        // Actualizar producto existente
        console.log('🔄 Actualizando producto:', editingProduct.producto.id);
        
        if (editingProduct.producto.id) {
          const { error } = await supabase
            .from('services')
            .update({
              types_of_product_name: nuevoProducto.tipo,
              ea: nuevoProducto.ea,
              mv: nuevoProducto.mv,
              service_main_type: currentCategory === 'ahorros' ? 'Ahorros' : 
                              currentCategory === 'cdat' ? 'CDAT' : 'Credito',
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingProduct.producto.id);

          if (error) throw error;
        }
        
        toast({
          title: "Producto actualizado con éxito",
          duration: 3000,
        });
      } else {
        // Crear nuevo producto
        console.log('🆕 Creando nuevo producto:', nuevoProducto);
        
        const { error } = await supabase.from('services').insert({
          types_of_product_name: nuevoProducto.tipo,
          ea: nuevoProducto.ea,
          mv: nuevoProducto.mv,
          service_main_type: currentCategory === 'ahorros' ? 'Ahorros' : 
                          currentCategory === 'cdat' ? 'CDAT' : 'Credito',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
        
        toast({
          title: "Producto creado con éxito",
          duration: 3000,
        });
      }
      
      // Recargar productos
      await cargarProductos();
      
    } catch (error) {
      console.error('❌ Error guardando producto:', error);
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar el producto",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setSaving(false);
      setDialogOpen(false);
      setEditingProduct(null);
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

  const ProductTable = ({ 
    title, 
    products, 
    category,
    onAddNew,
    onEdit
  }: { 
    title: string; 
    products: Producto[];
    category: "ahorros" | "credito" | "cdat";
    onAddNew: () => void;
    onEdit: (index: number, producto: Producto) => void;
  }) => (
    <div className="bg-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <Button
          onClick={onAddNew}
          disabled={loading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 rounded-lg"
        >
          Agregar nuevo
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 text-sm font-medium text-muted-foreground">Tipo de producto</th>
              <th className="text-center py-3 text-sm font-medium text-muted-foreground">%E.A</th>
              <th className="text-center py-3 text-sm font-medium text-muted-foreground">%M.V</th>
              <th className="text-center py-3 text-sm font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Cargando productos...</span>
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No hay productos disponibles
                </td>
              </tr>
            ) : (
              products.map((product, index) => (
                <tr key={product.id || index} className="border-b border-border/50">
                  <td className="py-4 text-sm text-foreground">{product.tipo}</td>
                  <td className="py-4 text-sm text-foreground text-center">{product.ea}%</td>
                  <td className="py-4 text-sm text-foreground text-center">{product.mv}%</td>
                  <td className="py-4 text-center">
                    <button 
                      onClick={() => onEdit(index, product)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      disabled={loading}
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex flex-col h-screen w-72 sticky top-0">
        {/* Blue background container */}
        <div className="bg-sidebar rounded-r-3xl flex flex-col" style={{ minHeight: 320 }}>
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
                PRODUCTOS
              </h2>
              
              {/* Menu container */}
              <div className="mx-2 bg-white/10 backdrop-blur-sm rounded-xl p-2">
                <ul className="space-y-1">
                  {/* Portafolio parent item */}
                  <li>
                    <button
                      onClick={() => setPortafolioExpanded(!portafolioExpanded)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground transition-all"
                    >
                      <img src={productosIcon} alt="Portafolio" className="w-5 h-5 object-contain" />
                      <span className="flex-1 text-left font-medium">Portafolio</span>
                      <ChevronUp 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          !portafolioExpanded && "rotate-180"
                        )} 
                      />
                    </button>
                    {portafolioExpanded && (
                      <ul className="mt-1 ml-6 space-y-1">
                        <li>
                          <button
                            className="flex items-center gap-2 pl-2 py-2 text-sm transition-colors rounded-lg text-sidebar-foreground font-semibold"
                          >
                            <Play size={10} className="fill-current" />
                            Portafolio de servicios
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>

                  {/* Cuentas compensación */}
                  <li>
                    <button
                      onClick={() => setCuentasExpanded(!cuentasExpanded)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-sidebar-foreground transition-all"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18" />
                        <path d="M9 21V9" />
                      </svg>
                      <span className="flex-1 text-left font-medium">Cuentas compensación</span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          cuentasExpanded && "rotate-180"
                        )} 
                      />
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* User Profile - Outside blue area */}
        <div className="mt-auto p-4">
          <ProfileCard user={user} onSettingsClick={() => setProfileOpen(true)} />
          <button 
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors w-full bg-red-50 rounded-xl py-3 justify-center"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Cerrar sesión</span>
          </button>
        </div>

        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Content Card */}
        <div className="m-4">
          <div className="relative mb-6">
            {/* Top Header with hamburger menu */}
            <div className="absolute top-0 right-0" ref={menuRef}>
              <button 
                onClick={() => setShowHomeMenu(!showHomeMenu)}
                className="w-10 h-10 bg-card text-foreground rounded-lg flex items-center justify-center hover:bg-muted transition-colors border border-border"
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
            <h1 className="text-2xl font-semibold text-foreground">Portafolio de servicios</h1>
          </div>

          {/* Product Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProductTable 
              title="Ahorros" 
              products={ahorros}
              category="ahorros"
              onAddNew={() => handleOpenDialog("ahorros")}
              onEdit={(index, producto) => handleOpenEditDialog("ahorros", index, producto)}
            />
            <ProductTable 
              title="Crédito" 
              products={creditos}
              category="credito"
              onAddNew={() => handleOpenDialog("credito")}
              onEdit={(index, producto) => handleOpenEditDialog("credito", index, producto)}
            />
            <ProductTable 
              title="CDAT" 
              products={cdats}
              category="cdat"
              onAddNew={() => handleOpenDialog("cdat")}
              onEdit={(index, producto) => handleOpenEditDialog("cdat", index, producto)}
            />
          </div>
        </div>
      </main>

      {/* Add/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingProduct(null);
      }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md p-0 gap-0 border-0 shadow-xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-foreground">
              {editingProduct ? "Editar producto" : "Nuevo"}
            </h2>
          </div>

          {/* Form Content */}
          <div className="px-6 pb-6 space-y-5">
            {/* Tipo de producto */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Tipo de producto
              </label>
              <div className="bg-muted/50 rounded-xl">
                <Input
                  value={nuevoTipo}
                  onChange={(e) => setNuevoTipo(e.target.value)}
                  placeholder="Escribe el tipo de producto"
                  className="border-0 bg-transparent h-12 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {/* Efectivo anual % */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Efectivo anual %
              </label>
              <div className="bg-muted/50 rounded-xl">
                <Input
                  type="number"
                  step="0.01"
                  value={nuevoEA}
                  onChange={(e) => handleEAChange(e.target.value)}
                  placeholder="Escribe el % de efectivo anual"
                  className="border-0 bg-transparent h-12 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {/* Mes vencido % */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Mes vencido %
              </label>
              <div className="bg-muted/50 rounded-xl">
                <Input
                  type="number"
                  step="0.01"
                  value={nuevoMV}
                  onChange={(e) => setNuevoMV(e.target.value)}
                  placeholder="Auto-calculado como EA/12"
                  className="border-0 bg-transparent h-12 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit}
              disabled={saving}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl text-base mt-2"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingProduct ? "Guardando..." : "Creando..."}
                </div>
              ) : (
                editingProduct ? "Guardar" : "Crear"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
