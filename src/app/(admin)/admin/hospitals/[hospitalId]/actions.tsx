"use client";

// Wave J — 병원 상세 운영자 액션 + 메모 ledger client island.
//
// 운영자 액션 4개 (suspend/reactivate, addMemo, sendAlimtalk, updateApprovalRule)
// + 메모 ledger 표시 (서버 fetch 결과를 prop 으로 받음).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, ShieldX, ShieldCheck, MessageSquarePlus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

type ActionKind = "suspend" | "reactivate" | "memo" | "alimtalk" | "approval";

const ALIMTALK_TEMPLATES: Array<{ value: string; label: string }> = [
  { value: "HOSPITAL_REACTIVATION_INVITE", label: "재활성 안내 — RE_ACTIVATE" },
  { value: "HOSPITAL_SUBSCRIPTION_GUIDE", label: "정기구독 안내 — SUBSCRIPTION_GUIDE" },
  { value: "HOSPITAL_APPROVAL_LIMIT", label: "결재 한도 변경 — APPROVAL_LIMIT" },
  { value: "HOSPITAL_CUSTOM", label: "직접 작성 — CUSTOM" },
];

type Memo = {
  id: string;
  body?: string;
  actorId?: string;
  createdAt?: unknown;
};

export function HospitalActionsPanel({
  hospitalId,
  currentStatus,
  approvalEnabled,
  approvalLimit,
}: {
  hospitalId: string;
  currentStatus: "ACTIVE" | "SUSPENDED";
  approvalEnabled: boolean;
  approvalLimit?: number | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [memoBody, setMemoBody] = useState("");
  const [alimtalkTemplate, setAlimtalkTemplate] = useState(
    ALIMTALK_TEMPLATES[0]?.value ?? "HOSPITAL_CUSTOM",
  );
  const [alimtalkTitle, setAlimtalkTitle] = useState("");
  const [alimtalkBody, setAlimtalkBody] = useState("");
  const [approvalOn, setApprovalOn] = useState(approvalEnabled);
  const [limit, setLimit] = useState(approvalLimit ? String(approvalLimit) : "");
  const [error, setError] = useState<string | null>(null);

  const suspend = trpc.admin.hospital.suspend.useMutation();
  const reactivate = trpc.admin.hospital.reactivate.useMutation();
  const addMemo = trpc.admin.hospital.addMemo.useMutation();
  const sendAlimtalk = trpc.admin.hospital.sendAlimtalk.useMutation();
  const updateApprovalRule = trpc.admin.hospital.updateApprovalRule.useMutation();

  function close() {
    setActive(null);
    setReason("");
    setMemoBody("");
    setAlimtalkTitle("");
    setAlimtalkBody("");
    setError(null);
  }

  const pending =
    suspend.isPending ||
    reactivate.isPending ||
    addMemo.isPending ||
    sendAlimtalk.isPending ||
    updateApprovalRule.isPending;

  async function confirm() {
    if (!active) return;
    setError(null);
    try {
      if (active === "suspend") {
        if (reason.trim().length === 0) {
          setError("정지 사유를 입력해주세요.");
          return;
        }
        await suspend.mutateAsync({ hospitalId, reason: reason.trim() });
        toast.success("병원을 일시정지했습니다");
      } else if (active === "reactivate") {
        await reactivate.mutateAsync({ hospitalId });
        toast.success("병원을 재활성화했습니다");
      } else if (active === "memo") {
        if (memoBody.trim().length === 0) {
          setError("메모 내용을 입력해주세요.");
          return;
        }
        await addMemo.mutateAsync({
          hospitalId,
          body: memoBody.trim(),
        });
        toast.success("메모를 추가했습니다");
      } else if (active === "alimtalk") {
        if (alimtalkTitle.trim().length === 0 || alimtalkBody.trim().length === 0) {
          setError("제목과 본문을 모두 입력해주세요.");
          return;
        }
        await sendAlimtalk.mutateAsync({
          hospitalId,
          template: alimtalkTemplate,
          title: alimtalkTitle.trim(),
          body: alimtalkBody.trim(),
        });
        toast.success("알림톡 발송을 요청했습니다");
      } else if (active === "approval") {
        const limitNum = limit.trim() ? Number(limit.replace(/[^0-9]/g, "")) : undefined;
        if (limit.trim() && (Number.isNaN(limitNum) || (limitNum ?? 0) < 0)) {
          setError("유효한 결재 한도를 입력해주세요.");
          return;
        }
        await updateApprovalRule.mutateAsync({
          hospitalId,
          approvalEnabled: approvalOn,
          approvalLimit: limitNum,
        });
        toast.success("결재 규칙을 업데이트했습니다");
      }
      close();
      router.refresh();
    } catch (err) {
      const e2 = err as { message?: string };
      const msg = e2.message ?? "처리에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  const isSuspended = currentStatus === "SUSPENDED";

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        운영자 액션
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {isSuspended ? (
          <button
            type="button"
            onClick={() => setActive("reactivate")}
            disabled={pending}
            className="inline-flex h-11 items-center justify-between gap-2 rounded-full border border-[var(--color-success)] px-5 text-sm font-medium text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/5 disabled:opacity-40"
          >
            <span>정지 해제</span>
            <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setActive("suspend")}
            disabled={pending}
            className="inline-flex h-11 items-center justify-between gap-2 rounded-full border border-[var(--color-border-light)] px-5 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5 disabled:opacity-40"
          >
            <span>일시 정지</span>
            <ShieldX className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setActive("memo")}
          disabled={pending}
          className="inline-flex h-11 items-center justify-between gap-2 rounded-full border border-[var(--color-border-default)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
        >
          <span>메모 추가</span>
          <MessageSquarePlus className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => setActive("alimtalk")}
          disabled={pending}
          className="inline-flex h-11 items-center justify-between gap-2 rounded-full border border-[var(--color-accent)] px-5 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/5 disabled:opacity-40"
        >
          <span>알림톡 발송</span>
          <Send className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => setActive("approval")}
          disabled={pending}
          className="inline-flex h-11 items-center justify-between gap-2 rounded-full border border-[var(--color-border-light)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
        >
          <span>결재 규칙 편집</span>
          <Settings2 className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>

      <Dialog open={active !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {active === "suspend" && (
            <>
              <DialogHeader>
                <DialogTitle>병원 계정 일시 정지</DialogTitle>
                <DialogDescription>
                  모든 팀원이 즉시 로그아웃되며 진행 중인 주문은 그대로 유지됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">정지 사유 (필수)</Label>
                <Textarea
                  id="suspend-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="사용자에게 그대로 전달됩니다."
                />
              </div>
            </>
          )}

          {active === "reactivate" && (
            <>
              <DialogHeader>
                <DialogTitle>정지 해제</DialogTitle>
                <DialogDescription>
                  병원이 다시 정상 이용 가능 상태로 전환됩니다.
                </DialogDescription>
              </DialogHeader>
            </>
          )}

          {active === "memo" && (
            <>
              <DialogHeader>
                <DialogTitle>운영자 메모 추가</DialogTitle>
                <DialogDescription>
                  병원 프로필 ledger 에 기록되며 모든 운영자가 열람할 수 있습니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="memo-body">메모 내용</Label>
                <Textarea
                  id="memo-body"
                  value={memoBody}
                  onChange={(e) => setMemoBody(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="내부 공유용. 사용자에게 노출되지 않습니다."
                />
                <span className="block text-[11px] text-[var(--color-text-tertiary)]">
                  {memoBody.length} / 1000
                </span>
              </div>
            </>
          )}

          {active === "alimtalk" && (
            <>
              <DialogHeader>
                <DialogTitle>알림톡 발송</DialogTitle>
                <DialogDescription>
                  사전 심사 통과한 템플릿 중에서 선택할 수 있습니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block text-xs text-[var(--color-text-tertiary)]">
                  템플릿
                  <select
                    value={alimtalkTemplate}
                    onChange={(e) => setAlimtalkTemplate(e.target.value)}
                    className="mt-1 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    {ALIMTALK_TEMPLATES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="alimtalk-title">제목</Label>
                  <input
                    id="alimtalk-title"
                    type="text"
                    value={alimtalkTitle}
                    onChange={(e) => setAlimtalkTitle(e.target.value)}
                    maxLength={60}
                    placeholder="알림 제목"
                    className="h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alimtalk-body">본문</Label>
                  <Textarea
                    id="alimtalk-body"
                    value={alimtalkBody}
                    onChange={(e) => setAlimtalkBody(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="알림톡 본문 (치환 변수 포함 가능)"
                  />
                </div>
              </div>
            </>
          )}

          {active === "approval" && (
            <>
              <DialogHeader>
                <DialogTitle>결재 규칙 편집</DialogTitle>
                <DialogDescription>
                  결재 활성화 여부와 한도를 변경합니다. 다음 결재일부터 적용됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={approvalOn}
                    onChange={(e) => setApprovalOn(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span>결재 워크플로우 활성화</span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="approval-limit">결재 한도 (원)</Label>
                  <input
                    id="approval-limit"
                    type="text"
                    inputMode="numeric"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="예: 5000000"
                    disabled={!approvalOn}
                    className="h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 font-mono text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <p
              className="error-slide-down border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2 text-sm text-[var(--color-error)]"
              role="alert"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={`inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50 ${
                active === "suspend"
                  ? "bg-[var(--color-error)] hover:opacity-90"
                  : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
              }`}
            >
              {pending ? "처리 중…" : "확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HospitalMemoList — 우측 sticky 메모 ledger 표시 (read-only).
// ─────────────────────────────────────────────────────────────

export function HospitalMemoList({ memos }: { memos: Memo[] }) {
  if (memos.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          운영자 메모
        </p>
        <p className="mt-3 border-y border-[var(--color-border-light)] py-6 text-center text-xs text-[var(--color-text-tertiary)]">
          등록된 메모가 없습니다
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        운영자 메모
      </p>
      <ul className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        {memos.slice(0, 5).map((m) => (
          <li key={m.id} className="py-3">
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
              {m.body}
            </p>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {formatTs(m.createdAt)}
              {m.actorId && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono">{m.actorId.slice(0, 8)}</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {memos.length > 5 && (
        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
          +{memos.length - 5}건 더 있음
        </p>
      )}
    </div>
  );
}

function formatTs(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  const w1 = ts as { toDate?: () => Date };
  if (typeof w1.toDate === "function") {
    try {
      return w1.toDate().toLocaleString("ko-KR");
    } catch {
      /* fallthrough */
    }
  }
  const w2 = ts as { seconds?: number; _seconds?: number };
  const sec = w2.seconds ?? w2._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toLocaleString("ko-KR");
  }
  return "";
}
