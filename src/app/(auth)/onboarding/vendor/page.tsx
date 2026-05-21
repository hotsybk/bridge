"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CloudUpload,
  FileText,
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
import { formatBizRegNo } from "@/lib/validators/biz-reg";
import {
  BANK_OPTIONS,
  VENDOR_CATEGORY_OPTIONS,
  VENDOR_TYPE_OPTIONS,
  vendorOnboardSchema,
  type VendorOnboardInput,
} from "@/lib/validators/vendor";

const STEPS = [
  { id: 1, label: "회사 정보" },
  { id: 2, label: "서류 업로드" },
  { id: 3, label: "정산 계좌" },
  { id: 4, label: "카테고리·약관" },
  { id: 5, label: "심사 대기" },
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
      <header className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">MedPlace</span>
          </Link>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            공급업체 가입 — Step {step} / 5
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-[220px_1fr] md:px-12 md:py-16">
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="md:hidden">
            <WizardStepper
              orientation="horizontal"
              steps={[...STEPS]}
              current={step}
            />
            <p className="mt-3 text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Step {step} / 5 · {STEPS[step - 1].label}
            </p>
          </div>
          <div className="hidden md:block">
            <WizardStepper
              orientation="vertical"
              steps={[...STEPS]}
              current={step}
              hint="입점 심사는 영업일 기준 24~72시간 소요됩니다."
            />
          </div>
        </aside>

        <section className="min-w-0">
          {step === 1 && (
            <StepContainer
              eyebrow="Step 1"
              title="회사 정보를 입력해주세요"
              description="공급업체의 기본 정보와 업체 구분"
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>업체 구분</Label>
                  <div className="grid gap-2 md:grid-cols-1">
                    {VENDOR_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, vendorType: opt.value })}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          form.vendorType === opt.value
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
                            : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-default)] hover:shadow-sm"
                        }`}
                      >
                        <p className="text-base font-medium">{opt.label}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {opt.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

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
                    <Label htmlFor="companyName">회사명</Label>
                    <Input
                      id="companyName"
                      value={form.companyName ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, companyName: e.target.value })
                      }
                      className="h-12 rounded-xl"
                    />
                  </div>
                </FieldRow>

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
                        setForm({
                          ...form,
                          zipcode: e.target.value.replace(/[^0-9]/g, ""),
                        })
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

                {error && <ErrorBox message={error} />}
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
              >
                다음
                <ArrowRight className="h-4 w-4" />
              </button>
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer
              eyebrow="Step 2"
              title="필수 서류를 올려주세요"
              description={
                showSalesLicense
                  ? "사업자등록증 + 의료기기 판매업 신고증 (의료기기법 §17)"
                  : "사업자등록증 + 제조·수입업 허가증 (판매업 신고 면제 대상)"
              }
            >
              <div className="space-y-5">
                <FileDropzone
                  label="사업자등록증 (필수)"
                  file={bizRegFile}
                  onChange={setBizRegFile}
                  disabled={uploading}
                />

                {showSalesLicense && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="salesLicenseNo">판매업 신고번호 (필수)</Label>
                      <Input
                        id="salesLicenseNo"
                        placeholder="제2026-서울강남-001호"
                        value={form.salesLicenseNo ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, salesLicenseNo: e.target.value })
                        }
                        className="h-12 rounded-xl"
                        disabled={uploading}
                      />
                    </div>
                    <FileDropzone
                      label="의료기기 판매업 신고증 (필수)"
                      file={salesLicenseFile}
                      onChange={setSalesLicenseFile}
                      disabled={uploading}
                    />
                  </>
                )}

                {showManufactureLicense && (
                  <>
                    <div className="rounded-xl bg-[var(--color-bg-secondary)] p-4 text-xs text-[var(--color-text-secondary)]">
                      의료기기법 §17 — 제조·수입업자가 직접 판매하는 경우 판매업 신고가
                      면제됩니다. 허가증 사본 1부를 업로드해주세요.
                    </div>
                    <FileDropzone
                      label="제조/수입업 허가증 (필수)"
                      file={manufactureFile}
                      onChange={setManufactureFile}
                      disabled={uploading}
                    />
                  </>
                )}

                {error && <ErrorBox message={error} />}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={uploading}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={uploadAllAndAdvance}
                  disabled={uploading}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
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
              </div>
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer
              eyebrow="Step 3"
              title="정산 계좌를 입력해주세요"
              description="판매 정산금이 입금될 계좌 정보"
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="payoutBankCode">은행</Label>
                  <select
                    id="payoutBankCode"
                    className="block h-12 w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-4 text-sm"
                    value={form.payoutBankCode ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, payoutBankCode: e.target.value })
                    }
                  >
                    <option value="">은행 선택</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payoutBankAccount">계좌번호</Label>
                  <Input
                    id="payoutBankAccount"
                    placeholder="123-456-789012"
                    value={form.payoutBankAccount ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, payoutBankAccount: e.target.value })
                    }
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payoutAccountHolder">예금주명</Label>
                  <Input
                    id="payoutAccountHolder"
                    value={form.payoutAccountHolder ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, payoutAccountHolder: e.target.value })
                    }
                    className="h-12 rounded-xl"
                  />
                </div>

                {error && <ErrorBox message={error} />}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  다음
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </StepContainer>
          )}

          {step === 4 && (
            <StepContainer
              eyebrow="Step 4"
              title="영업 카테고리와 약관에 동의해주세요"
              description="다루는 도메인을 선택하고 입점 약관에 동의합니다"
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>
                    영업 카테고리{" "}
                    <span className="text-[var(--color-text-tertiary)]">(최소 1개)</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {VENDOR_CATEGORY_OPTIONS.map((opt) => {
                      const checked = form.categories.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleCategory(opt.value)}
                          className={`rounded-xl border p-3 text-left text-sm transition-all ${
                            checked
                              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
                              : "border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-default)] hover:shadow-sm"
                          }`}
                        >
                          <p className="font-medium">{opt.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Label>약관 동의</Label>
                  <AgreementCheckbox
                    checked={form.agreedTerms === true}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        agreedTerms: (v === true ? true : (false as never)),
                      })
                    }
                    label="입점 약관에 동의합니다"
                  />
                  <AgreementCheckbox
                    checked={form.agreedPrivacy === true}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        agreedPrivacy: (v === true ? true : (false as never)),
                      })
                    }
                    label="개인정보 처리방침에 동의합니다"
                  />
                  <AgreementCheckbox
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

                {error && <ErrorBox message={error} />}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={startValidation}
                  disabled={onboard.isPending}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
                >
                  {onboard.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      심사 신청 중...
                    </>
                  ) : (
                    <>
                      심사 신청
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </StepContainer>
          )}

          {step === 5 && (
            <StepContainer
              eyebrow="Step 5"
              title="심사 신청이 접수됐습니다"
              description="24~72시간 내 결과를 등록 이메일과 알림톡으로 알려드립니다"
            >
              <div className="flex flex-col items-center gap-6 py-10">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                  <Clock className="h-10 w-10" aria-hidden />
                </span>

                <div className="w-full max-w-md">
                  <TimelineList
                    items={[
                      { label: "서류 접수 완료", status: "done" },
                      { label: "운영자 심사 진행 중", status: "current" },
                      { label: "결과 통보 (이메일 + 알림톡)", status: "pending" },
                    ]}
                  />
                </div>

                <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-secondary)] p-5 text-sm">
                  <p className="font-medium">심사 진행 안내</p>
                  <ul className="mt-3 space-y-2 text-xs text-[var(--color-text-secondary)]">
                    <li>· 영업일 기준 24~72시간 안에 처리됩니다</li>
                    <li>· 추가 서류 요청 시 등록 이메일로 연락드립니다</li>
                    <li>· 승인 전까지 셀러센터 접근은 제한됩니다</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    router.replace("/");
                    router.refresh();
                  }}
                  className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] text-base font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  확인
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

function FileDropzone({
  label,
  file,
  onChange,
  disabled,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <label
        htmlFor={inputId}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors ${
          file
            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]/40"
            : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]"
        }`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]">
          {file ? <FileText className="h-4 w-4" /> : <CloudUpload className="h-4 w-4" />}
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
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="sr-only"
          disabled={disabled}
        />
      </label>
    </div>
  );
}

function AgreementCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-[var(--color-bg-secondary)] p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
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
