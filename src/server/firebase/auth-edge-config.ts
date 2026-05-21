// next-firebase-auth-edge 공통 설정.
// Route Handlers(/api/login·logout·refresh-token) 와 proxy.ts(edge middleware) 에서 재사용.
// 환경변수가 누락되어 있어도 import 시점에 throw하지 않도록 lazy getter 패턴.

const COOKIE_MAX_AGE_DAYS = 12;

export function getAuthEdgeConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    cookieName: process.env.NEXT_PUBLIC_FIREBASE_AUTH_COOKIE_NAME ?? "AuthToken",
    cookieSignatureKeys: [
      process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_1 ?? "",
      process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_2 ?? "",
    ],
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: COOKIE_MAX_AGE_DAYS * 60 * 60 * 24,
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? "",
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? "",
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    },
  };
}
