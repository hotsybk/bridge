"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";

/**
 * /account/addresses — 등록된 배송지 관리 (Firestore 영속).
 *
 * hospitals/{hid}/addresses 서브컬렉션 CRUD (hospital.addresses router).
 * 기본 배송지는 1개만 유지되고 체크아웃에서 자동 선택된다.
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

type FormState = Omit<Address, "id" | "isDefault"> & { isDefault: boolean };

const EMPTY_FORM: FormState = {
  label: "",
  recipient: "",
  phone: "",
  zipcode: "",
  address: "",
  detail: "",
  isDefault: false,
};

export default function AccountAddressesPage() {
  const utils = trpc.useUtils();
  const { data: addresses = [], isLoading } =
    trpc.hospital.addresses.list.useQuery();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function invalidate() {
    void utils.hospital.addresses.list.invalidate();
  }

  const createMut = trpc.hospital.addresses.create.useMutation({
    onSuccess: () => {
      toast.success("배송지를 추가했습니다.");
      closeForm();
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.hospital.addresses.update.useMutation({
    onSuccess: () => {
      toast.success("배송지를 수정했습니다.");
      closeForm();
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setDefaultMut = trpc.hospital.addresses.setDefault.useMutation({
    onSuccess: () => {
      toast.success("기본 배송지로 설정했습니다.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.hospital.addresses.remove.useMutation({
    onSuccess: () => {
      toast.success("배송지를 삭제했습니다.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }
  function openEdit(addr: Address) {
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      recipient: addr.recipient,
      phone: addr.phone,
      zipcode: addr.zipcode,
      address: addr.address,
      detail: addr.detail,
      isDefault: addr.isDefault,
    });
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function submit() {
    if (!form.label || !form.recipient || !form.phone || !form.zipcode || !form.address) {
      toast.error("라벨·수령인·연락처·우편번호·주소는 필수입니다.");
      return;
    }
    if (editingId) {
      updateMut.mutate({ ...form, id: editingId });
    } else {
      createMut.mutate(form);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-16">
      {/* 1. 등록된 배송지 list */}
      <section>
        <header className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
            등록된 배송지
          </h2>
          {!formOpen && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />새 주소 추가
            </button>
          )}
        </header>

        {/* 추가/편집 폼 */}
        {formOpen && (
          <AddressForm
            form={form}
            setForm={setForm}
            editing={Boolean(editingId)}
            saving={saving}
            onSubmit={submit}
            onCancel={closeForm}
          />
        )}

        {isLoading ? (
          <p className="mt-8 text-sm text-[var(--color-text-tertiary)]">
            불러오는 중…
          </p>
        ) : addresses.length === 0 ? (
          !formOpen && <EmptyState onAdd={openAdd} />
        ) : (
          <ul className="mt-8 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {addresses.map((addr) => (
              <AddressRow
                key={addr.id}
                addr={addr}
                onSetDefault={() => setDefaultMut.mutate({ id: addr.id })}
                onEdit={() => openEdit(addr)}
                onRemove={() => removeMut.mutate({ id: addr.id })}
                busy={setDefaultMut.isPending || removeMut.isPending}
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
          <PolicyRow label="평일 발주 마감" value="오후 3시 (이후 익영업일 출고)" />
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
// AddressForm — inline 추가/편집 폼
// ─────────────────────────────────────────────────────────────

function AddressForm({
  form,
  setForm,
  editing,
  saving,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const field =
    "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]";
  return (
    <div className="mt-8 rounded-2xl border border-[var(--color-border-light)] p-5 md:p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {editing ? "배송지 수정" : "새 배송지 추가"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="닫기"
          className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <LabeledInput label="라벨 (예: 본원 자재실)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} className={field} />
        <LabeledInput label="수령인" value={form.recipient} onChange={(v) => setForm({ ...form, recipient: v })} className={field} />
        <LabeledInput label="연락처" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} className={field} />
        <LabeledInput label="우편번호" value={form.zipcode} onChange={(v) => setForm({ ...form, zipcode: v })} className={field} />
        <div className="md:col-span-2">
          <LabeledInput label="주소" value={form.address} onChange={(v) => setForm({ ...form, address: v })} className={field} />
        </div>
        <div className="md:col-span-2">
          <LabeledInput label="상세주소 (선택)" value={form.detail} onChange={(v) => setForm({ ...form, detail: v })} className={field} />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
        />
        기본 배송지로 설정
      </label>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {saving ? "저장 중…" : editing ? "수정 저장" : "배송지 추가"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-border-light)] px-6 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// AddressRow — line divider row
// ─────────────────────────────────────────────────────────────

function AddressRow({
  addr,
  onSetDefault,
  onEdit,
  onRemove,
  busy,
}: {
  addr: Address;
  onSetDefault: () => void;
  onEdit: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <li className="grid gap-3 py-6 md:grid-cols-[200px_1fr_auto] md:items-start md:gap-8">
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

      <div className="min-w-0">
        <p className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
          {addr.phone}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-primary)]">
          ({addr.zipcode}) {addr.address}
        </p>
        {addr.detail && (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {addr.detail}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 md:justify-end">
        {!addr.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            disabled={busy}
            className="text-xs text-[var(--color-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
          >
            기본으로 설정
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-[var(--color-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--color-text-primary)]"
        >
          편집
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={addr.isDefault || busy}
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
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
        onClick={onAdd}
        className="mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        첫 배송지 추가
      </button>
    </div>
  );
}
