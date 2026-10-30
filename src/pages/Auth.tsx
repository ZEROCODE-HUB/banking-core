import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { login } from "@/supabase/auth";
import loginBackground from "@/assets/login-background.png";
import logoAlianza from "@/assets/logo-alianza.png";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login: authLogin } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. Autenticar con Supabase
      const user = await login(email, password) as any;
      if (!user) throw new Error("No se pudo autenticar");
      
      // 2. Buscar perfil en Supabase user_profiles por id (FK auth.users)
      const { supabase } = await import('@/supabase/config');
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      // Si no hay perfil, usar datos de auth directamente (admin sin perfil)
      const userData = {
        uid: user.id,
        email: user.email!,
        displayName: (profile as any)?.display_name || (profile as any)?.nombre || user.email,
        userData: profile ? { id: profile.id, ...profile } : { id: user.id, email: user.email },
        userType: (profile as any)?.user_type || (profile as any)?.userType || 'Admin'
      };
      
      // 3. Actualizar contexto de autenticación
      authLogin(userData);
      
      // 4. Redirigir a la página solicitada o al dashboard
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });

      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente",
      });
      
    } catch (error: any) {
      console.error("Error en login");
      toast({
        title: "Error de autenticación",
        description: error.message || "Credenciales inválidas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#1a2a4a]/70" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div 
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 flex items-center justify-center">
              <img src={logoAlianza} alt="Alianza" className="w-14 h-14 object-contain" />
            </div>
            <div className="text-white">
              <h1 className="font-bold text-lg leading-tight">Core</h1>
              <p className="text-sm opacity-80">Bancario</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Bienvenido!</h2>
            <p className="text-white/70 text-sm">
              Completa tus datos para Iniciar Sesión.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white text-sm font-medium">
                Correo electrónico
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="Escribe tu correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="!bg-[#1a3050]/80 border-white/20 text-white placeholder:text-white/50 pr-10 h-12 rounded-xl focus:border-primary focus:ring-primary focus:!bg-[#1a3050]/80 autofill:!bg-[#1a3050]/80"
                  style={{ backgroundColor: 'rgba(26, 48, 80, 0.8)' }}
                />
                <Mail 
                  size={18} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Escribe tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#1a3050]/80 border-white/20 text-white placeholder:text-white/50 pr-10 h-12 rounded-xl focus:border-primary focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-base shadow-lg shadow-primary/30"
            >
              {isLoading ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
