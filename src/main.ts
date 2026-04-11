/**
 * main.ts — エントリーポイント
 */
import { Game } from './game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Game(canvas);
