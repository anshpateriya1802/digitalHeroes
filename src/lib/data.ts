import { getSupabaseAdmin } from "@/lib/supabase";
import { Plan, SubscriptionStatus } from "@/lib/types";

export interface DbUserWithSubscription {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  role: "subscriber" | "admin";
  charityId: string | null;
  subscription: {
    plan: Plan;
    status: SubscriptionStatus;
    renewalDate: string;
    amount: number;
    charityPercent: number;
  };
}

function fallbackSubscription() {
  return {
    plan: "monthly" as const,
    status: "inactive" as const,
    renewalDate: new Date().toISOString(),
    amount: 0,
    charityPercent: 10,
  };
}

export async function getUserWithSubscriptionById(userId: string): Promise<DbUserWithSubscription | null> {
  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, auth_user_id, full_name, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    return null;
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, renewal_date, amount")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pref } = await supabase
    .from("user_charity_preferences")
    .select("charity_id, contribution_percent")
    .eq("user_id", user.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscription = sub
    ? {
        plan: sub.plan as Plan,
        status: sub.status as SubscriptionStatus,
        renewalDate: sub.renewal_date ? new Date(sub.renewal_date).toISOString() : fallbackSubscription().renewalDate,
        amount: Number(sub.amount ?? 0),
        charityPercent: Number(pref?.contribution_percent ?? 10),
      }
    : fallbackSubscription();

  return {
    id: user.id,
    authUserId: user.auth_user_id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    charityId: pref?.charity_id ?? null,
    subscription,
  };
}

export async function getUserWithSubscriptionByAuthUserId(authUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !user) {
    return null;
  }

  return getUserWithSubscriptionById(user.id);
}

export async function getUserWithSubscriptionByEmailAndRole(
  email: string,
  role: "subscriber" | "admin",
): Promise<DbUserWithSubscription | null> {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .eq("role", role)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  return getUserWithSubscriptionById(row.id);
}

export async function listCharities() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("charities")
    .select("id, name, slug, description, image_url, upcoming_events, is_featured, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    slug: entry.slug,
    description: entry.description,
    imageUrl: entry.image_url,
    upcomingEvents: entry.upcoming_events,
    featured: entry.is_featured,
    active: entry.is_active,
  }));
}

export async function getCharityBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("charities")
    .select("id, name, slug, description, image_url, upcoming_events, is_featured, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function listScoresForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("golf_scores")
    .select("id, user_id, score, played_at, created_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => ({
    id: entry.id,
    userId: entry.user_id,
    score: entry.score,
    playedAt: entry.played_at,
    createdAt: entry.created_at,
  }));
}

export async function addScoreForUser(userId: string, score: number, playedAt: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("golf_scores").insert({
    user_id: userId,
    score,
    played_at: playedAt,
  });

  if (error) {
    throw error;
  }

  return listScoresForUser(userId);
}

