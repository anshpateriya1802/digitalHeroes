import { addScoreForUser, listScoresForUser } from "@/lib/data";
import { createForbiddenResponse, createUnauthorizedResponse, getSessionFromRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  const userScores = await listScoresForUser(session.userId);
  return NextResponse.json({ scores: userScores });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const targetUserId = String(body.userId ?? session.userId);
    if (session.role !== "admin" && targetUserId !== session.userId) {
      return createForbiddenResponse();
    }

    const updated = await addScoreForUser(
      targetUserId,
      Number(body.score),
      String(body.playedAt)
    );

    return NextResponse.json({ scores: updated }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid score payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}