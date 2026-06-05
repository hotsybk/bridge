// Phase ν-1 — 전역 loading.tsx.
// Apple 톤 minimal 스켈레톤. 그룹별 loading 이 우선 매칭되므로
// 본 파일은 group 외 라우트 fallback.

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-32">
        <div className="flex flex-col items-center text-center">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          </span>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            Loading
          </p>
        </div>

        <div className="mt-16 space-y-4">
          <div className="h-7 w-1/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
