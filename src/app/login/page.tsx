"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const callbackUrl =
      typeof window === "undefined"
        ? "/"
        : new URLSearchParams(window.location.search).get("callbackUrl") || "/";

    if (mode === "register") {
      const name = (form.elements.namedItem("name") as HTMLInputElement)?.value || "";

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registrierung fehlgeschlagen.");
        setLoading(false);
        return;
      }

      // Auto-login after successful registration
    }

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        mode === "register"
          ? "Konto erstellt, aber Anmeldung fehlgeschlagen. Bitte melde dich manuell an."
          : "E-Mail oder Passwort ist falsch."
      );
    } else {
      router.replace(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h1
          className="text-xl font-semibold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Noes Planer
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {mode === "login"
            ? "Melde dich an, um fortzufahren."
            : "Erstelle ein neues Konto."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "register" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Name
              </label>
              <input
                name="name"
                type="text"
                autoComplete="name"
                className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              E-Mail
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Passwort
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
            {mode === "register" && (
              <span className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Mindestens 8 Zeichen
              </span>
            )}
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--accent-danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60"
            style={{
              background: "var(--accent-primary)",
              color: "#fff",
            }}
          >
            {loading
              ? mode === "login"
                ? "Wird angemeldet\u2026"
                : "Wird registriert\u2026"
              : mode === "login"
                ? "Anmelden"
                : "Konto erstellen"}
          </button>
        </form>

        <p className="text-xs text-center mt-5" style={{ color: "var(--text-muted)" }}>
          {mode === "login" ? (
            <>
              Noch kein Konto?{" "}
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); }}
                className="underline hover:opacity-80"
                style={{ color: "var(--accent-primary)" }}
              >
                Registrieren
              </button>
            </>
          ) : (
            <>
              Bereits ein Konto?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className="underline hover:opacity-80"
                style={{ color: "var(--accent-primary)" }}
              >
                Anmelden
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
