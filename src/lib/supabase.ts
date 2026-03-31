import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseEnvError = Error & { code: string };

let cachedClient: SupabaseClient | null = null;

function createMissingEnvError(missingEnvNames: string[]): SupabaseEnvError {
  const error = new Error(
    `Missing Supabase environment variables: ${missingEnvNames.join(", ")}`
  ) as SupabaseEnvError;

  error.code = "MISSING_SUPABASE_ENV";
  return error;
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingEnvNames = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean) as string[];

  if (missingEnvNames.length > 0) {
    throw createMissingEnvError(missingEnvNames);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw createMissingEnvError([
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean) as string[]);
  }

  // Server-only client using the service role key.
  // This bypasses RLS; authorization is enforced by the proxy and route handlers.
  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client as object, property, receiver);

    return typeof value === "function" ? value.bind(client) : value;
  },
});
