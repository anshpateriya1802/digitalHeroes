"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

interface Winner {
  id: string;
  drawEntryId: string;
  userId: string;
  proofUrl: string;
  claimStatus: "pending" | "approved" | "rejected";
  payoutStatus: "pending" | "paid";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  paidAt?: string;
  user: {
    fullName: string;
    email: string;
  };
  draw: {
    monthKey: string;
    matchCount: number;
  };
}

export function WinnerVerificationPanel() {
  const [claims, setClaims] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<"approve" | "reject" | "mark-paid" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    const status = filter === "all" ? "all" : filter;
    const response = await fetch(`/api/admin/claims?status=${status}`);
    const data = (await response.json()) as { claims?: Winner[]; error?: string };
    if (response.ok) {
      setClaims(data.claims ?? []);
    } else {
      setFeedback(data.error ?? "Failed to load claims.");
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClaims();
  }, [loadClaims]);

  async function reviewClaim(claimId: string, decision: "approve" | "reject") {
    setFeedback(null);
    setProcessingAction(decision);

    const response = await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimId,
        action: decision,
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (response.ok) {
      setFeedback(`Claim ${decision}d successfully.`);
      void loadClaims();
      setSelectedClaim(null);
    } else {
      setFeedback(data.error ?? "Failed to review claim.");
    }

    setProcessingAction(null);
  }

  async function markPaid(claimId: string) {
    setFeedback(null);
    setProcessingAction("mark-paid");

    const response = await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimId,
        action: "mark-paid",
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (response.ok) {
      setFeedback("Claim marked as paid successfully.");
      void loadClaims();
      setSelectedClaim(null);
    } else {
      setFeedback(data.error ?? "Failed to mark claim as paid.");
    }

    setProcessingAction(null);
  }

  const selectedClaimData = claims.find((c) => c.id === selectedClaim);

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-xl font-semibold">Draw Claims Review</h2>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition duration-200 ease-out active:scale-[0.98] ${
              filter === s
                ? "bg-(--brand) text-white"
                : "border border-(--card-border) bg-white hover:-translate-y-0.5 hover:bg-(--surface-hover)"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({claims.filter((c) => s === "all" || c.claimStatus === s).length})
          </button>
        ))}
      </div>

      {feedback && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-(--muted)">Loading claims...</p>
      ) : claims.length === 0 ? (
        <p className="text-sm text-(--muted)">No claims found.</p>
      ) : selectedClaim ? (
        selectedClaimData && (
          <div className="space-y-4 rounded-xl border border-(--card-border) p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{selectedClaimData.user.fullName}</p>
                <p className="text-sm text-(--muted)">{selectedClaimData.user.email}</p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Draw:</span> {selectedClaimData.draw.monthKey} • {selectedClaimData.draw.matchCount} matches
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Status:</span>
                  <span className={`ml-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                    selectedClaimData.claimStatus === "approved"
                      ? "bg-green-100 text-green-900"
                      : selectedClaimData.claimStatus === "rejected"
                        ? "bg-red-100 text-red-900"
                        : "bg-yellow-100 text-yellow-900"
                  }`}>
                    {selectedClaimData.claimStatus}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="rounded-full px-3 text-2xl font-bold text-(--muted) transition duration-150 hover:bg-(--surface-hover)"
              >
                ×
              </button>
            </div>

            {selectedClaimData.proofUrl && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Proof:</p>
                <Image
                  src={selectedClaimData.proofUrl}
                  alt="Proof"
                  width={640}
                  height={360}
                  unoptimized
                  className="max-h-64 w-auto rounded-lg object-cover"
                />
              </div>
            )}

            {selectedClaimData.claimStatus === "pending" && (
              <div className="flex gap-2">
                <button
                  disabled={processingAction !== null}
                  onClick={() => void reviewClaim(selectedClaim, "approve")}
                  className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {processingAction === "approve" ? "Approving..." : "Approve"}
                </button>
                <button
                  disabled={processingAction !== null}
                  onClick={() => void reviewClaim(selectedClaim, "reject")}
                  className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {processingAction === "reject" ? "Rejecting..." : "Reject"}
                </button>
              </div>
            )}

            {selectedClaimData.claimStatus === "approved" && selectedClaimData.payoutStatus === "pending" && (
              <button
                disabled={processingAction !== null}
                onClick={() => void markPaid(selectedClaim)}
                className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processingAction === "mark-paid" ? "Marking as Paid..." : "Mark as Paid"}
              </button>
            )}

            {selectedClaimData.payoutStatus === "paid" && (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
                ✓ Paid on {new Date(selectedClaimData.paidAt ?? "").toLocaleDateString()}
              </div>
            )}
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {claims.map((claim) => (
            <li
              key={claim.id}
              onClick={() => setSelectedClaim(claim.id)}
              className="cursor-pointer rounded-xl border border-(--card-border) px-4 py-3 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-(--brand)/40 hover:bg-(--surface-hover)"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{claim.user.fullName}</p>
                  <p className="text-xs text-(--muted)">{claim.draw.monthKey} • {claim.draw.matchCount} matches</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  claim.claimStatus === "approved"
                    ? "bg-green-100 text-green-900"
                    : claim.claimStatus === "rejected"
                      ? "bg-red-100 text-red-900"
                      : "bg-yellow-100 text-yellow-900"
                }`}>
                  {claim.claimStatus}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
