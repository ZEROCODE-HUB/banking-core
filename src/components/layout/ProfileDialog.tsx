import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileDialogUser {
  email?: string;
  displayName?: string;
  display_name?: string;
  userType?: string;
  phone_number?: string;
  empresa?: unknown;
  userData?: Record<string, any> | null;
}

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileDialogUser | null;
}

const NO_DATA = "No registrado";

/** Acepta strings, números o referencias anidadas y devuelve algo imprimible. */
const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim() || NO_DATA;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const named =
      record.nombre ?? record.display_name ?? record.razon_social ?? record.name;
    if (typeof named === "string" && named.trim()) return named;
  }
  return NO_DATA;
};

const getDisplayName = (user: ProfileDialogUser | null): string => {
  const candidates = [
    user?.userData?.display_name,
    user?.display_name,
    user?.displayName,
    user?.userData?.nombre,
    user?.email,
  ];
  for (const candidate of candidates) {
    const text = asText(candidate);
    if (text !== NO_DATA) return text;
  }
  return "Usuario";
};

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

const getPhoto = (user: ProfileDialogUser | null): string | undefined => {
  const photoUrl = user?.userData?.photo_url;
  if (typeof photoUrl === "string" && photoUrl.trim()) return photoUrl;
  const fotoPerfil = user?.userData?.fotoperfil;
  if (typeof fotoPerfil === "string" && fotoPerfil.trim()) return fotoPerfil;
  return undefined;
};

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  );
}

/**
 * Vista de solo lectura de los datos de la sesión actual.
 * No escribe en user_profiles: la edición queda pendiente de definición.
 */
export function ProfileDialog({ open, onOpenChange, user }: ProfileDialogProps) {
  const displayName = getDisplayName(user);
  const role = asText(user?.userType ?? user?.userData?.user_type);
  const email = asText(user?.email ?? user?.userData?.email);
  const phone = asText(user?.phone_number ?? user?.userData?.phone_number ?? user?.userData?.telefono1);
  const company = asText(user?.empresa ?? user?.userData?.empresa);
  const photo = getPhoto(user);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md w-[95vw] p-6 bg-card"
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Mi perfil
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            {photo && <AvatarImage src={photo} alt={displayName} />}
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{role}</p>
          </div>
        </div>

        <div className="bg-[#F8F8FA] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Correo electrónico" value={email} className="sm:col-span-2" />
          <Field label="Rol" value={role} />
          <Field label="Teléfono" value={phone} />
          <Field label="Empresa" value={company} className="sm:col-span-2" />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Vista de solo lectura. La edición del perfil estará disponible más adelante.
        </p>
      </DialogContent>
    </Dialog>
  );
}
