import { useEffect, useRef, useState } from "react";
import ColorFrame from "../ui/ColorFrame";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";
import { ParticlePool } from "../engine/particles";

const W = 240;
const H = 120;
const GROUND_Y = H - 18;
const WORLD_LEN = 1900;
const BOSS_X = 1850;

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  friendly: boolean;
  alive: boolean;
}
interface Enemy {
  id: number;
  x: number;
  y: number;
  type: "walker" | "drone";
  hp: number;
  alive: boolean;
  cooldown: number;
  baseY: number;
  phase: number;
  spawned: boolean;
  triggerX: number;
}

function buildSpawns(): Enemy[] {
  const defs: { x: number; type: "walker" | "drone" }[] = [
    { x: 260, type: "walker" },
    { x: 420, type: "walker" },
    { x: 560, type: "drone" },
    { x: 740, type: "walker" },
    { x: 900, type: "drone" },
    { x: 1040, type: "walker" },
    { x: 1040, type: "walker" },
    { x: 1220, type: "drone" },
    { x: 1360, type: "walker" },
    { x: 1500, type: "drone" },
    { x: 1620, type: "walker" },
    { x: 1620, type: "walker" },
  ];
  return defs.map((d, i) => ({
    id: i,
    x: d.x,
    y: d.type === "drone" ? GROUND_Y - 40 : GROUND_Y,
    type: d.type,
    hp: d.type === "drone" ? 2 : 2,
    alive: false,
    cooldown: 1 + Math.random(),
    baseY: d.type === "drone" ? GROUND_Y - 40 : GROUND_Y,
    phase: Math.random() * Math.PI * 2,
    spawned: false,
    triggerX: d.x - 140,
  }));
}

