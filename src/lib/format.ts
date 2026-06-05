/**
 * 포맷 헬퍼 통합 — Phase ν-4.
 *
 * 그동안 페이지별로 흩어져 있던
 *   - `${n}원` / `₩${n.toLocaleString()}` / `n.toLocaleString("ko-KR")` 등 통화
 *   - `new Date(x).toISOString().slice(0,10)` 등 날짜
 *   - `tsToMs` / `formatDate` / `formatDateTime` 로컬 정의
 * 를 한 곳에서 관리.
 *
 * Firestore Timestamp(`{ seconds, _seconds, toDate() }`), Date, number(ms),
 * ISO string 모두 안전하게 처리한다.
 *
 * `src/lib/utils/firestore-time.ts` 의 정의도 이 파일을 re-export 한다.
 */

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("ko-KR", {
  numeric: "auto",
});

// ─────────────────────────────────────────────────────────────
// 시간 파싱
// ─────────────────────────────────────────────────────────────

type FirestoreTimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

export type FormatInput =
  | Date
  | string
  | number
  | FirestoreTimestampLike
  | null
  | undefined
  | unknown;

export function parseDate(input: FormatInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string") {
    const parsed = Date.parse(input);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  if (typeof input !== "object") return null;
  const obj = input as FirestoreTimestampLike;
  if (typeof obj.toDate === "function") {
    try {
      return obj.toDate();
    } catch {
      return null;
    }
  }
  if (typeof obj.seconds === "number") return new Date(obj.seconds * 1000);
  if (typeof obj._seconds === "number") return new Date(obj._seconds * 1000);
  return null;
}

export function tsToMs(input: FormatInput): number {
  const d = parseDate(input);
  return d ? d.getTime() : 0;
}

// ─────────────────────────────────────────────────────────────
// 통화
// ─────────────────────────────────────────────────────────────

/**
 * "₩1,234,000" — 메인 통화 포맷. 가장 흔한 표기.
 * null / undefined / NaN 은 "₩0".
 */
export function formatKRW(
  amount: number | undefined | null,
): string {
  if (amount == null || !Number.isFinite(amount)) return "₩0";
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

/**
 * "1,234,000원" — 본문 문장 안에 어울리는 표기. 백엔드 메시지/이메일 본문 등에서.
 */
export function formatKRWWon(amount: number | undefined | null): string {
  if (amount == null || !Number.isFinite(amount)) return "0원";
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

// ─────────────────────────────────────────────────────────────
// 날짜
// ─────────────────────────────────────────────────────────────

/**
 * "YYYY-MM-DD" — 한국 ISO 표시.
 */
export function formatDate(
  input: FormatInput,
): string {
  const d = parseDate(input);
  if (!d) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * "YYYY-MM-DD HH:mm"
 */
export function formatDateTime(
  input: FormatInput,
): string {
  const d = parseDate(input);
  if (!d) return "—";
  const datePart = formatDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} ${hh}:${mm}`;
}

/**
 * "YYYY-MM-DD HH:mm:ss" — 초까지 표시. 감사 로그·디버그 등에서.
 */
export function formatDateTimeSec(input: FormatInput): string {
  const d = parseDate(input);
  if (!d) return "—";
  const datePart = formatDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${datePart} ${hh}:${mm}:${ss}`;
}

/**
 * "HH:mm"
 */
export function formatTime(
  input: FormatInput,
): string {
  const d = parseDate(input);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * "5분 전" / "1시간 전" / "2일 후" 등 상대 시간.
 */
export function formatRelative(
  input: FormatInput,
  now: Date = new Date(),
): string {
  const d = parseDate(input);
  if (!d) return "";
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return RELATIVE_FORMATTER.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return RELATIVE_FORMATTER.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return RELATIVE_FORMATTER.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) {
    return RELATIVE_FORMATTER.format(diffMonth, "month");
  }
  const diffYear = Math.round(diffMonth / 12);
  return RELATIVE_FORMATTER.format(diffYear, "year");
}
