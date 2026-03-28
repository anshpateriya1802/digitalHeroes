"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "loading" | "bootstrap" | "login";

export default function ControlRoomPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("System Admin");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadState() {
      try {
        const response = await fetch("/api/admin/access");
        const data = (await response.json()) as { hasAdmin?: boolean };
        setMode(data.hasAdmin ? "login" : "bootstrap");
      } catch {
        setMode("login");
      }
    }

    void loadState();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "bootstrap" ? "bootstrap" : "login",
          adminId,
          password,
          fullName,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to continue.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid-fade flex min-h-screen items-center justify-center px-6 py-10">
      <main className="hero-glass w-full max-w-md rounded-3xl p-8">
        <p className="chip chip-accent inline-block">Restricted</p>
        <h1 className="mt-4 text-3xl font-bold">Admin Control Room</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "bootstrap"
            ? "Create your admin ID and password for first-time setup."
            : "Enter your admin ID and password to continue."}
        </p>

        {mode === "loading" ? (
          <p className="mt-6 text-sm text-[var(--muted)]">Loading access state...</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {mode === "bootstrap" ? (
              <>
                <label className="block text-sm font-medium" htmlFor="fullName">
                  Admin Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
                  placeholder="System Admin"
                  required
                />
              </>
            ) : null}

            <label className="block text-sm font-medium" htmlFor="adminId">
              Admin ID
            </label>
            <input
              id="adminId"
              type="text"
              value={adminId}
              onChange={(event) => setAdminId(event.target.value.toLowerCase())}
              className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
              placeholder="admin-root"
              required
            />

            <label className="block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />

            {error ? <p className="text-sm text-[#9f2f2f]">{error}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading
                ? "Please wait..."
                : mode === "bootstrap"
                  ? "Create Admin Access"
                  : "Sign In as Admin"}
            </button>

            {mode === "login" ? (
              <p className="text-center text-sm">
                <Link className="font-semibold text-[var(--brand)]" href="/auth/forgot-password?context=admin">
                  Forgot admin password?
                </Link>
              </p>
            ) : null}
          </form>
        )}
      </main>
    </div>
  );
}