export default function AlienSiege({
  inputRef,
  onExit,
  onResult,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onExit: () => void;
  onResult: (r: { score: number; win: boolean }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "win" | "dead" | "paused">("ready");
  const reportedRef = useRef(false);

  const gameRef = useRef({
    px: 20,
    py: GROUND_Y,
    vy: 0,
    onGround: true,
    facing: 1,
    aimY: 0,
    health: 3,
    score: 0,
    camX: 0,
    fireCooldown: 0,
    invuln: 0,
    enemies: buildSpawns(),
    bullets: [] as Bullet[],
    particles: new ParticlePool(120),
    boss: { active: false, hp: 20, maxHp: 20, x: BOSS_X + 40, y: GROUND_Y - 20, cooldown: 1 },
    prevB: false,
    prevStart: false,
  });

  const resetGame = () => {
    const g = gameRef.current;
    g.px = 20;
    g.py = GROUND_Y;
    g.vy = 0;
    g.health = 3;
    g.score = 0;
    g.camX = 0;
    g.fireCooldown = 0;
    g.invuln = 1.2;
    g.enemies = buildSpawns();
    g.bullets = [];
    g.boss = { active: false, hp: 20, maxHp: 20, x: BOSS_X + 40, y: GROUND_Y - 20, cooldown: 1 };
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

    const hurt = () => {
      const g = gameRef.current;
      if (g.invuln > 0) return;
      g.health -= 1;
      g.invuln = 1.4;
      soundEngine.noiseBurst(0.15, 0.3);
      if (g.health <= 0) setPhase("dead");
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
        const speed = 55;
        if (input.left) {
          g.px -= speed * dt;
          g.facing = -1;
        }
        if (input.right) {
          g.px += speed * dt;
          g.facing = 1;
        }
        g.px = Math.max(6, Math.min(WORLD_LEN - 6, g.px));
        if (input.justA && g.onGround) {
          g.vy = -150;
          g.onGround = false;
        }
        g.vy += 420 * dt;
        g.py += g.vy * dt;
        if (g.py >= GROUND_Y) {
          g.py = GROUND_Y;
          g.vy = 0;
          g.onGround = true;
        }

        g.fireCooldown -= dt;
        if (input.a && g.fireCooldown <= 0) {
          g.fireCooldown = 0.18;
          g.bullets.push({ x: g.px + g.facing * 8, y: g.py - 6, vx: g.facing * 220, vy: 0, friendly: true, alive: true });
          soundEngine.beep(1600, 0.04, "square", 0.18);
        }

        g.invuln = Math.max(0, g.invuln - dt);

        // spawn & update enemies
        for (const e of g.enemies) {
          if (!e.spawned && g.px > e.triggerX) {
            e.spawned = true;
            e.alive = true;
          }
          if (!e.alive) continue;
          if (e.type === "walker") {
            const dir = g.px < e.x ? -1 : 1;
            e.x += dir * 14 * dt;
          } else {
            e.y = e.baseY + Math.sin(now / 400 + e.phase) * 10;
          }
          e.cooldown -= dt;
          if (e.cooldown <= 0 && Math.abs(e.x - g.px) < 130) {
            e.cooldown = 1.3 + Math.random() * 0.6;
            const dx = g.px - e.x;
            const dy = g.py - 6 - e.y;
            const len = Math.hypot(dx, dy) || 1;
            g.bullets.push({ x: e.x, y: e.y, vx: (dx / len) * 70, vy: (dy / len) * 70, friendly: false, alive: true });
          }
          if (Math.abs(e.x - g.px) < 8 && Math.abs(e.y - g.py) < 10) hurt();
        }

        // boss
        if (!g.boss.active && g.px > BOSS_X - 60) {
          g.boss.active = true;
        }
        if (g.boss.active && g.boss.hp > 0) {
          g.camX = Math.min(g.camX, WORLD_LEN - W);
          g.boss.cooldown -= dt;
          if (g.boss.cooldown <= 0) {
            g.boss.cooldown = 1.1;
            for (let i = -1; i <= 1; i++) {
              g.bullets.push({ x: g.boss.x, y: g.boss.y, vx: -90, vy: i * 40, friendly: false, alive: true });
            }
            soundEngine.beep(300, 0.1, "sawtooth", 0.2);
          }
          if (Math.abs(g.boss.x - g.px) < 14 && Math.abs(g.boss.y - g.py) < 14) hurt();
        }

        // bullets
        for (const b of g.bullets) {
          if (!b.alive) continue;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < g.camX - 20 || b.x > g.camX + W + 20 || b.y < 0 || b.y > H) b.alive = false;
          if (b.friendly) {
            for (const e of g.enemies) {
              if (!e.alive) continue;
              if (Math.abs(e.x - b.x) < 7 && Math.abs(e.y - b.y) < 7) {
                e.hp -= 1;
                b.alive = false;
                if (e.hp <= 0) {
                  e.alive = false;
                  g.score += e.type === "drone" ? 150 : 100;
                  soundEngine.beep(700, 0.08, "square", 0.25);
                  for (let i = 0; i < 12; i++) {
                    g.particles.spawn({
                      x: e.x,
                      y: e.y,
                      vx: (Math.random() - 0.5) * 80,
                      vy: (Math.random() - 0.5) * 80,
                      life: 0.4,
                      maxLife: 0.4,
                      size: 2,
                    });
                  }
                }
              }
            }
            if (g.boss.active && g.boss.hp > 0 && Math.abs(g.boss.x - b.x) < 16 && Math.abs(g.boss.y - b.y) < 16) {
              g.boss.hp -= 1;
              b.alive = false;
              soundEngine.beep(500, 0.05, "square", 0.2);
              if (g.boss.hp <= 0) {
                g.score += 1000;
                soundEngine.signature(0, 0.3);
                for (let i = 0; i < 40; i++) {
                  g.particles.spawn({
                    x: g.boss.x,
                    y: g.boss.y,
                    vx: (Math.random() - 0.5) * 150,
                    vy: (Math.random() - 0.5) * 150,
                    life: 0.7,
                    maxLife: 0.7,
                    size: 2.4,
                  });
                }
                setPhase("win");
              }
            }
          } else if (!b.friendly) {
            if (Math.abs(b.x - g.px) < 5 && Math.abs(b.y - g.py) < 7) {
              b.alive = false;
              hurt();
            }
          }
        }
        g.bullets = g.bullets.filter((b) => b.alive);
        g.particles.update(dt, 0.92);
        g.camX = Math.max(0, Math.min(WORLD_LEN - W, g.px - W * 0.35));
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
      onResult({ score: gameRef.current.score, win: phase === "win" });
    }
  }, [phase, onResult]);

  function draw(ctx: CanvasRenderingContext2D, g: (typeof gameRef)["current"]) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a0f2e");
    grad.addColorStop(1, "#3a2a5c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-g.camX, 0);

    // stars/parallax
    ctx.fillStyle = "#6c5a99";
    for (let i = 0; i < 24; i++) {
      const x = (i * 97 + g.camX * 0.2) % (WORLD_LEN + 100);
      ctx.fillRect(x, 10 + (i * 37) % 50, 1.4, 1.4);
    }

    // ground
    ctx.fillStyle = "#2e2140";
    ctx.fillRect(0, GROUND_Y + 6, WORLD_LEN, H - GROUND_Y);
    ctx.fillStyle = "#4b3a6b";
    ctx.fillRect(0, GROUND_Y + 6, WORLD_LEN, 2);

    // boss
    if (g.boss.active && g.boss.hp > 0) {
      ctx.fillStyle = "#8a2e2e";
      ctx.fillRect(g.boss.x - 12, g.boss.y - 14, 24, 28);
      ctx.fillStyle = "#ffcf5c";
      ctx.fillRect(g.boss.x - 6, g.boss.y - 4, 12, 4);
      // hp bar
      ctx.fillStyle = "#222";
      ctx.fillRect(g.boss.x - 16, g.boss.y - 24, 32, 3);
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(g.boss.x - 16, g.boss.y - 24, 32 * (g.boss.hp / g.boss.maxHp), 3);
    }

    // enemies
    for (const e of g.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.type === "drone" ? "#4ecfd1" : "#9a5ad1";
      if (e.type === "drone") {
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(e.x - 4, e.y - 12, 8, 12);
        ctx.fillStyle = "#1c1430";
        ctx.fillRect(e.x - 3, e.y - 10, 2, 2);
        ctx.fillRect(e.x + 1, e.y - 10, 2, 2);
      }
    }

    // bullets
    for (const b of g.bullets) {
      ctx.fillStyle = b.friendly ? "#ffe97a" : "#ff6a6a";
      ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    }

    // particles
    g.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = "#ffb04e";
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // player
    const blink = g.invuln > 0 && Math.floor(g.invuln * 12) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(g.px, g.py);
      ctx.scale(g.facing, 1);
      ctx.fillStyle = "#3c6e8a";
      ctx.fillRect(-4, -14, 8, 10); // torso
      ctx.fillStyle = "#e3b98c";
      ctx.fillRect(-3, -18, 6, 5); // head
      ctx.fillStyle = "#2b2b2b";
      ctx.fillRect(-4, -4, 3, 4);
      ctx.fillRect(1, -4, 3, 4);
      ctx.fillStyle = "#c8c8c8";
      ctx.fillRect(2, -11, 8, 2); // gun
      ctx.restore();
    }

    ctx.restore();

    // HUD
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`SCORE ${g.score}`, 4, 3);
    ctx.textAlign = "right";
    ctx.fillText(`HP ${"♥".repeat(Math.max(0, g.health))}`, W - 4, 3);
    ctx.textAlign = "center";
    if (g.boss.active && g.boss.hp > 0) {
      ctx.fillStyle = "#ff8585";
      ctx.font = "8px monospace";
      ctx.fillText("ALIEN OVERLORD", W / 2, 3);
    }
  }

  return (
    <ColorFrame>
      <canvas ref={canvasRef} width={W} height={H} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
      {phase === "paused" && <Overlay title="PAUSED" sub="PRESS START TO RESUME" />}
      {phase === "win" && (
        <Overlay title="SIEGE REPELLED!" sub={`SCORE ${gameRef.current.score} — A RETRY · B EXIT`} onA={resetGame} onB={onExit} />
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
      <div className="text-[20px] tracking-wide">{title}</div>
      <div className="text-[13px] opacity-80">{sub}</div>
    </div>
  );
}
