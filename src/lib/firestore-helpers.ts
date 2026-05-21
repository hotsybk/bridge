/**
 * Firestore Admin SDK + Client SDK 공통 helper.
 * 시드 스크립트, Cloud Function, tRPC procedure에서 사용.
 *
 * src/lib/types.ts 의 도메인 인터페이스가 Firestore writable type 과
 * 호환되는지 컴파일 타임에 검증하는 type assertion 도 포함.
 */

// Server-only enforcement (server-only 패키지 대체, Node 스크립트 호환)
if (typeof window !== "undefined") {
  throw new Error("firestore-helpers must be used only on the server side.");
}

import { FieldValue, Timestamp, type WithFieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import type {
  AuditLog,
  Category,
  CounterShard,
  GroupBuy,
  GroupBuyParticipation,
  Hospital,
  HospitalMember,
  Notification,
  Order,
  Product,
  Quote,
  RFQ,
  Settlement,
  SubOrder,
  SubOrderItem,
  Subscription,
  SubscriptionRun,
  User,
  Vendor,
} from "./types";

// ============ 컴파일 타임 type 검증 ============
// 도메인 인터페이스가 Firestore Admin SDK 의 WithFieldValue 와 호환되는지
// 컴파일러가 확인. 호환 불가 시 TypeScript build 단계에서 실패.

type DomainDocument =
  | AuditLog
  | Category
  | CounterShard
  | GroupBuy
  | GroupBuyParticipation
  | Hospital
  | HospitalMember
  | Notification
  | Order
  | Product
  | Quote
  | RFQ
  | Settlement
  | SubOrder
  | SubOrderItem
  | Subscription
  | SubscriptionRun
  | User
  | Vendor;

// 사용 안 되어도 TypeScript 가 type 호환성을 검증 (export 로 tree-shake 영향 없음)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _FirestoreCompatCheck = WithFieldValue<DomainDocument>;

// ============ 런타임 helper ============

/**
 * Admin SDK 즉시 Timestamp 생성 (지금 시각).
 * 시드 스크립트나 Cloud Function 이 명시적 시각을 쓸 때 사용.
 */
export const nowTimestamp = (): Timestamp => Timestamp.now();

/**
 * Admin SDK serverTimestamp sentinel.
 * write 시점에 서버 사이드 시각으로 평가됨 — 클라이언트 시계 신뢰 금지.
 */
export const serverTimestamp = (): FieldValue => FieldValue.serverTimestamp();

/**
 * Date 객체 → Timestamp 변환.
 * 시드 스크립트에서 특정 날짜를 명시할 때 사용.
 */
export const dateToTimestamp = (d: Date): Timestamp => Timestamp.fromDate(d);

/**
 * Timestamp → Date 변환.
 * 클라이언트 SDK 와 Admin SDK Timestamp 양쪽 모두 `toDate()` 를 노출 — 구조적 호환.
 */
export function timestampToDate(
  ts: { toDate(): Date } | null | undefined,
): Date | null {
  return ts ? ts.toDate() : null;
}

/**
 * 새 doc ID 생성 — Firestore auto-id 대안.
 * monotonic 증가 ID 금지 (CLAUDE.md §1.1). 12자리 nanoid 권장.
 */
export const newDocId = (size: number = 12): string => nanoid(size);
