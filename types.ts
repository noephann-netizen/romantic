import type * as THREE from "three";

export type GameStatus = "title" | "playing" | "paused" | "story" | "victory" | "gameover";
export type QualityTier = "high" | "low";
export type EnemyKind = "drifter" | "shooter" | "charger" | "boss";

export interface UiSnapshot {
  status: GameStatus;
  hp: number;
  flame: number;
  memories: number;
  energy: number;
  wave: number;
  score: number;
  bestScore: number;
  combo: number;
  dashCooldown: number;
  enemies: number;
  bossHp: number;
  storyIndex: number;
  muted: boolean;
  quality: QualityTier;
  objective: string;
  toast: string;
  victoryReason: string;
}

export type GameCommand =
  | "start"
  | "pause"
  | "resume"
  | "restart"
  | "title"
  | "continue"
  | "mute"
  | "quality";

export interface GameApi {
  command(command: GameCommand): void;
  setMove(x: number, z: number): void;
  setAttack(active: boolean): void;
  dash(): void;
  pulse(): void;
}

export interface Enemy {
  active: boolean;
  kind: EnemyKind;
  group: THREE.Group;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  cooldown: number;
  stateTimer: number;
  phase: number;
  chargeX: number;
  chargeZ: number;
  hitFlash: number;
  summoned65: boolean;
  summoned30: boolean;
}

export interface Projectile {
  active: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  life: number;
  friendly: boolean;
  damage: number;
  radius: number;
}

export interface MemoryMote {
  active: boolean;
  group: THREE.Group;
  value: number;
  phase: number;
}

export interface Hazard {
  active: boolean;
  mesh: THREE.Mesh;
  timer: number;
  duration: number;
  radius: number;
  x: number;
  z: number;
}

export interface RingEffect {
  active: boolean;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  growth: number;
}
