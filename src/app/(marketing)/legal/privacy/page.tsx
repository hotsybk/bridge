import Link from "next/link";


export const metadata = {
  title: "개인정보 처리방침 — MedPlace",
  description:
    "MedPlace가 수집·이용하는 개인정보 항목과 처리 방식, 보관 기간, 제3자 제공·처리위탁 내역을 안내합니다.",
};

/**
 * /legal/privacy — 개인정보 처리방침 (2026-06).
 *
 * 디자인 DNA:
 *  - 박스 금지 / 라인 위주 / divide-y / max-w-3xl
 *  - 타이포 토큰: T2 + T3 + T4 + T5 + E·M
 */

const EFFECTIVE_DATE = "2026년 6월 1일";
const LAST_REVISED = "2026년 6월 1일";

const ARTICLES: Array<{ id: string; no: string; title: string }> = [
  { id: "art-1", no: "제1조", title: "수집하는 개인정보 항목" },
  { id: "art-2", no: "제2조", title: "개인정보의 수집 방법" },
  { id: "art-3", no: "제3조", title: "개인정보의 이용 목적" },
  { id: "art-4", no: "제4조", title: "개인정보의 보유 및 이용기간" },
  { id: "art-5", no: "제5조", title: "개인정보의 제3자 제공" },
  { id: "art-6", no: "제6조", title: "개인정보 처리위탁" },
  { id: "art-7", no: "제7조", title: "이용자의 권리·의무 및 행사 방법" },
  { id: "art-8", no: "제8조", title: "쿠키 사용 정책" },
  { id: "art-9", no: "제9조", title: "개인정보 안전성 확보 조치" },
  { id: "art-10", no: "제10조", title: "개인정보 보호책임자" },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-20">
        {/* Header */}
        <header>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            법적 고지 · Privacy Policy
          </p>
          <h1 className="mt-5 break-keep text-4xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-5xl">
            개인정보 처리방침
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            MedPlace가 수집·이용하는 개인정보 항목과 처리 방식입니다.
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

        {/* 요약 박스 (line only) */}
        <section
          aria-label="요약"
          className="mt-16 border-y border-[var(--color-border-light)]"
        >
          <p className="px-1 pt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            한눈에 보기
          </p>
          <ul className="divide-y divide-[var(--color-border-light)] py-2">
            <SummaryRow
              label="수집 항목"
              value="회원가입 시 필수 정보만"
            />
            <SummaryRow
              label="처리 목적"
              value="서비스 제공·결제·민원처리"
            />
            <SummaryRow
              label="보유 기간"
              value="회원 탈퇴 시까지, 법령상 보관 의무 따름"
            />
          </ul>
        </section>

        {/* 본문 — 조항별 섹션 */}
        <section className="mt-16 divide-y divide-[var(--color-border-light)] border-t border-[var(--color-border-light)]">
          <Article id="art-1" no="제1조" title="수집하는 개인정보 항목">
            <p>
              회사는 회원 유형에 따라 다음과 같은 개인정보를 수집합니다.
            </p>

            {/* 표 형태 — desktop only. 모바일은 dl card. */}
            <div className="mt-6 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-xs leading-relaxed">
                <thead>
                  <tr className="border-y border-[var(--color-border-default)]">
                    <th className="py-3 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      구분
                    </th>
                    <th className="py-3 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      필수 항목
                    </th>
                    <th className="py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      선택 항목
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      병원 (구매자)
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      이메일, 비밀번호, 의료기관명, 사업자등록번호, 대표자명,
                      소재지, 연락처
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      병상수, 진료과목, 담당자명
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      공급업체 (판매자)
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      이메일, 비밀번호, 상호, 사업자등록번호, 대표자명, 소재지,
                      의료기기 판매업 신고증 사본, 정산계좌 정보
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      회사 소개, 취급 품목 카탈로그
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      자동 수집
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      IP 주소, 쿠키, 서비스 이용기록, 접속 로그, 기기 정보
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <MobileTable3Col
              cols={["구분", "필수 항목", "선택 항목"]}
              rows={[
                [
                  "병원 (구매자)",
                  "이메일, 비밀번호, 의료기관명, 사업자등록번호, 대표자명, 소재지, 연락처",
                  "병상수, 진료과목, 담당자명",
                ],
                [
                  "공급업체 (판매자)",
                  "이메일, 비밀번호, 상호, 사업자등록번호, 대표자명, 소재지, 의료기기 판매업 신고증 사본, 정산계좌 정보",
                  "회사 소개, 취급 품목 카탈로그",
                ],
                [
                  "자동 수집",
                  "IP 주소, 쿠키, 서비스 이용기록, 접속 로그, 기기 정보",
                  "—",
                ],
              ]}
            />
          </Article>

          <Article id="art-2" no="제2조" title="개인정보의 수집 방법">
            <p>회사는 다음과 같은 방법으로 개인정보를 수집합니다.</p>
            <Ol>
              <li>서비스 회원가입 시 이용자가 직접 입력</li>
              <li>서비스 이용 과정에서 자동 수집(쿠키, 접속 로그)</li>
              <li>고객지원 문의 시 이메일·전화를 통한 수집</li>
              <li>
                사업자등록증·의료기기 판매업 신고증 OCR 인식을 통한 자동 추출
              </li>
              <li>국세청 사업자 진위확인 API를 통한 검증 결과 수신</li>
            </Ol>
          </Article>

          <Article id="art-3" no="제3조" title="개인정보의 이용 목적">
            <p>회사는 수집한 개인정보를 다음 목적으로 이용합니다.</p>
            <Ol>
              <li>회원가입 의사 확인, 본인 식별 및 인증</li>
              <li>서비스 제공 — 주문·결제·배송·정산</li>
              <li>의료기기 판매업·의료기관 자격 검증</li>
              <li>전자세금계산서 발행 및 회계 처리</li>
              <li>고객 문의 응대, 분쟁 조정, 민원 처리</li>
              <li>서비스 개선, 통계 분석, 부정 이용 방지</li>
              <li>법령상 의무 이행 — 식약처 의료기기 보고 등</li>
            </Ol>
          </Article>

          <Article id="art-4" no="제4조" title="개인정보의 보유 및 이용기간">
            <Ol>
              <li>
                회사는 이용자의 개인정보를 회원 탈퇴 시까지 보유·이용하며, 탈퇴
                시 지체 없이 파기합니다.
              </li>
              <li>
                다만, 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안
                별도 분리 보관합니다.
                <Ol nested>
                  <li>계약·청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                  <li>대금결제·재화 공급에 관한 기록: 5년 (전자상거래법)</li>
                  <li>소비자 불만·분쟁처리 기록: 3년 (전자상거래법)</li>
                  <li>전자금융 거래 기록: 5년 (전자금융거래법)</li>
                  <li>접속 로그: 3개월 (통신비밀보호법)</li>
                  <li>의료기기 유통 기록: 6년 (의료기기법)</li>
                </Ol>
              </li>
            </Ol>
          </Article>

          <Article id="art-5" no="제5조" title="개인정보의 제3자 제공">
            <p>
              회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만,
              다음의 경우 예외로 합니다.
            </p>
            <Ol>
              <li>이용자가 사전에 동의한 경우</li>
              <li>
                법령의 규정에 의거하거나 수사 목적으로 법령에 정한 절차에 따라
                수사기관의 요구가 있는 경우
              </li>
              <li>
                서비스 제공에 따른 결제·정산·배송을 위해 거래상대방(공급업체 또는
                구매자)에게 제공하는 경우
              </li>
            </Ol>

            <div className="mt-6 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-xs leading-relaxed">
                <thead>
                  <tr className="border-y border-[var(--color-border-default)]">
                    <th className="py-3 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      제공받는 자
                    </th>
                    <th className="py-3 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      제공 항목
                    </th>
                    <th className="py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      목적
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      PortOne
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      결제 정보, 주문 정보
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      결제 처리
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      Solapi
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      이름, 휴대전화번호
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      알림톡·SMS 발송
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      Naver Clova OCR
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      사업자등록증·판매업 신고증 이미지
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      문서 OCR 추출
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      거래상대방
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      이름, 연락처, 배송지
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      주문 처리 및 배송
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <MobileTable3Col
              cols={["제공받는 자", "제공 항목", "목적"]}
              rows={[
                ["PortOne", "결제 정보, 주문 정보", "결제 처리"],
                ["Solapi", "이름, 휴대전화번호", "알림톡·SMS 발송"],
                [
                  "Naver Clova OCR",
                  "사업자등록증·판매업 신고증 이미지",
                  "문서 OCR 추출",
                ],
                ["거래상대방", "이름, 연락처, 배송지", "주문 처리 및 배송"],
              ]}
            />
          </Article>

          <Article id="art-6" no="제6조" title="개인정보 처리위탁">
            <p>
              회사는 서비스 향상을 위해 다음과 같이 개인정보 처리업무를 외부에
              위탁하고 있습니다.
            </p>

            <div className="mt-6 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-xs leading-relaxed">
                <thead>
                  <tr className="border-y border-[var(--color-border-default)]">
                    <th className="py-3 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      수탁업체
                    </th>
                    <th className="py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      위탁 업무
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      Google (Firebase)
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      회원 인증, 데이터베이스, 파일 저장
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      Vercel
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      웹 서비스 호스팅
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      Algolia
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      상품 검색 인덱싱
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      Sentry
                    </td>
                    <td className="py-3 text-[var(--color-text-secondary)]">
                      서비스 오류 모니터링
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <MobileTable2Col
              cols={["수탁업체", "위탁 업무"]}
              rows={[
                ["Google (Firebase)", "회원 인증, 데이터베이스, 파일 저장"],
                ["Vercel", "웹 서비스 호스팅"],
                ["Algolia", "상품 검색 인덱싱"],
                ["Sentry", "서비스 오류 모니터링"],
              ]}
            />

            <p className="mt-6">
              회사는 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무
              수행 목적 외 개인정보 처리 금지, 기술적·관리적 보호조치 등을 계약서
              등에 명시하고 있습니다.
            </p>
          </Article>

          <Article
            id="art-7"
            no="제7조"
            title="이용자의 권리·의무 및 행사 방법"
          >
            <Ol>
              <li>
                이용자는 언제든지 자신의 개인정보를 조회·수정·삭제·처리정지 요구할
                수 있습니다.
              </li>
              <li>
                위 권리는 서비스 내 회원정보 페이지에서 직접 행사하거나, 회사
                고객지원 창구로 요청할 수 있습니다.
              </li>
              <li>
                이용자는 개인정보가 정확하게 입력될 수 있도록 관리할 의무가 있으며,
                부정확한 정보 입력으로 발생한 불이익은 이용자에게 책임이 있습니다.
              </li>
              <li>
                만 14세 미만 아동의 개인정보는 수집하지 않습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-8" no="제8조" title="쿠키 사용 정책">
            <Ol>
              <li>
                회사는 서비스 제공을 위해 쿠키(Cookie)를 사용합니다. 쿠키는 서비스
                운영에 이용되는 서버가 이용자의 브라우저에 보내는 작은 텍스트
                파일입니다.
              </li>
              <li>
                회사는 다음 목적으로 쿠키를 사용합니다.
                <Ol nested>
                  <li>로그인 세션 유지</li>
                  <li>서비스 이용 통계 분석</li>
                  <li>맞춤형 콘텐츠 제공</li>
                </Ol>
              </li>
              <li>
                이용자는 브라우저 옵션 설정을 통해 쿠키 저장을 거부할 수 있습니다.
                다만, 일부 서비스 이용에 제한이 있을 수 있습니다.
              </li>
            </Ol>
          </Article>

          <Article id="art-9" no="제9조" title="개인정보 안전성 확보 조치">
            <p>회사는 개인정보의 안전성 확보를 위해 다음 조치를 취하고 있습니다.</p>
            <Ol>
              <li>
                <strong>관리적 조치</strong>: 개인정보 취급 직원의 최소화 및 정기
                교육
              </li>
              <li>
                <strong>기술적 조치</strong>: 개인정보의 암호화 저장·전송(TLS 1.2
                이상), 접근통제 시스템, 침입탐지 시스템 운영
              </li>
              <li>
                <strong>물리적 조치</strong>: 데이터센터 출입통제, 자료 보관실
                잠금장치
              </li>
            </Ol>
          </Article>

          <Article id="art-10" no="제10조" title="개인정보 보호책임자">
            <p>
              회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 개인정보 처리와
              관련한 정보주체의 불만 처리 및 피해 구제를 위해 아래와 같이 개인정보
              보호책임자를 지정하고 있습니다.
            </p>
            <ul className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <KvRow label="성명" value="[운영자 결정 필요]" />
              <KvRow label="직책" value="개인정보 보호책임자" />
              <KvRow
                label="이메일"
                value="privacy@medplace.example.com"
              />
              <KvRow label="전화" value="02-0000-0000" />
            </ul>
            <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
              개인정보 침해로 인한 신고나 상담은 아래 기관에도 문의할 수 있습니다 ·
              개인정보 침해신고센터 (privacy.go.kr / 국번없이 182) · 대검찰청
              사이버범죄수사단 (spo.go.kr / 02-3480-3573)
            </p>
          </Article>

          {/* 부칙 */}
          <div className="py-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
              부칙
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
              부칙
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              이 처리방침은 {EFFECTIVE_DATE}부터 시행합니다. 종전의 처리방침은 본
              방침으로 갈음합니다.
            </p>
          </div>
        </section>

        {/* 푸터 CTA */}
        <footer className="mt-12 border-t border-[var(--color-border-light)] pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            관련 법적 고지
          </p>
          <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <FooterLink href="/legal/terms" label="이용약관" />
            <FooterLink
              href="/legal/marketplace"
              label="통신판매업 신고 정보"
            />
          </ul>
          <p className="mt-8 text-xs text-[var(--color-text-tertiary)]">
            개인정보 관련 문의는 privacy@medplace.example.com 으로 보내주세요.
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
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

/**
 * Phase ξ-4 — 모바일에서 표 가독성을 위해 hidden md:table 로 desktop only.
 * 모바일은 동일 컴포넌트 옆에 <MobileTable3Col /> 또는 <MobileTable2Col /> 추가.
 */
function MobileTable3Col({
  rows,
  cols,
}: {
  cols: [string, string, string];
  rows: Array<[string, string, string]>;
}) {
  return (
    <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-default)] md:hidden">
      {rows.map(([a, b, c], i) => (
        <div key={i} className="space-y-2 py-4">
          <dt className="text-base font-medium text-[var(--color-text-primary)]">
            {a}
          </dt>
          <dd className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                {cols[1]}
              </p>
              <p className="mt-1 leading-relaxed">{b}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                {cols[2]}
              </p>
              <p className="mt-1 leading-relaxed">{c}</p>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MobileTable2Col({
  rows,
  cols,
}: {
  cols: [string, string];
  rows: Array<[string, string]>;
}) {
  return (
    <dl className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-default)] md:hidden">
      {rows.map(([a, b], i) => (
        <div key={i} className="space-y-2 py-4">
          <dt className="text-base font-medium text-[var(--color-text-primary)]">
            {a}
          </dt>
          <dd>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {cols[1]}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {b}
            </p>
          </dd>
        </div>
      ))}
    </dl>
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
      className={`${nested ? "mt-3 ml-5" : "mt-2"} list-outside space-y-2`}
      style={{ listStyleType: nested ? "lower-alpha" : "decimal" }}
    >
      {children}
    </ol>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline gap-6 px-1 py-4">
      <span className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="text-sm leading-relaxed text-[var(--color-text-primary)]">
        {value}
      </span>
    </li>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline gap-6 py-3">
      <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="text-sm text-[var(--color-text-primary)]">{value}</span>
    </li>
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

