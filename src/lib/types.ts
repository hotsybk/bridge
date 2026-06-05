import type { Timestamp } from "firebase/firestore";

// ============ ENUMS ============

export type UserRole =
  | "BUYER_OWNER" | "BUYER_STAFF" | "BUYER_VIEWER"
  | "VENDOR_OWNER" | "VENDOR_STAFF"
  | "ADMIN" | "SUPER_ADMIN";

export type HospitalType =
  | "CLINIC" | "SMALL_HOSPITAL" | "GENERAL_HOSPITAL"
  | "TERTIARY" | "ORIENTAL" | "DENTAL";

export type VendorStatus =
  | "PENDING_DOCS" | "PENDING_REVIEW" | "APPROVED"
  | "SUSPENDED" | "REJECTED";

export type VendorType = "DISTRIBUTOR" | "MANUFACTURER" | "IMPORTER";

// Vendor 등급 — 운영자가 수동 부여, 수수료율 차등 적용.
// STANDARD=5%, PLUS=4.5%, PREMIUM=4%, DIRECT=3.5%
export type VendorGrade = "STANDARD" | "PLUS" | "PREMIUM" | "DIRECT";

export type ProductStatus =
  | "DRAFT"                  // vendor 작성 중 (저장만)
  | "PENDING_REVIEW"         // 운영자 모더레이션 대기
  | "REVISION_REQUESTED"     // 운영자가 수정 요청
  | "ACTIVE"                 // 승인 + 노출
  | "REJECTED"               // 반려 (재신청 가능)
  | "PAUSED"                 // vendor가 일시 중단
  | "ARCHIVED";              // 종료
export type DeviceClass = "CLASS_1" | "CLASS_2" | "CLASS_3" | "CLASS_4" | "NON_DEVICE";

export type OrderStatus =
  | "PENDING_PAYMENT" | "PENDING_APPROVAL" | "PAID"
  | "PARTIALLY_SHIPPED" | "SHIPPED" | "COMPLETED"
  | "CANCELLED" | "REFUND_REQUESTED" | "REFUNDED";

export type SubOrderStatus =
  | "ACCEPTED" | "PACKING" | "SHIPPED" | "DELIVERED"
  | "CANCELLED" | "RETURN_REQUESTED" | "RETURNED";

export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
export type SubscriptionCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";

// Phase β-2 — PARTIAL_FULFILLED 추가: 목표 달성 후 일부 participation 의 capture 실패 시.
export type GroupBuyStatus =
  | "OPEN"
  | "TARGET_MET"
  | "FULFILLED"
  | "PARTIAL_FULFILLED"
  | "FAILED";
export type RFQStatus = "OPEN" | "CLOSED" | "AWARDED" | "CANCELLED";

export type PaymentMethod = "CARD" | "BANK_TRANSFER" | "NET_30" | "POINT";
// Wave M — 정산 lifecycle 확장. PENDING → REQUESTED(빠른정산 신청) → APPROVED → PAID
// 또는 PENDING → HOLD(보류) → 해제 시 PENDING 회귀. FAILED 는 PortOne 이체 실패.
export type SettlementStatus =
  | "PENDING"
  | "REQUESTED"
  | "APPROVED"
  | "HOLD"
  | "PAID"
  | "FAILED";
export type ApprovalStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";

// ============ USER ============
// 컬렉션 path: /users/{uid}  ← uid는 Firebase Auth UID

export interface User {
  uid: string;                          // doc id = uid
  email: string;
  emailVerified: boolean;
  name: string;
  phone?: string;
  photoURL?: string;

  role: UserRole;                       // Custom Claim에도 동일 값 sync

  // 소속 (denormalize)
  hospitalId?: string;
  hospitalName?: string;
  vendorId?: string;
  vendorName?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

// ============ HOSPITAL ============
// 컬렉션 path: /hospitals/{hospitalId}

export interface Hospital {
  id: string;

  bizRegNo: string;                     // 사업자등록번호 (고유)
  bizRegImageUrl?: string;
  bizVerifiedAt?: Timestamp;

  name: string;
  ykiho?: string;                       // 요양기관번호
  type: HospitalType;

  ceoName: string;
  phone: string;
  fax?: string;
  email: string;

  zipcode: string;
  address: string;
  addressDetail?: string;

  // 결재 워크플로우
  approvalEnabled: boolean;
  approvalLimit?: number;               // KRW
  approvalChain?: Array<{ level: number; role: UserRole }>;

