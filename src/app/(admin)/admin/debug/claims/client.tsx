"use client";

// Wave V — 토큰 클레임 뷰어.
// Firebase Auth client SDK 의 currentUser.getIdTokenResult() 로 claims raw JSON 노출.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, KeyRound, RefreshCw } from "lucide-react";

import { auth } from "@/lib/firebase/client";

type ClaimsSnapshot = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  providerId: string;
  issuedAtTime: string;
  expirationTime: string;
  authTime: string;
  claims: Record<string, unknown>;
} | null;

export function ClaimsClient() {
  const [snap, setSnap] = useState<ClaimsSnapshot>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(forceRefresh = false) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setSnap(null);
        setErrorMsg("로그인된 사용자가 없습니다.");
        return;
      }
      const result = await user.getIdTokenResult(forceRefresh);
      setSnap({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        providerId: user.providerData[0]?.providerId ?? "unknown",
        issuedAtTime: result.issuedAtTime,
        expirationTime: result.expirationTime,
        authTime: result.authTime,
        claims: result.claims as Record<string, unknown>,
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => {
      load(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="px-8 py-10 md:px-12 md:py-14">
      <Link
        href="/admin/debug"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        디버그 도구
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <KeyRound className="mt-1 h-5 w-5 text-[var(--color-accent)]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
            디버그 · 토큰
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
            토큰 클레임 뷰어
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            현재 로그인 사용자의 Firebase Auth ID Token Custom Claims 원본.
          </p>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border-light)] px-3 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          토큰 강제 갱신
        </button>
      </div>

      {errorMsg && (
        <div className="mt-6 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-xs text-[var(--color-error)]">
          {errorMsg}
        </div>
      )}

      {snap && (
        <div className="mt-6 space-y-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              사용자 메타
            </p>
            <dl className="mt-3 divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
              <Row label="uid" value={snap.uid} mono />
              <Row label="email" value={snap.email ?? "—"} mono />
              <Row label="emailVerified" value={String(snap.emailVerified)} mono />
              <Row label="displayName" value={snap.displayName ?? "—"} />
              <Row label="providerId" value={snap.providerId} mono />
              <Row label="issuedAtTime" value={snap.issuedAtTime} mono />
              <Row label="expirationTime" value={snap.expirationTime} mono />
              <Row label="authTime" value={snap.authTime} mono />
            </dl>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Custom Claims
            </p>
            <pre className="mt-3 max-h-[400px] overflow-auto rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-4 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(snap.claims, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4 px-2 py-3">
      <dt className="text-xs text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={`text-xs text-[var(--color-text-primary)] ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
