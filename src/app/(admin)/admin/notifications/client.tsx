"use client";

// Wave O — 운영자 알림 발송 client island.
// 발송 이력 + bulkSend + retry mutation.

import { useMemo, useState } from "react";
import { ChevronDown, RefreshCcw } from "lucide-react";

import { AdminKpiCell } from "@/components/admin/admin-kpi-cell";
import { CountUp } from "@/components/shared/count-up";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

export type NotificationRow = {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  targetType?: "HOSPITAL" | "VENDOR" | "USER";
  targetId?: string;
  isBulk?: boolean;
  kakaoSent?: boolean;
  emailSent?: boolean;
  errorReason?: string | null;
  createdAt?: { _seconds?: number; seconds?: number } | null;
};

export type SolapiStatus = {
  balance: number;
  currency: string;
  dailyLimit: number;
  dailyUsed: number;
  status: "MOCK" | "OK" | string;
};

const TEMPLATES: Array<{ value: string; label: string }> = [
  { value: "HOSPITAL_NOTICE", label: "병원 공지" },
  { value: "VENDOR_NOTICE", label: "공급업체 공지" },
  { value: "ORDER_NEW", label: "주문 접수" },
  { value: "ORDER_SHIPPED", label: "주문 배송" },
  { value: "ORDER_REFUNDED", label: "환불 완료" },
  { value: "VENDOR_APPROVED", label: "공급업체 승인" },
  { value: "VENDOR_REJECTED", label: "공급업체 반려" },
  { value: "VENDOR_SUSPENDED", label: "공급업체 정지" },
  { value: "VENDOR_REOPENED", label: "공급업체 재개" },
  { value: "PRODUCT_APPROVED", label: "상품 승인" },
  { value: "PRODUCT_REJECTED", label: "상품 반려" },
  { value: "PRODUCT_REVISION", label: "상품 수정 요청" },
  { value: "DISPUTE_OPENED", label: "분쟁 접수" },
  { value: "DISPUTE_RESOLVED", label: "분쟁 종결" },
  { value: "GROUPBUY_FULFILLED", label: "공동구매 성사" },
  { value: "GROUPBUY_FAILED", label: "공동구매 미달" },
  { value: "SETTLEMENT_APPROVED", label: "정산 승인" },
  { value: "SETTLEMENT_PAID", label: "정산 지급" },
];

const SEGMENTS: Array<{ value: string; label: string }> = [
  { value: "ALL_HOSPITALS", label: "전체 병원" },
  { value: "ACTIVE_HOSPITALS_30D", label: "활성 병원 (30일)" },
  { value: "INACTIVE_HOSPITALS_90D", label: "휴면 병원 (90일+)" },
  { value: "ALL_VENDORS", label: "전체 공급업체" },
  { value: "APPROVED_VENDORS", label: "승인된 공급업체" },
];

