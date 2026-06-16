import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Truck,
} from "lucide-react";

import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";

/**
 * /orders/[orderId] — 주문 상세 (Phase 2 mock).
 *
 * 디자인 DNA:
 *  - 박스 0개. 라인 divider + 큰 타이포.
 *  - 헤더: eyebrow + 주문번호(h1) + 상태 chip.
 *  - SubOrder 별 타임라인 (결제→준비→배송→완료).
 *  - 결제 정보·청구지·배송지 — divider 정렬.
 *  - 영수증/세금계산서/거래명세서 다운로드 라인 row.
 */

type SubOrderStatus =
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

const STATUS_META: Record<
  SubOrderStatus,
  { label: string; color: string; dotColor: string }
> = {
  PAID: {
    label: "결제 완료",
    color: "text-[var(--color-status-paid)]",
    dotColor: "bg-[var(--color-status-paid)]",
  },
  PREPARING: {
    label: "준비 중",
    color: "text-[var(--color-status-pending)]",
    dotColor: "bg-[var(--color-status-pending)]",
  },
  SHIPPED: {
    label: "배송 중",
    color: "text-[var(--color-status-shipped)]",
    dotColor: "bg-[var(--color-status-shipped)]",
  },
  DELIVERED: {
    label: "배송 완료",
    color: "text-[var(--color-status-delivered)]",
    dotColor: "bg-[var(--color-status-delivered)]",
  },
  CANCELLED: {
    label: "취소됨",
    color: "text-[var(--color-status-cancelled)]",
    dotColor: "bg-[var(--color-status-cancelled)]",
  },
};

const TIMELINE_STAGES: Array<{ key: SubOrderStatus; label: string }> = [
  { key: "PAID", label: "결제 완료" },
  { key: "PREPARING", label: "상품 준비" },
  { key: "SHIPPED", label: "배송 시작" },
  { key: "DELIVERED", label: "배송 완료" },
];

const STAGE_ORDER: Record<SubOrderStatus, number> = {
  PAID: 0,
  PREPARING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELLED: -1,
};

type SubOrder = {
  id: string;
  vendorName: string;
  vendorBizRegNo: string;
  status: SubOrderStatus;
  items: Array<{ name: string; qty: number; unit: string; unitPrice: number }>;
  shippingFee: number;
  trackingNo?: string;
  carrierName?: string;
  shippedAt?: string;
  deliveredAt?: string;
};

type OrderDetail = {
  id: string;
  orderNo: string;
  orderedAt: string;
  buyerName: string;
  buyerHospital: string;
  paymentMethod: string;
  paymentMaskedCard: string;
  paidAt: string;
  shippingAddress: {
    name: string;
    phone: string;
    zipcode: string;
    address: string;
    addressDetail: string;
  };
  billingAddress: {
    name: string;
    bizRegNo: string;
    zipcode: string;
    address: string;
    addressDetail: string;
  };
  subOrders: SubOrder[];
};

const UNIT_LABEL: Record<string, string> = {
  BOX: "박스",
  EA: "개",
  KG: "kg",
  L: "L",
  ML: "ml",
};

function unit(u: string): string {
  return UNIT_LABEL[u] ?? u;
}

