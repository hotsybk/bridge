"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Loader2,
  MapPin,
  Package,
  Truck,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

/**
 * Wave P2 — vendor 주문 상세 페이지.
 *
 * /seller/orders 표 행 클릭 → ?sub=<subOrderId> query 로 진입.
 * SubOrder 단건 조회 + 운송장·LOT·유통기한 입력 + 상태 전이 (accept/ship/markDelivered/cancel).
 *
 * URL 패턴: /seller/orders/[orderId]?sub=<subOrderId>
 */

const COURIERS = ["CJ대한통운", "한진택배", "롯데택배", "우체국", "기타"];

type SubOrderStatus =
  | "ACCEPTED"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED";

const STATUS_META: Record<SubOrderStatus, { label: string; color: string }> = {
  ACCEPTED: { label: "결제 완료", color: "text-[var(--color-status-paid)]" },
  PACKING: { label: "출고 준비", color: "text-[var(--color-status-pending)]" },
  SHIPPED: { label: "배송 중", color: "text-[var(--color-status-shipped)]" },
  DELIVERED: { label: "배송 완료", color: "text-[var(--color-status-delivered)]" },
  CANCELLED: { label: "취소", color: "text-[var(--color-status-cancelled)]" },
  RETURN_REQUESTED: { label: "반품 요청", color: "text-[var(--color-warning)]" },
  RETURNED: { label: "반품 완료", color: "text-[var(--color-text-tertiary)]" },
};

function tsToDateStr(ts: unknown): string {
  if (!ts) return "—";
  const w = ts as { _seconds?: number; seconds?: number; toDate?: () => Date };
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().toISOString().slice(0, 10);
    } catch {
      /* fallthrough */
    }
  }
  const sec = w._seconds ?? w.seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  return "—";
}

