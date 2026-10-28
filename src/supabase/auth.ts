import { supabase } from './config';

// Autenticación con Supabase Auth.

export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Error al iniciar sesión:', error.message);
    throw error;
  }
  return data.user;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error al cerrar sesión:', error.message);
    throw error;
  }
};

export const observarAuth = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  // devuelve la función para cancelar la suscripción
  return () => subscription.unsubscribe();
};

// Helper: obtener usuario actual
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
