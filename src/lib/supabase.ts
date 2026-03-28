import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 🔒 Public client (for auth, frontend-safe)
export const getSupabasePublic = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// 🔐 Admin client (server only)
export const getSupabaseAdmin = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};