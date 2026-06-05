// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/scheduled/dispute-sla-checker must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onSchedule} from "firebase-functions/v2/scheduler";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type DisputeDoc = {
  id: string;
  orderId?: string;
  hospitalId?: string;
  vendorId?: string;
  hospitalName?: string;
  vendorName?: string;
  status?: string;
  deadlineAt?: { seconds?: number };
  slaNotifiedAt?: { seconds?: number };
  slaEscalatedAt?: { seconds?: number };
  amount?: number;
};

/**
 * 매시간 분쟁 SLA 점검.
 *
 * 동작:
 * 1. status in (OPEN, IN_PROGRESS, NEEDS_ADMIN_RESPONSE) 분쟁 모두 fetch
 * 2. deadlineAt - now 계산:
 *    - 12h 이하 + slaNotifiedAt 미설정 → "SLA 임박" 알림 (운영자 + 양측)
 *    - 0h 이하 + slaEscalatedAt 미설정 → escalation 알림 (SUPER_ADMIN _systemAlerts)
 * 3. 각각 slaNotifiedAt / slaEscalatedAt 갱신 (중복 알림 방지)
 */
export const disputeSlaChecker = onSchedule(
  {
    schedule: "0 * * * *", // 매시 0분
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    logger.info("[dispute-sla-checker] start");

    const snap = await db
      .collection(COLLECTIONS.disputes)
      .where("status", "in", ["OPEN", "IN_PROGRESS", "NEEDS_ADMIN_RESPONSE"])
      .limit(500)
      .get();

    let warned = 0;
    let escalated = 0;
    const nowMs = Date.now();

    for (const doc of snap.docs) {
      const d = {id: doc.id, ...(doc.data() as Omit<DisputeDoc, "id">)};
      const dlSec = d.deadlineAt?.seconds;
      if (!dlSec) continue;
      const diffMs = dlSec * 1000 - nowMs;
      const diffHours = diffMs / (1000 * 60 * 60);

      const alreadyWarned = !!d.slaNotifiedAt?.seconds;
      const alreadyEscalated = !!d.slaEscalatedAt?.seconds;

      // 12h 이하 + 0h 초과 → 경고
      if (diffHours <= 12 && diffHours > 0 && !alreadyWarned) {
        try {
          // 운영자 alert
          await db.collection("_systemAlerts").add({
            type: "DISPUTE_SLA_NEAR",
            severity: "WARNING",
            title: "분쟁 SLA 임박",
            message: `분쟁 ${d.id} — ${Math.floor(diffHours)}시간 후 마감 (${
              d.amount ?? 0
            }원)`,
            disputeId: d.id,
            acknowledged: false,
            createdAt: FieldValue.serverTimestamp(),
          });

          // 양측 알림
          if (d.hospitalId) {
            await db.collection(COLLECTIONS.notifications).add({
              targetType: "HOSPITAL",
              targetId: d.hospitalId,
              type: "DISPUTE_SLA_NEAR",
              title: "분쟁 처리 마감이 임박했습니다",
              body: `${Math.floor(diffHours)}시간 후 분쟁 마감입니다. 추가 정보가 있으면 알려주세요.`,
              data: {disputeId: d.id},
              channels: ["IN_APP"],
              kakaoSent: false,
              emailSent: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
          if (d.vendorId) {
            await db.collection(COLLECTIONS.notifications).add({
              targetType: "VENDOR",
              targetId: d.vendorId,
              type: "DISPUTE_SLA_NEAR",
              title: "분쟁 처리 마감이 임박했습니다",
              body: `${Math.floor(diffHours)}시간 후 분쟁 마감입니다. 빠른 응답 부탁드립니다.`,
              data: {disputeId: d.id},
              channels: ["KAKAO", "IN_APP"],
              kakaoSent: false,
              emailSent: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          await doc.ref.update({
            slaNotifiedAt: FieldValue.serverTimestamp(),
          });
          warned++;
        } catch (err) {
          logger.warn("[dispute-sla-checker] warning failed", {
            disputeId: d.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // 0h 이하 → escalation
      if (diffHours <= 0 && !alreadyEscalated) {
        try {
          await db.collection("_systemAlerts").add({
            type: "DISPUTE_SLA_ESCALATED",
            severity: "ERROR",
            title: "분쟁 SLA 이탈",
            message: `분쟁 ${d.id} — SLA 이탈 (${Math.abs(Math.floor(diffHours))}시간 경과)`,
            disputeId: d.id,
            escalated: true,
            acknowledged: false,
            createdAt: FieldValue.serverTimestamp(),
          });

          await doc.ref.update({
            slaEscalatedAt: FieldValue.serverTimestamp(),
          });
          escalated++;
        } catch (err) {
          logger.warn("[dispute-sla-checker] escalation failed", {
            disputeId: d.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info("[dispute-sla-checker] done", {warned, escalated, scanned: snap.size});
  },
);
