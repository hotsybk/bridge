import { NextResponse, type NextRequest } from "next/server";
import { authMiddleware, redirectToLogin } from "next-firebase-auth-edge";

const PUBLIC_PATHS = ["/", "/login", "/register", "/about", "/pricing", "/search", "/support", "/forbidden"];

// /products/[id], /legal/*, /support/*, /api/webhooks/* 등 prefix 매칭 PUBLIC 경로
// — /api/webhooks/ 는 PortOne 등 외부 webhook 수신용. next-firebase-auth-edge 의 인증
//   redirect 가 발생하지 않도록 우회. webhook handler 내부에서 자체 서명 검증으로 보호.
// — /support/ 는 Wave AA 마케팅 보조 페이지 (FAQ, contact). 비로그인 사용자 접근 허용.
const PUBLIC_PREFIXES = ["/products/", "/legal/", "/support/", "/api/webhooks/"];

/** Phase ν-2 — 역할 가드 실패 시 /forbidden 으로 redirect. */
function forbidden(request: NextRequest, need: string): NextResponse {
  const url = new URL("/forbidden", request.url);
  url.searchParams.set("reason", "role");
  url.searchParams.set("need", need);
  return NextResponse.redirect(url);
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

const BUYER_ROLES = new Set(["BUYER_OWNER", "BUYER_STAFF", "BUYER_VIEWER"]);
const VENDOR_ROLES = new Set(["VENDOR_OWNER", "VENDOR_STAFF"]);
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export async function proxy(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: process.env.NEXT_PUBLIC_FIREBASE_AUTH_COOKIE_NAME ?? "AuthToken",
    cookieSignatureKeys: [
      process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_1!,
      process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_2!,
    ],
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 24, // 12일
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    },
    handleValidToken: async ({ decodedToken }, headers) => {
      const role = (decodedToken.role as string | undefined) ?? "";
      const hospitalId = decodedToken.hospitalId as string | undefined;
      const vendorId = decodedToken.vendorId as string | undefined;
      const { pathname } = request.nextUrl;

      // Phase α-2 — PREVIEW bypass 격리.
      // dev 환경에서 디자인 미리보기를 위해 role 가드를 우회하려면 ENABLE_PREVIEW_BYPASS=true
      // 를 명시적으로 설정해야 한다. 운영/스테이징에서는 절대 활성화 금지.
      const PREVIEW_MODE =
        process.env.ENABLE_PREVIEW_BYPASS === "true" &&
        process.env.NODE_ENV !== "production";

      // PUBLIC 경로는 인증 사용자도 자유 접근
      if (isPublicPath(pathname) && pathname !== "/login" && pathname !== "/register") {
        return NextResponse.next({ request: { headers } });
      }

      // 1) 로그인 사용자가 /login·/register 접근 → 홈으로
      //    PREVIEW_MODE 에서는 로그아웃·재로그인 흐름 테스트를 위해 우회.
      if (pathname === "/login" || pathname === "/register") {
        if (!PREVIEW_MODE) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // 2) /admin/* (debug 포함) — ADMIN / SUPER_ADMIN 만
      // Phase ν-2: role mismatch → /forbidden?reason=role&need=ADMIN.
      if (pathname.startsWith("/admin")) {
        if (!PREVIEW_MODE && !ADMIN_ROLES.has(role)) {
          return forbidden(request, "ADMIN");
        }
      }

      // 2-1) /admin/staff — SUPER_ADMIN only (Wave L)
      // 단순 ADMIN 도 진입 불가. tRPC procedure 가드와 이중 방어.
      if (pathname.startsWith("/admin/staff")) {
        if (!PREVIEW_MODE && role !== "SUPER_ADMIN") {
          return forbidden(request, "SUPER_ADMIN");
        }
      }

      // 2-2) /admin/debug — SUPER_ADMIN only (Wave V)
      // Firestore explorer, retry-queue manager 등 위험 도구. ADMIN 도 차단.
      if (pathname.startsWith("/admin/debug")) {
        if (!PREVIEW_MODE && role !== "SUPER_ADMIN") {
          return forbidden(request, "SUPER_ADMIN");
        }
      }

      // 3) /seller/* — VENDOR_OWNER / VENDOR_STAFF 만
      if (pathname.startsWith("/seller")) {
        if (!PREVIEW_MODE && !VENDOR_ROLES.has(role)) {
          return forbidden(request, "VENDOR");
        }
      }

      // 4) /onboarding/buyer — BUYER_* + hospitalId 없음 (이미 연결됐으면 홈으로)
      if (pathname.startsWith("/onboarding/buyer")) {
        if (!PREVIEW_MODE && !BUYER_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        if (!PREVIEW_MODE && hospitalId) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // 5) /onboarding/vendor — VENDOR_* + vendorId 없음
      if (pathname.startsWith("/onboarding/vendor")) {
        if (!PREVIEW_MODE && !VENDOR_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        if (!PREVIEW_MODE && vendorId) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      // PUBLIC_PREFIXES 매칭 시 비로그인 통과 (next-firebase-auth-edge 의 publicPaths 는
      // 정확한 string 매칭만 지원 → /products/[id] 같은 동적 경로는 직접 처리)
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) {
        return NextResponse.next({ request: { headers: request.headers } });
      }
      // Phase α-2 — PREVIEW bypass 격리.
      // 비로그인 사용자가 인증 보호 페이지 디자인을 확인하려면 ENABLE_PREVIEW_BYPASS=true 명시 필요.
      const PREVIEW_MODE =
        process.env.ENABLE_PREVIEW_BYPASS === "true" &&
        process.env.NODE_ENV !== "production";
      const PREVIEW_PATHS = [
        "/onboarding",
        "/account",
        "/cart",
        "/checkout",
        "/orders",
        "/subscriptions",
        "/groupbuys",
        "/rfq",
        "/seller",
        "/admin",
      ];
      if (PREVIEW_MODE && PREVIEW_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next({ request: { headers: request.headers } });
      }
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
    handleError: async (e) => {
      console.error("[auth-proxy] error:", e);
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) {
        return NextResponse.next({ request: { headers: request.headers } });
      }
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
  });
}

// matcher 패턴:
//   - `_next/static`, `_next/image` 등 Next.js 내부 자산 제외
//   - `\\..*` — dot 이 포함된 경로 (e.g. `.svg`, `.png`, `.ico`, `.json`, `.txt`) 전부 제외
//     → `public/` 아래 정적 자산은 인증 검증을 거치지 않고 그대로 응답
//   ※ 누락하면 비로그인 사용자에 대해 `/vercel.svg` → `/login` 으로 redirect 되어 이미지가 깨짐
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
