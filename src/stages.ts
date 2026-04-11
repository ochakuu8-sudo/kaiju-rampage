/**
 * stages.ts — ステージ定義データ
 * 3本横道路 + 2本縦路地 + 6ブロック構成
 *
 * ブロックA/B/C: MAIN_BASE(146)〜BACK_BASE(250)  の間  [奥エリア]
 * ブロックD/E/F: FRONT_BASE(52)〜118              の間  [手前エリア]
 * 左(A,D): X=-180..-75  中(B,E): X=-55..55  右(C,F): X=75..180
 */

import { BuildingSize, MAIN_BASE, FRONT_BASE } from './constants';
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
  lane: 'main' | 'front' | 'back';
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

// ヘルパー: 家具定義
function f(type: FurnitureType, x: number, y: number, hp = 1, score = 50): FurnitureDef {
  return { type, x, y, hp, score };
}

// 歩道Y: MAIN_BASE上 or FRONT_BASE上の歩道中心
const SW_MAIN  = MAIN_BASE  - 2; // 144: 路地沿い歩道
const SW_FRONT = FRONT_BASE - 2; // 50: 手前歩道

export const STAGES: StageConfig[] = [

  // ===== Stage 1: 郊外の住宅地 =====
  {
    level: 1,
    buildings: [
      // Block A (left-back)
      b(-155, MAIN_BASE, 'house'), b(-135, MAIN_BASE, 'convenience'), b(-115, MAIN_BASE, 'house'), b(-95, MAIN_BASE, 'shop'),
      // Block B (mid-back)
      b(-35, MAIN_BASE, 'restaurant'), b(-10, MAIN_BASE, 'apartment'), b(20, MAIN_BASE, 'shop'),
      // Block C (right-back)
      b(95,  MAIN_BASE, 'house'), b(115, MAIN_BASE, 'school'), b(140, MAIN_BASE, 'office'), b(162, MAIN_BASE, 'house'),
      // Block D (left-front)
      b(-150, FRONT_BASE, 'shop'), b(-125, FRONT_BASE, 'parking'), b(-100, FRONT_BASE, 'shop'),
      // Block E (mid-front)
      b(-25,  FRONT_BASE, 'hospital'), b(5,  FRONT_BASE, 'tower'), b(30, FRONT_BASE, 'apartment'),
      // Block F (right-front)
      b(100,  FRONT_BASE, 'temple'), b(120, FRONT_BASE, 'house'), b(145, FRONT_BASE, 'house'),
      // Extra
      b(-170, FRONT_BASE, 'house'), b(168, FRONT_BASE, 'convenience'),
    ],
    bumpers: [
      { x: -90, y: 18 }, { x: 0, y: 25 }, { x: 90, y: 18 }, { x: 0, y: -30 },
    ],
    furniture: [
      // Trees along main road sidewalks
      f('tree', -160, SW_MAIN), f('tree', -120, SW_MAIN), f('tree', -80, SW_MAIN),
      f('tree',   30, SW_MAIN), f('tree',   80, SW_MAIN), f('tree', 130, SW_MAIN),
      f('tree', -150, SW_FRONT), f('tree',  -50, SW_FRONT), f('tree',  110, SW_FRONT),
      // Vending machines
      f('vending', -90, SW_MAIN, 1, 80), f('vending', 60, SW_FRONT, 1, 80),
      // Benches
      f('bench', -45, SW_FRONT, 1, 60), f('bench', 145, SW_MAIN, 1, 60),
      // Mailboxes
      f('mailbox', -170, SW_FRONT, 1, 40), f('mailbox', 170, SW_MAIN, 1, 40),
      // New furniture types
      f('bicycle', -60, SW_MAIN, 1, 70), f('bicycle', 100, SW_FRONT, 1, 70),
      f('flower_bed', 50, SW_MAIN, 1, 60), f('flower_bed', -140, SW_FRONT, 1, 60),
      f('sign_board', -105, SW_FRONT, 1, 80), f('sign_board', 155, SW_MAIN, 1, 80),
      f('garbage', -30, SW_FRONT, 1, 30), f('garbage', 75, SW_MAIN, 1, 30),
      f('power_pole', -175, SW_MAIN, 1, 50), f('power_pole', 175, SW_FRONT, 1, 50),
      f('hydrant', 35, SW_FRONT, 1, 100), f('hydrant', -55, SW_MAIN, 1, 100),
      f('fountain', 0, SW_MAIN, 2, 200),
      f('parasol', 120, SW_FRONT, 1, 90), f('parasol', -100, SW_MAIN, 1, 90),
      // Traffic lights at alley intersections
      f('traffic_light', -75, SW_MAIN, 1, 100), f('traffic_light', 75, SW_MAIN, 1, 100),
      f('traffic_light', -75, SW_FRONT, 1, 100), f('traffic_light', 75, SW_FRONT, 1, 100),
      // Cars parked
      f('car', -40, SW_MAIN, 1, 120), f('car', 160, SW_FRONT, 1, 120),
    ],
    vehicles: [
      { type: 'car',   lane: 'main',  direction:  1, speed: 60,  interval: 4.0 },
      { type: 'car',   lane: 'main',  direction: -1, speed: 55,  interval: 5.0 },
      { type: 'bus',   lane: 'main',  direction:  1, speed: 40,  interval: 8.0 },
      { type: 'car',   lane: 'front', direction:  1, speed: 50,  interval: 3.5 },
      { type: 'truck', lane: 'front', direction:  1, speed: 35,  interval: 10.0 },
      { type: 'car',   lane: 'back',  direction: -1, speed: 45,  interval: 7.0 },
    ],
    bgTopR: 0.45, bgTopG: 0.68, bgTopB: 0.95,
    bgBottomR: 0.82, bgBottomG: 0.90, bgBottomB: 0.96,
  },

  // ===== Stage 2: 発展する街 =====
  {
    level: 2,
    buildings: [
      // Block A
      b(-158, MAIN_BASE, 'apartment'), b(-130, MAIN_BASE, 'shop'), b(-105, MAIN_BASE, 'apartment'), b(-85, MAIN_BASE, 'shop'),
      // Block B
      b(-35, MAIN_BASE, 'apartment'), b(-5, MAIN_BASE, 'office'), b(30, MAIN_BASE, 'apartment'),
      // Block C
      b(90,  MAIN_BASE, 'shop'), b(115, MAIN_BASE, 'apartment'), b(140, MAIN_BASE, 'office'), b(165, MAIN_BASE, 'shop'),
      // Block D
      b(-155, FRONT_BASE, 'apartment'), b(-125, FRONT_BASE, 'shop'), b(-100, FRONT_BASE, 'apartment'),
      // Block E
      b(-25,  FRONT_BASE, 'office'), b(5,  FRONT_BASE, 'tower'), b(30, FRONT_BASE, 'office'),
      // Block F
      b(100,  FRONT_BASE, 'apartment'), b(125, FRONT_BASE, 'shop'), b(155, FRONT_BASE, 'apartment'),
    ],
    bumpers: [
      { x: -100, y: 10 }, { x: 0, y: 25 }, { x: 100, y: 10 },
      { x:  -50, y: 40 }, { x: 50, y: 40 },
    ],
    furniture: [
      // Trees
      f('tree', -155, SW_MAIN), f('tree', -110, SW_MAIN), f('tree', 60, SW_MAIN), f('tree', 120, SW_MAIN),
      f('tree', -140, SW_FRONT), f('tree',  90, SW_FRONT),
      // Vending machines
      f('vending', -95, SW_FRONT, 1, 80), f('vending', 50, SW_MAIN, 1, 80), f('vending', 155, SW_FRONT, 1, 80),
      // Traffic lights at alley intersections
      f('traffic_light', -75, SW_MAIN,  1, 100),
      f('traffic_light',  75, SW_MAIN,  1, 100),
      f('traffic_light', -75, SW_FRONT, 1, 100),
      f('traffic_light',  75, SW_FRONT, 1, 100),
      // Benches
      f('bench', -35, SW_FRONT, 1, 60), f('bench', 150, SW_MAIN, 1, 60),
      // Mailboxes
      f('mailbox', 170, SW_FRONT, 1, 40),
    ],
    vehicles: [
      { type: 'car',   lane: 'main',  direction:  1, speed: 65,  interval: 3.5 },
      { type: 'car',   lane: 'main',  direction: -1, speed: 60,  interval: 4.5 },
      { type: 'bus',   lane: 'main',  direction:  1, speed: 42,  interval: 7.0 },
      { type: 'car',   lane: 'front', direction:  1, speed: 55,  interval: 3.0 },
      { type: 'truck', lane: 'front', direction: -1, speed: 38,  interval: 9.0 },
      { type: 'car',   lane: 'back',  direction: -1, speed: 50,  interval: 6.0 },
    ],
    bgTopR: 0.40, bgTopG: 0.55, bgTopB: 0.88,
    bgBottomR: 0.75, bgBottomG: 0.82, bgBottomB: 0.92,
  },

  // ===== Stage 3: 都市化 =====
  {
    level: 3,
    buildings: [
      // Block A
      b(-158, MAIN_BASE, 'office'), b(-128, MAIN_BASE, 'apartment'), b(-100, MAIN_BASE, 'office'), b(-80, MAIN_BASE, 'apartment'),
      // Block B
      b(-30, MAIN_BASE, 'tower'), b(0, MAIN_BASE, 'office'), b(30, MAIN_BASE, 'tower'),
      // Block C
      b(88,  MAIN_BASE, 'apartment'), b(112, MAIN_BASE, 'office'), b(138, MAIN_BASE, 'apartment'), b(163, MAIN_BASE, 'office'),
      // Block D
      b(-155, FRONT_BASE, 'office'), b(-122, FRONT_BASE, 'apartment'), b(-97, FRONT_BASE, 'office'),
      // Block E
      b(-22, FRONT_BASE, 'tower'), b(5, FRONT_BASE, 'tower'), b(32, FRONT_BASE, 'office'),
      // Block F
      b(98,  FRONT_BASE, 'office'), b(125, FRONT_BASE, 'apartment'), b(155, FRONT_BASE, 'office'),
    ],
    bumpers: [
      { x: -110, y: 5 }, { x: -40, y: 28 }, { x: 40, y: 28 }, { x: 110, y: 5 },
      { x: 0, y: 12 },
    ],
    furniture: [
      // Trees (fewer, more urban)
      f('tree', -145, SW_MAIN), f('tree', 140, SW_MAIN), f('tree', -140, SW_FRONT), f('tree', 140, SW_FRONT),
      // Cars parked on main road shoulders
      f('car', -135, SW_MAIN, 1, 120), f('car', -90, SW_MAIN, 1, 120), f('car', 85, SW_MAIN, 1, 120),
      f('car', 130, SW_MAIN, 1, 120),
      f('car', -140, SW_FRONT, 1, 120), f('car', 120, SW_FRONT, 1, 120),
      // Vending machines
      f('vending', -165, SW_FRONT, 1, 80), f('vending', -60, SW_MAIN, 1, 80),
      f('vending', 60, SW_FRONT, 1, 80), f('vending', 163, SW_MAIN, 1, 80),
      // Traffic lights at all intersections
      f('traffic_light', -75, SW_MAIN,  1, 100),
      f('traffic_light',  75, SW_MAIN,  1, 100),
      f('traffic_light', -75, SW_FRONT, 1, 100),
      f('traffic_light',  75, SW_FRONT, 1, 100),
      // Benches
      f('bench', -50, SW_FRONT, 1, 60), f('bench', 50, SW_MAIN, 1, 60),
      // Mailboxes
      f('mailbox', -170, SW_MAIN, 1, 40), f('mailbox', 168, SW_FRONT, 1, 40),
    ],
    vehicles: [
      { type: 'car',   lane: 'main',  direction:  1, speed: 70,  interval: 3.0 },
      { type: 'car',   lane: 'main',  direction: -1, speed: 65,  interval: 4.0 },
      { type: 'bus',   lane: 'main',  direction: -1, speed: 45,  interval: 6.5 },
      { type: 'truck', lane: 'main',  direction:  1, speed: 40,  interval: 8.0 },
      { type: 'car',   lane: 'front', direction:  1, speed: 60,  interval: 2.5 },
      { type: 'car',   lane: 'back',  direction: -1, speed: 55,  interval: 5.0 },
    ],
    bgTopR: 0.35, bgTopG: 0.48, bgTopB: 0.80,
    bgBottomR: 0.68, bgBottomG: 0.75, bgBottomB: 0.88,
  },

  // ===== Stage 4: 大都市 =====
  {
    level: 4,
    buildings: [
      // Block A
      b(-155, MAIN_BASE, 'tower'), b(-122, MAIN_BASE, 'office'), b(-95, MAIN_BASE, 'tower'), b(-75, MAIN_BASE, 'office'),
      // Block B (center: skyscraper)
      b(-30, MAIN_BASE, 'tower'), b(0, MAIN_BASE, 'skyscraper'), b(30, MAIN_BASE, 'tower'),
      // Block C
      b(80,  MAIN_BASE, 'office'), b(102, MAIN_BASE, 'tower'), b(130, MAIN_BASE, 'office'), b(160, MAIN_BASE, 'tower'),
      // Block D
      b(-155, FRONT_BASE, 'tower'), b(-122, FRONT_BASE, 'office'), b(-95, FRONT_BASE, 'apartment'),
      // Block E
      b(-22, FRONT_BASE, 'skyscraper'), b(5, FRONT_BASE, 'tower'), b(28, FRONT_BASE, 'skyscraper'),
      // Block F
      b(95,  FRONT_BASE, 'apartment'), b(122, FRONT_BASE, 'tower'), b(155, FRONT_BASE, 'office'),
    ],
    bumpers: [
      { x: -120, y: 0 }, { x: -60, y: 32 }, { x: 0, y: 15 }, { x: 60, y: 32 }, { x: 120, y: 0 },
    ],
    furniture: [
      // Cars dense
      f('car', -160, SW_MAIN, 1, 120), f('car', -118, SW_MAIN, 1, 120), f('car', -80, SW_MAIN, 1, 120),
      f('car',   80, SW_MAIN, 1, 120), f('car',  118, SW_MAIN, 1, 120), f('car', 158, SW_MAIN, 1, 120),
      f('car', -155, SW_FRONT, 1, 120), f('car', -100, SW_FRONT, 1, 120),
      f('car',  100, SW_FRONT, 1, 120), f('car',  155, SW_FRONT, 1, 120),
      // Vending machines
      f('vending', -70, SW_MAIN, 1, 80), f('vending', 65, SW_MAIN, 1, 80),
      f('vending', -70, SW_FRONT, 1, 80), f('vending', 65, SW_FRONT, 1, 80),
      // Traffic lights at all intersections
      f('traffic_light', -75, SW_MAIN,  1, 100),
      f('traffic_light',  75, SW_MAIN,  1, 100),
      f('traffic_light', -75, SW_FRONT, 1, 100),
      f('traffic_light',  75, SW_FRONT, 1, 100),
      // Trees (sparse)
      f('tree', -170, SW_FRONT), f('tree', 170, SW_FRONT),
      // Mailboxes
      f('mailbox', -50, SW_MAIN, 1, 40), f('mailbox', 50, SW_FRONT, 1, 40),
      // Benches
      f('bench', -165, SW_FRONT, 1, 60), f('bench', 163, SW_MAIN, 1, 60),
    ],
    vehicles: [
      { type: 'car',   lane: 'main',  direction:  1, speed: 75,  interval: 2.5 },
      { type: 'car',   lane: 'main',  direction: -1, speed: 70,  interval: 3.0 },
      { type: 'bus',   lane: 'main',  direction:  1, speed: 48,  interval: 6.0 },
      { type: 'truck', lane: 'main',  direction: -1, speed: 42,  interval: 7.5 },
      { type: 'car',   lane: 'front', direction:  1, speed: 65,  interval: 2.0 },
      { type: 'car',   lane: 'back',  direction: -1, speed: 60,  interval: 4.0 },
    ],
    bgTopR: 0.30, bgTopG: 0.40, bgTopB: 0.72,
    bgBottomR: 0.60, bgBottomG: 0.68, bgBottomB: 0.82,
  },
];

export function getStage(level: number): StageConfig {
  if (level <= STAGES.length) return STAGES[level - 1];
  // For levels beyond what's defined, scale up stage 1
  const base = STAGES[0];
  const scale = 1 + (level - 1) * 0.2;
  return {
    ...base,
    level,
    buildings: base.buildings.map(bld => ({ ...bld })),
  };
}
