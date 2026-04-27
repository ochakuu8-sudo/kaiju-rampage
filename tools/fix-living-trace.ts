/**
 * tools/fix-living-trace.ts
 *
 * L3 警告 (cluster に livingTrace が無い) を解消する。
 * 各 cluster の cell 範囲内にある最初の TRACE_TYPE furniture を見つけ、
 * livingTrace: { kind: 'f', i: N } を cluster 宣言に追加する。
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { STAGES, type RawChunkBody, type SemanticCluster } from '../src/stages';

const STAGES_PATH = '/home/user/kaiju-rampage/src/stages.ts';

const TRACE_TYPES = new Set([
  'laundry_pole', 'laundry_balcony', 'garbage', 'bicycle', 'bicycle_row',
  'potted_plant', 'cat', 'mailbox', 'flower_planter_row',
]);

const cellOf = (dx: number, dy: number): 'NW' | 'NE' | 'SW' | 'SE' =>
  dy < 100 ? (dx < 0 ? 'NW' : 'NE') : (dx < 0 ? 'SW' : 'SE');

// セル境界判定 (merged は全セルに該当)
const inCell = (dx: number, dy: number, cell: string): boolean => {
  if (cell === 'merged') return true;
  return cellOf(dx, dy) === cell;
};

let src = fs.readFileSync(STAGES_PATH, 'utf8');

interface Patch {
  chunk: number;
  clusterId: string;
  traceIdx: number;
  traceType: string;
  traceDx: number;
  traceDy: number;
}

const patches: Patch[] = [];

const stage1 = STAGES[0];
for (let chunkId = 0; chunkId < stage1.templates.length; chunkId++) {
  const tmpl = stage1.templates[chunkId];
  if (!tmpl.raw?.clusters) continue;
  for (const c of tmpl.raw.clusters) {
    if (c.livingTrace) continue;  // already has trace
    // find first TRACE_TYPE furniture in this cell
    const furniture = tmpl.raw.furniture;
    let foundIdx = -1;
    for (let i = 0; i < furniture.length; i++) {
      const f = furniture[i];
      if (TRACE_TYPES.has(f.type) && inCell(f.dx, f.dy, c.cell)) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx < 0) {
      console.log(`  [SKIP] Ch${chunkId} '${c.id}' (cell=${c.cell}): no TRACE_TYPE furniture found`);
      continue;
    }
    patches.push({
      chunk: chunkId,
      clusterId: c.id,
      traceIdx: foundIdx,
      traceType: furniture[foundIdx].type,
      traceDx: furniture[foundIdx].dx,
      traceDy: furniture[foundIdx].dy,
    });
  }
}

console.log(`${patches.length} 件の livingTrace 補完候補:`);
patches.forEach(p => console.log(
  `  Ch${p.chunk} ${p.clusterId} → ${p.traceType}[${p.traceIdx}] @(${p.traceDx},${p.traceDy})`));

// 各 cluster 宣言に livingTrace を注入
// パターン: 各 cluster は { id: 'CLUSTER_ID', ... } の object literal
// その中の closing },\n を見つけて手前に livingTrace 行を挿入する
let applied = 0;
for (const p of patches) {
  // cluster の id 行を探す
  const idLine = `id: '${p.clusterId}'`;
  const idIdx = src.indexOf(idLine);
  if (idIdx < 0) { console.log(`  [SKIP-NOID] ${p.clusterId}`); continue; }
  // この cluster の終端 `},` を探す
  // 注: cluster の中に他の {} はない (Ref は { kind, i } のオブジェクトだが、
  //     最後の `},` は cluster 自体の終端)
  // 簡単な heuristic: idIdx から最初の },\n      { を探す (次のクラスタ開始)
  //                   または },\n    ], を探す (clusters 配列の終端)
  let depth = 0;
  let i = idIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      if (depth === 0) break;
      depth--;
    }
    i++;
  }
  // i は cluster の閉じ } の位置
  if (i >= src.length) { console.log(`  [SKIP-NOEND] ${p.clusterId}`); continue; }
  // } の直前に livingTrace 行を挿入
  // インデントを取得 (} の行頭からインデントを推定)
  // 実装簡単化: 6 スペースインデント固定 (既存と同じ)
  const insertion = `        livingTrace: { kind: 'f', i: ${p.traceIdx} },     // ${p.traceType} (${p.traceDx},${p.traceDy})\n      `;
  src = src.slice(0, i) + insertion + src.slice(i);
  applied++;
}

fs.writeFileSync(STAGES_PATH, src);
console.log(`\n結果: ${applied}/${patches.length} 件適用`);
