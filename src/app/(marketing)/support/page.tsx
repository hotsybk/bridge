import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Clock,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
} from "lucide-react";


export const metadata = {
  title: "고객 지원 — MedPlace",
  description:
    "MedPlace 사용 중 궁금한 점을 빠르게 해결하세요. FAQ·1:1 문의·운영시간 안내.",
};

/**
 * /support — 고객 지원 허브 (Wave AA).
 *
 * 디자인 DNA:
 *  - 박스 금지, divide-y / border-y 라인만
 *  - eyebrow + T2 + body 패턴
 *  - max-w-6xl 마이크로 컨테이너
 */
export default function SupportPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <HeroSection />
      <ChannelsSection />
      <ContactStripSection />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <svg
          viewBox="0 0 1200 700"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="sup-mesh-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066CC" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sup-mesh-b" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5AC8FA" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="220" cy="160" r="320" fill="url(#sup-mesh-a)" />
          <circle cx="980" cy="540" r="280" fill="url(#sup-mesh-b)" />
        </svg>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-32 pb-20 text-center md:px-12 md:pt-40 md:pb-28">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
          고객 지원
        </p>
        <h1 className="mt-6 break-keep text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">
          도움이 필요하신가요?
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          가장 빠른 길은 자주 묻는 질문에서 시작합니다.
          <br className="hidden md:block" />
          해결되지 않으면 1:1 문의로 연결됩니다 — 영업일 기준 24시간 이내 답변.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Channels — 4 카드 (FAQ / 문의 / 운영시간 / 긴급 결제)
// ─────────────────────────────────────────────────────────────

const CHANNELS: Array<{
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
  icon: typeof HelpCircle;
  external?: boolean;
  inline?: boolean;
}> = [
  {
    eyebrow: "01",
    title: "자주 묻는 질문",
    body: "계정·결제·정기구독·공동구매·입점까지 33개 이상의 답변을 카테고리별로 정리했습니다.",
    href: "/support/faq",
    cta: "FAQ 보기",
    icon: HelpCircle,
  },
  {
    eyebrow: "02",
    title: "1:1 문의",
    body: "FAQ 에서 답을 찾지 못했다면 문의 폼으로 직접 보내주세요. 영업일 기준 24시간 이내 회신.",
    href: "/support/contact",
    cta: "문의 보내기",
    icon: MessageSquare,
  },
  {
    eyebrow: "03",
    title: "운영시간",
    body: "평일 09:00 ~ 18:00 KST · 점심 12:00 ~ 13:00 · 주말·공휴일 휴무. 외부 시간 문의는 다음 영업일 처리.",
    icon: Clock,
    inline: true,
  },
  {
    eyebrow: "04",
    title: "긴급 결제 이슈",
    body: "결제 실패·중복 결제·환불 지연은 결제 페이지 내 [긴급 문의] 버튼으로 즉시 연결됩니다. 일반 문의보다 우선 처리.",
    icon: ShieldAlert,
    inline: true,
  },
];

function ChannelsSection() {
  return (
    <section className="border-t border-[var(--color-border-light)]">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-24">
        <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          {CHANNELS.map((c) => (
            <ChannelRow key={c.title} channel={c} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ChannelRow({ channel }: { channel: (typeof CHANNELS)[number] }) {
  const Icon = channel.icon;
  const hasLink = Boolean(channel.href);

  const inner = (
    <div className="group grid grid-cols-[40px_1fr_auto] items-start gap-6 py-8 transition-colors md:grid-cols-[56px_1fr_auto] md:gap-10 md:py-10">
      <div className="flex flex-col items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)] md:h-12 md:w-12">
          <Icon className="h-5 w-5 md:h-5.5 md:w-5.5" strokeWidth={2} />
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] tabular-nums">
          {channel.eyebrow}
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
          {channel.title}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {channel.body}
        </p>

        {channel.inline && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-tertiary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-tertiary)]/40" />
            안내성 정보 — 별도 이동 없음
          </p>
        )}
      </div>

      <div className="flex items-center pt-2 md:pt-3">
        {hasLink ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5">
            {channel.cta}
            <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <span aria-hidden className="text-[var(--color-text-tertiary)]/40">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <li>
      {hasLink ? (
        <Link
          href={channel.href!}
          className="block hover:bg-[var(--color-bg-secondary)]/30"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Contact strip — 운영시간·이메일·전화 (직접 연결)
// ─────────────────────────────────────────────────────────────

function ContactStripSection() {
  return (
    <section className="border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/40">
      <div className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            직접 연락
          </p>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            전화·이메일로도 닿을 수 있습니다.
          </h2>
          <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
            서면 기록이 남는 1:1 문의를 권장하지만, 긴급한 경우 아래 채널로
            바로 연락해주세요.
          </p>
        </div>

        <dl className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
          <ContactItem
            icon={Clock}
            label="운영시간"
            value="평일 09:00 ~ 18:00 KST"
            sub="점심 12:00 ~ 13:00 · 주말·공휴일 휴무"
          />
          <ContactItem
            icon={Mail}
            label="이메일"
            value="support@medplace.example.com"
            href="mailto:support@medplace.example.com"
            sub="모든 영업일 답변 보장"
            borderLeft
          />
          <ContactItem
            icon={Phone}
            label="대표 전화"
            value="02-0000-0000"
            href="tel:020000000"
            sub="운영시간 내 응대"
            borderLeft
          />
        </dl>

        <div className="mt-16 flex flex-wrap items-center gap-3">
          <Link
            href="/support/contact"
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-7 text-sm font-medium text-white active:scale-[0.98]"
          >
            1:1 문의 보내기
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href="/support/faq"
            className="inline-flex h-12 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-7 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            FAQ 둘러보기
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  sub,
  href,
  borderLeft,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  sub: string;
  href?: string;
  borderLeft?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {label}
        </p>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.025em] tabular-nums text-[var(--color-text-primary)] md:text-3xl">
        {value}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        {sub}
      </p>
    </>
  );

  const cls = borderLeft
    ? "md:border-l md:border-[var(--color-border-light)] md:pl-10"
    : "";

  if (href) {
    return (
      <dt className={cls}>
        <a
          href={href}
          className="block transition-colors hover:text-[var(--color-accent)]"
        >
          {inner}
        </a>
      </dt>
    );
  }
  return <dt className={cls}>{inner}</dt>;
}

