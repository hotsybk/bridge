import Link from "next/link";


export const metadata = {
  title: "이용약관 — MedPlace",
  description:
    "MedPlace 서비스 이용에 관한 약관입니다. 회원가입·결제·청약철회·분쟁해결 등 서비스 이용 전반의 권리·의무를 정합니다.",
};

/**
 * /legal/terms — 서비스 이용약관 (2026-06).
 *
 * 디자인 DNA:
 *  - 박스 금지 / 라인 위주 / divide-y / max-w-3xl
 *  - 타이포 토큰: T2 (페이지 H1) + T3 (조항 H2) + T4 (본문) + T5 (caption) + E·M
 *  - max-w-3xl mx-auto px-6 md:px-12 py-12 md:py-20
 */

const EFFECTIVE_DATE = "2026년 6월 1일";
const LAST_REVISED = "2026년 6월 1일";

const ARTICLES: Array<{ id: string; no: string; title: string }> = [
  { id: "art-1", no: "제1조", title: "목적" },
  { id: "art-2", no: "제2조", title: "정의" },
  { id: "art-3", no: "제3조", title: "약관의 효력 및 변경" },
  { id: "art-4", no: "제4조", title: "회원가입" },
  { id: "art-5", no: "제5조", title: "회원정보의 관리" },
  { id: "art-6", no: "제6조", title: "서비스의 제공" },
  { id: "art-7", no: "제7조", title: "이용계약의 성립" },
  { id: "art-8", no: "제8조", title: "대금결제" },
  { id: "art-9", no: "제9조", title: "재화의 공급" },
  { id: "art-10", no: "제10조", title: "청약철회" },
  { id: "art-11", no: "제11조", title: "환급" },
  { id: "art-12", no: "제12조", title: "분쟁해결" },
  { id: "art-13", no: "제13조", title: "저작권의 귀속" },
  { id: "art-14", no: "제14조", title: "면책조항" },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-20">
        {/* Header */}
        <header>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            법적 고지 · Terms of Service
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-5xl">
            이용약관
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            MedPlace 서비스 이용에 관한 약관입니다.
          </p>

          {/* 시행일 라인 */}
          <dl className="mt-10 grid grid-cols-2 gap-x-8 border-t border-[var(--color-border-light)] pt-6 text-xs text-[var(--color-text-tertiary)]">
            <div className="flex items-baseline gap-3">
              <dt className="text-[10px] font-medium uppercase tracking-[0.18em]">
                시행일
              </dt>
              <dd className="tabular-nums text-[var(--color-text-secondary)]">
                {EFFECTIVE_DATE}
              </dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="text-[10px] font-medium uppercase tracking-[0.18em]">
                최종 개정
              </dt>
              <dd className="tabular-nums text-[var(--color-text-secondary)]">
                {LAST_REVISED}
              </dd>
            </div>
          </dl>
        </header>

        {/* 목차 */}
        <nav aria-label="목차" className="mt-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            목차
          </p>
          <ol className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {ARTICLES.map((a, i) => (
              <li key={a.id}>
                <a
                  href={`#${a.id}`}
                  className="group flex items-baseline gap-4 py-3 text-sm transition-colors hover:text-[var(--color-accent)]"
                >
                  <span className="w-8 shrink-0 text-xs font-medium tabular-nums text-[var(--color-accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
                    {a.no} ({a.title})
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 본문 — 조항별 섹션 */}
        <section className="mt-16 divide-y divide-[var(--color-border-light)] border-t border-[var(--color-border-light)]">
          <Article id="art-1" no="제1조" title="목적">
            <p>
              이 약관은 (주)MedPlace(이하 &ldquo;회사&rdquo;)가 운영하는 의료기관·의료기기
              공급업체 멀티벤더 마켓플레이스 서비스(이하 &ldquo;서비스&rdquo;)를 이용함에
              있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </Article>

          <Article id="art-2" no="제2조" title="정의">
            <p>이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
            <Ol>
              <li>
                <strong>서비스</strong>: 회사가 의료기관(이하 &ldquo;구매자&rdquo;)과
                의료기기·소모품 공급업체(이하 &ldquo;판매자&rdquo;)를 연결하기 위해
                제공하는 모든 온라인 서비스를 의미합니다.
              </li>
              <li>
                <strong>이용자</strong>: 이 약관에 따라 회사가 제공하는 서비스를
                이용하는 회원 및 비회원을 말합니다.
              </li>
              <li>
                <strong>구매자</strong>: 의료법에 따라 개설된 의료기관으로서 서비스에
                회원으로 가입한 자를 말합니다.
              </li>
              <li>
                <strong>판매자</strong>: 의료기기법 및 관련 법령에 따라 의료기기 판매업
                신고를 마치고 서비스에 입점한 자를 말합니다.
              </li>
              <li>
                <strong>주문</strong>: 구매자가 판매자의 재화를 구매하기 위해 서비스를
                통해 청약하는 행위를 말합니다.
              </li>
              <li>
                <strong>정산</strong>: 회사가 결제 완료 후 판매자에게 판매대금을
                지급하는 절차를 말합니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-3" no="제3조" title="약관의 효력 및 변경">
            <Ol>
              <li>
                이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게
                공지함으로써 효력이 발생합니다.
              </li>
              <li>
                회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에
                관한 법률」 등 관련 법령에 위배되지 않는 범위에서 이 약관을 개정할 수
                있습니다.
              </li>
              <li>
                회사가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 현행 약관과
                함께 서비스 초기화면에 그 적용일자 7일 이전부터 공지합니다. 다만,
                이용자에게 불리한 약관의 개정인 경우 30일 이전에 공지하며 이메일 등
                전자적 수단으로 별도 통지합니다.
              </li>
              <li>
                이용자는 변경된 약관에 동의하지 않을 권리를 가지며, 동의하지 않는 경우
                회원 탈퇴를 요청할 수 있습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-4" no="제4조" title="회원가입">
            <Ol>
              <li>
                서비스 이용을 희망하는 자는 회사가 정한 가입 양식에 회원정보를 기입한
                후 이 약관 및 개인정보 처리방침에 동의함으로써 회원가입을 신청합니다.
              </li>
              <li>
                회사는 다음 각 호에 해당하는 신청에 대해서는 승낙하지 않거나 사후에
                이용계약을 해지할 수 있습니다.
                <Ol nested>
                  <li>실명이 아니거나 타인의 명의로 가입을 신청한 경우</li>
                  <li>
                    의료기기 판매업 신고 또는 의료기관 개설 신고가 확인되지 않는 경우
                  </li>
                  <li>허위의 정보를 기재하거나 회사가 제시하는 내용을 누락한 경우</li>
                  <li>관련 법령에 위배되거나 사회의 안녕질서를 저해할 우려가 있는 경우</li>
                </Ol>
              </li>
              <li>
                판매자로 가입하려는 자는 의료기기 판매업 신고증 사본 및 사업자등록증을
                제출하여야 하며, 회사의 심사를 거친 후 입점이 승인됩니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-5" no="제5조" title="회원정보의 관리">
            <Ol>
              <li>
                이용자는 회원가입 시 기재한 정보에 변경이 있는 경우 즉시 수정하여야
                하며, 변경된 정보를 수정하지 않아 발생한 불이익에 대하여 회사는 책임을
                지지 않습니다.
              </li>
              <li>
                이용자의 아이디와 비밀번호 관리책임은 이용자 본인에게 있으며, 이를
                제3자에게 양도·대여할 수 없습니다.
              </li>
              <li>
                이용자는 아이디 및 비밀번호가 도용되거나 제3자가 사용하고 있음을 인지한
                경우 즉시 회사에 통지하여야 합니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-6" no="제6조" title="서비스의 제공">
            <Ol>
              <li>
                회사는 이용자에게 다음 각 호의 서비스를 제공합니다.
                <Ol nested>
                  <li>의료기기·의료소모품 검색 및 가격 비교</li>
                  <li>주문·결제·배송 추적 등 거래 중개</li>
                  <li>정기구독 자동발주, 공동구매, RFQ(견적요청)</li>
                  <li>전자세금계산서 발행 보조 및 정산</li>
                  <li>식약처 의료기기 자동보고 보조</li>
                </Ol>
              </li>
              <li>
                서비스는 연중무휴 1일 24시간 제공을 원칙으로 합니다. 다만, 정기 점검 등
                회사가 필요한 경우 사전 공지 후 일시 중단될 수 있습니다.
              </li>
              <li>
                회사는 천재지변, 시스템 장애, 통신두절 등 불가항력적인 사유로 서비스를
                일시 중단할 수 있으며, 이로 인해 발생한 손해에 대해서는 고의 또는 중과실이
                없는 한 책임을 지지 않습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-7" no="제7조" title="이용계약의 성립">
            <Ol>
              <li>
                이용자가 서비스 내에서 재화를 선택하고 청약의사를 표시한 경우, 회사는
                해당 청약 내용을 확인할 수 있도록 안내합니다.
              </li>
              <li>
                이용계약은 회사가 청약에 대한 승낙 통지를 이용자에게 발송한 시점에
                성립합니다.
              </li>
              <li>
                회사는 재고 부족, 판매자 사정, 결제 검증 실패 등의 사유로 청약을
                승낙하지 않거나 일부만 승낙할 수 있습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-8" no="제8조" title="대금결제">
            <Ol>
              <li>
                이용자는 회사가 제공하는 결제수단(신용카드, 계좌이체, 간편결제 등)으로
                재화 대금을 결제할 수 있습니다.
              </li>
              <li>
                결제 처리는 PortOne 등 회사가 위탁한 결제대행사를 통해 이루어지며,
                결제대행사의 검증을 거친 후 주문이 확정됩니다.
              </li>
              <li>
                결제대행 수수료는 결제 채널별로 상이하며, 판매자 정산 시점에 차감됩니다.
                구체적인 요율은 서비스의 수수료 안내 페이지에서 확인할 수 있습니다.
              </li>
              <li>
                이용자가 결제 정보를 허위로 기재하거나 부정하게 결제한 경우 회사는
                해당 거래를 취소할 수 있습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-9" no="제9조" title="재화의 공급">
            <Ol>
              <li>
                재화의 공급은 판매자가 직접 수행하며, 배송기간·배송방법·배송비용은
                재화 상세 페이지 및 주문서에 명시된 바에 따릅니다.
              </li>
              <li>
                판매자는 재화 발송 시 의료기기 UDI(고유식별코드), 제조번호(LOT),
                유통기한 등의 정보를 정확히 기재하여야 합니다.
              </li>
              <li>
                회사는 주문 후 영업일 기준 3일 이내 발송이 이루어지지 않는 경우
                구매자에게 그 사유를 안내하고, 필요 시 주문을 취소할 수 있습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-10" no="제10조" title="청약철회">
            <Ol>
              <li>
                구매자는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라
                재화를 공급받은 날부터 7일 이내에 청약철회를 할 수 있습니다.
              </li>
              <li>
                다음 각 호의 경우에는 청약철회가 제한될 수 있습니다.
                <Ol nested>
                  <li>구매자의 책임 있는 사유로 재화가 멸실·훼손된 경우</li>
                  <li>구매자의 사용 또는 일부 소비로 재화의 가치가 현저히 감소한 경우</li>
                  <li>
                    개봉·사용 시 재판매가 곤란한 의료소모품(주사기·진단시약·인공치아 등)
                  </li>
                  <li>맞춤 제작 의료기기 등 재판매가 어려운 재화</li>
                </Ol>
              </li>
              <li>
                구매자는 청약철회 의사를 회사 또는 판매자에게 서면(이메일 포함)으로
                통지하여야 하며, 통지 즉시 효력이 발생합니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-11" no="제11조" title="환급">
            <Ol>
              <li>
                회사는 청약철회가 적법하게 이루어진 경우, 재화 회수 확인일로부터 3영업일
                이내에 결제대금을 환급합니다.
              </li>
              <li>
                환급 방법은 원결제수단으로의 취소를 원칙으로 하며, 부득이한 경우
                계좌이체 등 별도의 수단을 협의할 수 있습니다.
              </li>
              <li>
                환급이 지연될 경우 「전자상거래법」 제18조에 따라 지연이자를 가산하여
                지급합니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-12" no="제12조" title="분쟁해결">
            <Ol>
              <li>
                회사는 이용자가 제기하는 정당한 의견이나 불만을 신속히 처리하기 위해
                고객지원 창구를 운영합니다.
              </li>
              <li>
                회사와 이용자 사이에 발생한 분쟁은 우선 상호 협의로 해결함을 원칙으로
                하며, 협의가 이루어지지 않는 경우 한국소비자원 또는 전자거래분쟁조정
                위원회의 조정을 신청할 수 있습니다.
              </li>
              <li>
                이 약관에 관한 소송은 회사의 본점 소재지를 관할하는 법원을 전속 관할로
                합니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-13" no="제13조" title="저작권의 귀속">
            <Ol>
              <li>
                서비스 내 회사가 작성한 저작물에 대한 저작권 및 지식재산권은 회사에
                귀속됩니다.
              </li>
              <li>
                이용자가 서비스 내에 게시한 게시물의 저작권은 해당 이용자에게 귀속되나,
                회사는 서비스 운영·홍보·개선 목적으로 해당 게시물을 사용할 수 있습니다.
              </li>
              <li>
                이용자는 서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제·전송·
                출판·배포·방송 등의 방법으로 이용하거나 제3자에게 이용하게 할 수 없습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-14" no="제14조" title="면책조항">
            <Ol>
              <li>
                회사는 천재지변, 전쟁, 폭동, 테러, 정전, 통신두절 등 불가항력적 사유로
                인하여 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.
              </li>
              <li>
                회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대해서는 책임을
                지지 않습니다.
              </li>
              <li>
                회사는 거래 당사자(구매자·판매자) 간에 발생하는 분쟁에 대해 통신중개자
                로서 「전자상거래법」이 정하는 범위 내에서 책임을 부담하며, 직접 당사자가
                아닙니다.
              </li>
              <li>
                회사는 이용자가 서비스를 이용하여 기대하는 손익이나 서비스를 통하여 얻은
                자료로 인한 손해에 대해 책임을 지지 않습니다.
              </li>
            </Ol>
          </Article>

          {/* 부칙 */}
          <div id="bukchik" className="py-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
              부칙
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
              부칙
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              이 약관은 {EFFECTIVE_DATE}부터 시행합니다.
            </p>
          </div>
        </section>

        {/* 푸터 CTA */}
        <footer className="mt-12 border-t border-[var(--color-border-light)] pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            관련 법적 고지
          </p>
          <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <FooterLink href="/legal/privacy" label="개인정보 처리방침" />
            <FooterLink
              href="/legal/marketplace"
              label="통신판매업 신고 정보"
            />
          </ul>
          <p className="mt-8 text-xs text-[var(--color-text-tertiary)]">
            본 약관에 대한 문의는 support@medplace.example.com 으로 보내주세요.
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 조항 컴포넌트
// ─────────────────────────────────────────────────────────────

function Article({
  id,
  no,
  title,
  children,
}: {
  id: string;
  no: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-12 first:pt-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
        {no}
      </p>
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
        {title}
      </h2>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-[var(--color-text-secondary)] md:text-sm">
        {children}
      </div>
    </section>
  );
}

function Ol({
  children,
  nested = false,
}: {
  children: React.ReactNode;
  nested?: boolean;
}) {
  return (
    <ol
      className={`${nested ? "mt-3 ml-5" : "mt-2"} list-outside space-y-2 ${
        nested ? "" : ""
      }`}
      style={{ listStyleType: nested ? "lower-alpha" : "decimal" }}
    >
      {children}
    </ol>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center justify-between py-3 text-sm transition-colors hover:text-[var(--color-accent)]"
      >
        <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
          {label}
        </span>
        <span
          aria-hidden
          className="text-xs text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]"
        >
          →
        </span>
      </Link>
    </li>
  );
}

