/**
 * Utilidades de perfil compartidas por la tarjeta y el diálogo de perfil.
 *
 * El objeto de sesión de AuthContext mezcla datos de `auth.users` y de
 * `user_profiles`, y algunos campos llegan como referencias anidadas
 * (`empresa`). Estas funciones normalizan esa forma para que todas las
 * superficies muestren la misma información.
 */
export interface ProfileSource {
  email?: string;
  displayName?: string;
  display_name?: string;
  userType?: string;
  phone_number?: string;
  empresa?: unknown;
  userData?: Record<string, any> | null;
}

export const PROFILE_NO_DATA = "No registrado";

/** Acepta strings, números o referencias anidadas y devuelve algo imprimible. */
export const asProfileText = (value: unknown): string => {
  if (typeof value === "string") return value.trim() || PROFILE_NO_DATA;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const named =
      record.nombre ?? record.display_name ?? record.razon_social ?? record.name;
    if (typeof named === "string" && named.trim()) return named;
  }
  return PROFILE_NO_DATA;
};

export const getProfileName = (user: ProfileSource | null): string => {
  const candidates = [
    user?.userData?.display_name,
    user?.display_name,
    user?.displayName,
    user?.userData?.nombre,
    user?.email,
  ];
  for (const candidate of candidates) {
    const text = asProfileText(candidate);
    if (text !== PROFILE_NO_DATA) return text;
  }
  return "Usuario";
};

export const getProfileInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

/** Foto real del perfil; si no existe, la tarjeta cae a las iniciales. */
export const getProfilePhoto = (user: ProfileSource | null): string | undefined => {
  const candidates = [user?.userData?.photo_url, user?.userData?.fotoperfil];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
};

export const getProfileRole = (user: ProfileSource | null): string =>
  asProfileText(user?.userType ?? user?.userData?.user_type);

export const getProfileEmail = (user: ProfileSource | null): string =>
  asProfileText(user?.email ?? user?.userData?.email);

export const getProfilePhone = (user: ProfileSource | null): string =>
  asProfileText(user?.phone_number ?? user?.userData?.phone_number ?? user?.userData?.telefono1);

export const getProfileCompany = (user: ProfileSource | null): string =>
  asProfileText(user?.empresa ?? user?.userData?.empresa);
