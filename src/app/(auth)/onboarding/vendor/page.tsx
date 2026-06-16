"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  CloudUpload,
  FileText,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { MinimalFooter } from "@/components/marketing/minimal-footer";
import { storage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";
import { trpc } from "@/lib/trpc/client";
import { formatBizRegNo } from "@/lib/validators/biz-reg";
import {
  BANK_OPTIONS,
  VENDOR_CATEGORY_OPTIONS,
  VENDOR_TYPE_OPTIONS,
  vendorOnboardSchema,
  type VendorOnboardInput,
} from "@/lib/validators/vendor";

/**
 * /onboarding/vendor — 공급업체 입점 5단계 위저드 (premium-line 리뉴얼).
 *
 * 디자인 DNA:
 *  - 박스/카드 제거. 큰 숫자(01·02·03·04·05) + 라인 + 굵은 타이포
 *  - 입력은 bottom-border line input
 *  - 드롭존은 점선 라인 영역 (drag-over 글로우)
 *  - 심사 대기 화면 — accent glow + timeline + 안내 divider list
 */

const STEPS = [
  { id: 1, num: "01", label: "회사 정보" },
  { id: 2, num: "02", label: "서류 업로드" },
  { id: 3, num: "03", label: "정산 계좌" },
  { id: 4, num: "04", label: "카테고리·약관" },
  { id: 5, num: "05", label: "심사 대기" },
] as const;

type FormState = Partial<VendorOnboardInput> & {
  vendorType: "DISTRIBUTOR" | "MANUFACTURER" | "IMPORTER";
  categories: VendorOnboardInput["categories"];
};

async function uploadVendorDoc(uid: string, file: File, kind: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `vendor-docs/${uid}/${kind}-${Date.now()}.${ext}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  return getDownloadURL(ref);
}

export default function OnboardingVendorPage() {
  const router = useRouter();
  const { user, forceRefreshToken } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState<FormState>({
    vendorType: "DISTRIBUTOR",
    categories: [],
  });

  const [bizRegFile, setBizRegFile] = useState<File | null>(null);
  const [salesLicenseFile, setSalesLicenseFile] = useState<File | null>(null);
  const [manufactureFile, setManufactureFile] = useState<File | null>(null);

  const onboard = trpc.vendor.onboard.useMutation({
    onSuccess: async () => {
      try {
        await forceRefreshToken();
      } catch {
        /* doc 은 만들어졌으니 진행 */
      }
      setStep(5);
    },
    onError: (e) => {
      setError(e.message);
      setStep(4);
    },
  });

  function toggleCategory(value: VendorOnboardInput["categories"][number]) {
    const has = form.categories.includes(value);
    setForm({
      ...form,
      categories: has
        ? form.categories.filter((c) => c !== value)
        : [...form.categories, value],
    });
  }

  async function uploadAllAndAdvance() {
    if (!user || !bizRegFile) {
      setError("사업자등록증 이미지를 선택해주세요.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const next: Partial<VendorOnboardInput> = { ...form };
      next.bizRegImageUrl = await uploadVendorDoc(user.uid, bizRegFile, "biz-reg");

      if (form.vendorType === "DISTRIBUTOR") {
        if (!salesLicenseFile) {
          setError("판매업 신고증 이미지를 선택해주세요.");
          setUploading(false);
          return;
        }
        next.salesLicenseImageUrl = await uploadVendorDoc(
          user.uid,
          salesLicenseFile,
          "sales-license",
        );
      } else {
        if (!manufactureFile) {
          setError("제조/수입업 허가증 이미지를 선택해주세요.");
          setUploading(false);
          return;
        }
        next.manufactureLicenseUrl = await uploadVendorDoc(
          user.uid,
          manufactureFile,
          "manufacture-license",
        );
      }

      setForm(next as FormState);
      setStep(3);
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setError(e2.message ?? "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function startValidation() {
    setError(null);
    const candidate = { ...form } as VendorOnboardInput;
    const parsed = vendorOnboardSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
      return;
    }
    onboard.mutate(parsed.data);
  }

  const showSalesLicense = form.vendorType === "DISTRIBUTOR";
  const showManufactureLicense = !showSalesLicense;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="border-b border-[var(--color-border-light)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">MedPlace</span>
          </Link>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            공급업체 입점
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
        <StepperRow step={step} />

        <section className="mt-16 md:mt-20">
          {step === 1 && (
            <StepHeader
              num="01"
              title="회사 정보를 입력해주세요"
              description="공급업체의 기본 정보와 업체 구분을 선택합니다"
            >
              <div className="space-y-10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    업체 구분
                  </p>
                  <div className="mt-4 grid gap-2">
                    {VENDOR_TYPE_OPTIONS.map((opt) => {
                      const active = form.vendorType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm({ ...form, vendorType: opt.value })}
                          className={`flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
                            active
                              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/60"
                              : "border-[var(--color-border-light)] hover:border-[var(--color-text-tertiary)]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                active ? "text-[var(--color-accent)]" : ""
                              }`}
                            >
                              {opt.label}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              {opt.description}
                            </p>
                          </div>
                          <span
                            aria-hidden
                            className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                              active
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                : "border-[var(--color-border-default)]"
                            }`}
                          >
                            {active && (
                              <Check
                                className="h-3 w-3 text-white"
                                strokeWidth={3}
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                    id="companyName"
                    label="회사명"
                    placeholder="예: 메디서플라이"
                    autoComplete="organization"
                    enterKeyHint="next"
                    value={form.companyName ?? ""}
                    onChange={(v) => setForm({ ...form, companyName: v })}
                  />
                </FieldRow>

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
                  placeholder="contact@vendor.com"
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
                  enterKeyHint="done"
                  value={form.addressDetail ?? ""}
                  onChange={(v) => setForm({ ...form, addressDetail: v })}
                />

                {error && <ErrorBanner message={error} />}
              </div>

              <div className="mt-12 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  다음
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </StepHeader>
          )}

          {step === 2 && (
            <StepHeader
              num="02"
              title="필수 서류를 올려주세요"
              description={
                showSalesLicense
                  ? "사업자등록증 + 의료기기 판매업 신고증 (의료기기법 §17)"
                  : "사업자등록증 + 제조·수입업 허가증 (판매업 신고 면제 대상)"
              }
            >
              <div className="space-y-8">
                <LineDropzone
                  label="사업자등록증"
                  required
                  file={bizRegFile}
                  onChange={setBizRegFile}
                  disabled={uploading}
                />

                {showSalesLicense && (
                  <>
                    <LineField
                      id="salesLicenseNo"
                      label="판매업 신고번호"
                      placeholder="제2026-서울강남-001호"
                      autoComplete="off"
                      enterKeyHint="next"
                      value={form.salesLicenseNo ?? ""}
                      onChange={(v) => setForm({ ...form, salesLicenseNo: v })}
                    />
                    <LineDropzone
                      label="의료기기 판매업 신고증"
                      required
                      file={salesLicenseFile}
                      onChange={setSalesLicenseFile}
                      disabled={uploading}
                    />
                  </>
                )}

                {showManufactureLicense && (
                  <>
                    <div className="border-l-2 border-[var(--color-accent)] bg-[var(--color-accent-light)]/30 px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        의료기기법 §17
                      </span>{" "}
                      — 제조·수입업자가 직접 판매하는 경우 판매업 신고가
                      면제됩니다. 허가증 사본 1부를 업로드해주세요.
                    </div>
                    <LineDropzone
                      label="제조/수입업 허가증"
                      required
                      file={manufactureFile}
                      onChange={setManufactureFile}
                      disabled={uploading}
                    />
                  </>
                )}

                {error && <ErrorBanner message={error} />}
              </div>

              <div className="mt-12 flex flex-col-reverse gap-3 md:flex-row md:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={uploading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={uploadAllAndAdvance}
                  disabled={uploading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      업로드 중
                    </>
                  ) : (
                    <>
                      업로드 후 다음
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </StepHeader>
          )}

          {step === 3 && (
            <StepHeader
              num="03"
              title="정산 계좌를 입력해주세요"
              description="판매 정산금이 입금될 계좌 정보입니다"
            >
              <div className="space-y-10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                    은행
                  </p>
                  <select
                    id="payoutBankCode"
                    value={form.payoutBankCode ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, payoutBankCode: e.target.value })
                    }
                    className="mt-2 h-11 w-full border-b border-[var(--color-border-default)] bg-transparent text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  >
                    <option value="">은행 선택</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <LineField
                  id="payoutBankAccount"
                  label="계좌번호"
                  placeholder="123-456-789012"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="next"
                  value={form.payoutBankAccount ?? ""}
                  onChange={(v) => setForm({ ...form, payoutBankAccount: v })}
                />

                <LineField
                  id="payoutAccountHolder"
                  label="예금주명"
                  placeholder="(주)메디서플라이"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={form.payoutAccountHolder ?? ""}
                  onChange={(v) => setForm({ ...form, payoutAccountHolder: v })}
                />

                {error && <ErrorBanner message={error} />}
              </div>

              <div className="mt-12 flex flex-col-reverse gap-3 md:flex-row md:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  다음
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </StepHeader>
          )}

          {step === 4 && (
            <StepHeader
              num="04"
              title="영업 카테고리와 약관에 동의해주세요"
              description="다루는 도메인을 선택하고 입점 약관에 동의합니다"
            >
              <div className="space-y-12">
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      영업 카테고리
                    </p>
                    <span className="text-[11px] text-[var(--color-text-tertiary)]/70">
                      최소 1개
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {VENDOR_CATEGORY_OPTIONS.map((opt) => {
                      const checked = form.categories.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleCategory(opt.value)}
                          className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                            checked
                              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/60"
                              : "border-[var(--color-border-light)] hover:border-[var(--color-text-tertiary)]"
                          }`}
                        >
                          <span
                            className={`font-medium ${
                              checked ? "text-[var(--color-accent)]" : ""
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span
                            aria-hidden
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition-colors ${
                              checked
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                : "border-[var(--color-border-default)]"
                            }`}
                          >
                            {checked && (
                              <Check
                                className="h-2.5 w-2.5 text-white"
                                strokeWidth={4}
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                    약관 동의
                  </p>
                  <div className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                    <AgreementRow
                      checked={form.agreedTerms === true}
                      onChange={(v) =>
                        setForm({
                          ...form,
                          agreedTerms: (v === true ? true : (false as never)),
                        })
                      }
                      label="입점 약관에 동의합니다"
                    />
                    <AgreementRow
                      checked={form.agreedPrivacy === true}
                      onChange={(v) =>
                        setForm({
                          ...form,
                          agreedPrivacy: (v === true ? true : (false as never)),
                        })
                      }
                      label="개인정보 처리방침에 동의합니다"
                    />
                    <AgreementRow
                      checked={form.agreedCommission === true}
                      onChange={(v) =>
                        setForm({
                          ...form,
                          agreedCommission: (v === true ? true : (false as never)),
                        })
                      }
                      label="수수료 정책(기본 5%)에 동의합니다"
                    />
                  </div>
                </div>

                {error && <ErrorBanner message={error} />}
              </div>

              <div className="mt-12 flex flex-col-reverse gap-3 md:flex-row md:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={startValidation}
                  disabled={onboard.isPending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
                >
                  {onboard.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      심사 신청 중
                    </>
                  ) : (
                    <>
                      심사 신청
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </StepHeader>
          )}

          {step === 5 && (
            <div className="flex flex-col items-center text-center">
              <div className="relative mt-4">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 animate-pulse rounded-full bg-[var(--color-accent-light)] blur-3xl"
                />
                <span className="grid h-28 w-28 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_0_0_16px_var(--color-accent-light)]">
                  <Clock className="h-12 w-12" strokeWidth={2.4} aria-hidden />
                </span>
              </div>

              <p className="mt-10 text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Step 05
              </p>
              <h1 className="mt-3 max-w-2xl break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
                심사 신청이 접수됐습니다
              </h1>
              <p className="mt-4 max-w-md text-sm text-[var(--color-text-secondary)]">
                24~72시간 안에 등록 이메일과 알림톡으로
                <br className="md:hidden" /> 결과를 알려드립니다
              </p>

              <div className="mt-12 w-full max-w-md">
                <ProgressTimeline
                  items={[
                    { label: "서류 접수 완료", status: "done" },
                    { label: "운영자 심사 진행 중", status: "current" },
                    { label: "결과 통보 (이메일·알림톡)", status: "pending" },
                  ]}
                />
              </div>

              <dl className="mt-10 w-full max-w-md divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
                <InfoRow label="처리 시간" value="영업일 24~72시간" />
                <InfoRow label="추가 서류" value="필요 시 이메일로 안내" />
                <InfoRow label="셀러센터" value="승인 전까지 접근 제한" />
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
                  메인으로 돌아가기
                  <ArrowRight className="h-4 w-4" />
                </button>
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
// Stepper — 5단계 가로 큰 숫자 + 라인 progress
// ─────────────────────────────────────────────────────────────

function StepperRow({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  const progress = ((step - 1) / 4) * 100;
  const currentStep = STEPS[step - 1];
  return (
    <div>
      {/* 모바일 — 단일 라인 stepper (5개 가로 grid 는 320px 에서 빠듯) */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            Step <span className="tabular-nums text-[var(--color-accent)]">{currentStep.num}</span> of 05
          </p>
          <p className="text-sm font-semibold tracking-tight">
            {currentStep.label}
          </p>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-700 ease-out"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* 데스크탑 — 기존 5단계 grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-5 gap-2">
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
                      className="h-3.5 w-3.5 text-[var(--color-accent)]"
                      strokeWidth={3}
                      aria-hidden
                    />
                  )}
                </div>
                <p
                  className={`mt-1 truncate text-[11px] font-medium transition-colors md:text-xs ${
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
// StepHeader
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
// LineField — bottom-border line input
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
    <div>
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
// LineDropzone — drag-over glow
// ─────────────────────────────────────────────────────────────

function LineDropzone({
  label,
  required,
  file,
  onChange,
  disabled,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-")}`;
  const [dragOver, setDragOver] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onChange(f);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          {label}
        </p>
        {required && (
          <span className="text-[11px] font-medium text-[var(--color-accent)]">
            필수
          </span>
        )}
      </div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mt-3 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-5 transition-all ${
          disabled ? "opacity-60" : ""
        } ${
          file
            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/40"
            : dragOver
              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/30 shadow-[0_0_0_6px_var(--color-accent-light)]"
              : "border-[var(--color-border-default)] hover:border-[var(--color-accent)]"
        }`}
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
            file
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]"
          }`}
        >
          {file ? (
            <FileText className="h-4 w-4" />
          ) : (
            <CloudUpload className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {file ? (
            <>
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                {(file.size / 1024).toFixed(1)} KB · 클릭해서 변경
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">파일 선택 또는 끌어다 놓기</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                JPG · PNG · PDF · 최대 10MB
              </p>
            </>
          )}
        </div>
        <input
          id={inputId}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="sr-only"
          disabled={disabled}
        />
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AgreementRow — line divider only
// ─────────────────────────────────────────────────────────────

function AgreementRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={`text-[11px] font-medium uppercase tracking-wider transition-colors ${
            checked
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-tertiary)]/60"
          }`}
        >
          {checked ? "동의함" : "동의 필요"}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`grid h-6 w-6 place-items-center rounded-full border transition-all ${
            checked
              ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
              : "border-[var(--color-border-default)]"
          }`}
        >
          {checked && (
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          )}
        </span>
      </span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Timeline + InfoRow + ErrorBanner
// ─────────────────────────────────────────────────────────────

function ProgressTimeline({
  items,
}: {
  items: Array<{ label: string; status: "done" | "current" | "pending" }>;
}) {
  return (
    <ol className="relative ml-3 border-l border-[var(--color-border-light)] text-left">
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[var(--color-text-primary)]">
        {value}
      </dd>
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
