"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-triggered fade-up reveal — 메인 페이지 §4.3 A2.
 *
 *   <Reveal delay={150}>
 *     <Card />
 *   </Reveal>
 *
 * - Intersection Observer 1회 트리거 (재진입 시 재실행 X)
 * - `prefers-reduced-motion: reduce` 시 즉시 visible (globals.css 보강)
 * - JS 비활성/실패 시에도 텍스트는 스크린리더 노출됨 (opacity 만 사용)
 *
 * 헌법 §1.2 디자인 금기와 무관 — micro-interaction 수준.
 */
export function Reveal({
  delay = 0,
  threshold = 0.15,
  children,
}: {
  /** ms 단위. stagger 적용 시 0, 150, 300 식으로 */
  delay?: number;
  /** Intersection threshold (0~1). 기본 0.15 = 15% 보이면 트리거 */
  threshold?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // delay 후 .is-visible 토글
            const timer = window.setTimeout(() => {
              el.classList.add("is-visible");
            }, delay);
            obs.unobserve(el);
            return () => window.clearTimeout(timer);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -50px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, threshold]);

  return (
    <div
      ref={ref}
      className="landing-reveal"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
