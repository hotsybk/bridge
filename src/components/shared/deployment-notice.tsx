"use client";

import { useEffect } from "react";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

/**
 * 새 배포 감지 알림.
 *
 * Vercel이 자동 주입하는 `VERCEL_GIT_COMMIT_SHA`를 사용해
 * 사용자가 처음 보는 빌드일 때 toast로 안내.
 *
 * - 이미 본 commit이면 표시 안 함 (localStorage)
 * - dev 환경 또는 commit 정보 없으면 표시 안 함
 * - 1회 표시 후 자동 dismiss
 */
export function DeploymentNotice() {
  useEffect(() => {
    const commit = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    if (!commit) return; // dev 또는 미주입

    const STORAGE_KEY = "medplace_last_deployment";
    const lastSeen = window.localStorage.getItem(STORAGE_KEY);

    // 처음 본 commit이면 알림
    if (lastSeen !== commit) {
      const shortSha = commit.slice(0, 7);
      const buildTime = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE
        ? `: ${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE.split("\n")[0].slice(0, 40)}`
        : "";

      // 첫 마운트 직후 살짝 뒤에 표시 (페이지 hydration 부담 회피)
      const id = window.setTimeout(() => {
        toast(
          `새 버전이 배포되었습니다 (${shortSha})`,
          {
            description: buildTime || "최신 디자인·기능이 반영되었어요.",
            icon: <Rocket className="h-4 w-4" />,
            duration: 6000,
            action: {
              label: "확인",
              onClick: () => window.localStorage.setItem(STORAGE_KEY, commit),
            },
          },
        );
        // 확인 클릭 안 해도 자동 마킹 (한 번만 알림)
        window.localStorage.setItem(STORAGE_KEY, commit);
      }, 800);

      return () => window.clearTimeout(id);
    }
  }, []);

  return null;
}
