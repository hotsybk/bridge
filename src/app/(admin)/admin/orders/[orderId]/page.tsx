import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { formatDateTimeSec } from "@/lib/format";
import { trpcServer } from "@/lib/trpc/server";

import { OrderAdminActions } from "./actions";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 운영자 — 주문 상세 (Wave D 실연동).
 *
 * tRPC `admin.order.getById` + `admin.order.listMemos`.
 * 실패 시 PREVIEW_MODE 면 mock fallback.
 */

const STATUS_LABEL: Record<string, string> = {
  PAID: "결제 완료",
  PENDING_PAYMENT: "결제 대기",
  PENDING_APPROVAL: "결재 대기",
  PARTIALLY_SHIPPED: "부분 배송",
  SHIPPED: "배송 중",
  COMPLETED: "배송 완료",
  CANCELLED: "취소",
  REFUND_REQUESTED: "환불 진행",
  REFUNDED: "환불 완료",
};

const SUB_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "주문 접수",
  PACKING: "포장 중",
  SHIPPED: "배송 중",
  DELIVERED: "배송 완료",
  CANCELLED: "취소",
  RETURN_REQUESTED: "반품 요청",
  RETURNED: "반품 완료",
};

const SUB_STATUS_TONE: Record<string, string> = {
  ACCEPTED: "text-[var(--color-warning)]",
  PACKING: "text-[var(--color-warning)]",
  SHIPPED: "text-[var(--color-accent)]",
  DELIVERED: "text-[var(--color-success)]",
  CANCELLED: "text-[var(--color-text-tertiary)]",
  RETURN_REQUESTED: "text-[var(--color-error)]",
  RETURNED: "text-[var(--color-text-tertiary)]",
};

