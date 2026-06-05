"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Timestamp } from "firebase/firestore";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { trpc } from "@/lib/trpc/client";

/**
 * Phase ν-3 작업3 — 병원 팀원 관리 + 결재 워크플로우 (/account/team).
 *
 * - 결재 워크플로우 활성화 토글 + 최소 금액 + 결재자 체인 설정
 * - 멤버 list + 초대 + role 변경 + 결재자 지정
 *
 * 디자인: 박스 없음. 섹션 H2 + divide-y 행.
 */

const ROLE_LABEL: Record<string, string> = {
  BUYER_OWNER: "소유자",
  BUYER_ADMIN: "관리자",
  BUYER_STAFF: "구매팀원",
  BUYER_VIEWER: "조회 전용",
};

const ROLE_OPTIONS = [
  { value: "BUYER_OWNER", label: "소유자 · 전체 권한" },
  { value: "BUYER_STAFF", label: "구매팀원 · 주문·구독 운영" },
  { value: "BUYER_VIEWER", label: "조회 전용 · 조회만" },
] as const;

function tsToDateStr(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const w = ts as {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  if (typeof w.toDate === "function") {
    try {
      return w.toDate().toISOString().slice(0, 10);
    } catch {
      // fallthrough
    }
  }
  const sec = w.seconds ?? w._seconds;
  if (typeof sec === "number") {
    return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  return "—";
}

function fmtKrw(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function HospitalTeamPage() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.hospital.staff.list.useQuery();
  const { data: settings } = trpc.hospital.settings.getSettings.useQuery();

  const members = list?.members ?? [];
  const invites = list?.invites ?? [];

  // 결재 설정 form
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalLimit, setApprovalLimit] = useState(100000);
  const [chain, setChain] = useState<Array<{ level: number; userId: string }>>([]);

  useEffect(() => {
    if (!settings) return;
    setApprovalEnabled(Boolean(settings.approvalEnabled));
    if (typeof settings.approvalLimit === "number")
      setApprovalLimit(settings.approvalLimit);
    setChain(settings.approvalChain ?? []);
  }, [settings]);

  // 초대 form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<(typeof ROLE_OPTIONS)[number]["value"]>("BUYER_STAFF");
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    label: string;
  } | null>(null);

  const invite = trpc.hospital.staff.invite.useMutation({
    onSuccess: async () => {
      toast.success("초대장을 발송했습니다.");
      setInviteEmail("");
      await utils.hospital.staff.list.invalidate();
    },
  });
  const cancelInvite = trpc.hospital.staff.cancelInvite.useMutation({
    onSuccess: async () => {
      toast.success("초대를 취소했습니다.");
      await utils.hospital.staff.list.invalidate();
    },
  });
  const updateRole = trpc.hospital.staff.updateRole.useMutation({
    onSuccess: async () => {
      toast.success("역할이 변경되었습니다.");
      await utils.hospital.staff.list.invalidate();
    },
  });
  const remove = trpc.hospital.staff.remove.useMutation({
    onSuccess: async () => {
      toast.success("멤버를 제거했습니다.");
      await utils.hospital.staff.list.invalidate();
    },
  });
  const setApprover = trpc.hospital.staff.setApprover.useMutation({
    onSuccess: async () => {
      toast.success("결재자 권한이 변경되었습니다.");
      await utils.hospital.staff.list.invalidate();
    },
  });
  const updateSettings = trpc.hospital.settings.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("결재 설정을 저장했습니다.");
      await utils.hospital.settings.getSettings.invalidate();
    },
  });

  // OWNER 여부 — 현재 사용자가 BUYER_OWNER 인지 메타 확인.
  // settings.updateSettings 가 OWNER 만 허용하므로 서버 가드만 사용해도 되지만
  // UI 차원에서도 비활성 처리.
  const meIsOwner = useMemo(() => {
    // 실제 본인 uid 를 알 수 없으므로 invitedBy 등으로 추정 불가 — 일단 항상 활성.
    // 서버에서 가드. UI 는 buttons disable 없이 표시.
    return true;
  }, []);

  const approvers = members.filter((m) => m.isApprover);

  return (
    <div className="space-y-20">
      <section>
        <SectionHeader title="결재 워크플로우" />
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          일정 금액 이상의 주문은 결재자 승인 후 결제할 수 있습니다. 결재자는
          멤버를 결재자로 지정한 뒤 결재 체인에 추가할 수 있습니다.
        </p>

        <dl className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <div className="grid gap-3 py-5 md:grid-cols-[200px_1fr] md:items-center md:gap-6">
            <dt className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              결재 활성화
            </dt>
            <dd>
              <button
                type="button"
                role="switch"
                aria-checked={approvalEnabled}
                onClick={() => setApprovalEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
                  approvalEnabled
                    ? "bg-[var(--color-accent)]"
                    : "bg-[var(--color-border-default)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow-sm transition-transform ${
                    approvalEnabled ? "translate-x-[22px]" : "translate-x-1"
                  }`}
                />
              </button>
            </dd>
          </div>
          <div className="grid gap-3 py-5 md:grid-cols-[200px_1fr] md:items-center md:gap-6">
            <dt className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              결재 필요 금액
            </dt>
            <dd className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                step={10000}
                value={approvalLimit}
                onChange={(e) =>
                  setApprovalLimit(Math.max(0, Number(e.target.value) || 0))
                }
                disabled={!approvalEnabled}
                className="h-9 w-40 border-b border-[var(--color-border-light)] bg-transparent text-right font-mono tabular-nums outline-none transition-colors focus:border-[var(--color-accent)] disabled:opacity-40"
              />
              <span className="text-[var(--color-text-secondary)]">원 이상</span>
            </dd>
          </div>
          <div className="grid gap-3 py-5 md:grid-cols-[200px_1fr] md:items-start md:gap-6">
            <dt className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] md:pt-2">
              결재 체인
            </dt>
            <dd className="space-y-3">
              {chain.length === 0 && (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  아직 결재자가 지정되지 않았습니다.
                </p>
              )}
              {chain.map((node, idx) => {
                const m = members.find((x) => x.userId === node.userId);
                return (
                  <div
                    key={`${node.level}-${node.userId}`}
                    className="flex items-center gap-3"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[11px] font-medium tabular-nums text-[var(--color-accent)]">
                      {node.level}
                    </span>
                    <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                      {m?.name || m?.email || node.userId}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setChain(chain.filter((_, i) => i !== idx))
                      }
                      disabled={!approvalEnabled}
                      className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-error)] hover:underline disabled:opacity-40"
                    >
                      제거
                    </button>
                  </div>
                );
              })}
              {approvers.length > 0 && (
                <div className="pt-3">
                  <label className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                    결재자 추가
                  </label>
                  <select
                    onChange={(e) => {
                      const userId = e.target.value;
                      if (!userId) return;
                      if (chain.find((c) => c.userId === userId)) return;
                      const nextLevel = (chain[chain.length - 1]?.level ?? 0) + 1;
                      setChain([...chain, { level: nextLevel, userId }]);
                      e.currentTarget.value = "";
                    }}
                    disabled={!approvalEnabled}
                    className="mt-2 h-9 w-full max-w-md border-b border-[var(--color-border-light)] bg-transparent text-sm outline-none transition-colors focus:border-[var(--color-accent)] disabled:opacity-40"
                    defaultValue=""
                  >
                    <option value="">— 멤버 선택 —</option>
                    {approvers
                      .filter((m) => !chain.find((c) => c.userId === m.userId))
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name || m.email}
                          {m.approvalLimit
                            ? ` (한도 ${fmtKrw(m.approvalLimit)})`
                            : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {approvers.length === 0 && (
                <p className="pt-3 text-xs text-[var(--color-warning)]">
                  먼저 아래에서 멤버를 결재자로 지정해주세요.
                </p>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={updateSettings.isPending}
            onClick={() =>
              updateSettings.mutate({
                approvalEnabled,
                approvalLimit,
                approvalChain: chain,
              })
            }
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
          >
            {updateSettings.isPending ? "저장 중…" : "결재 설정 저장"}
          </button>
        </div>
      </section>

      {/* 초대 */}
      <section>
        <SectionHeader title="새 멤버 초대" />
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          초대장은 이메일로 발송되며 7일간 유효합니다.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <input
            type="email"
            placeholder="member@hospital.kr"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="h-12 w-full border-b border-[var(--color-border-light)] bg-transparent px-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
          />
          <select
            value={inviteRole}
            onChange={(e) =>
              setInviteRole(
                e.target.value as (typeof ROLE_OPTIONS)[number]["value"],
              )
            }
            className="h-12 w-full border-b border-[var(--color-border-light)] bg-transparent px-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              invite.isPending ||
              !inviteEmail ||
              !/.+@.+\..+/.test(inviteEmail)
            }
            onClick={() =>
              invite.mutate({ email: inviteEmail, role: inviteRole })
            }
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-8 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
          >
            {invite.isPending ? "발송 중…" : "초대장 발송"}
          </button>
        </div>
      </section>

      {/* 멤버 list */}
      <section>
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
            현재 멤버
          </h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            총 {members.length}명 · 결재자 {approvers.length}명
          </p>
        </header>
        {isLoading && (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            불러오는 중…
          </p>
        )}
        {!isLoading && members.length === 0 && (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            아직 멤버가 없습니다.
          </p>
        )}
        {!isLoading && members.length > 0 && (
          <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {members.map((m) => (
              <li key={m.userId} className="py-5">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {m.name || "—"}
                      {m.isApprover && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-accent)]">
                          결재자
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                      {m.email} · {ROLE_LABEL[m.role] ?? m.role} · 가입{" "}
                      {tsToDateStr(m.joinedAt as unknown as Timestamp)}
                    </p>
                    {m.isApprover && typeof m.approvalLimit === "number" && (
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        결재 한도 {fmtKrw(m.approvalLimit)} 원
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {meIsOwner && (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) =>
                            updateRole.mutate({
                              userId: m.userId,
                              role: e.target.value as
                                | "BUYER_OWNER"
                                | "BUYER_STAFF"
                                | "BUYER_VIEWER",
                            })
                          }
                          disabled={updateRole.isPending}
                          className="h-9 border-b border-[var(--color-border-light)] bg-transparent text-xs outline-none transition-colors focus:border-[var(--color-accent)]"
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {ROLE_LABEL[o.value]}
                            </option>
                          ))}
                        </select>
                        <ApproverToggle
                          memberId={m.userId}
                          isApprover={m.isApprover}
                          currentLimit={m.approvalLimit ?? null}
                          onSet={(payload) =>
                            setApprover.mutate({
                              userId: m.userId,
                              ...payload,
                            })
                          }
                          pending={setApprover.isPending}
                        />
                        <button
                          type="button"
                          disabled={remove.isPending}
                          onClick={() =>
                            setRemoveTarget({
                              userId: m.userId,
                              label: m.name || m.email,
                            })
                          }
                          className="text-xs text-[var(--color-error)] underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          제거
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PENDING 초대 */}
      <section>
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
            대기 중인 초대
          </h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            총 {invites.length}건
          </p>
        </header>
        {invites.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            대기 중인 초대가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="grid grid-cols-[1fr_auto] items-center gap-6 py-5 md:grid-cols-[1fr_140px_180px_auto]"
              >
                <p className="truncate text-sm text-[var(--color-text-primary)]">
                  {inv.email}
                </p>
                <p className="hidden text-xs uppercase tracking-[0.15em] text-[var(--color-text-secondary)] md:block">
                  {ROLE_LABEL[inv.role] ?? inv.role}
                </p>
                <p className="hidden text-xs text-[var(--color-text-tertiary)] md:block">
                  만료 {tsToDateStr(inv.expiresAt as unknown as Timestamp)}
                </p>
                <button
                  type="button"
                  disabled={cancelInvite.isPending}
                  onClick={() => cancelInvite.mutate({ inviteId: inv.id })}
                  className="text-xs text-[var(--color-text-secondary)] underline-offset-2 hover:text-[var(--color-error)] hover:underline justify-self-end"
                >
                  취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {removeTarget && (
        <ConfirmDialog
          open={!!removeTarget}
          onOpenChange={(next) => {
            if (!next) setRemoveTarget(null);
          }}
          title="멤버 제거"
          description={`${removeTarget.label} 님을 팀에서 제거합니다. 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="제거"
          destructive
          onConfirm={() => {
            remove.mutate({ userId: removeTarget.userId });
            setRemoveTarget(null);
          }}
        />
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <header className="mb-6 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
        {title}
      </h2>
    </header>
  );
}

