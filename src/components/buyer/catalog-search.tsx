"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";

/**
 * Apple 스타일 검색 — 아이콘 클릭 시 input 펼침.
 * Esc 또는 외부 클릭 시 닫힘.
 */
export function CatalogSearch({ initialQ = "" }: { initialQ?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // open 시 input focus
  useEffect(() => {
    if (open) {
      // 짧은 지연 — animation 후 focus
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Esc 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    setOpen(false);
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="검색 열기"
          className="grid h-10 w-10 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex h-10 items-center gap-2 rounded-full bg-[var(--color-bg-secondary)] pl-3 pr-1"
        >
          <SearchIcon
            className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="장갑·거즈·소독제 검색"
            className="h-8 w-48 bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none md:w-72"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="검색 닫기"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}
