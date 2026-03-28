import { getSupabaseAdmin } from "@/lib/supabase";
import { DrawMode } from "@/lib/types";

const NUMBER_MIN = 1;
const NUMBER_MAX = 45;
const DRAW_SIZE = 5;

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sampleWithoutReplacement(pool: number[], size: number) {
  const available = [...pool];
  const selected: number[] = [];
  while (selected.length < size && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available[idx]);
    available.splice(idx, 1);
  }
  return selected.sort((a, b) => a - b);
}

function randomNumbers() {
  const range = Array.from({ length: NUMBER_MAX - NUMBER_MIN + 1 }, (_, i) => i + NUMBER_MIN);
  return sampleWithoutReplacement(range, DRAW_SIZE);
}

function countMatches(userNumbers: number[], drawNumbers: number[]) {
  const drawSet = new Set(drawNumbers);
  return userNumbers.reduce((sum, number) => (drawSet.has(number) ? sum + 1 : sum), 0);
}

async function getActiveSubscribers() {
  const supabase = getSupabaseAdmin();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("role", "subscriber");

  if (error) throw error;

  const active: Array<{ id: string }> = [];
  for (const user of users ?? []) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub?.status === "active") {
      active.push({ id: user.id });
    }
  }

  return active;
}

async function getLatestFiveNumbers(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("golf_scores")
    .select("score")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(5);

  const scores = (data ?? []).map((entry) => entry.score).sort((a, b) => a - b);
  if (scores.length === 5) {
    return scores;
  }
  return randomNumbers();
}

async function getPrizePoolBase(activeUserIds: string[]) {
  const supabase = getSupabaseAdmin();
  let total = 0;
  for (const userId of activeUserIds) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    total += Number(sub?.amount ?? 0);
  }
  return total;
}

export async function runDbDraw(mode: DrawMode, publish: boolean) {
  const supabase = getSupabaseAdmin();
  const currentMonth = monthKey();

  if (publish) {
    const { data: existing } = await supabase
      .from("draws")
      .select("id")
      .eq("month_key", currentMonth)
      .eq("is_published", true)
      .maybeSingle();
    if (existing) {
      throw new Error("A published draw already exists for this month.");
    }
  }

  const numbers = randomNumbers();

  const { data: draw, error: drawError } = await supabase
    .from("draws")
    .insert({
      month_key: currentMonth,
      mode,
      numbers,
      is_published: publish,
      simulated_at: new Date().toISOString(),
      published_at: publish ? new Date().toISOString() : null,
    })
    .select("id, month_key, mode, numbers, is_published, simulated_at, published_at")
    .single();

  if (drawError || !draw) {
    throw drawError ?? new Error("Unable to create draw.");
  }

  const subscribers = await getActiveSubscribers();
  const entries: Array<{ id: string; userId: string; matches: number; numbers: number[] }> = [];

  for (const subscriber of subscribers) {
    const userNumbers = await getLatestFiveNumbers(subscriber.id);
    const matches = countMatches(userNumbers, numbers);
    const { data: inserted } = await supabase
      .from("draw_entries")
      .insert({
        draw_id: draw.id,
        user_id: subscriber.id,
        user_numbers: userNumbers,
        match_count: matches,
      })
      .select("id")
      .single();

    entries.push({
      id: inserted?.id ?? `${draw.id}-${subscriber.id}`,
      userId: subscriber.id,
      matches,
      numbers: userNumbers,
    });
  }

  const { data: previousPool } = await supabase
    .from("prize_pools")
    .select("rollover_out")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rolloverIn = Number(previousPool?.rollover_out ?? 0);
  const basePool = await getPrizePoolBase(subscribers.map((entry) => entry.id));
  const totalPool = basePool + rolloverIn;

  const pool5 = Number((totalPool * 0.4).toFixed(2));
  const pool4 = Number((totalPool * 0.35).toFixed(2));
  const pool3 = Number((totalPool * 0.25).toFixed(2));

  const winners5 = entries.filter((entry) => entry.matches === 5).length;
  const winners4 = entries.filter((entry) => entry.matches === 4).length;
  const winners3 = entries.filter((entry) => entry.matches === 3).length;

  const rolloverOut = winners5 === 0 ? pool5 : 0;

  const { error: poolError } = await supabase.from("prize_pools").insert({
    draw_id: draw.id,
    total_pool: totalPool,
    pool_5: pool5,
    pool_4: pool4,
    pool_3: pool3,
    rollover_in: rolloverIn,
    rollover_out: rolloverOut,
  });

  if (poolError) {
    throw poolError;
  }

  return {
    draw: {
      id: draw.id,
      monthKey: draw.month_key,
      mode: draw.mode,
      numbers: draw.numbers,
      published: draw.is_published,
      simulatedAt: draw.simulated_at,
      publishedAt: draw.published_at,
    },
    entries,
    distribution: {
      fiveMatch: {
        pool: pool5,
        winners: winners5,
        amountPerWinner: winners5 > 0 ? Number((pool5 / winners5).toFixed(2)) : 0,
      },
      fourMatch: {
        pool: pool4,
        winners: winners4,
        amountPerWinner: winners4 > 0 ? Number((pool4 / winners4).toFixed(2)) : 0,
      },
      threeMatch: {
        pool: pool3,
        winners: winners3,
        amountPerWinner: winners3 > 0 ? Number((pool3 / winners3).toFixed(2)) : 0,
      },
      rolloverOut,
    },
  };
}

export async function runPracticeDrawForUserDb(userId: string) {
  const drawNumbers = randomNumbers();
  const userNumbers = await getLatestFiveNumbers(userId);
  const matches = countMatches(userNumbers, drawNumbers);

  return {
    drawNumbers,
    userNumbers,
    matches,
    tier: matches >= 3 ? matches : null,
  };
}
