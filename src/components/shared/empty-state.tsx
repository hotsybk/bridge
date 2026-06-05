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
 *
 * 디자인:
 *  - 큰 일러스트 아이콘 (h-16, 더블 레이어 — accent-light 백그라운드 + 메인 아이콘)
 *  - 미세 메쉬 글로우 배경
 *  - title 안에 ** ** 으로 감싼 부분은 accent 색으로 강조
 *  - 진입 시 landing-fade-up 으로 부드럽게 등장
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{
    className?: string;
    strokeWidth?: number;
    "aria-hidden"?: boolean;
  }>;
  title: string;
  description?: string;
  /** 선택 CTA 또는 링크. */
  action?: ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-[var(--color-border-light)] py-20 text-center">
      {/* 미세 메쉬 글로우 — 가운데 accent 색이 살짝 비치도록 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-start justify-center"
      >
        <div className="mt-12 h-40 w-40 rounded-full bg-[var(--color-accent)]/8 blur-3xl" />
      </div>

      <div className="flex flex-col items-center gap-3 px-6">
        {/* 더블 레이어 아이콘 — 큰 accent-light 원 + 작은 accent 아이콘 */}
        <div
          className="landing-fade-up relative grid h-20 w-20 place-items-center rounded-3xl bg-[var(--color-accent-light)]"
          style={{ animationDelay: "0ms" }}
        >
          <Icon
            className="h-9 w-9 text-[var(--color-accent)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        <p
          className="landing-fade-up mt-3 max-w-md text-sm font-medium tracking-tight text-[var(--color-text-primary)]"
          style={{ animationDelay: "120ms" }}
        >
          {renderTitleWithHighlights(title)}
        </p>
        {description && (
          <p
            className="landing-fade-up max-w-md text-sm text-[var(--color-text-secondary)]"
            style={{ animationDelay: "220ms" }}
          >
            {description}
          </p>
        )}
        {action && (
          <div
            className="landing-fade-up mt-5"
            style={{ animationDelay: "320ms" }}
          >
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "** 검색어 ** 결과가 없습니다" 처럼 ** ** 안의 텍스트를 accent 색으로 강조.
 */
function renderTitleWithHighlights(text: string): ReactNode {
  // " 로 감싼 부분 (예: "수술용 장갑" 결과가 없습니다)
  const parts = text.split(/("[^"]+")/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      return (
        <span
          key={i}
          className="rounded-md bg-[var(--color-accent-light)] px-1.5 py-0.5 text-[var(--color-accent)]"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
