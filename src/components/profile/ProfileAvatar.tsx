import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  getProfileInitials,
  getProfileName,
  getProfilePhoto,
  type ProfileSource,
} from "@/lib/profile";

interface ProfileAvatarProps {
  user: ProfileSource | null;
  className?: string;
}

/** Foto del perfil con respaldo en iniciales. Sin imagen genérica. */
export function ProfileAvatar({ user, className }: ProfileAvatarProps) {
  const name = getProfileName(user);
  const photo = getProfilePhoto(user);

  return (
    <Avatar className={cn("w-10 h-10", className)}>
      {photo && <AvatarImage src={photo} alt={name} />}
      <AvatarFallback>{getProfileInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
