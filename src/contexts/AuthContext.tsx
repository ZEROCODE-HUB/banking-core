import React, { createContext, useContext, useEffect, useState } from 'react';
import { observarAuth } from '@/supabase/auth';
import { supabase } from '@/supabase/config';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  display_name?: string;
  userData?: any;
  userType?: string;
  phone_number?: string;
  id?: string;
  empresa?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserDataFromSupabase = async (sbUser: any) => {
    try {
      console.log('🔄 Cargando datos del usuario desde Supabase...');
      console.log('📍 UID:', sbUser.id);

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        console.log('✅ Datos obtenidos:', {
          display_name: (profile as any).display_name ?? (profile as any).nombre,
          userType: (profile as any).user_type ?? (profile as any).userType,
        });

        const completeUserData: User = {
          uid: sbUser.id,
          email: sbUser.email || (profile as any).email,
          displayName: (profile as any).display_name ?? (profile as any).nombre ?? sbUser.email,
          display_name: (profile as any).display_name ?? (profile as any).nombre ?? sbUser.email,
          userType: (profile as any).user_type ?? (profile as any).userType,
          phone_number: (profile as any).phone_number,
          id: (profile as any).nit ?? (profile as any).id,
          empresa: (profile as any).empresa,
          userData: profile,
        };

        console.log('✅ Usuario completo:', completeUserData.display_name);
        return completeUserData;
      } else {
        console.warn('⚠️ Perfil no encontrado en user_profiles');
        return {
          uid: sbUser.id,
          email: sbUser.email!,
          displayName: sbUser.email,
          display_name: sbUser.email,
        };
      }
    } catch (error) {
      console.error('❌ Error:', error);
      return {
        uid: sbUser.id,
        email: sbUser.email!,
        displayName: sbUser.email,
        display_name: sbUser.email,
      };
    }
  };

  useEffect(() => {
    const unsubscribe = observarAuth(async (sbUser) => {
      console.log('🔐 Auth state changed:', sbUser ? sbUser.email : 'null');

      if (sbUser) {
        const completeUserData = await loadUserDataFromSupabase(sbUser);
        setUser(completeUserData);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (userData: User) => {
    if (!userData.display_name && userData.uid) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userData.uid)
          .maybeSingle();

        if (profile) {
          userData = {
            ...userData,
            display_name: (profile as any).display_name ?? (profile as any).nombre,
            displayName: (profile as any).display_name ?? (profile as any).nombre,
            userType: (profile as any).user_type ?? (profile as any).userType,
            userData: profile,
          };
        }
      } catch (error) {
        console.error('Error al cargar datos en login:', error);
      }
    }

    setUser(userData);
  };

  const logout = async () => {
    const { logout: sbLogout } = await import('@/supabase/auth');
    await sbLogout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
