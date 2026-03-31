import { getSupabaseClient } from "@/lib/supabase";

interface HealthStatus {
  status: "ok" | "error";
  supabase: "connected" | "missing_env" | "unreachable";
  error?: string;
  timestamp: string;
}

// GET /api/health
// Returns the health status of the Supabase connection.
// Does not require authentication so it can be used for uptime monitoring.
export async function GET(): Promise<Response> {
  const result: HealthStatus = {
    status: "ok",
    supabase: "connected",
    timestamp: new Date().toISOString(),
  };

  try {
    const client = getSupabaseClient();

    // Lightweight probe: fetch exactly one row from a known table.
    // The service-role key bypasses RLS, so this works even with no data.
    const { error } = await client.from("Channel").select("id").limit(1);

    if (error) {
      result.status = "error";
      result.supabase = "unreachable";
      result.error = error.message;
    }
  } catch (err) {
    result.status = "error";
    const e = err as { code?: string; message?: string };

    if (e.code === "MISSING_SUPABASE_ENV") {
      result.supabase = "missing_env";
    } else {
      result.supabase = "unreachable";
    }

    result.error = e.message ?? "Unknown error";
  }

  return Response.json(result, {
    status: result.status === "ok" ? 200 : 503,
  });
}
