"use client";

// Wave O / U — 시스템 설정 client island.
// 6 tab: 일반 / 결제 / 알림 / 외부 통합 / 보안 / 기능 플래그.
// 각 tab별 save → tRPC mutation. 차단 IP add/remove.
// 상단 "전체 백업" 버튼 — exportSystemSettings callable.

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { app } from "@/lib/firebase/client";
import { trpc } from "@/lib/trpc/client";

export type SettingsBundle = {
  general: {
    platformName?: string;
    logoUrl?: string | null;
    currency?: "KRW" | "USD";
    timezone?: string;
    language?: "ko" | "en";
    supportEmail?: string;
    mailorderRegNo?: string;
  } | null;
  payment: {
    portoneTestMode?: boolean;
    portonePaymentTimeoutSec?: number;
    portoneRefundTimeoutSec?: number;
    portoneWebhookRetryCount?: number;
    apiSecret?: string;
    [key: string]: unknown;
  } | null;
  notification: {
    solapiSenderNumber?: string;
    solapiPfid?: string;
    apiKey?: string;
    [key: string]: unknown;
  } | null;
  external: {
    mfdsEndpoint?: string;
    clovaOcrInvokeUrl?: string;
    [key: string]: unknown;
  } | null;
  security: {
    rateLimitLogin?: number;
    rateLimitApi?: number;
    rateLimitPayment?: number;
    sessionTimeoutAdminDays?: number;
    sessionTimeoutUserDays?: number;
    blockedIps?: string[];
  } | null;
};

type Tab =
  | "GENERAL"
  | "PAYMENT"
  | "NOTIFICATION"
  | "INTEGRATION"
  | "SECURITY"
  | "FEATURE_FLAGS";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "GENERAL", label: "일반" },
  { value: "PAYMENT", label: "결제" },
  { value: "NOTIFICATION", label: "알림" },
  { value: "INTEGRATION", label: "외부 통합" },
  { value: "SECURITY", label: "보안" },
  { value: "FEATURE_FLAGS", label: "기능 플래그" },
];

