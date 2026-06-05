"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Target,
  Users,
  XCircle,
} from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

// Wave Q2 — 캠페인 상세 + 참여 hospital list.

export const dynamic = "force-dynamic";

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  return 0;
}

function tsToDateStr(v: unknown): string {
  const ms = tsToMillis(v);
  return ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "—";
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN: { label: "진행 중", color: "text-[var(--color-accent)]" },
  TARGET_MET: { label: "목표 달성", color: "text-[var(--color-success)]" },
  FULFILLED: {
    label: "결제 완료",
    color: "text-[var(--color-status-delivered)]",
  },
  FAILED: { label: "미달/취소", color: "text-[var(--color-text-tertiary)]" },
};

export default function SellerGroupbuyDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const campaignId = params.campaignId;

  const [cancelReason, setCancelReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const detailQuery = trpc.vendor.groupbuy.getById.useQuery(
    { groupBuyId: campaignId },
    { enabled: !campaignId.startsWith("demo-") && !campaignId.startsWith("preview-") },
  );
  const participationsQuery = trpc.vendor.groupbuy.listParticipations.useQuery(
    { groupBuyId: campaignId },
    { enabled: !campaignId.startsWith("demo-") && !campaignId.startsWith("preview-") },
  );

  const utils = trpc.useUtils();
  const cancelMutation = trpc.vendor.groupbuy.cancel.useMutation({
    onSuccess: () => {
      void utils.vendor.groupbuy.getById.invalidate({ groupBuyId: campaignId });
      void utils.vendor.groupbuy.list.invalidate();
      void utils.vendor.groupbuy.counts.invalidate();
      setConfirmOpen(false);
      showToast("캠페인이 취소되었습니다");
    },
    onError: (err) => {
      showToast(err.message);
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  // Preview fallback
  const usePreview =
    campaignId.startsWith("demo-") ||
    campaignId.startsWith("preview-") ||
    (!detailQuery.isPending &&
      (detailQuery.error !== null || !detailQuery.data));

  const PREVIEW_DATA = {
    id: campaignId,
    title: "6월 라텍스 장갑 공동구매",
    description: "5월 기준 단가 대비 12% 인하. 마감 1시간 전부터 알림 발송.",
    productName: "수술용 라텍스 장갑 (M) 100매",
    targetQty: 500,
    currentQty: 420,
    participationCount: 28,
    status: "OPEN" as const,
    endsAt: { seconds: Math.floor((Date.now() + 8 * 86400000) / 1000) },
    startsAt: { seconds: Math.floor((Date.now() - 6 * 86400000) / 1000) },
    tierPricing: [
      { minQty: 100, price: 8500 },
      { minQty: 300, price: 7800 },
      { minQty: 500, price: 7200 },
    ],
  };

  const data = usePreview ? PREVIEW_DATA : detailQuery.data;
  const PREVIEW_PARTS = usePreview
    ? [
        {
          id: "p1",
          hospitalName: "서울 명동 가정의학과",
          qty: 50,
          unitPrice: 7800,
          totalAmount: 390000,
          createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
        },
        {
          id: "p2",
          hospitalName: "강남 베스트치과",
          qty: 100,
          unitPrice: 7800,
          totalAmount: 780000,
          createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 },
        },
        {
          id: "p3",
          hospitalName: "분당 한사랑내과",
          qty: 30,
          unitPrice: 8500,
          totalAmount: 255000,
          createdAt: { seconds: Math.floor(Date.now() / 1000) - 172800 },
        },
      ]
    : (participationsQuery.data ?? []);

  const participations = PREVIEW_PARTS as Array<{
    id: string;
    hospitalName?: string;
    qty?: number;
    unitPrice?: number;
    totalAmount?: number;
    createdAt?: unknown;
    voidedAt?: unknown;
  }>;

  const status = (data?.status ?? "OPEN") as keyof typeof STATUS_META;
  const targetQty = data?.targetQty ?? 0;
  const currentQty = data?.currentQty ?? 0;
  const pct = Math.min(100, Math.round((currentQty / Math.max(1, targetQty)) * 100));
  const endsMs = tsToMillis(data?.endsAt);
  const daysLeft = endsMs
    ? Math.ceil((endsMs - Date.now()) / 86400000)
    : 0;

  const KPIS = useMemo(
    () => [
      {
        label: "참여 병원",
        icon: Users,
        value: (data as { participationCount?: number })?.participationCount ?? participations.length,
        suffix: "곳",
      },
      {
        label: "현재 수량",
        icon: Target,
        value: currentQty,
        suffix: "개",
      },
      {
        label: "목표 달성률",
        icon: CheckCircle2,
        value: pct,
        suffix: "%",
      },
      {
        label: "마감까지",
        icon: Clock,
        value: Math.max(0, daysLeft),
        suffix: "일",
      },
    ],
    [data, currentQty, pct, daysLeft, participations.length],
  );

  if (detailQuery.isPending && !usePreview) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-text-tertiary)]" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        <PageHeader
          label="파트너센터 · 공동구매"
          title="캠페인을 찾을 수 없습니다"
        />
        <Link
          href="/seller/groupbuys"
          className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          캠페인 목록으로
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <Link
        href="/seller/groupbuys"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
      >
        <ArrowLeft className="h-3 w-3" />
        캠페인 목록
      </Link>

      <PageHeader
        label={`파트너센터 · 공동구매 · ${STATUS_META[status]?.label ?? status}`}
        title={data.title ?? "—"}
        description={(data as { description?: string }).description ?? data.productName ?? ""}
      >
        {status === "OPEN" && !usePreview && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-error)] px-5 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5"
          >
            <XCircle className="h-3.5 w-3.5" />
            캠페인 취소
          </button>
        )}
      </PageHeader>

      {/* KPI */}
      <section className="mt-12 grid grid-cols-2 gap-y-8 border-y border-[var(--color-border-light)] py-8 lg:grid-cols-4 lg:gap-y-0">
        {KPIS.map((k, i) => (
          <div
            key={k.label}
            className={`px-6 first:pl-0 lg:px-8 ${
              i > 0 ? "lg:border-l lg:border-[var(--color-border-light)]" : ""
            }`}
          >
            <div className="flex items-center gap-1.5">
              <k.icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <p className="text-xs text-[var(--color-text-secondary)]">
                {k.label}
              </p>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              <CountUp value={k.value} suffix={k.suffix} />
            </p>
          </div>
        ))}
      </section>

      {usePreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          ※ 디자인 미리보기 데이터입니다.
        </p>
      )}

      {/* 진행률 바 */}
      <section className="mt-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              목표 진행률
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {currentQty.toLocaleString()}{" "}
              <span className="text-base text-[var(--color-text-tertiary)]">
                / {targetQty.toLocaleString()}개
              </span>
            </p>
          </div>
          <span className="text-3xl font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-border-light)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {/* 메타 + 가격 티어 */}
      <section className="mt-12 grid gap-12 border-y border-[var(--color-border-light)] py-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            캠페인 정보
          </p>
          <dl className="mt-4 divide-y divide-[var(--color-border-light)] text-sm">
            <RowDef term="상품" def={data.productName ?? "—"} />
            <RowDef term="시작" def={tsToDateStr(data.startsAt)} />
            <RowDef term="마감" def={tsToDateStr(data.endsAt)} />
            <RowDef
              term="상태"
              def={STATUS_META[status]?.label ?? status}
              defClass={STATUS_META[status]?.color ?? ""}
            />
          </dl>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            가격 티어
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {(data.tierPricing ?? []).map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-2 last:border-0"
              >
                <span className="text-[var(--color-text-secondary)] tabular-nums">
                  {t.minQty.toLocaleString()}개 이상
                </span>
                <span className="font-semibold tabular-nums">
                  ₩{t.price.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 참여 list */}
      <section className="mt-12">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              참여 병원
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              총 {participations.length}건
            </h2>
          </div>
        </header>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                <th className="py-3 pr-6 font-medium">병원</th>
                <th className="px-6 py-3 text-right font-medium">수량</th>
                <th className="px-6 py-3 text-right font-medium">단가</th>
                <th className="px-6 py-3 text-right font-medium">금액</th>
                <th className="px-6 py-3 font-medium">참여 시각</th>
              </tr>
            </thead>
            <tbody>
              {participations.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-16 text-center text-sm text-[var(--color-text-tertiary)]"
                  >
                    아직 참여한 병원이 없습니다.
                  </td>
                </tr>
              ) : (
                participations.map((p, i) => (
                  <tr
                    key={p.id}
                    className="row-fade-in border-b border-[var(--color-border-light)] last:border-0"
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <td className="py-4 pr-6 font-medium">
                      {p.hospitalName ?? "—"}
                      {p.voidedAt ? (
                        <span className="ml-2 text-[10px] text-[var(--color-error)]">
                          취소
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {p.qty?.toLocaleString() ?? 0}개
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-[var(--color-text-secondary)]">
                      ₩{p.unitPrice?.toLocaleString() ?? 0}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums">
                      ₩{p.totalAmount?.toLocaleString() ?? 0}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)] tabular-nums">
                      {tsToDateStr(p.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 취소 확인 dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-lg font-semibold tracking-tight">
              캠페인을 취소하시겠습니까?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              참여한 {participations.length}건의 결제가 모두 환불되며 되돌릴 수
              없습니다.
            </p>
            <div className="mt-5">
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                취소 사유
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="병원에게 안내될 사유를 작성해주세요"
                className="mt-2 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent p-2 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="h-10 rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                onClick={() => {
                  void cancelMutation.mutateAsync({
                    groupBuyId: campaignId,
                    reason: cancelReason.trim(),
                  });
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-error)] px-5 text-sm font-medium text-white hover:bg-[var(--color-error)]/90 disabled:bg-[var(--color-text-tertiary)]"
              >
                {cancelMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                캠페인 취소
              </button>
            </div>
          </div>
        </div>
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

function RowDef({
  term,
  def,
  defClass,
}: {
  term: string;
  def: string;
  defClass?: string;
}) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-[var(--color-text-secondary)]">{term}</dt>
      <dd className={`font-medium ${defClass ?? ""}`}>{def}</dd>
    </div>
  );
}
