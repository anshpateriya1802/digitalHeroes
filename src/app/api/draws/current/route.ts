import { createUnauthorizedResponse, getSessionFromRequest } from "@/lib/auth";
import { getLatestDrawSummaryFromDb } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  const summary = await getLatestDrawSummaryFromDb();
  return NextResponse.json({ summary });
}
