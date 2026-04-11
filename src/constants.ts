// ===== スクリーン =====
export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 580;
export const WORLD_MIN_X = -180;
export const WORLD_MAX_X = 180;
export const WORLD_MIN_Y = -290;
export const WORLD_MAX_Y = 290;

// ===== ゾーン Y境界 =====
export const STREET_Y_MIN = 50;
export const STREET_Y_MAX = 230;
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
export const BALL_START_Y = -108;
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
export type BuildingSize = 'small' | 'medium' | 'large';
export const BUILDING_DEFS: Record<BuildingSize, {
  w: number; h: number; hp: number; score: number; humanMin: number; humanMax: number
}> = {
  small:  { w: 20, h: 30, hp: 1, score: 100,  humanMin: 3,  humanMax: 5  },
  medium: { w: 30, h: 50, hp: 2, score: 300,  humanMin: 5,  humanMax: 8  },
  large:  { w: 40, h: 70, hp: 3, score: 500,  humanMin: 8,  humanMax: 12 },
};

// ===== 人間 =====
export const MAX_HUMANS = 500;
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
