import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronRight, Gamepad2, Gem, Heart, Home as HomeIcon, Pause, Play, RotateCcw, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import { startGame, stopGame } from "@/game/boot";
import { STORIES } from "@/game/game";
import type { GameApi, UiSnapshot } from "@/game/types";

const INITIAL_UI: UiSnapshot = {
  status: "title", hp: 100, flame: 100, memories: 0, energy: 0, wave: 1, score: 0,
  bestScore: 0, combo: 1, dashCooldown: 0, enemies: 0, bossHp: 0, storyIndex: 0,
  muted: false, quality: "high", objective: "", toast: "", victoryReason: "",
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(INITIAL_UI);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    apiRef.current = startGame(canvas, setUi);
    return () => { stopGame(); apiRef.current = null; };
  }, []);

  const command = (name: "start" | "pause" | "resume" | "restart" | "title" | "continue" | "mute" | "quality") => {
    apiRef.current?.command(name);
  };

  return (
    <main id="game-root" className={`status-${ui.status}`}>
      <canvas id="game-canvas" ref={canvasRef} aria-label="Dunia permainan 3D Our Little Universe" />
      <div className="vignette" />
      <div className="grain" />

      <button className="icon-button global-audio" onClick={() => command("mute")} aria-label={ui.muted ? "Nyalakan musik" : "Matikan musik"}>
        {ui.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <span>{ui.muted ? "Musik mati" : "Lagu kita"}</span>
      </button>

      {ui.status === "title" && <TitleScreen ui={ui} onStart={() => command("start")} />}
      {(ui.status === "playing" || ui.status === "paused" || ui.status === "story") && (
        <GameHud ui={ui} onPause={() => command("pause")} onQuality={() => command("quality")} />
      )}
      {ui.status === "playing" && <MobileControls api={apiRef} />}
      {ui.status === "playing" && ui.toast && <div className="toast"><Sparkles size={15} />{ui.toast}</div>}
      {ui.status === "story" && <StoryScreen index={ui.storyIndex} onContinue={() => command("continue")} />}
      {ui.status === "paused" && <PauseScreen onResume={() => command("resume")} onRestart={() => command("restart")} onTitle={() => command("title")} onQuality={() => command("quality")} quality={ui.quality} />}
      {ui.status === "victory" && <VictoryScreen ui={ui} onRestart={() => command("restart")} onTitle={() => command("title")} />}
      {ui.status === "gameover" && <GameOverScreen ui={ui} onRestart={() => command("restart")} onTitle={() => command("title")} />}
    </main>
  );
}

function TitleScreen({ ui, onStart }: { ui: UiSnapshot; onStart: () => void }) {
  return (
    <section className="screen title-screen">
      <div className="title-content">
        <div className="eyebrow"><span />SEBUAH HADIAH DARI SOFIYAN<span /></div>
        <div className="title-number" aria-label="400">400<span className="title-spark">✦</span></div>
        <h1>Our Little Universe</h1>
        <p className="title-for">Untuk Via, yang membuat hari-hari biasa punya cerita.</p>
        <p className="title-copy">Empat taman kenangan. Satu api yang kita jaga.<br />Dan beberapa hal yang ingin kukatakan lewat perjalanan ini.</p>
        <button className="primary-button enter-button" onClick={onStart}>
          <span>Masuk ke dunia kita</span><ChevronRight size={19} />
        </button>
        <div className="title-meta">
          <span><Gamepad2 size={14} />4 babak</span>
          <i />
          <span><Gem size={14} />400 kenangan</span>
          <i />
          <span><Heart size={14} />satu cerita milik kita</span>
        </div>
        <p className="music-note">Klik untuk masuk · lagu akan mulai bersama perjalananmu</p>
      </div>
      <div className="title-footer"><span>WASD / joystick untuk bergerak</span><b>400 DAYS · S & V</b><span>Space untuk memulai</span></div>
      {ui.bestScore > 0 && <div className="best-title">Rekor cahaya · {ui.bestScore.toLocaleString("id-ID")}</div>}
    </section>
  );
}

