/**
 * main.ts — エントリーポイント
 */
import { Game } from './game';
import { initSdk } from './sdk';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// スクリーンショット用モード: ?screenshot=1 でタイトル/HUD を隠し、
// stage 1 の盤面だけをレンダリングする (ボールも非表示、物理停止)
// ?screenshot=1&chunk=N で chunkId=N を中央に表示 (デバッグ用、Stage N チャンク確認)
const params = new URLSearchParams(window.location.search);
const screenshotMode = params.has('screenshot');
const screenshotChunkId = params.has('chunk') ? parseInt(params.get('chunk')!, 10) : null;
if (screenshotMode) document.body.classList.add('screenshot-mode');

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

// ゲーム起動 — WebGL2 初期化失敗時は non-WebGL 画面を出す
try {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = new Game(canvas, { screenshotMode, screenshotChunkId });
  // 初期化完了: ローディング画面をフェードアウト
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    // transition 終了後に DOM から除去 (クリック透過のため pointer-events は class で制御済み)
    setTimeout(() => loading.remove(), 400);
  }
} catch (err) {
  console.error('Game init failed:', err);
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  const noWebgl = document.getElementById('no-webgl');
  if (noWebgl) noWebgl.classList.add('show');
}
