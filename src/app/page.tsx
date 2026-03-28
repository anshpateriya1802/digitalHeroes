import Link from "next/link";
import { listCharities } from "@/lib/data";

export default async function Home() {
  let charities: Awaited<ReturnType<typeof listCharities>> = [];
  try {
    charities = await listCharities();
  } catch {
    charities = [];
  }

  const featured =
    charities.find((entry) => entry.featured) ??
    charities[0] ?? {
      id: "fallback",
      name: "Community Charity",
      slug: "community-charity",
      description: "Charity details will appear once your Supabase data is connected.",
      imageUrl: null,
      upcomingEvents: null,
      featured: true,
      active: true,
    };

  return (
    <div className="grid-fade min-h-screen text-foreground">
      <header className="mx-auto w-full max-w-6xl px-6 pt-8 pb-4 md:px-10">
        <nav className="hero-glass fade-in flex items-center justify-between rounded-2xl px-5 py-3">
          <div className="text-lg font-bold tracking-tight">Drive for Good</div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link className="rounded-full px-4 py-2 hover:bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]" href="/dashboard">
              Subscriber Panel
            </Link>
            <Link className="rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-[var(--ink)] hover:bg-[var(--surface-hover)]" href="/auth/sign-in">
              Sign In
            </Link>
            <Link className="rounded-full bg-[var(--brand)] px-4 py-2 text-white hover:bg-[var(--brand-strong)]" href="/auth/sign-up">
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pb-14 md:px-10">
        <section className="hero-glass fade-in rounded-3xl p-7 md:p-12">
          <div className="chip chip-brand inline-block">Golf with purpose</div>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
            Track your scores. Enter monthly draws. Fund real change.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
            A subscription platform where every round can lead to both prizes and charitable impact.
            Built for modern players, not old-school club websites.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/auth/sign-in" className="rounded-full border border-[var(--card-border)] bg-white px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]">
              Sign In
            </Link>
            <Link href="/auth/sign-up" className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
              Subscribe Now
            </Link>
            <Link href="#charities" className="rounded-full border border-[var(--card-border)] bg-white px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]">
              Explore Charities
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="card p-5 fade-in">
            <div className="chip chip-accent inline-block">How it works</div>
            <h2 className="mt-3 text-2xl font-semibold">1. Subscribe</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Choose monthly or yearly plan and unlock full access to score entry and draws.
            </p>
          </article>
          <article className="card p-5 fade-in">
            <div className="chip chip-accent inline-block">How it works</div>
            <h2 className="mt-3 text-2xl font-semibold">2. Enter Scores</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Keep your latest five Stableford scores current. Entries flow straight into draw eligibility.
            </p>
          </article>
          <article className="card p-5 fade-in">
            <div className="chip chip-accent inline-block">How it works</div>
            <h2 className="mt-3 text-2xl font-semibold">3. Win + Give Back</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Compete in monthly draw tiers while part of your subscription supports your chosen charity.
            </p>
          </article>
        </section>

        <section id="charities" className="card fade-in p-7 md:p-10">
          <div className="chip chip-brand inline-block">Featured Charity</div>
          <h2 className="mt-3 text-3xl font-semibold">{featured.name}</h2>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">{featured.description}</p>
          <p className="mt-4 text-sm font-medium text-[var(--ink)]">
            Upcoming: {featured.upcomingEvents ?? "No event announced"}
          </p>
        </section>

        <section className="card p-6">
          <h3 className="text-xl font-semibold">Monthly Draw Tiers</h3>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>5-match: 40% share with jackpot rollover</li>
            <li>4-match: 35% share</li>
            <li>3-match: 25% share</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
