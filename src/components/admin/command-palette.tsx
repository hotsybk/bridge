"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

// ─────────────────────────────────────────────────────────────
// Phase γ-1 — admin 전역 ⌘K Command palette.
//
// ⌘K / Ctrl+K 으로 열림. 주문번호 / Hospital·Vendor·Product 이름 prefix /
// nanoid 정확 일치 lookup. 결과 클릭 시 router.push.
// ─────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  order: "주문",
  hospital: "병원",
  vendor: "공급업체",
  dispute: "분쟁",
  product: "상품",
  user: "사용자",
};

const RECENT_KEY = "admin.commandPalette.recent.v1";

type RecentItem = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
};

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: RecentItem) {
  if (typeof window === "undefined") return;
  try {
    const current = loadRecent().filter(
      (r) => !(r.type === item.type && r.id === item.id),
    );
    current.unshift(item);
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(current.slice(0, 5)),
    );
  } catch {
    // ignore quota
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Custom event listener — top bar 버튼이 dispatch.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    document.addEventListener("admin:command-palette:open", onOpen);
    return () =>
      document.removeEventListener("admin:command-palette:open", onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      // 입력 포커스
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const searchQuery = trpc.admin.search.global.useQuery(
    { query: query.trim(), limit: 8 },
    { enabled: open && query.trim().length >= 2 },
  );

  const navigate = (item: RecentItem) => {
    pushRecent(item);
    setOpen(false);
    router.push(item.url);
  };

  const results = searchQuery.data?.results ?? [];
  const showRecent = query.trim().length < 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="h-[100dvh] max-w-none gap-0 overflow-hidden rounded-none p-0 sm:max-w-2xl md:h-auto md:max-h-[80vh] md:rounded-xl"
        showCloseButton={false}
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border-light)] px-5 py-4">
          <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="주문번호, vendor ID, hospital ID, 분쟁 ID..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
          />
          <kbd className="rounded border border-[var(--color-border-light)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-tertiary)]">
            ESC
          </kbd>
        </div>
        <div className="flex-1 overflow-y-auto md:max-h-96">
          {showRecent ? (
            recent.length > 0 ? (
              <>
                <p className="px-5 pt-3 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  최근 본 항목
                </p>
                {recent.map((r) => (
                  <ResultRow
                    key={`${r.type}-${r.id}-recent`}
                    item={r}
                    onSelect={navigate}
                  />
                ))}
              </>
            ) : (
              <p className="px-5 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
                2자 이상 입력하면 검색합니다
              </p>
            )
          ) : searchQuery.isFetching ? (
            <p className="px-5 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
              검색 중…
            </p>
          ) : results.length === 0 ? (
            <p className="px-5 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
              일치하는 결과가 없습니다
            </p>
          ) : (
            results.map((r) => (
              <ResultRow
                key={`${r.type}-${r.id}`}
                item={r}
                onSelect={navigate}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({
  item,
  onSelect,
}: {
  item: RecentItem;
  onSelect: (item: RecentItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {item.title}
        </p>
        <p className="truncate font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
          {item.subtitle}
        </p>
      </div>
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {TYPE_LABEL[item.type] ?? item.type}
      </span>
    </button>
  );
}
