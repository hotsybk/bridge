import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Repeat } from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { trpcServer } from "@/lib/trpc/server";

import { SubscriptionDetailActions } from "./actions";

export const dynamic = "force-dynamic";

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
    color: "text-[var(--color-warning)]",
    dotColor: "bg-[var(--color-warning)]",
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

const RUN_STATUS_META: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: "발주 완료", color: "text-[var(--color-success)]" },
  FAILED: { label: "실패", color: "text-[var(--color-error)]" },
  SKIPPED: { label: "스킵됨", color: "text-[var(--color-text-tertiary)]" },
  PRICE_HOLD: { label: "가격 변동 보류", color: "text-[var(--color-warning)]" },
  PENDING: { label: "예정", color: "text-[var(--color-text-tertiary)]" },
  PENDING_APPROVAL: { label: "승인 대기", color: "text-[var(--color-warning)]" },
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

type SubData = {
  id: string;
  hospitalId?: string;
  productId?: string;
  productName?: string;
  vendorName?: string;
  cadence?: string;
  status?: string;
  qty?: number;
  unitPrice?: number;
  unit?: string;
  totalRuns?: number;
  totalAmount?: number;
  nextRunAt?: unknown;
  lastRunAt?: unknown;
  startsAt?: unknown;
  priceChangePercent?: number;
  priceChangeRequiresApproval?: boolean;
  pauseReason?: string;
  shippingAddress?: {
    name?: string;
    phone?: string;
    zipcode?: string;
    address?: string;
    addressDetail?: string;
  };
  runs?: Array<{
    id: string;
    status?: string;
    orderId?: string;
    scheduledAt?: unknown;
    priceAtRun?: number;
    errorReason?: string;
  }>;
};

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = await params;
  const trpc = await trpcServer();

  let sub: SubData | null = null;
  try {
    sub = (await trpc.subscription.getMine({ subscriptionId })) as SubData | null;
  } catch {
    sub = null;
  }
  if (!sub) notFound();

  const statusMeta = STATUS_META[sub.status ?? "ACTIVE"] ?? STATUS_META.ACTIVE;
  const cadenceLabel = CADENCE_LABEL[sub.cadence ?? "MONTHLY"] ?? sub.cadence;
  const isActive = sub.status === "ACTIVE";
  const isPaused = sub.status === "PAUSED";
  const isTerminal = sub.status === "CANCELLED" || sub.status === "EXPIRED";

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CatalogTopNav />

      <main className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-16">
        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          정기구독 목록으로
        </Link>

        {/* Header */}
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
              정기구독 #{sub.id.slice(0, 8)}
            </p>
            <h1 className="mt-3 break-keep text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
              {sub.productName ?? "상품"}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {sub.vendorName ?? "공급업체"} · {cadenceLabel} · 회당 {sub.qty ?? 0}
              {sub.unit ?? "EA"}
            </p>
          </div>
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 text-[11px] font-medium ${statusMeta.color}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotColor}`} />
            {statusMeta.label}
          </span>
        </header>

        {/* Price change alert */}
        {sub.priceChangeRequiresApproval && (
          <div className="mt-6 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-5">
            <p className="text-sm font-semibold text-[var(--color-warning)]">
              가격이 {(sub.priceChangePercent ?? 0) > 0 ? "+" : ""}
              {(sub.priceChangePercent ?? 0).toFixed(1)}% 변동되었습니다
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              안전을 위해 자동 발주가 보류되었습니다. 수량을 다시 확인하거나
              구독을 갱신하면 다음 주기에 정상 발주됩니다.
            </p>
          </div>
        )}

        {/* Pause reason */}
        {isPaused && sub.pauseReason && (
          <div className="mt-6 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-warning)]">
              일시정지 사유
            </p>
            <p className="mt-2 text-sm">{sub.pauseReason}</p>
          </div>
        )}

        {/* Summary grid */}
        <section className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-[var(--color-border-light)] md:grid-cols-4">
          <Cell label="다음 발주일" value={fmtDate(sub.nextRunAt)} />
          <Cell label="마지막 발주" value={fmtDate(sub.lastRunAt)} />
          <Cell label="누적 발주" value={`${sub.totalRuns ?? 0}회`} />
          <Cell label="누적 금액" value={won(sub.totalAmount)} />
        </section>

        {/* Detail meta */}
        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--color-bg-tertiary)] p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
              구독 정보
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="발주 주기" value={cadenceLabel} />
              <Row
                label="회당 수량"
                value={`${sub.qty ?? 0}${sub.unit ?? "EA"}`}
              />
              <Row label="적용 단가" value={won(sub.unitPrice)} />
              <Row
                label="회당 금액"
                value={won((sub.unitPrice ?? 0) * (sub.qty ?? 0))}
              />
              <Row label="시작일" value={fmtDate(sub.startsAt)} />
            </dl>
          </div>

          <div className="rounded-2xl bg-[var(--color-bg-tertiary)] p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
              배송지
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <Row
                label="받는 사람"
                value={sub.shippingAddress?.name ?? "—"}
              />
              <Row label="연락처" value={sub.shippingAddress?.phone ?? "—"} />
              <Row
                label="주소"
                value={
                  sub.shippingAddress?.address
                    ? `(${sub.shippingAddress.zipcode ?? ""}) ${sub.shippingAddress.address}${
                        sub.shippingAddress.addressDetail
                          ? ` ${sub.shippingAddress.addressDetail}`
                          : ""
                      }`
                    : "—"
                }
              />
            </dl>
          </div>
        </section>

        {/* Actions */}
        {!isTerminal && (
          <SubscriptionDetailActions
            subscriptionId={sub.id}
            status={sub.status ?? "ACTIVE"}
            qty={sub.qty ?? 0}
            unit={sub.unit ?? "EA"}
            isActive={isActive}
            isPaused={isPaused}
          />
        )}

        {/* Runs history */}
        <section className="mt-16">
          <header className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-4">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">
              발주 이력
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              최근 {sub.runs?.length ?? 0}건
            </p>
          </header>
          {!sub.runs || sub.runs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
                <Repeat className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                아직 발주 이력이 없습니다. 다음 발주일에 자동으로 주문됩니다.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border-light)]">
              {sub.runs.map((run) => {
                const meta = RUN_STATUS_META[run.status ?? "PENDING"] ?? {
                  label: run.status ?? "—",
                  color: "text-[var(--color-text-tertiary)]",
                };
                return (
                  <li key={run.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          {fmtDate(run.scheduledAt)}
                        </p>
                        {run.errorReason && (
                          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                            {run.errorReason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {typeof run.priceAtRun === "number" && (
                          <p className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
                            발주가 {won(run.priceAtRun)}
                          </p>
                        )}
                        {run.orderId && (
                          <Link
                            href={`/orders/${run.orderId}`}
                            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                          >
                            주문 보기
                          </Link>
                        )}
                        <span className={`text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg-primary)] p-6">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}
