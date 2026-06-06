// Wave Φ-A — admin/settlement.ts 에서 추출한 순수 헬퍼.
// 라우터 동작 변경 없음 — 기존 settlement.ts 내부 정의를 그대로 옮긴 것.
// (ctx·db 의존 없는 pure function 만 추출)

/**
 * Phase α-7 — 계좌번호 마스킹.
 * 4자 이하면 그대로, 그 외엔 마지막 4자리만 노출 (앞부분은 • 로 치환).
 * 예: "1234567890" → "••••••7890"
 */
export function maskBankAccount(account: string | undefined | null): string {
  if (!account) return "";
  const s = String(account);
  if (s.length <= 4) return s;
  return s.slice(0, -4).replace(/[0-9]/g, "•") + s.slice(-4);
}

/**
 * Firestore Timestamp(또는 직렬화 형태)를 epoch millis 로 변환.
 * toMillis / toDate / {seconds|_seconds} 순으로 시도하고 실패 시 0.
 */
export function tsToMs(ts: unknown): number {
  if (!ts || typeof ts !== "object") return 0;
  const w1 = ts as { toMillis?: () => number; toDate?: () => Date };
  if (typeof w1.toMillis === "function") {
    try {
      return w1.toMillis();
    } catch {
      /* fallthrough */
    }
  }
  if (typeof w1.toDate === "function") {
    try {
      return w1.toDate().getTime();
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") return sec * 1000;
  return 0;
}
