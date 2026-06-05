"use client";

import { useMemo, useState } from "react";

/**
 * /account — 프로필 + 비밀번호 + 알림 + 위험 영역.
 *
 * 디자인 DNA:
 *  - 박스 없음. 섹션 H2(T3) + divide-y rows + LineField(bottom-border)
 *  - 비밀번호 강도 4단계 bar — 라인 4개 가로 분할
 *  - 토글 — 작은 sliding-circle switch (작은 client component 인라인)
 *  - 위험 영역 — 좌측 accent-error border-l-2
 */

const MOCK_USER = {
  name: "김민지",
  role: "OWNER",
  email: "minji@seoul-medical.kr",
  phone: "010-1234-5678",
  position: "구매팀장",
  passwordChangedAt: "2026-03-14",
};

type NotificationKey =
  | "ORDER_PROGRESS"
  | "SHIPPING_START"
  | "SETTLEMENT"
  | "GROUPBUY_DEADLINE"
  | "MARKETING";

type NotificationItem = {
  key: NotificationKey;
  label: string;
  hint: string;
  defaultOn: boolean;
  vendorOnly?: boolean;
};

const NOTIFICATION_ITEMS: NotificationItem[] = [
  {
    key: "ORDER_PROGRESS",
    label: "주문 처리 알림톡",
    hint: "결제·준비·발송 단계마다 카카오 알림톡 발송",
    defaultOn: true,
  },
  {
    key: "SHIPPING_START",
    label: "배송 시작 알림",
    hint: "송장 등록 즉시 받기",
    defaultOn: true,
  },
  {
    key: "SETTLEMENT",
    label: "정산 발생 알림",
    hint: "공급업체 계정에서만 적용",
    defaultOn: false,
    vendorOnly: true,
  },
  {
    key: "GROUPBUY_DEADLINE",
    label: "공동구매 마감 임박",
    hint: "참여한 공동구매가 24시간 내 마감될 때",
    defaultOn: false,
  },
  {
    key: "MARKETING",
    label: "마케팅 정보 수신",
    hint: "신상품·기획전·이벤트 (월 1~2회)",
    defaultOn: false,
  },
];

function daysSince(dateStr: string): number {
  const past = new Date(dateStr).getTime();
  const now = new Date("2026-06-01").getTime();
  return Math.max(0, Math.floor((now - past) / 86400000));
}

