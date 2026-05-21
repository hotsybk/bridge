"use client";

import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type VendorSnapshot = {
  id: string;
  companyName?: string;
  status?: string;
  productCount?: number;
  updatedAt?: Timestamp;
};

/**
 * Phase 1.4-C 검증 컴포넌트.
 * vendors 컬렉션을 onSnapshot 으로 실시간 구독.
 * Firestore Console 에서 vendor doc 을 수정하면 화면이 자동 갱신되어야 한다.
 *
 * Phase 1.5 진입 시 admin only 격리 또는 제거.
 */
export function SnapshotProbe() {
  const [vendors, setVendors] = useState<VendorSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string>("(아직 이벤트 없음)");
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, "vendors"),
      orderBy("createdAt", "desc"),
      limit(10),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as VendorSnapshot,
        );
        setVendors(list);
        setLastEventAt(new Date().toISOString());
        setEventCount((n) => n + 1);
        setError(null);
      },
      (err) => {
        setError(`onSnapshot error: ${err.code} — ${err.message}`);
      },
    );

    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 text-sm">
        <div>
          최근 이벤트:{" "}
          <span className="font-mono text-[var(--color-text-secondary)]">
            {lastEventAt}
          </span>
        </div>
        <div>
          이벤트 수: <span className="tabular-nums">{eventCount}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {vendors.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            vendors 컬렉션이 비어있습니다. <code>pnpm seed:dev</code> 실행 후 새로고침.
          </p>
        ) : (
          vendors.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"
            >
              <p className="font-medium">{v.companyName ?? "(이름 없음)"}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                id: <span className="font-mono">{v.id}</span> · status:{" "}
                <span className="font-mono">{v.status ?? "?"}</span> ·
                productCount:{" "}
                <span className="tabular-nums">{v.productCount ?? 0}</span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
