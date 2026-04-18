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
// リアルピンボール寄り: 穏やかな打ち出し + 緩い重力で滞空時間を確保
// 建物ヒットでの減速は一切なし (HP > 0 なら反射、HP ≤ 0 なら貫通=破壊、速度そのまま)
export const BALL_RADIUS = 16;           // ボール半径 (固定)
export const GRAVITY = 0.28;             // やや控えめにしてホールドタイムを確保
export const MAX_BALL_SPEED = 22;        // クランプ上限 (ビル通過・降下時に頭打ちしない程度)
export const WALL_DAMPING = 0.66;        // 壁での反発 (世界端のみ)
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
export const FLIPPER_POWER = 14;     // リアルピンボール寄りの穏やかな蹴り出し
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
  'department_store' |
  // ── 港湾・工業 (Stage 4) ──
  'warehouse' | 'crane_gantry' | 'container_stack' | 'factory_stack' | 'silo' |
  // ── 和風・古都 (Stage 3) ──
  'pagoda' | 'ryokan' | 'kominka' | 'chaya' |
  // ── テーマパーク・祭り (Stage 5) ──
  'carousel' | 'roller_coaster' | 'yatai' | 'big_tent' |
  // ── Stage 1 ミニチュア追加 ──
  'shotengai_arcade' | 'bus_terminal_shelter' | 'fountain_pavilion' |
  // ── Stage 2 夜街追加 ──
  'snack' | 'love_hotel' | 'business_hotel' | 'mahjong_parlor' | 'club' | 'capsule_hotel' |
  // ── Stage 3 和風追加 ──
  'kura' | 'machiya' | 'onsen_inn' | 'tahoto' |
  // ── Stage 3 和風小建物の追加バリエーション ──
  'dojo' | 'wagashi' | 'kimono_shop' | 'sushi_ya' |
  // ── Stage 1 住宅バリエーション ──
  'bungalow' | 'duplex';