  // 자동 결제 (정기구독용)
  portoneBillingKey?: string;

  // denormalize: 멤버 카운트
  memberCount: number;

  // 운영 상태 (admin 이 일시 정지 시 SUSPENDED). 누락 시 ACTIVE 로 간주.
  status?: "ACTIVE" | "SUSPENDED";
  statusReason?: string;

  // Wave J — 주문 KPI denormalize. Cloud Function (onOrderCreated) 이 갱신.
  kpi?: {
    orderCount: number;
    orderAmount: number;
    lastOrderAt?: Timestamp;
    lastActiveAt?: Timestamp;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션 /hospitals/{hospitalId}/members/{userId}
export interface HospitalMember {
  userId: string;
  email: string;
  name: string;
  role: UserRole;                       // BUYER_OWNER | BUYER_STAFF | BUYER_VIEWER
  joinedAt: Timestamp;
}

// ============ VENDOR ============
// 컬렉션 path: /vendors/{vendorId}

export interface Vendor {
  id: string;

  bizRegNo: string;
  bizRegImageUrl: string;
  bizVerifiedAt?: Timestamp;

  companyName: string;
  ceoName: string;
  phone: string;
  email: string;

  zipcode: string;
  address: string;
  addressDetail?: string;

  // 의료기기 판매업 신고증
  vendorType: VendorType;
  salesLicenseNo?: string;
  salesLicenseImageUrl?: string;
  manufactureLicenseUrl?: string;

  status: VendorStatus;
  statusReason?: string;
  approvedAt?: Timestamp;
  approvedById?: string;

  // 정산 계좌
  payoutBankCode?: string;
  payoutBankAccount?: string;
  payoutAccountHolder?: string;

  // 수수료
  defaultCommissionRate: number;        // 0.05 = 5%

  // 빠른정산
  fastSettlementEnabled: boolean;

  // 영업 카테고리
  categories: string[];                 // ["MED_DEVICE", "MED_SUPPLY", ...]

  // denormalize: 통계 (Cloud Function이 갱신)
  productCount: number;
  totalGmv: number;
  rating?: number;                      // 0~5
  reviewCount: number;

  // 등급 (운영자가 수동 부여, 수수료율 차등 적용)
  grade?: VendorGrade;
  gradeUpdatedAt?: Timestamp;
  gradeUpdatedById?: string;
  gradeNote?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============ PRODUCT ============
// 컬렉션 path: /products/{productId}  ← 루트 (Algolia sync 대상)

export interface Product {
  id: string;

  // 소속 (denormalize)
  vendorId: string;
  vendorName: string;
  vendorRating?: number;

  // 카테고리 (denormalize: 트리 경로 전체)
  categoryId: string;
  categoryPath: string[];               // ["의료소모품", "일회용 의료용품", "장갑"]

  // 기본 정보
  name: string;
  nameEn?: string;
  brand?: string;
  manufacturer?: string;
  origin?: string;

  // 의료기기 정보
  udiCode?: string;
  mfdsLicenseNo?: string;
  deviceClass: DeviceClass;
  certificateUrl?: string;

  // 이미지
  images: string[];                     // 최대 10
  thumbnail: string;

  // 가격
  basePrice: number;                    // 부가세 별도
  priceTiers?: Array<{ minQty: number; price: number }>;
  unit: string;                         // EA, BOX, CASE, SET
  moq: number;

  // 재고
  stock?: number;                       // null = 무제한
  stockAlertAt?: number;

  // 배송
  shippingFee: number;
  freeShippingAt?: number;

  // 상세
  description: string;
  usage?: string;
  caution?: string;
  spec?: Record<string, string>;

  status: ProductStatus;

  // 모더레이션 (Wave C — 운영자 심사 큐 메타)
  moderation?: {
    status: ProductStatus;
    statusReason?: string;
    revisionFields?: string[];          // ["name", "udi", "categoryId", ...]
    reviewedById?: string;
    reviewedAt?: Timestamp;
    submittedAt?: Timestamp;
  };

  // 자동 검증 결과 (Cloud Function 채움)
  verification?: {
    udiValid: boolean | null;            // GS1 체크섬
    udiCheckedAt?: Timestamp;
    licenseOcr?: { number: string; confidence: number };
    licenseOcrAt?: Timestamp;
    categoryMismatch?: boolean | null;   // AI 카테고리 정합성 (Phase 4+, 일단 null)
  };

  // 구독·공동구매
  subscribable: boolean;
  groupBuyable: boolean;

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  // 통계 (denormalize, Cloud Function 갱신)
  viewCount: number;
  orderCount: number;
  avgRating?: number;
  reviewCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============ ORDER ============
// 컬렉션 path: /orders/{orderId}

export interface Order {
  id: string;
  orderNo: string;                      // ORD-20260520-00001 (unique, 정렬용)

  // 소속 (denormalize)
  hospitalId: string;
  hospitalName: string;
  userId: string;                       // 주문자
  userName: string;

  status: OrderStatus;

  // 금액 (KRW)
  subtotalAmount: number;
  shippingAmount: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;

  // 결제
  paymentMethod: PaymentMethod;
  paymentKey?: string;                  // PortOne paymentId
  paidAt?: Timestamp;

  // 결재 워크플로우
  approvalStatus: ApprovalStatus;
  approvedById?: string;
  approvedAt?: Timestamp;
  approvalLog?: Array<{ userId: string; action: string; at: Timestamp; reason?: string }>;

  // 배송지
  shippingZipcode: string;
  shippingAddress: string;
  shippingAddressDetail?: string;
  shippingRecipient: string;
  shippingPhone: string;
  shippingMemo?: string;

  // 세금계산서
  invoiceRequested: boolean;
  invoiceEmail?: string;

  // vendor 카운트 (denormalize, 분할된 SubOrder 수)
  subOrderCount: number;
  vendorIds: string[];                  // 쿼리 가속용

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션: /orders/{orderId}/subOrders/{subOrderId}
export interface SubOrder {
  id: string;
  subOrderNo: string;                   // SO-20260520-00001-A
  orderId: string;                      // parent (denormalize for collectionGroup query)
  orderNo: string;

  // 소속 (denormalize)
  vendorId: string;
  vendorName: string;
  hospitalId: string;
  hospitalName: string;

  status: SubOrderStatus;

  // 금액
  subtotal: number;
  shippingFee: number;
  vat: number;
  total: number;

  // 정산
  commissionRate: number;
  commission: number;
  commissionVat: number;
  payoutAmount: number;

  // 배송
  trackingCarrier?: string;
  trackingNo?: string;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;

  // 세금계산서
  invoiceNo?: string;
  invoiceUrl?: string;
  invoiceIssuedAt?: Timestamp;

  // 정산
  settlementId?: string;
  settledAt?: Timestamp;

  // UDI 보고
  udiReported: boolean;
  udiReportedAt?: Timestamp;

  // 아이템 수 (서브-서브컬렉션이라 카운트 별도)
  itemCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브-서브컬렉션: /orders/{orderId}/subOrders/{subOrderId}/items/{itemId}
export interface SubOrderItem {
  id: string;
  productId: string;
  productName: string;                  // 스냅샷
  productImage?: string;                // 스냅샷

  unitPrice: number;                    // 적용 단가 (티어 반영)
  qty: number;
  amount: number;

  // UDI 보고용 (vendor가 출고 시 입력)
  lotNo?: string;
  expiryDate?: Timestamp;
  serialNo?: string;
  udiCode?: string;                     // Product 스냅샷
}

// ============ SUBSCRIPTION ============
// 컬렉션 path: /subscriptions/{subscriptionId}
// Wave Y — Phase 3 자동 발주 시스템. 단일 product 기반 단순 모델.

export interface Subscription {
  id: string;

  // 소속 (denormalize)
  hospitalId: string;
  hospitalName: string;
  userId: string;                       // 생성자
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  productImage?: string | null;

  // 주기
  cadence: SubscriptionCadence;
  customSchedule?: string;              // "매월 5일", "매월 마지막 영업일" 등
  cronExpression?: string;              // CUSTOM 일 때 (Phase 4+)

  // 수량 / 가격 (스냅샷, 가격 변동 추적용)
  qty: number;
  unitPrice: number;
  unit: string;

  // 상태
  status: SubscriptionStatus;
  statusReason?: string;
  pauseReason?: string;                 // 운영자 강제 정지 사유 (Wave Q3 기존)
  pausedAt?: Timestamp;
  pausedById?: string;
  cancelledAt?: Timestamp;

  // 스케줄
  startsAt?: Timestamp;
  nextRunAt: Timestamp;                 // 다음 자동 발주 예정일
  lastRunAt?: Timestamp;
  endsAt?: Timestamp;

  // 가격 변동 5%+ 시 임시 보류
  priceChangePercent?: number;
  priceChangeRequiresApproval?: boolean;

  // 결제·승인 정책
  autoApprove?: boolean;
  paymentMethod?: PaymentMethod;
  maxPriceChangePercent?: number;       // 기본 5.0

  // 배송지
  shippingAddressId?: string;
  shippingAddress?: {
    name: string;
    phone: string;
    zipcode: string;
    address: string;
    addressDetail?: string;
  };

  // 통계
  totalRuns: number;
  totalAmount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션: /subscriptions/{subscriptionId}/runs/{runId}
export interface SubscriptionRun {
  id: string;
  subscriptionId: string;
  scheduledAt: Timestamp;
  status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED" | "PRICE_HOLD" | "PENDING_APPROVAL";
  orderId?: string;                     // 생성된 order 참조
  errorReason?: string;
  failureReason?: string;
  priceAtRun?: number;                  // 발주 시점 가격
  skippedByUser?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// ============ GROUP BUY ============
// 컬렉션 path: /groupBuys/{groupBuyId}

export interface GroupBuy {
  id: string;
  productId: string;
  productName: string;                  // denormalize
  productImage?: string;
  vendorId: string;
  vendorName: string;

  title: string;
  description?: string;

  startsAt: Timestamp;
  endsAt: Timestamp;

  targetQty: number;
  currentQty: number;                   // Cloud Function이 shard 합산 후 업데이트 (read-friendly 캐시)

  tierPricing: Array<{ minQty: number; price: number }>;

  status: GroupBuyStatus;

  // 통계
  participationCount: number;           // 참여 병원 수

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션: /groupBuys/{groupBuyId}/participations/{participationId}
export interface GroupBuyParticipation {
  id: string;
  groupBuyId: string;
  hospitalId: string;
  hospitalName: string;
  userId: string;

  qty: number;
  preAuthPaymentId?: string;            // PortOne pre-auth
  capturedAt?: Timestamp;
  voidedAt?: Timestamp;

  createdAt: Timestamp;
}

// 서브컬렉션: /groupBuys/{groupBuyId}/counterShards/{shardId}
// shardId = 0~9 (10 shards)
export interface CounterShard {
  count: number;
}

// ============ RFQ ============
// 컬렉션 path: /rfqs/{rfqId}

export interface RFQ {
  id: string;
  rfqNo: string;

  hospitalId: string;
  hospitalName: string;
  userId: string;

  title: string;
  description: string;
  categoryId?: string;

  spec: Record<string, string>;
  attachments: string[];

  targetQty: number;
  expectedDelivery?: Timestamp;
  deadline: Timestamp;

  isPublic: boolean;
  invitedVendorIds: string[];

  status: RFQStatus;
  awardedQuoteId?: string;

  // 통계
  quoteCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션: /rfqs/{rfqId}/quotes/{quoteId}
export interface Quote {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;

  unitPrice: number;
  totalPrice: number;
  deliveryDate: Timestamp;
  validUntil: Timestamp;
  note?: string;
  attachments: string[];

  createdAt: Timestamp;
}

// ============ SETTLEMENT ============
// 컬렉션 path: /settlements/{settlementId}  (관리자 + 본인 vendor)
// Wave M — 풀 정산 lifecycle 데이터 모델.

export interface Settlement {
  id: string;
  vendorId: string;
  vendorName: string;

  periodStart: Timestamp;
  periodEnd: Timestamp;

  // 매출·수수료·환불 분해
  grossAmount: number;
  paymentFeeAmount: number;        // PortOne 결제수수료 (채널별)
  paymentFeeVatAmount: number;
  commissionAmount: number;        // 중개 수수료 (카테고리/등급 rate 반영)
  commissionVatAmount: number;
  refundDeductAmount: number;      // 분쟁/환불 차감
  couponDeductAmount: number;      // 쿠폰 부담금
  netPayout: number;               // gross - 모든 차감

  // 빠른정산
  isFastSettlement: boolean;
  fastSettlementDays: number;      // D+3 등
  fastSettlementFee: number;       // netPayout * 일 0.012% * 단축일수
  finalPayout: number;             // netPayout - fastSettlementFee

  // 참조
  subOrderRefs: Array<{ orderId: string; subOrderId: string; amount: number }>;

  // 상태
  status: SettlementStatus;
  statusReason?: string;
  scheduledPayoutAt: Timestamp;

  // 승인/지급
  approvedById?: string;
  approvedAt?: Timestamp;
  paidAt?: Timestamp;
  payoutId?: string;               // /payouts/{id} 참조

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============ PAYOUT ============
// 컬렉션 path: /payouts/{payoutId}  (관리자 + 본인 vendor)
// Wave M — 실 이체 이력. Settlement N개를 묶어 한 번에 송금하는 단위.

export type PayoutMethod = "PORTONE" | "MANUAL_BANK" | "VIRTUAL_ACCOUNT";
export type PayoutStatus = "REQUESTED" | "PROCESSING" | "PAID" | "FAILED";

export interface Payout {
  id: string;
  vendorId: string;
  vendorName: string;

  // 묶인 settlement
  settlementIds: string[];
  totalAmount: number;

  // 입금 계좌
  bankCode: string;
  bankAccount: string;
  accountHolder: string;

  // 처리 방식
  method: PayoutMethod;
  externalRef?: string;            // PortOne tx id 또는 수동 이체 ref

  status: PayoutStatus;
  errorReason?: string;

  taxInvoiceId?: string;           // 세금계산서 발행 id

  requestedAt: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
}

// ============ NOTIFICATION ============
// 컬렉션 path: /notifications/{notificationId}

export interface Notification {
  id: string;
  targetType: "USER" | "VENDOR" | "HOSPITAL";
  targetId: string;                     // 쿼리 가속

  type: string;                         // ORDER_NEW, ORDER_SHIPPED, SUBSCRIPTION_FAIL, ...
  title: string;
  body: string;
  data?: Record<string, unknown>;

  channels: Array<"IN_APP" | "KAKAO" | "EMAIL">;

  kakaoSent: boolean;
  kakaoSentAt?: Timestamp;
  emailSent: boolean;
  emailSentAt?: Timestamp;

  readAt?: Timestamp;
  createdAt: Timestamp;
}

// ============ AUDIT LOG ============
// 컬렉션 path: /auditLogs/{logId}  (관리자만 접근)

export interface AuditLog {
  id: string;
  actorId?: string;
  actorRole?: UserRole;
  action: string;
  targetType: string;                   // "Vendor", "Product", ...
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Timestamp;
}

// ============ DISPUTE ============
// 컬렉션 path: /disputes/{disputeId}
// Wave E — 분쟁 시스템 풀 구현.

export type DisputeStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "NEEDS_ADMIN_RESPONSE"
  | "RESOLVED"
  | "REJECTED";

export type DisputeType =
  | "REFUND"
  | "RETURN"
  | "NOT_DELIVERED"
  | "QUALITY"
  | "OTHER";

export interface DisputeResolution {
  type: "REFUND" | "PARTIAL_REFUND" | "REJECTED";
  refundAmount: number;
  refundPercent: number;
  payoutAdjustment: number;
  reason: string;
  decidedById: string;
  decidedAt: Timestamp;
}

export interface Dispute {
  id: string;
  orderId: string;
  subOrderId?: string;

  // 소속 (denormalize)
  hospitalId: string;
  hospitalName: string;
  vendorId: string;
  vendorName: string;

  type: DisputeType;
  amount: number;
  reason: string; // 신청 시 hospital 작성

  status: DisputeStatus;
  resolution?: DisputeResolution;

  openedAt: Timestamp;
  deadlineAt: Timestamp; // SLA = openedAt + 48h
  resolvedAt?: Timestamp;

  // SLA 알림 중복 방지
  slaNotifiedAt?: Timestamp;
  slaEscalatedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션 /disputes/{disputeId}/messages/{messageId}
export interface DisputeMessage {
  id: string;
  authorRole: "BUYER" | "VENDOR" | "ADMIN" | "SYSTEM";
  authorId: string;
  authorName: string;
  body: string;
  attachments: Array<{ name: string; size: number; url: string; mime: string }>;
  systemEvent?:
    | "OPENED"
    | "ADMIN_JOINED"
    | "EVIDENCE_REQUESTED"
    | "RESOLVED"
    | "REJECTED";
  createdAt: Timestamp;
}

// 서브컬렉션 /disputes/{disputeId}/activity/{activityId}
export interface DisputeActivity {
  id: string;
  at: Timestamp;
  actorId: string;
  actorRole: "BUYER" | "VENDOR" | "ADMIN" | "SYSTEM";
  action:
    | "OPENED"
    | "MESSAGE_SENT"
    | "ATTACHMENT_UPLOADED"
    | "STATUS_CHANGED"
    | "RESOLVED"
    | "REJECTED"
    | "EVIDENCE_REQUESTED";
  meta?: Record<string, unknown>;
}

// ============ COUPON ============
// 컬렉션 path: /coupons/{couponId}  ← admin 만 write, ACTIVE 쿠폰은 모두 read
// Wave H — 쿠폰 시스템 풀 구현.

export type CouponDiscountType = "PERCENT" | "FIXED";
export type CouponTargetType =
  | "ALL"
  | "CATEGORY"
  | "VENDOR"
  | "FIRST_PURCHASE";
export type CouponStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED";

export interface Coupon {
  id: string;
  code: string;                          // unique, 영문 대문자 + 숫자
  name: string;                          // 운영자 표시명
  description?: string;

  discountType: CouponDiscountType;
  discountValue: number;                 // PERCENT: 1~100, FIXED: KRW
  maxDiscountAmount?: number;            // % 쿠폰 최대 할인 한도 (안전장치)
  minOrderAmount?: number;               // 최소 주문액

  targetType: CouponTargetType;
  targetIds?: string[];                  // CATEGORY → categoryId[], VENDOR → vendorId[]

  startsAt: Timestamp;
  expiresAt: Timestamp;

  issueLimit?: number;                   // 전체 발행 한도 (null = 무제한)
  perUserLimit?: number;                 // 1인당 사용 횟수 (default 1)

  usedCount: number;                     // Cloud Function 이 갱신

  status: CouponStatus;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdById: string;
}

// 서브컬렉션: /coupons/{couponId}/redemptions/{redemptionId}
export interface CouponRedemption {
  id: string;
  couponId: string;
  couponCode: string;                    // denormalize for UI
  hospitalId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  redeemedAt: Timestamp;
}

// ============ CATEGORY ============
// 컬렉션 path: /categories/{categoryId}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  parentId?: string;
  depth: number;                        // 1=대, 2=중, 3=소
  sortOrder: number;

  // 카테고리별 수수료율 override
  commissionRate?: number;

  // 트리 경로 (denormalize, 검색용)
  path: string[];                       // ["의료소모품", "일회용 의료용품", "장갑"]
}

// ============ FEATURE FLAG ============
// 컬렉션 path: /featureFlags/{flagId}
// Wave U — 운영자가 런타임에 ON/OFF 가능한 기능 토글.

export type FeatureFlagSegment = "ALL" | "HOSPITALS" | "VENDORS" | "INTERNAL";

export interface FeatureFlag {
  id: string;                       // flag key (예: "group-buy-v2")
  description: string;
  enabled: boolean;
  rolloutPercentage: number;        // 0~100
  segment?: FeatureFlagSegment;
  enabledByDefault?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedById: string;
}

// ============ UDI REPORT ============
// 컬렉션 path: /udiReports/{period}  (period = "YYYY-MM")
// Wave N — 식약처 의료기기통합정보시스템(e-MEDI) 월말 일괄 보고.

export type UdiReportStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export interface UdiReportResultMeta {
  success: boolean;
  resultCode?: string;
  resultMessage?: string;
  receiptNo?: string;
  source: "mfds" | "mock";
}

export interface UdiReportMaster {
  id: string;                  // "2026-05"
  period: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;

  totalCount: number;
  successCount: number;
  failCount: number;

  status: UdiReportStatus;

  startedAt?: Timestamp;
  completedAt?: Timestamp;
  triggeredById?: string;      // 수동 트리거 시 운영자 uid

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션: /udiReports/{period}/items/{subOrderId}
export interface UdiReportItem {
  id: string;                  // subOrderId
  subOrderId: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  vendorBizRegNo: string;

  hospitalId: string;
  hospitalName: string;
  hospitalBizRegNo: string;

  productId: string;
  productName: string;
  udiCode: string;
  lotNo: string;
  expiry: string;
  mfdsLicenseNo?: string;

  quantity: number;
  unitPrice: number;
  saleDate: string;

  result?: UdiReportResultMeta;
  retryCount: number;
  reportedAt?: Timestamp;
  createdAt: Timestamp;
}