export async function upsertSubscription(params: {
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  amount: number;
  renewalDate?: string;
  paymentCustomerId?: string;
  paymentSubscriptionId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("subscriptions").insert({
    user_id: params.userId,
    plan: params.plan,
    status: params.status,
    amount: params.amount,
    renewal_date: params.renewalDate ? params.renewalDate.slice(0, 10) : null,
    payment_customer_id: params.paymentCustomerId ?? null,
    payment_subscription_id: params.paymentSubscriptionId ?? null,
  }).select("id").single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateLatestSubscriptionStatus(userId: string, status: SubscriptionStatus) {
  const supabase = getSupabaseAdmin();
  const { data: latest, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    throw fetchErr;
  }
  if (!latest) {
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ status })
    .eq("id", latest.id);

  if (error) {
    throw error;
  }
}

export async function getLatestDrawSummaryFromDb() {
  const supabase = getSupabaseAdmin();
  const { data: draw } = await supabase
    .from("draws")
    .select("id, month_key, mode, numbers, is_published, published_at, simulated_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draw) {
    return null;
  }

  const { data: entries } = await supabase
    .from("draw_entries")
    .select("id, draw_id, user_id, user_numbers, match_count")
    .eq("draw_id", draw.id);

  const { data: pool } = await supabase
    .from("prize_pools")
    .select("draw_id, total_pool, pool_5, pool_4, pool_3, rollover_in, rollover_out")
    .eq("draw_id", draw.id)
    .maybeSingle();

  return {
    draw: {
      id: draw.id,
      monthKey: draw.month_key,
      mode: draw.mode,
      numbers: draw.numbers,
      published: draw.is_published,
      publishedAt: draw.published_at,
      simulatedAt: draw.simulated_at,
    },
    entries:
      entries?.map((entry) => ({
        id: entry.id,
        drawId: entry.draw_id,
        userId: entry.user_id,
        numbers: entry.user_numbers,
        matches: entry.match_count,
      })) ?? [],
    pool: pool
      ? {
          drawId: pool.draw_id,
          total: Number(pool.total_pool),
          fiveMatch: Number(pool.pool_5),
          fourMatch: Number(pool.pool_4),
          threeMatch: Number(pool.pool_3),
          rolloverIn: Number(pool.rollover_in),
          rolloverOut: Number(pool.rollover_out),
        }
      : null,
  };
}

export async function listSubscribers() {
  const supabase = getSupabaseAdmin();
  const { data: dbUsers, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .eq("role", "subscriber")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const result: Array<{ id: string; name: string; email: string; subscription: { plan: Plan; status: SubscriptionStatus } }> = [];

  for (const user of dbUsers ?? []) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    result.push({
      id: user.id,
      name: user.full_name,
      email: user.email,
      subscription: {
        plan: (sub?.plan as Plan) ?? "monthly",
        status: (sub?.status as SubscriptionStatus) ?? "inactive",
      },
    });
  }

  return result;
}

export async function getSubscriberDashboardDb(userId: string) {
  const user = await getUserWithSubscriptionById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const charities = await listCharities();
  const charity = charities.find((entry) => entry.id === user.charityId) ?? null;
  const scores = await listScoresForUser(userId);
  const latestDraw = await getLatestDrawSummaryFromDb();

  const supabase = getSupabaseAdmin();
  const { data: entries } = await supabase
    .from("draw_entries")
    .select("id, draw_id, user_id, user_numbers, match_count, created_at")
    .eq("user_id", userId);

  const drawIds = Array.from(new Set((entries ?? []).map((entry) => entry.draw_id)));
  const { data: drawRows } = drawIds.length
    ? await supabase.from("draws").select("id, month_key").in("id", drawIds)
    : { data: [] as Array<{ id: string; month_key: string }> };
  const drawMonthMap = new Map((drawRows ?? []).map((row) => [row.id, row.month_key]));

  const { data: drawHistoryRows } = await supabase
    .from("draws")
    .select("id, month_key, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
    

  const { data: claims } = await supabase
    .from("winner_claims")
    .select("id, draw_entry_id, user_id, proof_url, claim_status, payout_status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const participationCount = entries?.length ?? 0;
  const winningsCount = (entries ?? []).filter((entry) => entry.match_count >= 3).length;
  const claimedEntryIds = new Set((claims ?? []).map((entry) => entry.draw_entry_id));
  const latestUserEntry =
    (entries ?? [])
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;

  return {
    user,
    charity,
    scores,
    latestDraw,
    participationCount,
    winningsCount,
    claims:
      claims?.map((entry) => ({
        id: entry.id,
        drawEntryId: entry.draw_entry_id,
        userId: entry.user_id,
        proofUrl: entry.proof_url,
        claimStatus: entry.claim_status,
        payoutStatus: entry.payout_status,
      })) ?? [],
    claimableEntries:
      (entries ?? [])
        .filter((entry) => entry.match_count >= 3 && !claimedEntryIds.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          drawId: entry.draw_id,
          matches: entry.match_count,
          drawMonthKey: drawMonthMap.get(entry.draw_id) ?? "unknown",
        })),
    drawHistory:
      (drawHistoryRows ?? []).map((draw) => ({
        id: draw.id,
        monthKey: draw.month_key,
        createdAt: draw.created_at,
        createdAtLabel: new Date(draw.created_at).toISOString().replace("T", " ").slice(0, 19) + " UTC",
      })),
    latestUserDrawEntry: latestUserEntry
      ? {
          id: latestUserEntry.id,
          drawId: latestUserEntry.draw_id,
          matches: latestUserEntry.match_count,
          drawMonthKey: drawMonthMap.get(latestUserEntry.draw_id) ?? "unknown",
          claimEligible: latestUserEntry.match_count >= 3 && !claimedEntryIds.has(latestUserEntry.id),
        }
      : null,
  };
}

export async function getLatestCharityPreference(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_charity_preferences")
    .select("charity_id, contribution_percent")
    .eq("user_id", userId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    charityId: data?.charity_id ?? null,
    contributionPercent: Number(data?.contribution_percent ?? 0),
  };
}

export async function insertCharityContribution(params: {
  userId: string;
  subscriptionId: string;
  charityId: string | null;
  contributionPercent: number;
  amount: number;
  periodKey: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("charity_contributions").insert({
    user_id: params.userId,
    subscription_id: params.subscriptionId,
    charity_id: params.charityId,
    contribution_percent: params.contributionPercent,
    amount: params.amount,
    period_key: params.periodKey,
  });

  if (error) {
    throw error;
  }
}

export async function getAdminDashboardDb() {
  const subscribers = await listSubscribers();
  const supabase = getSupabaseAdmin();

  const { data: pools } = await supabase.from("prize_pools").select("total_pool");
  const { count: charitiesCount } = await supabase
    .from("charities")
    .select("id", { count: "exact", head: true });
  const { data: claims } = await supabase
    .from("winner_claims")
    .select("id, draw_entry_id, user_id, claim_status, payout_status")
    .order("created_at", { ascending: false });

  const totalPrizePool = (pools ?? []).reduce((sum, entry) => sum + Number(entry.total_pool ?? 0), 0);
  const activeSubscribers = subscribers.filter((entry) => entry.subscription.status === "active").length;

  return {
    totals: {
      users: subscribers.length,
      activeSubscribers,
      totalPrizePool,
      charities: charitiesCount ?? 0,
      claims: claims?.length ?? 0,
    },
    users: subscribers,
    claims:
      claims?.map((entry) => ({
        id: entry.id,
        drawEntryId: entry.draw_entry_id,
        userId: entry.user_id,
        claimStatus: entry.claim_status,
        payoutStatus: entry.payout_status,
      })) ?? [],
  };
}
