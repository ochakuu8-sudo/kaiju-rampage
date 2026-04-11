import { Game } from './game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

const game = new Game(canvas);

let lastTime = performance.now();

function gameLoop(currentTime: number) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.016); // Cap at 60fps
  lastTime = currentTime;

  if (game.gameRunning) {
    game.update(dt);
  }

  game.render();

  // Handle game over
  if (game.gameOver) {
    document.addEventListener('click', () => {
      game.handleGameOver();
    }, { once: true });
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
