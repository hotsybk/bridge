"use client";

// Wave G — 카테고리 트리 + 편집 패널 (client island).
//
// 입력: trpcServer().admin.category.tree() 결과 (initialCategories)
//        → useState 로 관리하고 mutation 후 router.refresh() 로 재패치.
//
// 기능:
//   - 트리 렌더링 (parentId 매핑 → 재귀)
//   - 카테고리 선택 → 편집 패널
//   - 이름/슬러그/영문명/수수료율 수정 (update)
//   - 하위 카테고리 추가 (create)
//   - 루트 추가 (create with parentId=null)
//   - 삭제 (delete; 활성 상품 있으면 대체 카테고리 선택)

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import type { Category } from "@/lib/types";

type CategoryNode = Category & { children: CategoryNode[] };

function buildTree(flat: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const c of flat) byId.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const c of flat) {
    const node = byId.get(c.id)!;
    const pid = c.parentId ?? null;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // sortOrder 정렬
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export function CategoriesClient({
  initialCategories,
  readOnly = false,
}: {
  initialCategories: Category[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const tree = useMemo(() => buildTree(initialCategories), [initialCategories]);

  const [selectedId, setSelectedId] = useState<string>(
    initialCategories[0]?.id ?? "",
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // 루트만 기본 펼침
    const e: Record<string, boolean> = {};
    for (const r of tree) e[r.id] = true;
    return e;
  });

  const selected = initialCategories.find((c) => c.id === selectedId) ?? null;

  // 모달 상태
  const [createUnder, setCreateUnder] = useState<{
    parentId: string | null;
    parentName: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const toggleExpand = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="mt-12 grid gap-12 lg:grid-cols-[420px_1fr] lg:gap-16">
      {/* 좌측 — 트리 */}
      <div>
        <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            카테고리 트리
          </p>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setCreateUnder({ parentId: null, parentName: "루트" })}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            루트 추가
          </button>
        </div>
        <ul className="mt-2">
          {tree.length === 0 ? (
            <li className="py-10 text-center text-xs text-[var(--color-text-tertiary)]">
              아직 카테고리가 없습니다.
              <br />
              <code className="mt-2 inline-block font-mono text-[var(--color-text-secondary)]">
                pnpm seed:categories
              </code>
            </li>
          ) : (
            tree.map((c) => (
              <TreeNode
                key={c.id}
                node={c}
                level={0}
                selectedId={selectedId}
                expanded={expanded}
                onSelect={setSelectedId}
                onToggle={toggleExpand}
                onAddChild={(parent) =>
                  setCreateUnder({
                    parentId: parent.id,
                    parentName: parent.name,
                  })
                }
                readOnly={readOnly}
              />
            ))
          )}
        </ul>
      </div>

      {/* 우측 — 편집 패널 */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        {selected ? (
          <EditPanel
            key={selected.id}
            category={selected}
            onDelete={() => setConfirmDelete(selected)}
            readOnly={readOnly}
          />
        ) : (
          <p className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
            카테고리를 선택하면 편집 패널이 표시됩니다
          </p>
        )}
      </aside>

      {/* 카테고리 생성 모달 */}
      {createUnder && (
        <CreateDialog
          parentId={createUnder.parentId}
          parentName={createUnder.parentName}
          onClose={() => setCreateUnder(null)}
          onCreated={(id) => {
            setCreateUnder(null);
            setSelectedId(id);
            if (createUnder.parentId)
              setExpanded((s) => ({ ...s, [createUnder.parentId!]: true }));
            router.refresh();
          }}
        />
      )}

      {/* 삭제 모달 */}
      {confirmDelete && (
        <DeleteDialog
          category={confirmDelete}
          allCategories={initialCategories}
          onClose={() => setConfirmDelete(null)}
          onDeleted={() => {
            setConfirmDelete(null);
            setSelectedId(initialCategories[0]?.id ?? "");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tree node — 재귀
// ─────────────────────────────────────────────────────────────

function TreeNode({
  node,
  level,
  selectedId,
  expanded,
  onSelect,
  onToggle,
  onAddChild,
  readOnly,
}: {
  node: CategoryNode;
  level: number;
  selectedId: string;
  expanded: Record<string, boolean>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (parent: Category) => void;
  readOnly: boolean;
}) {
  const isSelected = selectedId === node.id;
  const isOpen = expanded[node.id];
  const hasChildren = node.children.length > 0;
  const indent = level * 16;

  return (
    <li>
      <div
        className={`group relative flex items-center gap-2 py-2 pr-2 text-sm transition-colors ${
          isSelected
            ? "bg-[var(--color-accent-light)]/40"
            : "hover:bg-[var(--color-bg-secondary)]/40"
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {isSelected && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-0.5 bg-[var(--color-accent)]"
          />
        )}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            aria-label={isOpen ? "접기" : "펼치기"}
            aria-expanded={isOpen}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="inline-block w-3.5" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex flex-1 items-baseline justify-between text-left"
        >
          <span
            className={`text-sm ${
              isSelected
                ? "font-semibold text-[var(--color-text-primary)]"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {node.name}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
            L{node.depth}
          </span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <ul>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
      {isOpen && (
        <div
          className="py-1.5"
          style={{ paddingLeft: `${indent + 28}px` }}
        >
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onAddChild(node)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            하위 카테고리 추가
          </button>
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Edit Panel
// ─────────────────────────────────────────────────────────────

function EditPanel({
  category,
  onDelete,
  readOnly,
}: {
  category: Category;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [nameEn, setNameEn] = useState(category.nameEn ?? "");
  const [slug, setSlug] = useState(category.slug);
  const [commissionRate, setCommissionRate] = useState(
    category.commissionRate != null ? (category.commissionRate * 100).toFixed(1) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const update = trpc.admin.category.update.useMutation();
  const isDirty =
    name !== category.name ||
    nameEn !== (category.nameEn ?? "") ||
    slug !== category.slug ||
    commissionRate !==
      (category.commissionRate != null
        ? (category.commissionRate * 100).toFixed(1)
        : "");

  async function handleSave() {
    setError(null);
    setSuccess(false);
    try {
      const trimmedRate = commissionRate.trim();
      const ratePatch =
        trimmedRate === ""
          ? null
          : Number((parseFloat(trimmedRate) / 100).toFixed(4));
      await update.mutateAsync({
        categoryId: category.id,
        name: name.trim() !== category.name ? name.trim() : undefined,
        nameEn:
          nameEn.trim() !== (category.nameEn ?? "")
            ? (nameEn.trim() || null)
            : undefined,
        slug: slug.trim() !== category.slug ? slug.trim() : undefined,
        commissionRate:
          ratePatch !== (category.commissionRate ?? null) ? ratePatch : undefined,
      });
      setSuccess(true);
      toast.success("카테고리를 업데이트했습니다");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  function handleReset() {
    setName(category.name);
    setNameEn(category.nameEn ?? "");
    setSlug(category.slug);
    setCommissionRate(
      category.commissionRate != null
        ? (category.commissionRate * 100).toFixed(1)
        : "",
    );
    setError(null);
    setSuccess(false);
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          선택된 카테고리
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          {category.name}
        </h2>
        <p className="mt-1 font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
          {category.slug} · depth {category.depth}
        </p>
        {category.path && category.path.length > 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {category.path.join(" › ")}
          </p>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-5">
        <LineField
          label="이름 (한국어)"
          value={name}
          onChange={setName}
          disabled={readOnly}
        />
        <LineField
          label="영문명"
          value={nameEn}
          onChange={setNameEn}
          disabled={readOnly}
        />
        <LineField
          label="Slug"
          value={slug}
          onChange={setSlug}
          mono
          disabled={readOnly}
        />
      </div>

      {/* 수수료율 — 단일 값 */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          수수료율 (이 카테고리에 속한 상품)
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div className="relative flex-1 max-w-[140px]">
            <input
              type="text"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="5.0"
              disabled={readOnly}
              className="h-9 w-full border-b border-[var(--color-border-light)] bg-transparent pr-8 font-mono text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
            />
            <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-tertiary)]">
              %
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            비워두면 vendor 기본 수수료율을 사용합니다
          </p>
        </div>
      </div>

      {/* 에러 / 성공 메시지 */}
      {error && (
        <div className="border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-3 py-2 text-xs text-[var(--color-error)]">
          {error}
        </div>
      )}
      {success && !error && (
        <div className="border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-3 py-2 text-xs text-[var(--color-success)]">
          저장되었습니다
        </div>
      )}

      {/* 액션 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={readOnly}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-error)]/30 px-4 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={readOnly || !isDirty || update.isPending}
            className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={readOnly || !isDirty || update.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {update.isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineField({
  label,
  value,
  onChange,
  mono,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`mt-2 block h-9 w-full border-b border-[var(--color-border-light)] bg-transparent text-sm focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50 ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Create Dialog
// ─────────────────────────────────────────────────────────────

function CreateDialog({
  parentId,
  parentName,
  onClose,
  onCreated,
}: {
  parentId: string | null;
  parentName: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [commissionRate, setCommissionRate] = useState("5.0");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.admin.category.create.useMutation();

  async function handleCreate() {
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError("이름과 slug는 필수입니다.");
      return;
    }
    try {
      const rate = commissionRate.trim()
        ? Number((parseFloat(commissionRate) / 100).toFixed(4))
        : undefined;
      const res = await create.mutateAsync({
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        slug: slug.trim(),
        parentId: parentId ?? undefined,
        commissionRate: rate,
      });
      toast.success("카테고리를 추가했습니다");
      onCreated(res.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "생성에 실패했습니다.";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>카테고리 추가</DialogTitle>
          <DialogDescription>
            {parentId ? `“${parentName}” 아래에 새 하위 카테고리를 추가합니다.` : "루트 카테고리를 추가합니다."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cat-name">이름 *</Label>
            <input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <Label htmlFor="cat-slug">Slug * (소문자·숫자·하이픈)</Label>
            <input
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="medical-devices"
              className="mt-2 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 font-mono text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <Label htmlFor="cat-name-en">영문명 (선택)</Label>
            <input
              id="cat-name-en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="mt-2 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <Label htmlFor="cat-rate">수수료율 (%, 선택)</Label>
            <input
              id="cat-rate"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="5.0"
              className="mt-2 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 font-mono text-sm tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-xs text-[var(--color-error)]">{error}</p>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            className="inline-flex h-9 items-center rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={create.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {create.isPending ? "추가 중..." : "추가"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Delete Dialog
// ─────────────────────────────────────────────────────────────

function DeleteDialog({
  category,
  allCategories,
  onClose,
  onDeleted,
}: {
  category: Category;
  allCategories: Category[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [replacementId, setReplacementId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [needsReplacement, setNeedsReplacement] = useState(false);

  const del = trpc.admin.category.delete.useMutation();

  // 동일 depth 또는 형제 카테고리 추천 — 본인 제외
  const candidates = useMemo(
    () =>
      allCategories.filter(
        (c) => c.id !== category.id && c.depth === category.depth,
      ),
    [allCategories, category],
  );

  async function handleDelete() {
    setError(null);
    try {
      await del.mutateAsync({
        categoryId: category.id,
        replacementCategoryId: replacementId || undefined,
      });
      toast.success("카테고리를 삭제했습니다");
      onDeleted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "삭제에 실패했습니다.";
      if (msg.includes("대체 카테고리")) {
        setNeedsReplacement(true);
      }
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>카테고리 삭제</DialogTitle>
          <DialogDescription>
            “{category.name}” 을(를) 삭제합니다. 활성 상품이 있는 경우 대체
            카테고리로 이동됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {needsReplacement && (
            <div>
              <Label htmlFor="cat-replace">대체 카테고리</Label>
              <select
                id="cat-replace"
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
                className="mt-2 h-9 w-full border-b border-[var(--color-border-light)] bg-transparent px-1 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="">선택해주세요</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.path ?? [c.name]).join(" › ")}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <div className="border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-3 py-2 text-xs text-[var(--color-error)]">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={del.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-light)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={del.isPending || (needsReplacement && !replacementId)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-error)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {del.isPending ? "삭제 중..." : "삭제"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
