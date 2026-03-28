import { setSessionCookies } from "@/lib/auth";
import { getUserWithSubscriptionByAuthUserId } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.log("Auth error:", authError);
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

  } catch (err: any) {
    console.log("SERVER ERROR:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}