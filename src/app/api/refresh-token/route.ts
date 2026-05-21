import { NextResponse, type NextRequest } from "next/server";
import { refreshNextResponseCookies } from "next-firebase-auth-edge/next/cookies";
import { getAuthEdgeConfig } from "@/server/firebase/auth-edge-config";

/**
 * POST /api/refresh-token
 *
 * 기존 refresh token을 이용해 ID token을 갱신하고 쿠키를 다시 세팅.
 * 클라이언트가 stale token을 만났을 때 호출.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  return refreshNextResponseCookies(request, response, getAuthEdgeConfig());
}
