"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      categories: has ? form.categories.filter((c) => c !== value) : [...form.categories, value],
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
        next.salesLicenseImageUrl = await uploadVendorDoc(user.uid, salesLicenseFile, "sales-license");
      } else {
        if (!manufactureFile) {
          setError("제조/수입업 허가증 이미지를 선택해주세요.");
          setUploading(false);
          return;
        }
        next.manufactureLicenseUrl = await uploadVendorDoc(user.uid, manufactureFile, "manufacture-license");
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
    <main className="mx-auto max-w-xl px-6 py-12 md:py-20">
      {/* Stepper */}
      <ol className="mb-8 flex gap-2" aria-label="진행 단계">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step >= s.id ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-light)]"
            }`}
          />
        ))}
      </ol>
      <p className="mb-6 text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Step {step} / 5 · {STEPS[step - 1].label}
      </p>

      {/* Step 1 — 회사 정보 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>회사 정보 입력</CardTitle>
            <CardDescription>공급업체 기본 정보</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>업체 구분</Label>
              <div className="grid grid-cols-1 gap-2">
                {VENDOR_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, vendorType: opt.value })}
                    className={`rounded-xl border p-3 text-left transition-shadow ${
                      form.vendorType === opt.value
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
                        : "border-[var(--color-border-default)] hover:shadow-sm"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bizRegNo">사업자등록번호</Label>
              <Input
                id="bizRegNo"
                placeholder="123-45-67890"
                inputMode="numeric"
                value={form.bizRegNo ?? ""}
                onChange={(e) => setForm({ ...form, bizRegNo: formatBizRegNo(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">회사명</Label>
              <Input
                id="companyName"
                value={form.companyName ?? ""}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ceoName">대표자명</Label>
                <Input
                  id="ceoName"
                  value={form.ceoName ?? ""}
                  onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">전화번호</Label>
                <Input
                  id="phone"
                  placeholder="02-1234-5678"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="zipcode">우편번호</Label>
                <Input
                  id="zipcode"
                  placeholder="06236"
                  maxLength={5}
                  inputMode="numeric"
                  value={form.zipcode ?? ""}
                  onChange={(e) => setForm({ ...form, zipcode: e.target.value.replace(/[^0-9]/g, "") })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">주소</Label>
                <Input
                  id="address"
                  value={form.address ?? ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressDetail">상세주소 (선택)</Label>
              <Input
                id="addressDetail"
                value={form.addressDetail ?? ""}
                onChange={(e) => setForm({ ...form, addressDetail: e.target.value })}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}

            <Button onClick={() => setStep(2)} className="w-full">
              다음
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — 서류 업로드 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>서류 업로드</CardTitle>
            <CardDescription>
              {form.vendorType === "DISTRIBUTOR"
                ? "사업자등록증 + 의료기기 판매업 신고증 (의료기기법 §17)"
                : "사업자등록증 + 제조/수입업 허가증 (판매업 신고 면제 대상)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="bizRegFile">사업자등록증 (필수)</Label>
              <input
                id="bizRegFile"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setBizRegFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-[var(--color-border-default)] p-3 text-sm"
                disabled={uploading}
              />
              {bizRegFile && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {bizRegFile.name} ({(bizRegFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {showSalesLicense && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="salesLicenseNo">판매업 신고번호 (필수)</Label>
                  <Input
                    id="salesLicenseNo"
                    placeholder="제2026-서울강남-001호"
                    value={form.salesLicenseNo ?? ""}
                    onChange={(e) => setForm({ ...form, salesLicenseNo: e.target.value })}
                    disabled={uploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salesLicenseFile">의료기기 판매업 신고증 (필수)</Label>
                  <input
                    id="salesLicenseFile"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setSalesLicenseFile(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-xl border border-[var(--color-border-default)] p-3 text-sm"
                    disabled={uploading}
                  />
                  {salesLicenseFile && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {salesLicenseFile.name} ({(salesLicenseFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </>
            )}

            {showManufactureLicense && (
              <>
                <div className="rounded-xl bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
                  의료기기법 §17 — 제조·수입업자가 직접 판매하는 경우 판매업 신고가 면제됩니다.
                  허가증 사본 1부를 업로드해주세요.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufactureFile">제조/수입업 허가증 (필수)</Label>
                  <input
                    id="manufactureFile"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setManufactureFile(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-xl border border-[var(--color-border-default)] p-3 text-sm"
                    disabled={uploading}
                  />
                  {manufactureFile && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {manufactureFile.name} ({(manufactureFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={uploading}>
                뒤로
              </Button>
              <Button onClick={uploadAllAndAdvance} className="flex-1" disabled={uploading}>
                {uploading ? "업로드 중..." : "업로드 후 다음"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — 정산 계좌 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>정산 계좌</CardTitle>
            <CardDescription>판매 정산금이 입금될 계좌 정보</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payoutBankCode">은행</Label>
              <select
                id="payoutBankCode"
                className="block h-10 w-full rounded-xl border border-[var(--color-border-default)] bg-transparent px-3 text-sm"
                value={form.payoutBankCode ?? ""}
                onChange={(e) => setForm({ ...form, payoutBankCode: e.target.value })}
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
                onChange={(e) => setForm({ ...form, payoutBankAccount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payoutAccountHolder">예금주명</Label>
              <Input
                id="payoutAccountHolder"
                value={form.payoutAccountHolder ?? ""}
                onChange={(e) => setForm({ ...form, payoutAccountHolder: e.target.value })}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                뒤로
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                다음
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — 카테고리 + 약관 */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>영업 카테고리 · 약관 동의</CardTitle>
            <CardDescription>다루는 도메인과 입점 약관에 동의해주세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>영업 카테고리 (최소 1개)</Label>
              <div className="grid grid-cols-2 gap-2">
                {VENDOR_CATEGORY_OPTIONS.map((opt) => {
                  const checked = form.categories.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleCategory(opt.value)}
                      className={`rounded-xl border p-3 text-left text-sm transition-shadow ${
                        checked
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
                          : "border-[var(--color-border-default)] hover:shadow-sm"
                      }`}
                    >
                      <p className="font-medium">{opt.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>약관 동의</Label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.agreedTerms === true}
                  onChange={(e) => setForm({ ...form, agreedTerms: e.target.checked === true ? true : (false as never) })}
                />
                <span>입점 약관에 동의합니다</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.agreedPrivacy === true}
                  onChange={(e) => setForm({ ...form, agreedPrivacy: e.target.checked === true ? true : (false as never) })}
                />
                <span>개인정보 처리방침에 동의합니다</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.agreedCommission === true}
                  onChange={(e) => setForm({ ...form, agreedCommission: e.target.checked === true ? true : (false as never) })}
                />
                <span>수수료 정책(기본 5%)에 동의합니다</span>
              </label>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                뒤로
              </Button>
              <Button onClick={startValidation} className="flex-1" disabled={onboard.isPending}>
                {onboard.isPending ? "심사 신청 중..." : "심사 신청"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — 심사 대기 안내 */}
      {step === 5 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">심사 신청 완료</CardTitle>
            <CardDescription>24~72시간 내 안내드립니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
              <p>심사 진행 안내</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>제출된 서류를 운영자가 검토합니다 (영업일 기준 24~72시간)</li>
                <li>승인 시 등록한 이메일과 알림톡으로 알려드립니다</li>
                <li>승인 전까지 셀러센터(/seller) 접근은 제한됩니다</li>
              </ul>
            </div>
            <Button
              onClick={() => {
                router.replace("/");
                router.refresh();
              }}
              className="w-full"
            >
              확인
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
