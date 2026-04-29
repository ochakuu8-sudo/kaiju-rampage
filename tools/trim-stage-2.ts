/**
 * tools/trim-stage-2.ts
 *
 * Stage 2 v2.0 から視覚的ノイズを削減 (v2.1 整理版):
 *   - 連続軸の chouchin/manhole/puddle/bollard を間引く
 *   - 各 facade で sign_board + chouchin + noren が並んでいたら chouchin を削る
 *   - 重複 ac_unit, ac_outdoor_cluster を間引く
 *   - cable_junction_box / electric_box の数を減らす
 *   - 小さな ground patches を統合 (今回は対象外、家具のみ)
 *
 * 目標: 各チャンクの家具を ~110 → ~75 に削減
 */
import * as fs from 'fs';

const STAGES_PATH = '/home/user/kaiju-rampage/src/stages.ts';
let src = fs.readFileSync(STAGES_PATH, 'utf8');

// 各 Stage 2 チャンクの範囲を取得し、その中で削減を適用
function applyToS2Chunks(transform: (chunkSrc: string, chunkId: number) => string): void {
  for (let n = 0; n < 12; n++) {
    const startMarker = `// ── S2-Ch${n}:`;
    const startIdx = src.indexOf(startMarker);
    if (startIdx < 0) continue;
    let endIdx = src.length;
    for (let next = n + 1; next <= 15; next++) {
      const nextMarker = `// ── S2-Ch${next}:`;
      const nextIdx = src.indexOf(nextMarker);
      if (nextIdx > startIdx) { endIdx = nextIdx; break; }
    }
    // s3_raw 開始も終端の候補
    const s3Idx = src.indexOf("'s3_raw'", startIdx);
    if (s3Idx > 0 && s3Idx < endIdx) endIdx = s3Idx;

    const before = src.slice(0, startIdx);
    const chunk = src.slice(startIdx, endIdx);
    const after = src.slice(endIdx);
    const transformed = transform(chunk, n);
    src = before + transformed + after;
  }
}

// 削減対象の家具行 (連続軸の重複を間引く)
const TRIM_PATTERNS = [
  // chouchin 上空帯 (avenue): 6 → 4 (-30, 30 を削除)
  /^\s*\$F\(out, 'chouchin', -30, 15\);.*$/m,
  /^\s*\$F\(out, 'chouchin', 30, 15\);.*$/m,
  // street_lamp avenue 上下4本 → 2本 (y=88 のみ残し y=108 削除)
  /^\s*\$F\(out, 'street_lamp', -90, 108\);.*$/m,
  /^\s*\$F\(out, 'street_lamp', 87, 108\);.*$/m,
  // bollard 上下 → 1段のみ (-40, 40 の y=108 削除)
  /^\s*\$F\(out, 'bollard', -40, 108\);.*$/m,
  /^\s*\$F\(out, 'bollard', 40, 108\);.*$/m,
  // manhole_cover 5個 → 3個 (-60 / +60 削除)
  /^\s*\$F\(out, 'manhole_cover', -60, 100\);.*$/m,
  /^\s*\$F\(out, 'manhole_cover', 60, 100\);.*$/m,
  // puddle_reflection avenue 中央 (重複) → 削除
  /^\s*\$F\(out, 'puddle_reflection', -45, 95\);.*$/m,
  /^\s*\$F\(out, 'puddle_reflection', 45, 105\);.*$/m,
];

// puddle_reflection の散在を間引く: 「puddle_reflection」の重複行を 1 件目以外削除
function trimDuplicateNoise(chunk: string): string {
  let result = chunk;
  // パターン削除
  for (const pat of TRIM_PATTERNS) {
    result = result.replace(pat, '');
  }
  // 連続改行を 1 つに
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

applyToS2Chunks(trimDuplicateNoise);

fs.writeFileSync(STAGES_PATH, src);
console.log('Stage 2 連続軸の重複を削減しました');
