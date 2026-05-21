import { NextResponse, type NextRequest } from "next/server";
import { authMiddleware, redirectToLogin } from "next-firebase-auth-edge";

const PUBLIC_PATHS = ["/", "/login", "/register", "/about", "/pricing", "/search"];

// /products/[id] 등 prefix 매칭 PUBLIC 경로 (비로그인 둘러보기 OK)
const PUBLIC_PREFIXES = ["/products/"];

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

      // PUBLIC 경로는 인증 사용자도 자유 접근
      if (isPublicPath(pathname) && pathname !== "/login" && pathname !== "/register") {
        return NextResponse.next({ request: { headers } });
      }

      // 1) 로그인 사용자가 /login·/register 접근 → 홈으로
      if (pathname === "/login" || pathname === "/register") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      // 2) /admin/* (debug 포함) — ADMIN / SUPER_ADMIN 만
      if (pathname.startsWith("/admin")) {
        if (!ADMIN_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // 3) /seller/* — VENDOR_OWNER / VENDOR_STAFF 만
      if (pathname.startsWith("/seller")) {
        if (!VENDOR_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // 4) /onboarding/buyer — BUYER_* + hospitalId 없음 (이미 연결됐으면 홈으로)
      if (pathname.startsWith("/onboarding/buyer")) {
        if (!BUYER_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        if (hospitalId) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // 5) /onboarding/vendor — VENDOR_* + vendorId 없음
      if (pathname.startsWith("/onboarding/vendor")) {
        if (!VENDOR_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        if (vendorId) {
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
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
    handleError: async (e) => {
      console.error("Auth proxy error:", e);
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
