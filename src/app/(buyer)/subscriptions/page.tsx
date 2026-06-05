import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  PauseCircle,
  Plus,
  Repeat,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { PageHeader } from "@/components/shared/page-header";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

/**
 * 정기 주문 list — Wave Y Phase 3.
 *
 * server-side 에서 listMine + counts 를 fetch.
 * Cadence label / status label 은 클라이언트와 동일하게 utility 로 작성.
 */

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: "매주",
  BIWEEKLY: "격주",
  MONTHLY: "매월",
  CUSTOM: "사용자 지정",
};

const STATUS_META: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  ACTIVE: {
    label: "활성",
    color: "text-[var(--color-success)]",
    dotColor: "bg-[var(--color-success)]",
  },
  PAUSED: {
    label: "일시정지",
    color: "text-[var(--color-text-tertiary)]",
    dotColor: "bg-[var(--color-text-tertiary)]",
  },
  CANCELLED: {
    label: "해지됨",
    color: "text-[var(--color-text-tertiary)]",
    dotColor: "bg-[var(--color-text-tertiary)]",
  },
  EXPIRED: {
    label: "만료",
    color: "text-[var(--color-text-tertiary)]",
    dotColor: "bg-[var(--color-text-tertiary)]",
  },
};

function fmtDate(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const obj = ts as { toDate?: () => Date; seconds?: number };
  let d: Date | null = null;
  if (typeof obj.toDate === "function") d = obj.toDate();
  else if (typeof obj.seconds === "number") d = new Date(obj.seconds * 1000);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function won(n: number | undefined): string {
  return `₩${(n ?? 0).toLocaleString()}`;
}

type SubscriptionListItem = {
  id: string;
  status?: string;
  cadence?: string;
  productName?: string;
  vendorName?: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  nextRunAt?: unknown;
  priceChangeRequiresApproval?: boolean;
};

export default async function SubscriptionsPage() {
  const trpc = await trpcServer();

  let subscriptions: SubscriptionListItem[] = [];
  let counts = { active: 0, paused: 0, next7Days: 0 };

  try {
    const result = await trpc.subscription.listMine({ pageSize: 50 });
    subscriptions = result.subscriptions as SubscriptionListItem[];
  } catch {
    subscriptions = [];
  }
  try {
    counts = await trpc.subscription.counts();
  } catch {
    counts = { active: 0, paused: 0, next7Days: 0 };
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
        <PageHeader
          label="정기구독"
          title="한 번 설정, 매달 자동 발주."
          description="장갑·마스크·소독제 같은 매달 품목, 한 번 설정 후 자동 발주."
        >
          <Link
            href="/search"
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            새 구독 시작
          </Link>
        </PageHeader>

        {/* KPI — 마케팅 라인 패턴 */}
        <section className="mt-12 grid grid-cols-1 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-3 md:divide-x md:divide-y-0">
          <article className="py-8 md:px-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              활성 구독
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-[-0.03em] md:text-3xl">
              {counts.active}
            </p>
          </article>
          <article className="py-8 md:px-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              일시정지
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-[-0.03em] md:text-3xl">
              {counts.paused}
            </p>
          </article>
          <article className="py-8 md:px-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              다음 7일 발주 예정
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-[-0.03em] md:text-3xl">
              {counts.next7Days}
            </p>
          </article>
        </section>

        {/* List */}
        <section className="mt-12">
          <header className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-4">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">
              내 정기구독
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              총 {subscriptions.length}건
            </p>
          </header>

          {subscriptions.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-[var(--color-border-light)]">
              {subscriptions.map((s) => {
                const meta = STATUS_META[s.status ?? "ACTIVE"] ?? STATUS_META.ACTIVE;
                const cadenceLabel = CADENCE_LABEL[s.cadence ?? "MONTHLY"] ?? s.cadence;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/subscriptions/${s.id}`}
                      className="group flex flex-wrap items-center gap-4 py-5 transition-colors hover:bg-[var(--color-bg-tertiary)]/40"
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
                        <Repeat className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold tracking-tight">
                          {s.productName ?? "상품"}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
                          {s.vendorName ?? "공급업체"} · {cadenceLabel} · 회당 {s.qty ?? 0}
                          {s.unit ?? "EA"} · {won(s.unitPrice)} /
                          {s.unit ?? "EA"}
                        </p>
                        {s.priceChangeRequiresApproval && (
                          <p className="mt-1 text-[11px] font-medium text-[var(--color-warning)]">
                            가격 변동 — 승인 필요
                          </p>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          다음 발주일
                        </p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {fmtDate(s.nextRunAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 text-[11px] font-medium ${meta.color}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                        {meta.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-1" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function EmptyState() {
  const FEATURES = [
    {
      icon: Calendar,
      title: "자동 발주 주기",
      desc: "매주 · 격주 · 매월 단위로 발주 주기를 자유롭게 설정",
    },
    {
      icon: PauseCircle,
      title: "언제든 일시정지",
      desc: "긴 연휴·재고 조정 등 필요할 때 한 번 클릭으로 다음 회차 보류",
    },
    {
      icon: CheckCircle2,
      title: "가격 변동 보호",
      desc: "단가 5% 이상 변동 시 승인 요청",
    },
  ];

  return (
    <div className="py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
        <Repeat className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em]">
        아직 정기구독이 없습니다
      </h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        상품 상세 페이지에서 정기구독을 시작하거나, 카탈로그를 둘러보세요.
      </p>
      <Link
        href="/search"
        className="mt-8 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)]"
      >
        <Plus className="h-4 w-4" />
        카탈로그 둘러보기
      </Link>

      <section className="mx-auto mt-16 grid max-w-3xl grid-cols-1 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] text-left md:grid-cols-3 md:divide-x md:divide-y-0">
        {FEATURES.map((f) => (
          <article key={f.title} className="py-8 md:px-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <f.icon className="h-5 w-5" />
            </span>
            <h4 className="mt-4 text-sm font-semibold tracking-tight">
              {f.title}
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {f.desc}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
