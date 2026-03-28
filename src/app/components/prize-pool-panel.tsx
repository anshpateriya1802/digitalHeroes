"use client";

import { useEffect, useState } from "react";

interface DrawDistribution {
  fiveMatch: { winners: number; perWinner: string };
  fourMatch: { winners: number; perWinner: string };
  threeMatch: { winners: number; perWinner: string };
}

interface DrawData {
  id: string;
  monthKey: string;
  mode: string;
  numbers: number[];
  published: boolean;
  publishedAt?: string;
  simulatedAt?: string;
  pool?: {
    total: number;
    pool5: number;
    pool4: number;
    pool3: number;
    rolloverIn: number;
    rolloverOut: number;
  };
  distribution: DrawDistribution;
}

export function PrizePoolPanel() {
  const [draws, setDraws] = useState<DrawData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDraw, setExpandedDraw] = useState<string | null>(null);

  useEffect(() => {
    loadDraws();
  }, []);

  async function loadDraws() {
    setLoading(true);
    const response = await fetch("/api/admin/draws");
    const data = (await response.json()) as { draws?: DrawData[]; error?: string };
    if (response.ok) {
      setDraws(data.draws ?? []);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="card p-6">
        <p className="text-sm text-[var(--muted)]">Loading draws...</p>
      </div>
    );
  }

  if (draws.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-sm text-[var(--muted)]">No draws yet.</p>
      </div>
    );
  }

  const totalPool = draws.reduce((sum, d) => sum + (d.pool?.total ?? 0), 0);
  const totalRollover = draws.reduce((sum, d) => sum + (d.pool?.rolloverOut ?? 0), 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total Prize Pool</p>
          <p className="mt-2 text-3xl font-bold">₹{totalPool.toFixed(2)}</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Rollover</p>
          <p className="mt-2 text-3xl font-bold">₹{totalRollover.toFixed(2)}</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Published Draws</p>
          <p className="mt-2 text-3xl font-bold">{draws.filter((d) => d.published).length}</p>
        </article>
      </section>

      <div className="card p-6">
        <h2 className="text-xl font-semibold">Draw History</h2>
        <ul className="mt-4 space-y-2">
          {draws.map((draw) => (
            <li key={draw.id} className="rounded-xl border border-[var(--card-border)]">
              <button
                onClick={() => setExpandedDraw(expandedDraw === draw.id ? null : draw.id)}
                className="w-full px-4 py-3 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{draw.monthKey}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {draw.mode} • {draw.numbers.join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {draw.pool && (
                      <span className="text-sm font-semibold">₹{draw.pool.total.toFixed(2)}</span>
                    )}
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      draw.published
                        ? "bg-green-100 text-green-900"
                        : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    }`}>
                      {draw.published ? "Published" : "Simulated"}
                    </span>
                    <span className="text-lg">{expandedDraw === draw.id ? "−" : "+"}</span>
                  </div>
                </div>
              </button>

              {expandedDraw === draw.id && draw.pool && (
                <div className="border-t border-[var(--card-border)] px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--muted)]">5-Match Prize</p>
                      <p className="mt-1 text-lg font-bold">₹{draw.pool.pool5.toFixed(2)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {draw.distribution.fiveMatch.winners} winner{draw.distribution.fiveMatch.winners !== 1 ? "s" : ""}
                        {draw.distribution.fiveMatch.winners > 0 && (
                          <span> • ₹{draw.distribution.fiveMatch.perWinner} each</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--muted)]">4-Match Prize</p>
                      <p className="mt-1 text-lg font-bold">₹{draw.pool.pool4.toFixed(2)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {draw.distribution.fourMatch.winners} winner{draw.distribution.fourMatch.winners !== 1 ? "s" : ""}
                        {draw.distribution.fourMatch.winners > 0 && (
                          <span> • ₹{draw.distribution.fourMatch.perWinner} each</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--muted)]">3-Match Prize</p>
                      <p className="mt-1 text-lg font-bold">₹{draw.pool.pool3.toFixed(2)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {draw.distribution.threeMatch.winners} winner{draw.distribution.threeMatch.winners !== 1 ? "s" : ""}
                        {draw.distribution.threeMatch.winners > 0 && (
                          <span> • ₹{draw.distribution.threeMatch.perWinner} each</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--muted)]">Rollover</p>
                      <p className="mt-1 text-lg font-bold">₹{draw.pool.rolloverOut.toFixed(2)}</p>
                      <p className="text-xs text-[var(--muted)]">to next draw</p>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
