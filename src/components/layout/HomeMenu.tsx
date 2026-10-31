import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import menuIcon from "@/assets/menu-icon.png";
import type { NavigationItem } from "@/config/navigation";
import { isPendingNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface HomeMenuProps {
  items: NavigationItem[];
  /** Posicionamiento del contenedor (por ejemplo, "absolute top-6 right-6"). */
  className?: string;
  /** Color de fondo del botón, que cambia según la superficie. */
  buttonClassName?: string;
}

/**
 * Botón de menú superior y su desplegable. Es la única implementación del
 * menú de inicio: MainLayout, Contabilidad y Portafolio lo comparten para que
 * no vuelvan a divergir.
 */
export function HomeMenu({ items, className, buttonClassName }: HomeMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir menú de navegación"
        aria-expanded={open}
        className={cn(
          "w-10 h-10 text-foreground rounded-lg flex items-center justify-center hover:bg-muted transition-colors border border-border",
          buttonClassName
        )}
      >
        <img src={menuIcon} alt="Menú" className="w-5 h-5 object-contain" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-72 bg-card rounded-xl shadow-xl border border-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3">
            {items.map((item) => {
              const pending = isPendingNavigation(item);

              if (pending) {
                return (
                  <div
                    key={item.id}
                    aria-disabled="true"
                    className="w-full flex items-center justify-between p-3 rounded-lg opacity-60 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" />
                      </div>
                      <span className="font-medium text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Próximamente
                    </span>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setOpen(false);
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
