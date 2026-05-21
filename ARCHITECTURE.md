# ARCHITECTURE.md — MedPlace 시스템 아키텍처 (v2 — Firebase)

> 이 문서는 어떻게 만들 것인지를 정의한다.
> 무엇을 만들지는 `PRD.md`, 어떻게 보일지는 `DESIGN_SYSTEM.md`에 있다.
>
> **v2 변경**: Prisma/Postgres 데이터 모델 → Firebase Firestore 컬렉션 설계 + Cloud Functions + Security Rules.

---

## 1. 시스템 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser/Mobile)                   │
│   - Next.js 16 RSC + Client Components                          │
│   - Firebase Web SDK v9 modular (Auth, Firestore, Storage)      │
│   - Tailwind + shadcn/ui + Pretendard Variable                  │
└────────────────────────────────┬────────────────────────────────┘
                  HTTPS / Auth Cookie│
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Next.js 16 App (Vercel)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ proxy.ts       → next-firebase-auth-edge authMiddleware    │ │
│  │   - 세션 쿠키 검증, 만료 토큰 자동 refresh                  │ │
│  │   - 보호된 라우트 자동 리다이렉트                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ App Router                                                  │ │
│  │  (marketing) | (auth) | (buyer) | (vendor) | (admin)       │ │
│  │  - RSC에서 firebase-admin 사용 (직접 Firestore 읽기)        │ │
│  │  - Client Component에서 firebase Web SDK 사용              │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Layer                                                   │ │
│  │  - /api/login, /api/logout, /api/refresh-token (auth-edge) │ │
│  │  - /api/trpc/[trpc]   (tRPC v11, firebase-admin context)   │ │
│  │  - /api/webhooks/portone   (결제 webhook)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─┬────────────────────────────────────────────────────────────────┘
  │                                                       
  ▼                                                       
┌────────────────────────────────────────────────────────────────┐
│           Firebase (Project: medplace-{dev|prod})              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Authentication                                            │ │
│  │  - Email/Password, Google (Phase 1)                       │ │
│  │  - Kakao via Custom Token (Phase 2+)                      │ │
│  │  - Custom Claims로 role 저장 (BUYER/VENDOR/ADMIN)         │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Firestore (Native, asia-northeast3)                       │ │
│  │  /hospitals  /vendors  /products  /orders  /subOrders     │ │
│  │  /subscriptions  /groupBuys  /rfqs  /settlements          │ │
│  │  /notifications  /auditLogs  /counters                    │ │
│  │  Security Rules: 컬렉션별 row-level 격리                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Cloud Functions for Firebase (2nd gen, asia-northeast3)   │ │
│  │  Firestore Triggers: onOrderCreated, onSubOrderShipped    │ │
│  │  Scheduled (Cloud Scheduler):                              │ │
│  │    - subscriptionRunner   매일 03:00 KST                  │ │
│  │    - groupbuyCloser       매분 (마감 정리)                 │ │
│  │    - udiMonthlyReport     매월 말일 23:00                  │ │
│  │  HTTPS Callable: finalizeGroupBuy, settleSubOrder         │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Cloud Storage (asia-northeast3)                           │ │
│  │  /vendor-docs/{vendorId}/...     사업자증·신고증           │ │
│  │  /products/{productId}/...        상품 이미지              │ │
│  │  /invoices/{filename}            세금계산서 (filename = SO-xxx.pdf) │ │
│  │  Storage Rules: 권한별 read/write 제한                    │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────┬────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                  외부 API (Phase별 도입)                         │
│  - PortOne V2 (결제/정산/세금계산서)                            │
│  - Naver Clova OCR (사업자증 인식)                              │
│  - 솔라피 알림톡                                                │
│  - 식약처 UDI OpenAPI                                          │
│  - Algolia (Firestore → Algolia sync via Cloud Function)       │
│  - 국세청 사업자 진위확인                                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Firestore 컬렉션 설계

### 2.1 설계 원칙
1. **루트 컬렉션 중심** — `/hospitals/{id}`, `/vendors/{id}`, `/orders/{id}` 등 도메인별 평면 분리
2. **서브컬렉션은 1-대-N 강한 종속에만** — 예: `/orders/{orderId}/subOrders/{subOrderId}` (Order 없이 SubOrder 존재 불가)
3. **denormalize 적극 활용** — JOIN이 없으므로 자주 함께 조회되는 필드는 복제 저장
4. **doc ID는 nanoid** — Customer1, Customer2 같은 monotonic ID 금지 (Firestore 핫스팟 발생)
5. **타임스탬프는 항상 serverTimestamp()** — 클라이언트 시간 신뢰 금지
6. **Composite Index는 firestore.indexes.json에 명시** — 콘솔 즉석 생성 금지

