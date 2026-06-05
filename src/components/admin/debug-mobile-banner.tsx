import { Monitor } from "lucide-react";

/**
 * Phase ν-5 작업4 — admin/debug 모바일 권장 안내 배너.
 *
 * debug 도구는 JSON 입력·Firestore 쿼리·callable 호출 등 PC 환경이 전제다.
 * 모바일에서는 가로 overflow 와 좁은 입력창으로 사용성이 매우 떨어지므로,
 * 화면 진입 직후 "PC 권장" 안내 배너를 노출한다.
 *
 * CSS only — md 이상에서는 `hidden`. 컨테이너에 가로 overflow 차단도 함께 권장.
 */
export function DebugMobileBanner() {
  return (
    <div className="md:hidden">
      <div className="mx-auto flex w-full max-w-[100vw] items-start gap-3 overflow-x-hidden border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
          <Monitor className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-warning)]">
            PC 환경에서 사용을 권장합니다
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            debug 도구는 JSON 입력·Firestore 쿼리·callable 호출이 포함되어
            데스크탑 환경에 최적화되어 있습니다. 모바일에서는 일부 입력창과
            출력 표가 가로 스크롤될 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
