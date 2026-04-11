import * as C from './constants';
import { reflectVelocity, OBB, circleOBBCollision } from './physics';

export class Ball {
  x: number = C.BALL_START_X;
  y: number = C.BALL_START_Y;
  vx: number = 0;
  vy: number = 0;
  radius: number = C.BALL_RADIUS;
  color: [number, number, number, number] = [1, 0.6, 0.1, 1]; // Orange

  // Trail for juicy effects
  trailPositions: Array<[number, number]> = [];
  maxTrailLength = 12;

  update(dt: number) {
    // Apply gravity
    this.vy -= C.GRAVITY * dt * 60;

    // Clamp max speed
    const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (speed > C.MAX_BALL_SPEED) {
      const scale = C.MAX_BALL_SPEED / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    // Update position
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    // Wall collision (left/right)
    const minX = -180 + this.radius;
    const maxX = 180 - this.radius;
    if (this.x < minX) {
      this.x = minX;
      [this.vx, this.vy] = reflectVelocity(this.vx, this.vy, -1, 0, C.BALL_WALL_DAMPING);
    } else if (this.x > maxX) {
      this.x = maxX;
      [this.vx, this.vy] = reflectVelocity(this.vx, this.vy, 1, 0, C.BALL_WALL_DAMPING);
    }

    // Top wall
    const maxY = 320 - this.radius;
    if (this.y > maxY) {
      this.y = maxY;
      [this.vx, this.vy] = reflectVelocity(this.vx, this.vy, 0, 1, C.BALL_WALL_DAMPING);
    }

    // Trail
    this.trailPositions.push([this.x, this.y]);
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }
  }

  isLost(): boolean {
    return this.y < -320 - this.radius;
  }

  reset() {
    this.x = C.BALL_START_X;
    this.y = C.BALL_START_Y;
    this.vx = 0;
    this.vy = 0;
    this.trailPositions = [];
  }
}

export class Flipper {
  x: number;
  y: number;
  width: number = C.FLIPPER_WIDTH;
  height: number = C.FLIPPER_HEIGHT;
  isActive: boolean = false;
  angle: number = C.FLIPPER_REST_ANGLE; // degrees
  side: 'left' | 'right';

  constructor(side: 'left' | 'right') {
    this.side = side;
    this.x = side === 'left' ? C.FLIPPER_LEFT_X : C.FLIPPER_RIGHT_X;
    this.y = C.FLIPPER_Y;
  }

  update(dt: number) {
    const targetAngle = this.isActive ? C.FLIPPER_ACTIVE_ANGLE : C.FLIPPER_REST_ANGLE;
    const rotationPerFrame = C.FLIPPER_ROTATION_SPEED * dt * 60;

    if (this.side === 'left') {
      if (this.angle > targetAngle) {
        this.angle = Math.max(targetAngle, this.angle - rotationPerFrame);
      } else if (this.angle < targetAngle) {
        this.angle = Math.min(targetAngle, this.angle + rotationPerFrame);
      }
    } else {
      if (this.angle < targetAngle) {
        this.angle = Math.min(targetAngle, this.angle + rotationPerFrame);
      } else if (this.angle > targetAngle) {
        this.angle = Math.max(targetAngle, this.angle - rotationPerFrame);
      }
    }
  }

  getOBB(): OBB {
    const angleRad = (this.angle * Math.PI) / 180;
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: angleRad,
    };
  }

  launchBall(ball: Ball) {
    const angleRad = (this.angle * Math.PI) / 180;

    // Launch direction is 90 degrees to flipper (upward)
    const launchAngleRad = angleRad + Math.PI / 2;
    if (this.side === 'left') {
      // Left flipper angle sign is inverted
      const launchVel = C.FLIPPER_POWER;
      ball.vx = Math.cos(launchAngleRad) * launchVel;
      ball.vy = Math.sin(launchAngleRad) * launchVel;
    } else {
      const launchVel = C.FLIPPER_POWER;
      ball.vx = Math.cos(launchAngleRad) * launchVel;
      ball.vy = Math.sin(launchAngleRad) * launchVel;
    }
  }

  getColor(): [number, number, number, number] {
    return [0.3, 0.6, 1, 1]; // Blue
  }
}

export interface Building {
  id: number;
  x: number;
  y: number;
  type: 'small' | 'medium' | 'large';
  hp: number;
  maxHp: number;
  isActive: boolean;
  destructionTimer: number; // For collapse animation
}

export class BuildingManager {
  buildings: Building[] = [];
  nextId: number = 0;

  addBuilding(x: number, y: number, type: 'small' | 'medium' | 'large'): Building {
    const config = C.BUILDING_TYPES[type];
    const building: Building = {
      id: this.nextId++,
      x,
      y,
      type,
      hp: config.hp,
      maxHp: config.hp,
      isActive: true,
      destructionTimer: 0,
    };
    this.buildings.push(building);
    return building;
  }

  damage(building: Building) {
    building.hp = Math.max(0, building.hp - 1);
    if (building.hp === 0) {
      building.destructionTimer = 0.2; // seconds
    }
  }

  update(dt: number) {
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b.destructionTimer > 0) {
        b.destructionTimer -= dt;
        if (b.destructionTimer <= 0) {
          this.buildings.splice(i, 1);
        }
      }
    }
  }

  getActiveCount(): number {
    return this.buildings.filter((b) => b.hp > 0).length;
  }

  clear() {
    this.buildings = [];
    this.nextId = 0;
  }

  getColor(building: Building): [number, number, number, number] {
    const dmgRatio = 1 - building.hp / building.maxHp;
    const darken = 1 - dmgRatio * 0.4;
    return [0.8 * darken, 0.3 * darken, 0.2 * darken, 1]; // Red with damage darkening
  }
}
