// ===== スクリーン =====
export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 580;
export const WORLD_MIN_X = -180;
export const WORLD_MAX_X = 180;
export const WORLD_MIN_Y = -290;
export const WORLD_MAX_Y = 290;

// ===== ゾーン Y境界 =====
export const FLIPPER_PIVOT_X = 85;   // フリッパーピボットX（両側、符号は左右で反転）
export const FLIPPER_PIVOT_Y = -210; // フリッパーピボットY（坂との接合点）
export const FALLOFF_Y = -285;       // これ以下でボールロスト

// ===== ボール =====
export const BALL_RADIUS = 9;
export const GRAVITY = 0.3;
export const MAX_BALL_SPEED = 25;
export const WALL_DAMPING = 0.78;
// ランチャーなし: 左の坂上端付近からスポーン → 坂を滑ってフリッパーへ
export const BALL_START_X = -150;
export const BALL_START_Y = -100;
export const TRAIL_LEN = 12;

// ===== ウェーブシステム =====
export const WAVE_TIME           = 30;   // ライフタイマー初期値(秒)
export const BALL_LOST_PENALTY   = 5;    // ボールロスト時のペナルティ(秒)
export const TIME_PER_HUMAN      = 2;    // 人間1人潰すごとに回復する秒数
export const WAVE_DURATION       = 60;   // 何秒ごとにwave++するか
export const RUBBLE_DURATION     = 5;    // 瓦礫が残る時間(秒)
export const SPAWN_ANIM_DURATION = 0.35; // 建物スポーンアニメーション時間(秒)
export const REBUILD_BASE_COOLDOWN = 8;  // 再建基準クールダウン(秒)

// ===== フリッパー =====
export const FLIPPER_W = 80;
export const FLIPPER_H = 12;
export const FLIPPER_REST_DEG = -30;
export const FLIPPER_ACTIVE_DEG = 30;
export const FLIPPER_POWER = 16;
export const FLIPPER_SPEED_DEG = 420; // deg/s

// ===== 建物 =====
export type BuildingSize = 'house' | 'shop' | 'apartment' | 'office' | 'tower' | 'skyscraper' | 'convenience' | 'restaurant' | 'school' | 'hospital' | 'temple' | 'parking';
export const BUILDING_DEFS: Record<BuildingSize, {
  w: number; h: number; hp: number; score: number; humanMin: number; humanMax: number
}> = {
  // ===== 下段: 家 (~5人) =====
  house:       { w: 16, h: 20, hp: 1, score: 100,  humanMin: 3,   humanMax: 7   },
  convenience: { w: 24, h: 22, hp: 1, score: 120,  humanMin: 3,   humanMax: 7   },
  // ===== 中段: 店 (~50人) =====
  shop:        { w: 22, h: 25, hp: 1, score: 150,  humanMin: 40,  humanMax: 60  },
  restaurant:  { w: 20, h: 28, hp: 1, score: 130,  humanMin: 40,  humanMax: 60  },
  apartment:   { w: 24, h: 40, hp: 2, score: 300,  humanMin: 40,  humanMax: 65  },
  temple:      { w: 30, h: 30, hp: 2, score: 350,  humanMin: 35,  humanMax: 55  },
  parking:     { w: 36, h: 35, hp: 2, score: 300,  humanMin: 30,  humanMax: 50  },
  // ===== 上段: ビル (~300人) =====
  office:      { w: 30, h: 55, hp: 2, score: 400,  humanMin: 220, humanMax: 300 },
  tower:       { w: 35, h: 70, hp: 3, score: 600,  humanMin: 240, humanMax: 320 },
  skyscraper:  { w: 28, h: 90, hp: 4, score: 1000, humanMin: 260, humanMax: 350 },
  hospital:    { w: 35, h: 50, hp: 3, score: 500,  humanMin: 200, humanMax: 280 },
  school:      { w: 40, h: 45, hp: 3, score: 550,  humanMin: 260, humanMax: 350 },
};

// ===== 人間 =====
export const MAX_HUMANS = 5000;
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
export const HITSTOP_SMALL  = 1;  // frames（建物小）
export const HITSTOP_LARGE  = 2;  // frames（建物大）

// ===== 街レイアウト: 4本の横道路（均等間隔）=====
export const HILLTOP_STREET_Y   = 240;  export const HILLTOP_STREET_H   = 10;
// UPPER 削除 — 間隔を均等に再配置
export const MAIN_STREET_Y      = 133;  export const MAIN_STREET_H      = 18;
export const LOWER_STREET_Y     = 26;   export const LOWER_STREET_H     = 16;
export const RIVERSIDE_STREET_Y = -80;  export const RIVERSIDE_STREET_H = 12;

export const SIDEWALK_H = 4;

