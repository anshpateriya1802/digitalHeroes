import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseUrl() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (url.includes("supabase.com/dashboard")) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. Use your project API URL like https://<project-ref>.supabase.co, not the dashboard URL."
    );
  }
  return url;
}

export function getSupabaseAdmin() {
  return createClient(
    getSupabaseUrl(),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function getSupabasePublic() {
  return createClient(
    getSupabaseUrl(),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
