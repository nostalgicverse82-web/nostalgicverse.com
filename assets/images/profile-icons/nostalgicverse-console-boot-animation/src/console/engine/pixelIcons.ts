// Tiny vector "pixel icons" drawn with primitive canvas calls.
// Kept intentionally simple/geometric — this is the language of a
// 128x64 monochrome OLED, not a bitmap sprite sheet.

type Ctx = CanvasRenderingContext2D;

export function iconKeypad(ctx: Ctx, cx: number, cy: number, s: number) {
  const g = s / 4;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(cx - s / 2 + c * g, cy - s / 2 + r * g, g - 1, g - 1);
    }
  }
}

export function iconPhone(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.strokeRect(cx - s / 3, cy - s / 2, (s / 3) * 2, s);
  ctx.fillRect(cx - 1, cy + s / 2 - 3, 2, 1);
}

export function iconController(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.roundRect(cx - s / 2, cy - s / 4, s, s / 2, s / 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - s / 4, cy, 1.2, 0, Math.PI * 2);
  ctx.arc(cx + s / 4, cy - 1, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

export function iconWifi(ctx: Ctx, cx: number, cy: number, s: number, progress = 1) {
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const r = (s / 2) * ((i + 1) / 3);
    if (progress * 3 > i) {
      ctx.beginPath();
      ctx.arc(cx, cy + s / 2, r, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy + s / 2, 1, 0, Math.PI * 2);
  ctx.fill();
}

export function iconBluetooth(ctx: Ctx, cx: number, cy: number, s: number) {
  const h = s / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + h / 1.4, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + h / 1.4, cy + h / 2);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx, cy - h);
  ctx.moveTo(cx - h / 1.4, cy - h / 2);
  ctx.lineTo(cx + h / 1.4, cy + h / 2);
  ctx.moveTo(cx - h / 1.4, cy + h / 2);
  ctx.lineTo(cx + h / 1.4, cy - h / 2);
  ctx.stroke();
}

export function iconTrophy(ctx: Ctx, cx: number, cy: number, s: number) {
  const w = s * 0.6;
  ctx.strokeRect(cx - w / 2, cy - s / 2, w, s * 0.5);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - s / 2 + 1);
  ctx.quadraticCurveTo(cx - w, cy - s / 2 + 1, cx - w / 2, cy - s / 2 + s * 0.3);
  ctx.moveTo(cx + w / 2, cy - s / 2 + 1);
  ctx.quadraticCurveTo(cx + w, cy - s / 2 + 1, cx + w / 2, cy - s / 2 + s * 0.3);
  ctx.stroke();
  ctx.fillRect(cx - 1, cy, 2, s * 0.25);
  ctx.fillRect(cx - w / 3, cy + s * 0.25, (w / 3) * 2, 2);
}

export function iconGraph(ctx: Ctx, cx: number, cy: number, s: number, bars: number[]) {
  const bw = s / (bars.length * 1.6);
  const startX = cx - (bars.length * bw * 1.6) / 2;
  bars.forEach((b, i) => {
    const h = b * s;
    ctx.fillRect(startX + i * bw * 1.6, cy + s / 2 - h, bw, h);
  });
}

export function iconGear(ctx: Ctx, cx: number, cy: number, s: number, rot = 0) {
  const teeth = 8;
  const rOuter = s / 2;
  const rInner = s / 3.2;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2 + rot;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, rInner / 2.2, 0, Math.PI * 2);
  ctx.stroke();
}

export function iconDisk(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
  ctx.fillRect(cx - s / 4, cy - s / 2, s / 2, s / 4);
  ctx.strokeRect(cx - s / 3, cy, (s / 3) * 2, s / 3);
}

export function iconAvatar(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.arc(cx, cy - s / 4, s / 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + s / 2, s / 2, Math.PI, Math.PI * 2);
  ctx.fill();
}

export function iconNote(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.arc(cx - s / 3, cy + s / 3, s / 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - s / 3 + s / 5 - 1, cy - s / 2, 1.4, s * 0.85);
  ctx.fillRect(cx - s / 3 + s / 5 - 1, cy - s / 2, s / 2.6, s / 6);
}

export function iconCartridge(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.strokeRect(cx - s / 2, cy - s / 2, s, s * 0.8);
  ctx.fillRect(cx - s / 3, cy - s / 2 - s * 0.15, s / 6, s * 0.15);
  ctx.fillRect(cx + s / 3 - s / 6, cy - s / 2 - s * 0.15, s / 6, s * 0.15);
  ctx.strokeRect(cx - s / 3, cy - s / 3, (s / 3) * 2, s * 0.35);
}