### 2.2 컬렉션 구조 개요

```
/users/{userId}                          (Auth UID 기준)
/hospitals/{hospitalId}
  /members/{userId}                      (병원 소속 user, denormalize: role, name)
/vendors/{vendorId}
  /members/{userId}
  /products/{productId}                  ← /products 루트 사용 권장 (검색·노출 위해)
/products/{productId}                    ← 루트 컬렉션 (Algolia sync 대상)
/orders/{orderId}
  /subOrders/{subOrderId}                ← subOrders는 orders 서브컬렉션 (강한 종속)
    /items/{itemId}
/subscriptions/{subscriptionId}
  /runs/{runId}                          (실행 이력)
/groupBuys/{groupBuyId}
  /participations/{participationId}
  /counterShards/{shardId}               (distributed counter 0~9)
/rfqs/{rfqId}
  /quotes/{quoteId}
/settlements/{settlementId}              (관리자 전용)
/notifications/{notificationId}
/auditLogs/{logId}                       (관리자 전용)
/categories/{categoryId}                 (카테고리 트리)
/_retryQueue/{retryId}                   (실패한 외부 API 재시도)
```

### 2.3 각 컬렉션 상세 스키마 (TypeScript Type)

`src/lib/types.ts` 또는 `src/server/firebase/collections.ts`에 정의:

```ts
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
```

### 2.4 컬렉션 경로 상수 (`src/server/firebase/collections.ts`)

```ts
export const COLLECTIONS = {
  users: "users",
  hospitals: "hospitals",
  vendors: "vendors",
  products: "products",
  orders: "orders",
  subscriptions: "subscriptions",
  groupBuys: "groupBuys",
  rfqs: "rfqs",
  settlements: "settlements",
  notifications: "notifications",
  auditLogs: "auditLogs",
  categories: "categories",
  retryQueue: "_retryQueue",
} as const;

export const SUB_COLLECTIONS = {
  hospitalMembers: (hospitalId: string) => `hospitals/${hospitalId}/members`,
  vendorMembers: (vendorId: string) => `vendors/${vendorId}/members`,
  subOrders: (orderId: string) => `orders/${orderId}/subOrders`,
  subOrderItems: (orderId: string, subOrderId: string) =>
    `orders/${orderId}/subOrders/${subOrderId}/items`,
  subscriptionRuns: (subId: string) => `subscriptions/${subId}/runs`,
  groupBuyParticipations: (gbId: string) => `groupBuys/${gbId}/participations`,
  groupBuyShards: (gbId: string) => `groupBuys/${gbId}/counterShards`,
  rfqQuotes: (rfqId: string) => `rfqs/${rfqId}/quotes`,
} as const;
```

---

## 3. Firestore Composite Indexes

`firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "categoryId", "order": "ASCENDING" },
        { "fieldPath": "basePrice", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "vendorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "hospitalId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "subOrders",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "vendorId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "subscriptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "nextRunAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "groupBuys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "endsAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "rfqs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "deadline", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "vendors",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 4. Firestore Security Rules

`firestore.rules` 기본 패턴 (Phase 1 시작용):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ===== 헬퍼 함수 =====
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function role() {
      return request.auth.token.role;
    }
    function isAdmin() {
      return isSignedIn() && (role() == 'ADMIN' || role() == 'SUPER_ADMIN');
    }
    function isBuyer() {
      return isSignedIn() && role() in ['BUYER_OWNER', 'BUYER_STAFF', 'BUYER_VIEWER'];
    }
    function isVendor() {
      return isSignedIn() && role() in ['VENDOR_OWNER', 'VENDOR_STAFF'];
    }
    function userHospital() {
      return request.auth.token.hospitalId;
    }
    function userVendor() {
      return request.auth.token.vendorId;
    }
    
    // ===== /users =====
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) && 
                       !('role' in request.resource.data.diff(resource.data).affectedKeys()) &&
                       !('hospitalId' in request.resource.data.diff(resource.data).affectedKeys()) &&
                       !('vendorId' in request.resource.data.diff(resource.data).affectedKeys());
      // role/hospitalId/vendorId 변경은 Cloud Function (Admin SDK) only
      allow delete: if false;
    }
    
    // ===== /hospitals =====
    match /hospitals/{hospitalId} {
      allow read: if isAdmin() || (isBuyer() && userHospital() == hospitalId);
      allow create: if isSignedIn();    // 가입 시 본인이 생성
      allow update: if isAdmin() || 
                       (isBuyer() && userHospital() == hospitalId && 
                        role() == 'BUYER_OWNER');
      allow delete: if false;
      
      match /members/{memberId} {
        allow read: if isAdmin() || (isBuyer() && userHospital() == hospitalId);
        allow write: if isAdmin();      // 멤버 관리는 Cloud Function only
      }
    }
    
    // ===== /vendors =====
    match /vendors/{vendorId} {
      allow read: if true;              // 공개 정보 (회사명/평점 등)
      allow create: if isSignedIn();
      allow update: if isAdmin() || 
                       (isVendor() && userVendor() == vendorId && 
                        !('status' in request.resource.data.diff(resource.data).affectedKeys()) &&
                        !('defaultCommissionRate' in request.resource.data.diff(resource.data).affectedKeys()));
      // status·수수료율은 admin only
      allow delete: if false;
      
      match /members/{memberId} {
        allow read: if isAdmin() || (isVendor() && userVendor() == vendorId);
        allow write: if isAdmin();
      }
    }
    
    // ===== /products =====
    match /products/{productId} {
      allow read: if resource.data.status == 'ACTIVE' || 
                     isAdmin() || 
                     (isVendor() && userVendor() == resource.data.vendorId);
      allow create: if isVendor() && request.resource.data.vendorId == userVendor();
      allow update: if isAdmin() || 
                       (isVendor() && userVendor() == resource.data.vendorId &&
                        request.resource.data.vendorId == resource.data.vendorId);
      allow delete: if false;           // archived만, hard delete 금지
    }
    
    // ===== /orders =====
    match /orders/{orderId} {
      allow read: if isAdmin() || 
                     (isBuyer() && userHospital() == resource.data.hospitalId) ||
                     (isVendor() && userVendor() in resource.data.vendorIds);
      allow create: if isBuyer() && 
                       request.resource.data.hospitalId == userHospital() &&
                       request.resource.data.userId == request.auth.uid;
      allow update: if false;           // 모든 업데이트는 Cloud Function (Admin SDK) only
      allow delete: if false;
      
      match /subOrders/{subOrderId} {
        allow read: if isAdmin() || 
                       (isBuyer() && userHospital() == resource.data.hospitalId) ||
                       (isVendor() && userVendor() == resource.data.vendorId);
        allow write: if false;          // Cloud Function only
        
        match /items/{itemId} {
          allow read: if isAdmin() || 
                         (isBuyer() && userHospital() == get(/databases/$(database)/documents/orders/$(orderId)).data.hospitalId) ||
                         (isVendor() && userVendor() == get(/databases/$(database)/documents/orders/$(orderId)/subOrders/$(subOrderId)).data.vendorId);
          allow write: if false;
        }
      }
    }
    
    // ===== /subscriptions =====
    match /subscriptions/{subId} {
      allow read: if isAdmin() || 
                     (isBuyer() && userHospital() == resource.data.hospitalId);
      allow create: if isBuyer() && 
                       request.resource.data.hospitalId == userHospital();
      allow update: if isAdmin() || 
                       (isBuyer() && userHospital() == resource.data.hospitalId && 
                        role() == 'BUYER_OWNER');
      allow delete: if false;
      
      match /runs/{runId} {
        allow read: if isAdmin() || 
                       (isBuyer() && userHospital() == get(/databases/$(database)/documents/subscriptions/$(subId)).data.hospitalId);
        allow write: if false;          // Cloud Function only
      }
    }
    
    // ===== /groupBuys =====
    match /groupBuys/{gbId} {
      allow read: if true;              // 공개
      allow write: if false;            // 생성/수정은 Cloud Function only
      
      match /participations/{pId} {
        allow read: if isAdmin() || 
                       (isBuyer() && resource.data.hospitalId == userHospital());
        allow create: if isBuyer() && 
                         request.resource.data.hospitalId == userHospital();
        allow update, delete: if false; // Cloud Function only
      }
      
      match /counterShards/{shardId} {
        allow read: if false;
        allow write: if false;          // Cloud Function only
      }
    }
    
    // ===== /rfqs =====
    match /rfqs/{rfqId} {
      allow read: if isAdmin() || 
                     (isBuyer() && resource.data.hospitalId == userHospital()) ||
                     (isVendor() && (resource.data.isPublic == true || userVendor() in resource.data.invitedVendorIds));
      allow create: if isBuyer() && 
                       request.resource.data.hospitalId == userHospital();
      allow update: if isAdmin() || 
                       (isBuyer() && resource.data.hospitalId == userHospital());
      allow delete: if false;
      
      match /quotes/{quoteId} {
        allow read: if isAdmin() || 
                       (isBuyer() && get(/databases/$(database)/documents/rfqs/$(rfqId)).data.hospitalId == userHospital()) ||
                       (isVendor() && resource.data.vendorId == userVendor());
        allow create: if isVendor() && 
                         request.resource.data.vendorId == userVendor();
        allow update: if isVendor() && 
                         resource.data.vendorId == userVendor();
        allow delete: if false;
      }
    }
    
    // ===== /settlements (관리자 + 본인 vendor만) =====
    match /settlements/{settlementId} {
      allow read: if isAdmin() || 
                     (isVendor() && resource.data.vendorId == userVendor());
      allow write: if false;            // Cloud Function only
    }
    
    // ===== /notifications =====
    match /notifications/{notifId} {
      allow read: if (resource.data.targetType == 'USER' && resource.data.targetId == request.auth.uid) ||
                     (resource.data.targetType == 'HOSPITAL' && resource.data.targetId == userHospital()) ||
                     (resource.data.targetType == 'VENDOR' && resource.data.targetId == userVendor());
      allow update: if isSignedIn() && 
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readAt']);
      // 생성/삭제는 Cloud Function only
      allow create, delete: if false;
    }
    
    // ===== /auditLogs =====
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow write: if false;            // Cloud Function only
    }
    
    // ===== /categories =====
    match /categories/{catId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // ===== /_retryQueue =====
    match /_retryQueue/{retryId} {
      allow read, write: if false;     // Cloud Function only
    }
    
    // ===== Catch-all (보안 기본) =====
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**규칙 변경 시 항상 Firebase Emulator로 테스트 후 사용자 승인 받아 배포**.

---

## 5. Cloud Storage Security Rules

`storage.rules`:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    function isSignedIn() { return request.auth != null; }
    function role() { return request.auth.token.role; }
    function isAdmin() { return isSignedIn() && role() in ['ADMIN', 'SUPER_ADMIN']; }
    function isVendor() { return isSignedIn() && role() in ['VENDOR_OWNER', 'VENDOR_STAFF']; }
    function userVendor() { return request.auth.token.vendorId; }
    
    // vendor 서류 (사업자증, 신고증, 통장 사본)
    // 온보딩 시점에는 vendorId가 token에 없음 — 본인 uid를 path segment로 쓸 때 임시 허용
    match /vendor-docs/{vendorId}/{allPaths=**} {
      allow read: if isAdmin() ||
                     (isVendor() && userVendor() == vendorId) ||
                     (isSignedIn() && request.auth.uid == vendorId);          // 온보딩 임시
      allow write: if isSignedIn() &&
                      ((isVendor() && userVendor() == vendorId) ||
                       request.auth.uid == vendorId) &&                       // 온보딩 임시 (uid path)
                      request.resource.size < 10 * 1024 * 1024 &&             // 10MB
                      request.resource.contentType.matches('image/.*|application/pdf');
    }
    
    // hospital 서류 (사업자등록증)
    // 온보딩 시점에는 hospitalId가 token에 없음 — 본인 uid를 path segment로 쓸 때 임시 허용
    match /hospital-docs/{hospitalId}/{allPaths=**} {
      allow read: if isAdmin() ||
                     (isSignedIn() && request.auth.token.hospitalId == hospitalId) ||
                     (isSignedIn() && request.auth.uid == hospitalId);         // 온보딩 임시
      allow write: if isSignedIn() &&
                      (request.auth.token.hospitalId == hospitalId ||
                       request.auth.uid == hospitalId) &&                      // 온보딩 임시 (uid path)
                      request.resource.size < 10 * 1024 * 1024 &&
                      request.resource.contentType.matches('image/.*|application/pdf');
    }
    
    // 상품 이미지 (vendor 업로드, 공개 읽기)
    match /products/{productId}/{allPaths=**} {
      allow read: if true;
      allow write: if isVendor() && 
                     request.resource.size < 5 * 1024 * 1024 &&
                     request.resource.contentType.matches('image/.*');
    }
    
    // 세금계산서 PDF (Cloud Function이 생성, 본인만 다운로드)
    // Firebase Storage Rules 문법상 {var}.확장자 형태 직접 표기 불가 — 단일 segment matcher 사용
    match /invoices/{filename} {
      allow read: if isSignedIn();      // Cloud Function이 사전 권한 확인 후 signed URL 발급
      allow write: if false;
    }
    
    // 기타
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 6. 핵심 비즈니스 로직 패턴

### 6.1 멀티벤더 주문 분할 (Cloud Function 트랜잭션)

**왜 Cloud Function?**: Firestore 트랜잭션은 다중 컬렉션 쓰기 시 클라이언트에서 호출하면 보안·정합성 모두 위험. Cloud Function에서 Admin SDK로 처리.

`functions/src/callable/create-order.ts`:

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

export const createOrder = onCall(
  { region: "asia-northeast3", memory: "256MiB" },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login required");
    
    const db = getFirestore();
    
    return db.runTransaction(async (tx) => {
      // 1. 모든 product 읽기 + 검증
      const productRefs = data.items.map((i) => 
        db.collection("products").doc(i.productId)
      );
      const productSnaps = await tx.getAll(...productRefs);
      const products = productSnaps.map((s) => {
        if (!s.exists) throw new HttpsError("not-found", `Product ${s.id}`);
        const p = s.data();
        if (p.status !== "ACTIVE") 
          throw new HttpsError("failed-precondition", `Product ${p.name} unavailable`);
        return { id: s.id, ...p };
      });
      
      // 2. vendor별 그룹핑
      const byVendor = products.reduce((acc, p) => {
        if (!acc[p.vendorId]) acc[p.vendorId] = [];
        acc[p.vendorId].push(p);
        return acc;
      }, {});
      
      // 3. Order doc 생성 (server timestamp + nanoid)
      const orderRef = db.collection("orders").doc();
      const orderNo = generateOrderNo();
      
      const subOrderRefs = [];
      const vendorIds = Object.keys(byVendor);
      
      // 4. SubOrder 생성 (vendor당 1개)
      for (const vendorId of vendorIds) {
        const subOrderRef = orderRef.collection("subOrders").doc();
        subOrderRefs.push({ subOrderRef, vendorId, products: byVendor[vendorId] });
      }
      
      // ⚠️ 500 docs 한계 체크
      const totalDocsCount = 1 + subOrderRefs.length + 
                             products.length; // items
      if (totalDocsCount > 500) 
        throw new HttpsError("resource-exhausted", "Order too large, split required");
      
      // 5. 일괄 쓰기
      tx.set(orderRef, { /* Order 데이터 */ });
      for (const { subOrderRef, vendorId, products: vendorProducts } of subOrderRefs) {
        tx.set(subOrderRef, { /* SubOrder 데이터 */ });
        for (const p of vendorProducts) {
          const itemRef = subOrderRef.collection("items").doc();
          tx.set(itemRef, { /* SubOrderItem */ });
        }
      }
      
      return { orderId: orderRef.id, orderNo };
    });
  }
);
```

