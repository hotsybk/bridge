"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Activity,
  Cross,
  Grid3x3,
  Leaf,
  Package,
  Shield,
  Smile,
  Stethoscope,
  Heart,
} from "lucide-react";

const ITEMS = [
  { id: null, label: "전체", icon: Grid3x3 },
  { id: "cat-medsupply", label: "의료소모품", icon: Package },
  { id: "cat-meddevice", label: "의료기기", icon: Activity },
  { id: "cat-medsupply-disposable", label: "일회용", icon: Shield },
  { id: "cat-medsupply-dressing", label: "드레싱", icon: Cross },
  { id: "cat-meddevice-diagnostic", label: "진단기기", icon: Stethoscope },
  { id: "cat-meddevice-monitor", label: "모니터링", icon: Heart },
  { id: "cat-etc-oriental", label: "한방", icon: Leaf },
  { id: "cat-etc-dental", label: "치과", icon: Smile },
] as const;

// useLayoutEffect 는 SSR 에서 경고. 환경별로 분기.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function CatalogNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentCategoryId = sp.get("categoryId");

  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const activeIdx = ITEMS.findIndex(
    (item) =>
      (item.id === null && !currentCategoryId) || currentCategoryId === item.id,
  );

  // 활성 탭 위치를 측정해서 indicator 의 left·width 계산
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    const activeEl = itemRefs.current[activeIdx];
    if (!list || !activeEl) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    setIndicator({
      left: activeRect.left - listRect.left + list.scrollLeft,
      width: activeRect.width,
      ready: true,
    });
  }, [activeIdx, pathname]);

  // resize 시 재측정
  useEffect(() => {
    function onResize() {
      const list = listRef.current;
      const activeEl = itemRefs.current[activeIdx];
      if (!list || !activeEl) return;
      const listRect = list.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicator({
        left: activeRect.left - listRect.left + list.scrollLeft,
        width: activeRect.width,
        ready: true,
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeIdx]);

  // Only active on /search
  if (pathname !== "/search") return null;

  return (
    <nav
      aria-label="카테고리"
      className="sticky top-14 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/90 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-12">
        <ul
          ref={listRef}
          className="relative flex h-16 items-stretch gap-0 overflow-x-auto md:justify-center md:gap-2 [&::-webkit-scrollbar]:hidden"
        >
          {ITEMS.map((item, i) => {
            const active =
              (item.id === null && !currentCategoryId) ||
              currentCategoryId === item.id;
            const href = item.id ? `/search?categoryId=${item.id}` : "/search";
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="shrink-0"
              >
                <Link
                  href={href}
                  className={`group flex h-full flex-col items-center justify-center gap-0.5 px-3 transition-colors md:gap-1 md:px-4 ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4 md:h-4 md:w-4" aria-hidden />
                  <span className="text-[11px] font-medium whitespace-nowrap md:text-sm">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* Sliding ink-bar — 활성 탭 위치로 부드럽게 이동 */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 h-[2px] bg-[var(--color-accent)] transition-[left,width,opacity] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              left: `${indicator.left}px`,
              width: `${indicator.width}px`,
              opacity: indicator.ready ? 1 : 0,
            }}
          />
        </ul>
      </div>
    </nav>
  );
}
