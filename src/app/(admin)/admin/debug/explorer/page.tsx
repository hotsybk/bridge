// Wave V — Firestore Query Explorer.
// SUPER_ADMIN only. 허용 컬렉션만 READ-ONLY 쿼리.

import { ExplorerClient } from "./client";
import { DebugMobileBanner } from "@/components/admin/debug-mobile-banner";

export const dynamic = "force-dynamic";

export default function AdminDebugExplorerPage() {
  return (
    <div className="max-w-full overflow-x-hidden">
      <DebugMobileBanner />
      <ExplorerClient />
    </div>
  );
}
