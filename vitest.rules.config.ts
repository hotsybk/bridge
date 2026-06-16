import { defineConfig } from "vitest/config";

// Σ-2 — Firestore Security Rules 테스트 전용 vitest 설정.
// @firebase/rules-unit-testing 은 Firestore 에뮬레이터(8080)가 떠 있어야 동작.
// 실행: firebase emulators:exec --only firestore "pnpm test:rules"
//   또는 CI 의 firebase-emulator 잡 안에서.
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // 에뮬레이터 공유 상태 → 순차 실행 (병렬 시 데이터 충돌)
    fileParallelism: false,
  },
});
