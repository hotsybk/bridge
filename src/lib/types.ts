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

export type ProductStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "ARCHIVED";
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

export type GroupBuyStatus = "OPEN" | "TARGET_MET" | "FULFILLED" | "FAILED";
export type RFQStatus = "OPEN" | "CLOSED" | "AWARDED" | "CANCELLED";

export type PaymentMethod = "CARD" | "BANK_TRANSFER" | "NET_30" | "POINT";
export type SettlementStatus = "PENDING" | "REQUESTED" | "PAID" | "HOLD";
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

export interface Subscription {
  id: string;
  hospitalId: string;
  hospitalName: string;

  name: string;
  status: SubscriptionStatus;

  cadence: SubscriptionCadence;
  cronExpression?: string;              // CUSTOM일 때

  startsAt: Timestamp;
  nextRunAt: Timestamp;
  lastRunAt?: Timestamp;
  endsAt?: Timestamp;

  autoApprove: boolean;
  paymentMethod: PaymentMethod;
  maxPriceChangePercent: number;        // 기본 5.0

  items: Array<{                        // embedded — 자주 함께 조회
    productId: string;
    productName: string;
    vendorId: string;
    qty: number;
  }>;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 서브컬렉션: /subscriptions/{subscriptionId}/runs/{runId}
export interface SubscriptionRun {
  id: string;
  runAt: Timestamp;
  orderId?: string;
  status: "SUCCESS" | "SKIPPED" | "FAILED" | "PENDING_APPROVAL";
  failureReason?: string;
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
// 컬렉션 path: /settlements/{settlementId}  (관리자만 접근)

export interface Settlement {
  id: string;
  vendorId: string;
  vendorName: string;

  periodStart: Timestamp;
  periodEnd: Timestamp;

  grossAmount: number;
  commissionAmount: number;
  vatAmount: number;
  refundAmount: number;
  payoutAmount: number;

  isFastSettlement: boolean;
  fastFee: number;

  status: SettlementStatus;
  paidAt?: Timestamp;

  // subOrderIds (참조)
  subOrderRefs: Array<{ orderId: string; subOrderId: string }>;

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
