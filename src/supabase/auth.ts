import { supabase } from './config';

// Reemplaza src/firebase/auth.js
// Firebase: signInWithEmailAndPassword(auth,email,pass) -> Supabase: signInWithPassword

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
  // compat: firebase devuelve unsubscribe function
  return () => subscription.unsubscribe();
};

// Helper: obtener usuario actual
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