export const BUILDING_DEFS: Record<BuildingSize, {
  w: number; h: number; hp: number; score: number; humanMin: number; humanMax: number
}> = {
  // ===== オリジナル =====
  // hp 3段階 (ヒット数単位): 1(基本=1撃), 2(中・硬そう), 3(大・ランドマーク)
  house:          { w: 16, h: 20, hp: 1, score:  150, humanMin:  3,  humanMax:  7  },
  convenience:    { w: 24, h: 22, hp: 1, score:  200, humanMin:  8,  humanMax: 15  },
  shop:           { w: 22, h: 25, hp: 1, score:  250, humanMin: 10,  humanMax: 20  },
  restaurant:     { w: 20, h: 28, hp: 1, score:  250, humanMin: 15,  humanMax: 30  },
  apartment:      { w: 24, h: 40, hp: 2, score:  400, humanMin: 35,  humanMax: 65  },
  temple:         { w: 30, h: 30, hp: 2, score:  600, humanMin: 20,  humanMax: 45  },
  parking:        { w: 36, h: 35, hp: 2, score:  300, humanMin: 25,  humanMax: 55  },
  office:         { w: 30, h: 55, hp: 3, score:  900, humanMin: 150, humanMax: 250 },
  tower:          { w: 35, h: 70, hp: 3, score: 1200, humanMin: 180, humanMax: 300 },
  skyscraper:     { w: 28, h: 90, hp: 3, score: 2000, humanMin: 220, humanMax: 380 },
  hospital:       { w: 35, h: 50, hp: 3, score: 1000, humanMin: 130, humanMax: 220 },
  school:         { w: 40, h: 45, hp: 3, score: 1000, humanMin: 180, humanMax: 300 },
  // ===== 1-A 住宅系 =====
  townhouse:      { w: 18, h: 24, hp: 1, score:  200, humanMin:  4,  humanMax:  9  },
  mansion:        { w: 32, h: 28, hp: 1, score:  500, humanMin:  6,  humanMax: 16  },
  garage:         { w: 20, h: 14, hp: 1, score:  120, humanMin:  1,  humanMax:  4  },
  shed:           { w: 12, h: 12, hp: 1, score:   80, humanMin:  0,  humanMax:  2  },
  greenhouse:     { w: 22, h: 18, hp: 1, score:  130, humanMin:  2,  humanMax:  6  },
  daycare:        { w: 28, h: 22, hp: 1, score:  220, humanMin: 15,  humanMax: 30  },
  clinic:         { w: 26, h: 28, hp: 1, score:  300, humanMin: 18,  humanMax: 35  },
  shrine:         { w: 26, h: 28, hp: 2, score:  500, humanMin: 15,  humanMax: 35  },
  apartment_tall: { w: 26, h: 58, hp: 3, score:  800, humanMin: 90,  humanMax: 160 },
  // ===== 1-B 商業系 =====
  cafe:           { w: 18, h: 20, hp: 1, score:  200, humanMin: 12,  humanMax: 22  },
  bakery:         { w: 16, h: 18, hp: 1, score:  180, humanMin:  8,  humanMax: 16  },
  bookstore:      { w: 18, h: 22, hp: 1, score:  200, humanMin:  8,  humanMax: 15  },
  pharmacy:       { w: 20, h: 22, hp: 1, score:  200, humanMin:  8,  humanMax: 14  },
  supermarket:    { w: 40, h: 28, hp: 2, score:  500, humanMin: 55,  humanMax: 100 },
  karaoke:        { w: 24, h: 30, hp: 2, score:  400, humanMin: 30,  humanMax: 60  },
  pachinko:       { w: 30, h: 28, hp: 2, score:  400, humanMin: 40,  humanMax: 70  },
  laundromat:     { w: 18, h: 18, hp: 1, score:  150, humanMin:  5,  humanMax: 12  },
  florist:        { w: 14, h: 18, hp: 1, score:  160, humanMin:  5,  humanMax: 10  },
  ramen:          { w: 16, h: 20, hp: 1, score:  200, humanMin: 10,  humanMax: 22  },
  izakaya:        { w: 20, h: 22, hp: 1, score:  220, humanMin: 15,  humanMax: 30  },
  game_center:    { w: 28, h: 26, hp: 2, score:  400, humanMin: 35,  humanMax: 65  },
  // ===== 1-C 公共系 =====
  bank:           { w: 28, h: 32, hp: 2, score:  700, humanMin: 20,  humanMax: 45  },
  post_office:    { w: 24, h: 26, hp: 1, score:  250, humanMin: 12,  humanMax: 25  },
  library:        { w: 36, h: 34, hp: 2, score:  600, humanMin: 25,  humanMax: 55  },
  museum:         { w: 40, h: 38, hp: 2, score:  800, humanMin: 50,  humanMax: 100 },
  city_hall:      { w: 40, h: 44, hp: 3, score: 1200, humanMin: 70,  humanMax: 130 },
  fire_station:   { w: 30, h: 30, hp: 2, score:  450, humanMin: 10,  humanMax: 22  },
  police_station: { w: 30, h: 32, hp: 2, score:  500, humanMin: 15,  humanMax: 30  },
  train_station:  { w: 50, h: 36, hp: 3, score: 1500, humanMin: 100, humanMax: 200 },
  movie_theater:  { w: 38, h: 32, hp: 2, score:  700, humanMin: 70,  humanMax: 130 },
  gas_station:    { w: 30, h: 18, hp: 1, score:  300, humanMin:  3,  humanMax:  8  },
  // ===== 1-D ランドマーク =====
  clock_tower:    { w: 16, h: 68, hp: 2, score:  600, humanMin:  5,  humanMax: 12  },
  radio_tower:    { w: 10, h: 88, hp: 3, score:  800, humanMin:  2,  humanMax:  8  },
  ferris_wheel:   { w: 44, h: 48, hp: 3, score: 1200, humanMin: 20,  humanMax: 50  },
  stadium:        { w: 60, h: 38, hp: 3, score: 3000, humanMin: 200, humanMax: 400 },
  water_tower:    { w: 18, h: 48, hp: 1, score:  200, humanMin:  0,  humanMax:  3  },
  // ===== 特大施設 =====
  department_store: { w: 54, h: 38, hp: 3, score: 1500, humanMin: 130, humanMax: 250 },
  // ===== 港湾・工業 (Stage 4) =====
  warehouse:       { w: 52, h: 28, hp: 2, score:  700, humanMin:  8,  humanMax: 20  },
  crane_gantry:    { w: 34, h: 78, hp: 3, score: 1200, humanMin:  2,  humanMax:  8  },
  container_stack: { w: 32, h: 30, hp: 2, score:  500, humanMin:  0,  humanMax:  4  },
  factory_stack:   { w: 42, h: 62, hp: 3, score: 1400, humanMin: 30,  humanMax: 80  },
  silo:            { w: 20, h: 48, hp: 2, score:  450, humanMin:  0,  humanMax:  3  },
  // ===== 和風・古都 (Stage 3) =====
  pagoda:          { w: 24, h: 72, hp: 3, score: 1500, humanMin:  8,  humanMax: 25  },
  ryokan:          { w: 40, h: 30, hp: 2, score:  700, humanMin: 30,  humanMax: 70  },
  kominka:         { w: 22, h: 22, hp: 1, score:  200, humanMin:  4,  humanMax: 10  },
  chaya:           { w: 20, h: 20, hp: 1, score:  220, humanMin: 10,  humanMax: 22  },
  // ===== テーマパーク・祭り (Stage 5) =====
  carousel:        { w: 38, h: 32, hp: 2, score:  900, humanMin: 30,  humanMax: 70  },
  roller_coaster:  { w: 60, h: 60, hp: 3, score: 2200, humanMin: 40,  humanMax: 90  },
  yatai:           { w: 20, h: 16, hp: 1, score:  180, humanMin: 12,  humanMax: 25  },
  big_tent:        { w: 48, h: 36, hp: 2, score:  900, humanMin: 60,  humanMax: 130 },
  // ===== Stage 1 ミニチュア追加 =====
  shotengai_arcade:     { w: 40, h:  6, hp: 1, score: 200, humanMin:  0,  humanMax:  3 },
  bus_terminal_shelter: { w: 32, h: 10, hp: 1, score: 250, humanMin: 15,  humanMax: 30 },
  fountain_pavilion:    { w: 28, h: 14, hp: 2, score: 400, humanMin:  5,  humanMax: 15 },
  // ===== Stage 2 夜街追加 =====
  snack:          { w: 16, h: 22, hp: 1, score:  220, humanMin:  6,  humanMax: 14 },
  love_hotel:     { w: 32, h: 42, hp: 2, score:  550, humanMin: 10,  humanMax: 28 },
  business_hotel: { w: 24, h: 55, hp: 3, score:  800, humanMin: 80,  humanMax: 160 },
  mahjong_parlor: { w: 22, h: 26, hp: 1, score:  280, humanMin:  8,  humanMax: 18 },
  club:           { w: 28, h: 30, hp: 2, score:  480, humanMin: 40,  humanMax:  80 },
  capsule_hotel:  { w: 40, h: 28, hp: 2, score:  600, humanMin: 60,  humanMax: 120 },
  // ===== Stage 3 和風追加 =====
  kura:           { w: 18, h: 20, hp: 1, score:  220, humanMin:  2,  humanMax:  5 },
  machiya:        { w: 24, h: 32, hp: 2, score:  400, humanMin: 15,  humanMax: 30 },
  onsen_inn:      { w: 44, h: 36, hp: 2, score:  900, humanMin: 40,  humanMax: 90 },
  tahoto:         { w: 22, h: 48, hp: 2, score: 1000, humanMin:  5,  humanMax: 15 },
  // ===== Stage 3 和風小建物の追加バリエーション =====
  dojo:           { w: 24, h: 24, hp: 1, score:  280, humanMin:  5,  humanMax: 15 },
  wagashi:        { w: 18, h: 20, hp: 1, score:  220, humanMin:  8,  humanMax: 16 },
  kimono_shop:    { w: 22, h: 22, hp: 1, score:  260, humanMin:  6,  humanMax: 14 },
  sushi_ya:       { w: 16, h: 20, hp: 1, score:  240, humanMin: 10,  humanMax: 20 },
  // ===== Stage 1 住宅バリエーション =====
  bungalow:       { w: 22, h: 14, hp: 1, score:  160, humanMin:  3,  humanMax:  6 },
  duplex:         { w: 20, h: 28, hp: 1, score:  280, humanMin:  6,  humanMax: 12 },
};

