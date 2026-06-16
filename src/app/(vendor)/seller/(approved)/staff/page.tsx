"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Timestamp } from "firebase/firestore";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

/**
 * Phase ν-3 작업2 — 공급업체 멤버 관리 (/seller/staff).
 *
 * - 멤버 list + PENDING 초대 list
 * - OWNER: 초대 (이메일+role), role 변경, 정지/제거, 초대 취소
 * - 자기 자신 보호 + 마지막 OWNER 보호 (서버 가드)
 */

const ROLE_LABEL: Record<string, string> = {
  VENDOR_OWNER: "소유자",
  VENDOR_ADMIN: "관리자",
  VENDOR_STAFF: "처리자",
  VENDOR_VIEWER: "조회 전용",
};

const ROLE_OPTIONS = [
  { value: "VENDOR_OWNER", label: "소유자 · 모든 권한" },
  { value: "VENDOR_ADMIN", label: "관리자 · 운영 권한 (정산 제외)" },
  { value: "VENDOR_STAFF", label: "처리자 · 주문·상품 처리" },
  { value: "VENDOR_VIEWER", label: "조회 전용 · 조회만" },
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

export default function VendorStaffPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.vendor.staff.list.useQuery();
  const { data: profile } = trpc.vendor.profile.getMine.useQuery();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<(typeof ROLE_OPTIONS)[number]["value"]>("VENDOR_STAFF");
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    label: string;
  } | null>(null);

  const invite = trpc.vendor.staff.invite.useMutation({
    onSuccess: async () => {
      toast.success("초대장을 발송했습니다.");
      setInviteEmail("");
      await utils.vendor.staff.list.invalidate();
    },
  });
  const cancelInvite = trpc.vendor.staff.cancelInvite.useMutation({
    onSuccess: async () => {
      toast.success("초대를 취소했습니다.");
      await utils.vendor.staff.list.invalidate();
    },
  });
  const updateRole = trpc.vendor.staff.updateRole.useMutation({
    onSuccess: async () => {
      toast.success("역할이 변경되었습니다.");
      await utils.vendor.staff.list.invalidate();
    },
  });
  const remove = trpc.vendor.staff.remove.useMutation({
    onSuccess: async () => {
      toast.success("멤버를 제거했습니다.");
      await utils.vendor.staff.list.invalidate();
    },
  });

  const isOwner = profile?.myRole === "VENDOR_OWNER";
  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <PageHeader
        label="파트너센터 · 팀원"
        title="팀원 관리"
        description={
          isOwner
            ? "공급업체 멤버를 초대하고 역할을 지정합니다."
            : "이 페이지는 보기 전용입니다. 초대·역할 변경은 소유자 권한이 필요합니다."
        }
      />

      {isLoading && (
        <p className="mt-12 text-sm text-[var(--color-text-tertiary)]">
          불러오는 중…
        </p>
      )}

      {!isLoading && (
        <div className="mt-12 space-y-20">
          {/* 초대 폼 */}
          {isOwner && (
            <section>
              <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
                새 멤버 초대
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                초대장은 이메일로 발송되며 7일간 유효합니다.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <input
                  type="email"
                  placeholder="member@hospital.kr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="send"
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
          )}

          {/* 멤버 list */}
          <section>
            <header className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
                현재 멤버
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                총 {members.length}명
              </p>
            </header>
            {members.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                아직 멤버가 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex flex-col gap-3 py-5 md:grid md:grid-cols-[1fr_140px_180px_auto] md:items-center md:gap-6"
                  >
                    <div className="flex items-start justify-between gap-3 md:contents">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {m.name || "—"}
                        </p>
                        <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                          {m.email}
                        </p>
                      </div>
                      <p className="md:hidden text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)] shrink-0">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </p>
                    </div>
                    <p className="hidden text-xs uppercase tracking-[0.15em] text-[var(--color-text-secondary)] md:block">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </p>
                    <p className="hidden text-xs text-[var(--color-text-tertiary)] md:block">
                      가입 {tsToDateStr(m.joinedAt as unknown as Timestamp)}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] md:hidden">
                      가입 {tsToDateStr(m.joinedAt as unknown as Timestamp)}
                    </p>
                    {isOwner && (
                      <div className="flex items-center justify-between gap-2 md:justify-end">
                        <select
                          value={m.role}
                          onChange={(e) =>
                            updateRole.mutate({
                              userId: m.userId,
                              role: e.target.value as
                                | "VENDOR_OWNER"
                                | "VENDOR_ADMIN"
                                | "VENDOR_STAFF"
                                | "VENDOR_VIEWER",
                            })
                          }
                          disabled={updateRole.isPending}
                          className="h-9 flex-1 border-b border-[var(--color-border-light)] bg-transparent text-xs outline-none transition-colors focus:border-[var(--color-accent)] md:flex-none"
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {ROLE_LABEL[o.value]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={remove.isPending}
                          onClick={() =>
                            setRemoveTarget({
                              userId: m.userId,
                              label: m.name || m.email,
                            })
                          }
                          className="shrink-0 text-xs text-[var(--color-error)] underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          제거
                        </button>
                      </div>
                    )}
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
                    className="flex flex-col gap-2 py-5 md:grid md:grid-cols-[1fr_140px_180px_auto] md:items-center md:gap-6"
                  >
                    <div className="flex items-center justify-between gap-3 md:contents">
                      <p className="truncate text-sm text-[var(--color-text-primary)]">
                        {inv.email}
                      </p>
                      <p className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)] md:hidden">
                        {ROLE_LABEL[inv.role] ?? inv.role}
                      </p>
                    </div>
                    <p className="hidden text-xs uppercase tracking-[0.15em] text-[var(--color-text-secondary)] md:block">
                      {ROLE_LABEL[inv.role] ?? inv.role}
                    </p>
                    <p className="hidden text-xs text-[var(--color-text-tertiary)] md:block">
                      만료 {tsToDateStr(inv.expiresAt as unknown as Timestamp)}
                    </p>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <p className="text-[11px] text-[var(--color-text-tertiary)] md:hidden">
                        만료 {tsToDateStr(inv.expiresAt as unknown as Timestamp)}
                      </p>
                      {isOwner && (
                        <button
                          type="button"
                          disabled={cancelInvite.isPending}
                          onClick={() =>
                            cancelInvite.mutate({ inviteId: inv.id })
                          }
                          className="text-xs text-[var(--color-text-secondary)] underline-offset-2 hover:text-[var(--color-error)] hover:underline"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

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
    </main>
  );
}
