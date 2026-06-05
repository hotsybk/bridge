"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/firebase/auth-context";

/**
 * 로그인 상태·역할에 따라 적절한 dashboard 경로를 계산.
 * 서버에서 `proxy.ts` 가 동일한 role → path 매핑을 사용한다.
 */
function useAuthRoute() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setRoleReady(true);
      return;
    }
    let cancelled = false;
    user
      .getIdTokenResult()
      .then((r) => {
        if (cancelled) return;
        setRole((r.claims.role as string | undefined) ?? null);
        setRoleReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setRole(null);
        setRoleReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signedIn = !loading && !!user;
  const dashboardHref =
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? "/admin/vendors"
      : role === "VENDOR_OWNER" || role === "VENDOR_STAFF"
        ? "/seller/products"
        : "/search";

  return { ready: !loading && (!user || roleReady), signedIn, dashboardHref };
}

/**
 * 게스트(/login·/register) 흐름과 로그인 사용자 흐름을 동시에 표현하는 CTA.
 *
 * SSR 단계에서는 항상 guest 버전을 그리므로 정적 prerender 와 일치.
 * 클라이언트에서 auth state 가 해석되는 즉시 authed 로 교체.
 */
export function AuthAwareCTA({
  className,
  guestHref,
  guestChildren,
  authedHref,
  authedChildren,
}: {
  className?: string;
  guestHref: string;
  guestChildren: ReactNode;
  /** 미지정 시 역할 기반 dashboard 경로로 자동 분기 */
  authedHref?: string;
  authedChildren: ReactNode;
}) {
  const { signedIn, dashboardHref } = useAuthRoute();
  if (signedIn) {
    return (
      <Link href={authedHref ?? dashboardHref} className={className}>
        {authedChildren}
      </Link>
    );
  }
  return (
    <Link href={guestHref} className={className}>
      {guestChildren}
    </Link>
  );
}

/**
 * TopNav 우측 두 버튼 영역.
 * 비로그인: 로그인 + 회원가입
 * 로그인: 로그아웃 버튼 + 내 작업공간 링크
 */
export function TopNavAuthArea({
  ghostClassName,
  primaryClassName,
}: {
  ghostClassName: string;
  primaryClassName: string;
}) {
  const { signedIn, dashboardHref } = useAuthRoute();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <>
        <Link href="/login" className={ghostClassName}>
          로그인
        </Link>
        <Link href="/register" className={primaryClassName}>
          회원가입
        </Link>
      </>
    );
  }

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      // proxy.ts 가 보는 서명 쿠키도 함께 제거
      await fetch("/api/logout", { method: "POST" });
    } finally {
      // 헤더·페이지·캐시까지 완전히 리셋
      window.location.assign("/");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onLogout}
        disabled={busy}
        className={`${ghostClassName} disabled:opacity-60`}
      >
        {busy ? "로그아웃 중…" : "로그아웃"}
      </button>
      <Link href={dashboardHref} className={primaryClassName}>
        내 작업공간
      </Link>
    </>
  );
}
