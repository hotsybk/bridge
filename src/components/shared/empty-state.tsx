import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * 비어있는 상태 표시 — 운영 페이지 / 테이블 / 검색 결과 등에서 공용.
 *
 *   <EmptyState
 *     icon={Sparkles}
 *     title="오늘은 처리할 신청이 없습니다"
 *     description="새 신청은 자동으로 이 목록에 추가됩니다."
 *     action={<Link href="/admin/vendors?status=APPROVED">승인된 vendor 보기</Link>}
 *   />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  /** 선택 CTA 또는 링크. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-bg-secondary)] p-16 text-center">
      <Icon
        className="h-10 w-10 text-[var(--color-text-tertiary)]"
        aria-hidden
      />
      <p className="text-base font-medium text-[var(--color-text-primary)]">
        {title}
      </p>
      {description && (
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
