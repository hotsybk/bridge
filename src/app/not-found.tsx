import Link from "next/link";
import { ArrowRight, Compass, Stethoscope } from "lucide-react";

/**
 * 전역 404 페이지. Apple 톤 — 큰 타이포, 여백 중심.
 * Phase ν-2 — mobile safe-area + break-keep.
 */
export default function NotFound() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      {/* 미세 메쉬 배경 — 모바일은 성능 절약 차 hidden */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden md:block"
      >
        <svg
          viewBox="0 0 800 600"
          className="pointer-events-none absolute -right-32 -top-20 h-[600px] w-[800px] opacity-50"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="nf-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066CC" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="500"
            cy="200"
            r="220"
            fill="url(#nf-mesh-a)"
            className="landing-mesh-1"
          />
        </svg>
      </div>

      {/* 로고 */}
      <header className="mx-auto max-w-7xl px-6 pt-10 md:px-12">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">MedPlace</span>
        </Link>
      </header>

      {/* 본문 */}
      <section
        className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-20 text-center md:px-12 md:pt-32"
        style={{ paddingBottom: "max(6rem, env(safe-area-inset-bottom))" }}
      >
        <span className="landing-fade-up inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
          <Compass className="h-3.5 w-3.5" />
          404
        </span>

        <h1
          className="landing-fade-up mt-6 break-keep text-3xl font-semibold leading-[1.1] tracking-[-0.035em] md:text-5xl"
          style={{ animationDelay: "120ms" }}
        >
          이 페이지는
          <br />
          <span className="text-[var(--color-accent)]">사라졌습니다.</span>
        </h1>

        <p
          className="landing-fade-up mt-6 max-w-md break-keep text-sm leading-relaxed text-[var(--color-text-secondary)] md:mt-7"
          style={{ animationDelay: "260ms" }}
        >
          주소가 잘못되었거나, 페이지가 옮겨졌을 수 있습니다.
          홈에서 다시 시작해 주세요.
        </p>

        <div
          className="landing-fade-up mt-10 flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
          style={{ animationDelay: "400ms" }}
        >
          <Link
            href="/"
            className="landing-cta-glow inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white"
          >
            홈으로
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/search"
            className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            카탈로그 둘러보기
          </Link>
        </div>
      </section>
    </main>
  );
}
