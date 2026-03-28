import { getSessionFromRequest, getUserFromSessionDb } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

function randomDrawNumbers() {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const out: number[] = [];
  while (out.length < 5) {
    const n = pool[Math.floor(Math.random() * pool.length)];
    if (!out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function userNumbersWithThreeMatches(drawNumbers: number[]) {
  const set = new Set(drawNumbers);
  const outside = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !set.has(n));
  return [...drawNumbers.slice(0, 3), outside[0], outside[1]].sort((a, b) => a - b);
}

/**
 * Development only: ensures the current subscriber has at least one draw entry with
 * match_count >= 3 and no winner_claim yet, so "Submit winner claim" can be tested.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const session = getSessionFromRequest(request);
  if (!session || session.role !== "subscriber") {
    return NextResponse.json({ error: "Subscriber session required." }, { status: 401 });
  }

  const user = await getUserFromSessionDb(session);
  if (!user || user.role !== "subscriber") {
    return NextResponse.json({ error: "Subscriber profile required." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: entryRows } = await supabase
    .from("draw_entries")
    .select("id, draw_id, match_count")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: claimRows } = await supabase
    .from("winner_claims")
    .select("draw_entry_id")
    .eq("user_id", user.id);

  const claimedIds = new Set((claimRows ?? []).map((c) => c.draw_entry_id));

  const targetEntry = (entryRows ?? []).find((e) => !claimedIds.has(e.id));

  if (targetEntry) {
    const { data: draw } = await supabase
      .from("draws")
      .select("numbers")
      .eq("id", targetEntry.draw_id)
      .maybeSingle();

    const numbers = draw?.numbers ?? randomDrawNumbers();
    const userNumbers = userNumbersWithThreeMatches(numbers);

    const { error } = await supabase
      .from("draw_entries")
      .update({ match_count: 3, user_numbers: userNumbers })
      .eq("id", targetEntry.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      entryId: targetEntry.id,
      action: "updated" as const,
    });
  }

  let { data: draw } = await supabase
    .from("draws")
    .select("id, numbers")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draw) {
    const numbers = randomDrawNumbers();
    const { data: newDraw, error: drawErr } = await supabase
      .from("draws")
      .insert({
        month_key: monthKey(),
        mode: "random",
        numbers,
        is_published: true,
        simulated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      })
      .select("id, numbers")
      .single();
    if (drawErr || !newDraw) {
      return NextResponse.json({ error: drawErr?.message ?? "Could not create draw." }, { status: 500 });
    }
    draw = newDraw;
  }

  const userNumbers = userNumbersWithThreeMatches(draw.numbers);

  const { data: inserted, error: insertError } = await supabase
    .from("draw_entries")
    .insert({
      draw_id: draw.id,
      user_id: user.id,
      user_numbers: userNumbers,
      match_count: 3,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    entryId: inserted.id,
    action: "created" as const,
  });
}
