import { createClient } from '@supabase/supabase-js';

// Supabase clon (vacío) - reemplaza src/firebase/config.js
// URL y anon key ya están en .env como VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Aliases para compatibilidad con código que importaba { db, auth, storage } desde firebase/config
export const db = supabase;
export const auth = supabase.auth;
export const storage = supabase.storage;

export default supabase;
