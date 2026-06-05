import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { CommandPalette } from "@/components/admin/command-palette";

export const dynamic = "force-dynamic";

/**
 * 운영자 콘솔 공통 layout — sticky top bar + sticky 좌측 sidebar.
 *
 * 실제 role 가드는 src/proxy.ts 에서 처리.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AdminTopBar />
      <CommandPalette />
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-[var(--color-border-light)] py-6 pl-3 pr-2 md:block">
          <AdminSidebar />
        </aside>
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
