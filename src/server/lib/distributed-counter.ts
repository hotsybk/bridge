// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("server/lib/distributed-counter must be used only on the server side.");
}

// Wave I — NEXUS FATE distributed counter 패턴.
// Cloud Function 측과 동일한 인터페이스를 tRPC procedure 에서도 사용.
// [SYNCED: functions/src/lib/distributed-counter.ts] 변경 시 양쪽 동기화.

// eslint-disable-next-line import/first
import { FieldValue } from "firebase-admin/firestore";
// eslint-disable-next-line import/first
import type { DocumentReference, Transaction } from "firebase-admin/firestore";

// eslint-disable-next-line import/first
import { adminDb } from "@/server/firebase/admin";

export const SHARD_COUNT = 10;

/**
 * 랜덤 shard ID 1개 선택 — init/seed/e2e 와 동일한 "0".."9" 규약.
 * 절대 "shard-N" 형식 사용 금지 (split-brain 방지, Σ-1).
 */
function randomShardId(): string {
  return Math.floor(Math.random() * SHARD_COUNT).toString();
}

export async function initCounterShards(gbRef: DocumentReference): Promise<void> {
  const batch = adminDb().batch();
  for (let i = 0; i < SHARD_COUNT; i++) {
    batch.set(gbRef.collection("counterShards").doc(String(i)), { count: 0 });
  }
  await batch.commit();
}

export async function incrementCounter(
  gbRef: DocumentReference,
  delta: number,
): Promise<void> {
  await gbRef.collection("counterShards").doc(randomShardId()).set(
    { count: FieldValue.increment(delta) },
    { merge: true },
  );
}

/**
 * 트랜잭션 내부에서 shard 증감.
 * 라우터(participate/cancel)가 참여 기록과 shard 증감을 한 트랜잭션으로 원자화할 때 사용.
 * 인라인 "shard-N" 직접 기록 대신 반드시 이 helper 를 통해 "0".."9" 규약 통일.
 */
export function incrementCounterTx(
  tx: Transaction,
  gbRef: DocumentReference,
  delta: number,
): void {
  tx.set(
    gbRef.collection("counterShards").doc(randomShardId()),
    { count: FieldValue.increment(delta) },
    { merge: true },
  );
}

export async function sumCounter(gbRef: DocumentReference): Promise<number> {
  const snap = await gbRef.collection("counterShards").get();
  return snap.docs.reduce((sum, d) => sum + (Number(d.data().count) || 0), 0);
}
