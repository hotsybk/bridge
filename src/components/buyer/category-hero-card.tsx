import Image from "next/image";
import Link from "next/link";

const CATEGORIES = [
  {
    id: "cat-medsupply",
    label: "의료소모품",
    sub: "장갑·거즈·소독제 등",
    image: "https://images.unsplash.com/photo-1583912267550-bb6e1c7c4baa?w=1000&h=1200&fit=crop&q=80",
  },
  {
    id: "cat-meddevice-diagnostic",
    label: "진단기기",
    sub: "청진기·혈압계·체온계",
    image: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1000&h=1200&fit=crop&q=80",
  },
  {
    id: "cat-medsupply-dressing",
    label: "드레싱",
    sub: "거즈·붕대·반창고",
    image: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=1000&h=1200&fit=crop&q=80",
  },
  {
    id: "cat-etc-dental",
    label: "치과용품",
    sub: "치과 전문 도구",
    image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1000&h=1200&fit=crop&q=80",
  },
] as const;

/**
 * Apple "알면 알수록, Apple Watch" 패턴 — 큰 카테고리 hero 카드.
 */
export function CategoryHeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 md:px-12 md:py-28">
      <h2 className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
        알면 알수록, 의료 용품.
      </h2>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        카테고리별로 골라보세요.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <CategoryHeroCard key={c.id} {...c} />
        ))}
      </div>
    </section>
  );
}

function CategoryHeroCard({
  id,
  label,
  sub,
  image,
}: (typeof CATEGORIES)[number]) {
  return (
    <Link
      href={`/search?categoryId=${id}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-3xl"
    >
      <Image
        src={image}
        alt={label}
        fill
        sizes="(max-width: 768px) 100vw, 25vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      {/* 어두운 overlay */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
      />
      {/* 텍스트 */}
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">
          {sub}
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {label}
        </h3>
        <p className="mt-3 inline-flex items-center gap-1 text-sm text-white/90 transition-transform duration-300 group-hover:translate-x-1">
          둘러보기 →
        </p>
      </div>
    </Link>
  );
}
