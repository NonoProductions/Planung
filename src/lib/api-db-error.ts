export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; code?: string };
  return (
    e.code === "MISSING_SUPABASE_ENV" ||
    e.code === "ECONNREFUSED" ||
    e.message?.includes("Missing Supabase environment variables") === true ||
    e.message?.includes("ECONNREFUSED") === true ||
    e.message?.includes("Failed to fetch") === true
  );
}

export function createDbUnavailableResponse<T>(fallbackData: T) {
  return Response.json(fallbackData, {
    status: 200,
    headers: {
      "x-db-unavailable": "true",
    },
  });
}
