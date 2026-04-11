/**
 * main.ts — エントリーポイント
 */
import { Game } from './game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// レスポンシブ: #wrap を画面に合わせてスケール（縦横比固定）
const wrap = document.getElementById('wrap') as HTMLElement;
function applyScale() {
  const scale = Math.min(window.innerWidth / 360, window.innerHeight / 580);
  wrap.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', applyScale);
applyScale();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Game(canvas);
