import { createUnauthorizedResponse, getSessionFromRequest, getUserFromSessionDb } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  const user = await getUserFromSessionDb(session);
  if (!user) {
    return createUnauthorizedResponse();
  }

  const supabase = getSupabaseAdmin();

  const body = await request.json();
  const optOut = Boolean(body.optOut ?? false);

  if (optOut) {
    await supabase.from("user_charity_preferences").insert({
      user_id: user.id,
      charity_id: null,
      contribution_percent: 0,
    });
    return NextResponse.json({ charityId: null, charityPercent: 0 });
  }

  const charityId = String(body.charityId ?? "");
  const charityPercent = Number(body.charityPercent ?? 10);

  const { data: charity } = await supabase
    .from("charities")
    .select("id")
    .eq("id", charityId)
    .maybeSingle();

  if (!charity) {
    return NextResponse.json({ error: "Invalid charity selection." }, { status: 400 });
  }

  if (!Number.isFinite(charityPercent) || charityPercent < 10 || charityPercent > 100) {
    return NextResponse.json(
      { error: "Charity contribution must be between 10 and 100." },
      { status: 400 }
    );
  }

  await supabase.from("user_charity_preferences").insert({
    user_id: user.id,
    charity_id: charityId,
    contribution_percent: charityPercent,
  });

  return NextResponse.json({ charityId, charityPercent });
}
