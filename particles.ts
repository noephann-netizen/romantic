import * as THREE from "three";
import { GAME_CONFIG } from "./config";
import { seededRandom } from "./world";

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly positions = new Float32Array(GAME_CONFIG.MAX_PARTICLES * 3);
  private readonly colors = new Float32Array(GAME_CONFIG.MAX_PARTICLES * 3);
  private readonly life = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private readonly sizes = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private readonly vx = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private readonly vy = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private readonly vz = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private readonly maxLife = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private cursor = 0;
  private readonly rng = seededRandom(400400);
  private readonly color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < GAME_CONFIG.MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute("aLife", new THREE.BufferAttribute(this.life, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aLife; attribute float aSize; varying vec3 vColor; varying float vLife; void main(){ vColor=color; vLife=aLife; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*aLife*(22./-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vColor; varying float vLife; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; float a=smoothstep(.5,.05,d)*clamp(vLife,0.,1.); gl_FragColor=vec4(vColor,a); }`,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(x: number, y: number, z: number, color: number | string, count: number, speed = 3): void {
    this.color.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % GAME_CONFIG.MAX_PARTICLES;
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.3 + this.rng() * 0.7);
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      this.vx[i] = Math.cos(a) * s;
      this.vz[i] = Math.sin(a) * s;
      this.vy[i] = (this.rng() * 0.9 + 0.25) * speed;
      this.maxLife[i] = 0.45 + this.rng() * 0.65;
      this.life[i] = 1;
      this.sizes[i] = 7 + this.rng() * 13;
      this.colors[i * 3] = this.color.r;
      this.colors[i * 3 + 1] = this.color.g;
      this.colors[i * 3 + 2] = this.color.b;
    }
    this.markDirty();
  }

  trail(x: number, y: number, z: number, color: number | string): void {
    this.burst(x, y, z, color, 2, 0.7);
  }

  update(dt: number): void {
    for (let i = 0; i < GAME_CONFIG.MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt / this.maxLife[i];
      if (this.life[i] <= 0) {
        this.life[i] = 0;
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      this.vy[i] -= dt * 3.5;
      this.positions[i * 3] += this.vx[i] * dt;
      this.positions[i * 3 + 1] += this.vy[i] * dt;
      this.positions[i * 3 + 2] += this.vz[i] * dt;
    }
    this.markDirty();
  }

  private markDirty(): void {
    const attributes = this.points.geometry.attributes;
    attributes.position.needsUpdate = true;
    attributes.color.needsUpdate = true;
    attributes.aLife.needsUpdate = true;
    attributes.aSize.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < GAME_CONFIG.MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;
    this.markDirty();
  }
}
