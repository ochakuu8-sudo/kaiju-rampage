/**
 * stages.ts — ステージ定義データ
 * 5本横道路 + 2本縦路地構成 (丘〜川沿い)
 *
 * Tier 1: Hilltop  (HILLTOP_BASE=249)  Y=240
 * Tier 2: Upper    (UPPER_BASE=186)    Y=175
 * Tier 3: Main     (MAIN_BASE=116)     Y=100
 * Tier 4: Lower    (LOWER_BASE=27)     Y=15
 * Tier 5: Riverside (RIVERSIDE_BASE=-60) Y=-70
 */

import { BuildingSize, HILLTOP_BASE, UPPER_BASE, MAIN_BASE, LOWER_BASE, RIVERSIDE_BASE } from './constants';
import type { FurnitureType } from './entities';

export interface BuildingDef {
  x: number;   // 中心X
  y: number;   // 下端Y
  size: BuildingSize;
}

export interface BumperDef {
  x: number;
  y: number;
}

export interface FurnitureDef {
  type: FurnitureType;
  x: number;
  y: number;
  hp?: number;
  score?: number;
}

export interface VehicleDef {
  type: 'car' | 'bus' | 'truck' | 'ambulance';
  lane: 'hilltop' | 'upper' | 'main' | 'lower' | 'riverside';
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

// ヘルパー: ビル定義
function b(x: number, base: number, size: BuildingSize): BuildingDef {
  return { x, y: base, size };
}

const stage1Config: StageConfig = {
  level: 1,
  buildings: [
    // Tier 1: Hilltop (HILLTOP_BASE=249)
    b(-140, HILLTOP_BASE, 'house'), b(-10, HILLTOP_BASE, 'temple'), b(120, HILLTOP_BASE, 'house'),
    // Tier 2: Residential (UPPER_BASE=186)
    b(-155, UPPER_BASE, 'house'), b(-130, UPPER_BASE, 'house'), b(-100, UPPER_BASE, 'house'),
    b(0, UPPER_BASE, 'school'), b(110, UPPER_BASE, 'apartment'), b(150, UPPER_BASE, 'house'),
    // Tier 3: Main commercial (MAIN_BASE=116)
    b(-150, MAIN_BASE, 'restaurant'), b(-120, MAIN_BASE, 'shop'), b(-80, MAIN_BASE, 'shop'),
    b(-20, MAIN_BASE, 'convenience'), b(20, MAIN_BASE, 'restaurant'),
    b(100, MAIN_BASE, 'office'), b(145, MAIN_BASE, 'tower'),
    // Tier 4: Station area (LOWER_BASE=27)
    b(-145, LOWER_BASE, 'convenience'), b(-110, LOWER_BASE, 'shop'),
    b(0, LOWER_BASE, 'hospital'), b(120, LOWER_BASE, 'parking'),
    // Tier 5: Riverside (RIVERSIDE_BASE=-60)
    b(-140, RIVERSIDE_BASE, 'house'), b(140, RIVERSIDE_BASE, 'house'),
  ],
  bumpers: [
    { x: -80, y: -30 }, { x: 0, y: -30 }, { x: 80, y: -30 },
    { x: -100, y: -110 }, { x: 100, y: -110 },
  ],
  furniture: [
    // Hilltop (SW=247)
    { type:'tree',        x:-160, y:247 }, { type:'tree',       x:-120, y:247 },
    { type:'tree',        x:  30, y:247 }, { type:'tree',       x: 100, y:247 },
    { type:'flower_bed',  x: -30, y:247 }, { type:'flower_bed', x:  15, y:247 },
    { type:'bench',       x: 155, y:247 },
    // Upper/Residential (SW=184)
    { type:'tree',        x:-170, y:184 }, { type:'tree',       x:-115, y:184 },
    { type:'tree',        x: 165, y:184 },
    { type:'bicycle',     x: -40, y:184 }, { type:'bicycle',    x: -30, y:184 },
    { type:'bicycle',     x: -20, y:184 },
    { type:'power_pole',  x:-165, y:184 }, { type:'power_pole', x: 160, y:184 },
    { type:'mailbox',     x:-145, y:184 },
    // Main commercial (SW=114)
    { type:'sign_board',  x:-155, y:114 }, { type:'sign_board', x:-125, y:114 },
    { type:'sign_board',  x:  -5, y:114 },
    { type:'parasol',     x:-140, y:114 }, { type:'parasol',    x:  30, y:114 },
    { type:'vending',     x: -35, y:114 }, { type:'vending',    x: 115, y:114 },
    { type:'garbage',     x: -90, y:114 }, { type:'garbage',    x:  50, y:114 },
    { type:'fountain',    x:   5, y:114 },
    { type:'traffic_light', x:-50, y:114 }, { type:'traffic_light', x:80, y:114 },
    // Lower/Station (SW=25)
    { type:'vending',     x:-160, y: 25 },
    { type:'bench',       x:  40, y: 25 },
    { type:'hydrant',     x: -70, y: 25 }, { type:'hydrant',    x:  60, y: 25 },
    { type:'traffic_light', x:-50, y: 25 }, { type:'traffic_light', x:80, y: 25 },
    { type:'sign_board',  x: 145, y: 25 },
    // Riverside (SW=-62)
    { type:'tree',        x:-155, y:-62 }, { type:'tree',       x: 155, y:-62 },
    { type:'bench',       x:   0, y:-62 },
  ],
  vehicles: [
    { type:'car',   lane:'upper',     direction:-1, speed:40, interval:8.0 },
    { type:'car',   lane:'main',      direction: 1, speed:60, interval:3.5 },
    { type:'car',   lane:'main',      direction:-1, speed:55, interval:4.5 },
    { type:'bus',   lane:'main',      direction: 1, speed:40, interval:8.0 },
    { type:'car',   lane:'lower',     direction: 1, speed:45, interval:4.0 },
    { type:'truck', lane:'lower',     direction: 1, speed:30, interval:10.0 },
    { type:'car',   lane:'riverside', direction:-1, speed:35, interval:9.0 },
  ],
  bgTopR: 0.45, bgTopG: 0.68, bgTopB: 0.95,
  bgBottomR: 0.82, bgBottomG: 0.90, bgBottomB: 0.96,
};

function scaleStage(base: StageConfig, level: number): StageConfig {
  return {
    ...base,
    level,
    buildings: base.buildings.map(bld => ({ ...bld })),
    bumpers: base.bumpers,
    furniture: base.furniture,
    vehicles: base.vehicles,
  };
}

export const STAGES: StageConfig[] = [
  stage1Config,
  scaleStage(stage1Config, 2),
  scaleStage(stage1Config, 3),
  scaleStage(stage1Config, 4),
];

export function getStage(level: number): StageConfig {
  if (level <= STAGES.length) return STAGES[level - 1];
  // For levels beyond what's defined, scale up stage 1
  const base = STAGES[0];
  return {
    ...base,
    level,
    buildings: base.buildings.map(bld => ({ ...bld })),
  };
}
