// Wave N — 운영자 수동 UDI 보고 트리거 (HTTPS Callable).
//
// /admin/udi-reports 상단 "이번달 즉시 보고" 버튼이 이 함수를 호출.
// runUdiReport 를 위임 호출. ADMIN/SUPER_ADMIN role 만 허용.

// Server-only enforcement (CLAUDE.md §5.4).
// eslint-disable-next-line import/first
if (typeof window !== "undefined") {
  throw new Error("functions/callable/trigger-udi-report must be used only on the server side.");
}

// eslint-disable-next-line import/first
import {onCall, HttpsError} from "firebase-functions/v2/https";
// eslint-disable-next-line import/first
import {logger} from "firebase-functions/v2";
// eslint-disable-next-line import/first
import {runUdiReport} from "../scheduled/udi-monthly-report";

export const triggerUdiReport = onCall(
  {
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    const role = (request.auth?.token?.role as string | undefined) ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const period = (request.data as {period?: string} | undefined)?.period;
    logger.info("[trigger-udi-report] requested", {
      uid: request.auth?.uid,
      period,
    });

    const result = await runUdiReport({
      period,
      triggeredById: request.auth?.uid,
    });

    logger.info("[trigger-udi-report] complete", result);
    return result;
  },
);
