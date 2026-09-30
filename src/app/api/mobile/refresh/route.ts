import { NextRequest } from "next/server";
import { refreshForMobile } from "@/lib/mobile-auth";

// POST /api/mobile/refresh { refreshToken } -> new tokens for the iOS sync app
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
  if (!refreshToken) {
    return Response.json({ error: "refreshToken erforderlich" }, { status: 400 });
  }

  const session = await refreshForMobile(refreshToken);
  if (!session) {
    return Response.json({ error: "Sitzung abgelaufen" }, { status: 401 });
  }

  return Response.json(session);
}
