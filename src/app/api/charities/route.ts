import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { listCharities } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const charities = await listCharities();
    return NextResponse.json({ charities });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unable to load charities.";
    return NextResponse.json({ error: message, charities: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const action = String(body.action ?? "create");

  if (action === "create") {
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const slugInput = String(body.slug ?? name.toLowerCase().replace(/\s+/g, "-")).trim();

    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required." }, { status: 400 });
    }

    const slug = slugInput.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const { data: existing } = await supabase
      .from("charities")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Charity slug already exists." }, { status: 409 });
    }

    const { data: charity, error } = await supabase
      .from("charities")
      .insert({ name, slug, description, is_active: true, is_featured: false })
      .select("id, name, slug, description")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ charity }, { status: 201 });
  }

  if (action === "update") {
    const charityId = String(body.charityId ?? "");
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = String(body.name);
    if (body.description) updates.description = String(body.description);
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
    if (typeof body.isFeatured === "boolean") updates.is_featured = body.isFeatured;

    const { data, error } = await supabase
      .from("charities")
      .update(updates)
      .eq("id", charityId)
      .select("id, name, slug, description, is_active, is_featured")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ charity: data });
  }

  if (action === "delete") {
    const charityId = String(body.charityId ?? "");
    const { error } = await supabase.from("charities").delete().eq("id", charityId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}