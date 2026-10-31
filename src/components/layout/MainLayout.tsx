import { ReactNode, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Users, ArrowRight, CreditCard, BarChart3, Wallet } from "lucide-react";
import menuIcon from "@/assets/menu-icon.png";
import fondosIcon from "@/assets/menu/fondos.png";
import { buildHomeNavigation } from "@/config/navigation";

interface MainLayoutProps {
  children: ReactNode;
  sidebarType: "personas" | "fondos" | "credito";
  pageTitle?: string;
}

const fondosSections = [
  {
    title: "FONDOS",
    items: [
      {
        label: "Fondos",
        icon: <img src={fondosIcon} alt="Fondos" className="w-5 h-5 object-contain" />,
        children: [
          { label: "Fondos independientes", href: "/fondos/independientes" },
          { label: "Fondos de empleado", href: "/fondos/empleado" },
        ],
      },
    ],
  },
];

const creditoSections = [
  {
    title: "PERSONAS", 
    items: [
      {
        label: "Solicitudes",
        icon: <Users size={20} />,
        children: [
          { label: "Ahorros", href: "/personas/solicitudes?seccion=ahorros" },
          { label: "Créditos", href: "/personas/solicitudes?seccion=creditos" },
          { label: "CDAT", href: "/personas/solicitudes?seccion=cdat" },
        ],
      },
      {
        label: "Ahorros", 
        icon: <Wallet size={20} />,
        children: [
          { label: "Retiro de ahorros", href: "/personas/retiro-ahorros" },
        ],
      },
      {
        label: "Crédito",
        icon: <CreditCard size={20} />,
        children: [
          { label: "Estado general", href: "/credito/estado-general" },
          { label: "Cartera", href: "/credito/cartera" },
        ],
      },
      {
        label: "CDAT",
        icon: <BarChart3 size={20} />,
        children: [
          { label: "Crear CDAT", href: "/personas/cdat?seccion=crear-cdat" },
          { label: "Legalización", href: "/personas/cdat?seccion=legalizacion" },
          { label: "Retiros", href: "/personas/cdat?seccion=retiros-cdat" },
          { label: "Estado general", href: "/personas/cdat?seccion=estado-general-cdat" },
        ],
      },
    ],
  },
];

// El nombre de la sección de crédito está pendiente de confirmación del cliente.
const homeMenuItems = buildHomeNavigation({ labels: { credito: "Crédito" } });

export function MainLayout({ children, sidebarType, pageTitle }: MainLayoutProps) {
  const { user } = useAuth();
  
  const personasSections = [
    {
      title: "PERSONAS",
      items: [
        {
          label: "Atención al cliente",
          icon: <Users size={20} />,
          children: [
            { label: "Consultar usuarios", href: "/personas/consultar" },
            ...(user?.userType === "CRM SuperAdmin" ? [{ label: "Verificaciones", href: "/personas/verificaciones" }] : []),
          ],
        },
      ],
    },
  ];

  const sections = sidebarType === "personas" 
    ? personasSections 
    : sidebarType === "fondos" 
    ? fondosSections 
    : creditoSections;
  const navigate = useNavigate();
  const [showHomeMenu, setShowHomeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar sections={sections} />
      <main className="flex-1 overflow-auto">
        {/* Top Header with hamburger menu */}
        <div className="flex items-center justify-between px-4 pt-8 pb-4">
          {pageTitle && (
            <h1 className="text-2xl font-semibold text-foreground">{pageTitle}</h1>
          )}
          <div className={`relative ${!pageTitle ? 'ml-auto' : ''}`} ref={menuRef}>
            <button 
              onClick={() => setShowHomeMenu(!showHomeMenu)}
              aria-label="Abrir menú de navegación"
              aria-expanded={showHomeMenu}
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
        </div>
        <div className="px-6 pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}
