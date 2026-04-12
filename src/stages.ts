/**
 * stages.ts — ステージ定義データ
 * 4本横道路 + 2本縦路地 (丘〜川沿い)
 *
 * Tier 1: Hilltop   (HILLTOP_BASE=200)    Y=240
 * Tier 1b: BLK_A_NEAR (BLK_A_NEAR=162)   block A 手前列
 * Tier 3: Main      (MAIN_BASE=90)        Y=133
 * Tier 4: Lower     (LOWER_BASE=42)       Y=26
 * Tier 5: Riverside (RIVERSIDE_BASE=−45)  Y=-80
 *
 * Alley exclusion zones:
 *   Alley 1: X=-59..−41  (center −50, w=18)
 *   Alley 2: X= 71.. 89  (center  80, w=18)
 * Buildings must NOT have their footprint overlap these zones.
 */

import { BuildingSize, HILLTOP_BASE, BLK_A_NEAR, MAIN_BASE, LOWER_BASE, RIVERSIDE_BASE } from './constants';
import type { FurnitureType } from './entities';

export interface BuildingDef { x: number; y: number; size: BuildingSize; }
export interface BumperDef   { x: number; y: number; }
export interface FurnitureDef { type: FurnitureType; x: number; y: number; hp?: number; score?: number; }
export interface VehicleDef {
  type: 'car' | 'bus' | 'truck' | 'ambulance';
  lane: 'hilltop' | 'main' | 'lower' | 'riverside';
  direction: 1 | -1;
  speed: number;
  interval: number;
}
export interface StageConfig {
  level: number;
  buildings: BuildingDef[];
  bumpers: BumperDef[];
  furniture: FurnitureDef[];
  vehicles: VehicleDef[];
  bgTopR: number; bgTopG: number; bgTopB: number;
  bgBottomR: number; bgBottomG: number; bgBottomB: number;
}

const b = (x: number, base: number, size: BuildingSize): BuildingDef => ({ x, y: base, size });
const f = (type: FurnitureType, x: number, y: number): FurnitureDef => ({ type, x, y });

