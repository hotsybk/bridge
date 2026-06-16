"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { trpc } from "@/lib/trpc/client";

/**
 * Phase ν-3 작업1 — 공급업체 프로필 (/seller/profile).
 *
 * 디자인 DNA: 박스 없음. 섹션 divider, LineField, T2 H1.
 * - 회사 기본정보 (회사명·연락처·소재지·영업시간) — OWNER 만 수정
 * - 의료기기 판매업 신고증 / 사업자등록증 (read-only — admin 재심사 통해서만 변경)
 * - 정산 계좌는 별도 다이얼로그 (기존 /seller/settlement 의 account-change-dialog 연계 안내)
 */

type BasicForm = {
  companyName: string;
  ceoName: string;
  phone: string;
  email: string;
  zipcode: string;
  address: string;
  addressDetail: string;
  businessHours: string;
  holidays: string;
  introduction: string;
};

const EMPTY: BasicForm = {
  companyName: "",
  ceoName: "",
  phone: "",
  email: "",
  zipcode: "",
  address: "",
  addressDetail: "",
  businessHours: "",
  holidays: "",
  introduction: "",
};

export default function VendorProfilePage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.vendor.profile.getMine.useQuery();
  const updateBasic = trpc.vendor.profile.updateBasic.useMutation({
    onSuccess: async () => {
      toast.success("프로필이 저장되었습니다.");
      await utils.vendor.profile.getMine.invalidate();
    },
  });
  const requestRecert = trpc.vendor.profile.requestRecertification.useMutation({
    onSuccess: () => {
      toast.success("재심사 요청을 전달했습니다. 관리자 검토 후 알려드립니다.");
      setRecertReason("");
    },
  });

  const [form, setForm] = useState<BasicForm>(EMPTY);
  const [recertReason, setRecertReason] = useState("");

  useEffect(() => {
    if (!data?.vendor) return;
    const v = data.vendor as Record<string, unknown>;
    setForm({
      companyName: (v.companyName as string | undefined) ?? "",
      ceoName: (v.ceoName as string | undefined) ?? "",
      phone: (v.phone as string | undefined) ?? "",
      email: (v.email as string | undefined) ?? "",
      zipcode: (v.zipcode as string | undefined) ?? "",
      address: (v.address as string | undefined) ?? "",
      addressDetail: (v.addressDetail as string | undefined) ?? "",
      businessHours: (v.businessHours as string | undefined) ?? "",
      holidays: (v.holidays as string | undefined) ?? "",
      introduction: (v.introduction as string | undefined) ?? "",
    });
  }, [data?.vendor]);

  const v = (data?.vendor ?? {}) as Record<string, unknown>;
  const myRole = data?.myRole ?? "VENDOR_STAFF";
  const isOwner = myRole === "VENDOR_OWNER";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <PageHeader
        label="파트너센터 · 프로필"
        title="공급업체 프로필"
        description={
          isOwner
            ? "회사 기본정보를 한 곳에서 관리합니다. 신고증·사업자등록증 변경은 재심사 요청으로 진행됩니다."
            : "이 페이지는 보기 전용입니다. 수정은 소유자 권한이 필요합니다."
        }
      />

      {isLoading && (
        <p className="mt-12 text-sm text-[var(--color-text-tertiary)]">
          불러오는 중…
        </p>
      )}

      {!isLoading && data?.vendor && (
        <div className="mt-12 space-y-20">
          {/* 1. 회사 기본정보 */}
          <Section title="회사 기본정보" meta={`멤버 ${data.memberCount}명`}>
            <Row
              label="회사명"
              value={form.companyName}
              onChange={(s) => setForm({ ...form, companyName: s })}
              readOnly={!isOwner}
            />
            <Row
              label="대표자"
              value={form.ceoName}
              onChange={(s) => setForm({ ...form, ceoName: s })}
              readOnly={!isOwner}
            />
            <Row
              label="대표 전화"
              value={form.phone}
              onChange={(s) => setForm({ ...form, phone: s })}
              readOnly={!isOwner}
              mono
            />
            <Row
              label="대표 이메일"
              value={form.email}
              onChange={(s) => setForm({ ...form, email: s })}
              readOnly={!isOwner}
              mono
            />
            <Row
              label="우편번호"
              value={form.zipcode}
              onChange={(s) => setForm({ ...form, zipcode: s })}
              readOnly={!isOwner}
              mono
            />
            <Row
              label="주소"
              value={form.address}
              onChange={(s) => setForm({ ...form, address: s })}
              readOnly={!isOwner}
            />
            <Row
              label="상세 주소"
              value={form.addressDetail}
              onChange={(s) => setForm({ ...form, addressDetail: s })}
              readOnly={!isOwner}
            />
            <Row
              label="영업 시간"
              value={form.businessHours}
              onChange={(s) => setForm({ ...form, businessHours: s })}
              readOnly={!isOwner}
              hint="예: 평일 09:00 ~ 18:00"
            />
            <Row
              label="휴무일"
              value={form.holidays}
              onChange={(s) => setForm({ ...form, holidays: s })}
              readOnly={!isOwner}
              hint="예: 토·일·공휴일"
            />
            <Row
              label="소개"
              value={form.introduction}
              onChange={(s) => setForm({ ...form, introduction: s })}
              readOnly={!isOwner}
              multiline
            />
            {isOwner && (
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  disabled={updateBasic.isPending}
                  onClick={() => updateBasic.mutate(form)}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50"
                >
                  {updateBasic.isPending ? "저장 중…" : "프로필 저장"}
                </button>
              </div>
            )}
          </Section>

          {/* 2. 사업자등록증 (read-only) */}
          <Section title="사업자등록증">
            <ReadField
              label="사업자등록번호"
              value={(v.bizRegNo as string | undefined) ?? "—"}
              mono
            />
            <ReadField
              label="등록증 첨부"
              value={v.bizRegImageUrl ? "등록됨" : "—"}
              link={v.bizRegImageUrl as string | undefined}
            />
            <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
              변경 불가 · 오류 시 고객지원 문의
            </p>
          </Section>

          {/* 3. 의료기기 판매업 신고증 (read-only + 재심사 요청) */}
          <Section title="의료기기 판매업 신고증">
            <ReadField
              label="판매업 신고번호"
              value={(v.salesLicenseNo as string | undefined) ?? "—"}
              mono
            />
            <ReadField
              label="판매업 신고증 첨부"
              value={v.salesLicenseImageUrl ? "등록됨" : "—"}
              link={v.salesLicenseImageUrl as string | undefined}
            />
            {(v.manufactureLicenseUrl as string | undefined) && (
              <ReadField
                label="제조업 허가증 첨부"
                value="등록됨"
                link={v.manufactureLicenseUrl as string}
              />
            )}

            {isOwner && (
              <div className="mt-8 border-l-2 border-[var(--color-warning)] pl-6">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  재심사 요청
                </p>
                <p className="mt-2 max-w-lg text-xs text-[var(--color-text-tertiary)]">
                  신고증 변경 사유를 작성하세요. 운영자가 검토합니다.
                </p>
                <textarea
                  rows={3}
                  value={recertReason}
                  onChange={(e) => setRecertReason(e.target.value)}
                  placeholder="변경 사유 (예: 신고증 갱신)"
                  className="mt-4 w-full max-w-2xl resize-none border-b border-[var(--color-border-light)] bg-transparent py-2 text-sm outline-none transition-colors placeholder:text-[var(--color-text-tertiary)]/60 focus:border-[var(--color-accent)]"
                />
                <button
                  type="button"
                  disabled={
                    requestRecert.isPending || recertReason.trim().length < 1
                  }
                  onClick={() =>
                    requestRecert.mutate({ reason: recertReason.trim() })
                  }
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-warning)] px-6 text-sm font-medium text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)] hover:text-white disabled:opacity-40"
                >
                  {requestRecert.isPending ? "전송 중…" : "재심사 요청"}
                </button>
              </div>
            )}
          </Section>

          {/* 4. 정산 계좌 안내 — 별도 페이지 안내 */}
          <Section title="정산 계좌">
            <ReadField
              label="입금 은행"
              value={(v.payoutBankCode as string | undefined) ?? "—"}
            />
            <ReadField
              label="입금 계좌"
              value={
                v.payoutBankAccount
                  ? maskAccount(v.payoutBankAccount as string)
                  : "—"
              }
              mono
            />
            <ReadField
              label="예금주"
              value={(v.payoutAccountHolder as string | undefined) ?? "—"}
            />
            <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
              계좌 변경은{" "}
              <a
                href="/seller/settlement"
                className="underline underline-offset-2 hover:text-[var(--color-accent)]"
              >
                정산
              </a>{" "}
              페이지의 "계좌 변경 요청" 에서 진행하세요. 운영자 검토 후 반영됩니다.
            </p>
          </Section>
        </div>
      )}
    </main>
  );
}

