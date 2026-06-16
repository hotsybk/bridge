"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { MinimalFooter } from "@/components/marketing/minimal-footer";
import { storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";
import { trpc } from "@/lib/trpc/client";
import {
  formatBizRegNo,
  hospitalOnboardSchema,
  type HospitalOnboardInput,
} from "@/lib/validators/hospital";

/**
 * /onboarding/buyer — 병원 가입 4단계 위저드 (premium-line 리뉴얼).
 *
 * 디자인 DNA:
 *  - 박스/카드 제거. 라인 + 큰 숫자(01·02·03·04) + 굵은 타이포로 단계 구분
 *  - 입력 필드는 bottom-border line only
 *  - 업로드 dropzone — 점선 라인 영역 + drag-over 글로우
 *  - 완료 화면 — accent glow + 큰 체크 + divider 정보 리스트
 */

const STEPS = [
  { id: 1, num: "01", label: "사업자등록증" },
  { id: 2, num: "02", label: "병원 정보" },
  { id: 3, num: "03", label: "자동 검증" },
  { id: 4, num: "04", label: "가입 완료" },
] as const;

const HOSPITAL_TYPE_OPTIONS: Array<{
  value: HospitalOnboardInput["type"];
  label: string;
  sub: string;
}> = [
  { value: "CLINIC", label: "의원", sub: "1~30 병상" },
  { value: "SMALL_HOSPITAL", label: "중소병원", sub: "30~100 병상" },
  { value: "GENERAL_HOSPITAL", label: "종합병원", sub: "100~500 병상" },
  { value: "TERTIARY", label: "상급종합", sub: "500+ 병상" },
  { value: "ORIENTAL", label: "한방", sub: "" },
  { value: "DENTAL", label: "치과", sub: "" },
];

const AUTO_STEPS: Array<{
  num: string;
  label: string;
  hint: string;
  tag: string;
}> = [
  {
    num: "01",
    label: "사업자등록번호 추출",
    hint: "OCR로 등록번호를 자동 인식",
    tag: "0.3초",
  },
  {
    num: "02",
    label: "회사·대표자·소재지 자동 입력",
    hint: "다음 단계 폼이 미리 채워집니다",
    tag: "1초",
  },
  {
    num: "03",
    label: "국세청 진위 확인",
    hint: "유효 사업자 여부 실시간 검증",
    tag: "5초",
  },
];

export default function OnboardingBuyerPage() {
  const router = useRouter();
  const { user, forceRefreshToken } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState<Partial<HospitalOnboardInput>>({ type: "CLINIC" });
  const [error, setError] = useState<string | null>(null);

  const onboard = trpc.hospital.onboard.useMutation({
    onSuccess: async () => {
      try {
        await forceRefreshToken();
      } catch {
        /* Custom Claims 갱신 실패해도 doc 은 만들어졌으니 진행 */
      }
      setStep(4);
    },
    onError: (e) => {
      setError(e.message);
      setStep(2);
    },
  });

  async function onUpload() {
    if (!imageFile || !user) return;
    setUploading(true);
    setError(null);
    try {
      const ext = (imageFile.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `hospital-docs/${user.uid}/biz-reg-${Date.now()}.${ext}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, imageFile, { contentType: imageFile.type });
      const url = await getDownloadURL(ref);
      setImageUrl(url);
      setStep(2);
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(e2.message ?? "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function startValidation() {
    setError(null);
    const payload = { ...form, bizRegImageUrl: imageUrl } as HospitalOnboardInput;
    const parsed = hospitalOnboardSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
      return;
    }
    setStep(3);
    onboard.mutate(parsed.data);
  }

  function onFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setImageFile(file);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Top wordmark — line bottom only */}
      <header className="border-b border-[var(--color-border-light)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              MedPlace
            </span>
          </Link>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            병원 가입
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
        {/* Top stepper — 큰 숫자 + 가로 라인 */}
        <StepperRow step={step} />

        {/* Content */}
        <section className="mt-16 md:mt-20">
          {step === 1 && (
            <StepHeader
              num="01"
              title="사업자등록증을 올려주세요"
              description="자동 인식 + 채우기 — 10초면 끝납니다."
            >
              <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:gap-16">
                {/* 좌측 — 자동 처리 안내 + 보안 안내 */}
                <div className="order-2 flex flex-col lg:order-1 lg:h-full">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    업로드 후 자동 처리
                  </p>
                  <ol className="mt-6 flex flex-1 flex-col justify-center divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                    {AUTO_STEPS.map((s) => (
                      <li
                        key={s.num}
                        className="flex items-center gap-5 py-6 lg:py-7"
                      >
                        <span className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
                          {s.num}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {s.label}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                            {s.hint}
                          </p>
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                          {s.tag}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <p className="mt-8 max-w-sm text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                    업로드된 서류는 암호화되어 보관되며, 입점 심사 외
                    어떠한 용도로도 사용되지 않습니다.
                  </p>
                </div>

                {/* 우측 — 문서 dropzone */}
                <label
                  htmlFor="bizRegFile"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onFileDrop}
                  className={`group order-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all lg:order-2 lg:h-full ${
                    dragOver
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/30 shadow-[0_0_0_8px_var(--color-accent-light)]"
                      : "border-[var(--color-border-light)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)]/40"
                  }`}
                >
                  {/* 사업자등록증 mockup SVG */}
                  <DocumentMock
                    state={imageFile ? "filled" : dragOver ? "dragOver" : "idle"}
                  />

                  {/* 안내 텍스트 */}
                  <div className="mt-6 text-center">
                    {imageFile ? (
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        <span className="inline-flex items-center gap-1.5 text-[var(--color-accent)]">
                          <Check
                            className="h-3.5 w-3.5"
                            strokeWidth={3}
                            aria-hidden
                          />
                          업로드 준비 완료
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        파일을 끌어다 놓거나{" "}
                        <span className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/40 underline-offset-4">
                          파일 선택
                        </span>
                      </p>
                    )}
                    <p className="mt-1 text-[11px] tracking-wide text-[var(--color-text-tertiary)]">
                      JPG · PNG · PDF · 최대 10MB
                    </p>
                  </div>

                  <input
                    id="bizRegFile"
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* 선택된 파일 — line row */}
              {imageFile && (
                <div className="row-fade-in mt-6 flex items-center justify-between border-y border-[var(--color-border-light)] py-4 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--color-text-primary)]">
                        {imageFile.name}
                      </p>
                      <p className="text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                        {(imageFile.size / 1024).toFixed(1)} KB · 업로드 대기 중
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    className="ml-3 shrink-0 text-xs font-medium text-[var(--color-text-tertiary)] underline-offset-2 transition-colors hover:text-[var(--color-text-primary)] hover:underline"
                  >
                    변경
                  </button>
                </div>
              )}

              {error && <ErrorBanner message={error} />}

              {/* CTA */}
              <div className="mt-12 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  업로드와 동시에 다음 단계로 자동 전환됩니다
                </p>
                <button
                  type="button"
                  onClick={onUpload}
                  disabled={!imageFile || uploading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-40"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      업로드 중
                    </>
                  ) : (
                    <>
                      다음 단계로
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </StepHeader>
          )}

          {step === 2 && (
            <StepHeader
              num="02"
              title="병원 정보를 입력해주세요"
              description="모든 필수 항목을 채워야 다음 단계로 진행됩니다"
            >
              <div className="space-y-10">
                <FieldRow>
                  <LineField
                    id="bizRegNo"
                    label="사업자등록번호"
                    placeholder="123-45-67890"
                    inputMode="numeric"
                    autoComplete="off"
                    enterKeyHint="next"
                    value={form.bizRegNo ?? ""}
                    onChange={(v) =>
                      setForm({ ...form, bizRegNo: formatBizRegNo(v) })
                    }
                  />
                  <LineField
                    id="name"
                    label="병원명"
                    placeholder="예: 서울메디컬의원"
                    autoComplete="organization"
                    enterKeyHint="next"
                    value={form.name ?? ""}
                    onChange={(v) => setForm({ ...form, name: v })}
                  />
                </FieldRow>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    병원 유형
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {HOSPITAL_TYPE_OPTIONS.map((opt) => {
                      const active = form.type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm({ ...form, type: opt.value })}
                          className={`group flex flex-col items-start gap-1 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                            active
                              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/60"
                              : "border-[var(--color-border-light)] hover:border-[var(--color-text-tertiary)]"
                          }`}
                        >
                          <span
                            className={`text-sm font-medium ${
                              active ? "text-[var(--color-accent)]" : ""
                            }`}
                          >
                            {opt.label}
                          </span>
                          {opt.sub && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">
                              {opt.sub}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FieldRow>
                  <LineField
                    id="ceoName"
                    label="대표자명"
                    placeholder="홍길동"
                    autoComplete="name"
                    enterKeyHint="next"
                    value={form.ceoName ?? ""}
                    onChange={(v) => setForm({ ...form, ceoName: v })}
                  />
                  <LineField
                    id="phone"
                    label="전화번호"
                    placeholder="02-1234-5678"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="next"
                    value={form.phone ?? ""}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                </FieldRow>

                <LineField
                  id="email"
                  label="이메일"
                  type="email"
                  placeholder="hospital@example.com"
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="next"
                  value={form.email ?? ""}
                  onChange={(v) => setForm({ ...form, email: v })}
                />

                <div className="grid grid-cols-[120px_1fr] gap-6">
                  <LineField
                    id="zipcode"
                    label="우편번호"
                    placeholder="06236"
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    enterKeyHint="next"
                    value={form.zipcode ?? ""}
                    onChange={(v) =>
                      setForm({ ...form, zipcode: v.replace(/[^0-9]/g, "") })
                    }
                  />
                  <LineField
                    id="address"
                    label="주소"
                    placeholder="서울특별시 강남구 테헤란로 123"
                    autoComplete="street-address"
                    enterKeyHint="next"
                    value={form.address ?? ""}
                    onChange={(v) => setForm({ ...form, address: v })}
                  />
                </div>

                <LineField
                  id="addressDetail"
                  label="상세주소"
                  hint="선택"
                  placeholder="5층 502호"
                  autoComplete="address-line2"
                  enterKeyHint="next"
                  value={form.addressDetail ?? ""}
                  onChange={(v) => setForm({ ...form, addressDetail: v })}
                />

                <LineField
                  id="ykiho"
                  label="요양기관번호"
                  hint="선택 · 8자리"
                  maxLength={8}
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={form.ykiho ?? ""}
                  onChange={(v) =>
                    setForm({ ...form, ykiho: v.replace(/[^0-9]/g, "") })
                  }
                />

                {error && <ErrorBanner message={error} />}
              </div>

              <div className="mt-12 flex flex-col-reverse gap-3 md:flex-row md:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={startValidation}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  자동 검증 시작
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </StepHeader>
          )}

          {step === 3 && (
            <StepHeader
              num="03"
              title="사업자 정보 확인 중"
              description="OCR · 국세청 진위확인 · 등록 자동 처리."
            >
              <div className="flex flex-col items-center gap-12 py-16">
                {/* Glow ring + spinner */}
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 animate-pulse rounded-full bg-[var(--color-accent-light)] blur-2xl"
                  />
                  <span className="grid h-24 w-24 place-items-center rounded-full bg-[var(--color-accent-light)]">
                    <Loader2 className="h-10 w-10 animate-spin text-[var(--color-accent)]" />
                  </span>
                </div>

                {/* Timeline — line dividers only */}
                <div className="w-full max-w-md">
                  <ProgressTimeline
                    items={[
                      { label: "사업자등록증 인식", status: "done" },
                      { label: "국세청 진위 확인", status: "current" },
                      { label: "병원 정보 등록", status: "pending" },
                    ]}
                  />
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  보통 10~30초 안에 완료됩니다
                </p>
              </div>
            </StepHeader>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center text-center">
              {/* Giant check + glow */}
              <div className="relative mt-4">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-full bg-[var(--color-accent-light)] blur-3xl"
                />
                <span className="grid h-28 w-28 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_0_0_16px_var(--color-accent-light)]">
                  <Check className="h-12 w-12" strokeWidth={3} aria-hidden />
                </span>
              </div>

              <p className="mt-10 text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Step 04
              </p>
              <h1 className="mt-3 max-w-2xl break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
                가입이 완료됐습니다
              </h1>
              <p className="mt-4 max-w-md text-sm text-[var(--color-text-secondary)]">
                이제 의료기기·소모품을 둘러보고
                <br className="md:hidden" /> 바로 주문할 수 있습니다
              </p>

              {/* Summary — divider only */}
              <dl className="mt-12 w-full max-w-md divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <SummaryRow label="병원명" value={form.name ?? "—"} />
                <SummaryRow
                  label="사업자번호"
                  value={form.bizRegNo ?? "—"}
                  mono
                />
                <SummaryRow
                  label="유형"
                  value={
                    HOSPITAL_TYPE_OPTIONS.find((o) => o.value === form.type)
                      ?.label ?? "—"
                  }
                />
                <SummaryRow label="대표자명" value={form.ceoName ?? "—"} />
              </dl>

              <div className="mt-12 flex w-full max-w-md flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    router.replace("/");
                    router.refresh();
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  병원 운영 시작하기
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/search"
                  className="inline-flex h-11 w-full items-center justify-center text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  먼저 상품부터 둘러볼게요 →
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
      <MinimalFooter />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stepper — 상단 가로형 큰 숫자 + 라인 progress
// ─────────────────────────────────────────────────────────────

function StepperRow({ step }: { step: 1 | 2 | 3 | 4 }) {
  const progress = ((step - 1) / 3) * 100;
  const currentStep = STEPS[step - 1];
  return (
    <div>
      {/* 모바일 — 단일 라인 stepper (320px 에서도 truncate 없음) */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            Step <span className="tabular-nums text-[var(--color-accent)]">{currentStep.num}</span> of 04
          </p>
          <p className="text-sm font-semibold tracking-tight">
            {currentStep.label}
          </p>
        </div>
        {/* 모바일 진행 bar — 두께 4px */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-700 ease-out"
            style={{ width: `${((step) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* 데스크탑 — 기존 4단계 grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isDone = s.id < step;
            const isCurrent = s.id === step;
            return (
              <div key={s.id} className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-semibold tabular-nums transition-colors md:text-3xl ${
                      isDone || isCurrent
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-text-tertiary)]/40"
                    }`}
                  >
                    {s.num}
                  </span>
                  {isDone && (
                    <Check
                      className="h-4 w-4 text-[var(--color-accent)]"
                      strokeWidth={3}
                      aria-hidden
                    />
                  )}
                </div>
                <p
                  className={`mt-1 truncate text-xs font-medium transition-colors md:text-sm ${
                    isDone || isCurrent
                      ? "text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-tertiary)]/60"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Progress line */}
        <div className="relative mt-6 h-px w-full bg-[var(--color-border-light)]">
          <div
            className="absolute left-0 top-0 h-px bg-[var(--color-accent)] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StepHeader — 큰 숫자 + 굵은 타이포 헤더
// ─────────────────────────────────────────────────────────────

function StepHeader({
  num,
  title,
  description,
  children,
}: {
  num: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        Step {num}
      </p>
      <h1 className="mt-3 max-w-2xl break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-xl text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
      <div className="mt-10 md:mt-12">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LineField — 박스 없는 bottom-border line input
// ─────────────────────────────────────────────────────────────

function LineField({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  inputMode,
  autoComplete,
  enterKeyHint,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoComplete?: string;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
}) {
  return (
    <div className="group">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
        >
          {label}
        </label>
        {hint && (
          <span className="text-[11px] text-[var(--color-text-tertiary)]/70">
            {hint}
          </span>
        )}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        className="mt-2 h-11 w-full border-b border-[var(--color-border-default)] bg-transparent text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)]/50 focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 md:grid-cols-2">{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// ProgressTimeline — 라인 + dot
// ─────────────────────────────────────────────────────────────

function ProgressTimeline({
  items,
}: {
  items: Array<{ label: string; status: "done" | "current" | "pending" }>;
}) {
  return (
    <ol className="relative ml-3 border-l border-[var(--color-border-light)]">
      {items.map((it, i) => (
        <li key={i} className="relative py-3 pl-6">
          <span
            aria-hidden
            className={`absolute -left-[7px] top-4 grid h-3.5 w-3.5 place-items-center rounded-full transition-all ${
              it.status === "done"
                ? "bg-[var(--color-accent)]"
                : it.status === "current"
                  ? "status-pulse-dot bg-[var(--color-accent)] shadow-[0_0_0_4px_var(--color-accent-light)]"
                  : "border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
            }`}
          >
            {it.status === "done" && (
              <Check
                className="h-2.5 w-2.5 text-white"
                strokeWidth={4}
                aria-hidden
              />
            )}
          </span>
          <p
            className={`text-sm font-medium ${
              it.status === "pending"
                ? "text-[var(--color-text-tertiary)]"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {it.label}
          </p>
          {it.status === "current" && (
            <p className="mt-0.5 text-xs text-[var(--color-accent)]">
              진행 중…
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryRow — 완료 화면 정보 한 줄
// ─────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ErrorBanner — 라인 underline only
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// DocumentMock — 사업자등록증 mockup SVG (idle / dragOver / filled)
// ─────────────────────────────────────────────────────────────

function DocumentMock({
  state,
}: {
  state: "idle" | "dragOver" | "filled";
}) {
  const isActive = state !== "idle";
  return (
    <div
      className={`relative w-full max-w-[280px] transition-all duration-300 ${
        state === "dragOver"
          ? "scale-[1.03]"
          : state === "filled"
            ? "scale-[1.01]"
            : "group-hover:scale-[1.02]"
      }`}
      aria-hidden
    >
      <svg
        viewBox="0 0 280 360"
        className="h-auto w-full drop-shadow-[0_18px_30px_rgba(15,15,15,0.06)]"
      >
        {/* Paper */}
        <rect
          x="10"
          y="6"
          width="260"
          height="348"
          rx="10"
          fill="var(--color-bg-primary)"
          stroke={
            isActive
              ? "var(--color-accent)"
              : "var(--color-border-light)"
          }
          strokeWidth={isActive ? 1.5 : 1}
        />

        {/* Corner fold (decorative) */}
        <path
          d="M 230 6 L 270 6 L 270 46 Z"
          fill="var(--color-bg-secondary)"
        />
        <path
          d="M 230 6 L 230 46 L 270 46 Z"
          fill="var(--color-bg-tertiary)"
        />

        {/* Header */}
        <text
          x="30"
          y="44"
          fontSize="13"
          fontWeight="600"
          fill="var(--color-text-primary)"
          fontFamily="inherit"
        >
          사업자등록증
        </text>
        <text
          x="30"
          y="58"
          fontSize="7"
          letterSpacing="1.2"
          fill="var(--color-text-tertiary)"
          fontFamily="inherit"
        >
          BUSINESS REGISTRATION
        </text>

        {/* Divider */}
        <line
          x1="30"
          y1="74"
          x2="250"
          y2="74"
          stroke={
            isActive
              ? "var(--color-accent)"
              : "var(--color-border-light)"
          }
          strokeWidth="1"
        />

        {/* Fields */}
        {[
          { y: 100, label: "등록번호", filledWidth: 90 },
          { y: 130, label: "상호", filledWidth: 120 },
          { y: 160, label: "대표자", filledWidth: 70 },
          { y: 190, label: "업태", filledWidth: 100 },
          { y: 220, label: "종목", filledWidth: 140 },
          { y: 250, label: "소재지", filledWidth: 150 },
        ].map((f, i) => (
          <g key={i}>
            <text
              x="30"
              y={f.y}
              fontSize="8"
              fill="var(--color-text-tertiary)"
              fontFamily="inherit"
            >
              {f.label}
            </text>
            {/* Field line — accent fill if active */}
            <line
              x1="80"
              y1={f.y - 2}
              x2="250"
              y2={f.y - 2}
              stroke="var(--color-border-light)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {state === "filled" && (
              <line
                x1="80"
                y1={f.y - 2}
                x2={80 + f.filledWidth}
                y2={f.y - 2}
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                className="document-field-fill"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            )}
          </g>
        ))}

        {/* 두번째 줄 소재지 */}
        <line
          x1="80"
          y1="268"
          x2="250"
          y2="268"
          stroke="var(--color-border-light)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />

        {/* Seal */}
        <g>
          <circle
            cx="210"
            cy="310"
            r="26"
            fill="none"
            stroke={
              isActive
                ? "var(--color-accent)"
                : "var(--color-border-default)"
            }
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
          />
          <text
            x="210"
            y="306"
            textAnchor="middle"
            fontSize="7"
            fill={
              isActive
                ? "var(--color-accent)"
                : "var(--color-text-tertiary)"
            }
            fontFamily="inherit"
          >
            국세청
          </text>
          <text
            x="210"
            y="318"
            textAnchor="middle"
            fontSize="6"
            letterSpacing="0.8"
            fill={
              isActive
                ? "var(--color-accent)"
                : "var(--color-text-tertiary)"
            }
            fontFamily="inherit"
          >
            NTS
          </text>
        </g>
      </svg>

      {/* Filled overlay — center accent check */}
      {state === "filled" && (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_0_0_12px_var(--color-accent-light)]">
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
        </span>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      key={message}
      className="error-slide-down mt-4 flex items-start gap-2 border-l-2 border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-2.5 text-sm text-[var(--color-error)]"
      role="alert"
    >
      <span aria-hidden className="mt-0.5">⚠</span>
      <span>{message}</span>
    </div>
  );
}
