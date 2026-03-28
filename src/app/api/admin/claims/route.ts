import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const validClaimStatuses = ["pending", "approved", "rejected"] as const;
const validPayoutStatuses = ["pending", "paid"] as const;

type ClaimStatus = (typeof validClaimStatuses)[number];

function normalizeClaimResponse(entry: Record<string, unknown>) {
  const drawEntry = (entry.draw_entries as Record<string, unknown> | null) ?? null;
  const user = (drawEntry?.users as Record<string, unknown> | null) ?? null;
  const draw = (drawEntry?.draws as Record<string, unknown> | null) ?? null;

  return {
    id: String(entry.id ?? ""),
    drawEntryId: String(entry.draw_entry_id ?? ""),
    userId: String(entry.user_id ?? ""),
    proofUrl: entry.proof_url ? String(entry.proof_url) : "",
    claimStatus: String(entry.claim_status ?? "pending"),
    payoutStatus: String(entry.payout_status ?? "pending"),
    reviewedAt: entry.reviewed_at ? String(entry.reviewed_at) : undefined,
    reviewedBy: entry.reviewed_by ? String(entry.reviewed_by) : undefined,
    paidAt: entry.paid_at ? String(entry.paid_at) : undefined,
    createdAt: String(entry.created_at ?? ""),
    user: {
      fullName: String(user?.full_name ?? "Unknown"),
      email: String(user?.email ?? ""),
    },
    draw: {
      monthKey: String(draw?.month_key ?? "-"),
      matchCount: Number(drawEntry?.match_count ?? 0),
    },
  };
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();
  const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
  const status = statusParam === "all" ? "all" : (statusParam as ClaimStatus);

  if (status !== "all" && !validClaimStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid claim status filter." }, { status: 400 });
  }

  const query = supabase
    .from("winner_claims")
    .select(
      `
      id,
      draw_entry_id,
      user_id,
      proof_url,
      claim_status,
      payout_status,
      reviewed_at,
      reviewed_by,
      paid_at,
      created_at,
      draw_entries:draw_entry_id(
        id,
        match_count,
        user_numbers,
        users:user_id(
          id,
          full_name,
          email
        ),
        draws:draw_id(
          month_key,
          numbers
        )
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query.eq("claim_status", status);
  }

  const { data: claims, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const formattedClaims = (claims ?? []).map((entry) => normalizeClaimResponse(entry as Record<string, unknown>));
  return NextResponse.json({ claims: formattedClaims, total: count ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const body = await request.json();
  const claimId = String(body.claimId ?? "");
  const action = String(body.action ?? "");

  if (!claimId) {
    return NextResponse.json({ error: "claimId is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (action === "approve" || action === "reject") {
    const claimStatus = (action === "approve" ? "approved" : "rejected") as ClaimStatus;

    const { data: updated, error } = await supabase
      .from("winner_claims")
      .update({
        claim_status: claimStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.userId,
      })
      .eq("id", claimId)
      .select("id, claim_status, payout_status, reviewed_at, reviewed_by")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }

    return NextResponse.json({ claim: updated });
  }

  if (action === "mark-paid") {
    const { data: claim, error: claimError } = await supabase
      .from("winner_claims")
      .select("id, claim_status, payout_status")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError || !claim) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }

    const currentClaimStatus = String(claim.claim_status);
    const currentPayoutStatus = String(claim.payout_status);

    if (!validClaimStatuses.includes(currentClaimStatus as ClaimStatus)) {
      return NextResponse.json({ error: "Invalid claim state." }, { status: 400 });
    }
    if (!validPayoutStatuses.includes(currentPayoutStatus as (typeof validPayoutStatuses)[number])) {
      return NextResponse.json({ error: "Invalid payout state." }, { status: 400 });
    }
    if (currentClaimStatus !== "approved") {
      return NextResponse.json({ error: "Only approved claims can be paid." }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("winner_claims")
      .update({ payout_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", claimId)
      .select("id, claim_status, payout_status, paid_at")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: "Unable to mark claim as paid." }, { status: 400 });
    }

    return NextResponse.json({ claim: updated });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
