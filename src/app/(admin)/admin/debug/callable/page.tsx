// Wave V — Callable Simulator.

import { CallableClient } from "./client";
import { DebugMobileBanner } from "@/components/admin/debug-mobile-banner";

export const dynamic = "force-dynamic";

export default function AdminDebugCallablePage() {
  return (
    <div className="max-w-full overflow-x-hidden">
      <DebugMobileBanner />
      <CallableClient />
    </div>
  );
}
