import { createBrowserClient } from "@supabase/ssr";

// Access environment variables directly - Next.js replaces NEXT_PUBLIC_* at build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env file and restart the dev server.`
  );
}

export const createSupabaseBrowserClient = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey);
