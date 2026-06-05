// Wave V — Retry Queue Manager.

import { RetryQueueClient } from "./client";
import { DebugMobileBanner } from "@/components/admin/debug-mobile-banner";

export const dynamic = "force-dynamic";

export default function AdminDebugRetryQueuePage() {
  return (
    <div className="max-w-full overflow-x-hidden">
      <DebugMobileBanner />
      <RetryQueueClient />
    </div>
  );
}
