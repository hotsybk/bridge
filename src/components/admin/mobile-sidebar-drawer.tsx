"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { AdminSidebar } from "./admin-sidebar";

/**
 * Phase ξ-1 — 운영자 콘솔 모바일 sidebar drawer.
 *
 * - 햄버거 trigger (md 미만에서만 표시)
 * - 좌측 280px slide-in drawer + backdrop
 * - body scroll lock, ESC 닫기, navigate 시 자동 닫기
 */
export function MobileSidebarDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] md:hidden"
        aria-label="메뉴 열기"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-[280px] overflow-y-auto border-r border-[var(--color-border-light)] bg-[var(--color-bg-primary)] shadow-2xl md:hidden"
            role="dialog"
            aria-label="운영자 메뉴"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-light)] px-4 py-3">
              <span className="text-sm font-semibold tracking-tight">
                메뉴
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-4 pl-3 pr-2">
              <AdminSidebar mobile onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