const stage1Config: StageConfig = {
  level: 1,

  buildings: [
    // ── Tier 1: Hilltop 奥列 (HILLTOP_BASE=200) ────────────────────────
    // left of alley1 (right edge ≤ −59)
    b(-168, HILLTOP_BASE, 'house'),   // [−176,−160]
    b(-151, HILLTOP_BASE, 'house'),   // [−159,−143]
    b(-134, HILLTOP_BASE, 'house'),   // [−142,−126]
    b(-116, HILLTOP_BASE, 'shop'),    // [−127,−105]
    b( -92, HILLTOP_BASE, 'temple'),  // [−107, −77]
    b( -68, HILLTOP_BASE, 'house'),   // [−76,  −60]
    // mid between alleys (−41..71)
    b( -30, HILLTOP_BASE, 'house'),   // [−38, −22]
    b( -12, HILLTOP_BASE, 'house'),   // [−20,  −4]
    b(   7, HILLTOP_BASE, 'shop'),    // [  −4,  18]
    b(  27, HILLTOP_BASE, 'house'),   // [ 19,  35]
    b(  44, HILLTOP_BASE, 'house'),   // [ 36,  52]
    b(  62, HILLTOP_BASE, 'house'),   // [ 54,  70]
    // right of alley2 (left edge ≥ 89)
    b(  97, HILLTOP_BASE, 'house'),   // [ 89, 105]
    b( 114, HILLTOP_BASE, 'house'),   // [106, 122]
    b( 132, HILLTOP_BASE, 'shop'),    // [121, 143]
    b( 151, HILLTOP_BASE, 'house'),   // [143, 159]
    b( 168, HILLTOP_BASE, 'house'),   // [160, 176]

    // ── Tier 1b: Hilltop 手前列 / Residential (BLK_A_NEAR=162) ─────────
    b(-168, BLK_A_NEAR, 'house'),
    b(-151, BLK_A_NEAR, 'house'),
    b(-135, BLK_A_NEAR, 'apartment'), // [−147,−123]
    b(-110, BLK_A_NEAR, 'house'),
    b( -92, BLK_A_NEAR, 'house'),
    b( -74, BLK_A_NEAR, 'house'),     // [−82, −66]
    // mid
    b( -29, BLK_A_NEAR, 'house'),     // [−37, −21]
    b(  10, BLK_A_NEAR, 'school'),    // [−10,  30] w=40
    b(  52, BLK_A_NEAR, 'apartment'), // [ 40,  64]
    // right
    b(  97, BLK_A_NEAR, 'house'),
    b( 116, BLK_A_NEAR, 'apartment'), // [104, 128]
    b( 140, BLK_A_NEAR, 'house'),
    b( 156, BLK_A_NEAR, 'house'),
    b( 172, BLK_A_NEAR, 'house'),

    // ── Tier 3: Main commercial (MAIN_BASE=90) ───────────────────────────
    b(-162, MAIN_BASE, 'restaurant'), // [−172,−152]
    b(-141, MAIN_BASE, 'shop'),       // [−152,−130]
    b(-119, MAIN_BASE, 'shop'),       // [−130,−108]
    b( -95, MAIN_BASE, 'office'),     // [−110, −80]
    b( -72, MAIN_BASE, 'convenience'),// [ −84, −60]
    // mid
    b( -29, MAIN_BASE, 'restaurant'), // [−39, −19]
    b(  -6, MAIN_BASE, 'shop'),       // [−17,   5]
    b(  22, MAIN_BASE, 'office'),     // [  7,  37]
    b(  52, MAIN_BASE, 'shop'),       // [ 41,  63]
    // right
    b( 102, MAIN_BASE, 'convenience'),// [ 90, 114]
    b( 128, MAIN_BASE, 'office'),     // [113, 143]
    b( 158, MAIN_BASE, 'tower'),      // [140.5,175.5]

    // ── Tier 4: Lower / Station (LOWER_BASE=42) ───────────────────────────
    b(-160, LOWER_BASE, 'convenience'),// [−172,−148]
    b(-131, LOWER_BASE, 'parking'),    // [−149,−113]
    b(-101, LOWER_BASE, 'shop'),       // [−112, −90]
    b( -78, LOWER_BASE, 'shop'),       // [ −89, −67]
    // mid
    b( -28, LOWER_BASE, 'apartment'),  // [−40, −16]
    b(  12, LOWER_BASE, 'hospital'),   // [−5.5,29.5]
    b(  49, LOWER_BASE, 'apartment'),  // [ 37,  61]
    // right
    b( 108, LOWER_BASE, 'parking'),    // [ 90, 126]
    b( 136, LOWER_BASE, 'shop'),       // [125, 147]
    b( 157, LOWER_BASE, 'apartment'),  // [145, 169]

    // ── Tier 5: Riverside (RIVERSIDE_BASE=−45) ────────────────────────────
    b(-163, RIVERSIDE_BASE, 'house'),
    b(-146, RIVERSIDE_BASE, 'house'),
    b(-126, RIVERSIDE_BASE, 'restaurant'),// [−136,−116]
    b(-104, RIVERSIDE_BASE, 'house'),
    b( -85, RIVERSIDE_BASE, 'house'),  // [−93, −77]
    // mid
    b( -29, RIVERSIDE_BASE, 'house'),
    b( -10, RIVERSIDE_BASE, 'shop'),   // [−21,   1]
    b(  14, RIVERSIDE_BASE, 'house'),
    b(  33, RIVERSIDE_BASE, 'house'),
    b(  53, RIVERSIDE_BASE, 'house'),  // [ 45,  61]
    // right
    b(  97, RIVERSIDE_BASE, 'house'),
    b( 115, RIVERSIDE_BASE, 'house'),
    b( 135, RIVERSIDE_BASE, 'shop'),   // [124, 146]
    b( 157, RIVERSIDE_BASE, 'house'),
    b( 173, RIVERSIDE_BASE, 'house'),  // [165, 181]
  ],

  bumpers: [],

  furniture: [
    // ── Hilltop sidewalk Y≈247 ───────────────────────────────────────
    f('power_pole',   -175, 247),
    f('tree',         -158, 247), f('tree',   -140, 247), f('tree',  -121, 247),
    f('flower_bed',    -99, 247), f('flower_bed', -79, 247),
    f('bench',         -52, 247),
    f('tree',          -20, 247), f('tree',     0, 247), f('tree',   20, 247),
    f('flower_bed',     38, 247), f('bench',   55, 247),
    f('tree',           68, 247),
    f('tree',           92, 247), f('tree',  108, 247), f('tree',  124, 247),
    f('flower_bed',    143, 247), f('bench',  162, 247),
    f('power_pole',    175, 247),

    // ── Main commercial sidewalk Y≈146 ───────────────────────────────
    f('sign_board',   -155, 146), f('parasol',  -147, 146),
    f('sign_board',   -132, 146), f('garbage',  -126, 146),
    f('vending',      -112, 146), f('sign_board',-104, 146),
    f('garbage',       -85, 146),
    f('traffic_light', -60, 146),
    f('sign_board',    -40, 146), f('parasol',   -24, 146),
    f('vending',       -14, 146),
    f('fountain',        5, 146),
    f('vending',        16, 146), f('parasol',   30, 146),
    f('sign_board',     45, 146), f('garbage',   57, 146),
    f('traffic_light',  71, 146),
    f('vending',        95, 146), f('sign_board',108, 146),
    f('garbage',       122, 146), f('parasol',   140, 146),
    f('sign_board',    153, 146),

    // ── Lower / Station sidewalk Y≈38 ────────────────────────────────
    f('vending',      -172,  38), f('bench',    -152,  38),
    f('sign_board',   -125,  38),
    f('hydrant',      -112,  38), f('garbage',   -95,  38),
    f('traffic_light', -60,  38), f('hydrant',   -45,  38),
    f('bench',         -18,  38), f('vending',     2,  38),
    f('garbage',        22,  38),
    f('traffic_light',  71,  38), f('hydrant',    85,  38),
    f('sign_board',     98,  38), f('bench',     122,  38),
    f('vending',       142,  38), f('garbage',   157,  38),

    // ── Riverside sidewalk Y≈−72 ─────────────────────────────────────
    f('tree',         -155, -72), f('bench',    -132, -72),
    f('tree',         -113, -72),
    f('tree',          -75, -72),
    f('bench',         -40, -72), f('bench',      0, -72),
    f('tree',           40, -72), f('bench',     60, -72),
    f('tree',           90, -72), f('tree',     112, -72),
    f('bench',         132, -72), f('tree',     155, -72),
  ],

  vehicles: [
    { type:'car',   lane:'hilltop',   direction:-1, speed:30, interval:14.0 },
    { type:'car',   lane:'main',      direction: 1, speed:60, interval: 3.0 },
    { type:'car',   lane:'main',      direction:-1, speed:55, interval: 3.5 },
    { type:'bus',   lane:'main',      direction: 1, speed:40, interval: 7.5 },
    { type:'truck', lane:'main',      direction:-1, speed:35, interval:12.0 },
    { type:'ambulance', lane:'main',  direction: 1, speed:70, interval:20.0 },
    { type:'car',   lane:'lower',     direction: 1, speed:45, interval: 4.5 },
    { type:'car',   lane:'lower',     direction:-1, speed:42, interval: 5.0 },
    { type:'truck', lane:'lower',     direction: 1, speed:30, interval:10.0 },
    { type:'car',   lane:'riverside', direction:-1, speed:35, interval: 8.0 },
    { type:'car',   lane:'riverside', direction: 1, speed:38, interval:11.0 },
  ],

  bgTopR: 0.52, bgTopG: 0.74, bgTopB: 0.96,
  bgBottomR: 0.38, bgBottomG: 0.36, bgBottomB: 0.33,
};

function scaleStage(base: StageConfig, level: number): StageConfig {
  return { ...base, level, buildings: base.buildings.map(bld => ({ ...bld })) };
}

export const STAGES: StageConfig[] = [
  stage1Config,
  scaleStage(stage1Config, 2),
  scaleStage(stage1Config, 3),
  scaleStage(stage1Config, 4),
];

export function getStage(level: number): StageConfig {
  if (level <= STAGES.length) return STAGES[level - 1];
  return { ...STAGES[0], level, buildings: STAGES[0].buildings.map(bld => ({ ...bld })) };
}
