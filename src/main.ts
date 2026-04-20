/**
 * main.ts — エントリーポイント
 */
import { Game } from './game';
import { initSdk } from './sdk';

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

// CrazyGames SDK 初期化 — 失敗しても (SDK 未ロード時・他環境) ゲームは継続
// init の成否を待たずにゲーム起動しても問題ないので fire-and-forget
initSdk();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Game(canvas);
