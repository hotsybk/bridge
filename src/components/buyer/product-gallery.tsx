"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";

/**
 * Phase Φ-B — 상품 상세 이미지 갤러리.
 *
 * 디자인 DNA:
 *  - CSS 변수 토큰 · 라인 only · Lucide 아이콘만
 *  - 데스크탑: 좌측 세로 썸네일 strip + 큰 메인 (클릭 시 메인 교체)
 *  - 모바일: overflow-x snap-mandatory carousel + 하단 dots
 *  - 이미지 1개면 carousel/strip 비활성 — 단일 표시
 *
 * Wave 1 상품은 images 배열에 thumbnail 1개만 있을 수 있음 → graceful 처리.
 */
export function ProductGallery({
  images,
  alt,
  classLabel,
  classTextColor = "",
}: {
  images: string[];
  alt: string;
  classLabel?: string;
  classTextColor?: string;
}) {
  // 빈 배열 / 빈 문자열 필터.
  const valid = images.filter((src): src is string => Boolean(src));
  const [active, setActive] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const hasMany = valid.length > 1;

  // 모바일 carousel 스크롤 → 현재 dot 추적.
  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== dotIndex) setDotIndex(idx);
  }

  function scrollToDot(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setDotIndex(i);
  }

  return (
    <div className="relative">
      {/* 글로우 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 translate-y-8 rounded-[3rem] bg-[var(--color-accent)]/8 blur-3xl"
      />

      {/* ─── 데스크탑 (md+) — 세로 썸네일 + 메인 ─── */}
      <div className="hidden md:flex md:gap-4">
        {/* 세로 썸네일 strip — 2장 이상일 때만 */}
        {hasMany && (
          <div className="flex w-20 shrink-0 flex-col gap-3">
            {valid.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${alt} 이미지 ${i + 1} 보기`}
                aria-pressed={i === active}
                className={`relative aspect-square overflow-hidden rounded-2xl transition-all ${
                  i === active
                    ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-primary)]"
                    : "border border-[var(--color-border-light)] hover:border-[var(--color-text-secondary)]/40"
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* 메인 이미지 */}
        <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] md:rounded-[2.5rem]">
          {valid[active] ? (
            <Image
              src={valid[active]}
              alt={alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <PlaceholderIcon />
          )}
          {classLabel && (
            <span
              className={`absolute left-5 top-5 inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-md ${classTextColor}`}
            >
              {classLabel}
            </span>
          )}
        </div>
      </div>

      {/* ─── 모바일 (< md) — snap carousel + dots ─── */}
      <div className="md:hidden">
        {hasMany ? (
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-[2rem] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {valid.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative aspect-square w-full shrink-0 snap-center overflow-hidden bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]"
              >
                <Image
                  src={src}
                  alt={`${alt} 이미지 ${i + 1}`}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                />
                {classLabel && i === 0 && (
                  <span
                    className={`absolute left-5 top-5 inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-md ${classTextColor}`}
                  >
                    {classLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]">
            {valid[0] ? (
              <Image
                src={valid[0]}
                alt={alt}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            ) : (
              <PlaceholderIcon />
            )}
            {classLabel && (
              <span
                className={`absolute left-5 top-5 inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-md ${classTextColor}`}
              >
                {classLabel}
              </span>
            )}
          </div>
        )}

        {/* dots indicator */}
        {hasMany && (
          <div className="mt-4 flex justify-center gap-1.5">
            {valid.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToDot(i)}
                aria-label={`${i + 1}번째 이미지로 이동`}
                aria-current={i === dotIndex}
                className={`h-1.5 rounded-full transition-all ${
                  i === dotIndex
                    ? "w-5 bg-[var(--color-accent)]"
                    : "w-1.5 bg-[var(--color-border-default)]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderIcon() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Package
        className="h-24 w-24 text-[var(--color-text-tertiary)]/40"
        strokeWidth={1}
      />
    </div>
  );
}
