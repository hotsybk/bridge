/**
 * Firestore Timestamp / Date / number 를 안전하게 ms 로 변환 — Phase δ-9.
 *
 * Phase ν-4: 본 모듈은 `src/lib/format.ts` 통합 모듈을 re-export 한다.
 * 신규 코드는 `@/lib/format` 에서 직접 import 할 것.
 */

export { tsToMs, formatDate, formatDateTime } from "@/lib/format";
