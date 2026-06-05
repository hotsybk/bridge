/**
 * Wave AB — E2E 통합 런처
 *
 * 모든 e2e 스크립트를 순차 실행 + 통합 보고.
 */

import { execSync } from "node:child_process";

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m",
};

const scripts = [
  "e2e-buyer-flow",
  "e2e-vendor-flow",
  "e2e-groupbuy-flow",
  "e2e-dispute-flow",
];

let total = 0;
let passed = 0;
let failed = 0;
const errors: string[] = [];

for (const s of scripts) {
  console.log(`\n${C.bold}${C.cyan}>>> Running ${s}...${C.reset}\n`);
  total++;
  try {
    execSync(`npx tsx scripts/${s}.ts`, { stdio: "inherit" });
    passed++;
  } catch (err) {
    failed++;
    errors.push(s);
  }
}

console.log(`\n${C.bold}=== E2E 통합 결과 ===${C.reset}`);
console.log(`${C.green}통과 ${passed}${C.reset} / ${C.red}실패 ${failed}${C.reset} (총 ${total}개)`);
if (errors.length > 0) {
  console.log(`\n${C.red}실패 스크립트:${C.reset}`);
  errors.forEach((e) => console.log(`  - ${e}`));
}
process.exit(failed > 0 ? 1 : 0);
