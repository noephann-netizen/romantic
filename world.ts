import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { COLORS, QUALITY } from "./config";
import type { EnemyKind, GameStatus, QualityTier } from "./types";

export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,245,230,1)");
  g.addColorStop(0.16, "rgba(255,190,220,.8)");
  g.addColorStop(0.48, "rgba(190,120,255,.2)");
  g.addColorStop(1, "rgba(80,30,130,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function marbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext("2d")!;
  const rng = seededRandom(400);
  const g = ctx.createLinearGradient(0, 0, 768, 768);
  g.addColorStop(0, "#24152f");
  g.addColorStop(0.45, "#130e24");
  g.addColorStop(1, "#301a35");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 768, 768);
  for (let i = 0; i < 42; i++) {
    const y = rng() * 768;
    ctx.beginPath();
    ctx.moveTo(-40, y);
    for (let x = -40; x <= 820; x += 34) {
      ctx.lineTo(x, y + Math.sin(x * 0.012 + i) * (18 + rng() * 35) + (rng() - 0.5) * 22);
    }
    ctx.strokeStyle = i % 4 === 0 ? "rgba(255,197,167,.10)" : "rgba(204,166,255,.045)";
    ctx.lineWidth = i % 4 === 0 ? 1.4 : 0.7;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.6, 1.6);
  texture.anisotropy = 4;
  return texture;
}

export function heartGeometry(depth = 0.28): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.9);
  shape.bezierCurveTo(-0.2, -0.58, -1.18, 0.05, -1.18, 0.7);
  shape.bezierCurveTo(-1.18, 1.5, -0.15, 1.62, 0, 0.82);
  shape.bezierCurveTo(0.15, 1.62, 1.18, 1.5, 1.18, 0.7);
  shape.bezierCurveTo(1.18, 0.05, 0.2, -0.58, 0, -0.9);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.1,
    bevelThickness: 0.08,
    curveSegments: 32,
  });
  geometry.center();
  return geometry;
}

const goldMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, metalness: 0.82, roughness: 0.24 });
const ivoryMat = new THREE.MeshStandardMaterial({ color: COLORS.ivory, metalness: 0.15, roughness: 0.3 });
const roseGlowMat = new THREE.MeshStandardMaterial({
  color: COLORS.rose,
  emissive: COLORS.rose,
  emissiveIntensity: 2.2,
  metalness: 0.25,
  roughness: 0.2,
});
const violetGlowMat = new THREE.MeshStandardMaterial({
  color: COLORS.violet,
  emissive: COLORS.violet,
  emissiveIntensity: 1.8,
  metalness: 0.35,
  roughness: 0.18,
});
const shadowMat = new THREE.MeshStandardMaterial({
  color: 0x4b2a60,
  emissive: 0x512263,
  emissiveIntensity: 0.85,
  metalness: 0.65,
  roughness: 0.26,
});

export function createPlayer(): THREE.Group {
  const group = new THREE.Group();
  const cloak = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 1.25, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6f4b94, metalness: 0.45, roughness: 0.3, side: THREE.DoubleSide }),
  );
  cloak.position.y = 0.62;
  cloak.castShadow = true;
  group.add(cloak);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.43, 32, 24), ivoryMat);
  body.position.y = 1.18;
  body.castShadow = true;
  group.add(body);
  const core = new THREE.Mesh(heartGeometry(0.16), roseGlowMat);
  core.scale.setScalar(0.22);
  core.position.set(0, 1.15, 0.4);
  group.add(core);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 10, 48), goldMat);
  halo.position.y = 1.72;
  halo.rotation.x = Math.PI / 2.6;
  group.add(halo);
  for (const side of [-1, 1]) {
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.045, 8, 36, Math.PI * 1.25), roseGlowMat);
    ribbon.position.set(side * 0.38, 0.88, -0.06);
    ribbon.rotation.set(Math.PI / 2, side * 0.38, side * 0.8);
    ribbon.scale.set(0.7, 1, 1);
    group.add(ribbon);
  }
  const light = new THREE.PointLight(COLORS.rose, 4, 6, 2);
  light.position.y = 1.1;
  group.add(light);
  group.position.set(0, 0.15, 8);
  return group;
}