**중요**: 트랜잭션 외부에서 PortOne 결제 호출 → 성공 시 별도 callable로 `confirmOrder({orderId, paymentId})` 호출하여 상태 업데이트.

### 6.2 정기구독 Cron (Cloud Scheduler + Cloud Function)

`functions/src/scheduled/subscription-runner.ts`:

```ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export const subscriptionRunner = onSchedule(
  {
    schedule: "0 3 * * *",              // 매일 03:00
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "512MiB",
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    
    // 페이지네이션 (한 번에 200건씩)
    let lastDoc = null;
    while (true) {
      let query = db.collection("subscriptions")
        .where("status", "==", "ACTIVE")
        .where("nextRunAt", "<=", now)
        .orderBy("nextRunAt")
        .limit(200);
      if (lastDoc) query = query.startAfter(lastDoc);
      
      const snap = await query.get();
      if (snap.empty) break;
      
      for (const doc of snap.docs) {
        // 각각을 Pub/Sub 또는 Task Queue로 enqueue 권장 (대량 처리 시)
        await processSubscriptionRun(doc.id, doc.data());
      }
      
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 200) break;
    }
  }
);

async function processSubscriptionRun(subId: string, sub: any) {
  // 1. 재고/가격 변동 체크
  // 2. createOrder 호출 (위 6.1)
  // 3. 자동결제 (PortOne billingKey)
  // 4. SubscriptionRun 기록 + nextRunAt 갱신
  // 실패 시 _retryQueue에 등록
}
```

