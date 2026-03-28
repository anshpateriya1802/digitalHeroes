import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const WINNER_PROOFS_BUCKET = "winner-proofs";

async function ensureWinnerProofsBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await supabase.storage.createBucket(WINNER_PROOFS_BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    return error;
  }

  return null;
}

async function uploadProofWithRecovery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filePath: string,
  file: File
) {
  const payload = Buffer.from(await file.arrayBuffer());

  let upload = await supabase.storage
    .from(WINNER_PROOFS_BUCKET)
    .upload(filePath, payload, {
      contentType: file.type,
      upsert: false,
    });

  if (upload.error && upload.error.message.toLowerCase().includes("bucket not found")) {
    const bucketError = await ensureWinnerProofsBucket(supabase);
    if (bucketError) {
      return { error: bucketError };
    }

    upload = await supabase.storage
      .from(WINNER_PROOFS_BUCKET)
      .upload(filePath, payload, {
        contentType: file.type,
        upsert: false,
      });
  }

  return upload;
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  const supabase = getSupabaseAdmin();

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    if (session.role !== "subscriber" && session.role !== "admin") {
      return createForbiddenResponse();
    }

    const formData = await request.formData();
    const drawEntryId = String(formData.get("drawEntryId") ?? "");
    const drawId = String(formData.get("drawId") ?? "");
    const userId = String(formData.get("userId") ?? session.userId);
    const file = formData.get("proof");

    if ((!drawEntryId && !drawId) || !(file instanceof File)) {
      return NextResponse.json({ error: "Provide drawId or drawEntryId, and include proof file." }, { status: 400 });
    }
    if (session.role !== "admin" && session.userId !== userId) {
      return createForbiddenResponse();
    }

    const drawEntryQuery = supabase
      .from("draw_entries")
      .select("id, user_id, match_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (drawEntryId) {
      drawEntryQuery.eq("id", drawEntryId);
    } else {
      drawEntryQuery.eq("draw_id", drawId);
    }

    const { data: entry } = await drawEntryQuery.maybeSingle();

    if (!entry || entry.match_count < 3) {
      return NextResponse.json(
        { error: "Only eligible winners can submit proof for the provided draw." },
        { status: 400 }
      );
    }

    const { data: existingClaim } = await supabase
      .from("winner_claims")
      .select("id")
      .eq("draw_entry_id", entry.id)
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json({ error: "Claim already submitted for this draw entry." }, { status: 409 });
    }

    const filePath = `${userId}/${entry.id}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await uploadProofWithRecovery(supabase, filePath, file);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicData } = supabase.storage.from(WINNER_PROOFS_BUCKET).getPublicUrl(filePath);

    const { data: claim, error: claimError } = await supabase
      .from("winner_claims")
      .insert({
        draw_entry_id: entry.id,
        user_id: userId,
        proof_url: publicData.publicUrl,
        claim_status: "pending",
        payout_status: "pending",
      })
      .select("id, draw_entry_id, user_id, proof_url, claim_status, payout_status")
      .single();

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 400 });
    }

    return NextResponse.json({ claim }, { status: 201 });
  }

  const body = await request.json();
  const action = String(body.action ?? "submit");

  if (action === "submit") {
    if (session.role !== "subscriber" && session.role !== "admin") {
      return createForbiddenResponse();
    }

    const drawEntryId = String(body.drawEntryId ?? "");
    const drawId = String(body.drawId ?? "");
    const userId = String(body.userId ?? session.userId);
    const proofUrl = String(body.proofUrl ?? "");

    if (session.role !== "admin" && session.userId !== userId) {
      return createForbiddenResponse();
    }

    if (!drawEntryId && !drawId) {
      return NextResponse.json({ error: "Provide drawId or drawEntryId." }, { status: 400 });
    }

    const drawEntryQuery = supabase
      .from("draw_entries")
      .select("id, match_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (drawEntryId) {
      drawEntryQuery.eq("id", drawEntryId);
    } else {
      drawEntryQuery.eq("draw_id", drawId);
    }

    const { data: entry } = await drawEntryQuery.maybeSingle();

    if (!entry || entry.match_count < 3) {
      return NextResponse.json(
        { error: "Only eligible winners can submit proof for the provided draw." },
        { status: 400 }
      );
    }

    const { data: existingClaim } = await supabase
      .from("winner_claims")
      .select("id")
      .eq("draw_entry_id", entry.id)
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json({ error: "Claim already submitted for this draw entry." }, { status: 409 });
    }

    const { data: claim, error } = await supabase
      .from("winner_claims")
      .insert({
        draw_entry_id: entry.id,
        user_id: userId,
        proof_url: proofUrl,
        claim_status: "pending",
        payout_status: "pending",
      })
      .select("id, draw_entry_id, user_id, proof_url, claim_status, payout_status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ claim }, { status: 201 });
  }

  if (action === "review") {
    if (session.role !== "admin") {
      return createForbiddenResponse();
    }

    const claimId = String(body.claimId ?? "");
    const decision = String(body.decision ?? "");
    const claimStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : null;
    if (!claimStatus) {
      return NextResponse.json(
        { error: "Decision must be either approve or reject." },
        { status: 400 }
      );
    }

    const { data: claim, error } = await supabase
      .from("winner_claims")
      .update({
        claim_status: claimStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.userId,
      })
      .eq("id", claimId)
      .select("id, claim_status, payout_status")
      .single();

    if (error || !claim) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }

    return NextResponse.json({ claim });
  }

  if (action === "mark-paid") {
    if (session.role !== "admin") {
      return createForbiddenResponse();
    }

    const claimId = String(body.claimId ?? "");
    const { data: claim, error: claimError } = await supabase
      .from("winner_claims")
      .select("id, claim_status")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }
    if (claim.claim_status !== "approved") {
      return NextResponse.json(
        { error: "Only approved claims can be paid." },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("winner_claims")
      .update({ payout_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", claimId)
      .select("id, claim_status, payout_status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ claim: updated });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}