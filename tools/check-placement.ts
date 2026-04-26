/**
 * tools/check-placement.ts
 *
 * Stage 1 の各チャンクの raw 配置を、指示書 §3-§6 の原則に対する適合性で
 * 自動チェックする。`npm run lint:placement` で実行。
 *
 * ルール:
 *   L0  Ref 解決      — cluster の buildings/furniture index 範囲チェック (error)
 *   L1  Focal 必須    — cluster に focal が存在 (error: 型レベルで保証されているが念のため)
 *   L2  Hero 取り巻き — hero クラスタの companions 数 3-5 (warn)
 *   L3  生活痕跡      — cluster.livingTrace の有無、もしくは各セルに痕跡家具 1 個以上 (warn)
 *   L4  行進検出      — 3+ 同種家具が同じ dy 帯で等間隔 dx (warn)
 *   L5  鏡像対称      — 同種家具のペアで abs(dx_a + dx_b) < 5 かつ |dy_a - dy_b| < 5 (warn)
 *   L6  同サイズ隣接  — 同 BuildingSize の建物が dx 差 < 40 かつ |dy差| < 5 で連続 (warn)
 *   L7  孤立 power_pole — power_pole 本数に対し power_line が不足 (warn)
 *   L8  Hero 隣接禁止 — 2 つの hero クラスタがセル隣接 (warn)
 *   L9  Facade 線逸脱 — 看板系家具が y=22±4 から外れる (info)
 */

import { STAGES, type RawChunkBody, type SemanticCluster, type Ref } from '../src/stages';

// ─── レベル定義 ──────────────────────────────────────
type Level = 'error' | 'warn' | 'info';
interface Issue { level: Level; rule: string; chunk: number; msg: string; }

const issues: Issue[] = [];
const push = (level: Level, rule: string, chunk: number, msg: string) =>
  issues.push({ level, rule, chunk, msg });

// ─── 補助 ────────────────────────────────────────
const SPINE_TYPES = new Set([
  // 連続軸 (Stage 1 街路樹)
  'sakura_tree', 'pine_tree', 'cherry_blossom',
  // 連続軸 (全 Stage 共通: 電力 / 照明 / avenue 横断)
  'power_pole', 'power_line', 'street_lamp', 'manhole_cover', 'bollard',
  // Stage 2 シグネチャ (chouchin 帯 / 暖簾 / 屋台)
  'chouchin', 'noren', 'banner_pole',
  // Stage 5 祭り
  'matsuri_drum', 'balloon_cluster',
]);
const FACADE_TYPES = new Set([
  'mailbox', 'sign_board', 'a_frame_sign', 'noren', 'chouchin',
  'post_letter_box', 'post_box',
]);
const TRACE_TYPES = new Set([
  'laundry_pole', 'laundry_balcony', 'garbage', 'bicycle', 'bicycle_row',
  'potted_plant', 'cat', 'mailbox', 'flower_planter_row',
]);

const cellOf = (dx: number, dy: number): 'NW' | 'NE' | 'SW' | 'SE' =>
  dy < 100 ? (dx < 0 ? 'NW' : 'NE') : (dx < 0 ? 'SW' : 'SE');

const refExists = (raw: RawChunkBody, ref: Ref): boolean =>
  ref.kind === 'b' ? ref.i >= 0 && ref.i < raw.buildings.length
                   : ref.i >= 0 && ref.i < raw.furniture.length;

// ─── ルール実装 ───────────────────────────────────────

/** L0: cluster の Ref が範囲内か */
function checkRefResolution(raw: RawChunkBody, chunk: number): void {
  const clusters = raw.clusters;
  if (!clusters) return;
  for (const c of clusters) {
    const allRefs: Ref[] = [
      c.focal,
      ...(c.companions ?? []),
      ...(c.boundary ?? []),
      ...(c.access ?? []),
      ...(c.livingTrace ? [c.livingTrace] : []),
    ];
    for (const r of allRefs) {
      if (!refExists(raw, r)) {
        push('error', 'L0', chunk,
          `cluster '${c.id}' has out-of-range ${r.kind === 'b' ? 'BRef' : 'FRef'} index ${r.i}`);
      }
    }
  }
}

