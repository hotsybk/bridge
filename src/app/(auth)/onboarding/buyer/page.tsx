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
        Step {step} / 4 · {STEPS[step - 1].label}
      </p>

      {/* Step 1 — 업로드 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>사업자등록증 업로드</CardTitle>
            <CardDescription>이미지 또는 PDF, 10MB 이하</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-[var(--color-border-default)] p-3 text-sm"
              disabled={uploading}
            />
            {imageFile && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                선택됨: {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}
            <Button onClick={onUpload} disabled={!imageFile || uploading} className="w-full">
              {uploading ? "업로드 중..." : "업로드 후 다음"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — 폼 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>병원 정보 입력</CardTitle>
            <CardDescription>모든 필수 항목을 입력해주세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="name">병원명</Label>
              <Input
                id="name"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>병원 유형</Label>
              <div className="grid grid-cols-2 gap-2">
                {HOSPITAL_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: opt.value })}
                    className={`rounded-xl border p-3 text-left transition-shadow ${
                      form.type === opt.value
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm"
                        : "border-[var(--color-border-default)] hover:shadow-sm"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    {opt.sub && (
                      <p className="text-xs text-[var(--color-text-secondary)]">{opt.sub}</p>
                    )}
                  </button>
                ))}
              </div>
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
                  onChange={(e) =>
                    setForm({ ...form, zipcode: e.target.value.replace(/[^0-9]/g, "") })
                  }
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

            <div className="space-y-2">
              <Label htmlFor="ykiho">요양기관번호 (선택, 8자리)</Label>
              <Input
                id="ykiho"
                maxLength={8}
                inputMode="numeric"
                value={form.ykiho ?? ""}
                onChange={(e) =>
                  setForm({ ...form, ykiho: e.target.value.replace(/[^0-9]/g, "") })
                }
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                뒤로
              </Button>
              <Button onClick={startValidation} className="flex-1">
                검증 시작
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — 검증 진행 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>검증 중</CardTitle>
            <CardDescription>
              OCR · 국세청 진위확인 · 등록을 진행합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="py-10">
            <div className="flex items-center justify-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-[var(--color-accent)]" />
              <p className="text-sm">처리 중입니다. 잠시만 기다려주세요.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — 완료 */}
      {step === 4 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">가입 완료</CardTitle>
            <CardDescription>병원 운영을 시작하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              병원 정보가 등록되었습니다. 이제 의료기기·소모품을 둘러보고 주문할 수 있어요.
            </p>
            <Button
              onClick={() => {
                router.replace("/");
                router.refresh();
              }}
              className="w-full"
            >
              병원 운영 시작하기
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
