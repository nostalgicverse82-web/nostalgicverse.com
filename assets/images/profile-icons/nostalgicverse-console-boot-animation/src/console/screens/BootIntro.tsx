import { useEffect, useRef, useState } from "react";
import { soundEngine } from "../audio/soundEngine";
import { scheduleBootAudio } from "../engine/bootAudio";
import { T } from "../engine/bootTimeline";
import { ParticlePool, clamp01, easeOutCubic, lerp, sampleTextPoints } from "../engine/particles";
import {
  iconAvatar,
  iconBluetooth,
  iconCartridge,
  iconController,
  iconDisk,
  iconGraph,
  iconKeypad,
  iconNote,
  iconPhone,
  iconTrophy,
  iconWifi,
} from "../engine/pixelIcons";
import type { ConsoleSettings } from "../types";

const W = 128;
const H = 64;
const CX = W / 2;
const CY = H / 2 - 2;

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface HW {
  display: boolean;
  input: boolean;
  audio: boolean;
  rtc: boolean;
  wifi: boolean;
  bt: boolean;
  save: boolean;
}

function detectHardware(): HW {
  let save = true;
  try {
    localStorage.setItem("__nv_probe", "1");
    localStorage.removeItem("__nv_probe");
  } catch {
    save = false;
  }
  return {
    display: true,
    input: true,
    audio: soundEngine.isReady,
    rtc: true,
    wifi: typeof navigator !== "undefined" ? navigator.onLine : true,
    bt: typeof navigator !== "undefined" && "bluetooth" in navigator,
    save,
  };
}

