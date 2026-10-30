import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  getProfileName,
  getProfileRole,
  type ProfileSource,
} from "@/lib/profile";

interface ProfileCardProps {
  user: ProfileSource | null;
  /** Oculta nombre y rol; la foto pasa a ser el disparador del perfil. */
  compact?: boolean;
  /** Si se entrega, se muestra el botón de ajustes. */
  onSettingsClick?: () => void;
  className?: string;
}

/**
 * Bloque de identidad del usuario con la misma información en todas las
 * superficies: foto (o iniciales), nombre y rol real de `user_type`.
 */
export function ProfileCard({
  user,
  compact = false,
  onSettingsClick,
  className,
}: ProfileCardProps) {
  const name = getProfileName(user);
  const role = getProfileRole(user);

  if (compact) {
    return (
      <div className={cn("flex items-center justify-center min-w-0", className)}>
        <button
          type="button"
          onClick={onSettingsClick}
          disabled={!onSettingsClick}
          title="Mi perfil"
          aria-label="Mi perfil"
          className={cn(
            "rounded-full transition-opacity",
            onSettingsClick ? "hover:opacity-80 cursor-pointer" : "cursor-default"
          )}
        >
          <ProfileAvatar user={user} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <ProfileAvatar user={user} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{role}</p>
      </div>
      {onSettingsClick && (
        <button
          type="button"
          onClick={onSettingsClick}
          title="Mi perfil"
          aria-label="Mi perfil"
          className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Settings size={18} />
        </button>
      )}
    </div>
  );
}
