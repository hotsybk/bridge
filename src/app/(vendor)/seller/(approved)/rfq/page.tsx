"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, Loader2 } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

// Wave Q2 — 파트너센터 RFQ(견적 요청) list.

export const dynamic = "force-dynamic";

type RfqStatus = "OPEN" | "CLOSED" | "AWARDED" | "CANCELLED";

type RfqRow = {
  id: string;
  title: string;
  category: string;
  qty: number;
  unit: string;
  deadline: string;
  daysLeft: number;
  quoteCount: number;
  status: RfqStatus;
};

const STATUS_META: Record<RfqStatus, { label: string; color: string }> = {
  OPEN: { label: "응답 가능", color: "text-[var(--color-accent)]" },
  CLOSED: { label: "마감", color: "text-[var(--color-text-tertiary)]" },
  AWARDED: { label: "낙찰", color: "text-[var(--color-success)]" },
  CANCELLED: { label: "취소", color: "text-[var(--color-text-tertiary)]" },
};

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  return 0;
}

const PREVIEW_ROWS: RfqRow[] = [
  {
    id: "preview-1",
    title: "치과용 임플란트 식립 키트 200세트",
    category: "치과 재료",
    qty: 200,
    unit: "SET",
    deadline: "2026-06-12",
    daysLeft: 10,
    quoteCount: 3,
    status: "OPEN",
  },
  {
    id: "preview-2",
    title: "수술실 소모품 패키지 (월 단위)",
    category: "수술 용품",
    qty: 500,
    unit: "BOX",
    deadline: "2026-06-08",
    daysLeft: 6,
    quoteCount: 5,
    status: "OPEN",
  },
  {
    id: "preview-3",
    title: "디지털 청진기 50대",
    category: "진단기기",
    qty: 50,
    unit: "EA",
    deadline: "2026-05-25",
    daysLeft: -7,
    quoteCount: 4,
    status: "AWARDED",
  },
];

export default function SellerRfqPage() {
  const listQuery = trpc.vendor.rfq.list.useQuery({ pageSize: 50 });

  const usePreview =
    !listQuery.isPending &&
    (listQuery.error !== null || (listQuery.data?.rfqs.length ?? 0) === 0);

  const rows: RfqRow[] = useMemo(() => {
    if (usePreview) return PREVIEW_ROWS;
    return (listQuery.data?.rfqs ?? []).map((r) => {
      const data = r as {
        id: string;
        title?: string;
        category?: string;
        qty?: number;
        unit?: string;
        deadline?: unknown;
        deliveryDeadline?: unknown;
        quoteCount?: number;
        status?: string;
      };
      const deadlineMs = tsToMillis(data.deadline ?? data.deliveryDeadline);
      const daysLeft = deadlineMs
        ? Math.ceil((deadlineMs - Date.now()) / 86400000)
        : 0;
      return {
        id: data.id,
        title: data.title ?? "—",
        category: data.category ?? "—",
        qty: data.qty ?? 0,
        unit: data.unit ?? "EA",
        deadline: deadlineMs
          ? new Date(deadlineMs).toISOString().slice(0, 10)
          : "—",
        daysLeft,
        quoteCount: data.quoteCount ?? 0,
        status: (data.status as RfqStatus) ?? "OPEN",
      };
    });
  }, [usePreview, listQuery.data]);

  const counts = useMemo(() => {
    const open = rows.filter((r) => r.status === "OPEN").length;
    const awarded = rows.filter((r) => r.status === "AWARDED").length;
    const total = rows.length;
    const winRate = total > 0 ? Math.round((awarded / total) * 100) : 0;
    return { open, awarded, winRate };
  }, [rows]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · 견적 요청"
        title="견적 요청"
        description="병원이 등록한 견적 요청에 응답하면 채택 시 자동 발주됩니다."
      />

      {/* KPI 3 컬럼 */}
      <section className="mt-12 grid grid-cols-1 gap-y-8 border-y border-[var(--color-border-light)] py-8 sm:grid-cols-3">
        <KpiItem
          icon={FileText}
          label="받은 견적 요청"
          value={rows.length}
          suffix="건"
          sub="공개 + 초대 받은 RFQ"
          hasDivider={false}
        />
        <KpiItem
          icon={Clock}
          label="응답 가능"
          value={counts.open}
          suffix="건"
          sub="마감 전 견적 제출 가능"
          hasDivider
        />
        <KpiItem
          icon={CheckCircle2}
          label="채택률"
          value={counts.winRate}
          suffix="%"
          sub={`낙찰 ${counts.awarded}건 / 전체 ${rows.length}건`}
          hasDivider
        />
      </section>

      {usePreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          ※ 디자인 미리보기 데이터입니다. 실제 견적 요청을 받으면 자동으로
          교체됩니다.
        </p>
      )}

      {/* list */}
      <section className="mt-12">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              요청 목록
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              총 {rows.length}건
            </h2>
          </div>
        </header>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                <th className="py-3 pr-6 font-medium">제목</th>
                <th className="px-6 py-3 font-medium">카테고리</th>
                <th className="px-6 py-3 text-right font-medium">수량</th>
                <th className="px-6 py-3 font-medium">마감</th>
                <th className="px-6 py-3 text-right font-medium">경쟁 견적</th>
                <th className="px-6 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isPending && !usePreview ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                  >
                    아직 받은 견적 요청이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className="row-fade-in border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-tertiary)]/60"
                    style={{
                      animationDelay: `${Math.min(i, 12) * 35}ms`,
                    }}
                  >
                    <td className="py-4 pr-6">
                      <Link
                        href={`/seller/rfq/${r.id}`}
                        className="font-medium hover:text-[var(--color-accent)]"
                        onClick={(e) => {
                          if (r.id.startsWith("preview-")) {
                            e.preventDefault();
                          }
                        }}
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {r.category}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {r.qty.toLocaleString()}
                      <span className="ml-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                        {r.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {r.daysLeft > 0 ? (
                        <span className="tabular-nums">
                          D−{r.daysLeft}{" "}
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            ({r.deadline})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] tabular-nums">
                          마감 ({r.deadline})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {r.quoteCount}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold ${STATUS_META[r.status].color}`}
                      >
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function KpiItem({
  icon: Icon,
  label,
  value,
  suffix,
  sub,
  hasDivider,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  suffix: string;
  sub: string;
  hasDivider: boolean;
}) {
  return (
    <div
      className={`px-6 first:pl-0 lg:px-8 ${
        hasDivider ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
        {sub}
      </p>
    </div>
  );
}
