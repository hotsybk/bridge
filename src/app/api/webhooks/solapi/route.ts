// Wave S — Solapi webhook 핸들러.
//
// 외부에서 들어오는 알림톡 발송 결과 이벤트(DELIVERED/FAILED/SENT 등)를 받아:
//   1) signature 검증 (HMAC-SHA256). env `SOLAPI_API_SECRET` 미설정 시 dev 우회 + logger.warn
//   2) `_solapiWebhooks` 컬렉션에 raw payload 적재 (감사/재처리)
//   3) kakaoMessageId 로 notifications doc 매칭 → deliveryStatus / deliveredAt / failedReason 갱신
//   4) auditLogs 기록
//
// matcher 패턴상 `/api/webhooks/...` 는 proxy.ts PUBLIC_PREFIXES 로 통과.
// signature 검증으로 보호.

import * as crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/server/firebase/admin";
import { COLLECTIONS } from "@/server/firebase/collections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SolapiEventEntry = {
  messageId?: string;
  statusCode?: string;
  statusMessage?: string;
  status?: string; // PENDING / SENDING / COMPLETE / FAILED / CANCELED
  reason?: string;
  to?: string;
  type?: string; // ATA / CTA / SMS / LMS / MMS
};

type SolapiWebhookBody = {
  eventId?: string;
  type?: string; // MESSAGE_REPORT / GROUP_REPORT / ...
  messageId?: string;
  groupId?: string;
  status?: string;
  statusCode?: string;
  statusMessage?: string;
  reason?: string;
  to?: string;
  messages?: SolapiEventEntry[];
  // raw payload 일부 — 자유 형태
  [k: string]: unknown;
};

/**
 * Solapi webhook signature 검증.
 *
 * 헤더 `x-signature` 또는 `webhook-signature` 에 HMAC-SHA256 hex 가 들어온다.
 *
 * Phase α-4 — fail-closed.
 *   - signature 없으면 거부
 *   - secret 미설정이면 dev/prod 무관하게 거부 (이전엔 dev 우회)
 *   - dev 환경에서 webhook 테스트 시 SOLAPI_API_SECRET 을 .env.local 에 명시 필수.
 */
function verifySolapiSignature(rawBody: string, signature: string): boolean {
  if (!signature) return false;
  const secret = process.env.SOLAPI_API_SECRET;
  if (!secret) {
    console.warn(
      "[solapi-webhook] SOLAPI_API_SECRET not configured — webhook denied (fail-closed)",
    );
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  // timing-safe compare
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Solapi 상태값을 내부 deliveryStatus enum 으로 매핑.
 *   COMPLETE  → DELIVERED
 *   FAILED    → FAILED
 *   CANCELED  → CANCELED
 *   SENDING   → SENT
 *   그 외     → PENDING
 */
function mapDeliveryStatus(
  status?: string,
  statusCode?: string,
): "DELIVERED" | "FAILED" | "CANCELED" | "SENT" | "PENDING" {
  const s = (status ?? "").toUpperCase();
  if (s === "COMPLETE" || s === "DELIVERED") return "DELIVERED";
  if (s === "FAILED") return "FAILED";
  if (s === "CANCELED" || s === "CANCELLED") return "CANCELED";
  if (s === "SENDING" || s === "SENT") return "SENT";
  // statusCode 가 "2xxx" 면 성공으로 간주
  if (statusCode && statusCode.startsWith("2")) return "DELIVERED";
  return "PENDING";
}

export async function POST(req: NextRequest) {
  // 1) raw body + signature
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-signature") ??
    req.headers.get("webhook-signature") ??
    req.headers.get("x-solapi-signature") ??
    "";

  if (!verifySolapiSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: SolapiWebhookBody;
  try {
    body = JSON.parse(rawBody) as SolapiWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const db = adminDb();
  const now = FieldValue.serverTimestamp();

  // 2) raw payload 적재 (idempotent — Firestore auto-id)
  try {
    await db.collection("_solapiWebhooks").add({
      eventId: body.eventId ?? null,
      type: body.type ?? null,
      messageId: body.messageId ?? null,
      groupId: body.groupId ?? null,
      status: body.status ?? null,
      raw: body,
      receivedAt: now,
    });
  } catch (err) {
    console.error("[solapi-webhook] failed to persist raw payload", err);
  }

  // 3) messageId 별 notifications 매칭
  // body.messages[] 가 있으면 각각 처리, 없으면 top-level messageId 단건 처리
  const entries: SolapiEventEntry[] =
    body.messages && body.messages.length > 0
      ? body.messages
      : body.messageId
        ? [
            {
              messageId: body.messageId,
              statusCode: body.statusCode,
              statusMessage: body.statusMessage,
              status: body.status,
              reason: body.reason,
              to: body.to,
            },
          ]
        : [];

  let matchedCount = 0;

  for (const entry of entries) {
    const messageId = entry.messageId;
    if (!messageId) continue;

    try {
      const matchSnap = await db
        .collection(COLLECTIONS.notifications)
        .where("kakaoMessageId", "==", messageId)
        .limit(5)
        .get();

      if (matchSnap.empty) continue;

      const deliveryStatus = mapDeliveryStatus(entry.status, entry.statusCode);
      const update: Record<string, unknown> = {
        deliveryStatus,
        deliveryStatusCode: entry.statusCode ?? null,
        deliveryStatusMessage: entry.statusMessage ?? entry.reason ?? null,
        deliveryUpdatedAt: now,
      };

      if (deliveryStatus === "DELIVERED") {
        update.deliveredAt = now;
      } else if (deliveryStatus === "FAILED") {
        update.failedAt = now;
        update.failedReason = entry.reason ?? entry.statusMessage ?? "unknown";
        // 실패시 errorReason 도 보강 (이미 있다면 유지)
        update.errorReason = entry.reason ?? entry.statusMessage ?? "delivery failed";
      }

      const batch = db.batch();
      for (const doc of matchSnap.docs) {
        batch.update(doc.ref, update);
      }
      await batch.commit();
      matchedCount += matchSnap.size;
    } catch (err) {
      console.warn("[solapi-webhook] notification update failed", {
        messageId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 4) audit log
  try {
    await db.collection(COLLECTIONS.auditLogs).add({
      actorId: "system",
      actorRole: "SYSTEM",
      action: `SOLAPI_WEBHOOK_${body.type ?? "UNKNOWN"}`,
      targetType: "Notification",
      targetId: body.messageId ?? body.groupId ?? "batch",
      after: {
        eventId: body.eventId ?? null,
        type: body.type ?? null,
        status: body.status ?? null,
        matchedNotifications: matchedCount,
      },
      createdAt: now,
    });
  } catch (err) {
    console.warn("[solapi-webhook] audit log failed", err);
  }

  return NextResponse.json({ ok: true, matched: matchedCount });
}

// GET — health check (Solapi 콘솔에서 endpoint 등록 검증용)
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "solapi-webhook" });
}
