// Phase 1.8-E — 솔라피 알림톡 mock
//
// admin router 의 vendor 승인/반려/일시정지 mutation 에서 호출.
// 1.8에서는 mock — 실제 발송은 Phase 2 Cloud Function (notifications 컬렉션 트리거) 에서 처리.
//
// 실제 호출 활성화는 SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_PFID 가 채워진 시점.

export type KakaoTemplateId =
  | "VENDOR_APPROVED"
  | "VENDOR_REJECTED"
  | "VENDOR_SUSPENDED"
  | "VENDOR_REOPENED"
  | "ORDER_NEW"
  | "ORDER_SHIPPED"
  | "SUBSCRIPTION_FAIL";

export type KakaoSendInput = {
  template: KakaoTemplateId;
  to: string;                                      // 수신자 전화번호 (한국 형식)
  params?: Record<string, string | undefined>;     // 템플릿 변수 치환
};

export type KakaoSendResult = {
  template: KakaoTemplateId;
  to: string;
  messageId: string;
  status: "queued" | "sent" | "failed";
  sentAt?: Date;
  source: "mock" | "solapi";
};

/**
 * 알림톡 발송 (mock 구현).
 *
 * 실제 호출은 다음 형태 (TODO):
 *   POST https://api.solapi.com/messages/v4/send-many
 *   Authorization: HMAC-SHA256 ...
 *   body: { messages: [{ to, from: PFID, type: "ATA", kakaoOptions: { templateId, variables } }] }
 *
 * 현재는 들어온 입력을 검증하고 dummy messageId 반환. 실 호출 안 함.
 */
export async function sendKakaoAlimtalk(input: KakaoSendInput): Promise<KakaoSendResult> {
  if (!input.to) {
    throw new Error("recipient phone is required");
  }
  if (!input.template) {
    throw new Error("template id is required");
  }

  // ─────────────────────────────────────────────────────────────────────
  // TODO: Phase 2 Cloud Function 에서 실제 발송 활성화
  //
  // const apiKey = process.env.SOLAPI_API_KEY;
  // const apiSecret = process.env.SOLAPI_API_SECRET;
  // const pfid = process.env.SOLAPI_PFID;
  // if (!apiKey || !apiSecret || !pfid) throw new Error("Solapi env not configured");
  //
  // const res = await fetch("https://api.solapi.com/messages/v4/send-many", {
  //   method: "POST",
  //   headers: {
  //     Authorization: makeHmacAuth(apiKey, apiSecret),
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     messages: [{
  //       to: input.to.replace(/[^0-9]/g, ""),
  //       from: pfid,
  //       type: "ATA",
  //       kakaoOptions: {
  //         pfId: pfid,
  //         templateId: input.template,
  //         variables: input.params ?? {},
  //       },
  //     }],
  //   }),
  // });
  // const json = await res.json();
  // return { ... source: "solapi", messageId: json.groupId, status: "sent" };
  // ─────────────────────────────────────────────────────────────────────

  return {
    template: input.template,
    to: input.to,
    messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    source: "mock",
  };
}
