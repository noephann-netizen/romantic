import * as THREE from "three";
import { GameLoop } from "./engine";
import { Input } from "./input";
import { AudioSystem } from "./audio";
import { storage } from "./storage";
import { GAME_CONFIG } from "./config";
import { ParticleSystem } from "./particles";
import { World, createEnemyGroup, createMote, seededRandom } from "./world";
import type { Enemy, EnemyKind, GameApi, GameCommand, GameStatus, Hazard, MemoryMote, Projectile, RingEffect, UiSnapshot } from "./types";

export const STORIES = [
  {
    eyebrow: "BABAK I · 100 KENANGAN",
    title: "Hal kecil yang jadi berarti",
    text: "Via, aku masih suka cara kita bisa tiba-tiba ngobrol panjang dari hal kecil. Cerita yang biasa saja jadi terasa istimewa, mungkin karena aku menceritakannya sama kamu.",
  },
  {
    eyebrow: "BABAK II · 200 KENANGAN",
    title: "Bukan cuma bertahan",
    text: "Aku tahu belakangan ini nggak semuanya mudah. Aku juga masih belajar buat lebih peka, lebih inisiatif, dan nggak cuma menunggu. Bukan karena takut kehilangan saja, tapi karena kamu memang layak diperjuangkan dengan cara yang lebih nyata.",
  },
  {
    eyebrow: "BABAK III · 300 KENANGAN",
    title: "Tetap memilih ngobrol",
    text: "Kalau nanti ada hari yang berat lagi, aku harap kita tetap memilih buat ngobrol, bukan saling pergi diam-diam. Aku nggak menuntut semuanya langsung sempurna; aku cuma berharap kita sama-sama mau berusaha.",
  },
] as const;

const WAVE_OBJECTIVES = [
  "Kumpulkan 100 serpihan · tahan klik / CAHAYA untuk menyerang",
  "Jaga api kita · gunakan dash saat Jarak bersiap menerjang",
  "Penuhi energi rindu · tekan E / RINDU untuk pulse pemulih",
  "Urai Ragu Terakhir · hindari lingkaran sebelum serangannya jatuh",
] as const;

const WAVE_ENEMIES: EnemyKind[][] = [
  ["drifter", "drifter", "drifter", "drifter", "drifter", "drifter", "drifter", "shooter", "shooter", "shooter"],
  ["drifter", "drifter", "drifter", "drifter", "drifter", "drifter", "shooter", "shooter", "charger", "charger"],
  ["drifter", "drifter", "drifter", "drifter", "shooter", "shooter", "shooter", "shooter", "charger", "charger"],
  ["boss"],
];

export class Game implements GameApi {
  readonly world: World;
  readonly input: Input;
  readonly audio = new AudioSystem();
  private readonly loop: GameLoop;
  private readonly emit: (ui: UiSnapshot) => void;
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly motes: MemoryMote[] = [];
  private readonly hazards: Hazard[] = [];
  private readonly rings: RingEffect[] = [];
  private readonly particles: ParticleSystem;
  private readonly rng = seededRandom(400);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly aimPoint = new THREE.Vector3();
  private readonly projectileGeometry = new THREE.SphereGeometry(0.14, 10, 8);
  private readonly friendlyProjectileMat = new THREE.MeshBasicMaterial({ color: 0xffc0da });
  private readonly enemyProjectileMat = new THREE.MeshBasicMaterial({ color: 0x9a66e8 });
  private readonly ringGeometry = new THREE.RingGeometry(0.82, 1, 64);
  private spawnQueue: EnemyKind[] = [];
  private status: GameStatus = "title";
  private elapsed = 0;
  private gameTime = 0;
  private hp: number = GAME_CONFIG.PLAYER_MAX_HP;
  private flame: number = GAME_CONFIG.FLAME_MAX_HP;
  private memories: number = 0;
  private energy: number = 0;
  private score = 0;
  private bestScore = Math.max(0, Number(storage.get("bestScore", 0)) || 0);
  private wave = 1;
  private storyIndex = 0;
  private spawnTimer = 0;
  private fireTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private invulnerable = 0;
  private clearTimer = 0;
  private comboTimer = 0;
  private chain = 0;
  private combo = 1;
  private toastTimer = 0;
  private toast = "";
  private objective: string = WAVE_OBJECTIVES[0];
  private victoryReason = "";
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private externalAttack = false;
  private pointerAttack = false;
  private pointerAimActive = false;
  private dashRequested = false;
  private pulseRequested = false;
  private dashX = 0;
  private dashZ = -1;
  private lastMoveX = 0;
  private lastMoveZ = -1;
  private emitTimer = 0;
  private celebrating = false;
  private lastRender = 0;
  private fps = 60;
  private lowFpsTimer = 0;

  constructor(canvas: HTMLCanvasElement, emit: (ui: UiSnapshot) => void) {
    this.emit = emit;
    this.world = new World(canvas);
    this.input = new Input(canvas);
    this.particles = new ParticleSystem(this.world.scene);
    this.createPools();
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("contextmenu", this.preventContext);
    this.emitUi();
    this.loop.start();
  }

