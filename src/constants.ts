// ===== スクリーン =====
export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 580;
export const WORLD_MIN_X = -180;
export const WORLD_MAX_X = 180;
export const WORLD_MIN_Y = -290;
export const WORLD_MAX_Y = 290;

// ===== ゾーン Y境界 =====
export const STREET_Y_MIN = 40;
export const STREET_Y_MAX = 250;
export const FLIPPER_PIVOT_X = 85;   // フリッパーピボットX（両側、符号は左右で反転）
export const FLIPPER_PIVOT_Y = -165; // フリッパーピボットY（坂との接合点）
export const FALLOFF_Y = -275;       // これ以下でボールロスト

// ===== ボール =====
export const BALL_RADIUS = 9;
export const GRAVITY = 0.3;
export const MAX_BALL_SPEED = 25;
export const WALL_DAMPING = 0.78;
// ランチャーなし: 左の坂上端付近からスポーン → 坂を滑ってフリッパーへ
export const BALL_START_X = -150;
export const BALL_START_Y = -88;
export const TRAIL_LEN = 12;
export const INITIAL_BALLS = 3;

// ===== フリッパー =====
export const FLIPPER_W = 80;
export const FLIPPER_H = 12;
export const FLIPPER_REST_DEG = -30;
export const FLIPPER_ACTIVE_DEG = 30;
export const FLIPPER_POWER = 16;
export const FLIPPER_SPEED_DEG = 420; // deg/s

// ===== 建物 =====
export type BuildingSize = 'house' | 'shop' | 'apartment' | 'office' | 'tower' | 'skyscraper';
export const BUILDING_DEFS: Record<BuildingSize, {
  w: number; h: number; hp: number; score: number; humanMin: number; humanMax: number
}> = {
  house:      { w: 16, h: 20, hp: 1, score: 100,  humanMin: 4,  humanMax: 8  },
  shop:       { w: 22, h: 25, hp: 1, score: 150,  humanMin: 5,  humanMax: 10 },
  apartment:  { w: 24, h: 40, hp: 2, score: 300,  humanMin: 8,  humanMax: 15 },
  office:     { w: 30, h: 55, hp: 2, score: 400,  humanMin: 10, humanMax: 18 },
  tower:      { w: 35, h: 70, hp: 3, score: 600,  humanMin: 15, humanMax: 25 },
  skyscraper: { w: 28, h: 90, hp: 4, score: 1000, humanMin: 20, humanMax: 30 },
};

// ===== 人間 =====
export const MAX_HUMANS = 2000;
export const HUMAN_W = 3;
export const HUMAN_H = 6;
export const HUMAN_BASE_SPEED = 65; // px/s
export const HUMAN_FEAR_BOOST = 1.8;
export const HUMAN_FEAR_RADIUS = 60;
export const HUMAN_CRUSH_SCORE = 100;
export const HUMAN_DIR_CHANGE_MIN = 0.5;
export const HUMAN_DIR_CHANGE_MAX = 1.5;

// ===== パーティクル =====
export const MAX_PARTICLES = 2000;

// ===== バンパー =====
export const BUMPER_RADIUS = 18;
export const BUMPER_SCORE = 50;
export const BUMPER_FORCE = 14;

// ===== コンボ =====
export const COMBO_TIMEOUT = 1.0;
export const COMBO_SLOW_THRESHOLD = 5;
export const COMBO_MAX = 10;

// ===== ジュース: シェイク =====
export const SHAKE_HUMAN_AMP   = 1.5;
export const SHAKE_HUMAN_DUR   = 0.05;
export const SHAKE_HIT_AMP     = 3;
export const SHAKE_HIT_DUR     = 0.08;
export const SHAKE_DEST_AMP    = 6;
export const SHAKE_DEST_DUR    = 0.12;
export const SHAKE_LARGE_AMP   = 10;
export const SHAKE_LARGE_DUR   = 0.20;

// ===== ジュース: ヒットストップ =====
export const HITSTOP_SMALL = 3;  // frames
export const HITSTOP_LARGE = 5;

// ===== 街レイアウト: 3本の横道路 =====
export const BACK_STREET_Y        = 240;  // 奥の通り 中心Y
export const BACK_STREET_H        = 12;
export const BACK_SIDEWALK_H      = 4;

export const MAIN_STREET_Y        = 130;  // メイン道路 中心Y
export const MAIN_STREET_H        = 24;
export const MAIN_SIDEWALK_H      = 4;

export const FRONT_STREET_Y       = 40;   // 手前の通り 中心Y
export const FRONT_STREET_H       = 16;
export const FRONT_SIDEWALK_H     = 4;