// ===== 人間 =====
export const MAX_HUMANS = 5000;
export const HUMAN_W = 3;
export const HUMAN_H = 6;
export const HUMAN_BASE_SPEED = 65; // px/s
export const HUMAN_FEAR_BOOST = 1.8;
export const HUMAN_FEAR_RADIUS = 60;
export const HUMAN_DIR_CHANGE_MIN = 0.5;
export const HUMAN_DIR_CHANGE_MAX = 1.5;

// ===== パーティクル =====
export const MAX_PARTICLES = 2000;

// ===== バンパー =====
export const BUMPER_RADIUS = 18;
export const BUMPER_SCORE = 5;
export const BUMPER_FORCE = 14;

// ===== コンボ =====
export const COMBO_TIMEOUT = 1.0;
export const COMBO_SLOW_THRESHOLD = 5;
export const COMBO_MAX = 10;

// ===== スコア演出（ティッカー音） =====
// コンボ1回ごとにティッカー音のピッチを何倍上げるか
export const SCORE_TICK_PITCH_STEP = 0.06;
// ピッチの上限倍率
export const SCORE_TICK_PITCH_MAX = 2.5;

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

// ===== 自動スクロール (レースゲーム風) =====
export const SCROLL_BASE_SPEED   = 0;    // 初期速度 (0 = 停止状態スタート)
export const SCROLL_LINEAR_DRAIN = 30;   // 線形減衰 (px/s²): 毎秒一定量ずつ減速
export const SCROLL_MAX          = 200;  // スクロール速度上限 (px/s)
export const HUMAN_SCROLL_GAIN   = 8;    // 人間 1 体の基礎ゲイン (px/s)
export const SCROLL_GAIN_DECAY   = 3;    // ゲイン指数減衰: gain = base * exp(-speed / (MAX / DECAY))

