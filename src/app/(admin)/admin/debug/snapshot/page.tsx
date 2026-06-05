import { SnapshotProbe } from "@/components/shared/SnapshotProbe";
import { DebugMobileBanner } from "@/components/admin/debug-mobile-banner";

export default function DebugSnapshotPage() {
  return (
    <>
      <DebugMobileBanner />
      <main className="container-wide mx-auto max-w-full overflow-x-hidden px-6 py-16 md:px-12 md:py-24">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Phase 1.4-C · Debug
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            SnapshotProbe
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            vendors 컬렉션 <code>onSnapshot</code> 실시간 구독 검증용. Firestore
            Console 에서 vendor doc 의 필드(예: <code>productCount</code>)를 수정하면
            이 화면이 자동 갱신되어야 합니다.
            <br />
            Phase 1.5 진입 시 admin only 로 격리 또는 제거.
          </p>
        </header>

        <SnapshotProbe />
      </main>
    </>
  );
}