export default function SellerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params.orderId;
  const subOrderId = searchParams.get("sub") ?? "";

  const [courier, setCourier] = useState(COURIERS[0]);
  const [trackingNo, setTrackingNo] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const detailQuery = trpc.vendor.order.getById.useQuery(
    { orderId, subOrderId },
    { enabled: !!orderId && !!subOrderId && !subOrderId.startsWith("preview-") },
  );

  const utils = trpc.useUtils();
  const acceptMutation = trpc.vendor.order.acceptOrder.useMutation({
    onSuccess: () => {
      void utils.vendor.order.getById.invalidate();
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });
  const shipMutation = trpc.vendor.order.ship.useMutation({
    onSuccess: () => {
      void utils.vendor.order.getById.invalidate();
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });
  const deliveredMutation = trpc.vendor.order.markDelivered.useMutation({
    onSuccess: () => {
      void utils.vendor.order.getById.invalidate();
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });
  const cancelMutation = trpc.vendor.order.cancel.useMutation({
    onSuccess: () => {
      void utils.vendor.order.getById.invalidate();
      void utils.vendor.order.list.invalidate();
      void utils.vendor.order.counts.invalidate();
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  // PREVIEW fallback — sub=preview-... 이거나 데이터 없을 때 또는 로딩 중
  const isPreview =
    !subOrderId ||
    subOrderId.startsWith("preview-") ||
    detailQuery.isPending ||
    !detailQuery.data;

  const data = isPreview
    ? {
        id: subOrderId || "preview-1",
        subOrderNo: "SO-20260522-00001-A",
        status: "ACCEPTED" as SubOrderStatus,
        hospitalName: "더미 병원",
        total: 469800,
        subtotal: 449800,
        shippingFee: 0,
        vat: 20000,
        trackingCarrier: undefined as string | undefined,
        trackingNo: undefined as string | undefined,
        shippedAt: undefined as unknown,
        deliveredAt: undefined as unknown,
        items: [
          {
            id: "i1",
            productName: "수술용 라텍스 장갑 (M) 100매",
            qty: 50,
            unitPrice: 8996,
            amount: 449800,
          },
        ],
        orderInfo: {
          orderNo: "MP-2026-05-22-0001",
          orderedAt: null,
          hospitalName: "더미 병원",
          shippingAddress: {
            zipcode: "06000",
            address: "서울시 강남구 테헤란로 123",
            recipient: "병원 관리실",
            phone: "010-0000-0000",
          },
          buyerNote: "오전 중 도착 부탁드립니다.",
        },
      }
    : detailQuery.data!;

  const status = (data.status ?? "ACCEPTED") as SubOrderStatus;
  const meta = STATUS_META[status];

  async function handleAccept() {
    if (isPreview) {
      showToast("미리보기 모드에서는 실제 처리되지 않습니다.");
      return;
    }
    try {
      await acceptMutation.mutateAsync({ orderId, subOrderId });
      showToast("출고 준비로 전환되었습니다.");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function handleShip(e: FormEvent) {
    e.preventDefault();
    if (!trackingNo.trim()) return;
    if (isPreview) {
      showToast(`발송 처리 완료 · ${courier} ${trackingNo} (미리보기 모드)`);
      setTrackingNo("");
      setLotNo("");
      setExpiry("");
      return;
    }
    try {
      await shipMutation.mutateAsync({
        orderId,
        subOrderId,
        carrier: courier,
        trackingNo: trackingNo.trim(),
        lotNo: lotNo.trim() || undefined,
        expiry: expiry || undefined,
      });
      showToast(`발송 처리 완료 · ${courier} ${trackingNo}`);
      setTrackingNo("");
      setLotNo("");
      setExpiry("");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function handleDelivered() {
    if (isPreview) {
      showToast("배송 완료 처리되었습니다. (미리보기 모드)");
      return;
    }
    try {
      await deliveredMutation.mutateAsync({ orderId, subOrderId });
      showToast("배송 완료 처리되었습니다.");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    if (isPreview) {
      showToast("주문 취소 완료 (미리보기 모드)");
      setShowCancelForm(false);
      setCancelReason("");
      return;
    }
    try {
      await cancelMutation.mutateAsync({
        orderId,
        subOrderId,
        reason: cancelReason.trim(),
      });
      showToast("주문이 취소되었습니다.");
      setShowCancelForm(false);
      setCancelReason("");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  const addr = data.orderInfo?.shippingAddress as
    | {
        zipcode?: string;
        address?: string;
        recipient?: string;
        phone?: string;
      }
    | null
    | undefined;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-16">
      <Link
        href="/seller/orders"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        주문 목록으로
      </Link>

      <PageHeader
        label="파트너센터 · 주문 상세"
        title={data.orderInfo?.orderNo ?? data.subOrderNo ?? "주문 상세"}
        description={`주문 번호 ${data.subOrderNo ?? ""}`}
      >
        <span className={`text-sm font-semibold ${meta.color}`}>
          {meta.label}
        </span>
      </PageHeader>

      {/* 주문 기본 정보 */}
      <section className="mt-12 grid gap-12 border-b border-[var(--color-border-light)] pb-12 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            주문 정보
          </h2>
          <dl className="mt-4 divide-y divide-[var(--color-border-light)] text-sm">
            <RowLine icon={Calendar} term="주문일">
              <span className="tabular-nums">
                {tsToDateStr(data.orderInfo?.orderedAt)}
              </span>
            </RowLine>
            <RowLine icon={Building2} term="병원">
              {data.orderInfo?.hospitalName ?? data.hospitalName ?? "—"}
            </RowLine>
            <RowLine icon={Truck} term="결제 금액">
              <span className="font-semibold tabular-nums">
                ₩{(data.total ?? 0).toLocaleString()}
              </span>
            </RowLine>
            <RowLine icon={MapPin} term="배송지">
              <div className="text-right text-xs">
                {addr ? (
                  <>
                    <p>
                      {addr.address ?? "—"}
                      {addr.zipcode ? ` (${addr.zipcode})` : ""}
                    </p>
                    {addr.recipient && (
                      <p className="mt-0.5 text-[var(--color-text-tertiary)]">
                        {addr.recipient} · {addr.phone ?? "—"}
                      </p>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </RowLine>
            {data.orderInfo?.buyerNote && (
              <RowLine icon={Package} term="요청사항">
                <span className="text-right text-xs italic">
                  {data.orderInfo.buyerNote}
                </span>
              </RowLine>
            )}
          </dl>
        </div>

        {/* 배송 정보 (이미 등록된 경우) */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            배송 정보
          </h2>
          {status === "SHIPPED" ||
          status === "DELIVERED" ||
          data.trackingNo ? (
            <dl className="mt-4 divide-y divide-[var(--color-border-light)] text-sm">
              <RowLine icon={Truck} term="택배사">
                {data.trackingCarrier ?? "—"}
              </RowLine>
              <RowLine icon={Package} term="운송장">
                <span className="tabular-nums">{data.trackingNo ?? "—"}</span>
              </RowLine>
              {data.shippedAt ? (
                <RowLine icon={Calendar} term="발송일">
                  <span className="tabular-nums">
                    {tsToDateStr(data.shippedAt)}
                  </span>
                </RowLine>
              ) : null}
              {data.deliveredAt ? (
                <RowLine icon={Calendar} term="배송 완료일">
                  <span className="tabular-nums">
                    {tsToDateStr(data.deliveredAt)}
                  </span>
                </RowLine>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
              아직 발송되지 않았습니다.
            </p>
          )}
        </div>
      </section>

      {/* 품목 */}
      <section className="mt-12 border-b border-[var(--color-border-light)] pb-12">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          주문 품목 ({data.items?.length ?? 0}건)
        </h2>
        <ul className="mt-4 divide-y divide-[var(--color-border-light)] text-sm">
          {(data.items ?? []).map((it) => {
            const item = it as {
              id: string;
              productName?: string;
              qty?: number;
              unitPrice?: number;
              amount?: number;
              lotNo?: string;
            };
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.productName ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)] tabular-nums">
                    {item.qty ?? 0}개 × ₩
                    {(item.unitPrice ?? 0).toLocaleString()}
                    {item.lotNo ? ` · LOT ${item.lotNo}` : ""}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  ₩{(item.amount ?? 0).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 액션 — 상태별 폼 */}
      {status === "ACCEPTED" && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            처리
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {acceptMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              출고 준비로 전환
            </button>
            <button
              type="button"
              onClick={() => setShowCancelForm(true)}
              className="inline-flex h-10 items-center rounded-full border border-[var(--color-border-light)] px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-error)] hover:text-[var(--color-error)]"
            >
              주문 취소
            </button>
          </div>
        </section>
      )}

      {(status === "ACCEPTED" || status === "PACKING") && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            운송장 등록 후 발송 처리
          </h2>
          <form onSubmit={handleShip} className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="h-10 border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none focus:border-[var(--color-accent)]"
              >
                {COURIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="운송장 번호"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                className="h-10 border-b border-[var(--color-border-light)] bg-transparent text-sm tabular-nums placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={lotNo}
                onChange={(e) => setLotNo(e.target.value)}
                placeholder="LOT 번호 (의료기기 출고 시)"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                enterKeyHint="next"
                className="h-10 border-b border-[var(--color-border-light)] bg-transparent text-sm uppercase placeholder:normal-case placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
              />
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                enterKeyHint="done"
                className="h-10 border-b border-[var(--color-border-light)] bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)]"
                placeholder="유통기한"
              />
            </div>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              발송 처리 시 UDI 보고 큐에 자동 등록됩니다. LOT·유통기한은 등급 2 이상 의료기기에서 필수입니다.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              {showCancelForm ? null : (
                <button
                  type="button"
                  onClick={() => setShowCancelForm(true)}
                  className="inline-flex h-10 items-center rounded-full border border-[var(--color-border-light)] px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-error)] hover:text-[var(--color-error)]"
                >
                  주문 취소
                </button>
              )}
              <button
                type="submit"
                disabled={shipMutation.isPending || !trackingNo.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {shipMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                발송 처리
              </button>
            </div>
          </form>
        </section>
      )}

      {status === "SHIPPED" && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            배송 완료 확인
          </h2>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            병원 수령이 확인되면 배송 완료로 처리하세요. 배송 완료 후 영업일 기준 3일 안에 자동 정산됩니다.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDelivered}
              disabled={deliveredMutation.isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {deliveredMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              배송 완료 처리
            </button>
          </div>
        </section>
      )}

      {/* 취소 폼 */}
      {showCancelForm && (
        <section className="mt-12 border-t border-[var(--color-border-light)] pt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-error)]">
            주문 취소
          </h2>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            취소 시 병원에 즉시 알림이 발송됩니다. 사유는 병원에 그대로 전달됩니다.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="취소 사유 (예: 재고 부족, 단종 등)"
            rows={3}
            className="mt-4 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-error)]"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason("");
              }}
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-error)] px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {cancelMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              취소 확정
            </button>
          </div>
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="toast-slide-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-text-primary)] px-5 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

function RowLine({
  icon: Icon,
  term,
  children,
}: {
  icon: typeof Calendar;
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
        <Icon className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        {term}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
