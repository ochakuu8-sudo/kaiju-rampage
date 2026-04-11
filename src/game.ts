import * as C from './constants';
import { Renderer } from './renderer';
import { InputManager } from './input';
import { Ball, Flipper, BuildingManager } from './entities';
import { HumanManager } from './humans';
import { ParticleManager } from './particles';
import { JuiceManager } from './juice';
import { SoundEngine } from './sound';
import { UIManager } from './ui';
import { getStage } from './stages';
import { circleAABBCollision, circleCollision, circleOBBCollision } from './physics';

export class Game {
  renderer: Renderer;
  input: InputManager;
  ball: Ball;
  flipperLeft: Flipper;
  flipperRight: Flipper;
  buildings: BuildingManager;
  humans: HumanManager;
  particles: ParticleManager;
  juice: JuiceManager;
  sound: SoundEngine;
  ui: UIManager;

  currentStage: number = 1;
  gameRunning: boolean = true;
  gameOver: boolean = false;

  // Track when last human was crushed for combo
  lastCrushTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.ball = new Ball();
    this.flipperLeft = new Flipper('left');
    this.flipperRight = new Flipper('right');
    this.buildings = new BuildingManager();
    this.humans = new HumanManager();
    this.particles = new ParticleManager();
    this.juice = new JuiceManager();
    this.sound = new SoundEngine();
    this.ui = new UIManager();

