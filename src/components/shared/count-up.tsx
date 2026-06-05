"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면에 들어올 때 0 (or `from`) → `value` 까지 부드럽게 카운트업.
 *
 *   <CountUp value={12380000} prefix="₩" />
 *   <CountUp value={28} suffix="개" />
 *
 * - IntersectionObserver 로 1회 트리거 (재진입 시 재실행 X)
 * - `prefers-reduced-motion: reduce` 시 즉시 최종값 표시
 * - requestAnimationFrame 기반 easeOutCubic 보간
 */
export function CountUp({
  value,
  from = 0,
  duration = 1200,
  prefix = "",
  suffix = "",
  className = "",
  /** 정수만 표시할지 — 통화·갯수는 보통 true */
  integer = true,
}: {
  value: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  integer?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState<number>(from);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || startedRef.current) continue;
          startedRef.current = true;
          obs.unobserve(el);

          const startTs = performance.now();
          const delta = value - from;
          const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

          const tick = (now: number) => {
            const elapsed = now - startTs;
            const t = Math.min(1, elapsed / duration);
            const next = from + delta * easeOutCubic(t);
            setDisplay(next);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, from, duration]);

  const out = integer
    ? Math.round(display).toLocaleString()
    : display.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {out}
      {suffix}
    </span>
  );
}
