import { setSessionCookies } from "@/lib/auth";
import { getUserWithSubscriptionByAuthUserId } from "@/lib/data";
import { getSupabasePublic } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const supabase = getSupabasePublic();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const user = await getUserWithSubscriptionByAuthUserId(authData.user.id);

  if (!user) {
    return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  setSessionCookies(response, user);
  return response;
}
