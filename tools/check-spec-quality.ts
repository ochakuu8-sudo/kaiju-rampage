/**
 * tools/check-spec-quality.ts
 * Stage 2 v2.0 品質保証フォーマット版の Quality Gate (Q1-Q15) を検証する。
 *
 * 検証対象: 各 §9.N セクションに含まれる paste-ready TS スケルトン
 *
 * Q1: hero cluster ≥1
 * Q2: ambient cluster ≥3
 * Q3: $B(...) 呼び出し ≥15
 * Q4: $F(...) 呼び出し ≥70
 * Q5: _H(...) 呼び出し ≥8
 * Q6: _G(...) 呼び出し ≥5
 * Q7: 各 ambient cluster に livingTrace フィールド
 * Q8: hero cluster に focal/companions/boundary/access 4 フィールド
 * Q9: $F(...) 呼び出し行に // コメント (意図) が 80% 以上
 * Q12: 12 chunks 中 ≥6 で部分幅 _HR(...) または horizontalRoads: [] を使う
 * Q15: verticalRoads に _AVE を含む
 */
import * as fs from 'fs';

const SPEC_PATH = '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 2 街レイアウト v2 0 品質保証フォーマット版 e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.md';

interface ChunkResult {
  id: string;
  errors: string[];
  warns: string[];
  metrics: {
    buildings: number;
    furniture: number;
    humans: number;
    grounds: number;
    heroClusters: number;
    ambientClusters: number;
    commentRatio: number;
    hasPartialHR: boolean;
    hasAve: boolean;
  };
}

function extractTSBlocks(src: string): { id: string; code: string }[] {
  // ## §9.N Ch{N}: ... 見出しの直後の ```ts ... ``` ブロック
  const sectionRe = /^## §9\.(\d+) Ch\d+:.+?$([\s\S]*?)(?=^## §9\.\d+|^# §10|\Z)/gm;
  const tsRe = /```ts\n([\s\S]*?)\n```/;
  const blocks: { id: string; code: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(src)) !== null) {
    const sectionContent = m[2];
    const tsMatch = tsRe.exec(sectionContent);
    if (tsMatch) {
      blocks.push({ id: `Ch${m[1]}`, code: tsMatch[1] });
    } else {
      blocks.push({ id: `Ch${m[1]}`, code: '' });
    }
  }
  return blocks;
}

