// Fixed-size particle pool — no dynamic allocation during animation,
// mirroring the constraint the real ESP32 firmware would have to respect.

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  tx?: number; // optional target x (for morph/assemble effects)
  ty?: number;
}

export class ParticlePool {
  readonly pool: Particle[];
  constructor(size: number) {
    this.pool = new Array(size).fill(0).map(() => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
    }));
  }

  spawn(p: Partial<Particle>) {
    const slot = this.pool.find((pt) => !pt.active);
    if (!slot) return null;
    slot.active = true;
    slot.x = p.x ?? 0;
    slot.y = p.y ?? 0;
    slot.vx = p.vx ?? 0;
    slot.vy = p.vy ?? 0;
    slot.life = p.life ?? 1;
    slot.maxLife = p.maxLife ?? slot.life;
    slot.size = p.size ?? 1;
    slot.tx = p.tx;
    slot.ty = p.ty;
    return slot;
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }

  // Force every slot in the pool to converge on a list of target points —
  // used for the "particles assemble into the logo" moment. Re-uses
  // whatever particles already exist (continuous motion) instead of
  // allocating anything new.
  assemble(targets: { x: number; y: number }[], scatter: () => { x: number; y: number }) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      const target = targets[i % targets.length];
      if (!p.active) {
        const spot = scatter();
        p.x = spot.x;
        p.y = spot.y;
      }
      p.active = true;
      p.tx = target.x;
      p.ty = target.y;
      p.life = 999;
      p.maxLife = 999;
      p.size = 1;
      if (i >= targets.length) p.active = false;
    }
  }

  update(dt: number, drag = 1) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.tx !== undefined && p.ty !== undefined) {
        // ease toward target (used for "assemble into shape" effects)
        const k = Math.min(1, dt * 6);
        p.x += (p.tx - p.x) * k;
        p.y += (p.ty - p.y) * k;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= drag;
        p.vy *= drag;
      }
    }
  }

  forEach(fn: (p: Particle) => void) {
    for (const p of this.pool) if (p.active) fn(p);
  }

  get activeCount() {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Samples points from rendered text so particles can "assemble" into a logo.
export function sampleTextPoints(
  text: string,
  font: string,
  canvasW: number,
  canvasH: number,
  step = 2,
): { x: number; y: number }[] {
  const off = document.createElement("canvas");
  off.width = canvasW;
  off.height = canvasH;
  const ctx = off.getContext("2d")!;
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = "#fff";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvasW / 2, canvasH / 2);
  const data = ctx.getImageData(0, 0, canvasW, canvasH).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < canvasH; y += step) {
    for (let x = 0; x < canvasW; x += step) {
      const idx = (y * canvasW + x) * 4;
      if (data[idx + 3] > 128) pts.push({ x, y });
    }
  }
  return pts;
}