### 6.3 공동구매 Distributed Counter (NEXUS FATE 패턴 적용)

**문제**: `groupBuys/{id}.currentQty`를 직접 증가시키면 동시성 충돌·핫스팟.

**해결**: 10개 shard에 분산 저장, 읽을 때 합산.

`functions/src/callable/participate-groupbuy.ts`:

```ts
export const participateGroupbuy = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { auth, data } = request;
    const db = getFirestore();
    
    const gbRef = db.collection("groupBuys").doc(data.groupBuyId);
    const shardId = Math.floor(Math.random() * 10).toString();
    const shardRef = gbRef.collection("counterShards").doc(shardId);
    
    return db.runTransaction(async (tx) => {
      // 1. gb 상태 확인
      const gbSnap = await tx.get(gbRef);
      if (!gbSnap.exists || gbSnap.data().status !== "OPEN") 
        throw new HttpsError("failed-precondition", "Not open");
      
      // 2. PortOne pre-auth (외부 호출 → 트랜잭션 전에 수행하는 게 정석)
      // ⚠️ 외부 API는 트랜잭션 외부에서. 여기서는 이미 호출된 paymentId를 받는 구조 권장
      
      // 3. participation 생성
      const partRef = gbRef.collection("participations").doc();
      tx.set(partRef, {
        groupBuyId: data.groupBuyId,
        hospitalId: auth.token.hospitalId,
        qty: data.qty,
        preAuthPaymentId: data.preAuthPaymentId,
        createdAt: FieldValue.serverTimestamp(),
      });
      
      // 4. shard 증가
      tx.update(shardRef, { count: FieldValue.increment(data.qty) });
      
      return { participationId: partRef.id };
    });
  }
);

// 합산 함수 (groupBuyCloser cron이 매분 호출)
async function aggregateCounter(gbId: string): Promise<number> {
  const shardsSnap = await getFirestore()
    .collection(`groupBuys/${gbId}/counterShards`)
    .get();
  return shardsSnap.docs.reduce((sum, d) => sum + (d.data().count || 0), 0);
}
```

