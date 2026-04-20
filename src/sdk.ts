/**
 * sdk.ts — CrazyGames SDK v3 の薄いラッパー
 *
 * SDK スクリプトは index.html の <script src="https://sdk.crazygames.com/..."> で
 * ロードされる。CrazyGames 以外 (GitHub Pages / ローカル / CDN 失敗) では
 * window.CrazyGames が undefined のため、全ての呼び出しは silent no-op になる。
 */

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: {
        init?: () => Promise<void>;
        game?: {
          gameplayStart?: () => void;
          gameplayStop?: () => void;
          happytime?: () => void;
        };
      };
    };
  }
}

let initialized = false;

export async function initSdk(): Promise<void> {
  try {
    const sdk = window.CrazyGames?.SDK;
    if (!sdk?.init) return;
    await sdk.init();
    initialized = true;
  } catch {
    // CrazyGames 外ではエラーになる。無視して続行。
  }
}

export function gameplayStart(): void {
  if (!initialized) return;
  try { window.CrazyGames?.SDK?.game?.gameplayStart?.(); } catch {}
}

export function gameplayStop(): void {
  if (!initialized) return;
  try { window.CrazyGames?.SDK?.game?.gameplayStop?.(); } catch {}
}

export function happytime(): void {
  if (!initialized) return;
  try { window.CrazyGames?.SDK?.game?.happytime?.(); } catch {}
}
