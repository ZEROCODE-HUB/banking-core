import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ChevronLeft, LogOut, Play } from "lucide-react";
import logoAlianza from "@/assets/logo-alianza.png";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileDialog } from "@/components/profile/ProfileDialog";

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  isActive?: boolean;
  children?: { label: string; href: string }[];
}

interface SidebarSection {
  title: string;
  items: MenuItem[];
}

interface AppSidebarProps {
  sections: SidebarSection[];
  className?: string;
}

// Páginas que abren una subsección por defecto cuando la URL no trae
// `?seccion=`. El puntero debe marcarla igual que lo hace el contenido.
const DEFAULT_SECTION_BY_PATH: Record<string, string> = {
  "/personas/solicitudes": "ahorros",
  "/personas/cdat": "crear-cdat",
};

export function AppSidebar({ sections, className }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth(); // Agregar user del contexto de auth

  const isChildLinkActive = (href: string) => {
    const [path, search] = href.split("?");
    if (!path) return false;

    if (!search) {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }

    if (location.pathname !== path) return false;

    const expected = new URLSearchParams(search).get("seccion");
    const current =
      new URLSearchParams(location.search).get("seccion") ??
      DEFAULT_SECTION_BY_PATH[path] ??
      null;

    return expected !== null && expected === current;
  };

  const isChildActive = (children: { label: string; href: string }[] | undefined) => {
    if (!children) return false;
    return children.some((child) => isChildLinkActive(child.href));
  };

  // Auto-expand menus based on current route
  useEffect(() => {
    const routeBasedExpansions: string[] = [];
    
    // Always expand "Atención al cliente" for personas routes
    if (location.pathname.startsWith('/personas/')) {
      routeBasedExpansions.push("Atención al cliente");
    }

    // Expand "Solicitudes" for solicitudes routes
    if (location.pathname === '/personas/solicitudes') {
      routeBasedExpansions.push("Solicitudes");
    }

    // Expand "Ahorros" for retiro-ahorros route
    if (location.pathname.startsWith('/personas/retiro-ahorros')) {
      routeBasedExpansions.push("Ahorros");
    }
    
    // Expand "Crédito" for credit routes
    if (location.pathname.startsWith('/credito/')) {
      routeBasedExpansions.push("Crédito");
    }
    
    // Expand "CDAT" for cdat routes
    if (location.pathname.startsWith('/personas/cdat')) {
      routeBasedExpansions.push("CDAT");
    }
    
    // Expand "Fondos" for funds routes
    if (location.pathname.startsWith('/fondos/')) {
      routeBasedExpansions.push("Fondos");
    }

    // Check if any section has active children and expand them
    sections.forEach(section => {
      section.items.forEach(item => {
        if (item.children?.some((child) => isChildLinkActive(child.href))) {
          routeBasedExpansions.push(item.label);
        }
      });
    });
    
    // Merge with existing expanded items — never collapse manually-opened items
    setExpandedItems(prev => [...new Set([...prev, ...routeBasedExpansions])]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión");
    }
  };

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  // Calculate menu height based on content
  const menuHeight = sections.reduce((acc, section) => {
    const sectionHeight = 40; // section title
    const itemsHeight = section.items.reduce((itemAcc, item) => {
      const baseHeight = 48; // item height
      const childrenHeight = item.children && expandedItems.includes(item.label) 
        ? item.children.length * 40 
        : 0;
      return itemAcc + baseHeight + childrenHeight;
    }, 0);
    return acc + sectionHeight + itemsHeight;
  }, 180); // base for header

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen transition-all duration-300 sticky top-0",
        collapsed ? "w-20" : "w-72",
        className
      )}
    >
      {/* Blue background container that only covers the menu area */}
      <div 
        className="bg-sidebar rounded-r-3xl flex flex-col transition-all duration-300"
        style={{ minHeight: Math.min(menuHeight + 80, 500), maxHeight: "fit-content" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          {/* Logo - expands sidebar when collapsed */}
          <button 
            onClick={() => collapsed && setCollapsed(false)}
            className={cn("flex items-center gap-3", collapsed && "justify-center w-full cursor-pointer")}
          >
            <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center">
              <img src={logoAlianza} alt="Core Bancario" className="w-6 h-6 object-contain" />
            </div>
            {!collapsed && (
              <div className="text-left">
                <h1 className="font-bold text-lg leading-tight text-sidebar-foreground">Core</h1>
                <p className="text-sm text-sidebar-foreground/80">Bancario</p>
              </div>
            )}
          </button>
          
          {/* Collapse button - only visible when expanded */}
          {!collapsed && (
            <button 
              onClick={() => setCollapsed(true)}
              aria-label="Contraer menú lateral"
              className="w-8 h-8 bg-card text-foreground rounded-lg flex items-center justify-center hover:bg-card/90 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-4">
              {!collapsed && (
                <h2 className="px-4 mb-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
                  {section.title}
                </h2>
              )}
              
              {/* Translucent container for menu items */}
              <div className="mx-2 bg-white/10 backdrop-blur-sm rounded-xl p-2">
                <ul className="space-y-1">
                  {section.items.map((item, itemIndex) => {
                    const isExpanded = expandedItems.includes(item.label);
                    const hasChildren = item.children && item.children.length > 0;
                    const isActiveParent = isChildActive(item.children);
                    const isActive = location.pathname === item.href || isActiveParent;

                    return (
                      <li key={itemIndex}>
                        {hasChildren ? (
                          <>
                            <button
                              onClick={() => toggleExpand(item.label)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                                isActive 
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                  : "hover:bg-white/10 text-sidebar-foreground"
                              )}
                            >
                              {item.icon}
                              {!collapsed && (
                                <>
                                  <span className="flex-1 text-left font-medium">{item.label}</span>
                                  <Play 
                                    size={12} 
                                    className={cn(
                                      "transition-transform fill-current",
                                      isExpanded && "rotate-90"
                                    )} 
                                  />
                                </>
                              )}
                            </button>
                            {isExpanded && !collapsed && (
                              <ul className="mt-1 ml-6 space-y-1">
                                {item.children?.map((child, childIndex) => {
                                  const childActive = isChildLinkActive(child.href);

                                  return (
                                    <li key={childIndex}>
                                      <Link
                                        to={child.href}
                                        aria-current={childActive ? "page" : undefined}
                                        className={cn(
                                          "flex items-center gap-2 pl-2 py-2 text-sm transition-colors rounded-lg",
                                          childActive
                                            ? "text-sidebar-foreground font-semibold"
                                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                                        )}
                                      >
                                        {/* Espacio fijo: el puntero no debe mover el texto al activarse */}
                                        <span
                                          aria-hidden="true"
                                          className="w-2.5 shrink-0 flex items-center justify-center"
                                        >
                                          {childActive && <Play size={10} className="fill-current" />}
                                        </span>
                                        {child.label}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </>
                        ) : (
                          <Link
                            to={item.href || "#"}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                              isActive 
                                ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                : "hover:bg-white/10 text-sidebar-foreground"
                            )}
                          >
                            {item.icon}
                            {!collapsed && (
                              <span className="font-medium">{item.label}</span>
                            )}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* User Profile - Outside blue area */}
      <div className="mt-auto p-4">
        <ProfileCard
          user={user}
          compact={collapsed}
          onSettingsClick={() => setProfileOpen(true)}
        />
        <button 
          onClick={handleLogout}
          className={cn(
            "mt-4 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors w-full",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
        </button>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />
    </aside>
  );
}
