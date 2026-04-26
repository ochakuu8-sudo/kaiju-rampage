/**
 * tools/trim-stage-2-aggressive.ts
 *
 * Stage 2 v2.0 → v2.1 (Stage 1 流の清涼さへ):
 *   - 各業種で sign_board / chouchin / noren / a_frame_sign / shop_awning が
 *     重複している場合、優先度順に 2-3 個に絞る
 *   - puddle_reflection の散在を per-chunk 3 個までに
 *   - ac_unit 多重置きを 1 ロット 1-2 個に
 *   - cable_junction_box / electric_box を 1-2 個に
 *   - milk_crate_stack / dumpster / recycling_bin の重複を間引く
 *
 * 目標: 各チャンクの家具を ~99 → ~70 に削減
 */
import * as fs from 'fs';

const STAGES_PATH = '/home/user/kaiju-rampage/src/stages.ts';
let src = fs.readFileSync(STAGES_PATH, 'utf8');

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
    const s3Idx = src.indexOf("'s3_raw'", startIdx);
    if (s3Idx > 0 && s3Idx < endIdx) endIdx = s3Idx;

    const before = src.slice(0, startIdx);
    const chunk = src.slice(startIdx, endIdx);
    const after = src.slice(endIdx);
    src = before + transform(chunk, n) + after;
  }
}

// 全チャンク共通: puddle / cable_junction / ac_outdoor / electric_box / dumpster の
// 「3 個以上ある場合 N 個目以降を削除」する間引き処理
function trimByCount(chunk: string, type: string, max: number): string {
  // 該当行を全て見つける
  const re = new RegExp(`^[\\s]*\\$F\\(out, '${type}',[^)]*\\);.*$`, 'mg');
  const matches = chunk.match(re) || [];
  if (matches.length <= max) return chunk;
  // 後ろから (N - max) 個削除
  const toRemove = matches.slice(max);
  let result = chunk;
  for (const line of toRemove) {
    result = result.replace(line + '\n', '');
  }
  return result;
}

// facade 重複削減: 同じ x 座標近傍 (±5 px) で 3 種類以上の facade デコがある場合、
// chouchin と shop_awning を優先削除 (sign_board と noren を残す)
function trimFacadeRedundancy(chunk: string): string {
  // 簡易: shop_awning の数を 1/3 削減 (3 個目以降残し最初の 2 個削除)
  // と chouchin の facade 帯 (y=22, y=110-128, y=58-65) の重複削減
  // 実装簡易化: 一律 shop_awning と secondary chouchin を間引く
  // shop_awning ≥ 4 個ある場合 4 個目以降削除
  let result = chunk;
  result = trimByCount(result, 'shop_awning', 3);
  // chouchin: 多くなりがち。chunk 全体で 12 個 (上空 4 + facade 8) 程度に抑える
  result = trimByCount(result, 'chouchin', 12);
  return result;
}

// 連続軸の重複削減
function trimConnective(chunk: string): string {
  let result = chunk;
  result = trimByCount(result, 'puddle_reflection', 4);  // chunk あたり 4 個まで
  result = trimByCount(result, 'cable_junction_box', 3);
  result = trimByCount(result, 'electric_box', 2);
  result = trimByCount(result, 'ac_outdoor_cluster', 3);
  result = trimByCount(result, 'recycling_bin', 4);
  result = trimByCount(result, 'dumpster', 2);
  result = trimByCount(result, 'milk_crate_stack', 3);
  result = trimByCount(result, 'vending', 4);
  result = trimByCount(result, 'newspaper_stand', 2);
  result = trimByCount(result, 'ac_unit', 8);
  result = trimByCount(result, 'flag_pole', 5);
  result = trimByCount(result, 'a_frame_sign', 6);
  // 連続改行整理
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

applyToS2Chunks((c) => trimFacadeRedundancy(trimConnective(c)));

// より攻め: 各チャンクの sign_board / chouchin / puddle / a_frame_sign を
// Stage 1 並みの密度に
function trimAggressive(chunk: string, chunkId: number): string {
  let result = chunk;
  // chouchin 全体を 8 個に (Stage 1 sakura は 5 個程度)
  result = trimByCount(result, 'chouchin', 8);
  // sign_board は 6 個まで
  result = trimByCount(result, 'sign_board', 6);
  // a_frame_sign は 4 個まで
  result = trimByCount(result, 'a_frame_sign', 4);
  // puddle_reflection は 3 個まで
  result = trimByCount(result, 'puddle_reflection', 3);
  // noren は 5 個まで
  result = trimByCount(result, 'noren', 5);
  // bicycle 系は 3 個まで
  result = trimByCount(result, 'bicycle', 3);
  result = trimByCount(result, 'bicycle_rack', 3);
  // mailbox は 5 個まで
  result = trimByCount(result, 'mailbox', 5);
  // potted_plant は 3 個まで
  result = trimByCount(result, 'potted_plant', 3);
  // garbage / recycling は控えめに
  result = trimByCount(result, 'garbage', 3);
  result = trimByCount(result, 'recycling_bin', 2);
  // cat は 4 個まで (Stage 1 並み)
  result = trimByCount(result, 'cat', 4);
  // 連続改行整理
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

applyToS2Chunks(trimAggressive);

fs.writeFileSync(STAGES_PATH, src);
console.log('Stage 2 を v2.1 整理版に削減しました');
