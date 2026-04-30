export {};

type CellKind =
  | 'empty'
  | 'house'
  | 'fuel'
  | 'boost'
  | 'gas'
  | 'dense'
  | 'score'
  | 'hazard'
  | 'recovery'
  | 'goal';

const CELL = 90;
const COLS = 4;
const ROWS_VISIBLE_H = 580;
const COURSE: CellKind[][] = [
  ['empty', 'empty', 'empty', 'empty'],
  ['house', 'empty', 'empty', 'house'],
  ['empty', 'fuel',  'empty', 'house'],
  ['gas',   'gas',   'empty', 'empty'],
  ['empty', 'empty', 'recovery', 'empty'],
  ['house', 'house', 'empty', 'house'],
  ['empty', 'boost', 'empty', 'empty'],
  ['fuel',  'empty', 'empty', 'hazard'],
  ['empty', 'gas',   'gas',   'empty'],
  ['dense', 'empty', 'empty', 'dense'],
  ['empty', 'empty', 'empty', 'empty'],
  ['house', 'house', 'empty', 'fuel'],
  ['empty', 'boost', 'boost', 'empty'],
  ['hazard','empty', 'empty', 'score'],
  ['empty', 'empty', 'fuel',  'empty'],
  ['gas',   'gas',   'empty', 'empty'],
  ['dense', 'dense', 'empty', 'boost'],
  ['recovery', 'empty', 'empty', 'recovery'],
  ['empty', 'score', 'score', 'empty'],
  ['empty', 'goal',  'goal',  'empty'],
];

const COLORS: Record<CellKind, string> = {
  empty: '#151823',
  house: '#8f7352',
  fuel: '#39d98a',
  boost: '#46b7ff',
  gas: '#ff9f1a',
  dense: '#b45cff',
  score: '#ffd24a',
  hazard: '#ef3b3b',
  recovery: '#7bdff2',
  goal: '#ffffff',
};

const LABELS: Record<CellKind, string> = {
  empty: '.',
  house: 'h',
  fuel: 'F',
  boost: 'B',
  gas: 'G',
  dense: 'D',
  score: 'S',
  hazard: 'X',
  recovery: 'R',
  goal: 'K',
};

const canvas = document.getElementById('prototypeCanvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('prototypeCanvas not found');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2d context not available');

let cameraY = 0;
const maxCameraY = Math.max(0, COURSE.length * CELL - ROWS_VISIBLE_H);

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function worldToScreenY(worldY: number): number {
  return canvas.height - (worldY - cameraY);
}

function drawCell(col: number, row: number, kind: CellKind): void {
  const x = col * CELL;
  const y = worldToScreenY((row + 1) * CELL);

  ctx.fillStyle = kind === 'empty' ? COLORS.empty : '#10131b';
  ctx.fillRect(x, y, CELL, CELL);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);

  if (kind !== 'empty') {
    ctx.fillStyle = COLORS[kind];
    const pad = kind === 'goal' ? 8 : 14;
    ctx.fillRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2);

    ctx.fillStyle = kind === 'goal' ? '#111' : '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(LABELS[kind], x + CELL / 2, y + CELL / 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('.', x + CELL / 2, y + CELL / 2);
  }
}

function drawLaneGuides(): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    const x = c * CELL;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(70,183,255,0.06)';
  ctx.fillRect(CELL, 0, CELL * 2, canvas.height);
}

function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0c0d14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawLaneGuides();

  for (let row = 0; row < COURSE.length; row++) {
    for (let col = 0; col < COLS; col++) {
      drawCell(col, row, COURSE[row][col]);
    }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 28, canvas.width, 18);
  ctx.fillStyle = '#ffd24a';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`cameraY ${Math.round(cameraY)} / ${maxCameraY}`, 8, 37);

  ctx.textAlign = 'right';
  ctx.fillText(`rows ${COURSE.length}  length ${COURSE.length * CELL}px`, canvas.width - 8, 37);
}

window.addEventListener('wheel', (event) => {
  event.preventDefault();
  cameraY = clamp(cameraY + event.deltaY, 0, maxCameraY);
  draw();
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    cameraY = clamp(cameraY + CELL, 0, maxCameraY);
    draw();
  } else if (event.key === 'ArrowUp') {
    cameraY = clamp(cameraY - CELL, 0, maxCameraY);
    draw();
  } else if (event.key === 'Home') {
    cameraY = 0;
    draw();
  } else if (event.key === 'End') {
    cameraY = maxCameraY;
    draw();
  }
});

draw();
