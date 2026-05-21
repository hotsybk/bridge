import { NextResponse, type NextRequest } from "next/server";
import { refreshNextResponseCookiesWithToken } from "next-firebase-auth-edge/next/cookies";
import { getAuthEdgeConfig } from "@/server/firebase/auth-edge-config";

/**
 * POST /api/login
 *
 * 클라이언트가 Firebase Web SDK로 로그인 후 발급받은 idToken을 Authorization 헤더로 전송하면,
 * 검증 후 서명 쿠키(AuthToken)를 세팅한다.
 *
 * proxy.ts(middleware)는 이 쿠키를 검증해 보호된 라우트의 접근을 제어한다.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "missing bearer token" },
      { status: 401 },
    );
  }
  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) {
    return NextResponse.json({ error: "empty idToken" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  return refreshNextResponseCookiesWithToken(
    idToken,
    request,
    response,
    getAuthEdgeConfig(),
  );
}
