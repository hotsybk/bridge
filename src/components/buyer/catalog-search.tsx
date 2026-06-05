"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, TrendingUp, X } from "lucide-react";

/**
 * 카탈로그 검색 — 박스 없는 라인 알약 + 인기 검색어 dropdown.
 *
 * 동작:
 *  - 닫힘: 작은 search 아이콘 버튼
 *  - 열림: 라인 알약 + 인풋 + 인기 검색어 추천 dropdown
 *  - Esc / 외부 클릭 시 닫힘
 *  - 인기 검색어 클릭 시 즉시 검색 이동
 */

const POPULAR_QUERIES = [
  "라텍스 장갑",
  "KF94 마스크",
  "살균 알코올",
  "디지털 청진기",
  "수술용 가운",
  "거즈",
] as const;

export function CatalogSearch({ initialQ = "" }: { initialQ?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 인기 검색어 필터링
  const suggestions = q.trim()
    ? POPULAR_QUERIES.filter((p) =>
        p.toLowerCase().includes(q.trim().toLowerCase()),
      ).slice(0, 5)
    : POPULAR_QUERIES.slice(0, 5);

  // open 시 input focus
  useEffect(() => {
    if (open) {
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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function submitQuery(query: string) {
    const trimmed = query.trim();
    setOpen(false);
    setQ(trimmed);
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(q);
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
        <>
          {/* 검색 알약 — 라인 only */}
          <form
            onSubmit={onSubmit}
            className="flex h-10 items-center gap-2.5 rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] pl-4 pr-1 shadow-sm transition-colors focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_4px_var(--color-accent-light)]"
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
              onClick={() => {
                if (q) {
                  setQ("");
                  inputRef.current?.focus();
                } else {
                  setOpen(false);
                }
              }}
              aria-label={q ? "입력 지우기" : "검색 닫기"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Dropdown — 인기 검색어 / 자동완성 */}
          <div
            role="listbox"
            className="popover-slide-down absolute right-0 top-12 z-40 w-[320px] overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] shadow-lg md:w-[360px]"
          >
            {suggestions.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 px-4 pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                  <TrendingUp className="h-3 w-3" />
                  {q.trim() ? "관련 검색어" : "지금 인기 검색어"}
                </div>
                <ul className="py-2">
                  {suggestions.map((s, i) => (
                    <li key={s}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => submitQuery(s)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]/60"
                      >
                        <span className="grid h-5 w-5 place-items-center text-[10px] font-semibold tabular-nums text-[var(--color-accent)]">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-left">
                          {highlightMatch(s, q)}
                        </span>
                        <SearchIcon className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[var(--color-border-light)] px-4 py-2.5 text-[10px] text-[var(--color-text-tertiary)]">
                  Esc 로 닫기 · Enter 로 검색
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  &quot;{q}&quot; 에 매칭되는 인기 검색어가 없습니다.
                </p>
                <button
                  type="button"
                  onClick={() => submitQuery(q)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  &quot;{q}&quot; 그대로 검색하기
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 검색어가 인기 검색어 일부와 매칭되면 accent 색으로 강조.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(trimmed.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-[var(--color-accent)]">
        {text.slice(idx, idx + trimmed.length)}
      </span>
      {text.slice(idx + trimmed.length)}
    </>
  );
}
