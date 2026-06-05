import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "결제",
  description: "MedPlace 안전결제. 주문을 최종 확인하고 결제를 완료하세요.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