type OrderDetail = {
  id: string;
  orderNo?: string;
  hospitalId?: string;
  hospitalName?: string;
  status?: string;
  totalAmount?: number;
  subtotalAmount?: number;
  vatAmount?: number;
  shippingAmount?: number;
  paymentMethod?: string;
  payment?: {
    status?: string;
    method?: string;
    paymentId?: string;
    paidAt?: unknown;
    events?: Array<{ type: string; at: unknown; raw?: unknown }>;
  };
  shippingZipcode?: string;
  shippingAddress?: string;
  shippingAddressDetail?: string;
  shippingRecipient?: string;
  shippingPhone?: string;
  invoiceRequested?: boolean;
  invoiceEmail?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type SubOrderDetail = {
  id: string;
  vendorId?: string;
  vendorName?: string;
  trackingNo?: string;
  trackingCarrier?: string;
  status?: string;
  subtotal?: number;
  total?: number;
};

type MemoItem = {
  id: string;
  actorId: string;
  body: string;
  createdAt?: unknown;
};

function demoOrder(orderId: string): {
  order: OrderDetail;
  subOrders: SubOrderDetail[];
  memos: MemoItem[];
} {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    order: {
      id: orderId,
      orderNo: orderId,
      hospitalId: "h-001",
      hospitalName: "서울메디컬의원",
      status: "PAID",
      totalAmount: 469800,
      subtotalAmount: 427090,
      vatAmount: 42710,
      shippingAmount: 0,
      paymentMethod: "CARD",
      payment: {
        status: "PAID",
        method: "CARD",
        paymentId: "imp_1234567890",
        paidAt: { seconds: nowSec - 1800 },
        events: [
          {
            type: "Transaction.Ready",
            at: { seconds: nowSec - 1820 },
            raw: { merchant_uid: orderId, amount: 469800 },
          },
          {
            type: "Transaction.Paid",
            at: { seconds: nowSec - 1800 },
            raw: {
              imp_uid: "imp_1234567890",
              paid_amount: 469800,
              card_company: "신한카드",
              card_number_masked: "5101-****-****-3829",
            },
          },
        ],
      },
      shippingZipcode: "06236",
      shippingAddress: "서울 강남구 테헤란로 152",
      shippingAddressDetail: "5층 501호",
      shippingRecipient: "박원장",
      shippingPhone: "010-1234-5678",
      invoiceRequested: true,
      invoiceEmail: "tax@seoulmed.kr",
      createdAt: { seconds: nowSec - 1820 },
    },
    subOrders: [
      {
        id: "SO-001",
        vendorId: "v-001",
        vendorName: "메디서플라이",
        trackingNo: "1234567890123",
        trackingCarrier: "CJ대한통운",
        status: "PACKING",
        subtotal: 263455,
        total: 289800,
      },
      {
        id: "SO-002",
        vendorId: "v-002",
        vendorName: "헬스케어",
        trackingNo: "9876543210987",
        trackingCarrier: "한진택배",
        status: "SHIPPED",
        subtotal: 163635,
        total: 180000,
      },
    ],
    memos: [],
  };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  let order: OrderDetail | null = null;
  let subOrders: SubOrderDetail[] = [];
  let memos: MemoItem[] = [];
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [detail, memosRes] = await Promise.all([
      trpc.admin.order.getById({ orderId }),
      trpc.admin.order.listMemos({ orderId }).catch(() => []),
    ]);
    order = detail.order;
    subOrders = detail.subOrders;
    memos = memosRes as MemoItem[];
    if (!order && PREVIEW_MODE) {
      isPreview = true;
      const demo = demoOrder(orderId);
      order = demo.order;
      subOrders = demo.subOrders;
      memos = demo.memos;
    }
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      const demo = demoOrder(orderId);
      order = demo.order;
      subOrders = demo.subOrders;
      memos = demo.memos;
    } else {
      throw new Error("주문을 불러오지 못했습니다.");
    }
  }

  if (!order) {
    return (
      <div className="px-8 py-10 md:px-12 md:py-14">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          주문 감시로
        </Link>
        <p className="mt-12 text-sm text-[var(--color-text-secondary)]">
          주문을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[order.status ?? ""] ?? order.status ?? "—";

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          주문 감시로
        </Link>
      </div>

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Order · 운영자 view
          </p>
          <h1 className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-[-0.03em] md:text-3xl">
            {order.orderNo ?? order.id}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 text-xs font-medium text-[var(--color-text-primary)]">
            {statusLabel}
          </span>
          <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {formatDateTime(order.createdAt)}
          </span>
        </div>
      </div>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      {/* 2-col */}
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
        {/* 좌측 */}
        <div className="min-w-0 space-y-12">
          {/* 결제 timeline (payment.events) */}
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              결제 Timeline
            </p>
            <ol className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {(order.payment?.events ?? []).length === 0 ? (
                <li className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                  아직 이벤트가 기록되지 않았습니다
                </li>
              ) : (
                order.payment?.events?.map((ev, i) => (
                  <TimelineRow key={i} event={ev} />
                ))
              )}
            </ol>
          </section>

          {/* SubOrder별 상태 */}
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              SubOrder별 상태
            </p>
            {subOrders.length === 0 ? (
              <p className="mt-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                SubOrder 가 없습니다
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                {subOrders.map((s) => (
                  <li
                    key={s.id}
                    className="grid grid-cols-[120px_1fr_180px_100px_120px] items-center gap-4 px-2 py-4 text-sm"
                  >
                    <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
                      {s.id}
                    </span>
                    <span className="font-medium">{s.vendorName ?? s.vendorId}</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {[s.trackingCarrier, s.trackingNo].filter(Boolean).join(" ") || "—"}
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      ₩{(s.total ?? 0).toLocaleString()}
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`text-xs font-medium ${
                          SUB_STATUS_TONE[s.status ?? ""] ??
                          "text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {SUB_STATUS_LABEL[s.status ?? ""] ?? s.status ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 결제 정보 */}
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              결제 정보
            </p>
            <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <Row label="결제수단" value={paymentMethodLabel(order)} />
              <Row label="상태" value={order.payment?.status ?? "—"} />
              <Row
                label="PortOne ID"
                value={order.payment?.paymentId ?? "—"}
                mono
              />
              <Row
                label="결제일시"
                value={formatDateTime(order.payment?.paidAt)}
                mono
              />
              <Row
                label="총 금액"
                value={`₩${(order.totalAmount ?? 0).toLocaleString()}`}
                mono
              />
            </dl>
          </section>

          {/* 배송지·청구지 */}
          <section className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                배송지
              </p>
              <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="수령인" value={order.shippingRecipient ?? "—"} />
                <Row label="연락처" value={order.shippingPhone ?? "—"} mono />
                <Row
                  label="주소"
                  value={`${order.shippingAddress ?? ""} ${
                    order.shippingAddressDetail ?? ""
                  }`.trim() || "—"}
                />
                <Row label="우편번호" value={order.shippingZipcode ?? "—"} mono />
              </dl>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                세금계산서
              </p>
              <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row
                  label="신청 여부"
                  value={order.invoiceRequested ? "신청" : "미신청"}
                />
                <Row
                  label="이메일"
                  value={order.invoiceEmail ?? "—"}
                  mono
                />
              </dl>
            </div>
          </section>
        </div>

        {/* 우측 sticky */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-8">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                운영자 액션
              </p>
              <div className="mt-3">
                <OrderAdminActions
                  orderId={order.id}
                  defaultAmount={order.totalAmount ?? 0}
                  isPreview={isPreview}
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                요약
              </p>
              <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <MetaRow
                  label="총액"
                  value={`₩${(order.totalAmount ?? 0).toLocaleString()}`}
                  mono
                />
                <MetaRow
                  label="SubOrders"
                  value={`${subOrders.length} 건`}
                />
                <MetaRow
                  label="발생일"
                  value={formatDateTime(order.createdAt)}
                  mono
                />
                <MetaRow label="병원" value={order.hospitalName ?? "—"} />
              </dl>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                운영자 메모 ({memos.length})
              </p>
              {memos.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
                  메모가 없습니다
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                  {memos.map((m) => (
                    <li key={m.id} className="py-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">
                          {m.actorId}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                          {formatDateTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {m.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function TimelineRow({
  event,
}: {
  event: { type: string; at: unknown; raw?: unknown };
}) {
  const success = !/(Failed|Cancelled)$/i.test(event.type);
  const dotTone = success
    ? "bg-[var(--color-success)]"
    : "bg-[var(--color-error)]";
  const labelTone = success
    ? "text-[var(--color-text-primary)]"
    : "text-[var(--color-error)]";
  return (
    <li className="py-3">
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[16px_1fr_220px_80px] items-center gap-3 px-2">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${dotTone}`}
          />
          <span className={`text-sm font-medium ${labelTone}`}>{event.type}</span>
          <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {formatDateTime(event.at)}
          </span>
          {event.raw ? (
            <span className="inline-flex items-center justify-end gap-1 text-xs text-[var(--color-accent)] group-open:[&_svg]:rotate-90">
              Details
              <ChevronRight className="h-3 w-3 transition-transform" />
            </span>
          ) : (
            <span />
          )}
        </summary>
        {event.raw ? (
          <pre className="mt-3 overflow-x-auto bg-[var(--color-bg-secondary)] p-3 font-mono text-[10px] text-[var(--color-text-secondary)]">
            {JSON.stringify(event.raw, null, 2)}
          </pre>
        ) : null}
      </details>
    </li>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 px-2 py-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-2 py-2.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-xs text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function paymentMethodLabel(o: OrderDetail): string {
  const m = o.payment?.method ?? o.paymentMethod ?? "";
  switch (m) {
    case "CARD":
      return "카드";
    case "BANK_TRANSFER":
      return "계좌이체";
    case "NET_30":
      return "후불 NET-30";
    case "POINT":
      return "포인트";
    default:
      return m || "—";
  }
}

// formatDateTime/pad 는 @/lib/format 의 formatDateTimeSec 으로 통일 — Phase ν-4.
function formatDateTime(ts: unknown): string {
  return formatDateTimeSec(ts);
}
