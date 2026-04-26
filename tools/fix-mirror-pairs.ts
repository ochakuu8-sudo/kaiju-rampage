/**
 * tools/fix-mirror-pairs.ts (v2)
 *
 * `npm run lint:placement` の L5 警告を読み、各 mirror pair の片側を
 * 3 px シフトして鏡像対称を解消する (§6 「2-5 px ずらす」原則)。
 *
 * v2: チャンクごとに置換範囲を限定して NONUNIQUE スキップを回避。
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

const STAGES_PATH = '/home/user/kaiju-rampage/src/stages.ts';

interface MirrorPair {
  chunk: number;
  type: string;
  x1: number; y1: number;
  x2: number; y2: number;
}

let lintOutput: string;
try {
  lintOutput = execSync('npm run lint:placement', {
    cwd: '/home/user/kaiju-rampage',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (e: any) {
  lintOutput = (e.stdout || '') + (e.stderr || '');
}

const re = /\[L5\] Ch(\d+): '([^']+)' mirror pair: \((-?\d+),(-?\d+)\) ↔ \((-?\d+),(-?\d+)\)/;
const pairs: MirrorPair[] = [];
for (const line of lintOutput.split('\n')) {
  const m = line.match(re);
  if (!m) continue;
  pairs.push({
    chunk: parseInt(m[1], 10),
    type: m[2],
    x1: parseInt(m[3], 10), y1: parseInt(m[4], 10),
    x2: parseInt(m[5], 10), y2: parseInt(m[6], 10),
  });
}
console.log(`L5 警告 ${pairs.length} 件を取得`);

let src = fs.readFileSync(STAGES_PATH, 'utf8');

// チャンクごとの範囲を特定する: ChN 開始 = `// ── S1-ChN:` の行頭、
// 終端 = 次の `// ── S1-Ch(N+1):` または Stage 2 開始
function chunkRange(chunkId: number): { start: number; end: number } | null {
  const startMarker = `// ── S1-Ch${chunkId}:`;
  const startIdx = src.indexOf(startMarker);
  if (startIdx < 0) return null;
  // 次のチャンクマーカーを探す (ChN+1, ChN+2, ... を順に)
  let endIdx = src.length;
  for (let next = chunkId + 1; next <= 20; next++) {
    const nextMarker = `// ── S1-Ch${next}:`;
    const nextIdx = src.indexOf(nextMarker);
    if (nextIdx > startIdx) { endIdx = nextIdx; break; }
  }
  // Stage 2 への切り替え (s2_raw が出てくるところ)
  const s2Idx = src.indexOf("'s2_raw'", startIdx);
  if (s2Idx > 0 && s2Idx < endIdx) endIdx = s2Idx;
  return { start: startIdx, end: endIdx };
}

let fixed = 0;
let skipped = 0;
const skipDetails: string[] = [];

// pairs を chunk 単位でグループ化、chunk ごとに処理
const byChunk: Map<number, MirrorPair[]> = new Map();
for (const p of pairs) {
  if (!byChunk.has(p.chunk)) byChunk.set(p.chunk, []);
  byChunk.get(p.chunk)!.push(p);
}

for (const [chunkId, chunkPairs] of byChunk) {
  // 重要: src を変更すると range も動くので、毎回 range を再計算する
  for (const p of chunkPairs) {
    const range = chunkRange(chunkId);
    if (!range) { skipped++; skipDetails.push(`Ch${chunkId} range not found`); continue; }
    const region = src.slice(range.start, range.end);

    // 右側 (大きい X 側) をシフト対象にする
    let target: { x: number; y: number };
    let newX: number;
    if (p.x1 > 0 && p.x2 < 0) { target = { x: p.x1, y: p.y1 }; newX = p.x1 - 3; }
    else if (p.x2 > 0 && p.x1 < 0) { target = { x: p.x2, y: p.y2 }; newX = p.x2 - 3; }
    else if (p.x1 > 0 && p.x2 > 0) { target = { x: Math.max(p.x1, p.x2), y: p.y1 }; newX = target.x - 3; }
    else { target = { x: Math.min(p.x1, p.x2), y: p.y1 }; newX = target.x + 3; }

    const patterns = [
      { from: `_F('${p.type}', ${target.x}, ${target.y})`, to: `_F('${p.type}', ${newX}, ${target.y})` },
      { from: `$F(out, '${p.type}', ${target.x}, ${target.y})`, to: `$F(out, '${p.type}', ${newX}, ${target.y})` },
    ];

    let applied = false;
    for (const pat of patterns) {
      const localIdx = region.indexOf(pat.from);
      if (localIdx < 0) continue;
      // チャンク範囲内でユニーク確認
      if (region.indexOf(pat.from, localIdx + 1) >= 0) {
        skipDetails.push(`Ch${chunkId} ${pat.from} not unique in chunk`);
        continue;
      }
      // 全体 src への絶対 index
      const absIdx = range.start + localIdx;
      src = src.slice(0, absIdx) + pat.to + src.slice(absIdx + pat.from.length);
      applied = true;
      break;
    }
    if (applied) fixed++;
    else { skipped++; skipDetails.push(`Ch${chunkId} '${p.type}' @(${target.x},${target.y}) not found`); }
  }
}

fs.writeFileSync(STAGES_PATH, src);
console.log(`\n結果: ${fixed} 件修正、${skipped} 件スキップ`);
if (skipDetails.length > 0 && skipDetails.length < 50) {
  console.log('\n--- スキップ詳細 ---');
  skipDetails.forEach(s => console.log(`  ${s}`));
}