export function createEnemyGroup(kind: EnemyKind): THREE.Group {
  const group = new THREE.Group();
  if (kind === "drifter") {
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), shadowMat);
    body.position.y = 0.72;
    body.castShadow = true;
    group.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.055, 8, 32), violetGlowMat);
    ring.position.y = 0.72;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  } else if (kind === "shooter") {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.76, 1), shadowMat);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    for (const y of [0.58, 1.22]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.045, 8, 32), roseGlowMat);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  } else if (kind === "charger") {
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.92, 1), shadowMat);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 8), violetGlowMat);
      spike.position.set(Math.cos(a) * 0.8, 0.95, Math.sin(a) * 0.8);
      spike.rotation.z = Math.PI / 2;
      spike.rotation.y = -a;
      group.add(spike);
    }
  } else {
    const heart = new THREE.Mesh(heartGeometry(0.55), shadowMat);
    heart.scale.setScalar(1.45);
    heart.position.y = 2.25;
    heart.castShadow = true;
    group.add(heart);
    const core = new THREE.Mesh(heartGeometry(0.22), roseGlowMat);
    core.scale.setScalar(0.52);
    core.position.set(0, 2.25, 0.76);
    group.add(core);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2 + i * 0.28, 0.065, 10, 64), i === 1 ? goldMat : violetGlowMat);
      ring.position.y = 2.2;
      ring.rotation.set(Math.PI / 2.6 + i * 0.45, i * 0.7, 0);
      ring.name = `boss-ring-${i}`;
      group.add(ring);
    }
    const light = new THREE.PointLight(COLORS.violet, 12, 12, 2);
    light.position.y = 2.4;
    group.add(light);
  }
  group.visible = false;
  return group;
}

