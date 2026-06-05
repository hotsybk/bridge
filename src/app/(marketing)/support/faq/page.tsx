import Link from "next/link";
import { ChevronDown } from "lucide-react";


export const metadata = {
  title: "자주 묻는 질문 — MedPlace 고객 지원",
  description:
    "계정·결제·주문·정기구독·공동구매·공급업체 입점·의료기기 규제 등 자주 묻는 질문에 답합니다.",
};

/**
 * /support/faq — Wave AA.
 * 7 카테고리 · 33 문항. 박스 없이 native `<details>` 토글.
 */
export default function SupportFaqPage() {
  return (
    <div className="relative isolate min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <Header />
      <Body />
      <FootNote />
    </div>
  );
}

function Header() {
  return (
    <section className="border-b border-[var(--color-border-light)]">
      <div className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center md:px-12 md:pt-32 md:pb-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
          자주 묻는 질문
        </p>
        <h1 className="mt-6 break-keep text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">
          궁금한 점을 빠르게 해결하세요.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          7 개 카테고리로 정리한 답변. 카테고리 제목을 눌러 펼쳐보세요.
          <br className="hidden md:block" />
          해결되지 않으면 페이지 하단에서{" "}
          <Link
            href="/support/contact"
            className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            1:1 문의
          </Link>
          로 이어집니다.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FAQ data
// ─────────────────────────────────────────────────────────────

type Faq = { q: string; a: string };
type Category = { id: string; title: string; description: string; items: Faq[] };

const CATEGORIES: Category[] = [
  {
    id: "account",
    title: "계정·로그인",
    description: "회원가입·로그인·비밀번호·역할 전환에 관한 질문",
    items: [
      {
        q: "가입은 어떻게 하나요?",
        a: "회원가입 페이지에서 이메일과 비밀번호로 가입 후, 병원 구매자(BUYER) 또는 공급업체(VENDOR) 중 역할을 선택합니다. 사업자등록증 1장만 있으면 30초 안에 완료됩니다.",
      },
      {
        q: "Google 계정으로 로그인할 수 있나요?",
        a: "네. 로그인·회원가입 화면에서 [Google 계속하기] 버튼으로 즉시 시작할 수 있습니다. 카카오 로그인은 2단계 이후 제공 예정입니다.",
      },
      {
        q: "비밀번호를 잊었습니다.",
        a: "로그인 화면 하단 [비밀번호 재설정] 링크를 누르면 가입 이메일로 재설정 메일이 발송됩니다. 메일 내 링크는 1시간 동안 유효합니다.",
      },
      {
        q: "한 계정으로 병원과 공급업체를 모두 운영할 수 있나요?",
        a: "보안상 하나의 계정은 한 가지 역할만 가질 수 있습니다. 병원 구매자와 공급업체를 모두 운영하시려면 별도의 이메일로 두 개 계정을 만드시고, 각각의 역할로 가입해주세요.",
      },
      {
        q: "직원에게 권한을 부여할 수 있나요?",
        a: "병원·공급업체 모두 멤버 초대 기능을 제공합니다. 셀러센터 또는 병원 설정에서 이메일을 입력해 초대하시면, 해당 직원은 BUYER_STAFF / VENDOR_STAFF 권한으로 합류합니다. 결제·정산·계약 등 핵심 액션은 OWNER 만 수행할 수 있습니다.",
      },
    ],
  },
  {
    id: "payment",
    title: "결제·정산",
    description: "카드·간편결제·세금계산서·환불·정산 주기에 관한 질문",
    items: [
      {
        q: "어떤 결제 수단을 지원하나요?",
        a: "국내 모든 신용·체크카드(VISA, Mastercard, JCB, 국민, 신한, 삼성, 현대, 롯데, BC, 하나, NH, IBK 등)와 카카오페이·네이버페이·토스페이 등 주요 간편결제를 지원합니다. 결제는 PortOne V2 를 통해 처리됩니다.",
      },
      {
        q: "사업자카드(법인카드)도 사용할 수 있나요?",
        a: "네. 개인카드와 동일하게 사용 가능하며, 결제 시 자동으로 사업자 정보가 매칭되어 세금계산서 발행에 반영됩니다.",
      },
      {
        q: "세금계산서는 어떻게 받나요?",
        a: "주문이 [결제 완료] 상태가 되면 다음 영업일에 가입 시 등록하신 사업자 정보로 전자 세금계산서가 자동 발행되어 국세청에 신고됩니다. 별도 신청은 필요하지 않습니다.",
      },
      {
        q: "공급업체 정산은 언제 이뤄지나요?",
        a: "주문이 [배송 완료] 상태가 되고 영업일 3일이 지나면 자동 정산됩니다. 기존 도매상 평균 정산 주기(4~6개월) 대비 크게 단축되었습니다.",
      },
      {
        q: "주문 취소·환불은 가능한가요?",
        a: "공급업체가 출고 전이라면 [주문 취소] 가 즉시 가능하며 결제 즉시 환불됩니다. 출고 후에는 분쟁 시스템을 통해 반품·환불 요청을 보내실 수 있고, 운영자가 중재합니다.",
      },
      {
        q: "수수료는 언제 차감되나요?",
        a: "정산 시점에 자동으로 차감됩니다. 별도 청구서 발행이나 송장 절차가 없습니다. 거래액 구간에 따라 3.5% ~ 5.0% 까지 단계적으로 적용됩니다.",
      },
    ],
  },
  {
    id: "order",
    title: "주문·배송",
    description: "주문 흐름·배송 추적·반품·취소에 관한 질문",
    items: [
      {
        q: "한 번에 여러 공급업체에서 주문할 수 있나요?",
        a: "네. 장바구니에는 여러 공급업체의 상품을 함께 담을 수 있고, 결제는 한 번만 진행됩니다. 다만 배송과 정산은 공급업체별로 분리되어(SubOrder 단위) 처리됩니다.",
      },
      {
        q: "배송은 어떻게 진행되나요?",
        a: "공급업체가 직접 출고 후 운송장 번호를 등록합니다. 주문 상세 페이지에서 실시간으로 추적할 수 있고, 출고·배송·도착 각 단계마다 알림톡으로 안내됩니다.",
      },
      {
        q: "배송 평균 소요 시간은?",
        a: "공급업체에 따라 다르지만 일반 소모품은 영업일 1~3일, 의료기기는 1~5일 입니다. 상품 상세 페이지에 공급업체별 예상 출고일이 표시됩니다.",
      },
      {
        q: "LOT 번호·유통기한은 어디에서 확인하나요?",
        a: "「의료기기법」에 따라 모든 의료기기 SubOrder 의 배송 단계에서 LOT 번호와 유통기한이 의무 입력됩니다. 주문 상세 페이지 [출고 정보] 탭에서 확인할 수 있고, 매출·재고 관리에도 동일하게 반영됩니다.",
      },
      {
        q: "받은 상품에 문제가 있습니다.",
        a: "주문 상세 페이지에서 [분쟁 신청] 을 눌러 사진과 함께 사유를 등록해주세요. 운영자가 영업일 1일 내 1차 응대하며, 공급업체와 협의해 반품·교환·환불 중 적절한 조치를 안내합니다.",
      },
      {
        q: "주문 내역은 얼마나 보관되나요?",
        a: "전자상거래법에 따라 5년간 보관되며, 언제든 주문 내역에서 PDF 영수증과 세금계산서를 다시 받을 수 있습니다.",
      },
    ],
  },
  {
    id: "subscription",
    title: "정기구독",
    description: "자동 발주·일시정지·해지에 관한 질문",
    items: [
      {
        q: "정기구독은 언제 자동 발주되나요?",
        a: "설정하신 주기(매주·격주·매월)에 따라 매일 03:00 KST 에 다음 발주가 처리됩니다. 발주 24시간 전에 알림톡으로 예고하므로, 필요 시 [이번 회차 건너뛰기] 또는 [수량 변경] 을 미리 적용할 수 있습니다.",
      },
      {
        q: "단가가 바뀌면 자동 발주는 어떻게 되나요?",
        a: "공급업체가 가격을 변경하면 다음 회차 발주 전 알림톡으로 안내됩니다. 변동률이 10% 를 넘으면 자동 발주가 일시정지되고 구매자 승인이 필요합니다.",
      },
      {
        q: "정기구독을 일시정지할 수 있나요?",
        a: "네. 구독 상세 페이지에서 언제든 [일시정지] 가능하며, 정지 기간 동안 자동 발주는 멈춥니다. [재개] 누르면 다음 회차부터 다시 시작됩니다.",
      },
      {
        q: "해지하면 진행 중인 주문은 어떻게 되나요?",
        a: "이미 발주된 회차는 정상 진행되며, 해지 시점 이후의 자동 발주만 멈춥니다. 진행 중 주문의 환불·반품은 일반 주문과 동일하게 처리됩니다.",
      },
    ],
  },
  {
    id: "groupbuy",
    title: "공동구매",
    description: "공동구매 참여·마감·환불 정책",
    items: [
      {
        q: "공동구매는 어떻게 참여하나요?",
        a: "공동구매 페이지에서 진행 중인 캠페인을 선택하고 [참여하기] 를 누릅니다. 마감 시점에 목표 수량이 채워지면 자동으로 결제·발주가 이뤄집니다.",
      },
      {
        q: "참여 시점에 결제되나요?",
        a: "참여 시 결제 정보는 사전 인증(pre-auth) 만 잡힙니다. 마감 시점에 목표 수량이 채워지면 자동 capture(실제 결제), 미달이면 자동 void(취소) 됩니다.",
      },
      {
        q: "공동구매가 미달되면 어떻게 되나요?",
        a: "「전자상거래법」 가이드에 따라 자동 void 처리됩니다. 별도 환불 신청이 필요 없으며, 카드사 정책에 따라 1~3 영업일 내 결제 취소가 반영됩니다.",
      },
      {
        q: "공동구매 가격은 어떻게 결정되나요?",
        a: "공급업체가 등록한 수량 구간별 단가가 자동 적용됩니다. 예: 50개 미만 1만원 → 50개 이상 9천원 → 100개 이상 8천원. 목표 수량 달성 단계에 따라 모든 참여자에게 동일 단가가 적용됩니다.",
      },
    ],
  },
  {
    id: "onboarding",
    title: "공급업체 입점",
    description: "입점 신청·심사·서류·승인에 관한 질문",
    items: [
      {
        q: "입점 신청은 어떻게 하나요?",
        a: "회원가입 시 [공급업체로 가입] 을 선택한 뒤 사업자등록증을 업로드합니다. Clova OCR 이 자동으로 정보를 추출하고, 국세청 진위확인을 거쳐 운영자 심사 큐로 넘어갑니다.",
      },
      {
        q: "심사는 얼마나 걸리나요?",
        a: "영업일 기준 1~3일 내 운영자가 검토합니다. 의료기기 카테고리 입점은 「의료기기법」 에 따른 추가 서류(판매업 신고증·허가증) 검증이 있어 다소 길어질 수 있습니다.",
      },
      {
        q: "의료기기 판매업 신고증 없이 입점할 수 있나요?",
        a: "「의료기기법」 에 따라 의료기기를 판매하시려면 의료기기판매업 신고증이 반드시 필요합니다. 소모품·일반 의료용품은 신고증 없이도 입점 가능하나, 카테고리별로 별도 인증이 요구될 수 있습니다.",
      },
      {
        q: "상품 등록 후 즉시 노출되나요?",
        a: "아닙니다. 모든 상품은 [심사 대기] 상태로 시작하고, 운영자 모더레이션을 거쳐 [활성] 상태가 되어야 카탈로그에 노출됩니다. 가격·이미지·UDI·설명을 모두 갖춰 등록할수록 심사가 빠르게 진행됩니다.",
      },
      {
        q: "심사에서 반려되면 어떻게 하나요?",
        a: "운영자가 반려 사유를 명시해 [수정 요청] 상태로 돌려보냅니다. 셀러센터에서 사유를 확인하고 보완 후 재제출하시면 다시 심사 큐에 들어갑니다.",
      },
    ],
  },
  {
    id: "regulation",
    title: "의료기기 규제 (UDI·식약처)",
    description: "UDI 부착·식약처 자동 보고·LOT 추적",
    items: [
      {
        q: "UDI 코드는 어떻게 관리되나요?",
        a: "상품 등록 시 UDI(고유식별코드) 와 식약처 허가번호를 함께 입력합니다. 배송 단계에서 LOT 번호·유통기한이 의무로 기록되며, 매월 말 식약처 의료기기통합정보시스템에 자동 보고됩니다.",
      },
      {
        q: "식약처 보고는 자동인가요, 수동인가요?",
        a: "MedPlace 가 매월 말일 자동으로 식약처 OPEN API 를 통해 일괄 보고합니다. 보고 결과는 셀러센터 [UDI 보고] 탭에서 확인할 수 있고, 실패한 항목만 알림으로 안내됩니다.",
      },
      {
        q: "리콜 통보를 받으면 어떻게 되나요?",
        a: "공급업체가 LOT 번호 기반 리콜을 등록하면, 해당 LOT 를 받은 모든 병원에 즉시 알림톡으로 통보됩니다. 회수·교환 절차는 분쟁 시스템과 동일하게 운영자 중재 하에 진행됩니다.",
      },
    ],
  },
];

function Body() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:px-12 md:py-24">
      <nav aria-label="카테고리 바로가기" className="mb-12">
        <ul className="flex flex-wrap gap-2 text-xs">
          {CATEGORIES.map((c, i) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-light)] px-3.5 py-1.5 font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <span className="tabular-nums text-[var(--color-text-tertiary)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-20">
        {CATEGORIES.map((c, i) => (
          <CategoryBlock key={c.id} category={c} index={i} />
        ))}
      </div>
    </section>
  );
}

