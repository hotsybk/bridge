import Link from "next/link";


export const metadata = {
  title: "통신판매업 신고 정보 — MedPlace",
  description:
    "전자상거래법 §10에 따른 (주)MedPlace의 사업자 정보 공시 페이지입니다.",
};

/**
 * /legal/marketplace — 통신판매업 신고 정보 (2026-06).
 *
 * 디자인 DNA:
 *  - 박스 금지 / 라인 위주 / divide-y / max-w-3xl
 *  - 타이포 토큰: T2 + T3 + T4 + T5 + E·M
 */

const INFO_ROWS: Array<{
  label: string;
  value: string;
  accent?: boolean;
  note?: string;
}> = [
  { label: "상호", value: "(주)MedPlace" },
  { label: "대표자", value: "[운영자 결정 필요]" },
  { label: "사업자등록번호", value: "[신청 중]", note: "법인 설립 후 갱신 예정" },
  {
    label: "통신판매업 신고번호",
    value: "[신청 중]",
    accent: true,
    note: "관할 구청 신고 진행 중",
  },
  {
    label: "사업장 소재지",
    value: "서울특별시 강남구 (상세주소 추후 등록)",
  },
  { label: "대표 전화", value: "02-0000-0000" },
  { label: "이메일", value: "support@medplace.example.com" },
  { label: "호스팅 서비스 제공자", value: "Vercel · Firebase (Google)" },
];

export default function MarketplaceInfoPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-20">
        {/* Header */}
        <header>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            법적 고지 · Marketplace Info
          </p>
          <h1 className="mt-5 break-keep text-4xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-5xl">
            통신판매업 신고 정보
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            전자상거래법 §10에 따른 사업자 정보 공시
          </p>
        </header>

        {/* 사업자 정보 — divider list (dt/dd) */}
        <section
          aria-label="사업자 정보"
          className="mt-16"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            사업자 정보
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
            기본 사항
          </h2>

          <dl className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {INFO_ROWS.map((row) => (
              <InfoRow key={row.label} {...row} />
            ))}
          </dl>

          <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
            본 페이지의 사업자 정보는 통신판매업 신고 및 법인 설립 절차 진행에 따라
            업데이트됩니다.
          </p>
        </section>

        {/* 사업자 진위확인 */}
        <section className="mt-20 border-t border-[var(--color-border-light)] pt-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            사업자 진위확인
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
            국세청 사업자등록 조회
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            국세청 홈택스에서 본 사업자의 실제 등록 여부와 휴·폐업 상태를 확인할 수
            있습니다. 사업자등록번호를 입력하면 즉시 조회됩니다.
          </p>

          <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <ExternalLink
              label="국세청 홈택스 사업자등록 조회"
              href="https://www.hometax.go.kr/websquare/websquare.wq?w2xPath=/ui/pp/index_pp.xml"
            />
            <ExternalLink
              label="공정거래위원회 통신판매사업자 조회"
              href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no="
            />
          </ul>
        </section>

        {/* 소비자 분쟁 처리 */}
        <section className="mt-20 border-t border-[var(--color-border-light)] pt-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            소비자 분쟁 처리
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
            분쟁이 발생한 경우
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            서비스 이용 중 분쟁이 발생한 경우, 우선 회사 고객지원 창구로 문의해
            주시기 바랍니다. 회사와의 협의로 해결되지 않을 경우 아래 기관에 분쟁
            조정을 신청할 수 있습니다.
          </p>

          <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <DisputeRow
              label="한국소비자원"
              value="국번없이 1372 · kca.go.kr"
            />
            <DisputeRow
              label="전자거래분쟁조정위원회"
              value="국번없이 118 · ecmc.or.kr"
            />
            <DisputeRow
              label="개인정보 침해신고센터"
              value="국번없이 182 · privacy.go.kr"
            />
            <DisputeRow
              label="식품의약품안전처"
              value="국번없이 1577 · mfds.go.kr"
            />
          </ul>

          <p className="mt-8 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
            의료기기 관련 부작용·결함 신고는 식품의약품안전처 의료기기통합정보시스템
            (udiportal.mfds.go.kr) 에서도 접수할 수 있습니다.
          </p>
        </section>

        {/* 푸터 */}
        <footer className="mt-20 border-t border-[var(--color-border-light)] pt-10">
          <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
            본 페이지는 「전자상거래 등에서의 소비자보호에 관한 법률」 제10조(사업자의
            신원 등에 대한 정보 제공)에 따라 표시됩니다.
          </p>

          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            관련 법적 고지
          </p>
          <ul className="mt-5 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            <FooterLink href="/legal/terms" label="이용약관" />
            <FooterLink href="/legal/privacy" label="개인정보 처리방침" />
          </ul>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string;
  accent?: boolean;
  note?: string;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-6 py-5 md:grid-cols-[160px_1fr]">
      <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd>
        <p
          className={`text-sm font-medium ${
            accent
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-primary)]"
          }`}
        >
          {value}
        </p>
        {note && (
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            {note}
          </p>
        )}
      </dd>
    </div>
  );
}

function DisputeRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="grid grid-cols-[140px_1fr] items-baseline gap-6 py-4 md:grid-cols-[200px_1fr]">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
      </span>
      <span className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {value}
      </span>
    </li>
  );
}

function ExternalLink({ label, href }: { label: string; href: string }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between py-3 text-sm transition-colors hover:text-[var(--color-accent)]"
      >
        <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
          {label}
        </span>
        <span
          aria-hidden
          className="text-xs text-[var(--color-text-tertiary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]"
        >
          ↗
        </span>
      </a>
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