export function createMote(): THREE.Group {
  const group = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), roseGlowMat);
  gem.scale.y = 1.35;
  group.add(gem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.022, 6, 24), goldMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.visible = false;
  return group;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  readonly player = createPlayer();
  readonly flame = new THREE.Group();
  readonly bloom: UnrealBloomPass;
  quality: QualityTier = "high";
  private readonly waterMaterial: THREE.ShaderMaterial;
  private readonly petalMaterial: THREE.ShaderMaterial;
  private readonly stars: THREE.Points;
  private readonly flameHeart: THREE.Mesh;
  private readonly flameLight: THREE.PointLight;
  private readonly tempLook = new THREE.Vector3();
  private cameraShake = 0;
  private victoryGlow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.HIGH_DPR));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(COLORS.night);
    this.scene.fog = new THREE.FogExp2(COLORS.night, 0.0125);

    this.scene.add(new THREE.HemisphereLight(0xbfa8ff, 0x1c0b25, 2.2));
    const moonLight = new THREE.DirectionalLight(0xffe2d2, 3.4);
    moonLight.position.set(-12, 24, 10);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.left = moonLight.shadow.camera.bottom = -22;
    moonLight.shadow.camera.right = moonLight.shadow.camera.top = 22;
    moonLight.shadow.bias = -0.0004;
    this.scene.add(moonLight);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(18.4, 15.8, 1.35, 96, 1),
      new THREE.MeshStandardMaterial({ color: 0x291832, metalness: 0.48, roughness: 0.38 }),
    );
    island.position.y = -0.78;
    island.receiveShadow = true;
    this.scene.add(island);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18.1, 128),
      new THREE.MeshStandardMaterial({ map: marbleTexture(), color: 0xffffff, metalness: 0.48, roughness: 0.28 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.085;
    floor.receiveShadow = true;
    this.scene.add(floor);

    for (const radius of [4.1, 11.8, 17.55]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius === 17.55 ? 0.09 : 0.035, 8, 128), goldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.015;
      this.scene.add(ring);
    }

    this.waterMaterial = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x3b1752) } },
      vertexShader: `varying vec2 vUv; uniform float uTime; void main(){ vUv=uv; vec3 p=position; p.z += sin((p.x+p.y)*.13+uTime*.45)*.18; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor; void main(){ float wave=sin(vUv.x*90.+uTime)*sin(vUv.y*70.-uTime*.7); float glow=smoothstep(.82,1.,wave)*.16; gl_FragColor=vec4(uColor+vec3(.35,.12,.42)*glow,.88); }`,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(150, 150, 48, 48), this.waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2;
    this.scene.add(water);

    this.buildGarden();
    this.buildPavilion();

    this.flameHeart = new THREE.Mesh(heartGeometry(0.48), roseGlowMat);
    this.flameHeart.scale.setScalar(0.8);
    this.flameHeart.position.y = 2.25;
    this.flameHeart.rotation.x = -0.18;
    this.flame.add(this.flameHeart);
    for (let i = 0; i < 2; i++) {
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.65 + i * 0.35, 0.035, 8, 64), i ? violetGlowMat : goldMat);
      orbit.position.y = 2.15;
      orbit.rotation.set(Math.PI / 2.4 + i * 0.55, i * 0.7, 0);
      orbit.name = `flame-orbit-${i}`;
      this.flame.add(orbit);
    }
    this.flameLight = new THREE.PointLight(COLORS.rose, 20, 17, 2);
    this.flameLight.position.y = 2.5;
    this.flame.add(this.flameLight);
    this.scene.add(this.flame);
    this.scene.add(this.player);

    this.stars = this.buildStars(QUALITY.STARS_HIGH);
    this.scene.add(this.stars);
    this.petalMaterial = this.buildPetals(QUALITY.PETALS_HIGH);

    const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffe4d6 }));
    moon.position.set(-31, 28, -48);
    this.scene.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xe5b7ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(moon.position);
    halo.scale.set(23, 23, 1);
    this.scene.add(halo);

    this.camera.position.set(0, 18, 24);
    this.camera.lookAt(0, 1, 0);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.72, 0.55, 0.72);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  private buildGarden(): void {
    const rng = seededRandom(40016);
    const dummy = new THREE.Object3D();
    const columnGeo = new THREE.CylinderGeometry(0.2, 0.27, 3.2, 16);
    const columns = new THREE.InstancedMesh(columnGeo, ivoryMat, 12);
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.16, 20), goldMat, 24);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 14.9;
      dummy.position.set(Math.cos(a) * r, 1.6, Math.sin(a) * r);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      columns.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 2; j++) {
        dummy.position.y = j ? 3.18 : 0.08;
        dummy.updateMatrix();
        caps.setMatrixAt(i * 2 + j, dummy.matrix);
      }
    }
    columns.castShadow = false;
    this.scene.add(columns, caps);

    const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.42, 0), violetGlowMat, 36);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + rng() * 0.08;
      const r = 17.2 + (rng() - 0.5) * 0.6;
      dummy.position.set(Math.cos(a) * r, 0.25 + rng() * 0.4, Math.sin(a) * r);
      dummy.rotation.set(rng(), a, rng() * 0.4);
      dummy.scale.setScalar(0.45 + rng() * 0.9);
      dummy.updateMatrix();
      crystals.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(crystals);

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.16, 0.3, 2.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x5f354d, roughness: 0.8 }),
      8,
    );
    const blossoms = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0xeaa2c7, emissive: 0x8b355e, emissiveIntensity: 0.55, roughness: 0.72 }),
      112,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const r = 13.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      dummy.position.set(x, 1.4, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 14; j++) {
        const angle = rng() * Math.PI * 2;
        const spread = Math.sqrt(rng()) * 1.55;
        dummy.position.set(x + Math.cos(angle) * spread, 2.7 + rng() * 1.45, z + Math.sin(angle) * spread);
        dummy.scale.setScalar(0.65 + rng() * 0.8);
        dummy.rotation.set(rng() * 2, rng() * 2, rng() * 2);
        dummy.updateMatrix();
        blossoms.setMatrixAt(i * 14 + j, dummy.matrix);
      }
    }
    trunks.castShadow = false;
    blossoms.castShadow = false;
    this.scene.add(trunks, blossoms);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const r = 34 + (i % 2) * 9;
      const group = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4.5, 9), new THREE.MeshStandardMaterial({ color: 0x281731, roughness: 0.75 }));
      rock.rotation.x = Math.PI;
      group.add(rock);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.35, 24), ivoryMat);
      top.position.y = 2.25;
      group.add(top);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), i % 2 ? roseGlowMat : violetGlowMat);
      gem.position.y = 3.4;
      group.add(gem);
      group.position.set(Math.cos(a) * r, -1 + (i % 3) * 2.4, Math.sin(a) * r);
      group.rotation.y = a;
      this.scene.add(group);
    }
  }

  private buildPavilion(): void {
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.6, 0.42, 64), ivoryMat);
    base1.position.y = 0.12;
    base1.receiveShadow = true;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.15, 0.45, 64), goldMat);
    base2.position.y = 0.52;
    this.scene.add(base1, base2);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arch = new THREE.Group();
      const arc = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.075, 10, 48, Math.PI), goldMat);
      arc.position.y = 2.2;
      arch.add(arc);
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 2.2, 12), goldMat);
        pillar.position.set(side * 1.55, 1.1, 0);
        arch.add(pillar);
      }
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), roseGlowMat);
      gem.position.y = 3.82;
      arch.add(gem);
      arch.position.set(Math.cos(a) * 10.7, 0, Math.sin(a) * 10.7);
      arch.rotation.y = -a + Math.PI / 2;
      this.scene.add(arch);
    }
  }

  private buildStars(count: number): THREE.Points {
    const rng = seededRandom(401);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const y = 7 + rng() * 55;
      const r = 28 + rng() * 70;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      color.set(i % 5 === 0 ? 0xffc2dc : i % 3 === 0 ? 0xc4b2ff : 0xffedcf);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  }

  private buildPetals(count: number): THREE.ShaderMaterial {
    const rng = seededRandom(400400);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = 3 + rng() * 20;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rng() * 14;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rng();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPixelRatio; varying float vSeed; void main(){ vSeed=aSeed; vec3 p=position; p.y=mod(p.y-uTime*(.22+aSeed*.3),14.); p.x+=sin(uTime*.35+aSeed*20.+p.y*.3)*.8; p.z+=cos(uTime*.28+aSeed*14.)*.55; vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(5.+aSeed*5.)*uPixelRatio*(18./-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vSeed; void main(){ vec2 p=gl_PointCoord-.5; p.x*=1.6; float d=length(p); if(d>.48) discard; vec3 c=mix(vec3(1.,.46,.67),vec3(.74,.53,1.),step(.65,vSeed)); float a=smoothstep(.48,.22,d)*.65; gl_FragColor=vec4(c,a); }`,
    });
    this.scene.add(new THREE.Points(geometry, material));
    return material;
  }

  update(dt: number, elapsed: number, status: GameStatus, flameRatio: number, celebrating: boolean): void {
    this.waterMaterial.uniforms.uTime.value = elapsed;
    this.petalMaterial.uniforms.uTime.value = elapsed * (celebrating ? 2.2 : 1);
    this.stars.rotation.y = elapsed * 0.006;
    this.player.position.y = 0.17 + Math.sin(elapsed * 3.2) * 0.1;
    this.player.rotation.z = Math.sin(elapsed * 2.1) * 0.035;
    this.flameHeart.rotation.y = Math.sin(elapsed * 0.8) * 0.22;
    const pulse = 1 + Math.sin(elapsed * 3.6) * 0.055;
    this.flameHeart.scale.setScalar(0.8 * pulse * (0.7 + flameRatio * 0.3));
    this.flameLight.intensity = 12 + flameRatio * 10 + Math.sin(elapsed * 4) * 2;
    for (let i = 0; i < 2; i++) {
      const ring = this.flame.getObjectByName(`flame-orbit-${i}`);
      if (ring) ring.rotation.z += dt * (i ? -0.35 : 0.45);
    }
    this.victoryGlow = THREE.MathUtils.lerp(this.victoryGlow, celebrating ? 1 : 0, dt * 2);
    this.bloom.strength = (this.quality === "high" ? 0.7 : 0.46) + this.victoryGlow * 0.35;

    if (status === "title") {
      const angle = elapsed * 0.045;
      this.camera.position.set(Math.sin(angle) * 25, 15.5 + Math.sin(elapsed * 0.18), Math.cos(angle) * 25);
      this.tempLook.set(0, 1.5, 0);
      this.camera.lookAt(this.tempLook);
    } else {
      const portrait = this.camera.aspect < 0.75;
      const followFactor = portrait ? 1 : 0.32;
      const followX = this.player.position.x * followFactor;
      const followZ = this.player.position.z * (portrait ? 1 : 0.3);
      const shake = this.cameraShake;
      this.cameraShake = Math.max(0, shake - dt * 2.8);
      const targetX = followX + Math.sin(elapsed * 73) * shake * 0.16;
      const targetY = (portrait ? 20.5 : 17.2) + Math.cos(elapsed * 61) * shake * 0.1;
      const targetZ = (portrait ? 23 : 19.5) + followZ;
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetX, 1 - Math.exp(-dt * 4));
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetY, 1 - Math.exp(-dt * 4));
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetZ, 1 - Math.exp(-dt * 4));
      if (portrait) this.tempLook.set(this.player.position.x, 0.65, this.player.position.z);
      else this.tempLook.set(followX * 0.8, 0.65, followZ * 0.85 - 1.5);
      this.camera.lookAt(this.tempLook);
    }
  }

  shake(amount: number): void { this.cameraShake = Math.max(this.cameraShake, amount); }

  setQuality(tier: QualityTier): void {
    this.quality = tier;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, tier === "high" ? QUALITY.HIGH_DPR : QUALITY.LOW_DPR));
    this.renderer.shadowMap.enabled = tier === "high";
    this.stars.geometry.setDrawRange(0, tier === "high" ? QUALITY.STARS_HIGH : QUALITY.STARS_LOW);
    this.resize();
  }

  resize(): void {
    const width = innerWidth;
    const height = innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  render(): void {
    this.renderer.info.reset();
    this.composer.render();
  }

  stats(): { calls: number; triangles: number; geometries: number; textures: number } {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
  }
}
