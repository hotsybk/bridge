import { Eye } from "lucide-react";

/**
 * Preview 모드 표시 — admin·운영 페이지의 비로그인 fallback 안내.
 *
 * Phase ω-1: 페이지마다 흩어져 있던 5종 inline 변형(`PREVIEW` chip / `(PREVIEW — 로그인 후 …)` /
 * `미리보기 모드 — …`)을 한 컴포넌트로 통일.
 *
 *   <PreviewBadge />                       // chip 형태 (inline)
 *   <PreviewBadge variant="banner" />      // 페이지 상단 띠
 *   <PreviewBadge message="…" />           // 메시지 override
 *
 * 디자인 — warning 토큰 사용. 박스 보더만 (gradient·shadow 금지, 헌법 §1.2).
 */
export function PreviewBadge({
  variant = "chip",
  message,
  className = "",
}: {
  /** chip: 헤더 옆 작은 inline. banner: 페이지 상단 띠. */
  variant?: "chip" | "banner";
  /** 기본 메시지 override. */
  message?: string;
  className?: string;
}) {
  const defaultMsg = "미리보기 — 로그인 후 실 데이터 표시";
  const text = message ?? defaultMsg;

  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-[var(--color-warning)]/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warning)] ${className}`}
      >
        <Eye className="h-3 w-3" aria-hidden />
        Preview
      </span>
    );
  }

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-4 py-3 text-xs text-[var(--color-warning)] ${className}`}
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
