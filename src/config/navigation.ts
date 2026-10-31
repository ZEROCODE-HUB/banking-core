import sarlaftIcon from "@/assets/menu/sarlaft.png";
import conveniosIcon from "@/assets/menu/convenios.png";
import contabilidadIcon from "@/assets/menu/contabilidad.png";
import areaFinancieraIcon from "@/assets/menu/area-financiera.png";
import legalIcon from "@/assets/menu/legal.png";
import huellaConsultaIcon from "@/assets/menu/huella-consulta.png";
import consultarIcon from "@/assets/menu/consultar.png";
import inicioIcon from "@/assets/menu/inicio.svg";
import personasIcon from "@/assets/menu/personas.png";
import empresasIcon from "@/assets/menu/empresas.png";
import fondosIcon from "@/assets/menu/fondos.png";
import productosIcon from "@/assets/menu/productos.png";

export type NavigationId =
  | "inicio"
  | "consultar"
  | "personas"
  | "empresas"
  | "fondos"
  | "sarlaft"
  | "convenios"
  | "contabilidad"
  | "credito"
  | "legal"
  | "huella"
  | "productos";

export interface NavigationItem {
  id: NavigationId;
  icon: string;
  label: string;
  path: string;
}

/**
 * Menú superior único. Cualquier cambio de destino se hace aquí y se refleja
 * en el dashboard, el header de MainLayout y los headers locales de
 * Contabilidad y Portafolio.
 *
 * Las entradas con path "#" todavía no tienen página asignada.
 */
export const homeNavigation: NavigationItem[] = [
  { id: "inicio", icon: inicioIcon, label: "Inicio", path: "/" },
  { id: "consultar", icon: consultarIcon, label: "Consultar", path: "/personas/consultar" },
  { id: "personas", icon: personasIcon, label: "Personas", path: "/personas/solicitudes" },
  { id: "empresas", icon: empresasIcon, label: "Empresas", path: "#" },
  { id: "fondos", icon: fondosIcon, label: "Fondos y Asociaciones", path: "/fondos/independientes" },
  { id: "sarlaft", icon: sarlaftIcon, label: "SARLAF", path: "#" },
  { id: "convenios", icon: conveniosIcon, label: "Convenios", path: "#" },
  { id: "contabilidad", icon: contabilidadIcon, label: "Contabilidad", path: "/contabilidad/ahorro" },
  { id: "credito", icon: areaFinancieraIcon, label: "Área financiera", path: "/credito/estado-general" },
  { id: "legal", icon: legalIcon, label: "Legal", path: "#" },
  { id: "huella", icon: huellaConsultaIcon, label: "Huella de consultas", path: "#" },
  { id: "productos", icon: productosIcon, label: "Productos", path: "/productos/portafolio" },
];

interface BuildHomeNavigationOptions {
  /** Algunas superficies (el dashboard) no muestran "Inicio". */
  includeHome?: boolean;
  /** Overrides puntuales de etiqueta por superficie. */
  labels?: Partial<Record<NavigationId, string>>;
}

/**
 * Construye una copia del menú con exclusiones o etiquetas por superficie.
 *
 * El nombre de la sección de crédito sigue pendiente de definición del
 * cliente: MainLayout usa "Crédito" y el resto "Área financiera". Cuando se
 * confirme el nombre definitivo, se elimina el override de MainLayout.
 */
export const buildHomeNavigation = ({
  includeHome = true,
  labels,
}: BuildHomeNavigationOptions = {}): NavigationItem[] =>
  homeNavigation
    .filter((item) => includeHome || item.id !== "inicio")
    .map((item) => ({ ...item, label: labels?.[item.id] ?? item.label }));
