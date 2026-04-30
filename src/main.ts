import { Game } from './game';
import { initSdk } from './sdk';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

const params = new URLSearchParams(window.location.search);
const screenshotMode = params.has('screenshot');
const screenshotChunkId = params.has('chunk') ? parseInt(params.get('chunk')!, 10) : null;
if (screenshotMode) document.body.classList.add('screenshot-mode');

const wrap = document.getElementById('wrap') as HTMLElement;
function applyScale() {
  const scale = Math.min(window.innerWidth / 360, window.innerHeight / 580);
  wrap.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', applyScale);
applyScale();

initSdk();

try {
  const game = new Game(canvas, { screenshotMode, screenshotChunkId });
  void game;
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 400);
  }
} catch (err) {
  console.error('Game init failed:', err);
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  const noWebgl = document.getElementById('no-webgl');
  if (noWebgl) noWebgl.classList.add('show');
}
