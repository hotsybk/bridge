"use client";

import { CheckCircle2, ClipboardList, Clock, ShieldCheck } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

/**
 * Phase Φ-C 작업3 — 파트너센터 UDI 보고 현황 (/seller/udi-reports).
 *
 * vendor 가 본인 의료기기 상품의 UDI(식약처 e-MEDI) 보고 상태를 확인한다.
 * 월말 자동 보고 (식약처 e-MEDI) — 운영 톤 안내.
 *
 * 데이터: trpc.vendor.udi.list (_udiReportQueue read).
 * 디자인 DNA: 박스 없음, 라인 only. 데스크탑 표 / 모바일 카드 분기 (ξ-2 패턴).
 */

const STATUS_META: Record<
  string,
  { label: string; tone: string; dot: string }
> = {
  PENDING: {
    label: "보고 대기",
    tone: "text-[var(--color-status-pending)]",
    dot: "bg-[var(--color-status-pending)]",
  },
  REPORTED: {
    label: "보고 완료",
    tone: "text-[var(--color-status-delivered)]",
    dot: "bg-[var(--color-status-delivered)]",
  },
  FAILED: {
    label: "보고 실패",
    tone: "text-[var(--color-error)]",
    dot: "bg-[var(--color-error)]",
  },
};

export default function SellerUdiReportsPage() {
  const { data, isLoading } = trpc.vendor.udi.list.useQuery();

  const rows = data?.rows ?? [];
  const kpi = data?.thisMonth ?? {
    period: "",
    target: 0,
    reported: 0,
    pending: 0,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label="파트너센터 · UDI 보고"
        title="UDI 보고"
        description="발송한 의료기기(2등급 이상)의 식약처 e-MEDI 보고 현황입니다."
      />

      {/* 운영 안내 — 자동 보고 톤 */}
      <div className="mt-8 flex items-start gap-3 border-y border-[var(--color-border-light)] py-5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
        <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
          UDI 보고는 매월 말일 식약처 e-MEDI 시스템으로 자동 전송됩니다. 별도
          제출 없이 발송(SHIPPED) 시 입력한 LOT·유통기한 정보로 보고가
          진행됩니다. 보고 실패 건은 운영팀이 재시도 처리합니다.
        </p>
      </div>

      {/* KPI 3컬럼 */}
      <section className="grid grid-cols-3 border-b border-[var(--color-border-light)] py-8">
        <KpiItem
          icon={ClipboardList}
          label={`${kpi.period || "이번 달"} 보고 대상`}
          value={kpi.target}
          suffix="건"
          tone="accent"
          hasDivider={false}
        />
        <KpiItem
          icon={CheckCircle2}
          label="보고 완료"
          value={kpi.reported}
          suffix="건"
          tone="success"
          hasDivider
        />
        <KpiItem
          icon={Clock}
          label="미보고"
          value={kpi.pending}
          suffix="건"
          tone="warning"
          hasDivider
        />
      </section>

      {/* 보고 현황 */}
      <section className="mt-12">
        <header className="flex items-baseline justify-between border-b border-[var(--color-border-light)] pb-3">
          <h2 className="text-sm font-semibold">보고 현황</h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            최근 발송 순 · 총 {rows.length}건
          </p>
        </header>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-[var(--color-text-tertiary)]">
            불러오는 중…
          </p>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              아직 UDI 보고 대상이 없습니다
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              의료기기(2등급 이상) 상품을 발송하면 보고 대상이 여기에
              표시됩니다.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop — table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[1.6fr_140px_100px_120px_120px] gap-4 border-b border-[var(--color-border-light)] py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                <span>상품 · 병원</span>
                <span>LOT</span>
                <span>기간</span>
                <span>수량</span>
                <span className="text-right">상태</span>
              </div>
              <ul className="divide-y divide-[var(--color-border-light)]">
                {rows.map((r) => {
                  const meta = STATUS_META[r.reportStatus] ?? STATUS_META.PENDING;
                  return (
                    <li
                      key={r.id}
                      className="grid grid-cols-[1.6fr_140px_100px_120px_120px] items-center gap-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {r.productName}
                        </p>
                        <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                          {r.hospitalName} · {r.subOrderNo}
                        </p>
                      </div>
                      <p className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {r.lotNo}
                      </p>
                      <p className="text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {r.period}
                      </p>
                      <p className="text-sm tabular-nums">{r.quantity}</p>
                      <p className="flex items-center justify-end gap-1.5 text-xs font-medium">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        />
                        <span className={meta.tone}>{meta.label}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Mobile — cards */}
            <ul className="divide-y divide-[var(--color-border-light)] md:hidden">
              {rows.map((r) => {
                const meta = STATUS_META[r.reportStatus] ?? STATUS_META.PENDING;
                return (
                  <li key={r.id} className="py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {r.productName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
                          {r.hospitalName} · {r.subOrderNo}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        />
                        <span className={meta.tone}>{meta.label}</span>
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-[var(--color-text-tertiary)]">LOT</dt>
                        <dd className="mt-0.5 truncate font-mono tabular-nums">
                          {r.lotNo}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-text-tertiary)]">기간</dt>
                        <dd className="mt-0.5 tabular-nums">{r.period}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-text-tertiary)]">수량</dt>
                        <dd className="mt-0.5 tabular-nums">{r.quantity}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <p className="mt-16 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
        식약처 의료기기통합정보시스템(e-MEDI) 연동 · 월말 자동 보고
      </p>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────────────────────

function KpiItem({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
  hasDivider,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  suffix?: string;
  tone: "success" | "accent" | "warning";
  hasDivider: boolean;
}) {
  const iconColor = {
    success: "text-[var(--color-success)]",
    accent: "text-[var(--color-accent)]",
    warning: "text-[var(--color-warning)]",
  }[tone];
  return (
    <div
      className={`px-4 first:pl-0 md:px-8 ${
        hasDivider ? "border-l border-[var(--color-border-light)]" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} suffix={suffix ?? ""} />
      </p>
    </div>
  );
}
