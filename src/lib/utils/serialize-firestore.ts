/**
 * Firestore Admin SDK Timestamp / DocumentReference 등을 plain object로 변환.
 *
 * Server Component → Client Component props 전달 시 Next.js가
 * "Classes or null prototypes are not supported" 에러를 던지므로 필수.
 *
 * Timestamp → { _seconds, _nanoseconds } (superjson과 호환)
 * Date → ISO string
 * 나머지는 재귀 traversal.
 */

export function serializeFirestore<T>(value: T): T {
  if (value === null || value === undefined) return value;

  // Timestamp 감지: toMillis() + seconds + nanoseconds 보유
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in (value as Record<string, unknown>) &&
    typeof (value as { toMillis?: () => number }).toMillis === "function" &&
    "seconds" in (value as Record<string, unknown>) &&
    "nanoseconds" in (value as Record<string, unknown>)
  ) {
    const ts = value as unknown as { seconds: number; nanoseconds: number };
    return { _seconds: ts.seconds, _nanoseconds: ts.nanoseconds } as unknown as T;
  }

  // Date → ISO
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  // Array
  if (Array.isArray(value)) {
    return value.map((v) => serializeFirestore(v)) as unknown as T;
  }

  // Plain object (recursive)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeFirestore(v);
    }
    return out as unknown as T;
  }

  return value;
}
