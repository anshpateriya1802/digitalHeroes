import { getCharityBySlug } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const charity = await getCharityBySlug(slug);
  if (!charity) {
    return NextResponse.json({ error: "Charity not found." }, { status: 404 });
  }
  return NextResponse.json({ charity });
}