function CategoryBlock({
  category,
  index,
}: {
  category: Category;
  index: number;
}) {
  return (
    <section id={category.id} className="scroll-mt-24">
      <header className="flex items-baseline gap-4 border-b border-[var(--color-border-light)] pb-6">
        <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-[var(--color-accent)] md:text-3xl">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
            {category.title}
          </h2>
          <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
            {category.description}
          </p>
        </div>
      </header>

      <div className="divide-y divide-[var(--color-border-light)]">
        {category.items.map((f) => (
          <details
            key={f.q}
            className="group [&[open]_summary_.faq-chevron]:rotate-180"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-6 text-left text-sm font-medium transition-colors hover:text-[var(--color-accent)]">
              <span className="leading-relaxed">{f.q}</span>
              <span
                aria-hidden
                className="faq-chevron mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-transform duration-300"
              >
                <ChevronDown className="h-4 w-4" />
              </span>
            </summary>
            <p className="pb-6 pr-12 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FootNote() {
  return (
    <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center md:px-12 md:py-24">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
          답을 찾지 못하셨다면
        </p>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
          1:1 문의로 이어집니다.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm text-[var(--color-text-secondary)]">
          영업일 기준 24시간 이내 답변. 결제 등 긴급 사안은 우선 처리됩니다.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/support/contact"
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white active:scale-[0.98]"
          >
            문의 보내기
          </Link>
          <Link
            href="/support"
            className="inline-flex h-12 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            지원 허브로
          </Link>
        </div>
      </div>
    </section>
  );
}