function mockOrder(orderId: string): OrderDetail {
  return {
    id: orderId,
    orderNo: "MP-2026-05-22-0001",
    orderedAt: "2026-05-22 14:32",
    buyerName: "김민지",
    buyerHospital: "서울메디컬의원",
    paymentMethod: "신용카드 (현대카드)",
    paymentMaskedCard: "**** **** **** 4521",
    paidAt: "2026-05-22 14:32:18",
    shippingAddress: {
      name: "서울메디컬의원 자재실",
      phone: "02-1234-5678",
      zipcode: "06236",
      address: "서울특별시 강남구 테헤란로 123",
      addressDetail: "5층 502호",
    },
    billingAddress: {
      name: "서울메디컬의원",
      bizRegNo: "120-81-55621",
      zipcode: "06236",
      address: "서울특별시 강남구 테헤란로 123",
      addressDetail: "5층",
    },
    subOrders: [
      {
        id: "so-1",
        vendorName: "더미 의료기기 유한회사",
        vendorBizRegNo: "211-87-44782",
        status: "SHIPPED",
        items: [
          {
            name: "수술용 라텍스 장갑 (M)",
            qty: 12,
            unit: "BOX",
            unitPrice: 28900,
          },
          {
            name: "일회용 마스크 KF94 50매",
            qty: 30,
            unit: "BOX",
            unitPrice: 7400,
          },
        ],
        shippingFee: 0,
        trackingNo: "1234-5678-9012",
        carrierName: "CJ대한통운",
        shippedAt: "2026-05-23 09:15",
      },
      {
        id: "so-2",
        vendorName: "더미 헬스케어",
        vendorBizRegNo: "445-21-08812",
        status: "PREPARING",
        items: [
          {
            name: "디지털 청진기 (블루투스)",
            qty: 2,
            unit: "EA",
            unitPrice: 351500,
          },
        ],
        shippingFee: 0,
      },
    ],
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = mockOrder(orderId);

  const subOrderTotal = (so: SubOrder) =>
    so.items.reduce((s, it) => s + it.unitPrice * it.qty, 0) + so.shippingFee;
  const grandTotal = order.subOrders.reduce((s, so) => s + subOrderTotal(so), 0);
  const overallStatus = inferOverallStatus(order.subOrders);
  const overallMeta = STATUS_META[overallStatus];

  return (
    <>
      <CatalogTopNav />
      <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
        {/* Phase 1.5 안내 — 실 데이터 연결 진행 중 */}
        <div className="mb-8 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-warning)]">
            Phase 1.5 출시 예정
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            이 페이지는 실 주문 데이터 연결이 진행 중입니다. 아래 항목은 디자인
            미리보기입니다.
          </p>
        </div>

        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          주문 목록
        </Link>

        {/* 헤더 */}
        <header className="mt-8 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Order Detail
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] tabular-nums md:text-5xl">
              {order.orderNo}
            </h1>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-[var(--color-text-secondary)]">
              <span>{order.orderedAt}</span>
              <span aria-hidden className="text-[var(--color-border-default)]">·</span>
              <span>{order.buyerHospital}</span>
              <span aria-hidden className="text-[var(--color-border-default)]">·</span>
              <span>{order.buyerName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`status-pulse-dot h-2.5 w-2.5 rounded-full ${overallMeta.dotColor}`}
            />
            <span className={`text-sm font-semibold ${overallMeta.color}`}>
              {overallMeta.label}
            </span>
          </div>
        </header>

        {/* 결제 요약 — 큰 숫자 */}
        <div className="mt-12 grid gap-12 border-y border-[var(--color-border-light)] py-10 md:grid-cols-3">
          <SummaryCell label="총 결제 금액">
            <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl">
              ₩{grandTotal.toLocaleString()}
            </p>
          </SummaryCell>
          <SummaryCell label="결제 수단">
            <p className="text-sm font-medium">{order.paymentMethod}</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
              {order.paymentMaskedCard}
            </p>
          </SummaryCell>
          <SummaryCell label="결제 시각">
            <p className="font-mono text-sm tabular-nums">{order.paidAt}</p>
          </SummaryCell>
        </div>

        {/* SubOrder 카드 (라인) */}
        <div className="mt-16 space-y-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
              공급업체별 진행 상황
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              한 주문은 여러 공급업체로 분할 발송됩니다. 각 업체별 진행 상태와
              배송 추적을 확인하세요.
            </p>
          </div>

          {order.subOrders.map((so, i) => (
            <SubOrderBlock key={so.id} subOrder={so} index={i + 1} />
          ))}
        </div>

        {/* 주소 / 영수증 */}
        <div className="mt-20 grid gap-16 lg:grid-cols-2">
          <AddressCard
            title="배송지"
            blocks={[
              { label: "수령인", value: order.shippingAddress.name },
              { label: "연락처", value: order.shippingAddress.phone, mono: true },
              {
                label: "주소",
                value: `(${order.shippingAddress.zipcode}) ${order.shippingAddress.address} ${order.shippingAddress.addressDetail}`,
              },
            ]}
          />
          <AddressCard
            title="청구지 (사업자)"
            blocks={[
              { label: "상호", value: order.billingAddress.name },
              {
                label: "사업자번호",
                value: order.billingAddress.bizRegNo,
                mono: true,
              },
              {
                label: "주소",
                value: `(${order.billingAddress.zipcode}) ${order.billingAddress.address} ${order.billingAddress.addressDetail}`,
              },
            ]}
          />
        </div>

        {/* 영수증·증빙 — divider rows */}
        <div className="mt-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            영수증 · 세금계산서
          </p>
          <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <DocLineRow
              label="결제 영수증"
              hint="PDF · 즉시 발급"
              download
            />
            <DocLineRow
              label="전자세금계산서"
              hint="배송 완료 후 익월 10일까지 발급"
              disabled
            />
            <DocLineRow
              label="거래명세서"
              hint="각 SubOrder별로 첨부됩니다"
              download
            />
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/orders"
            className="inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            주문 목록으로
          </Link>
          <Link
            href="/search"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            계속 주문하기
          </Link>
        </div>
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function SummaryCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SubOrderBlock({
  subOrder,
  index,
}: {
  subOrder: SubOrder;
  index: number;
}) {
  const itemsTotal = subOrder.items.reduce(
    (s, it) => s + it.unitPrice * it.qty,
    0,
  );
  const total = itemsTotal + subOrder.shippingFee;
  const meta = STATUS_META[subOrder.status];
  const stage = STAGE_ORDER[subOrder.status];
  const isCancelled = subOrder.status === "CANCELLED";

  return (
    <article className="border-t border-[var(--color-border-light)] pt-10">
      {/* 헤더 */}
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-[var(--color-accent)] md:text-3xl">
            {String(index).padStart(2, "0")}
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">
              {subOrder.vendorName}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
              {subOrder.vendorBizRegNo}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}
        >
          <span
            aria-hidden
            className={`status-pulse-dot h-2 w-2 rounded-full ${meta.dotColor}`}
          />
          {meta.label}
        </span>
      </header>

      {/* Timeline — 4단계 가로 */}
      {!isCancelled && (
        <div className="mt-8">
          <ol className="relative grid grid-cols-4 gap-2">
            {/* 라인 */}
            <span
              aria-hidden
              className="absolute left-3 right-3 top-3 h-px bg-[var(--color-border-light)]"
            />
            <span
              aria-hidden
              className="absolute left-3 top-3 h-px bg-[var(--color-accent)] transition-all duration-700"
              style={{
                width: `calc(${(stage / 3) * 100}% - ${stage === 3 ? 0 : 12}px)`,
              }}
            />
            {TIMELINE_STAGES.map((s, i) => {
              const done = i < stage;
              const current = i === stage;
              return (
                <li key={s.key} className="relative flex flex-col items-start">
                  <span
                    aria-hidden
                    className={`relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 transition-all ${
                      done
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                        : current
                          ? "status-pulse-dot border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-[0_0_0_4px_var(--color-accent-light)]"
                          : "border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
                    }`}
                  >
                    {done && (
                      <Check
                        className="h-3 w-3 text-white"
                        strokeWidth={3.5}
                        aria-hidden
                      />
                    )}
                  </span>
                  <p
                    className={`mt-3 text-[11px] font-medium md:text-xs ${
                      done || current
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-tertiary)]"
                    }`}
                  >
                    {s.label}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Tracking */}
      {subOrder.trackingNo && (
        <div className="mt-8 flex items-center justify-between gap-4 border-y border-[var(--color-border-light)] py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Truck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                운송장
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums">
                {subOrder.carrierName} · {subOrder.trackingNo}
              </p>

            </div>
          </div>
          <a
            href="#"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border-default)] px-4 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            배송 추적
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* 상품 목록 — line table */}
      <div className="mt-8">
        <div className="hidden grid-cols-[1fr_auto_120px_140px] gap-6 border-b border-[var(--color-border-light)] pb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] md:grid">
          <span>상품</span>
          <span className="text-right">수량</span>
          <span className="text-right">단가</span>
          <span className="text-right">소계</span>
        </div>
        <ul className="divide-y divide-[var(--color-border-light)]">
          {subOrder.items.map((it) => (
            <li
              key={it.name}
              className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[1fr_auto_120px_140px] md:items-baseline md:gap-6"
            >
              <span className="text-sm font-medium">{it.name}</span>
              <span className="text-xs tabular-nums text-[var(--color-text-secondary)] md:text-right md:text-sm">
                {it.qty} {unit(it.unit)}
              </span>
              <span className="text-xs tabular-nums text-[var(--color-text-secondary)] md:text-right md:text-sm">
                ₩{it.unitPrice.toLocaleString()}
              </span>
              <span className="text-sm font-semibold tabular-nums md:text-right">
                ₩{(it.unitPrice * it.qty).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 합계 */}
      <div className="mt-6 ml-auto max-w-sm space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-[var(--color-text-tertiary)]">상품 합계</span>
          <span className="tabular-nums">₩{itemsTotal.toLocaleString()}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-[var(--color-text-tertiary)]">배송비</span>
          <span className="tabular-nums">
            {subOrder.shippingFee === 0
              ? "무료"
              : `₩${subOrder.shippingFee.toLocaleString()}`}
          </span>
        </div>
        <div className="flex items-baseline justify-between border-t border-[var(--color-border-light)] pt-3">
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
            소계
          </span>
          <span className="text-sm font-semibold tabular-nums tracking-[-0.02em]">
            ₩{total.toLocaleString()}
          </span>
        </div>
      </div>
    </article>
  );
}

function AddressCard({
  title,
  blocks,
}: {
  title: string;
  blocks: Array<{ label: string; value: string; mono?: boolean }>;
}) {
  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {title}
      </p>
      <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        {blocks.map((b) => (
          <div
            key={b.label}
            className="flex items-baseline justify-between gap-6 py-3.5"
          >
            <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              {b.label}
            </dt>
            <dd
              className={`text-right text-sm text-[var(--color-text-primary)] ${
                b.mono ? "font-mono tabular-nums" : ""
              }`}
            >
              {b.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DocLineRow({
  label,
  hint,
  download,
  disabled,
}: {
  label: string;
  hint: string;
  download?: boolean;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div>
        <p
          className={`text-sm font-medium ${
            disabled
              ? "text-[var(--color-text-tertiary)]"
              : "text-[var(--color-text-primary)]"
          }`}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      </div>
      {download ? (
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-4 text-xs font-medium transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          다운로드
          <Download className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
          준비 중
        </span>
      )}
    </li>
  );
}

function inferOverallStatus(subOrders: SubOrder[]): SubOrderStatus {
  if (subOrders.every((s) => s.status === "DELIVERED")) return "DELIVERED";
  if (subOrders.every((s) => s.status === "CANCELLED")) return "CANCELLED";
  if (subOrders.some((s) => s.status === "SHIPPED")) return "SHIPPED";
  if (subOrders.some((s) => s.status === "PREPARING")) return "PREPARING";
  return "PAID";
}