### 6.4 공동구매 마감 (매분 Cron)

```ts
export const groupbuyCloser = onSchedule(
  { schedule: "* * * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    
    const snap = await db.collection("groupBuys")
      .where("status", "==", "OPEN")
      .where("endsAt", "<=", now)
      .limit(50)
      .get();
    
    for (const doc of snap.docs) {
      const gb = doc.data();
      const finalQty = await aggregateCounter(doc.id);
      
      if (finalQty >= gb.targetQty) {
        await finalizeFulfilled(doc.id);   // capture 전체 + SubOrder 생성
      } else {
        await finalizeFailed(doc.id);      // void 전체
      }
    }
  }
);
```

### 6.5 UDI 월간 보고 (매월 말일)

```ts
export const udiMonthlyReport = onSchedule(
  {
    schedule: "0 23 28-31 * *",         // 28~31일 23:00, 함수 내부에서 말일 검증
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "1GiB",
    timeoutSeconds: 540,                // 최대 9분
  },
  async () => {
    // 1. 전월 SHIPPED + udiReported=false 인 SubOrder를 collectionGroup query로 수집
    // 2. vendor별 그룹핑
    // 3. 식약처 OPEN API에 보고
    // 4. 성공 시 udiReported=true 일괄 업데이트 (writeBatch 500개씩 나눠서)
  }
);
```

### 6.6 Firestore → Algolia Sync (Phase 2)

```ts
// /products doc 변경 시 자동 sync
export const onProductWrite = onDocumentWritten(
  { document: "products/{productId}", region: "asia-northeast3" },
  async (event) => {
    const after = event.data.after.data();
    if (!after || after.status !== "ACTIVE") {
      await algolia.index("products").deleteObject(event.params.productId);
      return;
    }
    await algolia.index("products").saveObject({
      objectID: event.params.productId,
      ...after,
    });
  }
);
```

---

## 7. 인증 흐름 (next-firebase-auth-edge)

### 7.1 클라이언트 → 서버 세션 동기화

```
[Browser]
1. signInWithEmailAndPassword(auth, email, pwd) — Firebase Web SDK
2. user.getIdToken() → idToken
3. POST /api/login { idToken } (서버에 쿠키 세팅 요청)
                        │
                        ▼
[Next.js Server: /api/login]
4. authMiddleware → cookie 세팅 (httpOnly, signed)
5. Set-Cookie: AuthToken=...
                        │
                        ▼
[Subsequent Requests]
6. proxy.ts → authMiddleware가 쿠키 검증
7. RSC에서 getTokens(cookies()) → { uid, claims } 사용 가능
```

### 7.2 `src/proxy.ts`

> ※ Next.js 16부터 `middleware.ts` 파일 컨벤션이 `proxy.ts`로 변경됨. 동작은 동일.
> 공식 안내: https://nextjs.org/docs/messages/middleware-to-proxy

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authMiddleware, redirectToLogin } from "next-firebase-auth-edge";

const PUBLIC_PATHS = ["/", "/login", "/register", "/about", "/pricing"];

