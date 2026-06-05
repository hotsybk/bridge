import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { pretendard } from "@/lib/fonts";
import { TRPCProvider } from "@/lib/trpc/client";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider } from "@/lib/posthog/provider";
import "./globals.css";

/**
 * Phase ν-2 — root layout 메타 강화.
 *
 * - viewport: mobile safe-area + initialScale.
 * - metadata: metadataBase + title template + OG/Twitter 풀 셋업.
 * - PostHogProvider: KEY 미설정 시 silent skip.
 *
 * 페이지별 metadata 는 각 page.tsx 에서 export.
 */

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0066CC",
  // iOS 가상 키보드 활성화 시 viewport 가 키보드 위로 축소되어
  // sticky bottom input(dispute thread 등) 이 키보드에 가려지지 않게 한다.
  interactiveWidget: "resizes-content",
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://medplace.kr";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "MedPlace — 한국 의료 B2B 마켓플레이스",
    template: "%s | MedPlace",
  },
  description:
    "한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스. 발주 자동화 · 정기구독 · 공동구매 · UDI 자동보고.",
  applicationName: "MedPlace",
  authors: [{ name: "MedPlace" }],
  generator: "Next.js",
  keywords: [
    "의료 B2B",
    "의료기기 마켓플레이스",
    "병원 발주",
    "의료 소모품",
    "UDI 보고",
    "정기구독 발주",
    "공동구매",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: BASE_URL,
    siteName: "MedPlace",
    title: "MedPlace — 한국 의료 B2B 마켓플레이스",
    description:
      "한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MedPlace",
    description:
      "한국 의료기관과 의료기기·소모품 공급업체를 직접 연결하는 멀티벤더 B2B 마켓플레이스.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* a11y: Skip-to-content — Tab 키로 첫 포커스 시 노출 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
        >
          본문으로 건너뛰기
        </a>
        <AuthProvider>
          <TRPCProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </TRPCProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
