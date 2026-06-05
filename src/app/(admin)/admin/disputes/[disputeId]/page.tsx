import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Breadcrumb } from "@/components/shared/breadcrumb";
import { formatDateTime, formatKRW } from "@/lib/format";
import { trpcServer } from "@/lib/trpc/server";

import { DisputeThread } from "./thread";
import { ResolvePanel } from "./resolve-panel";

export const dynamic = "force-dynamic";

const PREVIEW_MODE = process.env.NODE_ENV !== "production";

/**
 * 운영자 — 분쟁 조정 상세 (Wave E 실연동).
 *
 * tRPC `admin.dispute.getById` 호출 (dispute + messages + activity).
 * 메시지 thread / 결정 panel 은 client island 로 분리.
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
  NEEDS_ADMIN_RESPONSE: "운영자 응답 필요",
  RESOLVED: "해결",
  REJECTED: "거부",
};

const STATUS_BORDER: Record<string, string> = {
  OPEN: "border-[var(--color-border-light)]",
  IN_PROGRESS: "border-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "border-[var(--color-warning)]",
  RESOLVED: "border-[var(--color-success)]",
  REJECTED: "border-[var(--color-text-tertiary)]",
};

const STATUS_TEXT: Record<string, string> = {
  OPEN: "text-[var(--color-text-tertiary)]",
  IN_PROGRESS: "text-[var(--color-accent)]",
  NEEDS_ADMIN_RESPONSE: "text-[var(--color-warning)]",
  RESOLVED: "text-[var(--color-success)]",
  REJECTED: "text-[var(--color-text-tertiary)]",
};

// ─────────────────────────────────────────────────────────────
// Demo fallback
// ─────────────────────────────────────────────────────────────

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
      openedAt: { seconds: nowSec - 8 * 3600 },
      deadlineAt: { seconds: nowSec + 8 * 3600 },
    },
    messages: [
      {
        id: "m-1",
        authorRole: "BUYER",
        authorId: "u1",
        authorName: "서울메디컬의원",
        body: "5월 30일 도착한 라텍스 장갑 중 3박스가 포장 손상으로 사용 불가합니다. 환불을 요청합니다.",
        attachments: [],
        createdAt: { seconds: nowSec - 8 * 3600 },
      },
      {
        id: "m-2",
        authorRole: "VENDOR",
        authorId: "u2",
        authorName: "메디서플라이",
        body: "확인했습니다. 사진상 외부 포장 손상은 운송 중 발생한 것으로 보입니다. 운송사 보험 처리 후 안내드리겠습니다.",
        attachments: [],
        createdAt: { seconds: nowSec - 7 * 3600 },
      },
      {
        id: "m-4",
        authorRole: "VENDOR",
        authorId: "u2",
        authorName: "메디서플라이",
        body: "부분 환불(3박스, ₩86,700)은 즉시 가능합니다. 운영자 검토 요청합니다.",
        attachments: [],
        createdAt: { seconds: nowSec - 4 * 3600 },
      },
      {
        id: "m-5",
        authorRole: "ADMIN",
        authorId: "a1",
        authorName: "운영자 이관리",
        body: "양측 합의안 검토 중입니다.",
        attachments: [],
        createdAt: { seconds: nowSec - 2 * 3600 },
      },
    ],
    activity: [
      {
        id: "a-1",
        at: { seconds: nowSec - 8 * 3600 },
        actorId: "u1",
        actorRole: "BUYER",
        action: "OPENED",
      },
      {
        id: "a-2",
        at: { seconds: nowSec - 7 * 3600 },
        actorId: "u2",
        actorRole: "VENDOR",
        action: "MESSAGE_SENT",
      },
      {
        id: "a-3",
        at: { seconds: nowSec - 2 * 3600 },
        actorId: "a1",
        actorRole: "ADMIN",
        action: "MESSAGE_SENT",
      },
    ],
  };
}

function formatMs(seconds?: number): string {
  if (!seconds) return "—";
  return formatDateTime(seconds * 1000);
}

const ACTIVITY_LABEL: Record<string, string> = {
  OPENED: "분쟁 신청",
  MESSAGE_SENT: "메시지 발송",
  ATTACHMENT_UPLOADED: "첨부 업로드",
  STATUS_CHANGED: "상태 변경",
  RESOLVED: "분쟁 해결",
  REJECTED: "분쟁 거부",
  EVIDENCE_REQUESTED: "정보 요청",
};

const ACTOR_LABEL: Record<string, string> = {
  BUYER: "병원",
  VENDOR: "공급업체",
  ADMIN: "운영자",
  SYSTEM: "시스템",
};

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;

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
    openedAt?: { seconds?: number };
    deadlineAt?: { seconds?: number };
  };
  type MessageShape = {
    id: string;
    authorRole?: string;
    authorId?: string;
    authorName?: string;
    body?: string;
    attachments?: Array<{ name: string; size: number; url: string; mime: string }>;
    systemEvent?: string;
    createdAt?: { seconds?: number };
  };
  type ActivityShape = {
    id: string;
    at?: { seconds?: number };
    actorId?: string;
    actorRole?: string;
    action?: string;
    meta?: Record<string, unknown>;
  };

  let dispute: DisputeShape | null = null;
  let messages: MessageShape[] = [];
  let activity: ActivityShape[] = [];
  let isPreview = false;

  try {
    const trpc = await trpcServer();
    const res = await trpc.admin.dispute.getById({ disputeId });
    if (res.dispute) {
      dispute = res.dispute as DisputeShape;
      messages = res.messages as MessageShape[];
      activity = res.activity as ActivityShape[];
    } else {
      throw new Error("not-found");
    }
  } catch {
    if (PREVIEW_MODE) {
      isPreview = true;
      const fb = demoFallback(disputeId);
      dispute = fb.dispute as DisputeShape;
      messages = fb.messages as MessageShape[];
      activity = fb.activity as ActivityShape[];
    } else {
      throw new Error("분쟁을 찾을 수 없습니다.");
    }
  }

  if (!dispute) {
    return (
      <div className="px-8 py-10 md:px-12 md:py-14">
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          분쟁 list
        </Link>
        <p className="mt-12 text-sm text-[var(--color-text-secondary)]">
          분쟁을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  const status = dispute.status ?? "OPEN";
  const closed = status === "RESOLVED" || status === "REJECTED";
  const deadlineSec = dispute.deadlineAt?.seconds;
  const hoursLeft = deadlineSec
    ? Math.floor((deadlineSec * 1000 - Date.now()) / 3600000)
    : null;

  const slaTone =
    closed || hoursLeft === null
      ? "text-[var(--color-text-tertiary)]"
      : hoursLeft <= 6
        ? "text-[var(--color-error)]"
        : hoursLeft < 24
          ? "text-[var(--color-warning)]"
          : "text-[var(--color-text-tertiary)]";

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <Breadcrumb
        items={[
          { label: "운영", href: "/admin" },
          { label: "분쟁", href: "/admin/disputes" },
          { label: `#${disputeId.slice(0, 8)}` },
        ]}
      />

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Dispute · 운영자 view
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            주문 {dispute.orderId ?? "—"} — {TYPE_LABEL[dispute.type ?? "OTHER"] ?? "기타"} 분쟁
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!closed && hoursLeft !== null && (
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-3 font-mono text-xs tabular-nums ${slaTone}`}
            >
              {hoursLeft <= 6 && (
                <span
                  aria-hidden
                  className="status-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--color-error)]"
                />
              )}
              마감 {hoursLeft <= 0 ? "이탈" : `${hoursLeft}h 남음`}
            </span>
          )}
          <span
            className={`inline-flex h-7 items-center rounded-full border ${
              STATUS_BORDER[status]
            } px-3 text-xs font-medium ${STATUS_TEXT[status]}`}
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

      {/* 상단 KPI 라인 4칸 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <MetaCell label="발생일" value={formatMs(dispute.openedAt?.seconds)} mono />
        <MetaCell label="마감일" value={formatMs(dispute.deadlineAt?.seconds)} mono />
        <MetaCell
          label="분쟁 금액"
          value={formatKRW(dispute.amount)}
          mono
        />
        <MetaCell
          label="유형"
          value={TYPE_LABEL[dispute.type ?? "OTHER"] ?? "기타"}
        />
      </dl>

      {/* 2-col */}
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
        {/* 좌측 — 메시지 thread (client island) */}
        <div className="min-w-0 space-y-12">
          <DisputeThread
            disputeId={disputeId}
            initialMessages={messages}
            isPreview={isPreview}
          />
        </div>

        {/* 우측 sticky panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-10">
            {/* 분쟁 정보 */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                분쟁 정보
              </p>
              <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row
                  label="주문번호"
                  value={
                    <Link
                      href={`/admin/orders/${dispute.orderId ?? ""}`}
                      className="font-mono text-xs tabular-nums text-[var(--color-accent)] hover:underline"
                    >
                      {dispute.orderId ?? "—"}
                    </Link>
                  }
                />
                <Row label="병원" value={dispute.hospitalName ?? "—"} />
                <Row label="Vendor" value={dispute.vendorName ?? "—"} />
                <Row label="발생 시각" value={formatMs(dispute.openedAt?.seconds)} mono />
                <Row label="마감 시각" value={formatMs(dispute.deadlineAt?.seconds)} mono />
                <Row label="유형" value={TYPE_LABEL[dispute.type ?? "OTHER"] ?? "기타"} />
                <Row
                  label="분쟁 금액"
                  value={formatKRW(dispute.amount)}
                  mono
                />
              </dl>
            </div>

            {/* 중재 결정 panel (client island) — scroll anchor for mobile sticky CTA */}
            <div id="resolve-panel" className="scroll-mt-24">
              <ResolvePanel
                disputeId={disputeId}
                defaultAmount={dispute.amount ?? 0}
                hospitalName={dispute.hospitalName ?? ""}
                vendorName={dispute.vendorName ?? ""}
                isPreview={isPreview}
                resolved={closed}
              />
            </div>

            {/* 활동 history */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                활동 history
              </p>
              <ul className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                {activity.length === 0 ? (
                  <li className="px-2 py-3 text-xs text-[var(--color-text-tertiary)]">
                    기록 없음
                  </li>
                ) : (
                  activity.map((h) => (
                    <li key={h.id} className="px-2 py-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                          {formatMs(h.at?.seconds)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        <span className="text-[var(--color-text-primary)]">
                          {ACTOR_LABEL[h.actorRole ?? "SYSTEM"] ?? h.actorRole}
                        </span>{" "}
                        ·{" "}
                        {ACTIVITY_LABEL[h.action ?? ""] ?? h.action ?? "—"}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky bottom CTA — 결정 panel 으로 빠르게 스크롤 */}
      {!closed && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/95 px-4 py-3 backdrop-blur lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                중재 결정
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                {hoursLeft !== null
                  ? hoursLeft <= 0
                    ? "마감 이탈"
                    : `마감 ${hoursLeft}h 남음`
                  : STATUS_LABEL[status] ?? status}
              </p>
            </div>
            <a
              href="#resolve-panel"
              className="inline-flex h-10 shrink-0 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white hover:opacity-90"
            >
              결정하기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-3xl ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
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
