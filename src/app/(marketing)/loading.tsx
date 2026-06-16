// Phase ν-1 — marketing 그룹 loading.tsx.

export default function MarketingLoading() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-12 md:py-28">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            Loading
          </span>
        </div>

        <div className="mt-10 space-y-5">
          <div className="h-12 w-2/3 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-12 w-1/2 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-5 w-3/5 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
