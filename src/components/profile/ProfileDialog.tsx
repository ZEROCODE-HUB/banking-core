import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  getProfileCompany,
  getProfileEmail,
  getProfileName,
  getProfilePhone,
  getProfileRole,
  type ProfileSource,
} from "@/lib/profile";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileSource | null;
}

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
 * Comparte formateo con ProfileCard para que ambos muestren lo mismo.
 */
export function ProfileDialog({ open, onOpenChange, user }: ProfileDialogProps) {
  const displayName = getProfileName(user);
  const role = getProfileRole(user);
  const email = getProfileEmail(user);
  const phone = getProfilePhone(user);
  const company = getProfileCompany(user);

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
          <ProfileAvatar user={user} className="w-14 h-14" />
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
