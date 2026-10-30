import { Game } from "./game";
import type { GameApi, UiSnapshot } from "./types";

declare global {
  interface Window {
    __gameProbe?: () => { x: number; y: number; z: number };
    __GAME_READY__?: boolean;
    __gameStats?: () => { fps: number; enemies: number; projectiles: number; calls: number; triangles: number };
    __gameDebug?: { snapshot(): UiSnapshot; clearWave(): void; boss(): void; defeat(): void; music(): { paused: boolean; currentTime: number; duration: number } };
  }
}

let session: Game | null = null;

export function startGame(canvas: HTMLCanvasElement, emit: (ui: UiSnapshot) => void): GameApi {
  stopGame();
  const game = new Game(canvas, emit);
  session = game;
  window.__gameProbe = () => ({
    x: game.world.player.position.x,
    y: game.world.player.position.y,
    z: game.world.player.position.z,
  });
  window.__gameStats = () => game.getStats();
  if (new URLSearchParams(location.search).has("verify")) {
    window.__gameDebug = {
      snapshot: () => game.getSnapshot(),
      clearWave: () => game.debugClearWave(),
      boss: () => game.debugBoss(),
      defeat: () => game.debugDefeat(),
      music: () => game.audio.musicState(),
    };
  }
  return game;
}

export function stopGame(): void {
  session?.dispose();
  session = null;
  delete window.__gameProbe;
  delete window.__gameStats;
  delete window.__gameDebug;
  window.__GAME_READY__ = false;
}
