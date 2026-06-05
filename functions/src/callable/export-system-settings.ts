// Wave U — 시스템 설정 백업 (JSON export).
//
// systemSettings 5 section + featureFlags + categories 를 JSON 으로 내보낸다.
// Storage `exports/system-settings-{ts}.json` 업로드 + signed URL 반환.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/callable/export-system-settings must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {getStorage} from "firebase-admin/storage";
// eslint-disable-next-line import/first
import {db, FieldValue, COLLECTIONS} from "../lib/firestore";

type Bundle = {
  exportedAt: string;
  exportedById: string;
  version: 1;
  systemSettings: Record<string, Record<string, unknown> | null>;
  featureFlags: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
};

const SECTIONS = ["general", "payment", "notification", "external", "security"] as const;

// Timestamp / Firestore 내부 객체를 직렬화 친화 형태로 변환.
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof (v as {toDate?: () => Date}).toDate === "function") {
      try {
        return (v as {toDate: () => Date}).toDate().toISOString();
      } catch {
        return null;
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = serialize(val);
    }
    return out;
  }
  return value;
}

/**
 * HTTPS Callable — 시스템 설정 전체 백업.
 * 권한: ADMIN / SUPER_ADMIN.
 *
 * 결과: { url, filename, exportedAt, sectionCount, flagCount, categoryCount }.
 */
export const exportSystemSettings = onCall(
  {
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 120,
    maxInstances: 3,
  },
  async (request) => {
    const role = (request.auth?.token?.role as string | undefined) ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const uid = request.auth?.uid ?? "system";
    logger.info("[export-system-settings] start", {uid, role});

    // 1) systemSettings 5 section
    const systemSettings: Record<string, Record<string, unknown> | null> = {};
    await Promise.all(
      SECTIONS.map(async (section) => {
        const snap = await db.collection("systemSettings").doc(section).get();
        systemSettings[section] = snap.exists ? (serialize(snap.data()) as Record<string, unknown>) : null;
      }),
    );

    // 2) featureFlags
    const flagSnap = await db.collection(COLLECTIONS.featureFlags).get();
    const featureFlags = flagSnap.docs.map((d) => ({
      id: d.id,
      ...(serialize(d.data()) as Record<string, unknown>),
    }));

    // 3) categories
    const catSnap = await db.collection(COLLECTIONS.categories).get();
    const categories = catSnap.docs.map((d) => ({
      id: d.id,
      ...(serialize(d.data()) as Record<string, unknown>),
    }));

    const exportedAt = new Date().toISOString();
    const bundle: Bundle = {
      exportedAt,
      exportedById: uid,
      version: 1,
      systemSettings,
      featureFlags,
      categories,
    };

    // 4) Storage 업로드
    const content = JSON.stringify(bundle, null, 2);
    const filename = `exports/system-settings-${Date.now()}.json`;
    const bucket = getStorage().bucket();
    const file = bucket.file(filename);
    await file.save(Buffer.from(content, "utf-8"), {
      contentType: "application/json; charset=utf-8",
      metadata: {cacheControl: "private, max-age=900"},
    });

    // 5) signed URL (15분)
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });

    // 6) auditLog
    try {
      await db.collection(COLLECTIONS.auditLogs).add({
        actorId: uid,
        actorRole: role,
        action: "SYSTEM_SETTINGS_EXPORTED",
        targetType: "SystemSettings",
        targetId: "bundle",
        after: {
          filename,
          sectionCount: SECTIONS.length,
          flagCount: featureFlags.length,
          categoryCount: categories.length,
        },
        status: "SUCCESS",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn("[export-system-settings] audit log failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("[export-system-settings] complete", {
      filename,
      sectionCount: SECTIONS.length,
      flagCount: featureFlags.length,
      categoryCount: categories.length,
    });

    return {
      url: signedUrl,
      filename,
      exportedAt,
      sectionCount: SECTIONS.length,
      flagCount: featureFlags.length,
      categoryCount: categories.length,
    };
  },
);