// ===== 燃料ゲージ (タイマーの代替) =====
// 時間経過で減少し、人間を踏むと回復する。0 でゲームオーバー。
export const FUEL_MAX             = 100;
export const FUEL_INITIAL         = 70;
export const FUEL_DRAIN_PER_SEC   = 1.8;
export const FUEL_GAIN_PER_HUMAN  = 2.5;
export const FUEL_LOW_THRESHOLD   = 20;   // この値を下回ると赤く点滅

// ===== ステージ (完走型) =====
// チャンク数合計 = 各ステージの templates.length 合計 (stages.ts で定義)
export const STAGE_COUNT          = 5;

// ===== ステージ別 道路パレット =====
// 各ステージの道路・歩道・センターライン・縁石・交差点色をまとめて切り替え。
// fillChunkRoads が chunk.stageIndex からこのテーブルを参照する。
export interface StageRoadPalette {
  road:         readonly [number, number, number, number]; // 車道本体
  sidewalk:     readonly [number, number, number, number]; // 歩道
  line:         readonly [number, number, number, number]; // センターライン/レーンマーク
  curb:         readonly [number, number, number, number]; // 縁石
  intersection: readonly [number, number, number, number]; // 交差点中央
  crosswalk:    readonly [number, number, number, number]; // 横断歩道白線
  alley:        readonly [number, number, number, number]; // 路地
}

