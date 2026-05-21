"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimelineList } from "@/components/shared/timeline-list";
import { WizardStepper } from "@/components/shared/wizard-stepper";
import { storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";
import { trpc } from "@/lib/trpc/client";
import {
  formatBizRegNo,
  hospitalOnboardSchema,
  type HospitalOnboardInput,
} from "@/lib/validators/hospital";

const STEPS = [
  { id: 1, label: "사업자등록증" },
  { id: 2, label: "병원 정보" },
  { id: 3, label: "검증" },
  { id: 4, label: "완료" },
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

export default function OnboardingBuyerPage() {
  const router = useRouter();
  const { user, forceRefreshToken } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

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

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Top wordmark */}
      <header className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              MedPlace
            </span>
          </Link>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            병원 가입 — Step {step} / 4
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-[220px_1fr] md:px-12 md:py-16">
        {/* Stepper sidebar (data desktop) / horizontal (mobile) */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="md:hidden">
            <WizardStepper
              orientation="horizontal"
              steps={[...STEPS]}
              current={step}
            />
            <p className="mt-3 text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Step {step} / 4 · {STEPS[step - 1].label}
            </p>
          </div>
          <div className="hidden md:block">
            <WizardStepper
              orientation="vertical"
              steps={[...STEPS]}
              current={step}
              hint="처음 5분이면 충분합니다."
            />
          </div>
        </aside>

        {/* Content */}
        <section className="min-w-0">
          {step === 1 && (
            <StepContainer
              eyebrow="Step 1"
              title="사업자등록증을 올려주세요"
              description="이미지 또는 PDF, 10MB 이하"
            >
              <label
                htmlFor="bizRegFile"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-12 text-center transition-colors hover:border-[var(--color-accent)]"
              >
                <CloudUpload
                  className="h-10 w-10 text-[var(--color-text-tertiary)]"
                  aria-hidden
                />
                <div>
                  <p className="text-base font-medium">
                    파일을 끌어다 놓거나 클릭해서 선택
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    JPG · PNG · PDF · 최대 10MB
                  </p>
                </div>
                <input
                  id="bizRegFile"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                  disabled={uploading}
                />
              </label>

              {imageFile && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--color-bg-secondary)] p-3 text-sm">
                  <span className="truncate font-medium">{imageFile.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-[var(--color-text-tertiary)]">
                    {(imageFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}

              {error && <ErrorBox message={error} />}

              <button
                type="button"
                onClick={onUpload}
                disabled={!imageFile || uploading}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    업로드 중...
                  </>
                ) : (
                  <>
                    업로드 후 다음
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer
              eyebrow="Step 2"
              title="병원 정보를 입력해주세요"
              description="모든 필수 항목을 채워야 다음 단계로 진행됩니다"
            >
              <div className="space-y-5">
                <FieldRow>
                  <div className="space-y-2">
                    <Label htmlFor="bizRegNo">사업자등록번호</Label>
                    <Input
                      id="bizRegNo"
                      placeholder="123-45-67890"
                      inputMode="numeric"
                      value={form.bizRegNo ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, bizRegNo: formatBizRegNo(e.target.value) })
                      }
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">병원명</Label>
                    <Input
                      id="name"
                      value={form.name ?? ""}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </FieldRow>

                <div className="space-y-2">
                  <Label>병원 유형</Label>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {HOSPITAL_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: opt.value })}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          form.type === opt.value
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
                            : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-default)] hover:shadow-sm"
                        }`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        {opt.sub && (
                          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                            {opt.sub}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <FieldRow>
                  <div className="space-y-2">
                    <Label htmlFor="ceoName">대표자명</Label>
                    <Input
                      id="ceoName"
                      value={form.ceoName ?? ""}
                      onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input
                      id="phone"
                      placeholder="02-1234-5678"
                      value={form.phone ?? ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </FieldRow>

                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="zipcode">우편번호</Label>
                    <Input
                      id="zipcode"
                      placeholder="06236"
                      maxLength={5}
                      inputMode="numeric"
                      value={form.zipcode ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, zipcode: e.target.value.replace(/[^0-9]/g, "") })
                      }
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">주소</Label>
                    <Input
                      id="address"
                      value={form.address ?? ""}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressDetail">상세주소 (선택)</Label>
                  <Input
                    id="addressDetail"
                    value={form.addressDetail ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, addressDetail: e.target.value })
                    }
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ykiho">
                    요양기관번호{" "}
                    <span className="text-[var(--color-text-tertiary)]">(선택, 8자리)</span>
                  </Label>
                  <Input
                    id="ykiho"
                    maxLength={8}
                    inputMode="numeric"
                    value={form.ykiho ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, ykiho: e.target.value.replace(/[^0-9]/g, "") })
                    }
                    className="h-12 rounded-xl"
                  />
                </div>

                {error && <ErrorBox message={error} />}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={startValidation}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  검증 시작
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer
              eyebrow="Step 3"
              title="사업자 정보를 확인하고 있습니다"
              description="OCR · 국세청 진위확인 · 등록을 자동으로 진행 중입니다"
            >
              <div className="flex flex-col items-center gap-8 py-10">
                <span
                  className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-accent-light)]"
                  aria-hidden
                >
                  <Loader2 className="h-10 w-10 animate-spin text-[var(--color-accent)]" />
                </span>
                <div className="w-full max-w-md">
                  <TimelineList
                    items={[
                      { label: "사업자등록증 인식 완료", status: "done" },
                      { label: "국세청 진위 확인 중", status: "current" },
                      { label: "등록 처리 대기", status: "pending" },
                    ]}
                  />
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  보통 10~30초 안에 완료됩니다.
                </p>
              </div>
            </StepContainer>
          )}

          {step === 4 && (
            <StepContainer
              eyebrow="Step 4"
              title="가입이 완료됐습니다"
              description="병원 정보가 안전하게 등록되었습니다"
            >
              <div className="flex flex-col items-center gap-6 py-10">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-success)]/12 text-[var(--color-success)]">
                  <CheckCircle2 className="h-10 w-10" aria-hidden />
                </span>

                <dl className="grid w-full max-w-md gap-3 rounded-2xl bg-[var(--color-bg-secondary)] p-5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-secondary)]">병원명</dt>
                    <dd className="font-medium">{form.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-secondary)]">사업자번호</dt>
                    <dd className="font-mono tabular-nums">{form.bizRegNo}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-secondary)]">유형</dt>
                    <dd className="font-medium">
                      {HOSPITAL_TYPE_OPTIONS.find((o) => o.value === form.type)?.label}
                    </dd>
                  </div>
                </dl>

                <p className="max-w-md text-center text-sm text-[var(--color-text-secondary)]">
                  이제 의료기기·소모품을 둘러보고 주문할 수 있습니다.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    router.replace("/");
                    router.refresh();
                  }}
                  className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  병원 운영 시작하기
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </StepContainer>
          )}
        </section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────────────────────

function StepContainer({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] md:text-base">
          {description}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 p-3 text-sm text-[var(--color-error)]"
      role="alert"
    >
      <span aria-hidden className="mt-0.5">⚠</span>
      <span>{message}</span>
    </div>
  );
}
