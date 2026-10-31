import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { HomeMenu } from "./HomeMenu";
import { useAuth } from "@/contexts/AuthContext";
import { Users, CreditCard, BarChart3, Wallet } from "lucide-react";
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

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar sections={sections} />
      <main className="flex-1 overflow-auto">
        {/* Top Header with hamburger menu */}
        <div className="flex items-center justify-between px-4 pt-8 pb-4">
          {pageTitle && (
            <h1 className="text-2xl font-semibold text-foreground">{pageTitle}</h1>
          )}
          <HomeMenu
            items={homeMenuItems}
            className={!pageTitle ? "relative ml-auto" : "relative"}
            buttonClassName="bg-card"
          />
        </div>
        <div className="px-6 pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}