  private createPools(): void {
    const counts: Record<EnemyKind, number> = { drifter: 18, shooter: 12, charger: 7, boss: 1 };
    (Object.keys(counts) as EnemyKind[]).forEach((kind) => {
      for (let i = 0; i < counts[kind]; i++) {
        const group = createEnemyGroup(kind);
        this.world.scene.add(group);
        this.enemies.push({
          active: false, kind, group, hp: 1, maxHp: 1, radius: 0.7, speed: 1, cooldown: 0,
          stateTimer: 0, phase: this.rng() * 10, chargeX: 0, chargeZ: 0, hitFlash: 0,
          summoned65: false, summoned30: false,
        });
      }
    });
    for (let i = 0; i < GAME_CONFIG.MAX_PROJECTILES; i++) {
      const mesh = new THREE.Mesh(this.projectileGeometry, this.friendlyProjectileMat);
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.projectiles.push({ active: false, mesh, vx: 0, vz: 0, life: 0, friendly: true, damage: 0, radius: 0.2 });
    }
    for (let i = 0; i < GAME_CONFIG.MAX_MOTES; i++) {
      const group = createMote();
      this.world.scene.add(group);
      this.motes.push({ active: false, group, value: 10, phase: this.rng() * Math.PI * 2 });
    }
    for (let i = 0; i < 10; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xff5c9d, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(this.ringGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.hazards.push({ active: false, mesh, timer: 0, duration: 1, radius: 1, x: 0, z: 0 });
    }
    for (let i = 0; i < 16; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffb1d2, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(this.ringGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.rings.push({ active: false, mesh, life: 0, maxLife: 1, growth: 1 });
    }
  }

  command(command: GameCommand): void {
    switch (command) {
      case "start": if (this.status === "title") this.startRun(); break;
      case "pause": if (this.status === "playing") this.pause(); break;
      case "resume": if (this.status === "paused") this.resume(); break;
      case "restart": if (["paused", "gameover", "victory"].includes(this.status)) this.startRun(); break;
      case "title": this.goTitle(); break;
      case "continue": if (this.status === "story") this.continueStory(); break;
      case "mute": this.audio.toggleMute(); this.emitUi(); break;
      case "quality":
        this.world.setQuality(this.world.quality === "high" ? "low" : "high");
        this.showToast(this.world.quality === "high" ? "Visual mewah · kualitas tinggi" : "Mode ringan · tetap cantik");
        this.emitUi();
        break;
    }
  }

  setMove(x: number, z: number): void {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveZ = THREE.MathUtils.clamp(z, -1, 1);
  }

  setAttack(active: boolean): void { this.externalAttack = active; }
  dash(): void { this.dashRequested = true; }
  pulse(): void { this.pulseRequested = true; }

  private setStatus(status: GameStatus): void {
    this.status = status;
    this.emitUi();
  }

  private startRun(): void {
    this.resetRun();
    this.setStatus("playing");
    this.startWave(1);
    void this.audio.startMusic();
    this.audio.sfx("ui");
  }

  private resetRun(): void {
    this.hp = GAME_CONFIG.PLAYER_MAX_HP;
    this.flame = GAME_CONFIG.FLAME_MAX_HP;
    this.memories = 0;
    this.energy = 0;
    this.score = 0;
    this.wave = 1;
    this.gameTime = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.fireTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invulnerable = 0;
    this.clearTimer = 0;
    this.combo = 1;
    this.chain = 0;
    this.comboTimer = 0;
    this.celebrating = false;
    this.victoryReason = "";
    this.world.player.position.set(0, 0.15, 8);
    this.world.player.rotation.set(0, 0, 0);
    for (const enemy of this.enemies) { enemy.active = false; enemy.group.visible = false; }
    for (const p of this.projectiles) { p.active = false; p.mesh.visible = false; }
    for (const mote of this.motes) { mote.active = false; mote.group.visible = false; }
    for (const hazard of this.hazards) { hazard.active = false; hazard.mesh.visible = false; }
    for (const ring of this.rings) { ring.active = false; ring.mesh.visible = false; }
    this.particles.clear();
    this.input.actions.clear();
  }

  private goTitle(): void {
    this.resetRun();
    this.celebrating = false;
    this.setStatus("title");
    this.audio.sfx("ui");
  }

  private pause(): void {
    this.pointerAttack = false;
    this.externalAttack = false;
    this.setStatus("paused");
    this.audio.sfx("ui");
  }

  private resume(): void {
    this.setStatus("playing");
    this.audio.sfx("ui");
  }

  private continueStory(): void {
    this.audio.sfx("ui");
    this.setStatus("playing");
    this.startWave(this.wave + 1);
  }

  private startWave(wave: number): void {
    this.wave = wave;
    this.spawnQueue = WAVE_ENEMIES[wave - 1].slice();
    this.spawnTimer = wave === 1 ? 1.1 : 0.65;
    this.clearTimer = 0;
    this.objective = WAVE_OBJECTIVES[wave - 1];
    this.showToast(wave === 4 ? "Babak terakhir · Ragu Terakhir muncul" : `Babak ${wave} · Taman kenangan terbuka`);
    if (wave > 1) {
      this.hp = Math.min(GAME_CONFIG.PLAYER_MAX_HP, this.hp + (wave === 4 ? 25 : 16));
      this.flame = Math.min(GAME_CONFIG.FLAME_MAX_HP, this.flame + (wave === 4 ? 25 : 20));
      this.audio.sfx("wave");
    }
    this.emitUi();
  }

  private update(dt: number): void {
    this.elapsed += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast = "";
    }
    if (this.status === "title") {
      if (this.input.consumeAction("Space") || this.input.consumeAction("Enter")) this.startRun();
    } else if (this.status === "playing") {
      if (this.input.consumeAction("Escape") || this.input.consumeAction("KeyP")) this.pause();
      else {
        if (this.input.consumeAction("Space")) this.dashRequested = true;
        if (this.input.consumeAction("KeyE")) this.pulseRequested = true;
        this.updatePlaying(dt);
      }
    } else if (this.status === "paused") {
      if (this.input.consumeAction("Escape") || this.input.consumeAction("KeyP")) this.resume();
    } else if (this.status === "story") {
      if (this.input.consumeAction("Space") || this.input.consumeAction("Enter")) this.continueStory();
    } else if (this.status === "gameover") {
      if (this.input.consumeAction("Space") || this.input.consumeAction("Enter")) this.startRun();
    } else if (this.status === "victory") {
      if (this.input.consumeAction("KeyR")) this.startRun();
    }
    this.particles.update(dt);
    this.updateRings(dt);
    if (this.status !== "playing") this.updateHazards(0);
    this.world.update(dt, this.elapsed, this.status, this.flame / GAME_CONFIG.FLAME_MAX_HP, this.celebrating);
    this.emitTimer -= dt;
    if (this.emitTimer <= 0) {
      this.emitTimer = 0.1;
      this.emitUi();
    }
  }

  private updatePlaying(dt: number): void {
    this.gameTime += dt;
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.chain = 0; this.combo = 1; }
    }
    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateMotes(dt);
    this.updateHazards(dt);
    if (this.spawnQueue.length === 0 && this.activeEnemyCount() === 0) {
      this.clearTimer += dt;
      if (this.clearTimer >= 0.9) this.finishWave();
    } else this.clearTimer = 0;
    this.dashRequested = false;
    this.pulseRequested = false;
  }

  private updatePlayer(dt: number): void {
    let x = THREE.MathUtils.clamp(this.input.moveX + this.touchMoveX, -1, 1);
    let z = THREE.MathUtils.clamp(-this.input.moveZ + this.touchMoveZ, -1, 1);
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    if (length > 0.08) {
      this.lastMoveX = x;
      this.lastMoveZ = z;
    }
    if (this.dashRequested && this.dashCooldown <= 0) {
      this.dashX = length > 0.08 ? x : this.lastMoveX;
      this.dashZ = length > 0.08 ? z : this.lastMoveZ;
      this.dashTimer = GAME_CONFIG.DASH_DURATION;
      this.dashCooldown = GAME_CONFIG.DASH_COOLDOWN;
      this.invulnerable = Math.max(this.invulnerable, GAME_CONFIG.DASH_DURATION + 0.18);
      this.audio.sfx("dash");
      this.spawnRing(this.world.player.position.x, this.world.player.position.z, 0xffa8ce, 0.45, 5);
      this.world.shake(0.2);
    }
    if (this.pulseRequested) this.usePulse();
    let speed: number = GAME_CONFIG.PLAYER_SPEED;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      x = this.dashX;
      z = this.dashZ;
      speed = GAME_CONFIG.DASH_SPEED;
      this.particles.trail(this.world.player.position.x, 0.7, this.world.player.position.z, 0xff9fc7);
    }
    this.world.player.position.x += x * speed * dt;
    this.world.player.position.z += z * speed * dt;
    const radius = Math.hypot(this.world.player.position.x, this.world.player.position.z);
    const limit = GAME_CONFIG.ARENA_RADIUS;
    if (radius > limit) {
      this.world.player.position.x = (this.world.player.position.x / radius) * limit;
      this.world.player.position.z = (this.world.player.position.z / radius) * limit;
    }
    const centerDistance = Math.hypot(this.world.player.position.x, this.world.player.position.z);
    if (centerDistance < 2.35 && centerDistance > 0.001) {
      this.world.player.position.x = (this.world.player.position.x / centerDistance) * 2.35;
      this.world.player.position.z = (this.world.player.position.z / centerDistance) * 2.35;
    }
    if (length > 0.08) {
      const targetRotation = Math.atan2(x, z);
      this.world.player.rotation.y = this.lerpAngle(this.world.player.rotation.y, targetRotation, 1 - Math.exp(-dt * 12));
    }
    if ((this.externalAttack || this.pointerAttack || this.input.isDown("KeyJ")) && this.fireTimer <= 0) this.fire();
  }

  private fire(): void {
    let dx = 0;
    let dz = -1;
    let found = false;
    if (this.pointerAimActive) {
      this.raycaster.setFromCamera(this.pointerNdc, this.world.camera);
      if (this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint)) {
        dx = this.aimPoint.x - this.world.player.position.x;
        dz = this.aimPoint.z - this.world.player.position.z;
        found = Math.hypot(dx, dz) > 0.2;
      }
    }
    if (!found) {
      const target = this.nearestEnemy(this.world.player.position.x, this.world.player.position.z, 24);
      if (target) {
        dx = target.group.position.x - this.world.player.position.x;
        dz = target.group.position.z - this.world.player.position.z;
        found = true;
      }
    }
    if (!found) { dx = this.lastMoveX; dz = this.lastMoveZ; }
    const length = Math.max(0.001, Math.hypot(dx, dz));
    dx /= length;
    dz /= length;
    this.spawnProjectile(this.world.player.position.x + dx * 0.6, 1.1, this.world.player.position.z + dz * 0.6, dx, dz, true, 25, GAME_CONFIG.PROJECTILE_SPEED);
    this.world.player.rotation.y = Math.atan2(dx, dz);
    this.fireTimer = GAME_CONFIG.FIRE_INTERVAL;
    this.audio.sfx("shot");
    this.particles.burst(this.world.player.position.x + dx * 0.6, 1.05, this.world.player.position.z + dz * 0.6, 0xffd0df, 3, 1.1);
  }

  private usePulse(): void {
    if (this.energy < 99.9) {
      this.showToast(`Energi rindu ${Math.floor(this.energy)}% · kumpulkan serpihan dulu`);
      this.audio.sfx("ui");
      return;
    }
    this.energy = 0;
    this.hp = Math.min(GAME_CONFIG.PLAYER_MAX_HP, this.hp + 18);
    this.flame = Math.min(GAME_CONFIG.FLAME_MAX_HP, this.flame + 15);
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const distance = this.distanceToPlayer(enemy.group.position.x, enemy.group.position.z);
      if (distance <= GAME_CONFIG.PULSE_RADIUS) this.damageEnemy(enemy, 150);
    }
    for (const p of this.projectiles) {
      if (p.active && !p.friendly) { p.active = false; p.mesh.visible = false; }
    }
    this.spawnRing(this.world.player.position.x, this.world.player.position.z, 0xffd2e2, 0.8, 11);
    this.particles.burst(this.world.player.position.x, 1, this.world.player.position.z, 0xffd2e2, 46, 7);
    this.world.shake(0.75);
    this.audio.sfx("pulse");
    this.showToast("Rindu menjadi cahaya · api dan hatimu pulih");
  }

  private updateSpawning(dt: number): void {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const kind = this.spawnQueue.shift()!;
    this.spawnEnemy(kind);
    this.spawnTimer = kind === "boss" ? 1 : 0.62;
  }

  private spawnEnemy(kind: EnemyKind, nearX?: number, nearZ?: number): Enemy | null {
    const enemy = this.enemies.find((item) => !item.active && item.kind === kind);
    if (!enemy) return null;
    let a = this.rng() * Math.PI * 2;
    let r = 12.5 + this.rng() * 2.5;
    if (nearX !== undefined && nearZ !== undefined) {
      enemy.group.position.set(nearX + Math.cos(a) * 3.2, 0, nearZ + Math.sin(a) * 3.2);
    } else {
      for (let tries = 0; tries < 5; tries++) {
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (this.distanceToPlayer(x, z) > 6) {
          enemy.group.position.set(x, 0, z);
          break;
        }
        a += 1.2;
        r = 12.5 + this.rng() * 2.5;
      }
      if (enemy.group.position.lengthSq() < 0.01) enemy.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const stats: Record<EnemyKind, [number, number, number]> = {
      drifter: [42 + this.wave * 6, 0.68, 2.2 + this.wave * 0.12],
      shooter: [58 + this.wave * 6, 0.78, 1.65],
      charger: [105 + this.wave * 8, 0.95, 1.7],
      boss: [1150, 1.75, 1.25],
    };
    const [hp, radius, speed] = stats[kind];
    enemy.hp = enemy.maxHp = hp;
    enemy.radius = radius;
    enemy.speed = speed;
    enemy.cooldown = kind === "boss" ? 2.4 : 1.2 + this.rng();
    enemy.stateTimer = 0;
    enemy.hitFlash = 0;
    enemy.summoned65 = false;
    enemy.summoned30 = false;
    enemy.active = true;
    enemy.group.visible = true;
    enemy.group.scale.setScalar(1);
    this.spawnRing(enemy.group.position.x, enemy.group.position.z, kind === "boss" ? 0xff6aab : 0x9f79e8, 0.65, kind === "boss" ? 4 : 2);
    this.particles.burst(enemy.group.position.x, 0.7, enemy.group.position.z, 0xa276e8, kind === "boss" ? 34 : 9, 2.8);
    return enemy;
  }

  private updateEnemies(dt: number): void {
    const px = this.world.player.position.x;
    const pz = this.world.player.position.z;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.phase += dt;
      enemy.cooldown -= dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.group.scale.setScalar(1 + enemy.hitFlash * 0.65);
      enemy.group.position.y = Math.sin(enemy.phase * 2.2) * (enemy.kind === "boss" ? 0.16 : 0.09);
      enemy.group.rotation.y += dt * (enemy.kind === "boss" ? 0.16 : 0.4);
      if (enemy.kind === "boss") {
        for (let i = 0; i < 3; i++) {
          const ring = enemy.group.getObjectByName(`boss-ring-${i}`);
          if (ring) ring.rotation.z += dt * (0.35 + i * 0.22) * (i % 2 ? -1 : 1);
        }
        this.updateBoss(enemy, dt);
      } else if (enemy.kind === "drifter") {
        const playerDistance = Math.hypot(px - enemy.group.position.x, pz - enemy.group.position.z);
        const targetPlayer = playerDistance < 6.8;
        const tx = targetPlayer ? px : 0;
        const tz = targetPlayer ? pz : 0;
        this.moveEnemyToward(enemy, tx, tz, enemy.speed, dt);
      } else if (enemy.kind === "shooter") {
        const dx = px - enemy.group.position.x;
        const dz = pz - enemy.group.position.z;
        const distance = Math.max(0.001, Math.hypot(dx, dz));
        let mx = 0;
        let mz = 0;
        if (distance > 9) { mx = dx / distance; mz = dz / distance; }
        else if (distance < 6) { mx = -dx / distance; mz = -dz / distance; }
        else { mx = -dz / distance * 0.65; mz = dx / distance * 0.65; }
        this.moveEnemy(enemy, mx, mz, enemy.speed, dt);
        if (enemy.cooldown <= 0 && distance < 15) {
          const base = Math.atan2(dz, dx);
          for (const offset of [-0.16, 0, 0.16]) {
            const angle = base + offset;
            this.spawnProjectile(enemy.group.position.x, 0.85, enemy.group.position.z, Math.cos(angle), Math.sin(angle), false, 9, 5.6);
          }
          enemy.cooldown = 2.6 - Math.min(0.45, this.wave * 0.1);
          this.spawnRing(enemy.group.position.x, enemy.group.position.z, 0xa47cff, 0.3, 1.2);
        }
      } else if (enemy.kind === "charger") {
        const dx = px - enemy.group.position.x;
        const dz = pz - enemy.group.position.z;
        const distance = Math.max(0.001, Math.hypot(dx, dz));
        if (enemy.stateTimer > 0) {
          enemy.stateTimer -= dt;
          if (enemy.stateTimer < 0.58) this.moveEnemy(enemy, enemy.chargeX, enemy.chargeZ, 11.5, dt);
          else enemy.group.scale.multiplyScalar(1 + Math.sin(enemy.stateTimer * 30) * 0.015);
        } else if (enemy.cooldown <= 0 && distance < 11) {
          enemy.chargeX = dx / distance;
          enemy.chargeZ = dz / distance;
          enemy.stateTimer = 1.05;
          enemy.cooldown = 4.2;
          this.spawnRing(enemy.group.position.x, enemy.group.position.z, 0xff6eac, 0.55, 2.4);
        } else this.moveEnemy(enemy, dx / distance, dz / distance, enemy.speed, dt);
      }
      if (!enemy.active) continue;
      const playerDistance = this.distanceToPlayer(enemy.group.position.x, enemy.group.position.z);
      if (playerDistance < enemy.radius + 0.55) this.damagePlayer(enemy.kind === "boss" ? 22 : enemy.kind === "charger" ? 17 : 11);
      if (enemy.kind !== "boss" && Math.hypot(enemy.group.position.x, enemy.group.position.z) < 2.2 + enemy.radius) {
        this.damageFlame(enemy.kind === "charger" ? 16 : 8);
        this.deactivateEnemy(enemy, false);
      }
    }
  }

  private updateBoss(enemy: Enemy, dt: number): void {
    const angle = this.gameTime * 0.18;
    this.moveEnemyToward(enemy, Math.cos(angle) * 5.2, Math.sin(angle) * 5.2, enemy.speed, dt);
    if (enemy.cooldown <= 0) {
      const pattern = Math.floor(this.gameTime / 3) % 2;
      if (pattern === 0) {
        const count = enemy.hp < enemy.maxHp * 0.45 ? 20 : 14;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + angle;
          this.spawnProjectile(enemy.group.position.x, 1.1, enemy.group.position.z, Math.cos(a), Math.sin(a), false, 11, 5.2);
        }
        this.world.shake(0.35);
      } else {
        this.spawnHazard(this.world.player.position.x, this.world.player.position.z, 3.1, 1.25);
        const dx = this.world.player.position.x - enemy.group.position.x;
        const dz = this.world.player.position.z - enemy.group.position.z;
        const length = Math.max(0.001, Math.hypot(dx, dz));
        for (const offset of [-0.24, 0, 0.24]) {
          const a = Math.atan2(dz / length, dx / length) + offset;
          this.spawnProjectile(enemy.group.position.x, 1.1, enemy.group.position.z, Math.cos(a), Math.sin(a), false, 12, 6.5);
        }
      }
      enemy.cooldown = enemy.hp < enemy.maxHp * 0.45 ? 2.15 : 3.15;
    }
    if (!enemy.summoned65 && enemy.hp < enemy.maxHp * 0.65) {
      enemy.summoned65 = true;
      for (let i = 0; i < 3; i++) this.spawnEnemy("drifter", enemy.group.position.x, enemy.group.position.z);
      this.showToast("Ragu memanggil bayangan · pulse dapat membersihkannya");
    }
    if (!enemy.summoned30 && enemy.hp < enemy.maxHp * 0.3) {
      enemy.summoned30 = true;
      for (let i = 0; i < 2; i++) this.spawnEnemy("shooter", enemy.group.position.x, enemy.group.position.z);
      this.spawnEnemy("charger", enemy.group.position.x, enemy.group.position.z);
      this.showToast("Bentuk terakhir · jaga jarak dan pilih waktu dash");
    }
  }

  private moveEnemyToward(enemy: Enemy, tx: number, tz: number, speed: number, dt: number): void {
    const dx = tx - enemy.group.position.x;
    const dz = tz - enemy.group.position.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    this.moveEnemy(enemy, dx / length, dz / length, speed, dt);
  }

  private moveEnemy(enemy: Enemy, x: number, z: number, speed: number, dt: number): void {
    enemy.group.position.x += x * speed * dt;
    enemy.group.position.z += z * speed * dt;
    const radius = Math.hypot(enemy.group.position.x, enemy.group.position.z);
    if (radius > GAME_CONFIG.ARENA_RADIUS + 0.5) {
      enemy.group.position.x *= (GAME_CONFIG.ARENA_RADIUS + 0.5) / radius;
      enemy.group.position.z *= (GAME_CONFIG.ARENA_RADIUS + 0.5) / radius;
    }
  }

  private spawnProjectile(x: number, y: number, z: number, dx: number, dz: number, friendly: boolean, damage: number, speed: number): void {
    const projectile = this.projectiles.find((item) => !item.active);
    if (!projectile) return;
    projectile.active = true;
    projectile.friendly = friendly;
    projectile.damage = damage;
    projectile.vx = dx * speed;
    projectile.vz = dz * speed;
    projectile.life = friendly ? 1.35 : 4.5;
    projectile.radius = friendly ? 0.28 : 0.35;
    projectile.mesh.material = friendly ? this.friendlyProjectileMat : this.enemyProjectileMat;
    projectile.mesh.scale.setScalar(friendly ? 1 : 1.55);
    projectile.mesh.position.set(x, y, z);
    projectile.mesh.visible = true;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.y += dt * 8;
      if (p.life <= 0 || Math.hypot(p.mesh.position.x, p.mesh.position.z) > 22) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      if (p.friendly) {
        for (const enemy of this.enemies) {
          if (!enemy.active) continue;
          const dx = p.mesh.position.x - enemy.group.position.x;
          const dz = p.mesh.position.z - enemy.group.position.z;
          const radius = p.radius + enemy.radius;
          if (dx * dx + dz * dz < radius * radius) {
            this.damageEnemy(enemy, p.damage);
            p.active = false;
            p.mesh.visible = false;
            this.particles.burst(p.mesh.position.x, 0.9, p.mesh.position.z, 0xffb3d1, 5, 2.2);
            break;
          }
        }
      } else {
        const playerDistance = this.distanceToPlayer(p.mesh.position.x, p.mesh.position.z);
        if (playerDistance < p.radius + 0.55) {
          this.damagePlayer(p.damage);
          p.active = false;
          p.mesh.visible = false;
        } else if (Math.hypot(p.mesh.position.x, p.mesh.position.z) < 2.1) {
          this.damageFlame(Math.ceil(p.damage * 0.6));
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    if (!enemy.active) return;
    enemy.hp -= damage;
    enemy.hitFlash = 0.16;
    this.energy = Math.min(100, this.energy + 1.8);
    this.score += 4;
    this.audio.sfx("hit");
    if (enemy.hp <= 0) this.deactivateEnemy(enemy, true);
  }

  private deactivateEnemy(enemy: Enemy, drop: boolean): void {
    if (!enemy.active) return;
    enemy.active = false;
    enemy.group.visible = false;
    const x = enemy.group.position.x;
    const z = enemy.group.position.z;
    this.particles.burst(x, enemy.kind === "boss" ? 2 : 0.8, z, enemy.kind === "boss" ? 0xffc2dc : 0xb08aff, enemy.kind === "boss" ? 70 : 18, enemy.kind === "boss" ? 7 : 3.5);
    this.spawnRing(x, z, enemy.kind === "boss" ? 0xffd3e4 : 0xa784ee, 0.65, enemy.kind === "boss" ? 8 : 3);
    if (drop) {
      this.spawnMote(x, z, enemy.kind === "boss" ? 100 : 10);
      this.score += enemy.kind === "boss" ? 4000 : 100 * this.combo;
      this.energy = Math.min(100, this.energy + (enemy.kind === "boss" ? 0 : 4));
    }
    if (enemy.kind === "boss") this.world.shake(1.2);
  }

  private spawnMote(x: number, z: number, value: number): void {
    const mote = this.motes.find((item) => !item.active);
    if (!mote) {
      this.memories = Math.min(GAME_CONFIG.TARGET_MEMORIES, this.memories + value);
      return;
    }
    mote.active = true;
    mote.value = value;
    mote.group.visible = true;
    mote.group.position.set(x, 0.7, z);
    mote.group.scale.setScalar(value === 100 ? 2.2 : 1);
  }

  private updateMotes(dt: number): void {
    const px = this.world.player.position.x;
    const pz = this.world.player.position.z;
    const magnetRadius = 3.7 + this.combo * 0.45;
    for (const mote of this.motes) {
      if (!mote.active) continue;
      mote.phase += dt * 2;
      mote.group.rotation.y += dt * 1.8;
      mote.group.position.y = 0.72 + Math.sin(mote.phase) * 0.18;
      const dx = px - mote.group.position.x;
      const dz = pz - mote.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < magnetRadius && distance > 0.01) {
        const speed = 4 + (magnetRadius - distance) * 3.2;
        mote.group.position.x += (dx / distance) * speed * dt;
        mote.group.position.z += (dz / distance) * speed * dt;
      }
      if (distance < 0.82) this.collectMote(mote);
    }
  }

  private collectMote(mote: MemoryMote): void {
    if (!mote.active) return;
    mote.active = false;
    mote.group.visible = false;
    this.memories = Math.min(GAME_CONFIG.TARGET_MEMORIES, this.memories + mote.value);
    this.energy = Math.min(100, this.energy + 10 + mote.value * 0.06);
    this.chain += 1;
    this.comboTimer = 2.4;
    const oldCombo = this.combo;
    this.combo = Math.min(5, 1 + Math.floor(this.chain / 4));
    this.score += mote.value * 12 * this.combo;
    this.audio.sfx("pickup");
    this.particles.burst(this.world.player.position.x, 1, this.world.player.position.z, 0xffd5a0, 8, 2.5);
    if (this.combo > oldCombo) this.showToast(`Kombo cahaya ×${this.combo} · daya tarik kenangan menguat`);
    if (this.energy >= 99.9 && this.energy - (10 + mote.value * 0.06) < 99.9) this.showToast("Rindu penuh · tekan E / RINDU untuk pulse");
  }

  private spawnHazard(x: number, z: number, radius: number, duration: number): void {
    const hazard = this.hazards.find((item) => !item.active);
    if (!hazard) return;
    hazard.active = true;
    hazard.timer = 0;
    hazard.duration = duration;
    hazard.radius = radius;
    hazard.x = x;
    hazard.z = z;
    hazard.mesh.position.set(x, 0.055, z);
    hazard.mesh.scale.setScalar(radius);
    hazard.mesh.visible = true;
  }

  private updateHazards(dt: number): void {
    for (const hazard of this.hazards) {
      if (!hazard.active) continue;
      hazard.timer += dt;
      const progress = Math.min(1, hazard.timer / hazard.duration);
      const material = hazard.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.22 + progress * 0.62;
      hazard.mesh.scale.setScalar(hazard.radius * (0.86 + Math.sin(progress * Math.PI * 8) * 0.025));
      if (hazard.timer >= hazard.duration) {
        if (this.status === "playing" && Math.hypot(this.world.player.position.x - hazard.x, this.world.player.position.z - hazard.z) < hazard.radius) this.damagePlayer(24);
        this.particles.burst(hazard.x, 0.25, hazard.z, 0xff659e, 28, 5);
        this.spawnRing(hazard.x, hazard.z, 0xff7dab, 0.45, hazard.radius * 1.3);
        this.world.shake(0.55);
        hazard.active = false;
        hazard.mesh.visible = false;
      }
    }
  }

  private spawnRing(x: number, z: number, color: number, duration: number, growth: number): void {
    const ring = this.rings.find((item) => !item.active);
    if (!ring) return;
    ring.active = true;
    ring.life = duration;
    ring.maxLife = duration;
    ring.growth = growth;
    ring.mesh.position.set(x, 0.08, z);
    ring.mesh.scale.setScalar(0.25);
    ring.mesh.visible = true;
    (ring.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  private updateRings(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      ring.mesh.scale.setScalar(0.25 + progress * ring.growth);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.72;
    }
  }

  private damagePlayer(damage: number): void {
    if (this.invulnerable > 0 || this.dashTimer > 0 || this.status !== "playing") return;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnerable = 0.78;
    this.world.shake(0.7);
    this.audio.sfx("hurt");
    this.particles.burst(this.world.player.position.x, 1, this.world.player.position.z, 0xff6f99, 15, 4);
    if (this.hp <= 0) this.gameOver("Cahayamu sempat meredup. Tapi cerita ini masih bisa kita coba lagi.");
  }

  private damageFlame(damage: number): void {
    if (this.status !== "playing") return;
    this.flame = Math.max(0, this.flame - damage);
    this.world.shake(0.4);
    this.audio.sfx("hurt");
    this.particles.burst(0, 2, 0, 0xff759f, 12, 3.5);
    if (this.flame <= 0) this.gameOver("Apinya perlu dijaga lebih dekat. Kali ini, kita coba dengan cara yang berbeda.");
  }

  private finishWave(): void {
    this.clearTimer = -999;
    for (const mote of this.motes) if (mote.active) this.collectMote(mote);
    this.memories = Math.max(this.memories, this.wave * 100);
    for (const p of this.projectiles) {
      if (!p.friendly) { p.active = false; p.mesh.visible = false; }
    }
    if (this.wave < 4) {
      this.storyIndex = this.wave - 1;
      this.setStatus("story");
      this.audio.sfx("wave");
    } else this.victory();
  }

  private victory(): void {
    this.memories = GAME_CONFIG.TARGET_MEMORIES;
    this.score += Math.round(this.hp * 20 + this.flame * 25 + Math.max(0, 1000 - this.gameTime * 4));
    this.bestScore = Math.max(this.bestScore, this.score);
    storage.set("bestScore", this.bestScore);
    this.celebrating = true;
    this.victoryReason = `400 kenangan kembali bercahaya · ${this.formatTime(this.gameTime)} · ${this.score.toLocaleString("id-ID")} poin`;
    this.setStatus("victory");
    this.audio.sfx("win");
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.particles.burst(Math.cos(a) * 5, 3, Math.sin(a) * 5, i % 2 ? 0xffc1d8 : 0xffdf9e, 45, 7);
    }
    this.spawnRing(0, 0, 0xffd6a3, 1.4, 15);
  }

  private gameOver(reason: string): void {
    this.victoryReason = reason;
    this.bestScore = Math.max(this.bestScore, this.score);
    storage.set("bestScore", this.bestScore);
    this.setStatus("gameover");
    this.audio.sfx("lose");
  }

  private nearestEnemy(x: number, z: number, maxDistance: number): Enemy | null {
    let nearest: Enemy | null = null;
    let best = maxDistance * maxDistance;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const dx = enemy.group.position.x - x;
      const dz = enemy.group.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; nearest = enemy; }
    }
    return nearest;
  }

  private activeEnemyCount(): number {
    let count = 0;
    for (const enemy of this.enemies) if (enemy.active) count++;
    return count;
  }

  private bossHealth(): number {
    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    return boss?.active ? Math.max(0, (boss.hp / boss.maxHp) * 100) : 0;
  }

  private distanceToPlayer(x: number, z: number): number {
    return Math.hypot(x - this.world.player.position.x, z - this.world.player.position.z);
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let delta = (b - a) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return a + delta * t;
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastTimer = 3;
    this.emitUi();
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  }

  private emitUi(): void {
    this.emit({
      status: this.status,
      hp: this.hp,
      flame: this.flame,
      memories: this.memories,
      energy: this.energy,
      wave: this.wave,
      score: this.score,
      bestScore: this.bestScore,
      combo: this.combo,
      dashCooldown: this.dashCooldown,
      enemies: this.activeEnemyCount() + this.spawnQueue.length,
      bossHp: this.bossHealth(),
      storyIndex: this.storyIndex,
      muted: this.audio.muted,
      quality: this.world.quality,
      objective: this.objective,
      toast: this.toast,
      victoryReason: this.victoryReason,
    });
  }

  private render(): void {
    const now = performance.now();
    if (this.lastRender > 0) {
      const delta = Math.max(1, now - this.lastRender);
      this.fps = this.fps * 0.96 + (1000 / delta) * 0.04;
      if (this.status === "playing" && this.world.quality === "high") {
        this.lowFpsTimer = this.fps < 38 ? this.lowFpsTimer + delta / 1000 : Math.max(0, this.lowFpsTimer - 0.5);
        if (this.lowFpsTimer > 3.5) {
          this.world.setQuality("low");
          this.lowFpsTimer = 0;
          this.showToast("Mode ringan aktif agar permainan tetap halus");
        }
      }
    }
    this.lastRender = now;
    this.world.render();
    window.__GAME_READY__ = true;
  }

  getSnapshot(): UiSnapshot {
    return {
      status: this.status, hp: this.hp, flame: this.flame, memories: this.memories, energy: this.energy,
      wave: this.wave, score: this.score, bestScore: this.bestScore, combo: this.combo,
      dashCooldown: this.dashCooldown, enemies: this.activeEnemyCount() + this.spawnQueue.length,
      bossHp: this.bossHealth(), storyIndex: this.storyIndex, muted: this.audio.muted, quality: this.world.quality,
      objective: this.objective, toast: this.toast, victoryReason: this.victoryReason,
    };
  }

  getStats(): { fps: number; enemies: number; projectiles: number; calls: number; triangles: number } {
    let projectiles = 0;
    for (const p of this.projectiles) if (p.active) projectiles++;
    return { fps: Math.round(this.fps), enemies: this.activeEnemyCount(), projectiles, ...this.world.stats() };
  }

  debugClearWave(): void {
    for (const enemy of this.enemies) if (enemy.active) this.deactivateEnemy(enemy, true);
    this.spawnQueue = [];
  }

  debugBoss(): void {
    this.resetRun();
    this.setStatus("playing");
    this.memories = 300;
    this.energy = 100;
    this.startWave(4);
    this.spawnTimer = 0;
  }

  debugDefeat(): void {
    if (this.status !== "playing") this.startRun();
    this.invulnerable = 0;
    this.damagePlayer(1000);
  }

  dispose(): void {
    this.loop.stop();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const canvas = this.world.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("contextmenu", this.preventContext);
    this.input.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.projectileGeometry.dispose();
    this.friendlyProjectileMat.dispose();
    this.enemyProjectileMat.dispose();
    this.ringGeometry.dispose();
  }

  private readonly onResize = () => this.world.resize();
  private readonly onBlur = () => { if (this.status === "playing") this.pause(); };
  private readonly onVisibility = () => { if (document.hidden && this.status === "playing") this.pause(); };
  private readonly preventContext = (event: Event) => event.preventDefault();
  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const rect = this.world.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.pointerAimActive = true;
  };
  private readonly onPointerDown = (event: PointerEvent) => {
    if (this.status !== "playing") return;
    if (event.pointerType === "mouse") {
      this.onPointerMove(event);
      this.pointerAttack = true;
    }
  };
  private readonly onPointerUp = () => { this.pointerAttack = false; };
}
