import * as C from './constants';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  a: number;
  lifetime: number;
  maxLifetime: number;
  gravity: boolean;
  rotation?: number;
  angularVelocity?: number;
}

export class ParticleManager {
  particles: (Particle | null)[] = [];
  count: number = 0;

  // SoA for rendering
  positions: Float32Array;
  radii: Float32Array;
  colors: Float32Array;

  constructor() {
    this.positions = new Float32Array(C.MAX_PARTICLES * 2);
    this.radii = new Float32Array(C.MAX_PARTICLES);
    this.colors = new Float32Array(C.MAX_PARTICLES * 4);

    // Preallocate particle array
    for (let i = 0; i < C.MAX_PARTICLES; i++) {
      this.particles.push(null);
    }
  }

  emit(x: number, y: number, count: number, type: 'debris' | 'blood' | 'spark') {
    for (let i = 0; i < count && this.count < C.MAX_PARTICLES; i++) {
      // Find next available slot
      let idx = this.count;
      this.particles[idx] = this.createParticle(x, y, type);
      this.count++;
    }
  }

  private createParticle(x: number, y: number, type: string): Particle {
    const angle = Math.random() * Math.PI * 2;

    switch (type) {
      case 'debris': {
        const speed = 8 + Math.random() * 6;
        return {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2 + Math.random() * 2,
          r: 0.6 + Math.random() * 0.3,
          g: 0.3 + Math.random() * 0.2,
          b: 0.1 + Math.random() * 0.1,
          a: 1,
          lifetime: 0.8,
          maxLifetime: 0.8,
          gravity: true,
          rotation: Math.random() * Math.PI * 2,
          angularVelocity: (Math.random() - 0.5) * 20,
        };
      }
      case 'blood': {
        const speed = 10 + Math.random() * 8;
        return {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1 + Math.random() * 1.5,
          r: 0.8 + Math.random() * 0.2,
          g: Math.random() * 0.3,
          b: Math.random() * 0.2,
          a: 1,
          lifetime: 0.4,
          maxLifetime: 0.4,
          gravity: true,
        };
      }
      case 'spark': {
        const speed = 12 + Math.random() * 10;
        return {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 0.5 + Math.random() * 1,
          r: 1,
          g: 0.8 + Math.random() * 0.2,
          b: 0.2 + Math.random() * 0.3,
          a: 1,
          lifetime: 0.2,
          maxLifetime: 0.2,
          gravity: false,
        };
      }
      default:
        throw new Error(`Unknown particle type: ${type}`);
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p) continue;

      // Update lifetime
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        this.particles[i] = null;
        continue;
      }

      // Apply gravity
      if (p.gravity) {
        p.vy -= C.GRAVITY * 0.5 * dt * 60;
      }

      // Update position
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      // Update rotation
      if (p.rotation !== undefined && p.angularVelocity !== undefined) {
        p.rotation += p.angularVelocity * dt * 60;
      }

      // Fade out
      const progress = 1 - p.lifetime / p.maxLifetime;
      p.a = Math.max(0, 1 - progress);
    }

    // Compact array
    let writeIdx = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.particles[i] !== null) {
        if (writeIdx !== i) {
          this.particles[writeIdx] = this.particles[i];
        }
        writeIdx++;
      }
    }
    this.count = writeIdx;
  }

  getPositions(): Float32Array {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]!;
      this.positions[i * 2] = p.x;
      this.positions[i * 2 + 1] = p.y;
    }
    return this.positions;
  }

  getRadii(): Float32Array {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]!;
      this.radii[i] = p.radius;
    }
    return this.radii;
  }

  getColors(): Float32Array {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]!;
      this.colors[i * 4] = p.r;
      this.colors[i * 4 + 1] = p.g;
      this.colors[i * 4 + 2] = p.b;
      this.colors[i * 4 + 3] = p.a;
    }
    return this.colors;
  }

  getCount(): number {
    return this.count;
  }

  clear() {
    this.count = 0;
    for (let i = 0; i < C.MAX_PARTICLES; i++) {
      this.particles[i] = null;
    }
  }
}
