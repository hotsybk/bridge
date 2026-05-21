import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Mail,
  Package,
  Settings,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { trpcServer } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

const VENDOR_TYPE_LABEL: Record<string, string> = {
  DISTRIBUTOR: "판매업자",
  MANUFACTURER: "제조업자",
  IMPORTER: "수입업자",
};

export default async function SellerProductsPage() {
  const trpc = await trpcServer();
  const vendor = await trpc.vendor.getCurrent();

  // (approved) layout 이 이미 status==='APPROVED' 가드 — vendor 는 존재 보장
  const v = vendor as {
    id: string;
    companyName?: string;
    vendorType?: string;
    categories?: string[];
    payoutBankCode?: string;
    payoutBankAccount?: string;
    payoutAccountHolder?: string;
    defaultCommissionRate?: number;
  } | null;

  if (!v) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-[var(--color-text-secondary)]">
          공급업체 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
        </p>
      </main>
    );
  }

  const masked = v.payoutBankAccount
    ? v.payoutBankAccount.replace(/\d(?=\d{4})/g, "•")
    : "—";

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
      <PageHeader
        label={`Vendor · ${VENDOR_TYPE_LABEL[v.vendorType ?? ""] ?? v.vendorType ?? ""}`}
        title={`환영합니다, ${v.companyName ?? ""}`}
        description="셀러센터의 카탈로그·주문·정산 기능은 곧 출시됩니다."
      />

      {/* Phase 2 안내 */}
      <section className="mt-10 overflow-hidden rounded-3xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-light)]/40">
        <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Phase 2 · 곧 출시
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">
              카탈로그·주문·정산이 한 곳에서.
            </h2>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)] md:text-base">
              상품 등록, 다중 벤더 주문 처리, D+3 빠른 정산이 통합된 셀러센터를 준비하고
              있습니다. 가입 정보는 안전하게 보관되며 출시 시점에 자동으로 이용할 수
              있습니다.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ComingFeature
                icon={Package}
                title="상품 카탈로그"
                desc="UDI·등급·인증서 일괄 관리"
              />
              <ComingFeature
                icon={Mail}
                title="주문 처리"
                desc="알림톡 발송 + 배송 단계 추적"
              />
              <ComingFeature
                icon={BarChart3}
                title="정산 대시보드"
                desc="D+3 자동 정산 + 세금계산서"
              />
              <ComingFeature
                icon={Settings}
                title="셀러 설정"
                desc="수수료·계좌·약관 자체 관리"
              />
            </div>
          </div>
          <div className="hidden md:block">
            <span className="grid h-32 w-32 place-items-center rounded-full bg-[var(--color-bg-primary)] text-[var(--color-accent)]">
              <Package className="h-16 w-16" aria-hidden />
            </span>
          </div>
        </div>
      </section>

      {/* 현재 입점 정보 */}
      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--color-border-light)] p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="text-base font-semibold">입점 정보</h3>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-[var(--color-text-secondary)]">회사명</dt>
            <dd className="font-medium">{v.companyName ?? "—"}</dd>
            <dt className="text-[var(--color-text-secondary)]">구분</dt>
            <dd>{VENDOR_TYPE_LABEL[v.vendorType ?? ""] ?? "—"}</dd>
            <dt className="text-[var(--color-text-secondary)]">카테고리</dt>
            <dd>
              <div className="flex flex-wrap gap-1.5">
                {(v.categories ?? []).map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs"
                  >
                    {c}
                  </span>
                ))}
                {(v.categories ?? []).length === 0 && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">없음</span>
                )}
              </div>
            </dd>
          </dl>
        </article>

        <article className="rounded-2xl border border-[var(--color-border-light)] p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="text-base font-semibold">정산 계좌</h3>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-[var(--color-text-secondary)]">은행</dt>
            <dd>{v.payoutBankCode ?? "—"}</dd>
            <dt className="text-[var(--color-text-secondary)]">계좌</dt>
            <dd className="font-mono tabular-nums">{masked}</dd>
            <dt className="text-[var(--color-text-secondary)]">예금주</dt>
            <dd>{v.payoutAccountHolder ?? "—"}</dd>
            <dt className="text-[var(--color-text-secondary)]">수수료율</dt>
            <dd className="tabular-nums">
              {((v.defaultCommissionRate ?? 0.05) * 100).toFixed(1)}%
            </dd>
          </dl>
        </article>
      </section>

      {/* 정보 변경 요청 */}
      <section className="mt-8 rounded-2xl bg-[var(--color-bg-secondary)] p-6 md:p-8">
        <h3 className="text-base font-semibold">정보를 수정해야 하나요?</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          현재 베타 단계에서는 회사 정보·정산 계좌 변경은 운영자 요청으로 진행됩니다.
          Phase 2 출시 시점에 셀러센터에서 직접 수정 가능합니다.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={`mailto:support@medplace.example.com?subject=[정보변경요청] ${v.companyName ?? ""}&body=Vendor ID: ${v.id}%0D%0A요청 내용: `}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Mail className="h-4 w-4" />
            정보 변경 요청
          </a>
          <Link
            href="/pricing"
            className="inline-flex h-10 items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            수수료 정책 보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function ComingFeature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Package;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-primary)] p-4">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent-light)] text-[var(--color-accent)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{desc}</p>
    </div>
  );
}
