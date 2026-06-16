import Link from "next/link";

/**
 * 마케팅·auth 공용 미니 footer — Phase δ-2.
 *
 * 디자인 DNA:
 *  - 박스 없음, 라인 only
 *  - 3-column 그리드 (워드마크 / 서비스 / 법적)
 *  - 사업자 정보 정식 등록 전까지는 예시 표기
 */
export function MinimalFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--color-border-light)]">
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* 좌측: 워드마크 + 사업자 정보 */}
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em]">
              MedPlace
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
              한국 의료기관과 공급업체를 잇는 B2B 마켓플레이스
            </p>
            <p className="mt-4 break-keep text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
              상호: (주)메드플레이스 (예시) · 통신판매업: 2026-서울-XXXX (예시)
            </p>
          </div>

          {/* 중앙: 서비스 */}
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              서비스
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                >
                  소개
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                >
                  수수료
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                >
                  지원
                </Link>
              </li>
            </ul>
          </div>

          {/* 우측: 법적 */}
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              법적 고지
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/legal/terms"
                  className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/marketplace"
                  className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                >
                  통신판매중개 약관
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--color-border-light)] pt-6">
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            © 2026 MedPlace. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
