// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("rate-limit helper must be used only on the server side.");
}

// Σ-3 — 범용 Firestore 기반 sliding-window rate limiter.
//
// 기존 rate limit 은 email 기반이라 공격자가 email 만 바꾸면 우회 가능.
// 이 helper 는 임의 key(특히 client IP)로 제한해 그 우회를 막는다.
//
// 저장: `_rateLimits/{key}` 에 윈도 내 hit timestamp 배열(sliding-window log).
//   - expiresAt 필드로 TTL 정리 (Σ-4: Firestore TTL 정책 대상)
//   - 트랜잭션으로 동시 요청 race 방지

// eslint-disable-next-line import/first
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line import/first
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// eslint-disable-next-line import/first
import { adminDb } from "@/server/firebase/admin";

/** Firestore doc ID 안전 키로 변환 (영숫자 외 → _, 최대 1500바이트 제한 회피). */
function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export interface RateLimitOptions {
  /** 식별 key — 예: `marketing:1.2.3.4` */
  key: string;
  /** 윈도 내 최대 허용 횟수 */
  limit: number;
  /** 윈도 길이(초) */
  windowSec: number;
  /** 초과 시 메시지 (기본: 한국어 안내) */
  message?: string;
}

/**
 * sliding-window rate limit. 초과 시 TRPCError(TOO_MANY_REQUESTS) throw.
 * key 가 빈 문자열이면 (IP 미확인 등) no-op — 정상 사용자를 막지 않음.
 */
export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  if (!opts.key) return; // IP 미확인 시 통과 (가용성 우선)

  const db = adminDb();
  const ref = db.collection("_rateLimits").doc(safeKey(opts.key));
  const now = Date.now();
  const windowStart = now - opts.windowSec * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { hits?: number[] } | undefined;
    const hits = (data?.hits ?? []).filter((t) => t > windowStart);

    if (hits.length >= opts.limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          opts.message ??
          "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    hits.push(now);
    tx.set(
      ref,
      {
        hits,
        updatedAt: FieldValue.serverTimestamp(),
        // TTL 정리용 — 윈도 2배 후 만료
        expiresAt: Timestamp.fromMillis(now + opts.windowSec * 2 * 1000),
      },
      { merge: true },
    );
  });
}
