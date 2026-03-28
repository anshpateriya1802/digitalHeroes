import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
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

  // Get all draws with their prize pool data and winner distribution
  const { data: draws, error } = await supabase
    .from("draws")
    .select(
      `
      id,
      month_key,
      mode,
      numbers,
      is_published,
      published_at,
      simulated_at,
      created_at,
      prize_pools:id(
        total_pool,
        pool_5,
        pool_4,
        pool_3,
        rollover_in,
        rollover_out
      ),
      draw_entries(
        id,
        match_count,
        user_id,
        users:user_id(
          full_name,
          email
        )
      )
    `,
      { count: "exact" }
    )
    .order("published_at", { ascending: false })
      .order("published_at", { ascending: false })
    .order("simulated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Format the response with winner counts and distribution info
  const formattedDraws = (draws ?? []).map((draw) => {
    const pool = (draw.prize_pools ?? [])[0];
    const entries = draw.draw_entries ?? [];
    
    const winners5 = entries.filter((e) => e.match_count === 5).length;
    const winners4 = entries.filter((e) => e.match_count === 4).length;
    const winners3 = entries.filter((e) => e.match_count === 3).length;

    return {
      id: draw.id,
      monthKey: draw.month_key,
      mode: draw.mode,
      numbers: draw.numbers,
      published: draw.is_published,
      publishedAt: draw.published_at,
      simulatedAt: draw.simulated_at,
      pool: pool ? {
        total: pool.total_pool,
        pool5: pool.pool_5,
        pool4: pool.pool_4,
        pool3: pool.pool_3,
        rolloverIn: pool.rollover_in,
        rolloverOut: pool.rollover_out,
      } : null,
      distribution: {
        fiveMatch: {
          winners: winners5,
          perWinner: pool && winners5 > 0 ? (pool.pool_5 / winners5).toFixed(2) : "0.00",
        },
        fourMatch: {
          winners: winners4,
          perWinner: pool && winners4 > 0 ? (pool.pool_4 / winners4).toFixed(2) : "0.00",
        },
        threeMatch: {
          winners: winners3,
          perWinner: pool && winners3 > 0 ? (pool.pool_3 / winners3).toFixed(2) : "0.00",
        },
      },
    };
  });

  return NextResponse.json({ draws: formattedDraws });
}
