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
export const BALL_RADIUS = 9;            // ボール半径 (固定)
export const BALL_MIN_REPEL_SPEED = 4;   // 非破壊時の最小反発速度 (乗り続け防止)
export const GRAVITY = 0.3;
export const MAX_BALL_SPEED = 25;
export const WALL_DAMPING = 0.78;
// ランチャーなし: 左の坂上端付近からスポーン → 坂を滑ってフリッパーへ
export const BALL_START_X = -150;
export const BALL_START_Y = -100;
export const TRAIL_LEN = 12;

// ===== ウェーブシステム =====
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
export type BuildingSize =
  // ── オリジナル12種 ──
  'house' | 'shop' | 'apartment' | 'office' | 'tower' | 'skyscraper' |
  'convenience' | 'restaurant' | 'school' | 'hospital' | 'temple' | 'parking' |
  // ── 1-A 住宅系 ──
  'townhouse' | 'mansion' | 'garage' | 'shed' | 'greenhouse' |
  'daycare' | 'clinic' | 'shrine' | 'apartment_tall' |
  // ── 1-B 商業系 ──
  'cafe' | 'bakery' | 'bookstore' | 'pharmacy' | 'supermarket' |
  'karaoke' | 'pachinko' | 'laundromat' | 'florist' | 'ramen' | 'izakaya' | 'game_center' |
  // ── 1-C 公共系 ──
  'bank' | 'post_office' | 'library' | 'museum' | 'city_hall' |
  'fire_station' | 'police_station' | 'train_station' | 'movie_theater' | 'gas_station' |
  // ── 1-D ランドマーク ──
  'clock_tower' | 'radio_tower' | 'ferris_wheel' | 'stadium' | 'water_tower' |
  // ── 特大施設 ──
  'department_store';

