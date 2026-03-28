"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Charity {
  id: string;
  name: string;
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [charityId, setCharityId] = useState("");
  const [charityPercent, setCharityPercent] = useState("10");
  const [charityOptOut, setCharityOptOut] = useState(false);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasCharityOptions = charities.length > 0;

  useEffect(() => {
    async function loadCharities() {
      try {
        const response = await fetch("/api/charities");
        const text = await response.text();
        const data = text ? (JSON.parse(text) as { charities?: Charity[]; error?: string }) : {};

        if (!response.ok) {
          setError(data.error ?? "Unable to load charities right now.");
        }

        const nextCharities = data.charities ?? [];
        setCharities(nextCharities);
        if (nextCharities.length > 0) {
          setCharityId(nextCharities[0].id);
        } else {
          // Allow signup even when no charities are configured yet.
          setCharityOptOut(true);
        }
      } catch {
        setCharities([]);
        setCharityOptOut(true);
        setError("Unable to load charities right now.");
      }
    }

    void loadCharities();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!charityOptOut && !hasCharityOptions) {
      setError("No charity options are available yet. Please enable 'Skip charity contribution for now' or ask admin to add charities.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          charityId,
          charityPercent: Number(charityPercent),
          charityOptOut,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to create account.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unexpected error while creating account.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid-fade flex min-h-screen items-center justify-center px-6 py-10">
      <main className="hero-glass w-full max-w-md rounded-3xl p-8">
        <p className="chip chip-brand inline-block">Create Account</p>
        <h1 className="mt-4 text-3xl font-bold">Start your Drive for Good profile</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign up as a subscriber and select your charity from day one.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium" htmlFor="name">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
            placeholder="Your name"
          />

          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
            placeholder="you@example.com"
          />

          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
            placeholder="At least 6 characters"
          />

          <label className="block text-sm font-medium" htmlFor="charity">
            Preferred Charity
          </label>
          <select
            id="charity"
            value={charityId}
            onChange={(event) => setCharityId(event.target.value)}
            disabled={charityOptOut || !hasCharityOptions}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
          >
            {hasCharityOptions ? (
              charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))
            ) : (
              <option value="">No charities configured yet</option>
            )}
          </select>

          {!hasCharityOptions ? (
            <p className="text-xs text-[#9f2f2f]">
              No charity options are configured. An admin can add them from the Admin panel.
            </p>
          ) : null}

          <label className="block text-sm font-medium" htmlFor="charityPercent">
            Charity Contribution (%)
          </label>
          <input
            id="charityPercent"
            type="number"
            min={10}
            max={100}
            value={charityPercent}
            onChange={(event) => setCharityPercent(event.target.value)}
            disabled={charityOptOut}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
          />

          <label className="flex items-center gap-2 text-sm text-[var(--muted)]" htmlFor="charityOptOut">
            <input
              id="charityOptOut"
              type="checkbox"
              checked={charityOptOut}
              onChange={(event) => setCharityOptOut(event.target.checked)}
            />
            Skip charity contribution for now
          </label>

          {error ? <p className="text-sm text-[#9f2f2f]">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link className="font-semibold text-[var(--brand)]" href="/auth/sign-in">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