function GameHud({ ui, onPause, onQuality }: { ui: UiSnapshot; onPause: () => void; onQuality: () => void }) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="brand-panel glass-panel">
          <div className="brand-number">400</div>
          <div><b>OUR LITTLE UNIVERSE</b><span>Sofiyan <Heart size={9} fill="currentColor" /> Via</span></div>
        </div>
        <div className="objective-panel glass-panel">
          <span>BABAK {ui.wave} / 4</span>
          <b>{ui.objective}</b>
        </div>
        <div className="hud-actions">
          <button className="icon-button quality-button" onClick={onQuality} aria-label="Ganti kualitas visual"><Sparkles size={17} /><span>{ui.quality === "high" ? "HD" : "ECO"}</span></button>
          <button className="icon-button" onClick={onPause} aria-label="Jeda permainan"><Pause size={18} /></button>
        </div>
      </div>
      <div className="hud-left">
        <Meter label="CAHAYAMU" value={ui.hp} icon={<Heart size={13} />} tone="rose" />
        <Meter label="API KITA" value={ui.flame} icon={<Sparkles size={13} />} tone="gold" />
      </div>
      <div className="memory-panel glass-panel">
        <div className="memory-label"><Gem size={15} /><span>SERPIHAN KENANGAN</span><b>{Math.floor(ui.memories)}<small>/400</small></b></div>
        <div className="memory-track"><span style={{ width: `${Math.min(100, ui.memories / 4)}%` }} /></div>
        <div className="memory-sub"><span>{ui.enemies} Ragu tersisa</span><span>{ui.score.toLocaleString("id-ID")} poin</span></div>
      </div>
      {ui.combo > 1 && <div className="combo-badge"><small>KOMBO CAHAYA</small><b>×{ui.combo}</b></div>}
      {ui.wave === 4 && ui.bossHp > 0 && (
        <div className="boss-panel"><div><span>RAGU TERAKHIR</span><b>{Math.ceil(ui.bossHp)}%</b></div><div className="boss-track"><span style={{ width: `${ui.bossHp}%` }} /></div></div>
      )}
      <div className="ability-bar">
        <Ability name="CAHAYA" keyName="KLIK / J" ready />
        <Ability name="DASH" keyName="SPACE" ready={ui.dashCooldown <= 0} cooldown={ui.dashCooldown} />
        <Ability name="RINDU" keyName="E" ready={ui.energy >= 99.9} energy={ui.energy} />
      </div>
    </div>
  );
}

function Meter({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "rose" | "gold" }) {
  return (
    <div className={`meter glass-panel ${tone}`}>
      <div>{icon}<span>{label}</span><b>{Math.ceil(value)}</b></div>
      <div className="meter-track"><span style={{ width: `${Math.max(0, value)}%` }} /></div>
    </div>
  );
}

function Ability({ name, keyName, ready, cooldown = 0, energy = 0 }: { name: string; keyName: string; ready: boolean; cooldown?: number; energy?: number }) {
  return (
    <div className={`ability glass-panel ${ready ? "ready" : ""}`}>
      <span className="ability-icon">{name === "DASH" ? <Zap size={17} /> : name === "RINDU" ? <Heart size={17} /> : <Sparkles size={17} />}</span>
      <div><b>{name}</b><small>{cooldown > 0 ? `${cooldown.toFixed(1)}s` : name === "RINDU" && !ready ? `${Math.floor(energy)}%` : keyName}</small></div>
      {name === "RINDU" && <i style={{ width: `${energy}%` }} />}
    </div>
  );
}

function StoryScreen({ index, onContinue }: { index: number; onContinue: () => void }) {
  const story = STORIES[index] ?? STORIES[0];
  return (
    <section className="screen modal-screen">
      <div className="story-card modal-card">
        <div className="story-gem"><Gem size={24} /></div>
        <div className="eyebrow">{story.eyebrow}</div>
        <h2>{story.title}</h2>
        <p>{story.text}</p>
        <div className="story-signature">— Sofiyan, untuk Via</div>
        <button className="primary-button" onClick={onContinue}>Lanjutkan perjalanan<ChevronRight size={18} /></button>
        <small className="key-hint">atau tekan Space</small>
      </div>
    </section>
  );
}

function PauseScreen({ onResume, onRestart, onTitle, onQuality, quality }: { onResume: () => void; onRestart: () => void; onTitle: () => void; onQuality: () => void; quality: string }) {
  return (
    <section className="screen modal-screen">
      <div className="modal-card pause-card">
        <div className="eyebrow">SEBENTAR, DUNIA INI MENUNGGU</div>
        <h2>Jeda dulu, Via.</h2>
        <p>Nggak perlu buru-buru. Lanjutkan kapan pun kamu siap.</p>
        <button className="primary-button" onClick={onResume}><Play size={17} />Lanjut bermain</button>
        <div className="button-row">
          <button className="secondary-button" onClick={onRestart}><RotateCcw size={16} />Ulang</button>
          <button className="secondary-button" onClick={onQuality}><Sparkles size={16} />{quality === "high" ? "Mode ringan" : "Mode HD"}</button>
          <button className="secondary-button" onClick={onTitle}><HomeIcon size={16} />Awal</button>
        </div>
      </div>
    </section>
  );
}

