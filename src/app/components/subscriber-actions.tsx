"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubscriptionStatus } from "@/lib/types";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => void;
      theme?: { color?: string };
      prefill?: { email?: string; name?: string };
    }) => { open: () => void };
  }
}

interface CharityOption {
  id: string;
  name: string;
}

interface DrawSummary {
  draw: {
    id: string;
    monthKey: string;
    numbers: number[];
  };
}

interface ClaimableEntry {
  id: string;
  drawId: string;
  matches: number;
  drawMonthKey: string;
}

interface SubscriberActionsProps {
  currentPlan: "monthly" | "yearly";
  currentStatus: SubscriptionStatus;
  currentCharityId: string | null;
  currentCharityPercent: number;
  charities: CharityOption[];
  latestDraw: DrawSummary | null;
  claimableEntries: ClaimableEntry[];
  drawHistory: Array<{
    id: string;
    monthKey: string;
    createdAt: string;
    createdAtLabel: string;
  }>;
  latestUserDrawEntry: {
    id: string;
    drawId: string;
    matches: number;
    drawMonthKey: string;
    claimEligible: boolean;
  } | null;
}

export function SubscriberActions({
  currentPlan,
  currentStatus,
  currentCharityId,
  currentCharityPercent,
  charities,
  latestDraw,
  claimableEntries,
  drawHistory,
  latestUserDrawEntry,
}: SubscriberActionsProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(currentPlan);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(currentStatus);
  const [charityId, setCharityId] = useState(currentCharityId ?? charities[0]?.id ?? "");
  const [charityPercent, setCharityPercent] = useState(String(Math.max(currentCharityPercent, 10)));
  const [charityOptOut, setCharityOptOut] = useState(currentCharityId === null || currentCharityPercent === 0);
  const [score, setScore] = useState("30");
  const [playedAt, setPlayedAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [practiceResult, setPracticeResult] = useState<{
    userNumbers: number[];
    drawNumbers: number[];
    matches: number;
    referenceId: string;
  } | null>(null);
  const [selectedClaimEntryId, setSelectedClaimEntryId] = useState(claimableEntries[0]?.id ?? "");
  const [manualClaimDrawId, setManualClaimDrawId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [claimSubmitLabel, setClaimSubmitLabel] = useState("Submit Claim");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [copiedField, setCopiedField] = useState<"draw" | "entry" | null>(null);
  const [practiceDrawIds, setPracticeDrawIds] = useState<string[]>([]);
  const hasCharityOptions = charities.length > 0;

  useEffect(() => {
    const stored = window.localStorage.getItem("dh_practice_draw_ids");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPracticeDrawIds(parsed.slice(0, 10));
      }
    } catch {
      setPracticeDrawIds([]);
    }
  }, []);

  function updatePracticeDrawIds(nextReferenceId: string) {
    setPracticeDrawIds((prev) => {
      const next = [nextReferenceId, ...prev.filter((id) => id !== nextReferenceId)].slice(0, 10);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("dh_practice_draw_ids", JSON.stringify(next));
      }
      return next;
    });
  }

  async function copyValue(value: string, field: "draw" | "entry") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setMessage("Unable to copy. Please copy manually.");
    }
  }

  async function ensureRazorpayScript() {
    if (window.Razorpay) {
      return true;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return new Promise<boolean>((resolve) => {
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
    });
  }

  async function choosePlan(plan: "monthly" | "yearly") {
    const orderResponse = await fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const orderData = (await orderResponse.json()) as {
      error?: string;
      keyId?: string;
      order?: { id: string; amount: number; currency: string };
    };

    if (!orderResponse.ok || !orderData.order || !orderData.keyId) {
      setMessage(orderData.error ?? "Unable to create payment order.");
      return;
    }

    const loaded = await ensureRazorpayScript();
    if (!loaded || !window.Razorpay) {
      setMessage("Unable to load Razorpay checkout script.");
      return;
    }

    const razorpay = new window.Razorpay({
      key: orderData.keyId,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: "Drive for Good",
      description: `${plan} subscription`,
      order_id: orderData.order.id,
      theme: { color: "#1f6b4f" },
      handler: async (payment) => {
        const verifyResponse = await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          }),
        });

        const verifyData = (await verifyResponse.json()) as { error?: string };
        if (!verifyResponse.ok) {
          setMessage(verifyData.error ?? "Payment verification failed.");
          return;
        }

        setSelectedPlan(plan);
        setSubscriptionStatus("active");
        setMessage(`Subscription activated on ${plan} plan.`);
        router.refresh();
      },
    });

    razorpay.open();
  }

  async function cancelSubscription() {
    const response = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Unable to cancel subscription.");
      return;
    }
    setSubscriptionStatus("canceled");
    setMessage("Subscription canceled.");
    router.refresh();
  }

  async function saveScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: Number(score), playedAt }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Unable to store score.");
      return;
    }
    setMessage("Score saved successfully.");
    setScore("30");
    setPlayedAt("");
    router.refresh();
  }

  async function updateCharity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!charityOptOut && !hasCharityOptions) {
      setMessage("No charity options are available yet. Ask an admin to add charities or opt out for now.");
      return;
    }

    const response = await fetch("/api/charity-preference", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        charityId,
        charityPercent: Number(charityPercent),
        optOut: charityOptOut,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Unable to update charity settings.");
      return;
    }
    setMessage("Charity preference updated.");
    router.refresh();
  }

  async function runPracticeDraw() {
    const response = await fetch("/api/draws/practice", {
      method: "POST",
    });
    const data = (await response.json()) as {
      error?: string;
      result?: { userNumbers: number[]; drawNumbers: number[]; matches: number; referenceId: string };
    };
    if (!response.ok || !data.result) {
      setMessage(data.error ?? "Unable to run practice draw.");
      return;
    }
    setPracticeResult(data.result);
    updatePracticeDrawIds(data.result.referenceId);
    if (latestUserDrawEntry?.drawId) {
      setManualClaimDrawId(latestUserDrawEntry.drawId);
    }
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const claimEntryId = selectedClaimEntryId;
    const claimDrawId = manualClaimDrawId.trim();

    if (!claimEntryId && !claimDrawId) {
      setMessage("Select an eligible entry or enter a Draw ID.");
      return;
    }

    if (!proofFile) {
      setMessage("Please upload proof before submitting your claim.");
      return;
    }

    setClaimSubmitting(true);
    setClaimSubmitLabel("Submitting...");

    const formData = new FormData();
    if (claimEntryId) {
      formData.append("drawEntryId", claimEntryId);
    }
    if (claimDrawId) {
      formData.append("drawId", claimDrawId);
    }
    formData.append("proof", proofFile);

    const response = await fetch("/api/winners", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Unable to submit claim.");
      setClaimSubmitting(false);
      setClaimSubmitLabel("Submit Claim");
      return;
    }

    setProofFile(null);
    setSelectedClaimEntryId("");
    setManualClaimDrawId("");
    setFileInputKey((key) => key + 1);
    setClaimSubmitLabel("Claim Submitted");
    setMessage("Claim submitted successfully. Awaiting admin review.");
    setTimeout(() => {
      setClaimSubmitLabel("Submit Claim");
    }, 2200);
    setClaimSubmitting(false);
    router.refresh();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="card p-6">
        <h2 className="text-xl font-semibold">Choose Your Subscription Plan</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pick a plan to unlock score storage and monthly prize draw eligibility.
        </p>
        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("monthly");
              void choosePlan("monthly");
            }}
            className="rounded-xl border border-[var(--card-border)] bg-white p-4 text-left"
          >
            <p className="font-semibold">Monthly Plan - $29/mo</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Flexible billing, cancel anytime, full draw access.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("yearly");
              void choosePlan("yearly");
            }}
            className="rounded-xl border border-[var(--card-border)] bg-white p-4 text-left"
          >
            <p className="font-semibold">Yearly Plan - $290/year</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Save over monthly billing and stay eligible all year.</p>
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Current status: <span className="font-semibold capitalize text-[var(--ink)]">{subscriptionStatus}</span> on{" "}
          <span className="font-semibold capitalize text-[var(--ink)]">{selectedPlan}</span> plan.
        </p>
        {subscriptionStatus === "active" ? (
          <button
            type="button"
            onClick={() => void cancelSubscription()}
            className="mt-3 rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-sm font-semibold"
          >
            Cancel Subscription
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void choosePlan(selectedPlan)}
            className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            Choose a Plan
          </button>
        )}
      </article>

      <article className="card p-6">
        <h2 className="text-xl font-semibold">Store a Golf Score</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Add score now. Latest 5 scores are kept automatically.</p>
        <form className="mt-4 grid gap-3" onSubmit={saveScore}>
          <input
            type="number"
            min={1}
            max={45}
            value={score}
            onChange={(event) => setScore(event.target.value)}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            placeholder="Stableford score"
            required
          />
          <input
            type="date"
            value={playedAt}
            onChange={(event) => setPlayedAt(event.target.value)}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            required
          />
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" type="submit">
            Save Score
          </button>
        </form>
      </article>

      <article className="card p-6">
        <h2 className="text-xl font-semibold">Charity Contribution Settings</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Pick a charity, set contribution, or opt out for now.</p>
        <form className="mt-4 grid gap-3" onSubmit={updateCharity}>
          <select
            value={charityId}
            onChange={(event) => setCharityId(event.target.value)}
            disabled={charityOptOut || !hasCharityOptions}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
          >
            {hasCharityOptions ? (
              charities.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))
            ) : (
              <option value="">No charities configured yet</option>
            )}
          </select>
          {!hasCharityOptions ? (
            <p className="text-xs text-[#9f2f2f]">
              No charity options are configured yet. Admin can add options in Admin &gt; Charities.
            </p>
          ) : null}
          <input
            type="number"
            min={10}
            max={100}
            value={charityPercent}
            onChange={(event) => setCharityPercent(event.target.value)}
            disabled={charityOptOut}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={charityOptOut}
              onChange={(event) => setCharityOptOut(event.target.checked)}
            />
            Opt out of charity contribution for now
          </label>
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" type="submit">
            Save Charity Preference
          </button>
        </form>
      </article>

      <article className="card p-6">
        <h2 className="text-xl font-semibold">Draw Center</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {latestDraw
            ? `Latest published draw (${latestDraw.draw.monthKey}) - Draw ID: ${latestDraw.draw.id}: ${latestDraw.draw.numbers.join(", ")}`
            : "No official draw published yet. Try a practice draw now."}
        </p>
        <button
          type="button"
          onClick={() => void runPracticeDraw()}
          className="mt-4 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Run Practice Draw
        </button>
        {practiceResult ? (
          <div className="mt-4 rounded-xl border border-[var(--card-border)] p-3 text-sm">
            <p>Your numbers: {practiceResult.userNumbers.join(", ")}</p>
            <p>Draw numbers: {practiceResult.drawNumbers.join(", ")}</p>
            <p className="font-semibold">Matches: {practiceResult.matches}</p>
            <p className="mt-1">Reference ID: {practiceResult.referenceId}</p>
            <p className="mt-2 text-[var(--muted)]">
              Auto-detection: {practiceResult.matches >= 3 ? "Eligible (3+ matches detected)" : "Not eligible yet"}
            </p>
          </div>
        ) : null}

        {latestUserDrawEntry ? (
          <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-white p-3 text-sm">
            <p className="font-semibold">Your latest draw reference</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p>Draw ID: {latestUserDrawEntry.drawId}</p>
              <button
                type="button"
                onClick={() => void copyValue(latestUserDrawEntry.drawId, "draw")}
                className="rounded-full border border-[var(--card-border)] bg-white px-2.5 py-1 text-xs font-semibold"
              >
                {copiedField === "draw" ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p>Entry ID: {latestUserDrawEntry.id}</p>
              <button
                type="button"
                onClick={() => void copyValue(latestUserDrawEntry.id, "entry")}
                className="rounded-full border border-[var(--card-border)] bg-white px-2.5 py-1 text-xs font-semibold"
              >
                {copiedField === "entry" ? "Copied" : "Copy"}
              </button>
            </div>
            <p>Matches: {latestUserDrawEntry.matches}</p>
            <p className="mt-1 text-[var(--muted)]">
              Status: {latestUserDrawEntry.claimEligible ? "Claim eligible (auto-detected)" : "Not claim eligible"}
            </p>
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-white p-3 text-sm">
          <p className="font-semibold">Previous Draw IDs</p>
          {drawHistory.length === 0 ? (
            <p className="mt-2 text-[var(--muted)]">No draws yet.</p>
          ) : (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--card-border)] p-2">
              <ul className="space-y-2">
                {drawHistory.map((draw) => (
                  <li key={draw.id} className="rounded-lg border border-[var(--card-border)] px-2 py-2">
                    <p>
                      {draw.monthKey} - Draw ID: {draw.id}
                    </p>
                    <p className="text-[var(--muted)]">Created: {draw.createdAtLabel || draw.createdAt || "-"}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-white p-3 text-sm">
          <p className="font-semibold">Last 10 Practice Draw IDs</p>
          {practiceDrawIds.length === 0 ? (
            <p className="mt-2 text-[var(--muted)]">No practice IDs yet.</p>
          ) : (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--card-border)] p-2">
              <ul className="space-y-1">
                {practiceDrawIds.map((id) => (
                  <li key={id} className="rounded border border-[var(--card-border)] px-2 py-1">
                    {id}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </article>

      <article className="card p-6 lg:col-span-2">
        <h2 className="text-xl font-semibold">Submit Winner Claim</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Upload proof for any draw with 3+ matches that has not been claimed yet. You can submit using Draw ID.
        </p>

        <form className="mt-4 grid gap-3" onSubmit={submitClaim}>
          {claimableEntries.length > 0 ? (
            <select
              value={selectedClaimEntryId}
              onChange={(event) => setSelectedClaimEntryId(event.target.value)}
              className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            >
              {claimableEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.drawMonthKey} • Draw ID {entry.drawId.slice(0, 8)} • {entry.matches} matches • entry {entry.id.slice(0, 8)}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--card-border)] p-3 text-sm text-[var(--muted)]">
              No auto-detected eligible entries. You can still submit using your Draw ID.
            </div>
          )}

          <input
            type="text"
            value={manualClaimDrawId}
            onChange={(event) => setManualClaimDrawId(event.target.value)}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            placeholder="Or enter Draw ID manually (example: 8f3f...)"
          />

            <input
              key={fileInputKey}
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              required
            />

            <button
              type="submit"
              disabled={claimSubmitting}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {claimSubmitLabel}
            </button>
          </form>
      </article>

      {message ? (
        <p className="lg:col-span-2 rounded-xl border border-[var(--card-border)] bg-white p-3 text-sm">{message}</p>
      ) : null}
    </section>
  );
}
