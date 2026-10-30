export type SfxId = "shot" | "hit" | "pickup" | "dash" | "pulse" | "hurt" | "wave" | "win" | "lose" | "ui";

const MUTE_KEY = "four-hundred.muted";

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly song: HTMLAudioElement;
  private disposed = false;
  muted = readMuted();

  private readonly unlock = () => {
    this.ensureCtx();
    if (!this.muted) void this.startMusic();
    this.detachUnlock();
  };

  constructor() {
    this.song = new Audio(`${import.meta.env.BASE_URL}music/our-song.mp3`);
    this.song.loop = true;
    this.song.preload = "auto";
    this.song.volume = 0.38;
    this.song.muted = this.muted;
    window.addEventListener("pointerdown", this.unlock, { once: true });
    window.addEventListener("keydown", this.unlock, { once: true });
    // Try immediately for browsers that allow autoplay; the entry button is the compliant fallback.
    if (!this.muted) void this.startMusic();
  }

  private detachUnlock(): void {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  async startMusic(): Promise<void> {
    if (this.disposed || this.muted) return;
    try { await this.song.play(); } catch { /* autoplay waits for the first gesture */ }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0"); } catch { /* local only */ }
    this.song.muted = this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    if (!this.muted) void this.startMusic();
    return this.muted;
  }

  sfx(id: SfxId): void {
    if (this.disposed || this.muted) return;
    const ctx = this.ensureCtx();
    if (!this.master) return;
    const t = ctx.currentTime;
    const spec: Record<SfxId, [OscillatorType, number, number, number, number]> = {
      shot: ["sine", 720, 390, 0.075, 0.075],
      hit: ["triangle", 210, 100, 0.09, 0.13],
      pickup: ["sine", 690, 1180, 0.14, 0.12],
      dash: ["sine", 280, 760, 0.16, 0.11],
      pulse: ["sine", 240, 1280, 0.55, 0.18],
      hurt: ["sawtooth", 150, 58, 0.18, 0.14],
      wave: ["sine", 440, 880, 0.45, 0.16],
      win: ["sine", 523, 1568, 0.9, 0.17],
      lose: ["triangle", 240, 72, 0.65, 0.14],
      ui: ["sine", 480, 620, 0.07, 0.08],
    };
    const [type, f0, f1, dur, volume] = spec[id];
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env.gain.setValueAtTime(volume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    if (id === "win" || id === "wave") {
      const harmony = ctx.createOscillator();
      const harmonyGain = ctx.createGain();
      harmony.type = "sine";
      harmony.frequency.setValueAtTime(f0 * 1.5, t + 0.08);
      harmony.frequency.exponentialRampToValueAtTime(f1 * 1.25, t + dur);
      harmonyGain.gain.setValueAtTime(0.001, t);
      harmonyGain.gain.linearRampToValueAtTime(volume * 0.55, t + 0.1);
      harmonyGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      harmony.connect(harmonyGain).connect(this.master);
      harmony.start(t);
      harmony.stop(t + dur + 0.02);
    }
  }

  musicState(): { paused: boolean; currentTime: number; duration: number } {
    return { paused: this.song.paused, currentTime: this.song.currentTime, duration: this.song.duration };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachUnlock();
    this.song.pause();
    this.song.src = "";
    this.master?.disconnect();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }
}
