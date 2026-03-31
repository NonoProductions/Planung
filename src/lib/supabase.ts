import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key.
// This bypasses RLS — all authorization is enforced by Next.js API route middleware.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser (no NEXT_PUBLIC_ prefix).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
