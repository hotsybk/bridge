"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Baby,
  Bone,
  Ear,
  Eye,
  Grid3x3,
  Package,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";

// Wave 2 — 카테고리 doc 의 icon 필드("Sparkles" 등) → Lucide 컴포넌트 매핑.
const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Smile,
  Stethoscope,
  Bone,
  Scissors,
  Baby,
  Eye,
  Ear,
  Syringe,
  Package,
};

export interface CatalogNavCategory {
  id: string;
  name: string;
  depth: number;
  icon?: string;
  parentId?: string | null;
}

interface NavItem {
  id: string | null;
  label: string;
  icon: LucideIcon;
}

// useLayoutEffect 는 SSR 에서 경고. 환경별로 분기.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Wave 2 — 진료과 10 대분류 동적 nav.
 *
 * 서버 페이지에서 product.categories() 로 받은 전체 카테고리를 prop 으로 받아,
 * 진료과 대분류(depth === 1 && icon 보유)만 노출한다. 구 cat-* / nanoid 카테고리는
 * icon 이 없으므로 자동 제외된다.
 *
 * "전체" + 진료과 N개 탭. 가로 스크롤(모바일) + sliding ink-bar.
 */
export function CatalogNav({
  categories = [],
}: {
  categories?: CatalogNavCategory[];
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentCategoryId = sp.get("categoryId");

  // 진료과 대분류만 — depth 1 + icon 보유. sortOrder 는 서버에서 이미 정렬됨.
  const depts = categories
    .filter((c) => c.depth === 1 && Boolean(c.icon))
    .map<NavItem>((c) => ({
      id: c.id,
      label: c.name,
      icon: (c.icon && ICON_MAP[c.icon]) || Package,
    }));

  const items: NavItem[] = [
    { id: null, label: "전체", icon: Grid3x3 },
    ...depts,
  ];

  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const activeIdx = items.findIndex(
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
  }, [activeIdx, pathname, items.length]);

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
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <ul
          ref={listRef}
          className="relative flex h-14 items-stretch gap-0 overflow-x-auto md:justify-center md:gap-1 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => {
            const active =
              (item.id === null && !currentCategoryId) ||
              currentCategoryId === item.id;
            const href = item.id ? `/search?categoryId=${item.id}` : "/search";
            const Icon = item.icon;
            return (
              <li
                key={item.id ?? "all"}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="shrink-0"
              >
                <Link
                  href={href}
                  className={`group flex h-full flex-col items-center justify-center gap-0.5 px-3 transition-colors md:px-3.5 ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="whitespace-nowrap text-[11px] font-medium md:text-xs">
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
