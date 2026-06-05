"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

// Wave L — /admin/staff client island.
// 페이지 server-side 에서 fetch 된 staff 리스트를 받아 invite / updateRole / deactivate / reactivate
// 액션을 처리한다. 모든 mutation 은 superAdminProcedure 가드를 거친 admin.staff router 호출.

export type StaffRow = {
  uid: string;
  name?: string;
  email?: string;
  role: "ADMIN" | "SUPER_ADMIN";
  status?: "ACTIVE" | "DISABLED";
  statusReason?: string | null;
  lastLogin?: string;
  activity?: number;
};

type ActionKind = "invite" | "updateRole" | "deactivate" | null;
type Role = "ADMIN" | "SUPER_ADMIN";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "운영자",
  SUPER_ADMIN: "최고 운영자",
};

export function StaffInviteButton() {
  return (
    // 페이지 헤더의 invite 버튼은 별도로 처리. StaffTable 이 dialog state 를 관리.
    null
  );
}

export function StaffTable({
  staff,
  superAdminCount,
}: {
  staff: StaffRow[];
  superAdminCount: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ActionKind>(null);
  const [target, setTarget] = useState<StaffRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // invite form
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    name: string;
    role: Role;
    message: string;
  }>({ email: "", name: "", role: "ADMIN", message: "" });

  // updateRole form
  const [newRole, setNewRole] = useState<Role>("ADMIN");

  // deactivate form
  const [reason, setReason] = useState("");

  const invite = trpc.admin.staff.invite.useMutation();
  const updateRole = trpc.admin.staff.updateRole.useMutation();
  const deactivate = trpc.admin.staff.deactivate.useMutation();
  const reactivate = trpc.admin.staff.reactivate.useMutation();

  function close() {
    setActive(null);
    setTarget(null);
    setError(null);
    setReason("");
  }

  async function handleInvite() {
    try {
      setError(null);
      if (!inviteForm.email || !inviteForm.name) {
        setError("이름과 이메일은 필수 입력입니다.");
        return;
      }
      await invite.mutateAsync({
        email: inviteForm.email,
        name: inviteForm.name,
        role: inviteForm.role,
        message: inviteForm.message || undefined,
      });
      toast.success("운영자를 초대했습니다");
      setInviteForm({ email: "", name: "", role: "ADMIN", message: "" });
      close();
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleUpdateRole() {
    if (!target) return;
    try {
      setError(null);
      await updateRole.mutateAsync({ uid: target.uid, newRole });
      toast.success(`권한을 ${newRole} 로 변경했습니다`);
      close();
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDeactivate() {
    if (!target) return;
    try {
      setError(null);
      if (!reason.trim()) {
        setError("비활성화 사유는 필수입니다.");
        return;
      }
      await deactivate.mutateAsync({ uid: target.uid, reason: reason.trim() });
      toast.success("운영자를 비활성화했습니다");
      close();
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleReactivate(uid: string) {
    try {
      await reactivate.mutateAsync({ uid });
      toast.success("운영자를 재활성화했습니다");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setActive("invite")}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          운영자 초대
        </button>
      </div>

      {/* Line Table */}
      <div className="mt-6 border-y border-[var(--color-border-light)]">
        <div className="grid grid-cols-[120px_1fr_140px_160px_100px_220px] gap-4 border-b border-[var(--color-border-light)] px-2 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          <span>이름</span>
          <span>이메일</span>
          <span>역할</span>
          <span>마지막 로그인</span>
          <span className="text-right">상태</span>
          <span className="text-right">액션</span>
        </div>
        {staff.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-[var(--color-text-tertiary)]">
            등록된 운영자가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-light)]">
            {staff.map((s) => {
              const isDisabled = s.status === "DISABLED";
              const isLastSuper = s.role === "SUPER_ADMIN" && superAdminCount <= 1;
              return (
                <li
                  key={s.uid}
                  className="grid grid-cols-[120px_1fr_140px_160px_100px_220px] items-center gap-4 px-2 py-4 text-sm"
                >
                  <span className="font-medium">{s.name ?? "—"}</span>
                  <span className="truncate font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {s.email ?? "—"}
                  </span>
                  <span>
                    <span
                      className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium tracking-[0.05em] ${
                        s.role === "SUPER_ADMIN"
                          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                          : "border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {ROLE_LABEL[s.role]}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                    {s.lastLogin ?? "—"}
                  </span>
                  <span className="text-right">
                    <span
                      className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium uppercase tracking-[0.15em] ${
                        isDisabled
                          ? "border-[var(--color-error)] text-[var(--color-error)]"
                          : "border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {isDisabled ? "비활성" : "활성"}
                    </span>
                  </span>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTarget(s);
                        setNewRole(s.role === "ADMIN" ? "SUPER_ADMIN" : "ADMIN");
                        setActive("updateRole");
                      }}
                      className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                    >
                      권한 변경
                    </button>
                    {isDisabled ? (
                      <button
                        type="button"
                        onClick={() => handleReactivate(s.uid)}
                        className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/5"
                      >
                        활성화
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTarget(s);
                          setReason("");
                          setActive("deactivate");
                        }}
                        disabled={isLastSuper}
                        title={isLastSuper ? "최소 1명의 최고 운영자를 유지해야 합니다" : undefined}
                        className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        비활성화
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialog — 운영자 초대 */}
      <Dialog open={active === "invite"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>운영자 초대</DialogTitle>
            <DialogDescription>
              이메일로 신규 계정을 생성하거나, 기존 사용자에게 운영자 권한을 부여합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <label className="block text-xs text-[var(--color-text-tertiary)]">
              이메일
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="name@medplace.io"
                className="mt-1 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
            <label className="block text-xs text-[var(--color-text-tertiary)]">
              이름
              <input
                type="text"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="홍길동"
                className="mt-1 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
            <label className="block text-xs text-[var(--color-text-tertiary)]">
              역할
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, role: e.target.value as Role })
                }
                className="mt-1 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="ADMIN">운영자</option>
                <option value="SUPER_ADMIN">최고 운영자</option>
              </select>
            </label>
            <label className="block text-xs text-[var(--color-text-tertiary)]">
              초대 메시지 (선택)
              <textarea
                rows={3}
                value={inviteForm.message}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, message: e.target.value })
                }
                placeholder="환영합니다…"
                className="mt-1 w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
            {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleInvite}
              disabled={invite.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {invite.isPending ? "발송 중…" : "초대 발송"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 권한 변경 */}
      <Dialog
        open={active === "updateRole"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>권한 변경</DialogTitle>
            <DialogDescription>
              운영자 ↔ 최고 운영자로 권한을 변경합니다. 대상 사용자는 재로그인 후 새 권한이 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          {target && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="대상" value={target.name ?? "—"} />
                <Row label="이메일" value={target.email ?? "—"} mono />
                <Row label="현재 역할" value={ROLE_LABEL[target.role]} />
              </dl>
              <label className="block text-xs text-[var(--color-text-tertiary)]">
                새 역할
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="mt-1 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm focus:border-[var(--color-accent)] focus:outline-none"
                >
                  <option value="ADMIN">운영자</option>
                  <option value="SUPER_ADMIN">최고 운영자</option>
                </select>
              </label>
              {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleUpdateRole}
              disabled={updateRole.isPending}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {updateRole.isPending ? "변경 중…" : "변경 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — 비활성화 */}
      <Dialog
        open={active === "deactivate"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>운영자 비활성화</DialogTitle>
            <DialogDescription>
              즉시 로그인이 차단되며 모든 권한이 회수됩니다. 감사 로그에 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          {target && (
            <div className="mt-2 space-y-3">
              <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <Row label="대상" value={target.name ?? "—"} />
                <Row label="이메일" value={target.email ?? "—"} mono />
                <Row label="역할" value={target.role} />
              </dl>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="비활성화 사유 (필수)"
                className="w-full resize-none border border-[var(--color-border-light)] bg-transparent p-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivate.isPending}
              className="inline-flex h-9 items-center rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 disabled:opacity-50"
            >
              {deactivate.isPending ? "처리 중…" : "비활성화 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
    <div className="grid grid-cols-[120px_1fr] gap-4 px-2 py-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-sm text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
