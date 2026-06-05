"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { trpc } from "@/lib/trpc/client";

/**
 * Wave AA — /support/contact 의 client-side 문의 폼.
 *
 * tRPC `support.submitInquiry` 를 호출하고, 성공 시 인라인 컨펌 카드로 전환.
 * 토스트 인프라가 없으므로 폼 자체가 confirmation state 로 바뀐다.
 */

type Category = "ACCOUNT" | "PAYMENT" | "ORDER" | "ONBOARDING" | "OTHER";

const CATEGORY_OPTIONS: Array<{ value: Category; label: string; hint: string }> = [
  { value: "ACCOUNT", label: "계정·로그인", hint: "가입·비밀번호·권한" },
  { value: "PAYMENT", label: "결제·정산", hint: "결제 실패·환불·세금계산서" },
  { value: "ORDER", label: "주문·배송", hint: "출고·추적·반품" },
  { value: "ONBOARDING", label: "공급업체 입점", hint: "심사·서류·상품 등록" },
  { value: "OTHER", label: "기타", hint: "위 항목에 해당하지 않는 문의" },
];

export function ContactForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<Category>("OTHER");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = trpc.support.submitInquiry.useMutation();

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "이름을 입력해주세요.";
    if (!email.trim()) next.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "올바른 이메일 형식이 아닙니다.";
    if (message.trim().length < 10)
      next.message = "문의 내용은 10자 이상 작성해주세요.";
    if (message.trim().length > 2000)
      next.message = "문의 내용은 2000자 이하로 작성해주세요.";
    if (!consent) next.consent = "개인정보 수집 및 이용에 동의해주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await submit.mutateAsync({
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        category,
        message: message.trim(),
        consentToPrivacy: true as const,
      });
    } catch {
      // tRPC mutation error 는 submit.error 로 노출됨 — 별도 처리 불필요
    }
  }

  function reset() {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setCategory("OTHER");
    setMessage("");
    setConsent(false);
    setErrors({});
    submit.reset();
  }

  // ── Success state ──────────────────────────────────────────
  if (submit.isSuccess && submit.data?.ok) {
    return (
      <div className="border-y border-[var(--color-border-light)] py-16">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
            <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              접수 완료
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)] tabular-nums">
              접수 번호 · {submit.data.inquiryId.slice(0, 10).toUpperCase()}
            </p>
          </div>
        </div>

        <h2 className="mt-8 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          문의가 접수되었습니다.
        </h2>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-[var(--color-text-secondary)]">
          영업일 기준 24시간 이내 등록하신 이메일로 답변드립니다.
          긴급한 사안은 우선 처리되며, 답변 전 추가 정보가 필요하면 운영팀이
          먼저 연락드릴 수 있습니다.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            새 문의 작성
          </button>
          <a
            href="/support"
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white active:scale-[0.98]"
          >
            지원 허브로
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
        문의 폼
      </p>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        무엇을 도와드릴까요?
      </h2>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        모든 항목은 운영팀만 열람합니다. 필수 항목에는{" "}
        <span className="text-[var(--color-accent)]">*</span> 표시.
      </p>

      <div className="mt-12 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        <Field
          label="이름"
          required
          error={errors.name}
          input={
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              maxLength={80}
              className={inputCls}
              autoComplete="name"
            />
          }
        />

        <Field
          label="회사명/병원명"
          input={
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="○○병원 또는 ○○메디칼"
              maxLength={120}
              className={inputCls}
              autoComplete="organization"
            />
          }
        />

        <Field
          label="이메일"
          required
          error={errors.email}
          input={
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospital.kr"
              className={inputCls}
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
            />
          }
        />

        <Field
          label="전화번호"
          input={
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              maxLength={40}
              className={inputCls}
              autoComplete="tel"
              inputMode="tel"
              enterKeyHint="next"
            />
          }
        />

        <Field
          label="문의 카테고리"
          required
          input={
            <div className="grid gap-2">
              {CATEGORY_OPTIONS.map((opt) => {
                const active = category === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/40"
                        : "border-[var(--color-border-light)] hover:border-[var(--color-text-tertiary)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={opt.value}
                      checked={active}
                      onChange={() => setCategory(opt.value)}
                      className="mt-1 accent-[var(--color-accent)]"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          }
        />

        <Field
          label="내용"
          required
          error={errors.message}
          hint={`${message.length} / 2000자`}
          input={
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="문의 내용을 10자 이상 작성해주세요. 주문번호·상품ID 가 있으면 함께 적어주시면 빠르게 확인할 수 있습니다."
              className={`${inputCls} resize-y leading-relaxed`}
            />
          }
        />
      </div>

      {/* 동의 + 제출 */}
      <div className="mt-10 space-y-6">
        <label
          className={`flex cursor-pointer items-start gap-3 text-sm ${
            errors.consent ? "text-[var(--color-error)]" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="leading-relaxed">
            <span className="font-medium text-[var(--color-text-primary)]">
              개인정보 수집·이용 동의 (필수)
            </span>
            <span className="mt-1 block text-xs text-[var(--color-text-tertiary)]">
              문의 응대를 위해 이름·이메일·전화번호·문의 내용을 수집하며,
              응대 완료 후 3년간 보관 후 파기합니다. 자세한 내용은{" "}
              <a
                href="/legal/privacy"
                className="text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                개인정보처리방침
              </a>
              을 참고해주세요.
            </span>
          </span>
        </label>
        {errors.consent ? (
          <p className="-mt-2 text-xs text-[var(--color-error)]">
            {errors.consent}
          </p>
        ) : null}

        {submit.error ? (
          <p className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-xs text-[var(--color-error)]">
            제출에 실패했습니다 — {submit.error.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={submit.isPending}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-accent)] px-8 text-sm font-medium text-white transition-opacity disabled:opacity-60 active:scale-[0.98]"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                제출 중...
              </>
            ) : (
              <>
                문의 보내기
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            전송 내용은 운영팀만 열람합니다.
          </p>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Field — 라벨 + input + error + hint
// ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20";

function Field({
  label,
  required,
  error,
  hint,
  input,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  input: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 py-6 md:grid-cols-[180px_1fr] md:gap-8">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
          {required ? (
            <span className="ml-1 text-[var(--color-accent)]">*</span>
          ) : null}
        </p>
        {hint ? (
          <p className="mt-1 text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div>
        {input}
        {error ? (
          <p className="mt-2 text-xs text-[var(--color-error)]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
