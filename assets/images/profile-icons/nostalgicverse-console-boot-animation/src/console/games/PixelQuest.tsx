import { useEffect, useRef, useState } from "react";
import ColorFrame from "../ui/ColorFrame";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";
import { ParticlePool } from "../engine/particles";

const TILE = 10;
const COLS = 70;
const ROWS = 12;
const W = COLS >= 24 ? 240 : COLS * TILE;
const H = ROWS * TILE;

function buildLevel() {
  const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
  for (let c = 0; c < COLS; c++) {
    grid[10][c] = "#";
    grid[11][c] = "#";
  }
  const pits: [number, number][] = [
    [14, 16],
    [30, 32],
    [48, 50],
  ];
  for (const [a, b] of pits) for (let c = a; c <= b; c++) grid[10][c] = grid[11][c] = ".";
  const platforms: [number, number, number][] = [
    [8, 9, 13],
    [7, 20, 23],
    [9, 35, 38],
    [6, 41, 45],
    [8, 55, 59],
  ];
  for (const [r, a, b] of platforms) for (let c = a; c <= b; c++) grid[r][c] = "=";
  const coinSpots: [number, number][] = [
    [7, 10], [7, 11], [7, 12],
    [6, 21], [6, 22],
    [8, 36], [8, 37],
    [5, 42], [5, 43], [5, 44],
    [7, 56], [7, 57], [7, 58],
    [9, 63], [9, 64],
  ];
  for (const [r, c] of coinSpots) grid[r][c] = "o";
  return { grid: grid.map((r) => r.join("")), enemyCols: [19, 37, 53, 62], flagCol: 66 };
}

const LEVEL = buildLevel();
const WORLD_W = COLS * TILE;

function tileAt(col: number, row: number) {
  if (row >= ROWS) return "V"; // void — deadly
  if (row < 0 || col < 0 || col >= COLS) return ".";
  return LEVEL.grid[row][col];
}
const solid = (ch: string) => ch === "#" || ch === "=";

interface Enemy {
  x: number;
  y: number;
  dir: number;
  alive: boolean;
  spawnX: number;
}