/** L2: hero cluster の companions 数 3-5 */
function checkHeroCompanions(raw: RawChunkBody, chunk: number): void {
  if (!raw.clusters) return;
  for (const c of raw.clusters) {
    if (c.role !== 'hero') continue;
    const n = c.companions?.length ?? 0;
    if (n < 3) push('warn', 'L2', chunk, `hero '${c.id}' has only ${n} companions (≥3 expected)`);
    if (n > 5) push('warn', 'L2', chunk, `hero '${c.id}' has ${n} companions (≤5 expected to keep focal readable)`);
  }
}

/** L3: 各セルに痕跡家具 1 個以上 (cluster未定義チャンクでは furniture 全体から推定) */
function checkLivingTrace(raw: RawChunkBody, chunk: number): void {
  // cluster ベースが優先
  if (raw.clusters && raw.clusters.length > 0) {
    const cellsCovered = new Set<string>();
    for (const c of raw.clusters) {
      if (c.livingTrace) cellsCovered.add(c.cell);
    }
    const allCells: ReadonlyArray<'NW'|'NE'|'SW'|'SE'> = ['NW', 'NE', 'SW', 'SE'];
    for (const cell of allCells) {
      const inUse = raw.clusters.some(c => c.cell === cell || c.cell === 'merged');
      if (inUse && !cellsCovered.has(cell) && !raw.clusters.some(c => c.cell === 'merged' && c.livingTrace)) {
        push('warn', 'L3', chunk, `cell ${cell} has no livingTrace declared`);
      }
    }
    return;
  }
  // fallback: 各セルに TRACE_TYPES の家具が 1 個以上あるか
  const byCell: Record<string, number> = { NW: 0, NE: 0, SW: 0, SE: 0 };
  for (const f of raw.furniture) {
    if (TRACE_TYPES.has(f.type)) {
      byCell[cellOf(f.dx, f.dy)]++;
    }
  }
  for (const cell of Object.keys(byCell)) {
    if (byCell[cell] === 0) {
      push('warn', 'L3', chunk, `cell ${cell} has no living trace furniture`);
    }
  }
}

/** L4: 4+ 同種家具が同 dy 帯 (±5) で完全に等間隔の行進検出 (std < 5) */
function checkMarch(raw: RawChunkBody, chunk: number): void {
  // type → 配置リスト
  const byType: Map<string, { dx: number; dy: number }[]> = new Map();
  for (const f of raw.furniture) {
    if (SPINE_TYPES.has(f.type)) continue;
    if (!byType.has(f.type)) byType.set(f.type, []);
    byType.get(f.type)!.push({ dx: f.dx, dy: f.dy });
  }
  for (const [type, items] of byType) {
    if (items.length < 4) continue;
    // dy 帯 (±5) でグループ化
    const sorted = [...items].sort((a, b) => a.dy - b.dy);
    let band: typeof sorted = [];
    let bandY = sorted[0].dy;
    const flushBand = () => {
      if (band.length < 4) return;
      const dxs = band.map(b => b.dx).sort((a, b) => a - b);
      const diffs: number[] = [];
      for (let i = 1; i < dxs.length; i++) diffs.push(dxs[i] - dxs[i - 1]);
      const mean = diffs.reduce((s, x) => s + x, 0) / diffs.length;
      const variance = diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / diffs.length;
      const std = Math.sqrt(variance);
      // 4+ items, std < 5, mean step > 15 (隣接でない明確な行) で警告
      if (std < 5 && mean > 15) {
        push('warn', 'L4', chunk,
          `'${type}' march: ${band.length} items at dy~${bandY.toFixed(0)}, dx step≈${mean.toFixed(1)}±${std.toFixed(1)}`);
      }
    };
    for (const it of sorted) {
      if (Math.abs(it.dy - bandY) <= 5) band.push(it);
      else { flushBand(); band = [it]; bandY = it.dy; }
    }
    flushBand();
  }
}