export const STAGE_ROAD_PALETTE: Record<number, StageRoadPalette> = {
  // Stage 1 住宅街: 明るい昼、淡いアスファルト + ベージュ歩道
  0: {
    road:         [0.45, 0.45, 0.47, 1],
    sidewalk:     [0.68, 0.64, 0.56, 1],
    line:         [0.95, 0.92, 0.55, 1],
    curb:         [0.30, 0.30, 0.32, 1],
    intersection: [0.50, 0.50, 0.52, 1],
    crosswalk:    [0.95, 0.95, 0.95, 0.92],
    alley:        [0.40, 0.40, 0.37, 1],
  },
  // Stage 2 繁華街夜: 黒いアスファルト + ネオンパープル歩道 + シアンライン
  1: {
    road:         [0.14, 0.14, 0.18, 1],
    sidewalk:     [0.28, 0.22, 0.38, 1],
    line:         [0.40, 0.95, 0.95, 1],   // ネオンシアン
    curb:         [0.08, 0.08, 0.10, 1],
    intersection: [0.20, 0.16, 0.28, 1],
    crosswalk:    [0.95, 0.75, 0.95, 0.9], // マゼンタ気味
    alley:        [0.10, 0.08, 0.14, 1],
  },
  // Stage 3 和風: 暖かい茶色土 + 赤みを帯びた石畳歩道
  2: {
    road:         [0.52, 0.42, 0.32, 1],
    sidewalk:     [0.72, 0.60, 0.50, 1],
    line:         [0.90, 0.78, 0.45, 1],
    curb:         [0.38, 0.28, 0.22, 1],
    intersection: [0.58, 0.46, 0.36, 1],
    crosswalk:    [0.88, 0.80, 0.70, 0.85],
    alley:        [0.46, 0.36, 0.28, 1],
  },
  // Stage 4 港湾: 暗いコンクリ + 警告黄ライン + 鉄サビ歩道
  3: {
    road:         [0.32, 0.33, 0.36, 1],
    sidewalk:     [0.46, 0.44, 0.42, 1],
    line:         [0.95, 0.78, 0.15, 1],   // 警告イエロー
    curb:         [0.18, 0.18, 0.22, 1],
    intersection: [0.36, 0.37, 0.40, 1],
    crosswalk:    [0.92, 0.80, 0.25, 0.92], // 黄色の横断歩道
    alley:        [0.28, 0.28, 0.30, 1],
  },
  // Stage 5 テーマパーク: クリーム色タイル + パステルピンクライン
  4: {
    road:         [0.88, 0.82, 0.70, 1],
    sidewalk:     [0.95, 0.88, 0.75, 1],
    line:         [0.95, 0.55, 0.72, 1],   // ピンク
    curb:         [0.72, 0.58, 0.50, 1],
    intersection: [0.92, 0.86, 0.72, 1],
    crosswalk:    [0.98, 0.95, 0.88, 0.95],
    alley:        [0.82, 0.72, 0.62, 1],
  },
};

/** chunk.stageIndex からパレットを取得 (不明時は Stage 1 デフォルト) */
export function getStagePalette(stageIndex: number): StageRoadPalette {
  return STAGE_ROAD_PALETTE[stageIndex] ?? STAGE_ROAD_PALETTE[0];
}

/**
 * Stage 1 マイクロパレット: 12 チャンクを「朝の住宅街 → 駅前の昼 → 神社の夕 → 橋渡しの薄暮」
 * という全体グラデで演出する。各チャンク固有のアクセント色を家具の看板/花/屋根などに反映。
 */
export interface MicroPalette {
  accent:    readonly [number, number, number];  // メインのアクセント色 (看板等)
  secondary: readonly [number, number, number];  // サブの色 (提灯・屋根)
  ambient:   readonly [number, number, number];  // 空気感 (霞の色)
}

