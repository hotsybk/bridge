// Phase ν-1 — buyer 그룹 loading.tsx.
// catalog top-nav 가 페이지마다 자체 렌더되므로 layout 변경 없음 — 컨텐츠 영역만 skeleton.

export default function BuyerLoading() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            Loading
          </span>
        </div>

        {/* 헤더 영역 */}
        <div className="mt-8 space-y-3">
          <div className="h-8 w-1/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
        </div>

        {/* 카드 grid */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4"
            >
              <div className="aspect-square animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
