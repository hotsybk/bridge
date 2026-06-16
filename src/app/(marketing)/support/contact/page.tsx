import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { ContactForm } from "./actions";

export const metadata = {
  title: "1:1 문의 — MedPlace 고객 지원",
  description:
    "MedPlace 운영팀에 직접 문의하세요. 영업일 기준 24시간 이내 답변드립니다.",
};

/**
 * /support/contact — Wave AA.
 * 좌측 폼(클라이언트) + 우측 직접 연락처(서버).
 */
export default function SupportContactPage() {
  return (
    <div className="relative isolate min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24">
        <div className="grid gap-16 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <div>
            <ContactForm />
          </div>

          <aside className="lg:border-l lg:border-[var(--color-border-light)] lg:pl-16">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
              직접 연락
            </p>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              긴급한 경우 바로 닿을 수 있습니다.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              일반적인 문의는 좌측 폼이 가장 빠릅니다. 결제 등 시간이 중요한
              사안은 전화로 직접 안내드립니다.
            </p>

            <dl className="mt-12 space-y-10">
              <DirectItem
                icon={Clock}
                label="운영시간"
                value="평일 09:00 ~ 18:00 KST"
                sub="점심 12:00 ~ 13:00 · 주말·공휴일 휴무"
              />
              <DirectItem
                icon={Mail}
                label="이메일"
                value="support@medplace.example.com"
                href="mailto:support@medplace.example.com"
                sub="모든 영업일 24시간 이내 답변"
              />
              <DirectItem
                icon={Phone}
                label="대표 전화"
                value="02-0000-0000"
                href="tel:020000000"
                sub="운영시간 내 응대"
              />
              <DirectItem
                icon={MapPin}
                label="주소"
                value="서울특별시 강남구"
                sub="상세주소는 법인 설립 후 공시"
              />
            </dl>

            <div className="mt-14 border-t border-[var(--color-border-light)] pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                먼저 확인해보세요
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <Link
                    href="/support/faq"
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    자주 묻는 질문
                  </Link>
                  <span className="text-[var(--color-text-tertiary)]">
                    {" "}
                    — 가장 빠른 해결
                  </span>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    수수료 안내
                  </Link>
                  <span className="text-[var(--color-text-tertiary)]">
                    {" "}
                    — 거래 비용 시뮬레이션
                  </span>
                </li>
                <li>
                  <Link
                    href="/legal/marketplace"
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    통신판매업 정보
                  </Link>
                  <span className="text-[var(--color-text-tertiary)]">
                    {" "}
                    — 사업자 공시
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <section className="border-b border-[var(--color-border-light)]">
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-12 md:px-12 md:pt-32 md:pb-16">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
          문의하기
        </p>
        <h1 className="mt-6 break-keep text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">
          한 통의 문의로 시작합니다.
        </h1>
        <p className="mt-6 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          영업일 24시간 내 회신. 결제·계정 보안은 우선 처리합니다.
        </p>
      </div>
    </section>
  );
}

function DirectItem({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  sub: string;
  href?: string;
}) {
  const valueNode = href ? (
    <a
      href={href}
      className="text-base font-semibold tracking-[-0.015em] tabular-nums text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent)]"
    >
      {value}
    </a>
  ) : (
    <span className="text-base font-semibold tracking-[-0.015em] tabular-nums text-[var(--color-text-primary)]">
      {value}
    </span>
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {label}
        </p>
      </div>
      <p className="mt-3">{valueNode}</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        {sub}
      </p>
    </div>
  );
}