// 建物配置グリッド: 上段1列・中段2列・下段3列
// ===== 上段: ビル1列 =====
export const ZONE_TOP_Y0    = 162;   // ビル列 baseY（下端）
// ===== 中段: 店2列 =====
export const ZONE_MID_Y0    = 86;    // 店・奥列 baseY  (top≈116, <MAIN下端120)
export const ZONE_MID_Y1    = 52;    // 店・手前列 baseY (top≈82,  <奥列86)
// ===== 下段: 家3列 =====
export const ZONE_BOT_Y0    = -12;   // 家・奥列 baseY  (top≈10,  <LOWER下端14)
export const ZONE_BOT_Y1    = -36;   // 家・中列 baseY  (top≈-14, <奥列-12)
export const ZONE_BOT_Y2    = -60;   // 家・手前列 baseY (top≈-40, <中列-36)
// tryRebuild フォールバック
export const REBUILD_FALLBACK_Y = ZONE_MID_Y0;

// 路地 (非対称)
export const ALLEY_1_X   = -50;
export const ALLEY_2_X   =  80;
export const ALLEY_WIDTH  = 18;
export const ALLEY_Y_MIN  = -290; // 画面下端まで
export const ALLEY_Y_MAX  = 244;  // 丘まで

// 街の範囲
export const STREET_Y_MIN = -88;  // RIVERSIDE - 8
export const STREET_Y_MAX = 250;

// 人間の行動範囲
export const HUMAN_Y_MIN = RIVERSIDE_STREET_Y - 8;  // -88
export const HUMAN_Y_MAX = HILLTOP_STREET_Y   + 8;  // 248

// 道路・歩道の色
export const ROAD_COLOR:      readonly [number,number,number,number] = [0.40, 0.40, 0.42, 1];
export const SIDEWALK_COLOR:  readonly [number,number,number,number] = [0.60, 0.58, 0.52, 1];
export const ROAD_LINE_COLOR: readonly [number,number,number,number] = [0.85, 0.85, 0.45, 1];
export const ALLEY_COLOR:     readonly [number,number,number,number] = [0.38, 0.38, 0.35, 1];

// ===== SFCシムシティ風ゾーン色 =====
export const ZONE_RESIDENTIAL: readonly [number,number,number,number] = [0.35, 0.65, 0.28, 1];
export const ZONE_COMMERCIAL:  readonly [number,number,number,number] = [0.55, 0.55, 0.48, 1];
export const ZONE_RIVERSIDE:   readonly [number,number,number,number] = [0.30, 0.55, 0.32, 1];
export const ZONE_SLOPE:       readonly [number,number,number,number] = [0.28, 0.50, 0.28, 1];
export const PLANTING_COLOR:   readonly [number,number,number,number] = [0.30, 0.58, 0.25, 1];
export const RIVER_COLOR:      readonly [number,number,number,number] = [0.18, 0.42, 0.72, 1];
export const RIVER_LIGHT:      readonly [number,number,number,number] = [0.35, 0.60, 0.85, 0.6];
export const RIVER_BANK:       readonly [number,number,number,number] = [0.35, 0.50, 0.30, 1];

// ===== 街灯 =====
export const STREETLIGHT_POLE_W = 1.5;
export const STREETLIGHT_POLE_H = 18;
export const STREETLIGHT_POLE_COLOR: readonly [number,number,number,number] = [0.25, 0.25, 0.28, 1];
export const STREETLIGHT_BULB_R = 2.5;
export const STREETLIGHT_BULB_COLOR: readonly [number,number,number,number] = [1.0, 0.9, 0.5, 0.0];

export const STREETLIGHTS: ReadonlyArray<{ x: number; base: number }> = [
  // MAIN道路沿い (sidewalk top ≈ 146)
  { x: -160, base: MAIN_STREET_Y + MAIN_STREET_H/2 + SIDEWALK_H },
  { x:  -80, base: MAIN_STREET_Y + MAIN_STREET_H/2 + SIDEWALK_H },
  { x:    0, base: MAIN_STREET_Y + MAIN_STREET_H/2 + SIDEWALK_H },
  { x:   80, base: MAIN_STREET_Y + MAIN_STREET_H/2 + SIDEWALK_H },
  { x:  160, base: MAIN_STREET_Y + MAIN_STREET_H/2 + SIDEWALK_H },
  // LOWER道路沿い (sidewalk top ≈ 38)
  { x: -120, base: LOWER_STREET_Y + LOWER_STREET_H/2 + SIDEWALK_H },
  { x:   60, base: LOWER_STREET_Y + LOWER_STREET_H/2 + SIDEWALK_H },
];

// ===== 街路樹・調度品 =====
export const TREE_W = 8;
export const TREE_H = 14;
export const TREE_COLOR: readonly [number,number,number,number] = [0.25, 0.60, 0.25, 1];

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