export default function BootIntro({
  onFinish,
  settings,
}: {
  onFinish: () => void;
  settings: ConsoleSettings;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [canSkipHint, setCanSkipHint] = useState(false);
  const stateRef = useRef({
    startPerf: 0,
    lastPerf: 0,
    particles: new ParticlePool(260),
    fired: new Set<string>(),
    hw: detectHardware(),
    rtcDate: null as Date | null,
    logoTargets: [] as { x: number; y: number }[],
    done: false,
  });

  const begin = () => {
    if (started) return;
    soundEngine.init();
    soundEngine.resume();
    soundEngine.setMuted(!settings.soundOn);
    soundEngine.setVolume(settings.volume);
    const hw = detectHardware();
    stateRef.current.hw = hw;
    if (settings.soundOn) scheduleBootAudio({ wifi: hw.wifi, bt: hw.bt });
    stateRef.current.startPerf = performance.now();
    stateRef.current.lastPerf = stateRef.current.startPerf;
    setStarted(true);
    setTimeout(() => setCanSkipHint(true), 400);
  };

  const finish = () => {
    if (stateRef.current.done) return;
    stateRef.current.done = true;
    soundEngine.stopAll();
    onFinish();
  };

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const once = (id: string, cond: boolean, fn: () => void) => {
      if (cond && !stateRef.current.fired.has(id)) {
        stateRef.current.fired.add(id);
        fn();
      }
    };

    const loop = () => {
      const s = stateRef.current;
      const now = performance.now();
      const dt = Math.min(0.05, (now - s.lastPerf) / 1000);
      s.lastPerf = now;
      const elapsed = now - s.startPerf;

      s.particles.update(dt, 0.985);
      render(ctx, elapsed, s, once);

      if (elapsed >= T.FINAL0 + 350) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  // allow pressing start / clicking to finish once in the final hold
  useEffect(() => {
    if (!started) return;
    const handler = (e: KeyboardEvent) => {
      const elapsed = performance.now() - stateRef.current.startPerf;
      if ((e.key === "Enter" || e.key === " ") && elapsed >= T.FINAL0 + 400) {
        finish();
      }
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function render(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#eaf8ff";
    ctx.strokeStyle = "#eaf8ff";
    ctx.lineWidth = 1;
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (elapsed < T.VOID_END) drawVoid(ctx, elapsed, s, once);
    else if (elapsed < T.SIGNAL_END) drawSignal(ctx, elapsed, s, once);
    else if (elapsed < T.CORE_END) drawCore(ctx, elapsed, s, once);
    else if (elapsed < T.DIAG_END) drawDiag(ctx, elapsed, s);
    else if (elapsed < T.RTC_END) drawRtc(ctx, elapsed, s);
    else if (elapsed < T.UNIVERSE_END) drawUniverse(ctx, elapsed, s, once);
    else if (elapsed < T.MUSIC_END) drawMusic(ctx, elapsed, s);
    else if (elapsed < T.CONNECT_END) drawConnect(ctx, elapsed, s);
    else if (elapsed < T.DATA_END) drawData(ctx, elapsed, s);
    else if (elapsed < T.RACE_END) drawRace(ctx, elapsed, s, once);
    else if (elapsed < T.LOGO_END) drawLogo(ctx, elapsed, s, once);
    else drawFinal(ctx, elapsed, s, once);

    drawParticles(ctx, s);
    if (elapsed > 300) drawSkipHint(ctx);
  }

  function drawParticles(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    s.particles.forEach((p) => {
      const a = p.maxLife > 500 ? 1 : clamp01(p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawSkipHint(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = "5px monospace";
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.55;
    ctx.fillText("ESC SKIP", W - 2, H - 4);
    ctx.restore();
  }

  // ---------- VOID ----------
  function drawVoid(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    const pts = [
      { t: 150, x: CX, y: CY },
      { t: 340, x: CX + 7, y: CY - 4 },
      { t: 520, x: CX - 6, y: CY + 3 },
      { t: 680, x: CX + 3, y: CY + 6 },
    ];
    for (const p of pts) {
      if (elapsed < p.t) continue;
      const a = clamp01(1 - (elapsed - p.t) / 420);
      ctx.globalAlpha = a;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    ctx.globalAlpha = 1;
    if (elapsed > 760) {
      ctx.font = "6px monospace";
      ctx.globalAlpha = (elapsed - 760) / 90;
      ctx.fillText("...", CX, CY + 14);
      ctx.globalAlpha = 1;
    }
    void once;
    void s;
  }

  // ---------- SIGNAL ----------
  function drawSignal(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    const l = elapsed - T.SIGNAL0;
    const snapAt = 650;
    if (l < snapAt) {
      const lw = easeOutCubic(clamp01(l / snapAt)) * W;
      ctx.fillRect(CX - lw / 2, CY, Math.max(1, lw), 1);
    } else {
      const flashA = clamp01(1 - (l - snapAt) / 140);
      ctx.globalAlpha = flashA * 0.9;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    once("snap", l >= snapAt, () => {
      for (let i = 0; i < 46; i++) {
        const ang = (i / 46) * Math.PI * 2;
        const speed = 18 + Math.random() * 30;
        s.particles.spawn({
          x: CX,
          y: CY,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          life: 0.9 + Math.random() * 0.4,
          maxLife: 1.1,
          size: 1,
        });
      }
    });
  }

  // ---------- CORE ----------
  function drawCore(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    const l = elapsed - T.CORE0;
    // pull particles toward center
    once("coreConverge", l >= 0, () => {
      s.particles.forEach((p) => {
        p.tx = CX;
        p.ty = CY;
      });
    });
    const pulses = [120, 320, 560];
    let energy = 0;
    for (const pt of pulses) if (l >= pt) energy += Math.exp(-(l - pt) / 130);
    const r = 1.5 + energy * 3.2;
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.fill();

    if (l > 600) {
      const rp = clamp01((l - 600) / 420);
      ctx.globalAlpha = 1 - rp;
      ctx.beginPath();
      ctx.arc(CX, CY, rp * 74, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    once("coreFlash", l >= 1020, () => {
      s.particles.forEach((p) => {
        p.tx = undefined;
        p.ty = undefined;
        const ang = Math.random() * Math.PI * 2;
        p.vx = Math.cos(ang) * 6;
        p.vy = Math.sin(ang) * 6;
        p.life = 0.3;
      });
    });
    if (l >= 1020 && l < 1120) {
      ctx.globalAlpha = clamp01(1 - (l - 1020) / 100) * 0.8;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- DIAG ----------
  function drawDiag(ctx: CanvasRenderingContext2D, elapsed: number, s: typeof stateRef.current) {
    const l = elapsed - T.DIAG0;
    const dur = T.DIAG_END - T.DIAG0;
    const rows: [string, boolean][] = [
      ["CORE", true],
      ["DISPLAY", s.hw.display],
      ["INPUT", s.hw.input],
      ["AUDIO", s.hw.audio],
      ["RTC", s.hw.rtc],
      ["WIFI", s.hw.wifi],
      ["BT", s.hw.bt],
      ["SAVE", s.hw.save],
    ];
    if (l > dur - 260) {
      ctx.font = "8px monospace";
      const a = clamp01((l - (dur - 260)) / 120);
      ctx.globalAlpha = a;
      ctx.fillText("SYSTEM", CX, CY - 5);
      ctx.fillText("READY", CX, CY + 6);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.font = "5px monospace";
    ctx.textAlign = "left";
    const colW = 64;
    const rowH = 14;
    rows.forEach(([label, ok], i) => {
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      const x = 6 + col * colW;
      const y = 6 + row * rowH;
      const startT = i * 110;
      const p = clamp01((l - startT) / 260);
      if (p <= 0) return;
      ctx.globalAlpha = 1;
      ctx.fillText(label, x, y);
      const barW = 26;
      ctx.strokeRect(x, y + 5, barW, 3);
      ctx.fillRect(x, y + 5, barW * easeOutCubic(p), 3);
      if (p >= 1) {
        ctx.fillText(ok ? "OK" : "!", x + barW + 4, y + 2);
      }
    });
    ctx.textAlign = "center";
  }

  // ---------- RTC ----------
  function drawRtc(ctx: CanvasRenderingContext2D, elapsed: number, s: typeof stateRef.current) {
    const l = elapsed - T.RTC0;
    if (!s.rtcDate) s.rtcDate = new Date();
    const d = s.rtcDate;

    if (l < 250) {
      ctx.font = "8px monospace";
      ctx.fillText("RTC", CX, CY - 6);
      ctx.font = "6px monospace";
      const dots = ".".repeat(1 + Math.floor(l / 70) % 3);
      ctx.fillText("SYNC" + dots, CX, CY + 6);
      return;
    }
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    const ss = d.getSeconds().toString().padStart(2, "0");
    const timeStr = `${hh}:${mm}:${ss}`;
    if (l < 900) {
      const digitsShown = Math.floor(((l - 250) / 650) * timeStr.length);
      ctx.font = "10px monospace";
      const shown = timeStr.slice(0, Math.max(0, digitsShown));
      ctx.fillText(shown, CX, CY);
      return;
    }
    const dateStr = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (l < 1100) {
      ctx.font = "10px monospace";
      ctx.fillText(timeStr, CX, CY - 6);
      const a = clamp01((l - 900) / 150);
      ctx.globalAlpha = a;
      ctx.font = "5px monospace";
      ctx.fillText(dateStr, CX, CY + 8);
      ctx.globalAlpha = 1;
      return;
    }
    const diss = clamp01((l - 1100) / 200);
    ctx.globalAlpha = 1 - diss;
    ctx.font = "10px monospace";
    ctx.fillText(timeStr, CX, CY - 6);
    ctx.font = "5px monospace";
    ctx.fillText(dateStr, CX, CY + 8);
    ctx.globalAlpha = 1;
  }

  // ---------- UNIVERSE ----------
  function drawUniverse(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    const l = elapsed - T.UNIVERSE0;
    const sceneLen = (T.UNIVERSE_END - T.UNIVERSE0) / 5;
    const idx = Math.min(4, Math.floor(l / sceneLen));
    const lt = clamp01((l - idx * sceneLen) / sceneLen);

    ctx.font = "5px monospace";
    ctx.textAlign = "left";
    ctx.globalAlpha = 0.6;
    const names = ["PIXEL QUEST", "FQ RACING", "ALIEN SIEGE", "PUZZLE", "ARCADE CORE"];
    ctx.fillText(names[idx], 4, 7);
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";

    if (idx === 0) {
      ctx.fillRect(0, 50, W, 1);
      const jumpT = Math.sin(Math.min(1, lt * 1.6) * Math.PI);
      const hx = 30;
      const hy = 50 - jumpT * 20;
      ctx.fillRect(hx - 2, hy - 4, 4, 4);
      const ex = 90 - lt * 50;
      ctx.fillRect(ex, 46, 4, 4);
      if (lt < 0.55) ctx.beginPath(), ctx.arc(70, 38, 2, 0, Math.PI * 2), ctx.fill();
    } else if (idx === 1) {
      for (let i = 0; i < 5; i++) {
        const y = ((i * 11 + lt * 60) % 64);
        ctx.fillRect(16, y, 2, 4);
        ctx.fillRect(W - 18, y, 2, 4);
      }
      const carY = 46;
      ctx.fillRect(CX - 6, carY, 12, 6);
      ctx.fillRect(CX - 8, carY + 2, 3, 2);
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.5;
        ctx.fillRect(CX - 10 - i * 6, carY + 1 + (i % 2), 4, 1);
        ctx.globalAlpha = 1;
      }
    } else if (idx === 2) {
      ctx.fillRect(12, CY - 2, 6, 4);
      const px = 18 + lt * 85;
      ctx.fillRect(px, CY, 3, 1);
      once(`laser${idx}`, lt > 0.72, () => {
        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2;
          s.particles.spawn({ x: 104, y: CY, vx: Math.cos(ang) * 25, vy: Math.sin(ang) * 25, life: 0.3, maxLife: 0.3, size: 1 });
        }
      });
      if (lt <= 0.72) ctx.fillRect(100, CY - 2, 6, 4);
    } else if (idx === 3) {
      const g = 7;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const ox = Math.sin(lt * 10 + r + c) * 1.5;
          const oy = Math.cos(lt * 8 + r * c) * 1.5;
          const flash = lt > 0.8 && (r + c) % 3 === 0;
          ctx.globalAlpha = flash ? 1 : 0.65;
          ctx.fillRect(CX - 14 + c * g + ox, CY - 14 + r * g + oy, g - 2, g - 2);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = clamp01(lt / 0.3);
      iconCartridge(ctx, CX, CY, 20);
      ctx.font = "6px monospace";
      ctx.globalAlpha = clamp01((lt - 0.3) / 0.3);
      ctx.fillText("CORE", CX, CY - 18);
      ctx.globalAlpha = clamp01((lt - 0.55) / 0.3);
      ctx.fillText("READY", CX, CY + 20);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- MUSIC + UTILITIES ----------
  function drawMusic(ctx: CanvasRenderingContext2D, elapsed: number, s: typeof stateRef.current) {
    void s;
    const l = elapsed - T.MUSIC0;
    const dur = T.MUSIC_END - T.MUSIC0;
    const seg = dur / 4;
    const idx = Math.min(3, Math.floor(l / seg));
    const lt = clamp01((l - idx * seg) / seg);
    ctx.globalAlpha = clamp01(lt * 3) * clamp01((1 - lt) * 3 + 0.3);
    if (idx === 0) {
      iconNote(ctx, CX, CY - 4, 16);
      for (let i = 0; i < 10; i++) {
        const h = 2 + Math.abs(Math.sin(l / 40 + i)) * 8;
        ctx.fillRect(30 + i * 7, CY + 14 - h / 2, 2, h);
      }
      ctx.font = "6px monospace";
      ctx.fillText("MUSIC PLAYER", CX, CY + 22);
    } else if (idx === 1) {
      ctx.font = "9px monospace";
      ctx.fillText("CLOCK  TIMER  CALC", CX, CY - 2);
      ctx.font = "6px monospace";
      ctx.fillText("UTILITIES", CX, CY + 14);
    } else if (idx === 2) {
      iconTrophy(ctx, CX, CY - 4, 16);
      ctx.font = "6px monospace";
      ctx.fillText("ACHIEVEMENT", CX, CY + 18);
    } else {
      iconGraph(ctx, CX, CY, 20, [0.3, 0.7, 0.5, 0.9, 0.4]);
      ctx.font = "6px monospace";
      ctx.fillText("STATS", CX, CY + 20);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- CONNECT ----------
  function drawConnect(ctx: CanvasRenderingContext2D, elapsed: number, s: typeof stateRef.current) {
    const l = elapsed - T.CONNECT0;
    if (l < 450) {
      iconKeypad(ctx, 16, 46, 14);
      iconPhone(ctx, CX, 12, 12);
      iconController(ctx, W - 18, 46, 16);
      const beams = [
        { t: 80, x: 16, y: 40 },
        { t: 170, x: CX, y: 18 },
        { t: 260, x: W - 18, y: 40 },
      ];
      for (const b of beams) {
        if (l < b.t) continue;
        const p = clamp01((l - b.t) / 160);
        ctx.globalAlpha = 1 - p * 0.3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(lerp(b.x, CX, p), lerp(b.y, CY, p));
        ctx.stroke();
      }
      if (l > 430) {
        ctx.globalAlpha = clamp01((l - 430) / 50);
        ctx.font = "6px monospace";
        ctx.fillText("INPUT READY", CX, CY + 20);
      }
      ctx.globalAlpha = 1;
    } else if (l < 820) {
      const lt = (l - 450) / 370;
      iconWifi(ctx, CX, CY - 4, 26, clamp01(lt * 1.6));
      if (lt > 0.85) {
        ctx.font = "6px monospace";
        ctx.fillText(s.hw.wifi ? "WIFI READY" : "WIFI OFFLINE", CX, CY + 20);
      }
    } else {
      const lt = (l - 820) / 330;
      iconBluetooth(ctx, CX, CY - 4, 22);
      if (lt > 0.4) {
        ctx.globalAlpha = clamp01((lt - 0.4) / 0.3);
        ctx.font = "6px monospace";
        ctx.fillText(s.hw.bt ? "BT READY" : "BT N/A", CX, CY + 20);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- DATA ----------
  function drawData(ctx: CanvasRenderingContext2D, elapsed: number, s: typeof stateRef.current) {
    void s;
    const l = elapsed - T.DATA0;
    const seg = (T.DATA_END - T.DATA0) / 4;
    const idx = Math.min(3, Math.floor(l / seg));
    const lt = clamp01((l - idx * seg) / seg);
    ctx.globalAlpha = clamp01(lt * 3) * clamp01((1 - lt) * 4 + 0.25);
    const icons = ["SAVE", "PROFILE", "ACHIEVEMENT", "STATISTICS"];
    if (idx === 0) iconDisk(ctx, CX, CY - 2, 18);
    if (idx === 1) iconAvatar(ctx, CX, CY - 2, 18);
    if (idx === 2) iconTrophy(ctx, CX, CY - 2, 18);
    if (idx === 3) iconGraph(ctx, CX, CY - 2, 18, [0.4, 0.8, 0.6, 1]);
    ctx.font = "6px monospace";
    ctx.fillText(icons[idx], CX, CY + 20);
    ctx.globalAlpha = 1;
  }

  // ---------- RACE ----------
  function drawRace(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    const l = elapsed - T.RACE0;
    // track
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(CX - 6, 14);
    ctx.lineTo(CX + 6, 14);
    ctx.lineTo(W, H);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const yy = H - ((elapsed / 4 + i * 14) % (H - 14));
      const prog = (yy - 14) / (H - 14);
      const xw = lerp(1, 30, prog);
      ctx.fillRect(CX - xw / 2, yy, xw, 1.4);
    }

    const carY = H - 14;
    if (l < 1140) {
      const shake = Math.sin(l / 25) * (l > 0 ? 0.5 : 0);
      ctx.fillRect(CX - 5 + shake, carY - 5, 10, 5);
      const label = l < 380 ? "3" : l < 760 ? "2" : "1";
      ctx.font = "16px monospace";
      ctx.globalAlpha = 0.95;
      ctx.fillText(label, CX, 28);
      ctx.globalAlpha = 1;
    } else if (l < 1180) {
      ctx.font = "14px monospace";
      ctx.fillText("GO", CX, 28);
      ctx.fillRect(CX - 5, carY - 5, 10, 5);
      ctx.globalAlpha = clamp01(1 - (l - 1140) / 40) * 0.9;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    } else {
      const p = clamp01((l - 1180) / 400);
      const carX = lerp(CX, W + 30, easeOutCubic(p));
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = 0.5 - i * 0.07;
        ctx.fillRect(carX - i * 7, carY - 5, 10, 5);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 10; i++) {
        const yy = carY - 4 + ((i % 5) - 2) * 2;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(0, yy, carX - i * 10, 1);
      }
      ctx.globalAlpha = 1;
      once("raceStreak", p > 0.55, () => {
        for (let i = 0; i < 40; i++) {
          s.particles.spawn({
            x: lerp(CX, W, Math.random()),
            y: carY - 2 + (Math.random() - 0.5) * 10,
            vx: 30 + Math.random() * 40,
            vy: (Math.random() - 0.5) * 8,
            life: 0.6 + Math.random() * 0.3,
            maxLife: 0.9,
            size: 1,
          });
        }
      });
    }
  }

  // ---------- LOGO ----------
  function ensureLogoTargets(s: typeof stateRef.current) {
    if (s.logoTargets.length) return s.logoTargets;
    const raw = sampleTextPoints("NOSTALGICVERSE", "bold 9px monospace", W, H, 2);
    const max = 240;
    const picked = raw.length > max ? raw.filter((_, i) => i % Math.ceil(raw.length / max) === 0) : raw;
    s.logoTargets = picked.map((p) => ({ x: p.x, y: p.y - 6 }));
    return s.logoTargets;
  }

  function drawLogo(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    const l = elapsed - T.LOGO0;
    if (l < 80) return; // silence beat — the void before the reveal
    once("assemble", l >= 80, () => {
      const targets = ensureLogoTargets(s);
      s.particles.assemble(targets, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
      }));
    });
    if (l < 180) {
      ctx.globalAlpha = clamp01(1 - (l - 80) / 100);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- FINAL ----------
  function drawFinal(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    s: typeof stateRef.current,
    once: (id: string, cond: boolean, fn: () => void) => void,
  ) {
    ensureLogoTargets(s);
    once("assembleFinal", true, () => {
      if (s.particles.activeCount < 10) {
        s.particles.assemble(s.logoTargets, () => ({ x: Math.random() * W, y: Math.random() * H }));
      }
    });
    const l = elapsed - T.FINAL0;
    ctx.font = "6px monospace";
    ctx.globalAlpha = clamp01(l / 150);
    ctx.fillText("MINI CONSOLE", CX, 36);
    if (l > 180) {
      ctx.globalAlpha = clamp01((l - 180) / 150);
      ctx.font = "7px monospace";
      ctx.fillText("SYSTEM READY", CX, 46);
    }
    if (l > 360) {
      ctx.globalAlpha = clamp01((l - 360) / 150);
      ctx.font = "5px monospace";
      const status = [
        "RTC OK",
        "INPUT OK",
        "AUDIO " + (s.hw.audio ? "OK" : "!"),
        "WIFI " + (s.hw.wifi ? "OK" : "OFF"),
        "BT " + (s.hw.bt ? "OK" : "N/A"),
      ].join("  ");
      ctx.fillText(status, CX, 54);
    }
    if (l > 500) {
      const blink = Math.floor(l / 480) % 2 === 0;
      ctx.globalAlpha = blink ? 1 : 0;
      ctx.font = "7px monospace";
      ctx.fillText("PRESS START", CX, 61);
    }
    ctx.globalAlpha = 1;
    void once;
  }

  return (
    <div className="relative h-full w-full select-none">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={() => {
          if (!started) begin();
          else if (performance.now() - stateRef.current.startPerf >= T.FINAL0 + 350) finish();
        }}
        className="h-full w-full cursor-pointer"
        style={{ imageRendering: "pixelated" }}
      />
      {!started && (
        <button
          onClick={begin}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-center"
        >
          <span className="font-[VT323] text-[10px] tracking-[0.3em] text-cyan-200/70">NOSTALGICVERSE</span>
          <span className="animate-pulse font-[VT323] text-sm tracking-widest text-cyan-200">⏻ PRESS POWER</span>
        </button>
      )}
      {started && canSkipHint && (
        <button
          onClick={finish}
          className="absolute right-1 top-1 rounded-sm px-1 text-[8px] tracking-wide text-cyan-200/40 hover:text-cyan-200/90"
        >
          SKIP »
        </button>
      )}
    </div>
  );
}
