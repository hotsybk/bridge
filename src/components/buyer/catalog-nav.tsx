"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

export function CatalogNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentCategoryId = sp.get("categoryId");

  // Only active on /search
  if (pathname !== "/search") return null;

  return (
    <nav
      aria-label="카테고리"
      className="sticky top-14 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/90 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-12">
        <ul className="flex h-16 items-stretch gap-0 overflow-x-auto md:gap-2 [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((item) => {
            const active =
              (item.id === null && !currentCategoryId) ||
              currentCategoryId === item.id;
            const href = item.id ? `/search?categoryId=${item.id}` : "/search";
            const Icon = item.icon;
            return (
              <li key={item.label} className="shrink-0">
                <Link
                  href={href}
                  className={`group flex h-full flex-col items-center justify-center gap-0.5 border-b-2 px-3 transition-colors md:gap-1 md:px-4 ${
                    active
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4 md:h-4 md:w-4" aria-hidden />
                  <span className="text-[11px] font-medium whitespace-nowrap md:text-xs">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