    this.loadStage(this.currentStage);
  }

  loadStage(stageNumber: number) {
    const stage = getStage(stageNumber);
    this.buildings.clear();
    this.humans.clear();
    this.particles.clear();

    for (const building of stage.buildings) {
      this.buildings.addBuilding(building.x, building.y, building.type);
    }

    this.ball.reset();
    this.ui.resetBalls();
  }

  update(dt: number) {
    // Apply juice time scale
    const scaledDt = dt * this.juice.getTimeScale();

    // Update input and flippers
    this.flipperLeft.isActive = this.input.leftPressed;
    this.flipperRight.isActive = this.input.rightPressed;
    this.flipperLeft.update(scaledDt);
    this.flipperRight.update(scaledDt);

    // Update ball
    this.ball.update(scaledDt);

    // Update buildings
    this.buildings.update(scaledDt);

    // Update humans
    this.humans.update(scaledDt);

    // Update particles
    this.particles.update(scaledDt);

    // Update UI
    this.ui.update(scaledDt);

    // Update juice
    this.juice.update(dt);

    // ========== COLLISION DETECTION ==========

    // Ball vs Buildings
    for (const building of this.buildings.buildings) {
      if (!building.isActive || building.hp === 0) continue;

      const buildingConfig = C.BUILDING_TYPES[building.type];
      if (circleAABBCollision(
        { x: this.ball.x, y: this.ball.y, radius: this.ball.radius },
        { x: building.x, y: building.y, width: buildingConfig.width, height: buildingConfig.height }
      )) {
        // Damage building
        this.buildings.damage(building);

        // Bounce ball
        this.ball.vy = Math.abs(this.ball.vy);

        // VFX
        this.sound.playSound('building_hit');

        // If building destroyed, spawn humans
        if (building.hp === 0) {
          const config = C.BUILDING_TYPES[building.type];
          const humansToSpawn = building.type === 'small' ? 4 : building.type === 'medium' ? 6 : 10;
          this.humans.spawn(building.x, building.y, humansToSpawn);

          // Big juice on destroy
          const isLarge = building.type === 'large';
          const shakeConfig = isLarge ? C.SHAKE_LARGE_BUILD_DESTROY : C.SHAKE_BUILDING_DESTROY;
          this.juice.triggerShake(shakeConfig);
          this.juice.triggerHitStop(isLarge ? C.HITSTOP_LARGE_BUILD_DESTROY : C.HITSTOP_BUILDING_DESTROY);
          this.juice.triggerFlash();

          this.sound.playSound('building_destroy');

          // Particles
          this.particles.emit(building.x, building.y, 15, 'debris');

          // Score
          this.ui.addScore(config.scoreValue);
        } else {
          this.juice.triggerShake(C.SHAKE_BUILDING_DAMAGE);
          this.sound.playSound('building_hit');
        }
      }
    }

    // Ball vs Humans
    for (let i = 0; i < this.humans.count; i++) {
      const human = this.humans.getHumanAtIndex(i);
      if (human.state !== 1) continue; // Only running humans (state = 1)

      if (circleAABBCollision(
        { x: this.ball.x, y: this.ball.y, radius: this.ball.radius },
        { x: human.x, y: human.y, width: C.HUMAN_WIDTH, height: C.HUMAN_HEIGHT }
      )) {
        // Crush human
        this.humans.crush(i);

        // Combo logic
        const now = performance.now() / 1000;
        if (now - this.lastCrushTime < C.COMBO_TIMEOUT) {
          this.ui.incrementCombo();
        } else {
          this.ui.combo = 1;
          this.ui.comboTimer = C.COMBO_TIMEOUT;
        }
        this.lastCrushTime = now;

        // Score
        const scorePerCrush = C.HUMAN_CRUSH_SCORE * this.ui.getComboMultiplier();
        this.ui.addScore(scorePerCrush);

        // VFX
        this.particles.emit(human.x, human.y, 10, 'blood');
        this.juice.triggerShake(C.SHAKE_HUMAN_CRUSH);
        this.sound.playSound('human_crush');
      }
    }

    // Ball vs Flippers (always detect collision, passive bounce when inactive, active launch when active)
    const flipperOBB_L = this.flipperLeft.getOBB();
    const flipperOBB_R = this.flipperRight.getOBB();

    if (circleOBBCollision(
      { x: this.ball.x, y: this.ball.y, radius: this.ball.radius },
      flipperOBB_L
    )) {
      this.flipperLeft.launchBall(this.ball);
      this.sound.playSound('flipper');
      if (this.flipperLeft.isActive) {
        this.juice.triggerFlash(0.05);
      }
    }

    if (circleOBBCollision(
      { x: this.ball.x, y: this.ball.y, radius: this.ball.radius },
      flipperOBB_R
    )) {
      this.flipperRight.launchBall(this.ball);
      this.sound.playSound('flipper');
      if (this.flipperRight.isActive) {
        this.juice.triggerFlash(0.05);
      }
    }

    // Ball lost
    if (this.ball.isLost()) {
      this.ui.lostBall();
      this.sound.playSound('ball_lost');

      if (this.ui.isGameOver()) {
        this.gameOver = true;
        this.gameRunning = false;
      } else {
        this.ball.reset();
      }
    }

    // Stage complete
    if (this.buildings.getActiveCount() === 0 && this.buildings.buildings.length > 0) {
      this.sound.playSound('stage_clear');
      this.juice.triggerSlowMotion(1.0, 0.2);
      this.juice.triggerFlash(0.2);

      // Bonus for remaining humans
      this.ui.addScore(this.humans.getActiveCount() * 50);

      // Next stage
      this.currentStage++;
      setTimeout(() => this.loadStage(this.currentStage), 1000);
    }
  }

  render() {
    this.renderer.clear();

    // Update shake offset
    const [shakeX, shakeY] = this.juice.getShakeOffset();
    this.renderer.setShakeOffset(shakeX, shakeY);

    // ========== Draw Buildings ==========
    if (this.buildings.buildings.length > 0) {
      const positions = new Float32Array(this.buildings.buildings.length * 2);
      const sizes = new Float32Array(this.buildings.buildings.length * 2);
      const colors = new Float32Array(this.buildings.buildings.length * 4);
      const rotations = new Float32Array(this.buildings.buildings.length);

      for (let i = 0; i < this.buildings.buildings.length; i++) {
        const b = this.buildings.buildings[i];
        const config = C.BUILDING_TYPES[b.type];

        positions[i * 2] = b.x;
        positions[i * 2 + 1] = b.y;

        sizes[i * 2] = config.width;
        sizes[i * 2 + 1] = config.height * (0.5 + 0.5 * (1 - b.destructionTimer / 0.2)); // Shrink on destroy

        const [r, g, bl, a] = this.buildings.getColor(b);
        colors[i * 4] = r;
        colors[i * 4 + 1] = g;
        colors[i * 4 + 2] = bl;
        colors[i * 4 + 3] = a;

        rotations[i] = 0;
      }

      this.renderer.drawQuads(positions, sizes, colors, rotations, this.buildings.buildings.length);
    }

    // ========== Draw Humans ==========
    if (this.humans.count > 0) {
      const positions = new Float32Array(this.humans.count * 2);
      const sizes = new Float32Array(this.humans.count * 2);
      const colors = new Float32Array(this.humans.count * 4);
      const rotations = new Float32Array(this.humans.count);

      for (let i = 0; i < this.humans.count; i++) {
        const pos = this.humans.getHumanAtIndex(i);

        positions[i * 2] = pos.x;
        positions[i * 2 + 1] = pos.y;

        sizes[i * 2] = C.HUMAN_WIDTH;
        sizes[i * 2 + 1] = C.HUMAN_HEIGHT;

        const r = this.humans.colors[i * 4];
        const g = this.humans.colors[i * 4 + 1];
        const b = this.humans.colors[i * 4 + 2];
        const a = this.humans.colors[i * 4 + 3];
        colors[i * 4] = r;
        colors[i * 4 + 1] = g;
        colors[i * 4 + 2] = b;
        colors[i * 4 + 3] = a;

        rotations[i] = 0;
      }

      this.renderer.drawQuads(positions, sizes, colors, rotations, this.humans.count);
    }

    // ========== Draw Ball ==========
    const ballPosArray = new Float32Array([this.ball.x, this.ball.y]);
    const ballRadiiArray = new Float32Array([this.ball.radius]);
    const ballColorArray = new Float32Array([...this.ball.color]);
    this.renderer.drawCircles(ballPosArray, ballRadiiArray, ballColorArray, 1);

    // Ball trail
    if (this.ball.trailPositions.length > 1) {
      const trailPositions = new Float32Array(this.ball.trailPositions.length * 2);
      const trailRadii = new Float32Array(this.ball.trailPositions.length);
      const trailColors = new Float32Array(this.ball.trailPositions.length * 4);

      for (let i = 0; i < this.ball.trailPositions.length; i++) {
        const [x, y] = this.ball.trailPositions[i];
        trailPositions[i * 2] = x;
        trailPositions[i * 2 + 1] = y;

        // Fade older points
        const age = (this.ball.trailPositions.length - i) / this.ball.trailPositions.length;
        trailRadii[i] = this.ball.radius * (0.3 + age * 0.3);

        trailColors[i * 4] = this.ball.color[0];
        trailColors[i * 4 + 1] = this.ball.color[1];
        trailColors[i * 4 + 2] = this.ball.color[2];
        trailColors[i * 4 + 3] = (1 - age) * 0.5;
      }

      this.renderer.drawCircles(trailPositions, trailRadii, trailColors, this.ball.trailPositions.length);
    }

    // ========== Draw Flippers ==========
    const flipperPositions = new Float32Array([
      this.flipperLeft.x, this.flipperLeft.y,
      this.flipperRight.x, this.flipperRight.y,
    ]);
    const flipperSizes = new Float32Array([
      this.flipperLeft.width, this.flipperLeft.height,
      this.flipperRight.width, this.flipperRight.height,
    ]);
    const flipperColors = new Float32Array([
      ...this.flipperLeft.getColor(),
      ...this.flipperRight.getColor(),
    ]);
    const flipperRotations = new Float32Array([
      (this.flipperLeft.angle * Math.PI) / 180,
      (this.flipperRight.angle * Math.PI) / 180,
    ]);
    this.renderer.drawQuads(flipperPositions, flipperSizes, flipperColors, flipperRotations, 2);

    // ========== Draw Particles ==========
    if (this.particles.count > 0) {
      this.renderer.drawCircles(
        this.particles.getPositions(),
        this.particles.getRadii(),
        this.particles.getColors(),
        this.particles.count
      );
    }

    // ========== Draw Flash Overlay ==========
    const flashAlpha = this.juice.getFlashAlpha();
    if (flashAlpha > 0) {
      this.renderer.drawFullscreenOverlay(1, 1, 1, flashAlpha);
    }

    // ========== Draw UI (Canvas 2D overlay) ==========
    this.renderUI();
  }

  private renderUI() {
    // Update score display
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) {
      scoreDisplay.textContent = `Score: ${this.ui.score}`;
    }

    // Update balls display
    const ballsDisplay = document.getElementById('balls-display');
    if (ballsDisplay) {
      ballsDisplay.textContent = `Balls: ${this.ui.ballsRemaining}`;
    }

    // Update combo display
    const comboDisplay = document.getElementById('combo-display');
    if (comboDisplay) {
      if (this.ui.combo > 0) {
        comboDisplay.textContent = `×${this.ui.combo}!`;
        comboDisplay.style.display = 'block';
        const scale = this.ui.comboPopupScale;
        comboDisplay.style.transform = `translate(-50%, -50%) scale(${scale})`;
        comboDisplay.style.color = this.ui.combo >= 5 ? '#ff6600' : '#ffff00';
      } else {
        comboDisplay.style.display = 'none';
      }
    }

    // Update game over screen
    if (this.gameOver) {
      const overlay = document.getElementById('game-over-overlay');
      const finalScore = document.getElementById('final-score');
      if (overlay && finalScore) {
        finalScore.textContent = `Final Score: ${this.ui.score}`;
        overlay.classList.add('show');
      }
    }
  }

  handleGameOver() {
    this.loadStage(1);
    this.gameOver = false;
    this.gameRunning = true;
    this.currentStage = 1;
    this.ui.score = 0;
    this.ui.combo = 0;
  }
}
