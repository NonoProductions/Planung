import { NextRequest } from "next/server";
import { signInForMobile } from "@/lib/mobile-auth";

// POST /api/mobile/login { email, password } -> tokens for the iOS sync app
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return Response.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 });
  }

  const session = await signInForMobile(email, password);
  if (!session) {
    return Response.json({ error: "Login fehlgeschlagen" }, { status: 401 });
  }

  return Response.json(session);
}