// 後方互換 (旧名称 → 新名称)
export const BACK_STREET_HEIGHT   = BACK_STREET_H;
export const BACK_SIDEWALK_HEIGHT = BACK_SIDEWALK_H;
export const FRONT_STREET_HEIGHT  = FRONT_STREET_H;
export const FRONT_SIDEWALK_HEIGHT= FRONT_SIDEWALK_H;

// 2本の縦路地
export const ALLEY_1_X   = -65;  // 路地1 中心X
export const ALLEY_WIDTH  = 20;
export const ALLEY_2_X   =  65;  // 路地2 中心X
export const ALLEY_Y_MIN = 48;   // 路地の縦範囲 (hand road sidewalk up to back road sidewalk)
export const ALLEY_Y_MAX = 234;

// ベースライン (ビル接地点 = 歩道上端)
export const BACK_BASE  = BACK_STREET_Y  + BACK_STREET_H  / 2 + BACK_SIDEWALK_H;  // 250: 装飾用背景ビル
export const MAIN_BASE  = MAIN_STREET_Y  + MAIN_STREET_H  / 2 + MAIN_SIDEWALK_H;  // 146: ブロックA/B/C
export const FRONT_BASE = FRONT_STREET_Y + FRONT_STREET_H / 2 + FRONT_SIDEWALK_H; // 52:  ブロックD/E/F

// 6ブロックの境界
export const BLOCK_ABC_Y_MIN  = MAIN_BASE;   // 146
export const BLOCK_ABC_Y_MAX  = BACK_BASE;   // 250
export const BLOCK_DEF_Y_MIN  = FRONT_BASE;  // 52
export const BLOCK_DEF_Y_MAX  = MAIN_STREET_Y - MAIN_STREET_H / 2 - MAIN_SIDEWALK_H; // 118

export const BLOCK_LEFT_X_MIN  = -180;
export const BLOCK_LEFT_X_MAX  = -75;
export const BLOCK_MID_X_MIN   = -55;
export const BLOCK_MID_X_MAX   =  55;
export const BLOCK_RIGHT_X_MIN =  75;
export const BLOCK_RIGHT_X_MAX =  180;

// 道路・歩道の色
export const ROAD_COLOR:      readonly [number,number,number,number] = [0.12, 0.12, 0.14, 1];
export const SIDEWALK_COLOR:  readonly [number,number,number,number] = [0.20, 0.20, 0.22, 1];
export const ROAD_LINE_COLOR: readonly [number,number,number,number] = [0.35, 0.35, 0.20, 1];
export const ALLEY_COLOR:     readonly [number,number,number,number] = [0.10, 0.10, 0.12, 1];

// ===== 街灯 =====
export const STREETLIGHT_POLE_W = 1.5;
export const STREETLIGHT_POLE_H = 18;
export const STREETLIGHT_POLE_COLOR: readonly [number,number,number,number] = [0.25, 0.25, 0.28, 1];
export const STREETLIGHT_BULB_R = 2.5;
export const STREETLIGHT_BULB_COLOR: readonly [number,number,number,number] = [1.0, 0.9, 0.5, 0.7];

export const STREETLIGHTS: ReadonlyArray<{ x: number; base: number }> = [
  { x: -155, base: MAIN_BASE }, { x: -100, base: MAIN_BASE },
  { x:  -30, base: MAIN_BASE }, { x:   30, base: MAIN_BASE },
  { x:  100, base: MAIN_BASE }, { x:  155, base: MAIN_BASE },
  { x: -140, base: FRONT_BASE }, { x:  -40, base: FRONT_BASE },
  { x:   50, base: FRONT_BASE }, { x:  140, base: FRONT_BASE },
];

// ===== 街路樹・調度品 =====
export const TREE_W = 8;
export const TREE_H = 14;
export const TREE_COLOR: readonly [number,number,number,number] = [0.15, 0.45, 0.15, 1];

export const VENDING_W = 5;
export const VENDING_H = 10;

export const BENCH_W = 8;
export const BENCH_H = 4;

export const CAR_W = 20;
export const CAR_H = 10;

export const MAILBOX_W = 4;
export const MAILBOX_H = 6;

// 信号機
export const TRAFFIC_LIGHT_W = 4;
export const TRAFFIC_LIGHT_H = 10;

// ===== 人間の行動範囲 =====
export const HUMAN_Y_MIN = FRONT_STREET_Y - 8;  // ~32
export const HUMAN_Y_MAX = BACK_STREET_Y  + 8;  // ~248
