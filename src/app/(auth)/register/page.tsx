"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/firebase/auth-context";

type Role = "BUYER_OWNER" | "VENDOR_OWNER";
type Step = "role" | "form";

async function postInitUser(idToken: string, role: Role, displayName?: string) {
  const res = await fetch("/api/auth/init-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role, displayName }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`user 초기화 실패 (HTTP ${res.status}): ${body}`);
  }
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

const ROLE_META: Record<
  Role,
  {
    icon: typeof Stethoscope;
    label: string;
    desc: string;
    nextStepsTitle: string;
    nextSteps: ReadonlyArray<string>;
  }
> = {
  BUYER_OWNER: {
    icon: Stethoscope,
    label: "병원·의원",
    desc: "의료기기·소모품을 구매합니다",
    nextStepsTitle: "가입 후 진행 단계",
    nextSteps: [
      "1. 사업자등록증 업로드",
      "2. OCR + 국세청 자동 검증",
      "3. 병원 정보 입력",
      "4. 가입 완료 → 카탈로그 사용",
    ],
  },
  VENDOR_OWNER: {
    icon: Building2,
    label: "공급업체",
    desc: "의료기기·소모품을 판매합니다",
    nextStepsTitle: "가입 후 진행 단계",
    nextSteps: [
      "1. 사업자등록증 + 판매업·제조업 허가증",
      "2. 정산 계좌 등록",
      "3. 영업 카테고리·약관 동의",
      "4. 운영자 심사 (24~72시간)",
    ],
  },
};

export default function RegisterPage() {
  const router = useRouter();
  const { signUpEmail, signInWithGoogle, forceRefreshToken } = useAuth();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>("BUYER_OWNER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onboardingPath = role === "BUYER_OWNER" ? "/onboarding/buyer" : "/onboarding/vendor";

  async function finalizeSignup(idToken: string, displayName?: string) {
    await postInitUser(idToken, role, displayName);
    const fresh = await forceRefreshToken();
    await postLogin(fresh);
    router.replace(onboardingPath);
    router.refresh();
  }

  async function onEmailSignup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await signUpEmail(email, password);
      const idToken = await user.getIdToken();
      await finalizeSignup(idToken, name);
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignup() {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();
      await finalizeSignup(idToken, user.displayName ?? undefined);
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10 md:px-12 md:py-16">
      {/* 워드마크 */}
      <Link href="/" className="inline-flex items-center gap-2 self-start">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
          <Stethoscope className="h-4 w-4" />
        </span>
        <span className="text-base font-semibold tracking-tight">MedPlace</span>
      </Link>

      {/* Step indicator — 2개 점 */}
      <div className="mt-8 flex items-center gap-2" aria-label="가입 진행">
        <span
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step === "role" || step === "form"
              ? "bg-[var(--color-accent)]"
              : "bg-[var(--color-border-light)]"
          }`}
        />
        <span
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step === "form"
              ? "bg-[var(--color-accent)]"
              : "bg-[var(--color-border-light)]"
          }`}
        />
      </div>

      <p className="mt-3 text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {step === "role" ? "Step 1 / 2 · 역할 선택" : "Step 2 / 2 · 계정 정보"}
      </p>

      {/* Step 1 — 역할 카드 */}
      {step === "role" && (
        <div className="mt-8 flex flex-1 flex-col">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            어떤 계정으로 시작하시겠어요?
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)] md:text-base">
            선택한 역할에 따라 가입 흐름과 사용 가능한 기능이 달라집니다.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <RoleCard
              role="BUYER_OWNER"
              meta={ROLE_META.BUYER_OWNER}
              selected={role === "BUYER_OWNER"}
              onSelect={() => setRole("BUYER_OWNER")}
            />
            <RoleCard
              role="VENDOR_OWNER"
              meta={ROLE_META.VENDOR_OWNER}
              selected={role === "VENDOR_OWNER"}
              onSelect={() => setRole("VENDOR_OWNER")}
            />
          </div>

          <button
            type="button"
            onClick={() => setStep("form")}
            className="mt-10 inline-flex h-12 items-center justify-center gap-1.5 self-start rounded-full bg-[var(--color-accent)] px-7 text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            다음 단계
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-12 text-center text-sm text-[var(--color-text-secondary)] md:text-left">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--color-accent)] hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      )}

      {/* Step 2 — 폼 */}
      {step === "form" && (
        <div className="mt-8 flex flex-1 flex-col">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("role");
            }}
            disabled={loading}
            className="inline-flex items-center gap-1 self-start text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            역할 변경
          </button>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {ROLE_META[role].label} 계정 만들기
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            아래 정보로 계정을 생성하고 이어서 사업자 인증을 진행합니다.
          </p>

          <div className="mt-10 grid gap-10 md:grid-cols-[1fr_240px]">
            <form onSubmit={onEmailSignup} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
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
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  8자 이상, 영문·숫자 조합 권장
                </p>
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
                    계정 만드는 중...
                  </>
                ) : (
                  "무료로 가입하기"
                )}
              </button>

              <div className="relative">
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
                onClick={onGoogleSignup}
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60"
              >
                <GoogleMark />
                Google로 가입
              </button>
            </form>

            {/* 우측 — 다음 단계 안내 */}
            <aside className="rounded-2xl bg-[var(--color-bg-secondary)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {ROLE_META[role].nextStepsTitle}
              </p>
              <ol className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
                {ROLE_META[role].nextSteps.map((s) => (
                  <li key={s} className="leading-relaxed">
                    {s}
                  </li>
                ))}
              </ol>
            </aside>
          </div>

          <p className="mt-12 text-center text-sm text-[var(--color-text-secondary)] md:text-left">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--color-accent)] hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────────────────────

function RoleCard({
  meta,
  selected,
  onSelect,
}: {
  role: Role;
  meta: (typeof ROLE_META)[Role];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex flex-col gap-5 rounded-3xl border p-7 text-left transition-all active:scale-[0.99] ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
          : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border)] hover:shadow-sm"
      }`}
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors ${
          selected
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-bg-secondary)] text-[var(--color-accent)]"
        }`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-xl font-semibold tracking-tight">{meta.label}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {meta.desc}
        </p>
      </div>
      {selected && (
        <span className="absolute right-5 top-5 inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
      )}
    </button>
  );
}

function toKoreanError(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 가입된 이메일입니다. 로그인을 시도해주세요.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/weak-password":
      return "비밀번호가 너무 짧습니다. 8자 이상 입력해주세요.";
    case "auth/operation-not-allowed":
      return "이메일/비밀번호 가입이 일시적으로 비활성화되었습니다.";
    case "auth/popup-closed-by-user":
      return "Google 가입 창이 닫혔습니다.";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인하고 다시 시도해주세요.";
    default:
      return fallback ?? "가입에 실패했습니다. 잠시 후 다시 시도해주세요.";
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
