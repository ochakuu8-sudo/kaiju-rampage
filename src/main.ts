import { Game } from './game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

console.log('Canvas found:', canvas.width, 'x', canvas.height);

const game = new Game(canvas);
console.log('Game initialized successfully');

let lastTime = performance.now();

function gameLoop(currentTime: number) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.016); // Cap at 60fps
  lastTime = currentTime;

  if (game.gameRunning) {
    game.update(dt);
  }

  game.render();

  // Handle game over restart
  if (game.gameOver && !game.gameRunning) {
    const overlay = document.getElementById('game-over-overlay') as any;
    if (overlay && !overlay._restartHandler) {
      overlay._restartHandler = true;
      overlay.addEventListener('click', () => {
        game.handleGameOver();
        overlay.classList.remove('show');
        overlay._restartHandler = false;
      }, { once: true });
    }
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
