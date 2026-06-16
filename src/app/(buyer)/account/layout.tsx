import { CatalogTopNav } from "@/components/buyer/catalog-top-nav";
import { AccountNav } from "@/components/buyer/account-nav";

/**
 * /account 그룹 layout.
 *
 * 디자인 DNA:
 *  - CatalogTopNav (글로벌 nav) → 본문 그리드 (좌 sub-nav · 우 children)
 *  - 박스 없음. 좌측 sub-nav active 표시는 vertical 3px accent line
 *  - 헤더: eyebrow + 큰 H1 (T2) + 본문 sub-text (T4)
 *  - max-w-7xl · 가로 padding 통일
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CatalogTopNav />
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
          계정 · Account
        </p>
        <h1 className="mt-3 break-keep text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
          계정 설정
        </h1>
        <p className="mt-4 max-w-xl text-sm text-[var(--color-text-secondary)]">
          프로필 · 배송지 · 결제 수단을 한 곳에서 관리하세요. 변경 사항은 다음
          주문부터 자동 반영됩니다.
        </p>

        <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-[220px_1fr] lg:gap-20">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <AccountNav />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </main>
    </>
  );
}
