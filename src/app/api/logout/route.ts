import { type NextRequest } from "next/server";
import { removeAuthCookies } from "next-firebase-auth-edge/next/cookies";
import { getAuthEdgeConfig } from "@/server/firebase/auth-edge-config";

/**
 * POST /api/logout
 * GET  /api/logout
 *
 * 서명 쿠키 제거. 이후 요청은 비로그인 상태로 처리됨.
 */
function handle(request: NextRequest) {
  const cfg = getAuthEdgeConfig();
  return removeAuthCookies(request.headers, {
    cookieName: cfg.cookieName,
    cookieSerializeOptions: { ...cfg.cookieSerializeOptions, maxAge: 0 },
  });
}

export async function POST(request: NextRequest) {
  return handle(request);
}
export async function GET(request: NextRequest) {
  return handle(request);
}
