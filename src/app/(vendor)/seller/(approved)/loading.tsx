// Phase ν-1 — seller (approved) 그룹 loading.tsx.
// SellerSubNav 는 layout 에서 렌더되므로 그대로 유지 — 컨텐츠 영역만 skeleton.

export default function SellerLoading() {
  return (
    <main className="min-h-[60vh] bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-14">
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
        <div className="mt-6 space-y-3">
          <div className="h-7 w-1/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
        </div>

        {/* KPI grid */}
        <div className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-6 md:px-6 md:py-8">
              <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="mt-3 h-8 w-3/4 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
            </div>
          ))}
        </div>

        {/* table rows */}
        <div className="mt-10 border-y border-[var(--color-border-light)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--color-border-light)] px-2 py-4 last:border-0"
            >
              <div className="h-4 w-1/4 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="h-4 flex-1 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
