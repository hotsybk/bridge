import type { Metadata } from "next";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { pretendard } from "@/lib/fonts";
import { TRPCProvider } from "@/lib/trpc/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedPlace — 병원 운영의 모든 것, 한 곳에서",
  description:
    "한국 의료기관과 의료기기·소모품 공급업체를 연결하는 멀티벤더 B2B 마켓플레이스",
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
        <AuthProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
