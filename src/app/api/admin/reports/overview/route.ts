import { getSupabaseAdmin } from "@/lib/supabase";
import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();

  const { count: totalUsers } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "subscriber");

  const { count: activeSubscribers } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { data: pools } = await supabase
    .from("prize_pools")
    .select("total_pool");

  const { data: contributionRows } = await supabase
    .from("charity_contributions")
    .select("amount");

  const { count: drawEntriesCount } = await supabase
    .from("draw_entries")
    .select("id", { count: "exact", head: true });

  const { count: charitiesCount } = await supabase
    .from("charities")
    .select("id", { count: "exact", head: true });

  const totalPrizePool = (pools ?? []).reduce((sum, entry) => sum + Number(entry.total_pool ?? 0), 0);
  const totalCharityContributions = (contributionRows ?? []).reduce(
    (sum, entry) => sum + Number(entry.amount ?? 0),
    0
  );

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeSubscribers: activeSubscribers ?? 0,
    totalPrizePool,
    totalCharityContributions,
    drawEntries: drawEntriesCount ?? 0,
    charities: charitiesCount ?? 0,
  });
}