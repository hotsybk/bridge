import Link from "next/link";

import { BackLink } from "@/components/shared/back-button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { formatDateTime, formatKRW } from "@/lib/format";
import { trpcServer } from "@/lib/trpc/server";

import { DisputeThread } from "./thread";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 공급업체 — 본인 분쟁 상세 (Phase ν-4 신규).
 *
 * dispute.getById 호출. role 기반 격리.
 * 좌측 카카오톡 style thread + 우측 sticky info.
 */

const TYPE_LABEL: Record<string, string> = {
  REFUND: "환불",
  RETURN: "반품",
  NOT_DELIVERED: "미수령",
  QUALITY: "품질",
  OTHER: "기타",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "신규",
  IN_PROGRESS: "진행 중",
  NEEDS_ADMIN_RESPONSE: "응답 필요",
  RESOLVED: "해결",
  REJECTED: "거부",
};

const STATUS_BORDER: Record<string, string> = {
  OPEN: "border-[var(--color-warning)]",
  IN_PROGRESS: "border-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "border-[var(--color-warning)]",
  RESOLVED: "border-[var(--color-success)]",
  REJECTED: "border-[var(--color-text-tertiary)]",
};

const STATUS_TEXT: Record<string, string> = {
  OPEN: "text-[var(--color-warning)]",
  IN_PROGRESS: "text-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "text-[var(--color-warning)]",
  RESOLVED: "text-[var(--color-success)]",
  REJECTED: "text-[var(--color-text-tertiary)]",
};

function demoFallback(disputeId: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    dispute: {
      id: disputeId,
      orderId: "MP-2026-05-30-0231",
      hospitalId: "h1",
      hospitalName: "서울메디컬의원",
      vendorId: "v1",
      vendorName: "메디서플라이",
      type: "REFUND",
      amount: 469800,
      reason: "포장 손상으로 사용 불가합니다.",
      status: "NEEDS_ADMIN_RESPONSE",
      resolution: null,
      refundAmount: null,
      openedAt: { seconds: nowSec - 8 * 3600 },
      deadlineAt: { seconds: nowSec + 40 * 3600 },
    },
    messages: [
      {
        id: "m-1",
        authorRole: "BUYER",
        authorName: "서울메디컬의원",
        body: "5월 30일 도착한 라텍스 장갑 중 3박스가 포장 손상으로 사용 불가합니다. 환불을 요청합니다.",
        attachments: [],
        createdAt: { seconds: nowSec - 8 * 3600 },
      },
      {
        id: "m-2",
        authorRole: "VENDOR",
        authorName: "메디서플라이",
        body: "확인했습니다. 사진상 외부 포장 손상은 운송 중 발생한 것으로 보입니다.",
        attachments: [],
        createdAt: { seconds: nowSec - 7 * 3600 },
      },
    ],
  };
}

type DisputeShape = {
  id: string;
  orderId?: string;
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;
  type?: string;
  amount?: number;
  reason?: string;
  status?: string;
  resolution?: string | null;
  refundAmount?: number | null;
  openedAt?: { seconds?: number; _seconds?: number };
  deadlineAt?: { seconds?: number; _seconds?: number };
};

type MessageShape = {
  id: string;
  authorRole?: string;
  authorName?: string;
  body?: string;
  attachments?: Array<{ name: string; size: number; url: string; mime: string }>;
  systemEvent?: string;
  createdAt?: { seconds?: number; _seconds?: number };
};

