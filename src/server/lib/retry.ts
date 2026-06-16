// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("retry helper must be used only on the server side.");
}

// Phase β-3 작업 1 — Exponential backoff with jitter.
//
// 외부 API (PortOne, Solapi, MFDS, Clova, NTS) 호출 시 일시 장애 대응.
//
// 정책:
//   - 4xx HTTP error: no retry (client error)
//   - 5xx / network / timeout: retry up to maxAttempts
//   - delay: baseDelayMs * 2^(attempt-1) + jitter (최대 maxDelayMs)
//   - shouldRetry 콜백으로 커스텀 분기 가능

export interface RetryOptions {
  /** 최대 시도 횟수 (default 3) */
  maxAttempts?: number;
  /** 첫 retry 까지 대기 (ms, default 500) */
  baseDelayMs?: number;
  /** 단일 retry 최대 대기 (ms, default 5000) */
  maxDelayMs?: number;
  /** false 반환 시 더 이상 retry 안 함. status 5xx/4xx 기본 룰보다 먼저 평가. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    shouldRetry,
  } = opts;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      if (shouldRetry && !shouldRetry(err, attempt)) break;

      // 4xx → no retry (보통 client error), 5xx/network → retry
      const status =
        (err as { status?: number })?.status ??
        (err as { response?: { status?: number } })?.response?.status;
      if (typeof status === "number" && status >= 400 && status < 500) break;

      const exp = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * exp * 0.3);
      const delay = exp + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/**
 * Σ-1 — fetch + AbortController 타임아웃.
 * 외부 API 가 응답 없이 hang 되면 함수가 무한 대기 → Cloud Function 타임아웃까지 소진되는
 * 문제 방지. timeout 초과 시 AbortError throw (withRetry 와 조합 시 재시도됨).
 * `typeof fetch` 기반 타입으로 DOM lib 의존 없음 (Node 18+/Edge/브라우저 공통).
 */
export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = 10_000,
): Promise<Awaited<ReturnType<typeof fetch>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init ?? {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
