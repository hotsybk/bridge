// Wave U — 시스템 설정 복원 (JSON import).
//
// 입력 JSON bundle 을 받아 systemSettings 5 section 덮어쓰기.
// 복원 전 현재 상태를 자동 백업 → Storage 에 저장.
// 권한: SUPER_ADMIN only.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/callable/import-system-settings must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {getStorage} from "firebase-admin/storage";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type SettingsBundle = {
  systemSettings?: Record<string, Record<string, unknown> | null>;
};

type Input = {
  bundle: SettingsBundle;
};

const SECTIONS = ["general", "payment", "notification", "external", "security"] as const;
type Section = (typeof SECTIONS)[number];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * HTTPS Callable — 시스템 설정 복원.
 * 입력: { bundle: { systemSettings: {...} } }
 * 권한: SUPER_ADMIN only.
 *
 * 1. 현재 5 section 상태를 Storage 에 자동 백업 (rollback-{ts}.json)
 * 2. bundle.systemSettings 의 각 section 덮어쓰기 (merge=false)
 * 3. auditLog 적재
 */
export const importSystemSettings = onCall(
  {
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 120,
    maxInstances: 3,
  },
  async (request) => {
    const role = (request.auth?.token?.role as string | undefined) ?? "";
    if (role !== "SUPER_ADMIN") {
      throw new HttpsError("permission-denied", "SUPER_ADMIN 권한이 필요합니다.");
    }

    const uid = request.auth?.uid ?? "system";
    const input = (request.data ?? {}) as Input;

    if (!input.bundle || !isObject(input.bundle)) {
      throw new HttpsError("invalid-argument", "bundle 이 필요합니다.");
    }
    const incomingSettings = input.bundle.systemSettings;
    if (!incomingSettings || !isObject(incomingSettings)) {
      throw new HttpsError("invalid-argument", "bundle.systemSettings 가 비어있습니다.");
    }

    logger.info("[import-system-settings] start", {uid, role});

    // 1) 자동 rollback 백업
    const currentSettings: Record<string, Record<string, unknown> | null> = {};
    await Promise.all(
      SECTIONS.map(async (s) => {
        const snap = await db.collection("systemSettings").doc(s).get();
        currentSettings[s] = snap.exists ? (snap.data() as Record<string, unknown>) : null;
      }),
    );

    const rollbackFilename = `exports/system-settings-rollback-${Date.now()}.json`;
    const bucket = getStorage().bucket();
    const rollbackFile = bucket.file(rollbackFilename);
    await rollbackFile.save(
      Buffer.from(
        JSON.stringify(
          {
            rollbackOf: input.bundle,
            previousSettings: currentSettings,
            createdAt: new Date().toISOString(),
            createdById: uid,
          },
          null,
          2,
        ),
        "utf-8",
      ),
      {contentType: "application/json; charset=utf-8"},
    );

    // 2) 덮어쓰기 (SECTIONS 화이트리스트만 처리)
    let importedSections = 0;
    const batch = db.batch();
    for (const section of SECTIONS) {
      const incoming = incomingSettings[section];
      if (!incoming || !isObject(incoming)) continue;
      // 불필요/위험 필드 제거 (updatedAt/updatedById 등은 새로 채움)
      const cleaned: Record<string, unknown> = {...incoming};
      delete cleaned.updatedAt;
      delete cleaned.updatedById;
      delete cleaned.createdAt;
      cleaned.updatedAt = FieldValue.serverTimestamp();
      cleaned.updatedById = uid;
      batch.set(db.collection("systemSettings").doc(section as Section), cleaned, {merge: false});
      importedSections += 1;
    }
    await batch.commit();

    // 3) auditLog
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: uid,
        actorRole: role,
        action: "SYSTEM_SETTINGS_IMPORTED",
        targetType: "SystemSettings",
        targetId: "bundle",
        after: {
          rollbackFilename,
          importedSections,
        },
        status: "SUCCESS",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[import-system-settings] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[import-system-settings] complete", {
      importedSections,
      rollbackFilename,
    });

    return {
      ok: true,
      importedSections,
      rollbackFilename,
    };
  },
);