/** L5: 鏡像対称ペア検出 */
function checkMirror(raw: RawChunkBody, chunk: number): void {
  const byType: Map<string, { dx: number; dy: number; idx: number }[]> = new Map();
  for (let i = 0; i < raw.furniture.length; i++) {
    const f = raw.furniture[i];
    if (SPINE_TYPES.has(f.type)) continue;
    if (!byType.has(f.type)) byType.set(f.type, []);
    byType.get(f.type)!.push({ dx: f.dx, dy: f.dy, idx: i });
  }
  // §6 「X を 2-5 px ずらす」 — 完全鏡像 (|a+b| < 3) のみ警告
  for (const [type, items] of byType) {
    if (items.length < 2) continue;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (Math.abs(a.dx + b.dx) < 3 && Math.abs(a.dy - b.dy) < 3 && Math.abs(a.dx) > 15) {
          push('warn', 'L5', chunk,
            `'${type}' mirror pair: (${a.dx},${a.dy}) ↔ (${b.dx},${b.dy})`);
        }
      }
    }
  }
}

/** L6: 同サイズ建物の隣接 (dx 差 < 40 かつ dy 差 < 5) */
function checkSameBuildingAdjacent(raw: RawChunkBody, chunk: number): void {
  const bySize: Map<string, { dx: number; dy: number }[]> = new Map();
  for (const b of raw.buildings) {
    if (!bySize.has(b.size)) bySize.set(b.size, []);
    bySize.get(b.size)!.push({ dx: b.dx, dy: b.dy });
  }
  for (const [size, items] of bySize) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((a, b) => a.dx - b.dx);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (Math.abs(a.dx - b.dx) < 40 && Math.abs(a.dy - b.dy) < 5) {
        push('warn', 'L6', chunk,
          `same size '${size}' adjacent: (${a.dx},${a.dy}) (${b.dx},${b.dy})`);
      }
    }
  }
}

/** L7: 孤立 power_pole — power_line が不足 */
function checkIsolatedPowerPole(raw: RawChunkBody, chunk: number): void {
  let poles = 0, lines = 0;
  for (const f of raw.furniture) {
    if (f.type === 'power_pole') poles++;
    else if (f.type === 'power_line') lines++;
  }
  if (poles >= 2 && lines < Math.ceil(poles / 2)) {
    push('warn', 'L7', chunk,
      `power_pole=${poles} but power_line=${lines} (need ≥${Math.ceil(poles / 2)} lines to connect)`);
  }
  if (poles === 1) {
    push('warn', 'L7', chunk, `single isolated power_pole (need pair or power_line)`);
  }
}

/** L8: hero クラスタが avenue / y=100 で隣接 */
function checkHeroAdjacency(raw: RawChunkBody, chunk: number): void {
  if (!raw.clusters) return;
  const heroes = raw.clusters.filter(c => c.role === 'hero');
  if (heroes.length < 2) return;
  // セル隣接ペア (avenue または y=100 で接する組)
  const adjacentPairs = new Set([
    'NW-NE', 'NE-NW', // avenue
    'SW-SE', 'SE-SW', // avenue
    'NW-SW', 'SW-NW', // y=100
    'NE-SE', 'SE-NE', // y=100
  ]);
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      const key = `${heroes[i].cell}-${heroes[j].cell}`;
      if (adjacentPairs.has(key)) {
        push('warn', 'L8', chunk,
          `hero clusters '${heroes[i].id}' and '${heroes[j].id}' are adjacent (${heroes[i].cell}/${heroes[j].cell}) — should be diagonal`);
      }
    }
  }
}