function VictoryScreen({ ui, onRestart, onTitle }: { ui: UiSnapshot; onRestart: () => void; onTitle: () => void }) {
  return (
    <section className="screen victory-screen">
      <div className="victory-wrap">
        <div className="victory-heading">
          <div className="eyebrow"><span />400 KENANGAN · SATU API YANG TETAP MENYALA<span /></div>
          <h2>Kita berhasil, Via.</h2>
          <p>{ui.victoryReason}</p>
        </div>
        <article className="letter-card">
          <div className="letter-ornament">S <Heart size={13} fill="currentColor" /> V</div>
          <h3>Untuk Via,</h3>
          <p>Terima kasih sudah bertahan sampai sejauh ini. Di api ke-400 ini, aku nggak cuma mau merayakan angkanya. Aku mau merayakan kita—semua cerita, tawa, obrolan random, bahkan bagian yang mengajarkan aku buat jadi lebih baik.</p>
          <p>Maaf kalau akhir-akhir ini aku masih kurang inisiatif dan kadang bikin kamu merasa sendirian. Aku mau belajar hadir lebih nyata, bukan cuma lewat kata-kata. Kamu nggak harus langsung percaya semuanya akan berubah; biar aku buktikan pelan-pelan lewat hal-hal kecil yang konsisten.</p>
          <p>Jadi… kalau kamu mau, boleh nggak kita mulai main bareng lagi? Nggak harus langsung sering. Satu permainan, satu obrolan, satu waktu kecil yang kita pilih buat berdua. Aku bakal senang banget kalau kamu mau mencoba lagi sama aku.</p>
          <p>Selamat 400, Via. Semoga setelah ini masih ada banyak hari yang kita lewati bukan sekadar buat menjaga api, tapi karena kita memang masih ingin menjaga satu sama lain.</p>
          <div className="letter-sign">Dengan sayang,<br /><b>Sofiyan</b></div>
        </article>
        <div className="victory-actions">
          <button className="primary-button" onClick={onRestart}><RotateCcw size={17} />Main sekali lagi</button>
          <button className="secondary-button" onClick={onTitle}><HomeIcon size={16} />Kembali ke awal</button>
        </div>
      </div>
    </section>
  );
}

function GameOverScreen({ ui, onRestart, onTitle }: { ui: UiSnapshot; onRestart: () => void; onTitle: () => void }) {
  return (
    <section className="screen modal-screen">
      <div className="modal-card gameover-card">
        <div className="story-gem"><Heart size={24} /></div>
        <div className="eyebrow">BELUM SELESAI · CERITA INI MASIH ADA</div>
        <h2>Kita coba lagi, ya?</h2>
        <p>{ui.victoryReason}</p>
        <div className="result-stats"><span><b>{ui.memories}</b> kenangan</span><span><b>{ui.score.toLocaleString("id-ID")}</b> poin</span><span><b>{ui.wave}</b> babak</span></div>
        <button className="primary-button" onClick={onRestart}><RotateCcw size={17} />Coba lagi</button>
        <button className="text-button" onClick={onTitle}>Kembali ke awal</button>
      </div>
    </section>
  );
}

function MobileControls({ api }: { api: React.MutableRefObject<GameApi | null> }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId || !stickRef.current) return;
    const rect = stickRef.current.getBoundingClientRect();
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const max = rect.width * 0.31;
    const distance = Math.hypot(x, y);
    if (distance > max) { x = (x / distance) * max; y = (y / distance) * max; }
    if (knobRef.current) knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
    api.current?.setMove(x / max, y / max);
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (knobRef.current) knobRef.current.style.transform = "translate(0, 0)";
    api.current?.setMove(0, 0);
  };

  return (
    <div className="mobile-controls">
      <div
        ref={stickRef}
        className="joystick"
        onPointerDown={(event) => {
          event.preventDefault();
          activePointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      ><div className="joystick-arrows">✦</div><div ref={knobRef} className="joystick-knob" /></div>
      <div className="mobile-actions">
        <button className="mobile-action pulse-action" onPointerDown={(e) => { e.preventDefault(); api.current?.pulse(); }}><Heart size={20} /><span>RINDU</span></button>
        <button className="mobile-action dash-action" onPointerDown={(e) => { e.preventDefault(); api.current?.dash(); }}><Zap size={20} /><span>DASH</span></button>
        <button
          className="mobile-action attack-action"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); api.current?.setAttack(true); }}
          onPointerUp={() => api.current?.setAttack(false)}
          onPointerCancel={() => api.current?.setAttack(false)}
        ><Sparkles size={25} /><span>CAHAYA</span></button>
      </div>
    </div>
  );
}