export function SettingsClient({
  bundle,
  isPreview,
}: {
  bundle: SettingsBundle;
  isPreview?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("GENERAL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleMsg(ok: boolean, msg: string) {
    if (ok) {
      setSuccessMsg(msg);
      setErrorMsg(null);
      toast.success(msg);
    } else {
      setErrorMsg(msg);
      setSuccessMsg(null);
      toast.error(msg);
    }
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 4000);
  }

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <PageHeader
        label="시스템 · 설정"
        title="시스템 설정"
        description={
          isPreview
            ? "플랫폼 운영 설정 통합 관리 (PREVIEW — 로그인 후 실 데이터 노출)"
            : "플랫폼 운영 설정 통합 관리"
        }
      >
        <BackupButton onMsg={handleMsg} />
      </PageHeader>

      {(successMsg || errorMsg) && (
        <p
          className={`mt-6 text-xs ${
            errorMsg
              ? "text-[var(--color-error)]"
              : "text-[var(--color-success)]"
          }`}
        >
          {errorMsg ?? successMsg}
        </p>
      )}

      {/* Tab strip */}
      <nav
        className="mt-10 flex gap-1 border-b border-[var(--color-border-light)]"
        aria-label="설정 카테고리"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={active}
              className={`relative -mb-px whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-10">
        {tab === "GENERAL" && (
          <GeneralTab data={bundle.general} onMsg={handleMsg} />
        )}
        {tab === "PAYMENT" && (
          <PaymentTab data={bundle.payment} onMsg={handleMsg} />
        )}
        {tab === "NOTIFICATION" && (
          <NotificationTab data={bundle.notification} onMsg={handleMsg} />
        )}
        {tab === "INTEGRATION" && (
          <IntegrationTab data={bundle.external} onMsg={handleMsg} />
        )}
        {tab === "SECURITY" && (
          <SecurityTab data={bundle.security} onMsg={handleMsg} />
        )}
        {tab === "FEATURE_FLAGS" && <FeatureFlagsTab onMsg={handleMsg} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 백업 버튼 — exportSystemSettings callable
// ─────────────────────────────────────────────────────────────

function BackupButton({ onMsg }: { onMsg: (ok: boolean, msg: string) => void }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions(app, "asia-northeast3");
      const fn = httpsCallable<
        Record<string, never>,
        {
          url: string;
          filename: string;
          exportedAt: string;
          sectionCount: number;
          flagCount: number;
          categoryCount: number;
        }
      >(functions, "exportSystemSettings");
      const { data } = await fn({});
      onMsg(
        true,
        `백업 완료 — section ${data.sectionCount} · flag ${data.flagCount} · category ${data.categoryCount}`,
      );
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onMsg(false, `백업 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {loading ? "백업 중…" : "전체 백업"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab — 기능 플래그 (Wave U)
// ─────────────────────────────────────────────────────────────

type FlagRow = {
  id: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  segment?: "ALL" | "HOSPITALS" | "VENDORS" | "INTERNAL";
};

function FeatureFlagsTab({
  onMsg,
}: {
  onMsg: (ok: boolean, msg: string) => void;
}) {
  const utils = trpc.useUtils();
  const listQ = trpc.admin.featureFlag.list.useQuery(undefined, {
    retry: false,
  });
  const upsert = trpc.admin.featureFlag.upsert.useMutation({
    onSuccess: () => {
      onMsg(true, "기능 플래그 저장 완료");
      utils.admin.featureFlag.list.invalidate();
    },
    onError: (e) => onMsg(false, e.message),
  });
  const del = trpc.admin.featureFlag.delete.useMutation({
    onSuccess: () => {
      onMsg(true, "기능 플래그 삭제 완료");
      utils.admin.featureFlag.list.invalidate();
    },
    onError: (e) => onMsg(false, e.message),
  });

  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const flags = (listQ.data ?? []) as FlagRow[];

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          기능 플래그 ({flags.length}개)
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          런타임 토글. SUPER_ADMIN 만 추가·수정·삭제. ID 변경 불가.
        </p>

        {listQ.isLoading ? (
          <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
            불러오는 중…
          </p>
        ) : flags.length === 0 ? (
          <p className="mt-4 border-y border-[var(--color-border-light)] py-6 text-center text-xs text-[var(--color-text-secondary)]">
            등록된 기능 플래그가 없습니다
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {flags.map((flag) => (
              <FlagRowItem
                key={flag.id}
                flag={flag}
                onSave={(payload) => upsert.mutate(payload)}
                onDelete={() => del.mutate({ id: flag.id })}
                disabled={upsert.isPending || del.isPending}
              />
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          새 플래그 추가
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[200px_1fr_auto]">
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="flag-id (영문/숫자/-_.)"
            className="h-8 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="설명"
            className="h-8 border-b border-[var(--color-border-light)] bg-transparent text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="button"
            disabled={!newId.trim() || upsert.isPending}
            onClick={() => {
              upsert.mutate(
                {
                  id: newId.trim(),
                  description: newDesc.trim(),
                  enabled: false,
                  rolloutPercentage: 100,
                  segment: "ALL",
                },
                {
                  onSuccess: () => {
                    setNewId("");
                    setNewDesc("");
                  },
                },
              );
            }}
            className="inline-flex h-8 items-center rounded-full border border-[var(--color-border-light)] px-4 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            + 추가
          </button>
        </div>
      </div>
    </div>
  );
}

function FlagRowItem({
  flag,
  onSave,
  onDelete,
  disabled,
}: {
  flag: FlagRow;
  onSave: (payload: {
    id: string;
    description: string;
    enabled: boolean;
    rolloutPercentage: number;
    segment: "ALL" | "HOSPITALS" | "VENDORS" | "INTERNAL";
  }) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [desc, setDesc] = useState(flag.description ?? "");
  const [enabled, setEnabled] = useState(flag.enabled ?? false);
  const [rollout, setRollout] = useState(flag.rolloutPercentage ?? 100);
  const [segment, setSegment] = useState<
    "ALL" | "HOSPITALS" | "VENDORS" | "INTERNAL"
  >(flag.segment ?? "ALL");

  return (
    <li className="grid grid-cols-1 gap-2 px-2 py-4 md:grid-cols-[200px_1fr_120px_120px_auto_auto] md:items-center">
      <div>
        <p className="font-mono text-xs tabular-nums">{flag.id}</p>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="설명"
          className="mt-1 h-6 w-full bg-transparent text-[11px] text-[var(--color-text-tertiary)] focus:outline-none"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        <span className="text-[var(--color-text-secondary)]">
          {enabled ? "ON" : "OFF"}
        </span>
      </label>
      <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
        <input
          type="range"
          min={0}
          max={100}
          value={rollout}
          onChange={(e) => setRollout(Number(e.target.value))}
          className="flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-8 text-right font-mono tabular-nums">{rollout}%</span>
      </label>
      <select
        value={segment}
        onChange={(e) =>
          setSegment(
            e.target.value as "ALL" | "HOSPITALS" | "VENDORS" | "INTERNAL",
          )
        }
        className="h-7 bg-transparent text-xs focus:outline-none"
      >
        <option value="ALL">전체</option>
        <option value="HOSPITALS">병원</option>
        <option value="VENDORS">공급업체</option>
        <option value="INTERNAL">내부</option>
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onSave({
            id: flag.id,
            description: desc,
            enabled,
            rolloutPercentage: rollout,
            segment,
          })
        }
        className="inline-flex h-7 items-center rounded-full bg-[var(--color-accent)] px-3 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        저장
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (confirm(`정말 ${flag.id} 플래그를 삭제하시겠습니까?`)) onDelete();
        }}
        className="inline-flex h-7 items-center rounded-full border border-[var(--color-border-light)] px-3 text-[11px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] disabled:opacity-50"
      >
        삭제
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab — 일반
// ─────────────────────────────────────────────────────────────

function GeneralTab({
  data,
  onMsg,
}: {
  data: SettingsBundle["general"];
  onMsg: (ok: boolean, msg: string) => void;
}) {
  const [platformName, setPlatformName] = useState(data?.platformName ?? "");
  const [logoUrl, setLogoUrl] = useState(data?.logoUrl ?? "");
  const [currency, setCurrency] = useState<"KRW" | "USD">(
    data?.currency ?? "KRW",
  );
  const [timezone, setTimezone] = useState(data?.timezone ?? "Asia/Seoul");
  const [language, setLanguage] = useState<"ko" | "en">(data?.language ?? "ko");
  const [supportEmail, setSupportEmail] = useState(data?.supportEmail ?? "");
  const [mailorderRegNo, setMailorderRegNo] = useState(
    data?.mailorderRegNo ?? "",
  );

  const m = trpc.admin.settings.updateGeneral.useMutation({
    onSuccess: () => onMsg(true, "일반 설정 저장 완료"),
    onError: (e) => onMsg(false, e.message),
  });

  return (
    <div>
      <dl className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
        <LineFieldInput
          label="플랫폼명"
          value={platformName}
          onChange={setPlatformName}
        />
        <LineFieldInput label="로고 URL" value={logoUrl} onChange={setLogoUrl} mono />
        <LineFieldSelect
          label="기본 통화"
          value={currency}
          onChange={(v) => setCurrency(v as "KRW" | "USD")}
          options={[
            { value: "KRW", label: "KRW" },
            { value: "USD", label: "USD" },
          ]}
        />
        <LineFieldInput label="시간대" value={timezone} onChange={setTimezone} mono />
        <LineFieldSelect
          label="기본 언어"
          value={language}
          onChange={(v) => setLanguage(v as "ko" | "en")}
          options={[
            { value: "ko", label: "한국어" },
            { value: "en", label: "English" },
          ]}
        />
        <LineFieldInput
          label="고객 지원 이메일"
          value={supportEmail}
          onChange={setSupportEmail}
          mono
        />
        <LineFieldInput
          label="통신판매업 신고번호"
          value={mailorderRegNo}
          onChange={setMailorderRegNo}
          mono
        />
      </dl>
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={m.isPending}
          onClick={() =>
            m.mutate({
              platformName: platformName || undefined,
              logoUrl: logoUrl || null,
              currency,
              timezone,
              language,
              supportEmail: supportEmail || undefined,
              mailorderRegNo: mailorderRegNo || undefined,
            })
          }
          className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {m.isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab — 결제
// ─────────────────────────────────────────────────────────────

function PaymentTab({
  data,
  onMsg,
}: {
  data: SettingsBundle["payment"];
  onMsg: (ok: boolean, msg: string) => void;
}) {
  const [testMode, setTestMode] = useState<boolean>(
    data?.portoneTestMode ?? false,
  );
  const [paymentTimeout, setPaymentTimeout] = useState<number>(
    data?.portonePaymentTimeoutSec ?? 60,
  );
  const [refundTimeout, setRefundTimeout] = useState<number>(
    data?.portoneRefundTimeoutSec ?? 120,
  );
  const [webhookRetry, setWebhookRetry] = useState<number>(
    data?.portoneWebhookRetryCount ?? 5,
  );

  const m = trpc.admin.settings.updatePayment.useMutation({
    onSuccess: () => onMsg(true, "결제 설정 저장 완료"),
    onError: (e) => onMsg(false, e.message),
  });

  const apiSecretValue =
    typeof data?.apiSecret === "string" ? data.apiSecret : "—";

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          PortOne 키 (env 관리 · 읽기 전용)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <ReadOnlyMasked label="PortOne API Secret" value={apiSecretValue} />
        </dl>
        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
          비밀 키는 .env.local 에서 관리합니다. 자동 마스킹됩니다.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          결제 정책 (SUPER_ADMIN)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <ToggleField
            label="테스트 모드"
            hint="모든 결제가 PortOne 테스트 채널로 라우팅됩니다"
            on={testMode}
            onChange={setTestMode}
          />
          <EditableNumberField
            label="결제 시도 timeout"
            value={paymentTimeout}
            onChange={setPaymentTimeout}
            unit="초"
          />
          <EditableNumberField
            label="환불 처리 timeout"
            value={refundTimeout}
            onChange={setRefundTimeout}
            unit="초"
          />
          <EditableNumberField
            label="webhook 재시도 횟수"
            value={webhookRetry}
            onChange={setWebhookRetry}
            unit="회"
          />
        </dl>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={m.isPending}
            onClick={() =>
              m.mutate({
                portoneTestMode: testMode,
                portonePaymentTimeoutSec: paymentTimeout,
                portoneRefundTimeoutSec: refundTimeout,
                portoneWebhookRetryCount: webhookRetry,
              })
            }
            className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending ? "저장 중..." : "저장 (SUPER_ADMIN)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab — 알림
// ─────────────────────────────────────────────────────────────

function NotificationTab({
  data,
  onMsg,
}: {
  data: SettingsBundle["notification"];
  onMsg: (ok: boolean, msg: string) => void;
}) {
  const [senderNumber, setSenderNumber] = useState(
    data?.solapiSenderNumber ?? "",
  );
  const [pfid, setPfid] = useState(data?.solapiPfid ?? "");

  const m = trpc.admin.settings.updateNotification.useMutation({
    onSuccess: () => onMsg(true, "알림 설정 저장 완료"),
    onError: (e) => onMsg(false, e.message),
  });

  const apiKeyValue = typeof data?.apiKey === "string" ? data.apiKey : "—";

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          Solapi 키 (env 관리 · 읽기 전용)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <ReadOnlyMasked label="Solapi API Key" value={apiKeyValue} />
        </dl>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          발송 설정 (SUPER_ADMIN)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <LineFieldInput
            label="발송자 번호"
            value={senderNumber}
            onChange={setSenderNumber}
            mono
          />
          <LineFieldInput
            label="플러스친구 ID"
            value={pfid}
            onChange={setPfid}
            mono
          />
        </dl>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={m.isPending}
            onClick={() =>
              m.mutate({
                solapiSenderNumber: senderNumber || undefined,
                solapiPfid: pfid || undefined,
              })
            }
            className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending ? "저장 중..." : "저장 (SUPER_ADMIN)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab — 외부 통합
// ─────────────────────────────────────────────────────────────

function IntegrationTab({
  data,
  onMsg,
}: {
  data: SettingsBundle["external"];
  onMsg: (ok: boolean, msg: string) => void;
}) {
  const [mfdsEndpoint, setMfdsEndpoint] = useState(data?.mfdsEndpoint ?? "");
  const [clovaUrl, setClovaUrl] = useState(data?.clovaOcrInvokeUrl ?? "");

  const m = trpc.admin.settings.updateExternal.useMutation({
    onSuccess: () => onMsg(true, "외부 통합 설정 저장 완료"),
    onError: (e) => onMsg(false, e.message),
  });

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          외부 API endpoint (SUPER_ADMIN)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <LineFieldInput
            label="식약처 UDI endpoint"
            value={mfdsEndpoint}
            onChange={setMfdsEndpoint}
            mono
          />
          <LineFieldInput
            label="Clova OCR Invoke URL"
            value={clovaUrl}
            onChange={setClovaUrl}
            mono
          />
        </dl>
        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
          API 키는 .env.local 에서 관리합니다.
        </p>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={m.isPending}
            onClick={() =>
              m.mutate({
                mfdsEndpoint: mfdsEndpoint || undefined,
                clovaOcrInvokeUrl: clovaUrl || undefined,
              })
            }
            className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending ? "저장 중..." : "저장 (SUPER_ADMIN)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab — 보안
// ─────────────────────────────────────────────────────────────

function SecurityTab({
  data,
  onMsg,
}: {
  data: SettingsBundle["security"];
  onMsg: (ok: boolean, msg: string) => void;
}) {
  const [rateLimitLogin, setRateLimitLogin] = useState<number>(
    data?.rateLimitLogin ?? 5,
  );
  const [rateLimitApi, setRateLimitApi] = useState<number>(
    data?.rateLimitApi ?? 100,
  );
  const [rateLimitPayment, setRateLimitPayment] = useState<number>(
    data?.rateLimitPayment ?? 10,
  );
  const [sessionAdmin, setSessionAdmin] = useState<number>(
    data?.sessionTimeoutAdminDays ?? 12,
  );
  const [sessionUser, setSessionUser] = useState<number>(
    data?.sessionTimeoutUserDays ?? 30,
  );
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");

  const utils = trpc.useUtils();
  const m = trpc.admin.settings.updateSecurity.useMutation({
    onSuccess: () => onMsg(true, "보안 설정 저장 완료"),
    onError: (e) => onMsg(false, e.message),
  });
  const block = trpc.admin.settings.blockIp.useMutation({
    onSuccess: () => {
      onMsg(true, "IP 차단 추가 완료");
      setNewIp("");
      setNewReason("");
      utils.admin.settings.get.invalidate();
    },
    onError: (e) => onMsg(false, e.message),
  });
  const unblock = trpc.admin.settings.unblockIp.useMutation({
    onSuccess: () => {
      onMsg(true, "IP 차단 해제 완료");
      utils.admin.settings.get.invalidate();
    },
    onError: (e) => onMsg(false, e.message),
  });

  const blockedIps = data?.blockedIps ?? [];

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          Rate Limit (SUPER_ADMIN)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <EditableNumberField
            label="로그인 시도"
            value={rateLimitLogin}
            onChange={setRateLimitLogin}
            unit="회/분"
          />
          <EditableNumberField
            label="API 호출"
            value={rateLimitApi}
            onChange={setRateLimitApi}
            unit="회/분"
          />
          <EditableNumberField
            label="결제 시도"
            value={rateLimitPayment}
            onChange={setRateLimitPayment}
            unit="회/분"
          />
        </dl>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          세션 timeout (SUPER_ADMIN)
        </p>
        <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          <EditableNumberField
            label="운영자 세션"
            value={sessionAdmin}
            onChange={setSessionAdmin}
            unit="일"
          />
          <EditableNumberField
            label="병원·vendor 세션"
            value={sessionUser}
            onChange={setSessionUser}
            unit="일"
          />
        </dl>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={m.isPending}
            onClick={() =>
              m.mutate({
                rateLimitLogin,
                rateLimitApi,
                rateLimitPayment,
                sessionTimeoutAdminDays: sessionAdmin,
                sessionTimeoutUserDays: sessionUser,
              })
            }
            className="inline-flex h-9 items-center rounded-full bg-[var(--color-accent)] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending ? "저장 중..." : "저장 (SUPER_ADMIN)"}
          </button>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          차단 IP ({blockedIps.length}개)
        </p>
        {blockedIps.length === 0 ? (
          <p className="mt-3 border-y border-[var(--color-border-light)] py-6 text-center text-xs text-[var(--color-text-secondary)]">
            차단된 IP가 없습니다
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
            {blockedIps.map((ip) => (
              <li
                key={ip}
                className="grid grid-cols-[200px_1fr_60px] items-center gap-4 px-2 py-2.5"
              >
                <span className="font-mono text-xs tabular-nums text-[var(--color-error)]">
                  {ip}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  차단됨
                </span>
                <button
                  type="button"
                  onClick={() => unblock.mutate({ ip })}
                  disabled={unblock.isPending}
                  className="justify-self-end text-xs font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                >
                  해제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="IP 추가 (CIDR 지원)"
            className="h-8 flex-1 border-b border-[var(--color-border-light)] bg-transparent font-mono text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="사유 (선택)"
            className="h-8 flex-1 border-b border-[var(--color-border-light)] bg-transparent text-xs placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="button"
            disabled={block.isPending || !newIp.trim()}
            onClick={() =>
              block.mutate({ ip: newIp.trim(), reason: newReason.trim() || undefined })
            }
            className="inline-flex h-8 items-center rounded-full border border-[var(--color-border-light)] px-3 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            + 추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Field primitives
// ─────────────────────────────────────────────────────────────

function LineFieldInput({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4 px-2 py-3.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-7 w-full bg-transparent text-sm focus:outline-none ${
            mono ? "font-mono tabular-nums" : ""
          }`}
        />
      </dd>
    </div>
  );
}

function LineFieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4 px-2 py-3.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 bg-transparent text-sm focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </dd>
    </div>
  );
}

function ReadOnlyMasked({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4 px-2 py-3.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd>
        <input
          type="text"
          value={value}
          readOnly
          className="h-7 w-full bg-transparent font-mono text-sm tabular-nums text-[var(--color-text-secondary)] focus:outline-none"
        />
      </dd>
    </div>
  );
}

function ToggleField({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="grid cursor-pointer grid-cols-[200px_1fr_60px] items-center gap-4 px-2 py-3.5">
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      <span className="text-xs text-[var(--color-text-tertiary)]">{hint}</span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="justify-self-end accent-[var(--color-accent)]"
      />
    </label>
  );
}

function EditableNumberField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4 px-2 py-3.5">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className="flex items-baseline gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-7 w-24 bg-transparent text-right font-mono text-sm tabular-nums focus:outline-none"
        />
        {unit && (
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
      </dd>
    </div>
  );
}

