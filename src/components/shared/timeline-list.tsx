import { Check, Loader2 } from "lucide-react";

/**
 * 단계별 진행 표시 (검증 단계 / 심사 단계 / 주문 처리 단계 등).
 *
 *   <TimelineList
 *     items={[
 *       { label: "사업자등록증 인식 완료", status: "done" },
 *       { label: "국세청 진위 확인 중", status: "current" },
 *       { label: "등록 처리 대기", status: "pending" },
 *     ]}
 *   />
 *
 * 상태: done = 체크, current = 회전 spinner, pending = 빈 원, failed = X 아이콘 (별도 필요 시 확장).
 */
export type TimelineItemStatus = "done" | "current" | "pending";

export function TimelineList({
  items,
}: {
  items: ReadonlyArray<{
    label: string;
    /** 보조 설명 (timestamp 등). */
    sub?: string;
    status: TimelineItemStatus;
  }>;
}) {
  return (
    <ol className="space-y-3" role="list">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 flex h-5 w-5 items-center justify-center">
            {item.status === "done" && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-accent)] text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            {item.status === "current" && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
            )}
            {item.status === "pending" && (
              <span className="h-3 w-3 rounded-full border border-[var(--color-border-light)]" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p
              className={`text-sm ${
                item.status === "done"
                  ? "text-[var(--color-text-primary)]"
                  : item.status === "current"
                    ? "font-medium text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
              }`}
            >
              {item.label}
            </p>
            {item.sub && (
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                {item.sub}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
