/**
 * main.ts — エントリーポイント
 *
 * 現在は 90x90 セル構造のプレイアブル試作を本編として起動する。
 * 旧 WebGL 実装は src/game.ts に残しているが、この入口からは使わない。
 */
import { startCellGame } from './cellGame';
import { initSdk } from './sdk';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Canvas not found');

const wrap = document.getElementById('wrap') as HTMLElement | null;
function applyScale() {
  if (!wrap) return;
  const scale = Math.min(window.innerWidth / 360, window.innerHeight / 580);
  wrap.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', applyScale);
applyScale();

initSdk();

try {
  startCellGame(canvas);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 400);
  }
  const title = document.getElementById('title');
  if (title) title.classList.remove('show');
} catch (err) {
  console.error('Cell game init failed:', err);
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  const noWebgl = document.getElementById('no-webgl');
  if (noWebgl) noWebgl.classList.add('show');
}