export default function PixelQuest({
  inputRef,
  onExit,
  onResult,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onExit: () => void;
  onResult: (r: { score: number; win: boolean; coins: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "win" | "dead" | "paused">("ready");
  const reportedRef = useRef(false);

  const gameRef = useRef({
    px: 24,
    py: ROWS * TILE - TILE * 2,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    lives: 3,
    score: 0,
    coins: 0,
    coinsMap: new Map<string, boolean>(),
    enemies: [] as Enemy[],
    checkpoint: 24,
    invuln: 0,
    time: 100,
    camX: 0,
    particles: new ParticlePool(80),
    prevB: false,
    prevStart: false,
    squashT: 0,
  });

  useEffect(() => {
    const g = gameRef.current;
    g.enemies = LEVEL.enemyCols.map((c) => ({ x: c * TILE, y: ROWS * TILE - TILE * 2, dir: 1, alive: true, spawnX: c * TILE }));
  }, []);

  const resetGame = () => {
    const g = gameRef.current;
    g.px = 24;
    g.py = ROWS * TILE - TILE * 2;
    g.vx = 0;
    g.vy = 0;
    g.lives = 3;
    g.score = 0;
    g.coins = 0;
    g.coinsMap.clear();
    g.checkpoint = 24;
    g.invuln = 2;
    g.time = 100;
    g.enemies = LEVEL.enemyCols.map((c) => ({ x: c * TILE, y: ROWS * TILE - TILE * 2, dir: 1, alive: true, spawnX: c * TILE }));
    reportedRef.current = false;
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "ready") return;
    const id = setTimeout(resetGame, 10);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const respawn = (lostLife: boolean) => {
      const g = gameRef.current;
      if (lostLife) {
        g.lives -= 1;
        soundEngine.noiseBurst(0.18, 0.3);
      }
      if (g.lives <= 0) {
        setPhase("dead");
        return;
      }
      g.px = g.checkpoint;
      g.py = ROWS * TILE - TILE * 2;
      g.vx = 0;
      g.vy = 0;
      g.invuln = 1.5;
    };

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const input = inputRef.current?.frame;

      if (input?.justB && !g.prevB) onExit();
      g.prevB = !!input?.justB;
      if (input?.justStart && !g.prevStart) setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
      g.prevStart = !!input?.justStart;

      if (phase === "playing" && input) {
        g.time -= dt;
        if (g.time <= 0) {
          g.time = 0;
          setPhase("dead");
        }
        const target = input.left ? -60 : input.right ? 60 : 0;
        if (target !== 0) g.facing = target > 0 ? 1 : -1;
        g.vx += (target - g.vx) * Math.min(1, dt * 10);
        if (input.justA && g.onGround) {
          g.vy = -165;
          g.onGround = false;
          soundEngine.beep(520, 0.07, "square", 0.22);
        }
        g.vy = Math.min(260, g.vy + 480 * dt);

        // move X
        g.px += g.vx * dt;
        g.px = Math.max(4, Math.min(WORLD_W - 4, g.px));
        const halfW = 4;
        for (const dx of [-halfW, halfW]) {
          const col = Math.floor((g.px + dx) / TILE);
          const rowTop = Math.floor((g.py - 4) / TILE);
          const rowBot = Math.floor((g.py + 4) / TILE);
          for (const row of [rowTop, rowBot]) {
            if (solid(tileAt(col, row))) {
              if (dx < 0) g.px = (col + 1) * TILE + halfW;
              else g.px = col * TILE - halfW;
              g.vx = 0;
            }
          }
        }
        // move Y
        g.py += g.vy * dt;
        g.onGround = false;
        const feetRow = Math.floor((g.py + 5) / TILE);
        const headRow = Math.floor((g.py - 5) / TILE);
        const col = Math.floor(g.px / TILE);
        for (const c of [Math.floor((g.px - 3) / TILE), Math.floor((g.px + 3) / TILE)]) {
          if (g.vy > 0 && solid(tileAt(c, feetRow))) {
            g.py = feetRow * TILE - 5;
            g.vy = 0;
            g.onGround = true;
          } else if (g.vy < 0 && solid(tileAt(c, headRow))) {
            g.py = (headRow + 1) * TILE + 5;
            g.vy = 0;
          }
        }
        if (tileAt(col, feetRow) === "V" || g.py > ROWS * TILE + 10) {
          respawn(true);
        }
        g.checkpoint = Math.max(g.checkpoint, Math.min(g.px, WORLD_W - 20) - 10);

        // coins
        for (let r = 0; r < ROWS; r++) {
          for (let c2 = 0; c2 < COLS; c2++) {
            if (LEVEL.grid[r][c2] !== "o") continue;
            const key = `${r},${c2}`;
            if (g.coinsMap.get(key)) continue;
            const cx = c2 * TILE + 5;
            const cy = r * TILE + 5;
            if (Math.abs(cx - g.px) < 7 && Math.abs(cy - g.py) < 7) {
              g.coinsMap.set(key, true);
              g.coins += 1;
              g.score += 10;
              soundEngine.beep(1500, 0.06, "square", 0.25);
            }
          }
        }

        // enemies
        g.invuln = Math.max(0, g.invuln - dt);
        for (const e of g.enemies) {
          if (!e.alive) continue;
          e.x += e.dir * 20 * dt;
          if (e.x > e.spawnX + 18 || e.x < e.spawnX - 18) e.dir *= -1;
          const dx = e.x - g.px;
          const dy = e.y - g.py;
          if (Math.abs(dx) < 7 && Math.abs(dy) < 8) {
            if (g.vy > 20 && g.py < e.y) {
              e.alive = false;
              g.vy = -120;
              g.score += 100;
              soundEngine.beep(900, 0.09, "square", 0.3);
              for (let i = 0; i < 10; i++) {
                g.particles.spawn({
                  x: e.x,
                  y: e.y,
                  vx: (Math.random() - 0.5) * 60,
                  vy: -Math.random() * 60,
                  life: 0.4,
                  maxLife: 0.4,
                  size: 2,
                });
              }
            } else if (g.invuln <= 0) {
              g.vx = dx > 0 ? -80 : 80;
              g.vy = -100;
              respawn(true);
            }
          }
        }

        if (g.px >= LEVEL.flagCol * TILE) {
          g.score += 500 + Math.floor(g.time) * 2;
          soundEngine.signature(0, 0.3);
          setPhase("win");
        }

        g.particles.update(dt, 0.9);
        g.camX = Math.max(0, Math.min(WORLD_W - W, g.px - W / 2));
      }

      draw(ctx, g);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if ((phase === "win" || phase === "dead") && !reportedRef.current) {
      reportedRef.current = true;
      const g = gameRef.current;
      onResult({ score: g.score, win: phase === "win", coins: g.coins });
    }
  }, [phase, onResult]);

  function draw(ctx: CanvasRenderingContext2D, g: (typeof gameRef)["current"]) {
    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1c2a52");
    grad.addColorStop(1, "#4a6fb5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-g.camX, 0);

    // parallax hills
    ctx.fillStyle = "#355a3f";
    for (let i = -1; i < 6; i++) {
      const hx = i * 90 + (g.camX * 0.3) % 90;
      ctx.beginPath();
      ctx.ellipse(hx, H - 8, 50, 22, 0, Math.PI, 0);
      ctx.fill();
    }

    // tiles
    const startCol = Math.max(0, Math.floor(g.camX / TILE) - 1);
    const endCol = Math.min(COLS, Math.ceil((g.camX + W) / TILE) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = startCol; c < endCol; c++) {
        const ch = LEVEL.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (ch === "#") {
          ctx.fillStyle = "#6b4226";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#4f9c3b";
          ctx.fillRect(x, y, TILE, 3);
        } else if (ch === "=") {
          ctx.fillStyle = "#b5752f";
          ctx.fillRect(x, y, TILE, TILE * 0.7);
          ctx.fillStyle = "#e0a95a";
          ctx.fillRect(x, y, TILE, 2);
        } else if (ch === "o" && !g.coinsMap.get(`${r},${c}`)) {
          ctx.fillStyle = "#ffd94a";
          ctx.beginPath();
          ctx.arc(x + 5, y + 5, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff3b0";
          ctx.fillRect(x + 4, y + 3, 1.3, 1.3);
        }
      }
    }

    // flag
    const fx = LEVEL.flagCol * TILE;
    ctx.fillStyle = "#cfd6dd";
    ctx.fillRect(fx + 4, 20, 1.5, (ROWS - 2) * TILE - 20);
    ctx.fillStyle = "#ff5a5a";
    ctx.beginPath();
    ctx.moveTo(fx + 5.5, 22);
    ctx.lineTo(fx + 14, 26);
    ctx.lineTo(fx + 5.5, 30);
    ctx.fill();

    // enemies
    for (const e of g.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = "#8a4b9e";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.x - 3, e.y - 2, 1.6, 1.6);
      ctx.fillRect(e.x + 1.4, e.y - 2, 1.6, 1.6);
    }

    // particles
    g.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = "#ffd94a";
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // player
    const blink = g.invuln > 0 && Math.floor(g.invuln * 12) % 2 === 0;
    if (!blink) {
      const px = g.px;
      const py = g.py;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(g.facing, 1);
      ctx.fillStyle = "#3c7a2e";
      ctx.fillRect(-4, -8, 8, 4); // cap
      ctx.fillStyle = "#f2c49b";
      ctx.fillRect(-3, -4, 6, 4); // face
      ctx.fillStyle = "#e2622b";
      ctx.fillRect(-4, 0, 8, 6); // overalls
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(-4, 6, 3, 3);
      ctx.fillRect(1, 6, 3, 3);
      ctx.restore();
    }
    ctx.restore();

    // HUD
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`SCORE ${g.score}`, 4, 3);
    ctx.fillText(`COINS ${g.coins}`, 4, 14);
    ctx.textAlign = "right";
    ctx.fillText(`TIME ${Math.ceil(g.time)}`, W - 4, 3);
    ctx.fillText(`LIVES ${g.lives}`, W - 4, 14);
    ctx.textAlign = "center";
  }

  return (
    <ColorFrame>
      <canvas ref={canvasRef} width={W} height={H} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
      {phase === "paused" && (
        <Overlay title="PAUSED" sub="PRESS START TO RESUME" />
      )}
      {phase === "win" && (
        <Overlay title="LEVEL CLEAR!" sub={`SCORE ${gameRef.current.score} — A RETRY · B EXIT`} onA={resetGame} onB={onExit} />
      )}
      {phase === "dead" && (
        <Overlay title="GAME OVER" sub={`SCORE ${gameRef.current.score} — A RETRY · B EXIT`} onA={resetGame} onB={onExit} />
      )}
    </ColorFrame>
  );
}

function Overlay({ title, sub, onA, onB }: { title: string; sub: string; onA?: () => void; onB?: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " " || e.key === "z") && onA) onA();
      if ((e.key === "Escape" || e.key === "x") && onB) onB();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onA, onB]);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 font-['VT323'] text-white">
      <div className="text-[22px] tracking-wide">{title}</div>
      <div className="text-[13px] opacity-80">{sub}</div>
    </div>
  );
}
