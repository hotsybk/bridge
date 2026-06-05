import { Check } from "lucide-react";

/**
 * onboarding wizard 진행 stepper.
 *
 *   <WizardStepper
 *     orientation="vertical"
 *     steps={[
 *       { id: 1, label: "사업자등록증" },
 *       { id: 2, label: "병원 정보" },
 *       { id: 3, label: "검증" },
 *       { id: 4, label: "완료" },
 *     ]}
 *     current={2}
 *     hint="처음 5분이면 충분합니다."
 *   />
 *
 * - vertical: 데스크탑 좌측 사이드바형
 * - horizontal: 모바일·간략형 상단 막대
 */
export function WizardStepper({
  steps,
  current,
  orientation = "vertical",
  hint,
}: {
  steps: ReadonlyArray<{ id: number; label: string }>;
  /** 1-based 현재 step id */
  current: number;
  orientation?: "vertical" | "horizontal";
  /** 좌측 stepper 하단 안내 텍스트 */
  hint?: string;
}) {
  if (orientation === "horizontal") {
    return (
      <ol
        className="flex w-full gap-2"
        aria-label="진행 단계"
      >
        {steps.map((s) => {
          const isActive = current === s.id;
          const isDone = current > s.id;
          return (
            <li
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                isActive || isDone
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-border-light)]"
              }`}
              aria-current={isActive ? "step" : undefined}
            />
          );
        })}
      </ol>
    );
  }

  return (
    <nav aria-label="진행 단계" className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        진행 단계
      </p>
      <ol className="mt-3 space-y-0">
        {steps.map((s, idx) => {
          const isActive = current === s.id;
          const isDone = current > s.id;
          const isLast = idx === steps.length - 1;
          return (
            <li key={s.id} className="relative flex gap-3">
              {/* 좌측 marker + 세로선 */}
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-medium transition-colors ${
                    isDone
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                      : isActive
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                        : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)]"
                  }`}
                  aria-hidden
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : s.id}
                </span>
                {!isLast && (
                  <span
                    className={`my-1 w-px flex-1 ${
                      isDone
                        ? "bg-[var(--color-accent)]"
                        : "bg-[var(--color-border-light)]"
                    }`}
                  />
                )}
              </div>

              {/* 라벨 */}
              <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                <p
                  className={`text-xs transition-colors ${
                    isActive
                      ? "font-semibold text-[var(--color-text-primary)]"
                      : isDone
                        ? "font-medium text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {hint && (
        <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">{hint}</p>
      )}
    </nav>
  );
}
