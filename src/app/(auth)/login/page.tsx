"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Clock, Info, Loader2, Lock, Stethoscope } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalFooter } from "@/components/marketing/minimal-footer";
import { useAuth } from "@/lib/firebase/auth-context";

/** ?reason= 종류 — proxy.ts / forbidden 페이지에서 redirect 시 사용. */
const REASON_INFO: Record<string, { icon: typeof Info; text: string }> = {
  expired: { icon: Clock, text: "세션이 만료되었습니다. 다시 로그인해 주세요." },
  auth: { icon: Lock, text: "이 페이지를 보려면 로그인이 필요합니다." },
  forbidden: { icon: Lock, text: "다른 계정으로 로그인해 주세요." },
};

/** ?from= 경로 안전 검사 — 외부 URL · javascript: scheme 차단. */
function safeRedirect(from: string | null): string {
  if (!from) return "/";
  if (!from.startsWith("/")) return "/";
  if (from.startsWith("//")) return "/";
  return from;
}

async function postLogin(idToken: string) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`세션 쿠키 설정 실패 (HTTP ${res.status})`);
  }
}

export default function LoginPage() {
  // useSearchParams 는 Suspense 안에서 사용해야 안전 (Next.js 16 권장).
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { signInEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = sp.get("reason");
  const reasonInfo = reason ? REASON_INFO[reason] : null;
  const fromPath = useMemo(() => safeRedirect(sp.get("from")), [sp]);

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function onEmailLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await signInEmail(email, password);
      const idToken = await user.getIdToken();
      await postLogin(idToken);
      router.replace(fromPath);
      router.refresh();
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();
      await postLogin(idToken);
      router.replace(fromPath);
      router.refresh();
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.15fr]">
      {/* ─── 좌측 — Brand 패널 (lg+) ─── */}
      <BrandPanel />

      {/* ─── 우측 — 폼 ─── */}
      <section className="flex flex-col px-6 py-10 md:px-12 md:py-12 lg:px-16 lg:py-16">
        {/* 모바일 워드마크 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start lg:hidden"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">MedPlace</span>
        </Link>

        {/* 콘텐츠 영역 — 가운데 정렬, 최대 너비 제한 */}
        <div className="mx-auto mt-12 flex w-full max-w-xl flex-1 flex-col justify-center md:mt-16">
          <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              로그인
            </p>
            <h1 className="mt-4 break-keep text-4xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-5xl">
              다시 만나서
              <br />
              반갑습니다.
            </h1>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              계정에 로그인하고 이어서 진행하세요.
            </p>
          </header>

          {reasonInfo && (
            <div
              className="error-slide-down mt-8 flex items-start gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-light)]/40 p-3 text-sm text-[var(--color-text-primary)]"
              role="status"
            >
              <reasonInfo.icon
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                aria-hidden
              />
              <span>{reasonInfo.text}</span>
            </div>
          )}

          <form onSubmit={onEmailLogin} className="mt-10 space-y-5" noValidate>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
              >
                이메일
              </Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                >
                  비밀번호
                </Label>
                <Link
                  href="/support/contact?reason=password-reset"
                  className="text-xs text-[var(--color-text-tertiary)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
                  title="고객 지원으로 이동 — 운영자가 비밀번호 재설정 메일을 보내드립니다"
                >
                  잊으셨나요?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12 rounded-xl"
              />
            </div>

            {error && (
              <div
                key={error}
                className="error-slide-down flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 p-3 text-sm text-[var(--color-error)]"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  로그인 중...
                </>
              ) : (
                "이메일로 로그인"
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--color-border-light)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--color-bg-primary)] px-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  또는
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]/50 hover:bg-[var(--color-bg-secondary)]/40 disabled:opacity-60"
            >
              <GoogleMark />
              Google로 계속
            </button>
          </form>
        </div>

        {/* 푸터 — 가입 링크 */}
        <p className="mt-12 text-center text-sm text-[var(--color-text-secondary)]">
          계정이 없으신가요?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            가입하기
          </Link>
        </p>

        <MinimalFooter />
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Brand panel — 좌측 풀 height accent 영역 (register 와 동일)
// ─────────────────────────────────────────────────────────────

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[var(--color-accent)] lg:flex lg:flex-col lg:justify-between lg:p-16 xl:p-20">
      {/* 메쉬 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          viewBox="0 0 800 1200"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="login-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="login-mesh-b" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="180"
            cy="200"
            r="320"
            fill="url(#login-mesh-a)"
            className="landing-cta-mesh-1"
          />
          <circle
            cx="640"
            cy="940"
            r="380"
            fill="url(#login-mesh-b)"
            className="landing-cta-mesh-2"
          />
        </svg>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* 워드마크 */}
      <Link href="/" className="relative inline-flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
          <Stethoscope className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-white">
          MedPlace
        </span>
      </Link>

      {/* 메인 메시지 */}
      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">
          어서오세요
        </p>
        <h2 className="mt-6 break-keep text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-5xl">
          발주 흐름이
          <br />
          그대로 이어집니다.
        </h2>

        <ul className="mt-12 space-y-4">
          {[
            "장바구니와 정기 주문이 그대로",
            "주문 이력과 운송장 추적",
            "공급업체별 정산 자동 갱신",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-sm text-white/90"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* 푸터 */}
      <p className="relative text-xs text-white/60">
        © 2026 MedPlace · 베타 운영 중
      </p>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

function toKoreanError(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/too-many-requests":
      return "잠시 후 다시 시도해주세요. 너무 많은 시도가 있었습니다.";
    case "auth/user-disabled":
      return "이 계정은 비활성화되었습니다. 고객지원에 문의해주세요.";
    case "auth/popup-closed-by-user":
      return "Google 로그인 창이 닫혔습니다.";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인하고 다시 시도해주세요.";
    default:
      return fallback ?? "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }
}

function GoogleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962l3.007 2.332C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
