// Server-only enforcement (server-only 패키지 대체, Node 스크립트 호환)
if (typeof window !== "undefined") {
  throw new Error("server auth helpers must be used only on the server side.");
}

import { cookies } from "next/headers";
import { getTokens, type Tokens } from "next-firebase-auth-edge";

const authConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: process.env.NEXT_PUBLIC_FIREBASE_AUTH_COOKIE_NAME ?? "AuthToken",
  cookieSignatureKeys: [
    process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_1!,
    process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_2!,
  ],
  serviceAccount: {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
});

/**
 * Server-side session lookup.
 * Returns the decoded Firebase ID token from the signed auth cookie, or null
 * if the user is not signed in (or the cookie is invalid/expired).
 */
export async function getServerTokens(): Promise<Tokens | null> {
  const cookieStore = await cookies();
  return getTokens(cookieStore, authConfig());
}
