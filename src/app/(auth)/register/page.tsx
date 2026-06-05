"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalFooter } from "@/components/marketing/minimal-footer";
import { useAuth } from "@/lib/firebase/auth-context";
import { trackAuthSignup } from "@/lib/posthog/events";

type Role = "BUYER_OWNER" | "VENDOR_OWNER";
type Step = "role" | "form";

type ConsentPayload = {
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
  agreedToMarketing: boolean;
};

async function postInitUser(
  idToken: string,
  role: Role,
  displayName?: string,
  consent?: ConsentPayload,
) {
  const res = await fetch("/api/auth/init-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role, displayName, consent }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 409) {
      throw new Error("이미 가입된 계정입니다. 다른 역할로 가입할 수 없습니다.");
    }
    if (res.status === 403) {
      throw new Error("관리자 계정은 일반 가입으로 역할을 변경할 수 없습니다.");
    }
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
    label: string;
    desc: string;
    bullets: ReadonlyArray<string>;
    nextStepsTitle: string;
    nextSteps: ReadonlyArray<string>;
  }
> = {
  BUYER_OWNER: {
    label: "병원 · 의원",
    desc: "의료기기·소모품을 구매하는 의료기관",
    bullets: [
      "전국 공급업체 가격을 한 화면에서 비교",
      "매달 쓰는 품목은 한 번 설정으로 자동 발주",
      "세금계산서·UDI 보고 모두 자동",
    ],
    nextStepsTitle: "가입 후 진행 단계",
    nextSteps: [
      "사업자등록증 업로드",
      "OCR + 국세청 자동 검증",
      "병원 정보 입력",
      "가입 완료 → 카탈로그 사용",
    ],
  },
  VENDOR_OWNER: {
    label: "공급업체",
    desc: "의료기기·소모품을 판매하는 사업자",
    bullets: [
      "전국 의료기관에 직접 노출",
      "영업일 3일 만에 자동 정산",
      "정기 주문·공동구매로 안정적 매출",
    ],
    nextStepsTitle: "가입 후 진행 단계",
    nextSteps: [
      "사업자등록증 + 판매업·제조업 허가증",
      "정산 계좌 등록",
      "영업 카테고리·약관 동의",
      "운영자 심사 (24~72시간)",
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
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onboardingPath =
    role === "BUYER_OWNER" ? "/onboarding/buyer" : "/onboarding/vendor";

  async function finalizeSignup(idToken: string, displayName?: string) {
    await postInitUser(idToken, role, displayName, {
      agreedToTerms: agreeTerms,
      agreedToPrivacy: agreePrivacy,
      agreedToMarketing: agreeMarketing,
    });
    const fresh = await forceRefreshToken();
    await postLogin(fresh);
    router.replace(onboardingPath);
    router.refresh();
  }

  function validateConsents(): string | null {
    if (!agreeTerms || !agreePrivacy) {
      return "이용약관과 개인정보 수집·이용 동의는 필수입니다.";
    }
    return null;
  }

  async function onEmailSignup(e: FormEvent) {
    e.preventDefault();
    const consentError = validateConsents();
    if (consentError) {
      setError(consentError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await signUpEmail(email, password);
      const idToken = await user.getIdToken();
      await finalizeSignup(idToken, name);
      trackAuthSignup({ role, method: "EMAIL" });
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignup() {
    const consentError = validateConsents();
    if (consentError) {
      setError(consentError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();
      await finalizeSignup(idToken, user.displayName ?? undefined);
      trackAuthSignup({ role, method: "GOOGLE" });
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(toKoreanError(e2.code, e2.message));
    } finally {
      setLoading(false);
    }
  }

  const stepNum = step === "role" ? 1 : 2;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.15fr]">
      {/* ─── 좌측 — Brand 패널 (lg+ 만 노출) ─── */}
      <BrandPanel />

      {/* ─── 우측 — 폼 영역 ─── */}
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

        {/* Progress + 단계 라벨 */}
        <div className="mt-8 lg:mt-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Step{" "}
              <span className="text-[var(--color-text-primary)] tabular-nums">
                {stepNum}
              </span>{" "}
              of 2 · {step === "role" ? "역할 선택" : "계정 정보"}
            </p>
            <p className="text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
              {stepNum === 1 ? "50%" : "100%"}
            </p>
          </div>
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-[var(--color-border-light)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
              style={{ width: stepNum === 1 ? "50%" : "100%" }}
            />
          </div>
        </div>

        {/* 콘텐츠 영역 — 가운데 정렬, 최대 너비 제한 */}
        <div className="mx-auto mt-12 flex w-full max-w-xl flex-1 flex-col md:mt-16">
          {step === "role" ? (
            <RoleStep
              role={role}
              onSelect={setRole}
              onNext={() => setStep("form")}
            />
          ) : (
            <FormStep
              role={role}
              name={name}
              email={email}
              password={password}
              agreeTerms={agreeTerms}
              agreePrivacy={agreePrivacy}
              agreeMarketing={agreeMarketing}
              loading={loading}
              error={error}
              onName={setName}
              onEmail={setEmail}
              onPassword={setPassword}
              onAgreeTerms={setAgreeTerms}
              onAgreePrivacy={setAgreePrivacy}
              onAgreeMarketing={setAgreeMarketing}
              onSubmit={onEmailSignup}
              onGoogle={onGoogleSignup}
              onBack={() => {
                setError(null);
                setStep("role");
              }}
            />
          )}
        </div>

        {/* 푸터 — 로그인 링크 */}
        <p className="mt-12 text-center text-sm text-[var(--color-text-secondary)]">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            로그인
          </Link>
        </p>

        <MinimalFooter />
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Brand panel — 좌측 풀 height accent 영역
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
            <radialGradient id="reg-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="reg-mesh-b" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="180"
            cy="200"
            r="320"
            fill="url(#reg-mesh-a)"
            className="landing-cta-mesh-1"
          />
          <circle
            cx="640"
            cy="940"
            r="380"
            fill="url(#reg-mesh-b)"
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
          한 번만 가입하면
        </p>
        <h2 className="mt-6 break-keep text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-5xl">
          발주는 매달
          <br />
          자동입니다.
        </h2>

        <ul className="mt-12 space-y-4">
          {[
            "30초 가입 · 사업자등록증 자동 인증",
            "가입비 0원 · 의무 약정 0원",
            "영업일 3일 자동 정산",
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
// Step 1 — 역할 선택
// ─────────────────────────────────────────────────────────────

function RoleStep({
  role,
  onSelect,
  onNext,
}: {
  role: Role;
  onSelect: (r: Role) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="break-keep text-4xl font-semibold leading-[1.15] tracking-[-0.03em] md:text-5xl">
        어떤 계정으로
        <br />
        시작하시겠어요?
      </h1>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        선택한 역할에 따라 가입 흐름과 사용 가능한 기능이 달라집니다.
      </p>

      <div className="mt-10 space-y-3">
        <RoleCard
          role="BUYER_OWNER"
          meta={ROLE_META.BUYER_OWNER}
          selected={role === "BUYER_OWNER"}
          onSelect={() => onSelect("BUYER_OWNER")}
        />
        <RoleCard
          role="VENDOR_OWNER"
          meta={ROLE_META.VENDOR_OWNER}
          selected={role === "VENDOR_OWNER"}
          onSelect={() => onSelect("VENDOR_OWNER")}
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-10 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
      >
        다음 단계
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

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
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all md:p-6 ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/40"
          : "border-[var(--color-border-light)] hover:border-[var(--color-text-secondary)]/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold tracking-tight ${
            selected ? "text-[var(--color-accent)]" : ""
          }`}
        >
          {meta.label}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {meta.desc}
        </p>
        <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-tertiary)]">
          {meta.bullets.map((b) => (
            <li key={b} className="flex items-start gap-1.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-text-tertiary)]" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* 선택 상태 표시 — 우상단 radio */}
      <span
        aria-hidden
        className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
          selected
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
        }`}
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — 계정 정보 입력
// ─────────────────────────────────────────────────────────────

function FormStep({
  role,
  name,
  email,
  password,
  agreeTerms,
  agreePrivacy,
  agreeMarketing,
  loading,
  error,
  onName,
  onEmail,
  onPassword,
  onAgreeTerms,
  onAgreePrivacy,
  onAgreeMarketing,
  onSubmit,
  onGoogle,
  onBack,
}: {
  role: Role;
  name: string;
  email: string;
  password: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  loading: boolean;
  error: string | null;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onAgreeTerms: (v: boolean) => void;
  onAgreePrivacy: (v: boolean) => void;
  onAgreeMarketing: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onGoogle: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="inline-flex items-center gap-1 self-start text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        역할 변경
      </button>

      <h1 className="mt-5 break-keep text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
        {ROLE_META[role].label}
        <br />
        계정 만들기
      </h1>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        아래 정보로 계정을 만든 뒤, 이어서 사업자 인증을 진행합니다.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">이름</Label>
          <Input
            id="name"
            type="text"
            required
            autoComplete="name"
            enterKeyHint="next"
            value={name}
            onChange={(e) => onName(e.target.value)}
            disabled={loading}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">이메일</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            disabled={loading}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">비밀번호</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            enterKeyHint="done"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            disabled={loading}
            className="h-12 rounded-xl"
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            8자 이상, 영문·숫자 조합 권장
          </p>
        </div>

        {/* 동의 체크박스 — 필수 2종 + 선택 1종 */}
        <fieldset className="space-y-3 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/30 p-4">
          <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            가입 동의
          </legend>
          <ConsentRow
            id="agree-terms"
            checked={agreeTerms}
            onChange={onAgreeTerms}
            required
            label="이용약관에 동의합니다."
            linkHref="/legal/terms"
            disabled={loading}
          />
          <ConsentRow
            id="agree-privacy"
            checked={agreePrivacy}
            onChange={onAgreePrivacy}
            required
            label="개인정보 수집·이용에 동의합니다."
            linkHref="/legal/privacy"
            disabled={loading}
          />
          <ConsentRow
            id="agree-marketing"
            checked={agreeMarketing}
            onChange={onAgreeMarketing}
            label="마케팅 정보 수신에 동의합니다."
            disabled={loading}
          />
        </fieldset>

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
            <span className="bg-[var(--color-bg-primary)] px-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              또는
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]/50 hover:bg-[var(--color-bg-secondary)]/40 disabled:opacity-60"
        >
          <GoogleMark />
          Google로 가입
        </button>
      </form>

      {/* 다음 단계 안내 — 박스 없이 미니멀 */}
      <div className="mt-10 border-t border-[var(--color-border-light)] pt-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {ROLE_META[role].nextStepsTitle}
        </p>
        <ol className="mt-4 space-y-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {ROLE_META[role].nextSteps.map((s, i) => (
            <li key={s} className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[11px] font-semibold tabular-nums text-[var(--color-text-secondary)]">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────

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

function ConsentRow({
  id,
  checked,
  onChange,
  label,
  linkHref,
  required,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  linkHref?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--color-border-default)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/40 disabled:cursor-not-allowed disabled:opacity-60"
        aria-required={required}
      />
      <label
        htmlFor={id}
        className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-relaxed text-[var(--color-text-secondary)]"
      >
        <span>
          <span
            className={
              required
                ? "font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-tertiary)]"
            }
          >
            ({required ? "필수" : "선택"})
          </span>{" "}
          {label}
        </span>
        {linkHref && (
          <Link
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-accent)] underline hover:opacity-80"
          >
            전문 보기
          </Link>
        )}
      </label>
    </div>
  );
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