function checkChunk(id: string, code: string): ChunkResult {
  const errors: string[] = [];
  const warns: string[] = [];

  // 数値メトリクス
  const buildings = (code.match(/\$B\(/g) ?? []).length;
  const furniture = (code.match(/\$F\(/g) ?? []).length;
  const humans = (code.match(/_H\(/g) ?? []).length;
  const grounds = (code.match(/_G\(/g) ?? []).length;
  // cluster 解析
  const heroClusterRe = /_CLUSTER\([^,]+,\s*\{[^}]*role:\s*'hero'/gs;
  const ambClusterRe = /_CLUSTER\([^,]+,\s*\{[^}]*role:\s*'ambient'/gs;
  const heroClusters = (code.match(heroClusterRe) ?? []).length;
  const ambientClusters = (code.match(ambClusterRe) ?? []).length;

  // $F 呼び出しのコメント比率
  const fLines = code.split('\n').filter(l => /\$F\(/.test(l));
  const fLinesWithComment = fLines.filter(l => /\/\/\s*\S+/.test(l));
  const commentRatio = fLines.length > 0 ? fLinesWithComment.length / fLines.length : 0;

  // 道路チェック (Q12: 道路の個性化 = 部分幅 _HR / _TOP_HR / 非中央 _VR / horizontalRoads: [])
  const hasPartialHR = /_HR\(\s*\d+\s*,\s*-?\d+\s*,\s*-?\d+/.test(code) ||  // 部分幅 _HR
                       /_TOP_HR/.test(code) ||                                // 上端 _TOP_HR
                       /_VR\(\s*-?\d+/.test(code) ||                          // 非中央 _VR (dx != 0)
                       /horizontalRoads:\s*\[\s*\]/.test(code);               // 横道路ゼロ
  const hasAve = /_AVE/.test(code);

  // hero cluster の 4 フィールド (Q8)
  const heroBlockMatch = code.match(/_CLUSTER\([^,]+,\s*\{[^}]*role:\s*'hero'[\s\S]*?\}\);/);
  if (heroBlockMatch) {
    const block = heroBlockMatch[0];
    const has = (k: string) => new RegExp(`\\b${k}:`).test(block);
    if (!has('focal'))      errors.push(`Q8: hero cluster に focal なし`);
    if (!has('companions')) errors.push(`Q8: hero cluster に companions なし`);
    if (!has('boundary'))   errors.push(`Q8: hero cluster に boundary なし`);
    if (!has('access'))     errors.push(`Q8: hero cluster に access なし`);
  }
  // ambient cluster に livingTrace (Q7)
  const ambBlocks = code.match(/_CLUSTER\([^,]+,\s*\{[^}]*role:\s*'ambient'[\s\S]*?\}\);/g) ?? [];
  for (let i = 0; i < ambBlocks.length; i++) {
    if (!/livingTrace:/.test(ambBlocks[i])) {
      errors.push(`Q7: ambient cluster #${i+1} に livingTrace なし`);
    }
  }

  // Q1-Q6
  if (heroClusters < 1) errors.push(`Q1: hero cluster ${heroClusters}/1`);
  if (ambientClusters < 3) errors.push(`Q2: ambient cluster ${ambientClusters}/3`);
  if (buildings < 15) errors.push(`Q3: buildings ${buildings}/15`);
  if (furniture < 70) errors.push(`Q4: furniture ${furniture}/70`);
  if (humans < 8) errors.push(`Q5: humans ${humans}/8`);
  if (grounds < 5) errors.push(`Q6: grounds ${grounds}/5`);
  // Q9
  if (commentRatio < 0.8) warns.push(`Q9: $F コメント率 ${(commentRatio*100).toFixed(0)}% (80% 推奨)`);
  // Q15
  if (!hasAve) errors.push(`Q15: verticalRoads に _AVE なし`);

  return {
    id,
    errors,
    warns,
    metrics: { buildings, furniture, humans, grounds, heroClusters, ambientClusters, commentRatio, hasPartialHR, hasAve },
  };
}

const src = fs.readFileSync(SPEC_PATH, 'utf8');
const blocks = extractTSBlocks(src);

console.log('═══ Stage 2 v2.0 Quality Gate チェック ═══\n');

const results = blocks.map(b => checkChunk(b.id, b.code));

let totalErrors = 0;
let totalWarns = 0;
let partialHRCount = 0;

for (const r of results) {
  const m = r.metrics;
  totalErrors += r.errors.length;
  totalWarns += r.warns.length;
  if (m.hasPartialHR) partialHRCount++;
  const status = r.errors.length === 0 ? (r.warns.length === 0 ? '✅' : '⚠️ ') : '❌';
  console.log(
    `${status} ${r.id.padEnd(5)} ` +
    `B:${m.buildings.toString().padStart(2)} ` +
    `F:${m.furniture.toString().padStart(3)} ` +
    `H:${m.humans.toString().padStart(2)} ` +
    `G:${m.grounds.toString().padStart(2)} ` +
    `hero:${m.heroClusters} amb:${m.ambientClusters} ` +
    `cmt:${(m.commentRatio*100).toFixed(0)}% ` +
    `HR-vary:${m.hasPartialHR ? 'Y' : '-'}`
  );
  for (const e of r.errors) console.log(`     ❌ ${e}`);
  for (const w of r.warns) console.log(`     ⚠️  ${w}`);
}

console.log(`\n═══ サマリ ═══`);
console.log(`chunks: ${results.length}`);
console.log(`errors: ${totalErrors}`);
console.log(`warns:  ${totalWarns}`);
console.log(`Q12 (HR variation): ${partialHRCount}/12 chunks (≥6 必達)`);
console.log(`Q12 status: ${partialHRCount >= 6 ? '✅' : '❌'}`);

const passed = totalErrors === 0 && partialHRCount >= 6;
console.log(`\n${passed ? '✅ Quality Gate PASSED' : '❌ Quality Gate FAILED'}`);
process.exit(passed ? 0 : 1);
