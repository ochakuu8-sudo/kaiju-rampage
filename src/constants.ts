// ========== Screen / Canvas ==========
export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 640;
export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;

// Logical coordinate system (center at origin, Y+ upward)
export const WORLD_MIN_X = -180;
export const WORLD_MAX_X = 180;
export const WORLD_MIN_Y = -320;
export const WORLD_MAX_Y = 320;

// Layout zones
export const UI_Y_MIN = 280;
export const UI_Y_MAX = 320;
export const STREET_Y_MIN = 60;
export const STREET_Y_MAX = 260;
export const MID_Y_MIN = -40;
export const MID_Y_MAX = 60;
export const FLIPPER_Y_MIN = -160;
export const FLIPPER_Y_MAX = -40;
export const FALLOFF_Y_MIN = -320;
export const FALLOFF_Y_MAX = -160;

// ========== Ball ==========
export const BALL_RADIUS = 9;
export const GRAVITY = 0.3;
export const MAX_BALL_SPEED = 25;
export const BALL_WALL_DAMPING = 0.8;
export const BALL_START_X = 140;
export const BALL_START_Y = -200;

// ========== Flippers ==========
export const FLIPPER_WIDTH = 80;
export const FLIPPER_HEIGHT = 12;
export const FLIPPER_LEFT_X = -50;
export const FLIPPER_RIGHT_X = 50;
export const FLIPPER_Y = -120;
export const FLIPPER_REST_ANGLE = -30; // degrees
export const FLIPPER_ACTIVE_ANGLE = 30; // degrees
export const FLIPPER_POWER = 15;
export const FLIPPER_ROTATION_SPEED = 360; // degrees per second

// ========== Buildings ==========
export const BUILDING_TYPES = {
  small: { width: 20, height: 30, hp: 1, scoreValue: 100 },
  medium: { width: 30, height: 50, hp: 2, scoreValue: 300 },
  large: { width: 40, height: 70, hp: 3, scoreValue: 500 },
};

// ========== Humans ==========
export const MAX_HUMANS = 500;
export const HUMAN_WIDTH = 3;
export const HUMAN_HEIGHT = 6;
export const HUMAN_PANIC_SPEED = 10;
export const HUMAN_DIRECTION_CHANGE_INTERVAL = 0.5; // seconds
export const HUMAN_CRUSH_SCORE = 100;

// ========== Particles ==========
export const MAX_PARTICLES = 2000;

// ========== Juice / VFX ==========
export const SHAKE_HUMAN_CRUSH = { amplitude: 1.5, duration: 0.05 };
export const SHAKE_BUILDING_DAMAGE = { amplitude: 3, duration: 0.08 };
export const SHAKE_BUILDING_DESTROY = { amplitude: 6, duration: 0.12 };
export const SHAKE_LARGE_BUILD_DESTROY = { amplitude: 10, duration: 0.2 };

export const HITSTOP_BUILDING_DESTROY = 0.06; // seconds
export const HITSTOP_LARGE_BUILD_DESTROY = 0.1; // seconds

// ========== Combo ==========
export const COMBO_TIMEOUT = 1.0; // seconds
export const MAX_COMBO = 10;
export const COMBO_SCORE_MULTIPLIER = (combo: number) => Math.min(combo, MAX_COMBO);
