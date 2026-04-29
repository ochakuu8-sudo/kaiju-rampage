/**
 * tools/self-check-specs.ts
 * Stage 2-5 の指示書が Stage 1 と同じ §9 フォーマットに準拠しているか検証。
 * 各 chunk について以下の項目があるか確認:
 *   1. ヒーロー / アンビエント (header)
 *   2. 焦点 4 層 (焦点 / 取り巻き / 境界 / 動線)
 *   3. アンビエント (NW/NE/SW/SE のセル)
 *   4. 取り巻き 3 パターン (facade 沿い / 焦点囲み / 歩道沿い)
 *   5. 人配置
 *   6. 地面パッチ
 *   7. 道路
 *   8. 生活の痕跡 / スケール / 向き
 *   9. Handoff
 */
import * as fs from 'fs';

const SPECS = [
  { name: 'Stage 1', path: '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 1 街レイアウト v6 1 整合性アップデート版 9876eb7e8fc34a538afbf278edbf3460.md' },
  { name: 'Stage 2 v2.0', path: '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 2 街レイアウト v2 0 品質保証フォーマット版 e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.md' },
  { name: 'Stage 3', path: '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 3 街レイアウト v1 1 Stage1形式準拠版 b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7.md' },
  { name: 'Stage 4', path: '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 4 街レイアウト v1 1 Stage1形式準拠版 c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8.md' },
  { name: 'Stage 5', path: '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 5 街レイアウト v1 1 Stage1形式準拠版 d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9.md' },
];

// Stage 1 形式と互換のある寛容な正規表現
const REQUIRED_SECTIONS = [
  // ヒーロー割当: 「ヒーロー / アンビエント」 OR 「ヒーロー」 (どちらも許容)
  { name: 'ヒーロー割当 header', pattern: /\*\*(ヒーロー\s*[\/／]\s*アンビエント|ヒーロー)\*\*/ },
  { name: '焦点 (focal)', pattern: /\*\*焦点[^*]{0,40}\*\*/ },
  { name: '取り巻き (companions)', pattern: /\*\*取り巻き[（(\s\*]/ },
  { name: '境界 (boundary)', pattern: /\*\*境界[\s\*]/ },
  { name: '動線 (access)', pattern: /\*\*動線[\s\*]/ },
  // アンビエント: 「3 セル」「2 セル」「単独」「狭い」など全部許容
  { name: 'アンビエント (any form)', pattern: /\*\*アンビエント[^*]{0,40}\*\*/ },
  { name: '取り巻き 3 パターン', pattern: /\*\*取り巻き 3 パターン\*\*/ },
  { name: '人配置', pattern: /\*\*人配置\*\*/ },
  { name: '地面パッチ', pattern: /\*\*地面パッチ\*\*/ },
  { name: '道路', pattern: /\*\*道路\*\*/ },
  { name: '生活痕跡 / スケール / 向き', pattern: /\*\*生活の痕跡\s*[\/／]\s*スケール\s*[\/／]\s*向き\*\*/ },
  { name: 'Handoff', pattern: /\*\*Handoff/ },
];

interface ChunkResult {
  chunk: string;
  missing: string[];
}

interface SpecResult {
  name: string;
  totalChunks: number;
  chunkResults: ChunkResult[];
  totalMissing: number;
}

function checkSpec(spec: { name: string; path: string }): SpecResult {
  const src = fs.readFileSync(spec.path, 'utf8');
  const chunkPattern = /^### (Ch\d+:.+?)$/gm;
  const chunks: { name: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = chunkPattern.exec(src)) !== null) {
    chunks.push({ name: m[1], start: m.index });
  }

  const results: ChunkResult[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const start = chunks[i].start;
    const end = i + 1 < chunks.length ? chunks[i + 1].start : src.length;
    const chunkSlice = src.slice(start, end);
    const missing: string[] = [];
    for (const sec of REQUIRED_SECTIONS) {
      if (!sec.pattern.test(chunkSlice)) {
        missing.push(sec.name);
      }
    }
    results.push({ chunk: chunks[i].name, missing });
  }

  const totalMissing = results.reduce((s, r) => s + r.missing.length, 0);
  return { name: spec.name, totalChunks: chunks.length, chunkResults: results, totalMissing };
}

const results = SPECS.map(checkSpec);

console.log('═══ セルフチェック結果 ═══\n');
for (const r of results) {
  console.log(`【${r.name}】 chunks: ${r.totalChunks}, 不足項目合計: ${r.totalMissing}`);
  for (const cr of r.chunkResults) {
    if (cr.missing.length === 0) continue;
    console.log(`  ${cr.chunk}: 不足 [${cr.missing.join(', ')}]`);
  }
  console.log('');
}

console.log('\n═══ サマリ ═══');
console.log(`${'Stage'.padEnd(10)} ${'chunks'.padEnd(8)} ${'不足'.padEnd(6)} 状態`);
for (const r of results) {
  const status = r.totalMissing === 0 ? '✅ 完全準拠' : (r.totalMissing < 5 ? '⚠️ ほぼ準拠' : '❌ 要改善');
  console.log(`${r.name.padEnd(10)} ${r.totalChunks.toString().padEnd(8)} ${r.totalMissing.toString().padEnd(6)} ${status}`);
}
