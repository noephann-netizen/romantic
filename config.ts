export const INPUT_CONFIG = {
  MOUSE_SENS_X: 0.0026,
  MOUSE_SENS_Y: 0.0022,
  INVERT_X: false,
  INVERT_Y: false,
} as const;

export const GAME_CONFIG = {
  ARENA_RADIUS: 16.8,
  PLAYER_SPEED: 6.8,
  PLAYER_MAX_HP: 100,
  FLAME_MAX_HP: 100,
  FIRE_INTERVAL: 0.21,
  PROJECTILE_SPEED: 20,
  DASH_SPEED: 19,
  DASH_DURATION: 0.24,
  DASH_COOLDOWN: 1.35,
  PULSE_RADIUS: 8.5,
  MAX_ENEMIES: 28,
  MAX_PROJECTILES: 110,
  MAX_MOTES: 48,
  MAX_PARTICLES: 520,
  TARGET_MEMORIES: 400,
} as const;

export const QUALITY = {
  HIGH_DPR: 1.65,
  LOW_DPR: 1,
  STARS_HIGH: 950,
  STARS_LOW: 480,
  PETALS_HIGH: 180,
  PETALS_LOW: 80,
} as const;

export const COLORS = {
  night: 0x10091c,
  plum: 0x26132f,
  rose: 0xff8fbd,
  blush: 0xffc4d8,
  gold: 0xffd58a,
  ivory: 0xfff5e8,
  violet: 0xa991ff,
  shadow: 0x24122f,
} as const;
