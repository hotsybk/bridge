import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
  description: "MedPlace 계정으로 로그인하세요.",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