function maskAccount(account: string): string {
  const s = String(account ?? "");
  if (s.length <= 4) return s;
  return s.slice(0, -4).replace(/[0-9]/g, "•") + s.slice(-4);
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
          {title}
        </h2>
        {meta && (
          <p className="text-xs text-[var(--color-text-tertiary)]">{meta}</p>
        )}
      </header>
      <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        {children}
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  onChange,
  readOnly,
  hint,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  hint?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  // 라벨 기반 입력 힌트 자동 매핑 (모바일 OS 키패드 분기)
  const labelToHints: Record<
    string,
    {
      type?: string;
      inputMode?: "text" | "numeric" | "email" | "tel";
      autoComplete?: string;
    }
  > = {
    회사명: { autoComplete: "organization" },
    대표자: { autoComplete: "name" },
    "대표 전화": { type: "tel", inputMode: "tel", autoComplete: "tel" },
    "대표 이메일": { type: "email", inputMode: "email", autoComplete: "email" },
    우편번호: { inputMode: "numeric", autoComplete: "postal-code" },
    주소: { autoComplete: "street-address" },
    "상세 주소": { autoComplete: "address-line2" },
  };
  const hints = labelToHints[label] ?? {};
  return (
    <div className="grid gap-3 py-5 md:grid-cols-[200px_1fr] md:items-start md:gap-6">
      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] md:pt-2">
        {label}
      </dt>
      <dd className="min-w-0">
        {multiline ? (
          <textarea
            rows={4}
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value)}
            className={`w-full resize-none border-b bg-transparent py-2 text-sm outline-none transition-colors ${
              readOnly
                ? "cursor-not-allowed border-transparent text-[var(--color-text-tertiary)]"
                : "border-[var(--color-border-light)] focus:border-[var(--color-accent)]"
            }`}
          />
        ) : (
          <input
            type={hints.type ?? "text"}
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value)}
            inputMode={hints.inputMode}
            autoComplete={hints.autoComplete}
            className={`h-9 w-full border-b bg-transparent text-sm outline-none transition-colors ${
              readOnly
                ? "cursor-not-allowed border-transparent text-[var(--color-text-tertiary)]"
                : "border-[var(--color-border-light)] focus:border-[var(--color-accent)]"
            } ${mono ? "font-mono tabular-nums" : ""}`}
          />
        )}
        {hint && (
          <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            {hint}
          </p>
        )}
      </dd>
    </div>
  );
}

function ReadField({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className="grid gap-3 py-5 md:grid-cols-[200px_1fr] md:items-center md:gap-6">
      <dt className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd className="min-w-0">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm text-[var(--color-accent)] underline-offset-2 hover:underline ${mono ? "font-mono tabular-nums" : ""}`}
          >
            {value}
          </a>
        ) : (
          <p
            className={`text-sm text-[var(--color-text-secondary)] ${mono ? "font-mono tabular-nums" : ""}`}
          >
            {value}
          </p>
        )}
      </dd>
    </div>
  );
}