export async function proxy(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: process.env.NEXT_PUBLIC_FIREBASE_AUTH_COOKIE_NAME!,
    cookieSignatureKeys: [
      process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_1!,
      process.env.FIREBASE_AUTH_COOKIE_SIGNATURE_KEY_2!,
    ],
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 24,        // 12일
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    },
    handleValidToken: async ({ token, decodedToken }, headers) => {
      const role = decodedToken.role;
      const { pathname } = request.nextUrl;
      
      // role 기반 분기
      if (pathname.startsWith("/admin") && !["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      if (pathname.startsWith("/seller") && !["VENDOR_OWNER", "VENDOR_STAFF"].includes(role)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
    handleError: async (e) => {
      console.error("Auth proxy error:", e);
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
```

### 7.3 Custom Claims (role 저장)

Cloud Function이 user 가입 시 또는 admin 승인 시 호출:

```ts
import { getAuth } from "firebase-admin/auth";

export async function setUserRole(uid: string, role: UserRole, hospitalId?: string, vendorId?: string) {
  await getAuth().setCustomUserClaims(uid, {
    role,
    hospitalId,
    vendorId,
  });
  // 클라이언트는 다음 토큰 갱신 시 반영. force-refresh로 즉시 적용 가능.
}
```

---

## 8. Web SDK vs Admin SDK 사용 위치

| 위치 | SDK | 용도 |
|---|---|---|
| Client Component | `firebase` (Web v9) | 로그인, onSnapshot 실시간 구독, 본인 데이터 읽기 |
| Server Component (RSC) | `firebase-admin` | 페이지 SSR 시 데이터 fetch, 세션 토큰 기반 권한 확인 |
| API Route / tRPC | `firebase-admin` | 모든 mutation, 외부 API 연동 |
| Cloud Function | `firebase-admin` | 비즈니스 로직, 트랜잭션, scheduled jobs |
| proxy.ts | `next-firebase-auth-edge` (내부적으로 jose 사용) | Edge runtime — admin SDK 직접 사용 불가 |

**원칙**: Client SDK는 가능한 한 적게. Security Rules가 강력해도 비즈니스 로직 무결성은 서버 측에서 보장하는 것이 안전.

---

## 9. tRPC Router 구조

```
server/api/routers/
├── auth.ts            (현재 user 정보, role 갱신)
├── hospital.ts        (onboard, updateProfile, getDashboard)
├── vendor.ts          (onboard, updateProfile, getDashboard)
├── product.ts         (list, get, search, create, update, archive)
├── cart.ts            (Upstash Redis 사용, 또는 Firestore /carts/{userId})
├── order.ts           (create → Cloud Function callable, list, getDetail, cancel)
├── subOrder.ts        (updateStatus, addTracking — vendor 측)
├── subscription.ts    (create, list, pause, skip, cancel, update)
├── groupBuy.ts        (list, get, participate, cancel)
├── rfq.ts             (create, list, get, submitQuote, award)
├── settlement.ts      (list, requestFast, getDetail)
├── notification.ts    (list, markAsRead)
└── admin/
    ├── vendor.ts      (review, approve, reject, suspend)
    ├── product.ts     (review, approve, reject)
    ├── settlement.ts  (override, hold, release)
    ├── category.ts    (create, update, reorder)
    └── stats.ts       (overview, gmv, vendors, hospitals)
```

각 procedure 패턴:

```ts
import { getFirestore } from "firebase-admin/firestore";
import { TRPCError } from "@trpc/server";

export const productRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ categoryId: z.string().optional(), page: z.number().default(1) }))
    .query(async ({ input, ctx }) => {
      const db = getFirestore();
      let query = db.collection("products").where("status", "==", "ACTIVE");
      if (input.categoryId) query = query.where("categoryId", "==", input.categoryId);
      const snap = await query.limit(20).offset((input.page - 1) * 20).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }),
    
  create: vendorProcedure
    .input(productCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getFirestore();
      const ref = db.collection("products").doc();
      await ref.set({
        ...input,
        vendorId: ctx.session.vendorId,       // multi-tenant 격리
        vendorName: ctx.session.vendorName,   // denormalize
        status: "PENDING_REVIEW",
        viewCount: 0,
        orderCount: 0,
        reviewCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id: ref.id };
    }),
});
```

---

## 10. 캐싱 전략

| 데이터 | 위치 | TTL | 무효화 |
|---|---|---|---|
| 상품 검색 결과 | Algolia | — | Cloud Function이 Firestore write 감지하여 sync |
| 카테고리 트리 | Next.js Server Cache + Firestore | 1시간 | 관리자 수정 시 revalidatePath |
| 장바구니 | Upstash Redis or Firestore `/carts/{userId}` | 30일 | 주문 완료 시 |
| 공동구매 카운터 | Firestore shards + 캐시 doc | 매분 합산 | groupbuyCloser cron |
| 상품 상세 | Next.js ISR | 60초 | Firestore write 감지 → revalidate |
| 세션 | next-firebase-auth-edge 쿠키 | 12일 | logout |

---

## 11. 실시간 통신 (Firestore onSnapshot)

Client Component에서:

```tsx
"use client";
import { onSnapshot, query, collection, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export function VendorOrdersStream({ vendorId }: { vendorId: string }) {
  useEffect(() => {
    const q = query(
      collection(db, "orders"),                  // 또는 collectionGroup("subOrders")
      where("vendorIds", "array-contains", vendorId),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      // UI 업데이트
    });
    return () => unsub();
  }, [vendorId]);
  return ...;
}
```

**무료**: Firestore 구독은 추가 비용 없음 (read 요금만 청구). Supabase Realtime처럼 동시 연결 수 제한도 사실상 없음.

---

## 12. 보안 모델 요약

### 12.1 인증
- Firebase Authentication (이메일/Google → Phase 1, 카카오 Custom Token → Phase 2+)
- next-firebase-auth-edge가 서버 세션 쿠키 관리
- Custom Claims에 `role`, `hospitalId`, `vendorId` 저장

### 12.2 인가 (3중 방어)
1. **proxy.ts** — 라우트 레벨 redirect
2. **tRPC procedure** — protectedProcedure + role check
3. **Firestore Security Rules** — DB 레벨 최후 방어

### 12.3 Row-Level 격리
- Custom Claims의 `hospitalId`/`vendorId`로 Security Rules가 자동 격리
- tRPC procedure에서도 동일 값을 다시 확인

### 12.4 Rate Limiting (Upstash, Phase 2~)
- 로그인 5회/분/IP, 가입 3회/시간/IP, API 100회/분/User

---

## 13. 배포 & 운영

### 13.1 환경 분리
- `local` — Firebase Emulator Suite (Auth + Firestore + Functions + Storage)
- `dev` — Firebase project `medplace-dev`
- `staging` — Firebase project `medplace-staging`
- `production` — Firebase project `medplace-prod`

### 13.2 Firestore 배포
```bash
firebase use dev
firebase deploy --only firestore:rules,firestore:indexes
```
**자동 배포 금지** — 항상 사용자 명시 승인 후 수동 실행.

### 13.3 Functions 배포
```bash
firebase use dev
firebase deploy --only functions:subscriptionRunner
```
**개별 함수 단위 배포 권장** (전체 배포는 cold start 영향).

### 13.4 모니터링
- Firebase Console: Functions logs, Firestore usage, Auth users
- Sentry: 에러 + 성능
- PostHog: 사용자 행동
- Vercel Analytics: Web Vitals
- 자체 운영 대시보드: GMV·결제 성공률·정산 현황

### 13.5 백업
- Firestore: 일 1회 GCS export (gcloud firestore export)
- Cloud Storage: 버전 관리 활성화
- audit logs는 별도 컬렉션으로 영구 보관

---

## 14. 외부 API 의존성

| API | 용도 | 위치 |
|---|---|---|
| PortOne V2 | 결제·정산·세금계산서 | Cloud Functions + tRPC |
| Naver Clova OCR | 사업자증·신고증 인식 | tRPC procedure |
| 국세청 사업자 진위확인 | 휴폐업 조회 | tRPC procedure |
| 솔라피 알림톡 | 주문/배송 알림 | Cloud Functions (Firestore 트리거) |
| 식약처 UDI OpenAPI | 월간 공급내역 보고 | Cloud Functions (scheduled) |
| Algolia | 검색 | Firestore 트리거 sync + 클라이언트 검색 |
| 택배사 API | 배송 추적 | tRPC procedure |

---

## 15. Phase별 우선 구현 매핑

| Phase | Firestore 컬렉션 | Cloud Functions | 외부 API |
|---|---|---|---|
| 1 | users, hospitals, vendors, categories | (Auth onCreate → setCustomClaims) | Clova OCR (mock), NTS (mock) |
| 2 | products, orders, subOrders, settlements, notifications | createOrder, onProductWrite (Algolia) | PortOne, Solapi, Algolia |
| 3 | subscriptions, /runs | subscriptionRunner (scheduled) | PortOne billing |
| 4 | groupBuys, /participations, /counterShards | participateGroupbuy, groupbuyCloser | PortOne pre-auth/capture/void |
| 5 | rfqs, /quotes | — | — |
| 6 | auditLogs 확장 | udiMonthlyReport | MFDS UDI API |

---

**이 문서는 컬렉션 추가, Security Rules 변경, Cloud Function 추가 시마다 갱신한다.**
