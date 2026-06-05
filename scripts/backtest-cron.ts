/**
 * groupbuyCloser cron 단독 테스트.
 * 백테스트 doc 생성 후 2분 30초 대기 → 결과 확인.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

async function main() {
  // endsAt을 이미 과거(30초 전)로 설정 → 다음 cron tick에서 즉시 잡힘
  const gbRef = db.collection("groupBuys").doc();
  const endsAt = new Date(Date.now() - 30_000);
  await gbRef.set({
    productId: "test-prod-cron",
    productName: "cron 테스트 장갑",
    vendorId: "test-vendor-cron",
    vendorName: "cron 테스트",
    title: "cron 테스트",
    description: "",
    startsAt: new Date(Date.now() - 120_000),
    endsAt,
    targetQty: 5,
    currentQty: 0,
    tierPricing: [{ minQty: 0, price: 10000 }],
    status: "OPEN",
    participationCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ doc 생성: ${gbRef.id}, endsAt=${endsAt.toISOString()} (이미 30초 과거)`);

  // shard 초기화 대기
  await new Promise((r) => setTimeout(r, 8000));
  const shards = await gbRef.collection("counterShards").get();
  console.log(`  shards: ${shards.size}/10`);

  // cron이 매분 정각에 실행. 다음 정각까지 대기 + 처리 시간 30초
  const now = new Date();
  const nextMinute = new Date(now);
  nextMinute.setSeconds(0);
  nextMinute.setMilliseconds(0);
  nextMinute.setMinutes(now.getMinutes() + 1);
  const waitMs = nextMinute.getTime() - now.getTime() + 30_000;
  console.log(`  다음 cron tick 대기 (${Math.round(waitMs / 1000)}초)...`);
  await new Promise((r) => setTimeout(r, waitMs));

  const snap = await gbRef.get();
  const status = snap.data()?.status;
  const currentQty = snap.data()?.currentQty;
  console.log(`\n결과: status=${status}, currentQty=${currentQty}`);
  console.log(status === "FAILED" ? "✓ cron이 미달 캠페인을 FAILED로 마감" : `✗ 상태 변화 없음 (status=${status})`);

  // cleanup
  const sd = await gbRef.collection("counterShards").get();
  for (const s of sd.docs) await s.ref.delete();
  await gbRef.delete();
  console.log("  cleanup 완료");
  process.exit(status === "FAILED" ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