function tsToString(ts: NotificationRow["createdAt"]): string {
  if (!ts) return "—";
  const sec = ts._seconds ?? ts.seconds;
  if (typeof sec !== "number") return "—";
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function statusOf(n: NotificationRow): "성공" | "대기" | "실패" {
  if (n.kakaoSent || n.emailSent) return "성공";
  if (n.errorReason) return "실패";
  return "대기";
}

export function NotificationsClient({
  notifications,
  counts,
  solapiStatus,
  isPreview,
}: {
  notifications: NotificationRow[];
  counts: {
    monthlySent: number;
    successRate: number;
    failedCount: number;
    activeTemplates: number;
  };
  solapiStatus: SolapiStatus;
  isPreview?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "scheduled">("now");
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [segment, setSegment] = useState(SEGMENTS[0].value);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const bulkSend = trpc.admin.notifications.bulkSend.useMutation({
    onSuccess: (data) => {
      setSuccessMsg(`${data.queued}건 발송 큐 등록 완료`);
      setErrorMsg(null);
      setComposeOpen(false);
      setTitle("");
      setBody("");
      setScheduledAt("");
      utils.admin.notifications.list.invalidate();
      utils.admin.notifications.counts.invalidate();
    },
    onError: (e) => {
      setErrorMsg(e.message);
      setSuccessMsg(null);
    },
  });

  const retry = trpc.admin.notifications.retry.useMutation({
    onSuccess: () => {
      setSuccessMsg("재시도 큐 등록 완료");
      setErrorMsg(null);
      utils.admin.notifications.list.invalidate();
    },
    onError: (e) => setErrorMsg(e.message),
  });

  const failedCount = useMemo(
    () => notifications.filter((n) => statusOf(n) === "실패").length,
    [notifications],
  );

  function handleSend() {
    setErrorMsg(null);
    if (!title.trim() || !body.trim()) {
      setErrorMsg("제목과 본문을 입력하세요.");
      return;
    }
    bulkSend.mutate({
      template: template as Parameters<typeof bulkSend.mutate>[0]["template"],
      title: title.trim(),
      body: body.trim(),
      segment: segment as Parameters<typeof bulkSend.mutate>[0]["segment"],
      scheduledAt:
        scheduleMode === "scheduled" && scheduledAt
          ? new Date(scheduledAt)
          : undefined,
    });
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="시스템 · 알림 발송"
        title="알림톡 발송"
        description={
          isPreview
            ? "사전 심사 템플릿 일괄 발송 (PREVIEW — 로그인 후 실 데이터 노출)"
            : "사전 심사 템플릿 일괄 발송"
        }
      >
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          + 새 발송
        </button>
      </PageHeader>

      {(successMsg || errorMsg) && (
        <p
          className={`mt-6 text-xs ${
            errorMsg
              ? "text-[var(--color-error)]"
              : "text-[var(--color-success)]"
          }`}
        >
          {errorMsg ?? successMsg}
        </p>
      )}

      {/* KPI 4 */}
      <dl className="mt-10 grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-y border-[var(--color-border-light)] md:grid-cols-4">
        <AdminKpiCell
          label="이번달 발송량"
          value={<CountUp value={counts.monthlySent} />}
          sub="건"
        />
        <AdminKpiCell
          label="성공률"
          value={<CountUp value={counts.successRate} integer={false} />}
          sub="%"
          delta={counts.successRate >= 95 ? "정상" : "주의"}
          deltaColor={counts.successRate >= 95 ? "success" : "warning"}
        />
        <AdminKpiCell
          label="실패"
          value={<CountUp value={counts.failedCount} />}
          sub="건"
          delta={counts.failedCount > 0 ? "재시도 권장" : "정상"}
          deltaColor={counts.failedCount > 0 ? "error" : "success"}
        />
        <AdminKpiCell
          label="활성 템플릿"
          value={<CountUp value={counts.activeTemplates} />}
          sub="개"
        />
      </dl>

      {/* 2-col */}
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
        <div className="min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              최근 발송 이력
            </p>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {notifications.length}건 · 실패 {failedCount}건
            </span>
          </div>
          <div className="mt-4 border-y border-[var(--color-border-light)]">
            <div className="grid grid-cols-[140px_1fr_120px_100px_80px_60px] gap-3 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              <span>발송일</span>
              <span>제목 / 본문</span>
              <span>대상</span>
              <span>유형</span>
              <span>상태</span>
              <span />
            </div>
            {notifications.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
                발송 이력이 없습니다
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-light)]">
                {notifications.map((n) => {
                  const isOpen = open === n.id;
                  const status = statusOf(n);
                  const statusColor =
                    status === "성공"
                      ? "text-[var(--color-success)]"
                      : status === "실패"
                        ? "text-[var(--color-error)]"
                        : "text-[var(--color-warning)]";
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : n.id)}
                        className="grid w-full grid-cols-[140px_1fr_120px_100px_80px_60px] items-center gap-3 px-2 py-3.5 text-left text-sm hover:bg-[var(--color-bg-secondary)]/40"
                      >
                        <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                          {tsToString(n.createdAt)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {n.title ?? "(제목 없음)"}
                          </span>
                          {n.body && (
                            <span className="block truncate text-xs text-[var(--color-text-tertiary)]">
                              {n.body}
                            </span>
                          )}
                        </span>
                        <span className="truncate text-xs text-[var(--color-text-secondary)]">
                          {n.targetType ?? "—"}
                          {n.isBulk && " · 일괄"}
                        </span>
                        <span className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                          {n.type ?? "—"}
                        </span>
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {status}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 text-[var(--color-text-tertiary)] transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="bg-[var(--color-bg-secondary)]/40 px-4 py-3">
                          <pre className="overflow-x-auto font-mono text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                            {JSON.stringify(
                              {
                                id: n.id,
                                type: n.type,
                                targetType: n.targetType,
                                targetId: n.targetId,
                                kakaoSent: n.kakaoSent,
                                emailSent: n.emailSent,
                                errorReason: n.errorReason,
                              },
                              null,
                              2,
                            )}
                          </pre>
                          {status === "실패" && (
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  retry.mutate({ notificationId: n.id })
                                }
                                disabled={retry.isPending}
                                className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 disabled:opacity-50"
                              >
                                <RefreshCcw className="h-3 w-3" />
                                재시도
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Sticky right panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-10">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                Solapi 상태
              </p>
              <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <PanelRow
                  label="잔액"
                  value={`₩${solapiStatus.balance.toLocaleString()}`}
                  mono
                />
                <PanelRow
                  label="일일 한도"
                  value={`${solapiStatus.dailyLimit.toLocaleString()}건`}
                  mono
                />
                <PanelRow
                  label="오늘 발송"
                  value={`${solapiStatus.dailyUsed.toLocaleString()}건`}
                  mono
                />
                <PanelRow
                  label="계정 상태"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${
                          solapiStatus.status === "OK"
                            ? "bg-[var(--color-success)]"
                            : "bg-[var(--color-text-tertiary)]"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          solapiStatus.status === "OK"
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {solapiStatus.status === "OK"
                          ? "정상"
                          : solapiStatus.status === "MOCK"
                            ? "MOCK (env 미설정)"
                            : solapiStatus.status}
                      </span>
                    </span>
                  }
                />
              </dl>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                사용 정책
              </p>
              <ul className="mt-3 space-y-2 text-xs text-[var(--color-text-secondary)]">
                <li>· 1회 1,000건 한도 (Firestore batch)</li>
                <li>· 사전 심사된 템플릿만 발송 가능</li>
                <li>· 발송 후 취소 불가</li>
                <li>· 비용은 매월 1일 정산</li>
                <li>· 수신 거부자는 자동 제외</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <button type="button" hidden aria-hidden />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 알림톡 발송</DialogTitle>
            <DialogDescription>
              사전 심사된 템플릿과 대상 segment를 선택하면 즉시 발송 또는 예약됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <LineField label="템플릿">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="h-8 bg-transparent text-sm focus:outline-none"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </LineField>
            <LineField label="대상 segment">
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="h-8 bg-transparent text-sm focus:outline-none"
              >
                {SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </LineField>
            <div className="border-y border-[var(--color-border-light)] py-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">제목</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="예: 6월 운영 정책 안내"
                className="mt-1 h-7 w-full bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
            </div>
            <div className="border-y border-[var(--color-border-light)] py-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">본문</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="알림톡 본문을 입력하세요"
                className="mt-1 w-full resize-none bg-transparent text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
              <p className="mt-1 text-right text-[11px] text-[var(--color-text-tertiary)]">
                {body.length}/1000
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs text-[var(--color-text-tertiary)]">
                발송 시각
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="when"
                  checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")}
                  className="accent-[var(--color-accent)]"
                />
                즉시 발송
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="when"
                  checked={scheduleMode === "scheduled"}
                  onChange={() => setScheduleMode("scheduled")}
                  className="accent-[var(--color-accent)]"
                />
                예약 발송
                {scheduleMode === "scheduled" && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="ml-2 h-7 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs focus:outline-none"
                  />
                )}
              </label>
            </fieldset>
            {errorMsg && (
              <p className="text-xs text-[var(--color-error)]">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              disabled={bulkSend.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={bulkSend.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {bulkSend.isPending
                ? "발송 중..."
                : scheduleMode === "now"
                  ? "즉시 발송"
                  : "예약 등록"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// subcomponents
// ─────────────────────────────────────────────────────────────

function PanelRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 px-2 py-2.5">
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

function LineField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-light)] py-2">
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      {children}
    </div>
  );
}
