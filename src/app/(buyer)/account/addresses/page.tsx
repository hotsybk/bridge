"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

/**
 * /account/addresses — 등록된 배송지 관리.
 *
 * 디자인 DNA:
 *  - 박스 없음. 헤더 row (H2 + CTA) → divide-y list rows
 *  - 각 row: 라벨(+default badge) · 수령인·전화 · 주소 · underline 액션 link
 *  - 빈 상태: 가운데 정렬 라인 일러스트 없이 단순 텍스트 + CTA
 */

type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  zipcode: string;
  address: string;
  detail: string;
  isDefault: boolean;
};

const MOCK_ADDRESSES: Address[] = [
  {
    id: "addr-1",
    label: "본원 자재실",
    recipient: "서울메디컬의원 자재실",
    phone: "02-1234-5678",
    zipcode: "06236",
    address: "서울특별시 강남구 테헤란로 123",
    detail: "5층 502호",
    isDefault: true,
  },
  {
    id: "addr-2",
    label: "별관 영상실",
    recipient: "서울메디컬의원 영상실",
    phone: "02-1234-5679",
    zipcode: "06236",
    address: "서울특별시 강남구 테헤란로 123",
    detail: "4층 401호",
    isDefault: false,
  },
  {
    id: "addr-3",
    label: "동대문 분원",
    recipient: "서울메디컬의원 동대문분원",
    phone: "02-2233-1100",
    zipcode: "02564",
    address: "서울특별시 동대문구 왕산로 50",
    detail: "3층",
    isDefault: false,
  },
  {
    id: "addr-4",
    label: "원장 자택",
    recipient: "김민지",
    phone: "010-1234-5678",
    zipcode: "06521",
    address: "서울특별시 서초구 서초대로 200",
    detail: "11동 1502호",
    isDefault: false,
  },
];

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>(MOCK_ADDRESSES);

  function setDefault(id: string) {
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id })),
    );
  }

  function remove(id: string) {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
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
          미리보기로, 등록·삭제해도 저장되지 않습니다.
        </p>
      </div>

      {/* 1. 등록된 배송지 list */}
      <section>
        <header className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
            등록된 배송지
          </h2>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />새 주소 추가
          </button>
        </header>

        {addresses.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {addresses.map((addr) => (
              <AddressRow
                key={addr.id}
                addr={addr}
                onSetDefault={() => setDefault(addr.id)}
                onRemove={() => remove(addr.id)}
              />
            ))}
          </ul>
        )}

        <p className="mt-6 text-[11px] text-[var(--color-text-tertiary)]">
          기본 배송지는 체크아웃 시 자동 선택됩니다. 최대 10개까지 등록할 수
          있습니다.
        </p>
      </section>

      {/* 2. 배송 정책 안내 */}
      <section>
        <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
          배송 정책 안내
        </h2>
        <ul className="mt-6 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <PolicyRow
            label="배송 가능 지역"
            value="전국 (제주·도서산간 일부 추가비 발생)"
          />
          <PolicyRow
            label="평일 발주 마감"
            value="오후 3시 (이후 익영업일 출고)"
          />
          <PolicyRow
            label="냉장 의료기기"
            value="별도 콜드체인 — 입력한 배송지 1km 이내 검수 필요"
          />
        </ul>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AddressRow — line divider row
// ─────────────────────────────────────────────────────────────

function AddressRow({
  addr,
  onSetDefault,
  onRemove,
}: {
  addr: Address;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid gap-3 py-6 md:grid-cols-[200px_1fr_auto] md:items-start md:gap-8">
      {/* Left — label + default badge */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {addr.label}
          </p>
          {addr.isDefault && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
              기본
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {addr.recipient}
        </p>
      </div>

      {/* Center — phone + address */}
      <div className="min-w-0">
        <p className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
          {addr.phone}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-primary)]">
          ({addr.zipcode}) {addr.address}
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {addr.detail}
        </p>
      </div>

      {/* Right — actions */}
      <div className="flex flex-wrap items-center gap-4 md:justify-end">
        {!addr.isDefault && (
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
          disabled={addr.isDefault}
          className="text-xs text-[var(--color-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--color-error)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          삭제
        </button>
      </div>
    </li>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="grid gap-2 py-5 md:grid-cols-[200px_1fr] md:items-baseline md:gap-6">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="text-sm text-[var(--color-text-primary)]">{value}</p>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 border-y border-[var(--color-border-light)] py-16 text-center">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        등록된 배송지가 없습니다
      </p>
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
        첫 배송지를 추가하면 체크아웃이 한층 빨라집니다
      </p>
      <button
        type="button"
        className="mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        첫 배송지 추가
      </button>
    </div>
  );
}
