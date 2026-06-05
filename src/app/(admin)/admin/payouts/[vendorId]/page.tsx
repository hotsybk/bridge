// Wave M — /admin/payouts/[vendorId] Server Component.
// vendor 단건 정산·이체 이력. tRPC fetch + PREVIEW fallback.

import Link from "next/link";
import {ArrowLeft, ChevronDown, Download} from "lucide-react";
import type {Timestamp} from "firebase/firestore";

import {AdminKpiCell} from "@/components/admin/admin-kpi-cell";
import {CountUp} from "@/components/shared/count-up";
import {PageHeader} from "@/components/shared/page-header";
import {trpcServer} from "@/lib/trpc/server";
import {adminDb} from "@/server/firebase/admin";
import {COLLECTIONS} from "@/server/firebase/collections";
import type {Settlement, Payout, Vendor} from "@/lib/types";
import {formatDate} from "@/lib/utils/firestore-time";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

type RowStatus = "FAST" | "SCHEDULED" | "HELD" | "DONE";

const STATUS_LABEL: Record<RowStatus, string> = {
  FAST: "빠른정산",
  SCHEDULED: "정기정산 예약",
  HELD: "보류",
  DONE: "이체 완료",
};

const STATUS_TONE: Record<RowStatus, {dot: string; text: string}> = {
  FAST: {dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]"},
  SCHEDULED: {
    dot: "bg-[var(--color-text-tertiary)]",
    text: "text-[var(--color-text-tertiary)]",
  },
  HELD: {dot: "bg-[var(--color-error)]", text: "text-[var(--color-error)]"},
  DONE: {dot: "bg-[var(--color-success)]", text: "text-[var(--color-success)]"},
};

function statusToRowStatus(s: Settlement): RowStatus {
  if (s.status === "PAID") return "DONE";
  if (s.status === "HOLD") return "HELD";
  if (s.status === "REQUESTED" && s.isFastSettlement) return "FAST";
  if (s.status === "APPROVED" && s.isFastSettlement) return "FAST";
  return "SCHEDULED";
}

// PREVIEW mock — plain object cast (client tsToMs 가 모두 수용).
function makeMockTs(daysAgo: number): Timestamp {
  return {seconds: Math.floor((Date.now() - daysAgo * 86400 * 1000) / 1000), nanoseconds: 0} as unknown as Timestamp;
}

function getMockVendor(vendorId: string): Partial<Vendor> {
  return {
    id: vendorId,
    companyName: "메디서플라이",
    bizRegNo: "123-45-67890",
    grade: "PLUS",
  };
}

function getMockSettlements(): Settlement[] {
  const base = (i: number, status: Settlement["status"]): Settlement =>
    ({
      id: `demo-s${i}`,
      vendorId: "demo-v",
      vendorName: "메디서플라이",
      periodStart: makeMockTs(i + 1),
      periodEnd: makeMockTs(i),
      grossAmount: 500000 + i * 50000,
      paymentFeeAmount: 14000 + i * 1400,
      paymentFeeVatAmount: 1400,
      commissionAmount: 25000 + i * 2500,
      commissionVatAmount: 2500,
      refundDeductAmount: 0,
      couponDeductAmount: 0,
      netPayout: 460000 + i * 46000,
      isFastSettlement: i < 2,
      fastSettlementDays: i < 2 ? 3 : 7,
      fastSettlementFee: i < 2 ? 5600 : 0,
      finalPayout: 460000 + i * 46000,
      subOrderRefs: [],
      status,
      scheduledPayoutAt: makeMockTs(-3),
      createdAt: makeMockTs(i),
      updatedAt: makeMockTs(i),
      paidAt: status === "PAID" ? makeMockTs(i - 1) : undefined,
      payoutId: status === "PAID" ? `demo-p${i}` : undefined,
    }) as Settlement;
  return [
    base(0, "REQUESTED"),
    base(1, "REQUESTED"),
    base(2, "PENDING"),
    base(3, "PENDING"),
    base(4, "PAID"),
    base(5, "PAID"),
    base(6, "PAID"),
    base(7, "HOLD"),
  ];
}

function getMockPayouts(): Payout[] {
  return [
    {
      id: "demo-p4",
      vendorId: "demo-v",
      vendorName: "메디서플라이",
      settlementIds: ["demo-s4"],
      totalAmount: 644000,
      bankCode: "088",
      bankAccount: "123-456-789012",
      accountHolder: "메디서플라이",
      method: "MANUAL_BANK",
      externalRef: "TR-2026-05-25-0042",
      status: "PAID",
      requestedAt: makeMockTs(7),
      completedAt: makeMockTs(7),
      createdAt: makeMockTs(7),
    },
  ];
}

