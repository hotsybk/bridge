// Wave V — Token Claims Viewer.

import { ClaimsClient } from "./client";
import { DebugMobileBanner } from "@/components/admin/debug-mobile-banner";

export const dynamic = "force-dynamic";

export default function AdminDebugClaimsPage() {
  return (
    <div className="max-w-full overflow-x-hidden">
      <DebugMobileBanner />
      <ClaimsClient />
    </div>
  );
}
