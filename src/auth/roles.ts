/**
 * Roles del sistema. Los valores son los que se guardan en la base de datos
 * (`user_profiles.role`). No inventar strings en otros archivos: usar estas
 * constantes y `hasRole`.
 *
 * Un rol ausente o desconocido no concede nada. El valor por defecto de una
 * cuenta nueva debe ser `customer`, nunca un rol de personal.
 */
export const ROLES = {
  CRM_SUPERADMIN: "crm_superadmin",
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  CUSTOMER: "customer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  crm_superadmin: "CRM SuperAdmin",
  admin: "Administrador",
  supervisor: "Supervisor",
  customer: "Cliente",
};

/**
 * Clave canónica: minúsculas y sin espacios, guiones ni guiones bajos.
 * Acepta tanto `crm_superadmin` como `CRM SuperAdmin` o `Basic User`.
 */
const roleKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, "");

/** Valores que existieron antes de la migración (texto libre en `user_type`). */
const LEGACY_ROLE_MAP: Record<string, Role> = {
  crmsuperadmin: ROLES.CRM_SUPERADMIN,
  superadmin: ROLES.CRM_SUPERADMIN,
  admin: ROLES.ADMIN,
  administrador: ROLES.ADMIN,
  supervisor: ROLES.SUPERVISOR,
  basicuser: ROLES.CUSTOMER,
  customer: ROLES.CUSTOMER,
  cliente: ROLES.CUSTOMER,
};

export interface RoleSource {
  role?: unknown;
  userType?: unknown;
  userData?: { role?: unknown; user_type?: unknown } | null;
}

export const normalizeRole = (value: unknown): Role | null => {
  if (typeof value !== "string") return null;
  return LEGACY_ROLE_MAP[roleKey(value)] ?? null;
};

/** Resuelve el rol desde la sesión, aceptando el nombre nuevo y el heredado. */
export const getUserRole = (user: RoleSource | null | undefined): Role | null =>
  normalizeRole(user?.role) ??
  normalizeRole(user?.userType) ??
  normalizeRole(user?.userData?.role) ??
  normalizeRole(user?.userData?.user_type);

/** Deny by default: sin rol, o con un rol no listado, no hay acceso. */
export const hasRole = (
  user: RoleSource | null | undefined,
  ...roles: Role[]
): boolean => {
  const role = getUserRole(user);
  return role !== null && roles.includes(role);
};

export const isStaff = (user: RoleSource | null | undefined): boolean =>
  hasRole(user, ROLES.CRM_SUPERADMIN, ROLES.ADMIN, ROLES.SUPERVISOR);

export const getRoleLabel = (value: unknown): string => {
  const role = normalizeRole(value);
  return role ? ROLE_LABELS[role] : "Sin rol";
};
