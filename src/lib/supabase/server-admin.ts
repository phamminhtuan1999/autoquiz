import { createClient } from "@supabase/supabase-js";

type AdminEnvKey = "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY";

const getEnv = (key: AdminEnvKey) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export const createServiceRoleClient = () => {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      getEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false },
      }
    );
  }
  return supabaseAdmin;
};