const MOCK_COUNTS = {
  totalPaid: 142300000,
  thisMonth: 12400000,
  held: 340000,
  avgDelay: 4.2,
};

export default async function AdminPayoutsPage({
  params,
}: {
  params: Promise<{vendorId: string}>;
}) {
  const {vendorId} = await params;

  let vendor: Partial<Vendor> = {id: vendorId, companyName: vendorId};
  let settlements: Settlement[] = [];
  let payouts: Payout[] = [];
  let counts = MOCK_COUNTS;
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const [s, p, c] = await Promise.all([
      trpc.admin.settlement.listByVendor({vendorId, pageSize: 30}),
      trpc.admin.settlement.payoutsListByVendor({vendorId}),
      trpc.admin.settlement.vendorPayoutCounts({vendorId}),
    ]);
    settlements = s.settlements;
    payouts = p;
    counts = c;

    // vendor 정보는 별도 직접 fetch (Admin SDK).
    try {
      const vSnap = await adminDb()
        .collection(COLLECTIONS.vendors)
        .doc(vendorId)
        .get();
      if (vSnap.exists) {
        vendor = {id: vSnap.id, ...(vSnap.data() as Omit<Vendor, "id">)};
      }
    } catch {
      // vendor 정보 fetch 실패 — id 만으로 진행
    }
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      vendor = getMockVendor(vendorId);
      settlements = getMockSettlements();
      payouts = getMockPayouts();
    }
  }

  const rows = settlements.map((s) => ({
    s,
    rowStatus: statusToRowStatus(s),
  }));

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
        <Link
          href="/admin/settlement"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          정산 운영으로
        </Link>
      </div>

      {/* Header */}
      <div className="mt-6">
        <PageHeader
          label="재무 · 공급업체 지급"
          title={vendor.companyName ?? vendorId}
          description={
            isPreview
              ? "(PREVIEW — 로그인 후 실 데이터 노출)"
              : undefined
          }
        >
          {vendor.grade && (
            <span className="inline-flex h-7 items-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-3 text-xs font-medium text-[var(--color-accent)]">
              GRADE {vendor.grade}
            </span>
          )}
          {vendor.bizRegNo && (
            <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
              {vendor.bizRegNo}
            </span>
          )}
        </PageHeader>
      </div>

      {/* KPI 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="누적 정산액"
          value={<CountUp value={counts.totalPaid} integer />}
          sub="원"
        />
        <AdminKpiCell
          label="이번달 정산"
          value={<CountUp value={counts.thisMonth} integer />}
          sub="원"
          deltaColor={counts.thisMonth > 0 ? "accent" : "neutral"}
        />
        <AdminKpiCell
          label="보류금"
          value={<CountUp value={counts.held} integer />}
          sub="원"
          deltaColor={counts.held > 0 ? "error" : "neutral"}
        />
        <AdminKpiCell
          label="평균 지연일"
          value={<CountUp value={Math.round(counts.avgDelay * 10) / 10} integer={false} />}
          sub="일"
          delta={counts.avgDelay <= 7 ? "목표 7일 이내" : "지연 발생"}
          deltaColor={counts.avgDelay <= 7 ? "success" : "warning"}
        />
      </dl>

      {/* Filter chips + CSV */}
      <div className="mt-10 flex items-end justify-between gap-4">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          최근 {settlements.length}건 / 이체 이력 {payouts.length}건
        </p>
        <button
          type="button"
          disabled
          className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-text-tertiary)] opacity-50"
          title="Phase 3+ 활성"
        >
          <Download className="h-3 w-3" />
          CSV 내보내기
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {(["기간", "SubOrder 검색", "금액 범위"] as const).map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-tertiary)] opacity-50"
            title="Phase 3+ 활성"
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
      </div>

      {/* Line Table */}
      <h2 className="mt-10 text-base font-semibold tracking-[-0.02em]">
        정산 내역
      </h2>
      <div className="mt-3 border-y border-[var(--color-border-light)]">
        <div className="hidden md:grid grid-cols-[100px_1fr_120px_100px_120px_140px_160px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>일자</span>
          <span>Settlement ID</span>
          <span className="text-right">매출</span>
          <span className="text-right">수수료</span>
          <span className="text-right">정산금</span>
          <span>상태</span>
          <span>payout ref</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
            정산 내역이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {rows.map(({s, rowStatus}) => {
              const tone = STATUS_TONE[rowStatus];
              return (
                <li key={s.id}>
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[100px_1fr_120px_100px_120px_140px_160px] items-center gap-4 px-2 py-4 text-sm">
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatDate(s.createdAt)}
                    </span>
                    <span className="truncate font-mono text-xs tabular-nums text-[var(--color-accent)]">
                      {s.id}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      ₩{(s.grossAmount ?? 0).toLocaleString()}
                    </span>
                    <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      −₩
                      {(
                        (s.commissionAmount ?? 0) + (s.paymentFeeAmount ?? 0)
                      ).toLocaleString()}
                    </span>
                    <span className="text-right font-mono font-semibold tabular-nums">
                      ₩{(s.finalPayout ?? 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${tone.dot}`}
                      />
                      <span className={`text-xs font-medium ${tone.text}`}>
                        {STATUS_LABEL[rowStatus]}
                        {rowStatus !== "DONE" && s.scheduledPayoutAt && (
                          <span className="ml-1 font-mono tabular-nums text-[var(--color-text-tertiary)]">
                            · {formatDate(s.scheduledPayoutAt)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                      {s.payoutId ?? "—"}
                    </span>
                  </div>
                  {/* Mobile */}
                  <div className="flex flex-col gap-2 px-3 py-4 md:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-xs tabular-nums text-[var(--color-accent)]">
                        {s.id.slice(0, 16)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className={`status-pulse-dot h-1.5 w-1.5 rounded-full ${tone.dot}`}
                        />
                        <span className={`text-xs font-medium ${tone.text}`}>
                          {STATUS_LABEL[rowStatus]}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        정산금
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        ₩{(s.finalPayout ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                      <span className="font-mono tabular-nums">
                        {formatDate(s.createdAt)}
                      </span>
                      <span className="font-mono tabular-nums">
                        매출 ₩{(s.grossAmount ?? 0).toLocaleString()} · 수수료 −₩
                        {(
                          (s.commissionAmount ?? 0) + (s.paymentFeeAmount ?? 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                    {rowStatus !== "DONE" && s.scheduledPayoutAt && (
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">
                        예정일{" "}
                        <span className="font-mono tabular-nums">
                          {formatDate(s.scheduledPayoutAt)}
                        </span>
                      </p>
                    )}
                    {s.payoutId && (
                      <p className="truncate font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                        ref {s.payoutId}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Payout 이체 이력 */}
      {payouts.length > 0 && (
        <>
          <h2 className="mt-10 text-base font-semibold tracking-[-0.02em]">
            이체 이력
          </h2>
          <div className="mt-3 border-y border-[var(--color-border-light)]">
            <div className="hidden md:grid grid-cols-[120px_140px_1fr_160px_140px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              <span>이체일</span>
              <span className="text-right">금액</span>
              <span>이체 ref</span>
              <span>방식</span>
              <span>상태</span>
            </div>
            <ul className="divide-y divide-[var(--color-border-light)]">
              {payouts.map((p) => (
                <li key={p.id}>
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[120px_140px_1fr_160px_140px] items-center gap-4 px-2 py-4 text-sm">
                    <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatDate(p.completedAt ?? p.createdAt)}
                    </span>
                    <span className="text-right font-mono font-semibold tabular-nums">
                      ₩{(p.totalAmount ?? 0).toLocaleString()}
                    </span>
                    <span className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {p.externalRef ?? "—"}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {p.method === "MANUAL_BANK"
                        ? "수동 이체"
                        : p.method === "PORTONE"
                          ? "PortOne"
                          : "가상계좌"}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-success)]">
                      {p.status}
                    </span>
                  </div>
                  {/* Mobile */}
                  <div className="flex flex-col gap-2 px-3 py-4 md:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {formatDate(p.completedAt ?? p.createdAt)}
                      </span>
                      <span className="text-xs font-medium text-[var(--color-success)]">
                        {p.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {p.method === "MANUAL_BANK"
                          ? "수동 이체"
                          : p.method === "PORTONE"
                            ? "PortOne"
                            : "가상계좌"}
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        ₩{(p.totalAmount ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {p.externalRef && (
                      <p className="truncate font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                        ref {p.externalRef}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
        총 {rows.length}건의 정산 · {payouts.length}건의 이체
      </p>
    </div>
  );
}

