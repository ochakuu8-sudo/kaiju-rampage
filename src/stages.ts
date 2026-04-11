export interface StageConfig {
  level: number;
  buildings: Array<{
    x: number;
    y: number;
    type: 'small' | 'medium' | 'large';
  }>;
}

export const STAGES: StageConfig[] = [
  {
    level: 1,
    buildings: [
      { x: -100, y: 150, type: 'small' },
      { x: 0, y: 160, type: 'small' },
      { x: 100, y: 150, type: 'small' },
      { x: -60, y: 80, type: 'medium' },
      { x: 60, y: 80, type: 'medium' },
    ],
  },
  {
    level: 2,
    buildings: [
      { x: -120, y: 180, type: 'small' },
      { x: -60, y: 170, type: 'small' },
      { x: 0, y: 180, type: 'small' },
      { x: 60, y: 170, type: 'small' },
      { x: 120, y: 180, type: 'small' },
      { x: -80, y: 80, type: 'medium' },
      { x: 0, y: 90, type: 'medium' },
      { x: 80, y: 80, type: 'medium' },
    ],
  },
  {
    level: 3,
    buildings: [
      { x: -130, y: 200, type: 'medium' },
      { x: -60, y: 210, type: 'small' },
      { x: 0, y: 200, type: 'medium' },
      { x: 60, y: 210, type: 'small' },
      { x: 130, y: 200, type: 'medium' },
      { x: -90, y: 100, type: 'medium' },
      { x: 0, y: 110, type: 'large' },
      { x: 90, y: 100, type: 'medium' },
    ],
  },
  {
    level: 4,
    buildings: [
      { x: -130, y: 220, type: 'medium' },
      { x: -65, y: 230, type: 'small' },
      { x: 0, y: 220, type: 'large' },
      { x: 65, y: 230, type: 'small' },
      { x: 130, y: 220, type: 'medium' },
      { x: -100, y: 120, type: 'medium' },
      { x: -30, y: 130, type: 'medium' },
      { x: 30, y: 130, type: 'medium' },
      { x: 100, y: 120, type: 'medium' },
    ],
  },
];

export function getStage(level: number): StageConfig {
  return STAGES[Math.min(level, STAGES.length - 1)];
}
