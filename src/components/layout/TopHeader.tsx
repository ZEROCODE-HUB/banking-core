import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import logoIcon from "@/assets/logo.png";

export function TopHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión");
    }
  };

  return (
    <header className="bg-transparent px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={logoIcon} alt="Core Bancario" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-foreground">Core</h1>
            <p className="text-sm text-muted-foreground">Bancario</p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:block">
          <ProfileCard user={user} onSettingsClick={() => setProfileOpen(true)} />
        </div>
        <div className="md:hidden">
          <ProfileCard user={user} compact onSettingsClick={() => setProfileOpen(true)} />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary hover:text-primary/80"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={20} />
        </Button>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />
    </header>
  );
}
