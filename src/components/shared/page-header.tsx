import type { ReactNode } from "react";

/**
 * 페이지 상단 헤더 — Apple Korea 스타일 큰 타이포 + 작은 라벨.
 *
 *   <PageHeader
 *     label="Admin"
 *     title="입점 심사"
 *     description="공급업체 신청을 심사하고 승인·반려·정지를 결정합니다."
 *   />
 *
 * 한글 5자 이상 타이틀에 gradient 적용 금지 — solid text-primary 만 사용 (헌법 §1.2).
 */
export function PageHeader({
  label,
  title,
  description,
  align = "left",
  children,
}: {
  /** 작은 카테고리 라벨. 대문자·트래킹 강조. */
  label?: string;
  /** 페이지 메인 타이틀. */
  title: string;
  /** 보조 설명 1~2줄. */
  description?: string;
  /** "center"는 랜딩·marketing 페이지용. */
  align?: "left" | "center";
  /** 헤더 우측 슬롯 (예: 액션 버튼). align="left" 일 때만 사용 권장. */
  children?: ReactNode;
}) {
  const isCenter = align === "center";

  return (
    <header
      className={
        isCenter
          ? "mx-auto max-w-3xl text-center"
          : "flex flex-wrap items-end justify-between gap-4"
      }
    >
      <div className={isCenter ? "" : "min-w-0"}>
        {label && (
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            {label}
          </p>
        )}
        <h1
          className={
            "mt-2 text-4xl font-semibold tracking-tight md:text-5xl"
          }
        >
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>

      {children && !isCenter && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </header>
  );
}