export default async function VendorDisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;

  let dispute: DisputeShape | null = null;
  let messages: MessageShape[] = [];
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const res = await trpc.dispute.getById({ disputeId });
    if (!res.dispute) throw new Error("not-found");
    dispute = res.dispute as DisputeShape;
    messages = res.messages as MessageShape[];
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      const fb = demoFallback(disputeId);
      dispute = fb.dispute as DisputeShape;
      messages = fb.messages as MessageShape[];
    } else {
      throw new Error("분쟁을 찾을 수 없습니다.");
    }
  }

  if (!dispute) {
    return (
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-16 md:px-12">
        <BackLink href="/seller/disputes" label="분쟁 list" />
        <p className="mt-12 text-sm text-[var(--color-text-secondary)]">
          분쟁을 찾을 수 없습니다.
        </p>
      </main>
    );
  }

  const status = dispute.status ?? "OPEN";
  const closed = status === "RESOLVED" || status === "REJECTED";
  const deadlineSec = dispute.deadlineAt?.seconds ?? dispute.deadlineAt?._seconds;
  const openedSec = dispute.openedAt?.seconds ?? dispute.openedAt?._seconds;
  const hoursLeft = deadlineSec
    ? Math.floor((deadlineSec * 1000 - Date.now()) / 3600000)
    : null;

  return (
    <main
      id="main-content"
      className="mx-auto max-w-7xl px-6 py-12 pb-32 md:px-12 md:py-16 md:pb-16"
    >
      <Breadcrumb
        items={[
          { label: "셀러센터", href: "/seller/orders" },
          { label: "분쟁", href: "/seller/disputes" },
          { label: `#${dispute.id.slice(0, 8)}` },
        ]}
      />

      {/* 헤더 */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border-light)] pb-10">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            분쟁 · 상세
          </p>
          <h1 className="mt-3 break-keep text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
            {TYPE_LABEL[dispute.type ?? "OTHER"]} · 주문 {dispute.orderId ?? "—"}
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            병원 {dispute.hospitalName ?? "—"} · 신청 금액{" "}
            <span className="tabular-nums">{formatKRW(dispute.amount)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!closed && hoursLeft !== null && (
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 font-mono text-xs tabular-nums ${
                hoursLeft <= 6
                  ? "text-[var(--color-error)]"
                  : hoursLeft < 24
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-text-tertiary)]"
              }`}
            >
              마감 {hoursLeft <= 0 ? "이탈" : `${hoursLeft}h 남음`}
            </span>
          )}
          <span
            className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium ${
              STATUS_BORDER[status]
            } ${STATUS_TEXT[status]}`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      {isPreview && (
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
          PREVIEW · 비로그인 상태입니다. 실제 데이터가 아닙니다.
        </p>
      )}

      {closed && (
        <div className="mt-8 border-l-2 border-[var(--color-success)] bg-[var(--color-success)]/5 p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-success)]">
            운영자 결정
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-primary)]">
            {dispute.resolution ?? STATUS_LABEL[status]}
          </p>
          {dispute.refundAmount != null && (
            <p className="mt-2 text-sm tabular-nums text-[var(--color-text-secondary)]">
              환불 금액 ·{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {formatKRW(dispute.refundAmount)}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-[1fr_320px] lg:gap-16">
        <div className="min-w-0">
          <DisputeThread
            disputeId={disputeId}
            initialMessages={messages}
            isPreview={isPreview}
            myRole="VENDOR"
            closed={closed}
            hospitalName={dispute.hospitalName ?? "병원"}
            vendorName={dispute.vendorName ?? "공급업체"}
          />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            분쟁 정보
          </p>
          <dl className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <Row
              label="주문번호"
              value={
                <Link
                  href={`/seller/orders/${dispute.orderId ?? ""}`}
                  className="font-mono text-xs tabular-nums text-[var(--color-accent)] hover:underline"
                >
                  {dispute.orderId ?? "—"}
                </Link>
              }
            />
            <Row label="유형" value={TYPE_LABEL[dispute.type ?? "OTHER"]} />
            <Row label="병원" value={dispute.hospitalName ?? "—"} />
            <Row label="신청 금액" value={formatKRW(dispute.amount)} mono />
            <Row
              label="신청 시각"
              value={openedSec ? formatDateTime(openedSec * 1000) : "—"}
              mono
            />
            {!closed && deadlineSec && (
              <Row
                label="마감 시각"
                value={formatDateTime(deadlineSec * 1000)}
                mono
              />
            )}
          </dl>

          <div className="mt-8 rounded-2xl border border-[var(--color-border-light)] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              안내
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              마감 전 응답 필수 · 응답은 공개됩니다
            </p>
          </div>
        </aside>
      </div>
    </main>
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
    <div className="grid grid-cols-[110px_1fr] gap-3 px-2 py-2.5">
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
