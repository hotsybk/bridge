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
import type { DocumentReference } from "firebase-admin/firestore";

// eslint-disable-next-line import/first
import { adminDb } from "@/server/firebase/admin";

export const SHARD_COUNT = 10;

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
  const shardId = Math.floor(Math.random() * SHARD_COUNT).toString();
  await gbRef.collection("counterShards").doc(shardId).set(
    { count: FieldValue.increment(delta) },
    { merge: true },
  );
}

export async function sumCounter(gbRef: DocumentReference): Promise<number> {
  const snap = await gbRef.collection("counterShards").get();
  return snap.docs.reduce((sum, d) => sum + (Number(d.data().count) || 0), 0);
}