function ApproverToggle({
  memberId,
  isApprover,
  currentLimit,
  onSet,
  pending,
}: {
  memberId: string;
  isApprover: boolean;
  currentLimit: number | null;
  onSet: (payload: { isApprover: boolean; approvalLimit?: number }) => void;
  pending: boolean;
}) {
  const [showLimit, setShowLimit] = useState(false);
  const [limit, setLimit] = useState(currentLimit ?? 5000000);
  void memberId;

  if (!isApprover && !showLimit) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setShowLimit(true)}
        className="text-xs text-[var(--color-accent)] underline-offset-2 hover:underline disabled:opacity-50"
      >
        결재자 지정
      </button>
    );
  }
  if (showLimit) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={100000}
          value={limit}
          onChange={(e) => setLimit(Math.max(0, Number(e.target.value) || 0))}
          className="h-8 w-28 border-b border-[var(--color-border-light)] bg-transparent text-right font-mono text-xs tabular-nums outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="button"
          onClick={() => {
            onSet({ isApprover: true, approvalLimit: limit });
            setShowLimit(false);
          }}
          disabled={pending}
          className="text-xs text-[var(--color-accent)] underline-offset-2 hover:underline disabled:opacity-50"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => setShowLimit(false)}
          className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:underline"
        >
          취소
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onSet({ isApprover: false })}
      className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-warning)] hover:underline disabled:opacity-50"
    >
      결재자 해제
    </button>
  );
}
