import * as C from './constants';

const HUMAN_STATE = {
  INACTIVE: 0,
  RUNNING: 1,
  CRUSHED: 2,
};

export class HumanManager {
  // Structure of Arrays
  positions: Float32Array;
  velocities: Float32Array;
  colors: Float32Array;
  states: Uint8Array;
  timers: Float32Array;
  directionTimers: Float32Array;

  count: number = 0;
  nextIndex: number = 0;

  constructor() {
    this.positions = new Float32Array(C.MAX_HUMANS * 2);
    this.velocities = new Float32Array(C.MAX_HUMANS * 2);
    this.colors = new Float32Array(C.MAX_HUMANS * 4);
    this.states = new Uint8Array(C.MAX_HUMANS);
    this.timers = new Float32Array(C.MAX_HUMANS);
    this.directionTimers = new Float32Array(C.MAX_HUMANS);

    // Initialize all as inactive
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      this.states[i] = HUMAN_STATE.INACTIVE;
    }
  }

  spawn(x: number, y: number, count: number) {
    for (let i = 0; i < count && this.nextIndex < C.MAX_HUMANS; i++) {
      const idx = this.nextIndex++;
      const angle = (Math.random() * Math.PI * 2);
      const speed = C.HUMAN_PANIC_SPEED * (0.8 + Math.random() * 0.4);

      // Position with small random offset
      this.positions[idx * 2] = x + (Math.random() - 0.5) * 20;
      this.positions[idx * 2 + 1] = y + (Math.random() - 0.5) * 20;

      // Velocity
      this.velocities[idx * 2] = Math.cos(angle) * speed;
      this.velocities[idx * 2 + 1] = Math.sin(angle) * speed;

      // Color (skin tone)
      this.colors[idx * 4] = 0.95 + (Math.random() - 0.5) * 0.1;
      this.colors[idx * 4 + 1] = 0.7 + (Math.random() - 0.5) * 0.1;
      this.colors[idx * 4 + 2] = 0.6 + (Math.random() - 0.5) * 0.1;
      this.colors[idx * 4 + 3] = 1;

      // State
      this.states[idx] = HUMAN_STATE.RUNNING;

      // Timers
      this.timers[idx] = 0;
      this.directionTimers[idx] = C.HUMAN_DIRECTION_CHANGE_INTERVAL * (0.5 + Math.random());

      this.count = Math.min(this.nextIndex, C.MAX_HUMANS);
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.states[i] === HUMAN_STATE.INACTIVE) continue; // Skip inactive

      if (this.states[i] === HUMAN_STATE.RUNNING) {
        // Update direction timer
        this.directionTimers[i] -= dt;
        if (this.directionTimers[i] <= 0) {
          // Change direction randomly
          const angle = Math.random() * Math.PI * 2;
          const speed = C.HUMAN_PANIC_SPEED * (0.8 + Math.random() * 0.4);
          this.velocities[i * 2] = Math.cos(angle) * speed;
          this.velocities[i * 2 + 1] = Math.sin(angle) * speed;
          this.directionTimers[i] = C.HUMAN_DIRECTION_CHANGE_INTERVAL * (0.5 + Math.random());
        }

        // Update position
        this.positions[i * 2] += this.velocities[i * 2] * dt * 60;
        this.positions[i * 2 + 1] += this.velocities[i * 2 + 1] * dt * 60;

        // Wall bouncing
        const minX = -180 + C.HUMAN_WIDTH / 2;
        const maxX = 180 - C.HUMAN_WIDTH / 2;
        const minY = -320 + C.HUMAN_HEIGHT / 2;
        const maxY = 320 - C.HUMAN_HEIGHT / 2;

        if (this.positions[i * 2] < minX || this.positions[i * 2] > maxX) {
          this.velocities[i * 2] *= -1;
          this.positions[i * 2] = Math.max(minX, Math.min(maxX, this.positions[i * 2]));
        }
        if (this.positions[i * 2 + 1] < minY || this.positions[i * 2 + 1] > maxY) {
          this.velocities[i * 2 + 1] *= -1;
          this.positions[i * 2 + 1] = Math.max(minY, Math.min(maxY, this.positions[i * 2 + 1]));
        }

        // Escape detection (reached top)
        if (this.positions[i * 2 + 1] > 300) {
          this.states[i] = HUMAN_STATE.INACTIVE;
        }
      } else if (this.states[i] === HUMAN_STATE.CRUSHED) {
        this.timers[i] -= dt;
        if (this.timers[i] <= 0) {
          this.states[i] = HUMAN_STATE.INACTIVE;
        }
      }
    }
  }

  crush(index: number) {
    if (index < 0 || index >= this.count) return;
    if (this.states[index] !== HUMAN_STATE.RUNNING) return; // Only crush running humans

    this.states[index] = HUMAN_STATE.CRUSHED;
    this.timers[index] = 0.1; // Brief display duration
  }

  getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.states[i] === HUMAN_STATE.RUNNING) count++;
    }
    return count;
  }

  clear() {
    this.count = 0;
    this.nextIndex = 0;
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      this.states[i] = HUMAN_STATE.INACTIVE;
    }
  }

  // For rendering
  getPositions(): Float32Array {
    return this.positions;
  }

  getColors(): Float32Array {
    return this.colors;
  }

  getCount(): number {
    return this.count;
  }

  getHumanAtIndex(i: number): { x: number; y: number; state: number } {
    return {
      x: this.positions[i * 2],
      y: this.positions[i * 2 + 1],
      state: this.states[i],
    };
  }
}
