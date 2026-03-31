import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

// GET /api/channels
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await getSupabaseClient()
      .from("Channel")
      .select("*")
      .eq("userId", userId)
      .order("name", { ascending: true });

    if (error) throw error;

    return Response.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse([]);
    }
    throw error;
  }
}