function passwordStrength(password: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { level: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["", "약함", "보통", "강함", "매우 강함"] as const;
  return { level: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

export default function AccountProfilePage() {
  const [profile, setProfile] = useState({
    name: MOCK_USER.name,
    position: MOCK_USER.position,
    phone: MOCK_USER.phone,
  });

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [notifications, setNotifications] = useState<
    Record<NotificationKey, boolean>
  >(() =>
    NOTIFICATION_ITEMS.reduce(
      (acc, it) => ({ ...acc, [it.key]: it.defaultOn }),
      {} as Record<NotificationKey, boolean>,
    ),
  );

  const pwStrength = useMemo(() => passwordStrength(newPw), [newPw]);
  const daysAgo = daysSince(MOCK_USER.passwordChangedAt);

  return (
    <div className="space-y-20">
      {/* Phase 1.5 안내 — 실 데이터 연결 진행 중 */}
      <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-warning)]">
          Phase 1.5 출시 예정
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          이 페이지는 실 데이터 연결이 진행 중입니다. 현재 화면은 디자인
          미리보기로, 입력해도 저장되지 않습니다.
        </p>
      </div>

      {/* 1. 프로필 정보 */}
      <section>
        <SectionHeader title="프로필 정보" />
        <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <LineField
            id="name"
            label="이름"
            value={profile.name}
            onChange={(v) => setProfile({ ...profile, name: v })}
          />
          <LineField
            id="position"
            label="직책"
            value={profile.position}
            onChange={(v) => setProfile({ ...profile, position: v })}
          />
          <LineField
            id="email"
            label="이메일"
            value={MOCK_USER.email}
            readOnly
            hint="변경 불가 — 가입 시 등록된 이메일"
            mono
          />
          <LineField
            id="phone"
            label="휴대전화"
            value={profile.phone}
            onChange={(v) => setProfile({ ...profile, phone: v })}
            mono
          />
        </dl>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            프로필 저장
          </button>
        </div>
      </section>

      {/* 2. 비밀번호 */}
      <section>
        <SectionHeader
          title="비밀번호"
          meta={`마지막 변경: ${daysAgo}일 전`}
        />
        <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <LineField
            id="currentPw"
            label="현재 비밀번호"
            type="password"
            value={currentPw}
            onChange={setCurrentPw}
          />
          <LineField
            id="newPw"
            label="새 비밀번호"
            type="password"
            value={newPw}
            onChange={setNewPw}
            hint="8자 이상 · 대소문자·숫자·특수문자 조합 권장"
          />
          <LineField
            id="newPw2"
            label="새 비밀번호 확인"
            type="password"
            value={newPw2}
            onChange={setNewPw2}
          />
        </dl>

        {/* 강도 표시 — 4 segment bar */}
        <div className="mt-6">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((seg) => {
              const filled = pwStrength.level >= seg;
              const color =
                pwStrength.level === 1
                  ? "bg-[var(--color-error)]"
                  : pwStrength.level === 2
                    ? "bg-[var(--color-warning)]"
                    : pwStrength.level === 3
                      ? "bg-[var(--color-accent)]"
                      : "bg-[var(--color-success)]";
              return (
                <span
                  key={seg}
                  aria-hidden
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    filled ? color : "bg-[var(--color-border-light)]"
                  }`}
                />
              );
            })}
          </div>
          <p className="mt-2 flex items-baseline justify-between text-[11px] text-[var(--color-text-tertiary)]">
            <span className="uppercase tracking-[0.18em]">강도</span>
            <span
              className={`tabular-nums ${
                pwStrength.level >= 3
                  ? "text-[var(--color-success)]"
                  : pwStrength.level === 2
                    ? "text-[var(--color-warning)]"
                    : pwStrength.level === 1
                      ? "text-[var(--color-error)]"
                      : ""
              }`}
            >
              {pwStrength.label || "—"}
            </span>
          </p>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={
              !currentPw || !newPw || newPw !== newPw2 || pwStrength.level < 2
            }
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-10 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-40"
          >
            비밀번호 변경
          </button>
        </div>
      </section>

      {/* 3. 알림 설정 */}
      <section>
        <SectionHeader title="알림 설정" />
        <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          {NOTIFICATION_ITEMS.map((item) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-6 py-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {item.label}
                  {item.vendorOnly && (
                    <span className="ml-2 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                      Vendor only
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  {item.hint}
                </p>
              </div>
              <ToggleSwitch
                checked={notifications[item.key]}
                onChange={(v) =>
                  setNotifications({ ...notifications, [item.key]: v })
                }
                disabled={item.vendorOnly}
                label={item.label}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* 4. 위험 영역 */}
      <section>
        <SectionHeader title="위험 영역" />
        <div className="border-l-2 border-[var(--color-error)] pl-6">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            계정 탈퇴
          </p>
          <p className="mt-2 max-w-lg text-xs text-[var(--color-text-tertiary)]">
            탈퇴 시 모든 주문 이력·정기구독·공동구매 참여가 해지됩니다. 진행
            중인 주문이 있을 경우 완료 후 탈퇴할 수 있습니다.
          </p>
          <button
            type="button"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-error)] px-6 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)] hover:text-white"
          >
            계정 탈퇴
          </button>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SectionHeader — H2(T3) + 우측 meta
// ─────────────────────────────────────────────────────────────

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <header className="mb-6 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
        {title}
      </h2>
      {meta && (
        <p className="text-xs text-[var(--color-text-tertiary)]">{meta}</p>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// LineField — divider row (label 좌 · input 우 · hint 아래)
// ─────────────────────────────────────────────────────────────

function LineField({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
  readOnly,
  mono,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  hint?: string;
  readOnly?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-3 py-5 md:grid-cols-[180px_1fr] md:items-center md:gap-6">
      <label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]"
      >
        {label}
      </label>
      <div className="min-w-0">
        <input
          id={id}
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={`h-9 w-full border-b bg-transparent text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)]/50 ${
            readOnly
              ? "cursor-not-allowed border-transparent text-[var(--color-text-tertiary)]"
              : "border-[var(--color-border-light)] focus:border-[var(--color-accent)]"
          } ${mono ? "font-mono tabular-nums" : ""}`}
        />
        {hint && (
          <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ToggleSwitch — sliding-circle (라이브러리 없이 인라인)
// ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
        checked
          ? "bg-[var(--color-accent)]"
          : "bg-[var(--color-border-default)]"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span
        aria-hidden
        className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-1"
        }`}
      />
    </button>
  );
}
