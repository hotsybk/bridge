"use client";

import { useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/firebase/auth-context";

/**
 * /forbidden 페이지 본문 — ?reason / ?need 파라미터를 읽어 안내문 분기.
 *
 * useSearchParams + useAuth (Client) — 외곽 Suspense 로 감싸야 함.
 */
const REASON_MESSAGES: Record<string, string> = {
  role: "현재 계정 권한으로는 이 영역을 사용할 수 없습니다.",
  auth: "로그인이 필요한 페이지입니다.",
  expired: "세션이 만료되었습니다. 다시 로그인해 주세요.",
  forbidden: "현재 계정 권한이 이 페이지에는 부족합니다.",
};

const NEED_LABEL: Record<string, string> = {
  ADMIN: "운영자",
  SUPER_ADMIN: "최고 운영자",
  BUYER: "병원·의원",
  VENDOR: "공급업체",
};

export function ForbiddenReasonHint() {
  const sp = useSearchParams();
  const { user } = useAuth();

  const reason = sp.get("reason") ?? "role";
  const need = sp.get("need");
  const message = REASON_MESSAGES[reason] ?? REASON_MESSAGES.role;
  const needLabel = need ? NEED_LABEL[need] ?? need : null;

  return (
    <div className="mt-6 space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
      <p>{message}</p>
      {needLabel && (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          필요 권한 ·{" "}
          <span className="font-medium text-[var(--color-text-primary)]">
            {needLabel}
          </span>
        </p>
      )}
      {user?.email && (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          현재 계정 ·{" "}
          <span className="font-mono text-[var(--color-text-primary)]">
            {user.email}
          </span>
        </p>
      )}
    </div>
  );
}
