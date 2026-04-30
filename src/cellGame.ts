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

interface CellObject {
  kind: CellKind;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  alive: boolean;
  pulse: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const W = 360;
const H = 580;
const CELL = 90;
const COLS = 4;
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
  fuel: '#34d399',
  boost: '#38bdf8',
  gas: '#f97316',
  dense: '#a855f7',
  score: '#facc15',
  hazard: '#ef4444',
  recovery: '#67e8f9',
  goal: '#f8fafc',
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

const HP: Record<CellKind, number> = {
  empty: 0,
  house: 1,
  fuel: 1,
  boost: 1,
  gas: 1,
  dense: 2,
  score: 3,
  hazard: 1,
  recovery: 1,
  goal: 4,
};

const SCORE: Record<CellKind, number> = {
  empty: 0,
  house: 100,
  fuel: 120,
  boost: 80,
  gas: 300,
  dense: 250,
  score: 1000,
  hazard: 50,
  recovery: 50,
  goal: 5000,
};

class CellWreckGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private objects: CellObject[] = [];
  private particles: Particle[] = [];

  private ball = { x: -120, y: -130, vx: 3.0, vy: 0, r: 15 };
  private cameraY = 0;
  private score = 0;
  private fuel = 45;
  private finished = false;
  private gameOver = false;
  private lastTime = performance.now();
  private leftPressed = false;
  private rightPressed = false;
  private shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
    this.resetObjects();
    this.bindInput();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resetObjects(): void {
    this.objects = [];
    for (let row = 0; row < COURSE.length; row++) {
      for (let col = 0; col < COLS; col++) {
        const kind = COURSE[row][col];
        if (kind === 'empty') continue;
        const cx = -180 + col * CELL + CELL / 2;
        const cy = row * CELL + CELL / 2;
        const pad = kind === 'goal' ? 8 : 14;
        this.objects.push({
          kind,
          col,
          row,
          x: cx,
          y: cy,
          w: CELL - pad * 2,
          h: CELL - pad * 2,
          hp: HP[kind],
          alive: true,
          pulse: 0,
        });
      }
    }
  }

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') this.leftPressed = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.rightPressed = true;
      if (e.key === ' ' || e.key === 'ArrowUp') { this.leftPressed = true; this.rightPressed = true; }
      if (e.key.toLowerCase() === 'r') this.restart();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') this.leftPressed = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.rightPressed = false;
      if (e.key === ' ' || e.key === 'ArrowUp') { this.leftPressed = false; this.rightPressed = false; }
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * W;
      if (x < W / 2) this.leftPressed = true;
      else this.rightPressed = true;
    });
    window.addEventListener('pointerup', () => {
      this.leftPressed = false;
      this.rightPressed = false;
    });
  }

  private restart(): void {
    this.ball = { x: -120, y: -130, vx: 3.0, vy: 0, r: 15 };
    this.cameraY = 0;
    this.score = 0;
    this.fuel = 45;
    this.finished = false;
    this.gameOver = false;
    this.particles = [];
    this.resetObjects();
  }

  private loop(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (this.finished || this.gameOver) {
      this.updateParticles(dt);
      return;
    }

    const scrollSpeed = 50 + this.fuel * 0.85;
    this.cameraY += scrollSpeed * dt;
    this.fuel = Math.max(0, this.fuel - dt * 5.5);
    if (this.fuel <= 0) this.gameOver = true;

    this.ball.vy -= 9.8 * dt;
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    if (this.ball.x - this.ball.r < -180) {
      this.ball.x = -180 + this.ball.r;
      this.ball.vx = Math.abs(this.ball.vx) * 0.72;
    } else if (this.ball.x + this.ball.r > 180) {
      this.ball.x = 180 - this.ball.r;
      this.ball.vx = -Math.abs(this.ball.vx) * 0.72;
    }

    // Keep the ball near the moving playfield. Falling below the flippers costs fuel, not lives.
    if (this.ball.y < this.cameraY - 260) {
      this.ball.y = this.cameraY - 170;
      this.ball.x = 0;
      this.ball.vx = 0;
      this.ball.vy = 4;
      this.fuel = Math.max(0, this.fuel - 12);
      this.shake = 8;
    }

    this.handleFlippers();
    this.handleObjectCollisions();
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - 40 * dt);
  }

  private handleFlippers(): void {
    const y = this.cameraY - 205;
    const left = { x1: -165, y1: y - 8, x2: -35, y2: y + (this.leftPressed ? 30 : -20) };
    const right = { x1: 165, y1: y - 8, x2: 35, y2: y + (this.rightPressed ? 30 : -20) };
    this.collideSegmentFlipper(left.x1, left.y1, left.x2, left.y2, this.leftPressed ? 13 : 5);
    this.collideSegmentFlipper(right.x1, right.y1, right.x2, right.y2, this.rightPressed ? 13 : 5);
  }

  private collideSegmentFlipper(x1: number, y1: number, x2: number, y2: number, power: number): void {
    const px = this.ball.x;
    const py = this.ball.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const nx = px - cx;
    const ny = py - cy;
    const d = Math.hypot(nx, ny);
    if (d > this.ball.r + 6 || d === 0) return;
    const ux = nx / d;
    const uy = ny / d;
    this.ball.x = cx + ux * (this.ball.r + 6);
    this.ball.y = cy + uy * (this.ball.r + 6);
    const dot = this.ball.vx * ux + this.ball.vy * uy;
    this.ball.vx = this.ball.vx - 2 * dot * ux + ux * power;
    this.ball.vy = Math.abs(this.ball.vy - 2 * dot * uy) + power;
  }

  private handleObjectCollisions(): void {
    for (const obj of this.objects) {
      if (!obj.alive) continue;
      const left = obj.x - obj.w / 2;
      const right = obj.x + obj.w / 2;
      const bottom = obj.y - obj.h / 2;
      const top = obj.y + obj.h / 2;
      const cx = Math.max(left, Math.min(this.ball.x, right));
      const cy = Math.max(bottom, Math.min(this.ball.y, top));
      const dx = this.ball.x - cx;
      const dy = this.ball.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > this.ball.r * this.ball.r) continue;

      const d = Math.sqrt(Math.max(d2, 0.0001));
      const nx = dx / d;
      const ny = dy / d;
      this.ball.x = cx + nx * this.ball.r;
      this.ball.y = cy + ny * this.ball.r;
      const dot = this.ball.vx * nx + this.ball.vy * ny;
      this.ball.vx = (this.ball.vx - 2 * dot * nx) * 0.82;
      this.ball.vy = (this.ball.vy - 2 * dot * ny) * 0.82;
      this.damageObject(obj);
      break;
    }
  }

  private damageObject(obj: CellObject): void {
    obj.hp -= 1;
    obj.pulse = 1;
    this.shake = Math.max(this.shake, obj.kind === 'gas' ? 14 : 6);
    this.spawnParticles(obj.x, obj.y, COLORS[obj.kind], obj.kind === 'gas' ? 36 : 14);
    if (obj.hp > 0) return;
    obj.alive = false;
    this.score += SCORE[obj.kind];

    if (obj.kind === 'fuel' || obj.kind === 'recovery') this.fuel = Math.min(100, this.fuel + 22);
    if (obj.kind === 'boost') {
      this.fuel = Math.min(100, this.fuel + 10);
      this.ball.vy += 10;
    }
    if (obj.kind === 'hazard') this.fuel = Math.max(0, this.fuel - 8);
    if (obj.kind === 'gas') this.explodeGas(obj);
    if (obj.kind === 'goal') this.finished = true;
  }

  private explodeGas(source: CellObject): void {
    this.fuel = Math.min(100, this.fuel + 12);
    for (const obj of this.objects) {
      if (!obj.alive || obj === source) continue;
      const dist = Math.hypot(obj.x - source.x, obj.y - source.y);
      if (dist <= 140) {
        obj.hp -= 1;
        obj.pulse = 1;
        this.spawnParticles(obj.x, obj.y, COLORS[obj.kind], 8);
        if (obj.hp <= 0) {
          obj.alive = false;
          this.score += SCORE[obj.kind];
        }
      }
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 80 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const obj of this.objects) obj.pulse = Math.max(0, obj.pulse - dt * 5);
  }

  private render(): void {
    const ox = (Math.random() * 2 - 1) * this.shake;
    const oy = (Math.random() * 2 - 1) * this.shake;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2 + ox, H - oy);

    this.drawGrid();
    this.drawObjects();
    this.drawParticles();
    this.drawFlippers();
    this.drawBall();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawHud();
  }

  private sy(worldY: number): number {
    return -(worldY - this.cameraY);
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fillRect(-90, -H, 180, H * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const x = -180 + c * CELL;
      ctx.beginPath();
      ctx.moveTo(x, -H);
      ctx.lineTo(x, 0);
      ctx.stroke();
    }
    const start = Math.floor((this.cameraY - H) / CELL) - 1;
    const end = Math.ceil((this.cameraY + H) / CELL) + 1;
    for (let r = start; r <= end; r++) {
      const y = this.sy(r * CELL);
      ctx.beginPath();
      ctx.moveTo(-180, y);
      ctx.lineTo(180, y);
      ctx.stroke();
    }
  }

  private drawObjects(): void {
    const ctx = this.ctx;
    for (const obj of this.objects) {
      const y = this.sy(obj.y);
      if (y < -H - 80 || y > 120) continue;
      if (!obj.alive) {
        ctx.fillStyle = 'rgba(120,120,120,0.22)';
        ctx.fillRect(obj.x - obj.w / 2, y - obj.h / 2, obj.w, obj.h * 0.35);
        continue;
      }
      const scale = 1 + obj.pulse * 0.12;
      ctx.fillStyle = COLORS[obj.kind];
      ctx.fillRect(obj.x - obj.w * scale / 2, y - obj.h * scale / 2, obj.w * scale, obj.h * scale);
      ctx.fillStyle = obj.kind === 'goal' || obj.kind === 'score' ? '#111' : '#fff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LABELS[obj.kind], obj.x, y);
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, this.sy(p.y) - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawBall(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.sy(this.ball.y), this.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawFlippers(): void {
    const y = this.sy(this.cameraY - 205);
    this.drawFlipper(-165, y - 8, -35, y + (this.leftPressed ? 30 : -20), this.leftPressed);
    this.drawFlipper(165, y - 8, 35, y + (this.rightPressed ? 30 : -20), this.rightPressed);
  }

  private drawFlipper(x1: number, y1: number, x2: number, y2: number, active: boolean): void {
    const ctx = this.ctx;
    ctx.strokeStyle = active ? '#facc15' : '#e879f9';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawHud(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 58);
    ctx.fillStyle = '#facc15';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 8, 18);
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(`DIST ${Math.floor(this.cameraY)}m`, 8, 36);
    ctx.fillStyle = '#111827';
    ctx.fillRect(190, 13, 150, 14);
    ctx.fillStyle = this.fuel < 20 ? '#ef4444' : '#34d399';
    ctx.fillRect(190, 13, 150 * (this.fuel / 100), 14);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(190, 13, 150, 14);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText('FUEL', 182, 25);
    ctx.fillText('A/← D/→ FLIP  R RESTART', W - 8, 47);

    if (this.finished || this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = this.finished ? '#facc15' : '#ef4444';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.finished ? 'GOAL!' : 'FUEL EMPTY', W / 2, H / 2 - 24);
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`SCORE ${this.score} / DIST ${Math.floor(this.cameraY)}m`, W / 2, H / 2 + 8);
      ctx.fillText('PRESS R TO RESTART', W / 2, H / 2 + 36);
    }
  }
}

export function startCellGame(canvas: HTMLCanvasElement): void {
  new CellWreckGame(canvas);
}
