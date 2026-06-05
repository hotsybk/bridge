"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Timestamp } from "firebase/firestore";

import { trpc } from "@/lib/trpc/client";

/**
 * Phase ν-3 작업4 — 결재 대기 큐 (/account/approvals).
 *
 * - 본인이 결재해야 할 주문 list (PENDING)
 * - 본인 처리 이력 (APPROVED / REJECTED)
 * - 각 row: 주문번호 · 신청자 · 금액 · 단계 · 액션
 */

function tsToDateStr(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const w = ts as {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().toISOString().slice(0, 16).replace("T", " ");
    } catch {
      // fallthrough
    }
  }
  const sec = w.seconds ?? w._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toISOString().slice(0, 16).replace("T", " ");
  }
  return "—";
}

function fmtKrw(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function ApprovalsPage() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"PENDING" | "HISTORY">("PENDING");

  const { data: pending, isLoading: pendingLoading } =
    trpc.hospital.approval.listPending.useQuery(undefined, {
      enabled: tab === "PENDING",
    });
  const { data: history, isLoading: historyLoading } =
    trpc.hospital.approval.listMyHistory.useQuery(
      { pageSize: 50 },
      { enabled: tab === "HISTORY" },
    );

  const approve = trpc.hospital.approval.approve.useMutation({
    onSuccess: async () => {
      toast.success("승인되었습니다.");
      await utils.hospital.approval.listPending.invalidate();
      await utils.hospital.approval.listMyHistory.invalidate();
    },
  });
  const reject = trpc.hospital.approval.reject.useMutation({
    onSuccess: async () => {
      toast.success("반려되었습니다.");
      await utils.hospital.approval.listPending.invalidate();
      await utils.hospital.approval.listMyHistory.invalidate();
    },
  });

  return (
    <div className="space-y-12">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
          결재 대기
        </h2>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {tab === "PENDING"
            ? `대기 ${pending?.length ?? 0}건`
            : `이력 ${history?.length ?? 0}건`}
        </p>
      </header>

      {/* Tab strip */}
      <nav
        aria-label="결재 탭"
        className="-mx-6 border-b border-[var(--color-border-light)] md:-mx-12"
      >
        <ul className="flex items-stretch px-6 md:px-12">
          {(
            [
              { key: "PENDING", label: "대기 중" },
              { key: "HISTORY", label: "처리 이력" },
            ] as const
          ).map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-5 py-3 text-sm transition-colors ${
                  tab === t.key
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "PENDING" && (
        <section>
          {pendingLoading && (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              불러오는 중…
            </p>
          )}
          {!pendingLoading && (pending?.length ?? 0) === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                결재할 주문이 없습니다.
              </p>
            </div>
          )}
          {!pendingLoading && (pending?.length ?? 0) > 0 && (
            <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {(pending ?? []).map((o) => (
                <ApprovalRow
                  key={o.id}
                  row={o}
                  onApprove={(comment) =>
                    approve.mutate({ orderId: o.id, comment })
                  }
                  onReject={(reason) =>
                    reject.mutate({ orderId: o.id, reason })
                  }
                  pending={approve.isPending || reject.isPending}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "HISTORY" && (
        <section>
          {historyLoading && (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              불러오는 중…
            </p>
          )}
          {!historyLoading && (history?.length ?? 0) === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                처리한 결재가 없습니다.
              </p>
            </div>
          )}
          {!historyLoading && (history?.length ?? 0) > 0 && (
            <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              {(history ?? []).map((h) => (
                <li
                  key={h.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-6 py-5 md:grid-cols-[1fr_140px_140px_140px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {h.orderNo}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {h.applicantName}
                    </p>
                  </div>
                  <p className="text-right font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
                    {fmtKrw(h.finalAmount)}
                  </p>
                  <p
                    className={`text-right text-xs uppercase tracking-[0.15em] ${
                      h.myAction === "APPROVED"
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-error)]"
                    }`}
                  >
                    {h.myAction === "APPROVED" ? "승인" : "반려"}
                  </p>
                  <p className="text-right text-xs text-[var(--color-text-tertiary)]">
                    {tsToDateStr(h.actedAt as unknown as Timestamp)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

type PendingRow = {
  id: string;
  orderNo: string;
  applicantName: string;
  finalAmount: number;
  currentLevel: number;
  chainLength: number;
  vendorCount: number;
  createdAt: unknown;
};

function ApprovalRow({
  row,
  onApprove,
  onReject,
  pending,
}: {
  row: PendingRow;
  onApprove: (comment: string) => void;
  onReject: (reason: string) => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");

  return (
    <li className="py-5">
      <div className="grid grid-cols-[1fr_auto] items-center gap-6 md:grid-cols-[1fr_140px_120px_180px]">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
            {row.orderNo}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
            {row.applicantName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            공급업체 {row.vendorCount}곳 · 단계 {row.currentLevel} /{" "}
            {row.chainLength} · {tsToDateStr(row.createdAt)}
          </p>
        </div>
        <p className="text-right font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
          {fmtKrw(row.finalAmount)}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-[var(--color-text-secondary)] underline-offset-2 hover:text-[var(--color-text-primary)] hover:underline"
        >
          {expanded ? "접기" : "상세"}
        </button>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onApprove(comment)}
            className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 text-xs font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            disabled={pending || reason.trim().length < 1}
            onClick={() => onReject(reason.trim())}
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--color-error)] px-5 text-xs font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)] hover:text-white disabled:opacity-40"
          >
            반려
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 grid gap-4 border-l-2 border-[var(--color-border-light)] pl-6 md:grid-cols-2">
          <div>
            <label className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              승인 메모 (선택)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="추가 의견을 남길 수 있습니다."
              className="mt-2 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              반려 사유 (필수)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="반려 시 사유를 작성해주세요."
              className="mt-2 w-full resize-none border-b border-[var(--color-border-light)] bg-transparent py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <a
              href={`/orders/${row.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-accent)] underline-offset-2 hover:underline"
            >
              주문 상세 새 창에서 열기 →
            </a>
          </div>
        </div>
      )}
    </li>
  );
}