export const STAGE_1_MICRO_PALETTE: Record<number, MicroPalette> = {
  // ═══ Act I: 閑静な住宅街 (Chunks 0-2) ═══ パステル緑 + 薄桃 (住宅の落ち着き)
  // Chunk 0 住宅街への入口: 淡いパステルピーチ
  0:  { accent: [0.98, 0.82, 0.72], secondary: [0.92, 0.88, 0.78], ambient: [0.96, 0.92, 0.85] },
  // Chunk 1 住宅+コーナーコンビニ: 薄桜ピンク
  1:  { accent: [0.95, 0.78, 0.82], secondary: [0.88, 0.92, 0.80], ambient: [0.94, 0.90, 0.85] },
  // Chunk 2 保育園/診療所: ミントグリーン
  2:  { accent: [0.72, 0.92, 0.80], secondary: [0.88, 0.95, 0.82], ambient: [0.90, 0.95, 0.88] },
  // ═══ Act II: 生活と小商店 (Chunks 3-5) ═══ 薄青 + クリーム (生活の混合)
  // Chunk 3 住宅と小商店の混合: 淡クリーム
  3:  { accent: [0.95, 0.88, 0.62], secondary: [0.88, 0.85, 0.72], ambient: [0.92, 0.90, 0.78] },
  // Chunk 4 家族の買い物道: 薄水色
  4:  { accent: [0.62, 0.82, 0.92], secondary: [0.88, 0.92, 0.85], ambient: [0.85, 0.92, 0.90] },
  // Chunk 5 公共の地域中心: 淡青銅
  5:  { accent: [0.45, 0.68, 0.82], secondary: [0.88, 0.82, 0.72], ambient: [0.82, 0.85, 0.85] },
  // ═══ Act III: ローカル商店街 (Chunks 6-8) ═══ 暖黄 + 薄橙 (商店街の活気)
  // Chunk 6 小学校 + 商店街の始まり: 暖色マスタード
  6:  { accent: [0.95, 0.78, 0.35], secondary: [0.88, 0.72, 0.48], ambient: [0.92, 0.82, 0.68] },
  // Chunk 7 商店街の中心: 暖色オレンジ
  7:  { accent: [0.95, 0.62, 0.38], secondary: [0.88, 0.72, 0.42], ambient: [0.90, 0.80, 0.62] },
  // Chunk 8 地方の小駅: 淡黄金
  8:  { accent: [0.92, 0.82, 0.52], secondary: [0.88, 0.78, 0.58], ambient: [0.88, 0.82, 0.72] },
  // ═══ Act IV: 街はずれ (Chunks 9-11) ═══ 灰青 + 薄紫 (郊外の寂寥、Stage 2 接続)
  // Chunk 9 郊外の畑 + 農家: 灰緑
  9:  { accent: [0.62, 0.72, 0.58], secondary: [0.72, 0.78, 0.65], ambient: [0.75, 0.78, 0.70] },
  // Chunk 10 郊外倉庫 + 消防分署: 灰青
  10: { accent: [0.55, 0.62, 0.68], secondary: [0.65, 0.68, 0.70], ambient: [0.65, 0.68, 0.72] },
  // Chunk 11 踏切 + Stage 2 handoff: 薄暮パープル
  11: { accent: [0.55, 0.45, 0.78], secondary: [0.72, 0.58, 0.82], ambient: [0.52, 0.48, 0.62] },
};

/** チャンクインデックスからマイクロパレットを取得 (Stage 1 範囲外は null) */
export function getStage1MicroPalette(chunkIdx: number): MicroPalette | null {
  return STAGE_1_MICRO_PALETTE[chunkIdx] ?? null;
}

// ===== スコアポップアップ =====
export const SCORE_POPUP_RISE      = 40;  // ポップアップ上昇量 (px)
export const SCORE_POPUP_DUR_SMALL = 0.7; // < ¥500 (家具・人間等)
export const SCORE_POPUP_DUR_BIG   = 0.7; // ≥ ¥500
export const SCORE_POPUP_DUR_LARGE = 0.7; // ≥ ¥2000
export const SCORE_POPUP_DUR_MEGA  = 0.7; // ≥ ¥5000

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
