// Phase β-2 — vendors/{vendorId} onUpdate.
//
// 공급업체 companyName 변경 시 denormalized vendorName 동기화:
//   - products (vendorName)
//   - subOrders (collectionGroup, vendorName)
//   - settlements (vendorName)
//   - groupBuys (vendorName)
//   - subscriptions (vendorName)
//   - disputes (vendorName)
//   - users (vendorName)
//
// 각 도메인 최대 100건 cap. 단일 batch 500 docs 한계는 도메인 분리로 회피.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/triggers/on-vendor-name-changed must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type VendorDoc = {
  companyName?: string;
};

const DENORM_CAP = 100;

export const onVendorNameChanged = onDocumentUpdated(
  {
    document: "vendors/{vendorId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const before = event.data?.before?.data() as VendorDoc | undefined;
    const after = event.data?.after?.data() as VendorDoc | undefined;
    if (!before || !after) return;
    if (before.companyName === after.companyName) return;
    if (!after.companyName) return;

    const vendorId = event.params.vendorId;
    const newName = after.companyName;

    logger.info("[on-vendor-name-changed] propagating", {
      vendorId,
      from: before.companyName,
      to: newName,
    });

    const tally = {
      products: 0,
      subOrders: 0,
      settlements: 0,
      groupBuys: 0,
      subscriptions: 0,
      disputes: 0,
      users: 0,
    };

    async function syncCollection(
      key: keyof typeof tally,
      buildQuery: () => FirebaseFirestore.Query,
      fieldName = "vendorName",
    ) {
      try {
        const snap = await buildQuery().limit(DENORM_CAP).get();
        if (snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach((d) => {
          batch.update(d.ref, {
            [fieldName]: newName,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        tally[key] = snap.size;
      } catch (err) {
        logger.warn(`[on-vendor-name-changed] ${key} sync failed`, {
          vendorId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 1) products
    await syncCollection("products", () =>
      db
        .collection(COLLECTIONS.products)
        .where("vendorId", "==", vendorId)
        .orderBy("createdAt", "desc"),
    );

    // 2) subOrders (collectionGroup)
    await syncCollection("subOrders", () =>
      db
        .collectionGroup("subOrders")
        .where("vendorId", "==", vendorId)
        .orderBy("createdAt", "desc"),
    );

    // 3) settlements
    await syncCollection("settlements", () =>
      db
        .collection(COLLECTIONS.settlements)
        .where("vendorId", "==", vendorId)
        .orderBy("createdAt", "desc"),
    );

    // 4) groupBuys
    await syncCollection("groupBuys", () =>
      db
        .collection(COLLECTIONS.groupBuys)
        .where("vendorId", "==", vendorId)
        .orderBy("createdAt", "desc"),
    );

    // 5) subscriptions
    await syncCollection("subscriptions", () =>
      db.collection(COLLECTIONS.subscriptions).where("vendorId", "==", vendorId),
    );

    // 6) disputes
    await syncCollection("disputes", () =>
      db
        .collection(COLLECTIONS.disputes)
        .where("vendorId", "==", vendorId)
        .orderBy("createdAt", "desc"),
    );

    // 7) users (vendor 소속 멤버의 denormalized vendorName)
    await syncCollection("users", () =>
      db.collection(COLLECTIONS.users).where("vendorId", "==", vendorId),
    );

    // 8) audit
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: "system",
        actorRole: "SYSTEM",
        action: "VENDOR_NAME_DENORM_SYNCED",
        targetType: "Vendor",
        targetId: vendorId,
        after: {newName, ...tally},
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // best-effort
    }

    logger.info("[on-vendor-name-changed] done", {vendorId, ...tally});
  },
);
