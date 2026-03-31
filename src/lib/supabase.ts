import { createClient } from "@supabase/supabase-js";

type SupabaseEnvError = Error & { code: string };

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    const err = new Error(
      `Missing Supabase environment variables: ${missing.join(", ")}`
    ) as SupabaseEnvError;
    err.code = "MISSING_SUPABASE_ENV";
    throw err;
  }

  // Server-only client using the service role key.
  // This bypasses RLS; authorization is enforced by proxy.ts and route handlers.
  _client = createClient(url!, key!);
  return _client;
}
