import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입",
  description:
    "병원·의원 또는 공급업체로 MedPlace 에 가입하세요. 가입비 0원 · 의무 약정 0원.",
  robots: { index: true, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