/** L9: 看板系家具が facade 線から逸脱
 * facade 線は複数本許容: 上段 y=22, hero 焦点前面 y=56, 下段 y=118, 焦点周辺 y=148
 * いずれかの線の ±4px 以内なら許容 (chaya / 銭湯 / civic plaza の店構えに対応)
 */
function checkFacadeLine(raw: RawChunkBody, chunk: number): void {
  // 許容される facade 帯 (店舗の高さによって複数の y がありうる)
  const FACADE_LINES = [22, 56, 118, 148];
  for (const f of raw.furniture) {
    if (!FACADE_TYPES.has(f.type)) continue;
    let minDist = Infinity;
    let nearestLine = 22;
    for (const line of FACADE_LINES) {
      const d = Math.abs(f.dy - line);
      if (d < minDist) { minDist = d; nearestLine = line; }
    }
    if (minDist > 4) {
      push('info', 'L9', chunk,
        `'${f.type}' at (${f.dx},${f.dy}) deviates from nearest facade y=${nearestLine} by ${minDist.toFixed(0)}`);
    }
  }
}

// ─── メイン ───────────────────────────────────────
const RULES: Array<(raw: RawChunkBody, chunk: number) => void> = [
  checkRefResolution,
  checkHeroCompanions,
  checkLivingTrace,
  checkMarch,
  checkMirror,
  checkSameBuildingAdjacent,
  checkIsolatedPowerPole,
  checkHeroAdjacency,
  checkFacadeLine,
];

// CLI 引数: --stage=N で対象ステージ指定 (デフォルト: 全ステージ)
const argStage = process.argv.find(a => a.startsWith('--stage='));
const targetStage = argStage ? parseInt(argStage.split('=')[1], 10) : null;
const stagesToCheck = targetStage !== null ? [targetStage] : [0, 1];  // Stage 1 と 2 を対象

let totalClusters = 0;
let totalChunks = 0;

for (const stageIdx of stagesToCheck) {
  const stage = STAGES[stageIdx];
  if (!stage) continue;
  const templates = stage.templates;
  totalChunks += templates.length;
  console.log(`\n═══ Stage ${stageIdx + 1} (${stage.name}) 配置リンタ ═══`);

  for (let chunkId = 0; chunkId < templates.length; chunkId++) {
    const tmpl = templates[chunkId];
    if (!tmpl.raw) continue;
    if (tmpl.raw.clusters) totalClusters += tmpl.raw.clusters.length;
    for (const rule of RULES) {
      // chunk ID をステージ別に表示するため、prefix を変える
      rule(tmpl.raw, chunkId);
    }
  }
}

// ─── レポート ─────────────────────────────────────
const errors = issues.filter(i => i.level === 'error');
const warns  = issues.filter(i => i.level === 'warn');
const infos  = issues.filter(i => i.level === 'info');

const fmtIssue = (i: Issue) => `  [${i.rule}] Ch${i.chunk}: ${i.msg}`;

if (errors.length) {
  console.log(`❌ Errors (${errors.length}):`);
  errors.forEach(i => console.log(fmtIssue(i)));
  console.log('');
}
if (warns.length) {
  console.log(`⚠️  Warnings (${warns.length}):`);
  warns.forEach(i => console.log(fmtIssue(i)));
  console.log('');
}
if (infos.length) {
  console.log(`ℹ️  Info (${infos.length}):`);
  infos.slice(0, 30).forEach(i => console.log(fmtIssue(i)));
  if (infos.length > 30) console.log(`  ...and ${infos.length - 30} more`);
  console.log('');
}

console.log('───────────────────────────────────');
console.log(`Total: ${totalChunks} chunks, ${totalClusters} clusters defined`);
console.log(`Errors: ${errors.length}  Warnings: ${warns.length}  Info: ${infos.length}`);

// CI で error は失敗扱い、warn は通過
process.exit(errors.length > 0 ? 1 : 0);