export const BUILDING_DEFS: Record<BuildingSize, {
  w: number; h: number; hp: number; score: number; humanMin: number; humanMax: number
}> = {
  // ===== オリジナル =====
  // hp 4段階: 4(極小→power12で1撃), 8(小→power28), 11(中→power40), 13(大→power48)
  // score: hp ティアに応じてスケール。humanMin/Max: 建物用途・規模に応じたリアル人数
  house:          { w: 16, h: 20, hp:  8, score:  150, humanMin:  3,  humanMax:  7  },
  convenience:    { w: 24, h: 22, hp:  8, score:  200, humanMin:  8,  humanMax: 15  },
  shop:           { w: 22, h: 25, hp:  8, score:  250, humanMin: 10,  humanMax: 20  },
  restaurant:     { w: 20, h: 28, hp:  8, score:  250, humanMin: 15,  humanMax: 30  },
  apartment:      { w: 24, h: 40, hp: 11, score:  400, humanMin: 35,  humanMax: 65  },
  temple:         { w: 30, h: 30, hp: 11, score:  600, humanMin: 20,  humanMax: 45  },
  parking:        { w: 36, h: 35, hp: 11, score:  300, humanMin: 25,  humanMax: 55  },
  office:         { w: 30, h: 55, hp: 13, score:  900, humanMin: 150, humanMax: 250 },
  tower:          { w: 35, h: 70, hp: 13, score: 1200, humanMin: 180, humanMax: 300 },
  skyscraper:     { w: 28, h: 90, hp: 13, score: 2000, humanMin: 220, humanMax: 380 },
  hospital:       { w: 35, h: 50, hp: 13, score: 1000, humanMin: 130, humanMax: 220 },
  school:         { w: 40, h: 45, hp: 13, score: 1000, humanMin: 180, humanMax: 300 },
  // ===== 1-A 住宅系 =====
  townhouse:      { w: 18, h: 24, hp:  8, score:  200, humanMin:  4,  humanMax:  9  },
  mansion:        { w: 32, h: 28, hp:  8, score:  500, humanMin:  6,  humanMax: 16  },
  garage:         { w: 20, h: 14, hp:  4, score:  120, humanMin:  1,  humanMax:  4  },
  shed:           { w: 12, h: 12, hp:  4, score:   80, humanMin:  0,  humanMax:  2  },
  greenhouse:     { w: 22, h: 18, hp:  8, score:  130, humanMin:  2,  humanMax:  6  },
  daycare:        { w: 28, h: 22, hp:  8, score:  220, humanMin: 15,  humanMax: 30  },
  clinic:         { w: 26, h: 28, hp:  8, score:  300, humanMin: 18,  humanMax: 35  },
  shrine:         { w: 26, h: 28, hp: 11, score:  500, humanMin: 15,  humanMax: 35  },
  apartment_tall: { w: 26, h: 58, hp: 13, score:  800, humanMin: 90,  humanMax: 160 },
  // ===== 1-B 商業系 =====
  cafe:           { w: 18, h: 20, hp:  8, score:  200, humanMin: 12,  humanMax: 22  },
  bakery:         { w: 16, h: 18, hp:  8, score:  180, humanMin:  8,  humanMax: 16  },
  bookstore:      { w: 18, h: 22, hp:  8, score:  200, humanMin:  8,  humanMax: 15  },
  pharmacy:       { w: 20, h: 22, hp:  8, score:  200, humanMin:  8,  humanMax: 14  },
  supermarket:    { w: 40, h: 28, hp: 11, score:  500, humanMin: 55,  humanMax: 100 },
  karaoke:        { w: 24, h: 30, hp: 11, score:  400, humanMin: 30,  humanMax: 60  },
  pachinko:       { w: 30, h: 28, hp: 11, score:  400, humanMin: 40,  humanMax: 70  },
  laundromat:     { w: 18, h: 18, hp:  8, score:  150, humanMin:  5,  humanMax: 12  },
  florist:        { w: 14, h: 18, hp:  8, score:  160, humanMin:  5,  humanMax: 10  },
  ramen:          { w: 16, h: 20, hp:  8, score:  200, humanMin: 10,  humanMax: 22  },
  izakaya:        { w: 20, h: 22, hp:  8, score:  220, humanMin: 15,  humanMax: 30  },
  game_center:    { w: 28, h: 26, hp: 11, score:  400, humanMin: 35,  humanMax: 65  },
  // ===== 1-C 公共系 =====
  bank:           { w: 28, h: 32, hp: 11, score:  700, humanMin: 20,  humanMax: 45  },
  post_office:    { w: 24, h: 26, hp:  8, score:  250, humanMin: 12,  humanMax: 25  },
  library:        { w: 36, h: 34, hp: 11, score:  600, humanMin: 25,  humanMax: 55  },
  museum:         { w: 40, h: 38, hp: 11, score:  800, humanMin: 50,  humanMax: 100 },
  city_hall:      { w: 40, h: 44, hp: 13, score: 1200, humanMin: 70,  humanMax: 130 },
  fire_station:   { w: 30, h: 30, hp: 11, score:  450, humanMin: 10,  humanMax: 22  },
  police_station: { w: 30, h: 32, hp: 11, score:  500, humanMin: 15,  humanMax: 30  },
  train_station:  { w: 50, h: 36, hp: 13, score: 1500, humanMin: 100, humanMax: 200 },
  movie_theater:  { w: 38, h: 32, hp: 11, score:  700, humanMin: 70,  humanMax: 130 },
  gas_station:    { w: 30, h: 18, hp:  4, score:  300, humanMin:  3,  humanMax:  8  },
  // ===== 1-D ランドマーク =====
  clock_tower:    { w: 16, h: 68, hp: 11, score:  600, humanMin:  5,  humanMax: 12  },
  radio_tower:    { w: 10, h: 88, hp: 13, score:  800, humanMin:  2,  humanMax:  8  },
  ferris_wheel:   { w: 44, h: 48, hp: 13, score: 1200, humanMin: 20,  humanMax: 50  },
  stadium:        { w: 60, h: 38, hp: 13, score: 3000, humanMin: 200, humanMax: 400 },
  water_tower:    { w: 18, h: 48, hp:  4, score:  200, humanMin:  0,  humanMax:  3  },
  // ===== 特大施設 =====
  department_store: { w: 54, h: 38, hp: 13, score: 1500, humanMin: 130, humanMax: 250 },
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

// 縦道路 (grid 整列、左右対称)
// 旧名 ALLEY_1_X/ALLEY_2_X は互換のため残すが、grid 整列位置に移動
export const ALLEY_1_X   = -90;
export const ALLEY_2_X   =  90;
export const ALLEY_WIDTH  = 14;
export const ALLEY_Y_MIN  = -290; // 画面下端まで
export const ALLEY_Y_MAX  = 244;  // 丘まで

// ===== グリッド仕様 =====
// 世界幅 360 を 4 等分。縦道路は列境界に走る。
export const CELL_W = 90;
export const CELL_H = 100;
export const GRID_COLS = 4;
// 縦道路候補 X (5 本: 両端 2 本は世界壁、内部 3 本が引かれる)
export const VERT_ROAD_XS: ReadonlyArray<number> = [-180, -90, 0, 90, 180];
// 内部縦道路 X (世界壁を除いた実際の道路位置)
export const INNER_VERT_ROAD_XS: ReadonlyArray<number> = [-90, 0, 90];

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

// 道路ディテール
export const CURB_COLOR:       readonly [number,number,number,number] = [0.22, 0.22, 0.24, 1];
export const MANHOLE_COLOR:    readonly [number,number,number,number] = [0.18, 0.18, 0.20, 1];
export const CROSSWALK_COLOR:  readonly [number,number,number,number] = [0.92, 0.92, 0.92, 0.9];
export const STOPLINE_COLOR:   readonly [number,number,number,number] = [0.92, 0.92, 0.92, 0.85];
export const PAVING_COLOR:     readonly [number,number,number,number] = [0.72, 0.70, 0.64, 0.35];
export const INTERSECTION_COLOR: readonly [number,number,number,number] = [0.46, 0.46, 0.48, 1];
export const BRIDGE_COLOR:     readonly [number,number,number,number] = [0.58, 0.48, 0.38, 1];
export const BRIDGE_RAIL_COLOR: readonly [number,number,number,number] = [0.38, 0.32, 0.26, 1];

// ===== 自動スクロール =====
export const SCROLL_BASE_SPEED   = 0;    // カメラ上昇速度 px/s (初期値: 人間を潰して初めて動き出す)
export const SCROLL_DECAY        = 1;    // px/s² : scrollSpeed が毎秒この量だけ 0 に向かって減衰
export const HUMAN_SCROLL_GAIN   = 3;    // 人間 1 体で scrollSpeed に +N px/s
// ===== ダメージ (ボール速度依存) =====
export const BALL_DAMAGE_DIVISOR = 3;    // dmg = max(1, floor(ballSpeed / DIV))

// ===== タイマー / ノルマ =====
export const TIMER_INITIAL_SEC     = 30;  // 開始時の残り時間
export const CHECKPOINT_INTERVAL_M = 100; // 次チェックポイントまでの距離 (m)
export const CHECKPOINT_BONUS_SEC  = 30;  // 到達ボーナス秒数

// ===== チャンク生成 =====
export const CHUNK_HEIGHT         = 200; // 1チャンクの高さ (px)
export const CHUNK_SPAWN_AHEAD    = 600; // カメラ上端から先読みする距離
export const CHUNK_DESPAWN_BEHIND = 400; // カメラ下端から削除する距離



// ===== SFCシムシティ風ゾーン色 =====
export const ZONE_RESIDENTIAL: readonly [number,number,number,number] = [0.38, 0.62, 0.28, 1];  // 明るい緑
export const ZONE_COMMERCIAL:  readonly [number,number,number,number] = [0.62, 0.56, 0.44, 1];  // 暖かみのある茶
export const ZONE_RIVERSIDE:   readonly [number,number,number,number] = [0.30, 0.55, 0.32, 1];
export const ZONE_SLOPE:       readonly [number,number,number,number] = [0.28, 0.50, 0.28, 1];
export const PLANTING_COLOR:   readonly [number,number,number,number] = [0.30, 0.58, 0.25, 1];
// チャンクゾーン色
export const ZONE_OFFICE_BG:   readonly [number,number,number,number] = [0.48, 0.50, 0.58, 1];  // スチールグレー
// 特殊エリア
export const PARK_GROUND_COLOR:     readonly [number,number,number,number] = [0.28, 0.58, 0.22, 1];
export const PARK_PATH_COLOR:       readonly [number,number,number,number] = [0.58, 0.52, 0.38, 1];
export const PARKING_LOT_COLOR:     readonly [number,number,number,number] = [0.30, 0.30, 0.32, 1];
export const PARKING_LINE_COLOR:    readonly [number,number,number,number] = [0.68, 0.68, 0.68, 1];
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
