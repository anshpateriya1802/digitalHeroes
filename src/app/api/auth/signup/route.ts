import { setSessionCookies } from "@/lib/auth";
import { getUserWithSubscriptionById } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const charityOptOut = Boolean(body.charityOptOut ?? false);
  const charityId = String(body.charityId ?? "");
  const charityPercent = Number(body.charityPercent ?? 10);

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUserError) {
    const message = existingUserError.message.includes("schema cache")
      ? "Database schema is not initialized. Run supabase/schema.sql in your Supabase SQL editor."
      : existingUserError.message;
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (existingUser) {
    return NextResponse.json({ error: "Email already registered." }, { status: 409 });
  }

  const { data: existingNameUser, error: existingNameError } = await supabase
    .from("users")
    .select("id")
    .ilike("full_name", name)
    .maybeSingle();

  if (existingNameError) {
    const message = existingNameError.message.includes("schema cache")
      ? "Database schema is not initialized. Run supabase/schema.sql in your Supabase SQL editor."
      : existingNameError.message;
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (existingNameUser) {
    return NextResponse.json({ error: "Name already registered." }, { status: 409 });
  }

  const { data: charityRow, error: charityLookupError } = charityId
    ? await supabase.from("charities").select("id").eq("id", charityId).maybeSingle()
    : { data: null, error: null };

  if (charityLookupError) {
    const message = charityLookupError.message.includes("schema cache")
      ? "Database schema is not initialized. Run supabase/schema.sql in your Supabase SQL editor."
      : charityLookupError.message;
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const charityExists = Boolean(charityRow?.id);
  const selectedCharityId = charityOptOut
    ? null
    : charityExists
      ? charityId
      : null;

  if (!charityOptOut && (!Number.isFinite(charityPercent) || charityPercent < 10 || charityPercent > 100)) {
    return NextResponse.json(
      { error: "Charity contribution must be between 10 and 100." },
      { status: 400 }
    );
  }

  const { data: authCreated, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authCreated.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Unable to create auth user." },
      { status: 400 }
    );
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("users")
    .insert({
      auth_user_id: authCreated.user.id,
      email,
      full_name: name,
      role: "subscriber",
    })
    .select("id")
    .single();

  if (profileError || !profileRow) {
    if (authCreated.user?.id) {
      await supabase.auth.admin.deleteUser(authCreated.user.id);
    }
    return NextResponse.json(
      { error: profileError?.message ?? "Unable to create user profile." },
      { status: 400 }
    );
  }

  await supabase.from("subscriptions").insert({
    user_id: profileRow.id,
    plan: "monthly",
    status: "inactive",
    amount: 0,
    renewal_date: new Date().toISOString().slice(0, 10),
  });

  await supabase.from("user_charity_preferences").insert({
    user_id: profileRow.id,
    charity_id: selectedCharityId,
    contribution_percent: charityOptOut ? 0 : charityPercent,
  });

  const newUser = await getUserWithSubscriptionById(profileRow.id);
  if (!newUser) {
    return NextResponse.json({ error: "Unable to load created account." }, { status: 500 });
  }

  const response = NextResponse.json(
    {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    },
    { status: 201 }
  );

  setSessionCookies(response, newUser);
  return response;
}
