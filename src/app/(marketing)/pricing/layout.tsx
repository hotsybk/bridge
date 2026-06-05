import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "요금",
  description: "MedPlace 의 단순한 거래 수수료 5% 와 절감액을 직접 계산해 보세요.",
  openGraph: {
    title: "MedPlace 요금 — 거래 수수료 5%",
    description:
      "가입비 0원 · 의무 약정 0원. 단일 거래 수수료 5% 로 운영합니다.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
