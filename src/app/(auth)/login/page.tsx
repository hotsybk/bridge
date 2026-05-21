"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, Stethoscope } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/firebase/auth-context";

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
  const router = useRouter();
  const { signInEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // 페이지 마운트 시 email input 자동 포커스 (데스크탑에서만 유용)
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
      router.replace("/");
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
      router.replace("/");
      router.refresh();
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* 좌측 — 브랜드 패널 (데스크탑 전용) */}
      <aside className="relative hidden flex-col justify-between bg-[var(--color-bg-secondary)] p-12 md:flex">
        <Link href="/" className="inline-flex items-center gap-2 self-start">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            MedPlace
          </span>
        </Link>

        <div className="space-y-6">
          <div
            className="grid h-24 w-24 place-items-center rounded-3xl bg-[var(--color-accent-light)]"
            aria-hidden
          >
            <Stethoscope className="h-12 w-12 text-[var(--color-accent)]" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              MedPlace
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              병원 운영의 모든 것,
              <br />
              <span className="text-[var(--color-accent)]">한 곳에서.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-[var(--color-text-secondary)]">
              의료기기·소모품을 가장 빠르게, 가장 투명하게.
              전국 공급업체와 곧바로 연결됩니다.
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-tertiary)]">
          현재 Phase 1 베타 — 실 결제·실 거래는 진행되지 않습니다.
        </p>
      </aside>

      {/* 우측 — 폼 */}
      <section className="flex flex-col px-6 py-10 md:px-12 md:py-16">
        {/* 모바일 워드마크 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start md:hidden"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            MedPlace
          </span>
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pt-12 md:pt-0">
          <div className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight">
              다시 만나서 반갑습니다
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              계정에 로그인하고 이어서 진행하세요.
            </p>
          </div>

          <form onSubmit={onEmailLogin} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
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
                <Label htmlFor="password">비밀번호</Label>
                <Link
                  href="/login"
                  aria-disabled
                  className="cursor-not-allowed text-xs text-[var(--color-text-tertiary)]"
                  title="Phase 1 베타 — 비밀번호 재설정은 곧 출시"
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
                className="flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 p-3 text-sm text-[var(--color-error)]"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
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
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--color-border-light)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--color-bg-primary)] px-3 text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
                또는
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60"
          >
            <GoogleMark />
            Google로 계속
          </button>

          <p className="mt-10 text-center text-sm text-[var(--color-text-secondary)]">
            계정이 없으신가요?{" "}
            <Link
              href="/register"
              className="font-medium text-[var(--color-accent)] hover:underline"
            >
              가입하기
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

/** Firebase Auth 에러 코드 → 한국어 메시지 (헌법 §5.6 i18n). */
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

/** Google 로고 마크 — Lucide 에는 없으므로 inline SVG (Phase 1 한정). */
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
