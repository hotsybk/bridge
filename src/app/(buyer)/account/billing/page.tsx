"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

/**
 * /account/billing — 등록된 결제 수단(카드) 관리.
 *
 * 디자인 DNA:
 *  - 박스 없음. 헤더 row + divide-y card list
 *  - 카드 row: brand text · 별칭 · masked 번호(mono) · 만료 · default badge · 액션
 *  - 정기 결제 안내 — divider list (정책 행)
 *  - 위험 영역 — 좌측 error border-l-2
 */

type CardMethod = {
  id: string;
  brand: "Visa" | "Mastercard" | "American Express" | "JCB";
  alias: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
};

const MOCK_CARDS: CardMethod[] = [
  {
    id: "card-1",
    brand: "Visa",
    alias: "법인 비자",
    last4: "4521",
    expiry: "12/27",
    isDefault: true,
  },
  {
    id: "card-2",
    brand: "Mastercard",
    alias: "구매팀 공용",
    last4: "8830",
    expiry: "08/26",
    isDefault: false,
  },
  {
    id: "card-3",
    brand: "American Express",
    alias: "원장 개인",
    last4: "1004",
    expiry: "03/28",
    isDefault: false,
  },
];

const RECURRING_POLICIES: Array<{ label: string; value: string }> = [
  {
    label: "사용 시점",
    value: "정기구독·공동구매 confirm·자동 발주 시 등록 카드로 결제됩니다",
  },
  {
    label: "사전 hold",
    value: "결제 1영업일 전 카드사에 hold 요청 — 한도 부족 시 알림톡 발송",
  },
  {
    label: "사용 명세",
    value: "PortOne 결제 영수증 · 카드사 명세서 양쪽 모두 발급",
  },
  {
    label: "취소 환불",
    value: "취소 시점에 따라 카드사 정책으로 즉시·익월 환불",
  },
];

export default function AccountBillingPage() {
  const [cards, setCards] = useState<CardMethod[]>(MOCK_CARDS);

  function setDefault(id: string) {
    setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
  }

  function remove(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function removeAll() {
    setCards([]);
  }

  return (
    <div className="space-y-16">
      {/* Phase 1.5 안내 — 실 데이터 연결 진행 중 */}
      <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-warning)]">
          Phase 1.5 출시 예정
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          이 페이지는 실 데이터 연결이 진행 중입니다. 현재 화면은 디자인
          미리보기로, 카드 추가·삭제해도 저장되지 않습니다.
        </p>
      </div>

      {/* 1. 등록된 결제 수단 */}
      <section>
        <header className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
            등록된 결제 수단
          </h2>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            카드 추가
          </button>
        </header>

        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {cards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                onSetDefault={() => setDefault(card.id)}
                onRemove={() => remove(card.id)}
              />
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
          모든 카드 정보는 PortOne(아임포트) 토큰화 저장 — 본 서버에는 마지막
          4자리만 보관됩니다.
        </p>
      </section>

      {/* 2. 정기 결제 안내 */}
      <section>
        <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
          정기 결제 안내
        </h2>
        <ul className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          {RECURRING_POLICIES.map((p) => (
            <li
              key={p.label}
              className="grid gap-2 py-5 md:grid-cols-[200px_1fr] md:items-baseline md:gap-6"
            >
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                {p.label}
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">
                {p.value}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. 위험 영역 */}
      <section>
        <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
          위험 영역
        </h2>
        <div className="mt-6 border-l-2 border-[var(--color-error)] pl-6">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            모든 카드 일괄 삭제
          </p>
          <p className="mt-2 max-w-lg text-xs text-[var(--color-text-tertiary)]">
            진행 중인 정기구독·예약된 공동구매가 있을 경우 결제 실패로 즉시
            중단됩니다. 카드 없이 운영하려면 운영자에게 별도 정산 협의가
            필요합니다.
          </p>
          <button
            type="button"
            onClick={removeAll}
            disabled={cards.length === 0}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-error)] px-6 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            모든 카드 삭제
          </button>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CardRow — divider line row
// ─────────────────────────────────────────────────────────────

function CardRow({
  card,
  onSetDefault,
  onRemove,
}: {
  card: CardMethod;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid gap-3 py-6 md:grid-cols-[200px_1fr_auto] md:items-start md:gap-8">
      {/* Left — brand + 별칭 + default */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {card.brand}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {card.alias}
          </p>
          {card.isDefault && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
              기본
            </span>
          )}
        </div>
      </div>

      {/* Center — masked + expiry */}
      <div className="min-w-0">
        <p className="font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
          **** **** **** {card.last4}
        </p>
        <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
          만료{" "}
          <span className="font-mono tabular-nums">{card.expiry}</span>
        </p>
      </div>

      {/* Right — actions */}
      <div className="flex flex-wrap items-center gap-4 md:justify-end">
        {!card.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="text-xs text-[var(--color-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--color-accent)]"
          >
            기본으로 설정
          </button>
        )}
        <button
          type="button"
          className="text-xs text-[var(--color-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--color-text-primary)]"
        >
          편집
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={card.isDefault}
          className="text-xs text-[var(--color-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--color-error)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          삭제
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 border-y border-[var(--color-border-light)] py-16 text-center">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        등록된 결제 수단이 없습니다
      </p>
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
        카드 1장을 추가하면 정기구독·공동구매를 바로 시작할 수 있습니다
      </p>
      <button
        type="button"
        className="mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />첫 카드 추가
      </button>
    </div>
  );
}
