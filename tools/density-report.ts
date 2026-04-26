/**
 * tools/density-report.ts
 * Stage 2 各チャンクの密度（建物・家具・人・地面）を表示
 */
import { STAGES } from '../src/stages';

const argStage = process.argv.find(a => a.startsWith('--stage='));
const stageIdx = argStage ? parseInt(argStage.split('=')[1], 10) : 1;
const stage = STAGES[stageIdx];

console.log(`\n═══ Stage ${stageIdx + 1} (${stage.name}) 密度レポート ═══`);
console.log(`${'Ch'.padEnd(4)}${'B'.padEnd(5)}${'F'.padEnd(6)}${'H'.padEnd(5)}${'G'.padEnd(5)}${'C'.padEnd(5)}`);
console.log('─'.repeat(34));
let totalB = 0, totalF = 0, totalH = 0, totalG = 0, totalC = 0;
for (let i = 0; i < stage.templates.length; i++) {
  const r = stage.templates[i].raw;
  if (!r) continue;
  const b = r.buildings.length;
  const f = r.furniture.length;
  const h = r.humans.length;
  const g = r.grounds.length;
  const c = r.clusters?.length ?? 0;
  totalB += b; totalF += f; totalH += h; totalG += g; totalC += c;
  console.log(`Ch${i.toString().padEnd(2)} ${b.toString().padEnd(4)} ${f.toString().padEnd(5)} ${h.toString().padEnd(4)} ${g.toString().padEnd(4)} ${c.toString().padEnd(4)}`);
}
console.log('─'.repeat(34));
console.log(`合計 ${totalB.toString().padEnd(4)} ${totalF.toString().padEnd(5)} ${totalH.toString().padEnd(4)} ${totalG.toString().padEnd(4)} ${totalC.toString().padEnd(4)}`);
console.log(`平均 ${(totalB/12).toFixed(1).padEnd(4)} ${(totalF/12).toFixed(1).padEnd(5)} ${(totalH/12).toFixed(1).padEnd(4)} ${(totalG/12).toFixed(1).padEnd(4)} ${(totalC/12).toFixed(1).padEnd(4)}`);
console.log(`\n指示書 v1.0 密度目安: B 20-30 / F 80-120 / H 10-22 / G 5-8`);
