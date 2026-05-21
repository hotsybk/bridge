import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=2000&q=80";

/**
 * Apple "손쉬운 사용" 패턴 — 큰 배경 사진 + 어두운 overlay + 텍스트·CTA.
 */
export function HeroBanner() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* 배경 이미지 */}
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* gradient overlay */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20"
      />

      {/* 콘텐츠 */}
      <div className="relative mx-auto flex min-h-[500px] max-w-6xl flex-col items-center justify-end px-6 pb-16 pt-32 text-center text-white md:min-h-[600px] md:px-12 md:pb-24 md:pt-40">
        <div className="landing-fade-up" style={{ animationDelay: "0ms" }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            Phase 1 베타 — 무료 둘러보기
          </span>
        </div>

        <h1
          className="landing-fade-up mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-7xl"
          style={{ animationDelay: "150ms" }}
        >
          정품 인증,
          <br />
          믿을 수 있는 의료 용품.
        </h1>

        <p
          className="landing-fade-up mt-6 max-w-xl text-base text-white/85 md:text-lg"
          style={{ animationDelay: "350ms" }}
        >
          중간 도매상 없이, 병원과 공급업체가 직접 만나는 곳.
        </p>

        <div
          className="landing-fade-up mt-10"
          style={{ animationDelay: "500ms" }}
        >
          <Link
            href="#featured"
            className="landing-cta-hero inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-[var(--color-accent)] active:scale-[0.98]"
          >
            둘러보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
