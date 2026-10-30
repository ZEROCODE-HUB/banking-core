import { useState } from "react";
import { Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileDialog } from "@/components/layout/ProfileDialog";
import logoIcon from "@/assets/logo.png";

export function TopHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      console.clear(); // Limpiar consola al cerrar sesión
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // Obtener nombre del usuario - priorizar display_name de la BD
  const userName = user?.userData?.display_name || user?.displayName || user?.email || "Usuario";
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="font-semibold text-sm text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">Usuario administrador</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setProfileOpen(true)}
          title="Mi perfil"
          aria-label="Mi perfil"
        >
          <Settings size={20} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-primary hover:text-primary/80"
          onClick={handleLogout}
        >
          <LogOut size={20} />
        </Button>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />
    </header>
  );
}
