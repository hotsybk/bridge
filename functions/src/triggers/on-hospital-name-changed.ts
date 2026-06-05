// Phase β-2 — hospitals/{hospitalId} onUpdate.
//
// 병원 name 변경 시 denormalized 필드를 가진 최근 문서들 동기화:
//   - orders (hospitalName)
//   - subOrders (collectionGroup, hospitalName)
//   - disputes (hospitalName)
//   - subscriptions (hospitalName)
//   - users (hospitalName)
//
// 각 도메인 최대 100건 cap — 그 이전 historical 데이터는 stale 허용.
// 단일 batch 500 docs 한계 회피를 위해 도메인별 분리 batch.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-hospital-name-changed must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type HospitalDoc = {
  name?: string;
};

const DENORM_CAP = 100;

export const onHospitalNameChanged = onDocumentUpdated(
  {
    document: "hospitals/{hospitalId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const before = event.data?.before?.data() as HospitalDoc | undefined;
    const after = event.data?.after?.data() as HospitalDoc | undefined;
    if (!before || !after) return;
    if (before.name === after.name) return;
    if (!after.name) return;

    const hospitalId = event.params.hospitalId;
    const newName = after.name;

    logger.info("[on-hospital-name-changed] propagating", {
      hospitalId,
      from: before.name,
      to: newName,
    });

    let syncedOrders = 0;
    let syncedSubOrders = 0;
    let syncedDisputes = 0;
    let syncedSubscriptions = 0;
    let syncedUsers = 0;

    // 1) orders
    try {
      const ordersSnap = await db
        .collection(COLLECTIONS.orders)
        .where("hospitalId", "==", hospitalId)
        .orderBy("createdAt", "desc")
        .limit(DENORM_CAP)
        .get();
      if (!ordersSnap.empty) {
        const batch = db.batch();
        ordersSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            hospitalName: newName,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        syncedOrders = ordersSnap.size;
      }
    } catch (err) {
      logger.warn("[on-hospital-name-changed] orders sync failed", {
        hospitalId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2) subOrders (collectionGroup)
    try {
      const subSnap = await db
        .collectionGroup("subOrders")
        .where("hospitalId", "==", hospitalId)
        .orderBy("createdAt", "desc")
        .limit(DENORM_CAP)
        .get();
      if (!subSnap.empty) {
        const batch = db.batch();
        subSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            hospitalName: newName,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        syncedSubOrders = subSnap.size;
      }
    } catch (err) {
      logger.warn("[on-hospital-name-changed] subOrders sync failed", {
        hospitalId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3) disputes
    try {
      const disputesSnap = await db
        .collection(COLLECTIONS.disputes)
        .where("hospitalId", "==", hospitalId)
        .orderBy("createdAt", "desc")
        .limit(DENORM_CAP)
        .get();
      if (!disputesSnap.empty) {
        const batch = db.batch();
        disputesSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            hospitalName: newName,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        syncedDisputes = disputesSnap.size;
      }
    } catch (err) {
      logger.warn("[on-hospital-name-changed] disputes sync failed", {
        hospitalId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 4) subscriptions
    try {
      const subsSnap = await db
        .collection(COLLECTIONS.subscriptions)
        .where("hospitalId", "==", hospitalId)
        .limit(DENORM_CAP)
        .get();
      if (!subsSnap.empty) {
        const batch = db.batch();
        subsSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            hospitalName: newName,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        syncedSubscriptions = subsSnap.size;
      }
    } catch (err) {
      logger.warn("[on-hospital-name-changed] subscriptions sync failed", {
        hospitalId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 5) users (병원 소속 멤버들의 denormalized hospitalName)
    try {
      const usersSnap = await db
        .collection(COLLECTIONS.users)
        .where("hospitalId", "==", hospitalId)
        .limit(DENORM_CAP)
        .get();
      if (!usersSnap.empty) {
        const batch = db.batch();
        usersSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            hospitalName: newName,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        syncedUsers = usersSnap.size;
      }
    } catch (err) {
      logger.warn("[on-hospital-name-changed] users sync failed", {
        hospitalId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 6) audit
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "HOSPITAL_NAME_DENORM_SYNCED",
        targetType: "Hospital",
        targetId: hospitalId,
        after: {
          newName,
          syncedOrders,
          syncedSubOrders,
          syncedDisputes,
          syncedSubscriptions,
          syncedUsers,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // best-effort
    }

    logger.info("[on-hospital-name-changed] done", {
      hospitalId,
      syncedOrders,
      syncedSubOrders,
      syncedDisputes,
      syncedSubscriptions,
      syncedUsers,
    });
  },
);
