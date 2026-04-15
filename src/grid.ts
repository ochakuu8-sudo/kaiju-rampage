/**
 * grid.ts — 都市レイアウト用グリッドと道路パターン
 *
 * 街全体をグリッドで管理し、RoadPattern で道路を不規則に生成する。
 * - cell は scene を入れる容器
 * - 道路は RoadSegment で部分セグメント可能 (全幅 / T字路 / 袋小路)
 * - 大型シーンは merged cells で複数 cell を占有
 */

import * as C from './constants';

// ─────────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────────

export type RoadClass = 'avenue' | 'street';

/** 1 本の道路セグメント (水平 or 垂直) */
export interface RoadSegment {
  /** どの grid line を走るか (水平なら行境界 index、垂直なら列境界 index) */
  gridLine: number;
  /** 開始 cell index (inclusive) */
  startCell: number;
  /** 終了 cell index (exclusive) */
  endCell: number;
  cls: RoadClass;
  /** この行/列の中心ワールド座標 (描画時に解決) */
  worldPos?: number;
  /** 道路の太さ (h) */
  thickness?: number;
}

export type CellContent =
  | { type: 'scene'; sceneId: string }
  | { type: 'scenes'; sceneIds: string[] }  // 1 cell に複数シーンを横並び
  | { type: 'merged'; masterRow: number; masterCol: number }
  | { type: 'random_residential' }
  | { type: 'empty' };

/** 1 つのグリッドブロック (初期都市 or 1 チャンク) */
export interface GridBlock {
  rows: number;
  cols: number;
  cellW: number;
  cellH: number;
  cells: CellContent[][];
  horizontalRoads: RoadSegment[];
  verticalRoads: RoadSegment[];
  /** グリッドの左下ワールド座標 */
  originX: number;
  originY: number;
}

/** 道路パターン (RoadPattern): GridBlock の道路配置を定義 */
export interface RoadPattern {
  id: string;
  weight: number;
  rows: number;
  cols: number;
  horizontalRoads: RoadSegment[];
  verticalRoads: RoadSegment[];
  /** cells[row][col] = scene id or special marker */
  cells: (string | string[] | null | 'random_residential' | 'merged_right')[][];
  /** 2-cell 以上のシーンが使う master cell 情報 */
  merges?: Array<{ row: number; col: number; spanCols: number; spanRows?: number }>;
}

// ─────────────────────────────────────────────────────────────────
// 座標変換ヘルパー
// ─────────────────────────────────────────────────────────────────

/** cell (row, col) の中心ワールド座標 */
export function cellCenter(block: GridBlock, row: number, col: number): { x: number; y: number } {
  const x = block.originX + col * block.cellW + block.cellW / 2;
  const y = block.originY + row * block.cellH + block.cellH / 2;
  return { x, y };
}

/** cell (row, col) のワールド X 範囲 */
export function cellXRange(block: GridBlock, col: number): { xMin: number; xMax: number } {
  const xMin = block.originX + col * block.cellW;
  const xMax = xMin + block.cellW;
  return { xMin, xMax };
}

/** 水平道路セグメントのワールド座標範囲 */
export function horizontalRoadWorld(
  block: GridBlock,
  seg: RoadSegment
): { cy: number; xMin: number; xMax: number } {
  const cy = block.originY + seg.gridLine * block.cellH;
  const xMin = block.originX + seg.startCell * block.cellW;
  const xMax = block.originX + seg.endCell * block.cellW;
  return { cy, xMin, xMax };
}

/** 垂直道路セグメントのワールド座標範囲 */
export function verticalRoadWorld(
  block: GridBlock,
  seg: RoadSegment
): { cx: number; yMin: number; yMax: number } {
  const cx = block.originX + seg.gridLine * block.cellW;
  const yMin = block.originY + seg.startCell * block.cellH;
  const yMax = block.originY + seg.endCell * block.cellH;
  return { cx, yMin, yMax };
}

/**
 * block 内の全交差点 (水平 x 垂直の重なり) を返す
 * 各交差点はワールド座標 + 参加する道路の太さ
 */
export interface Intersection {
  x: number;
  y: number;
  hThickness: number;
  vThickness: number;
}
export function getIntersections(block: GridBlock): Intersection[] {
  const out: Intersection[] = [];
  for (const h of block.horizontalRoads) {
    const hWorld = horizontalRoadWorld(block, h);
    const hThickness = h.thickness ?? (h.cls === 'avenue' ? C.CHUNK_ROAD_THICK_AVENUE : C.CHUNK_ROAD_THICK_STREET);
    for (const v of block.verticalRoads) {
      const vWorld = verticalRoadWorld(block, v);
      // 交差するのは、水平のY位置が垂直のY範囲に含まれ、かつ垂直のX位置が水平のX範囲に含まれるとき
      if (
        vWorld.cx >= hWorld.xMin && vWorld.cx <= hWorld.xMax &&
        hWorld.cy >= vWorld.yMin && hWorld.cy <= vWorld.yMax
      ) {
        out.push({
          x: vWorld.cx,
          y: hWorld.cy,
          hThickness,
          vThickness: v.thickness ?? C.CHUNK_ROAD_THICK_STREET,
        });
      }
    }
  }
  return out;
}

/**
 * pattern から GridBlock を生成する
 */
export function buildBlock(
  pattern: RoadPattern,
  originX: number,
  originY: number,
  cellW: number = C.CELL_W,
  cellH: number = C.CELL_H
): GridBlock {
  const cells: CellContent[][] = [];
  const merges = pattern.merges ?? [];

  // (r,c) が merge rect の内部か (master か 従属か) を判定
  const findMerge = (r: number, c: number): { masterRow: number; masterCol: number } | null => {
    for (const m of merges) {
      const sr = m.spanRows ?? 1;
      const sc = m.spanCols;
      if (r >= m.row && r < m.row + sr && c >= m.col && c < m.col + sc) {
        return { masterRow: m.row, masterCol: m.col };
      }
    }
    return null;
  };

  for (let r = 0; r < pattern.rows; r++) {
    const row: CellContent[] = [];
    for (let c = 0; c < pattern.cols; c++) {
      const mergeAt = findMerge(r, c);
      if (mergeAt && (mergeAt.masterRow !== r || mergeAt.masterCol !== c)) {
        // 従属セル: master を参照
        row.push({ type: 'merged', masterRow: mergeAt.masterRow, masterCol: mergeAt.masterCol });
        continue;
      }
      const raw = pattern.cells[r]?.[c];
      if (raw == null) row.push({ type: 'empty' });
      else if (Array.isArray(raw)) row.push({ type: 'scenes', sceneIds: raw });
      else if (raw === 'random_residential') row.push({ type: 'random_residential' });
      else if (raw === 'merged_right') {
        // 後方互換: 従来マーカーだが、merges 定義が正しければこちらは master 側でなければ通らない
        row.push({ type: 'empty' });
      } else {
        row.push({ type: 'scene', sceneId: raw });
      }
    }
    cells.push(row);
  }
  return {
    rows: pattern.rows,
    cols: pattern.cols,
    cellW,
    cellH,
    cells,
    horizontalRoads: pattern.horizontalRoads,
    verticalRoads: pattern.verticalRoads,
    originX,
    originY,
  };
}
