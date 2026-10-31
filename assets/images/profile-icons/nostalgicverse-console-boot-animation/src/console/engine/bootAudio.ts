import { soundEngine } from "../audio/soundEngine";
import { T } from "./bootTimeline";

// All boot sound effects, scheduled once (in seconds) against the Web Audio
// clock the instant the console is powered on. Designed together with the
// visual timeline in bootTimeline.ts so every beat lands on a frame.
export function scheduleBootAudio(hw: { wifi: boolean; bt: boolean }) {
  const ms = (v: number) => v / 1000;

  // VOID — single pixel clicks
  soundEngine.click(ms(150));
  soundEngine.click(ms(340));
  soundEngine.click(ms(520));
  soundEngine.click(ms(680));

  // SIGNAL — rising sweep + snap
  soundEngine.sweep(140, 1200, 0.5, ms(T.SIGNAL0 + 60), 0.22, "sawtooth");
  soundEngine.noiseBurst(0.12, 0.3, ms(T.SIGNAL_END - 60));

  // CORE awakening — tick tick TIIICK + ring flash
  soundEngine.tick(1, ms(T.CORE0 + 120));
  soundEngine.tick(1.3, ms(T.CORE0 + 320));
  soundEngine.beep(1400, 0.22, "triangle", 0.3, ms(T.CORE0 + 560));
  soundEngine.noiseBurst(0.18, 0.25, ms(T.CORE_END - 120));

  // DIAG — rapid confirmation beeps per subsystem row
  const diagRows = 7;
  for (let i = 0; i < diagRows; i++) {
    const t = T.DIAG0 + 90 + i * ((T.DIAG_END - T.DIAG0 - 260) / diagRows);
    soundEngine.beep(900 + i * 70, 0.045, "square", 0.22, ms(t));
  }
  soundEngine.beep(1600, 0.12, "square", 0.3, ms(T.DIAG_END - 140));

  // RTC — sequential digit clicks then dissolve
  for (let i = 0; i < 8; i++) {
    soundEngine.click(ms(T.RTC0 + 180 + i * 70));
  }
  soundEngine.sweep(900, 200, 0.25, ms(T.RTC_END - 180), 0.18, "sine");

  // UNIVERSE micro-scenes — jump, coin, boost, laser, explosion, shuffle, cartridge
  const sceneLen = (T.UNIVERSE_END - T.UNIVERSE0) / 5;
  const s0 = T.UNIVERSE0;
  soundEngine.beep(500, 0.08, "square", 0.25, ms(s0 + 70)); // jump
  soundEngine.beep(1500, 0.07, "square", 0.3, ms(s0 + sceneLen * 0.55)); // coin
  soundEngine.sweep(300, 900, 0.18, ms(s0 + sceneLen + 60), 0.25, "sawtooth"); // car boost
  soundEngine.beep(1700, 0.05, "square", 0.25, ms(s0 + sceneLen * 2 + 90)); // laser
  soundEngine.noiseBurst(0.15, 0.3, ms(s0 + sceneLen * 2 + 220)); // explosion
  for (let i = 0; i < 4; i++) soundEngine.tick(1.4, ms(s0 + sceneLen * 3 + 60 + i * 60)); // puzzle shuffle
  soundEngine.beep(1200, 0.18, "triangle", 0.3, ms(s0 + sceneLen * 4 + 120)); // cartridge ready

  // MUSIC + UTILITIES
  soundEngine.melody(
    [
      { freq: 660, dur: 0.09, type: "triangle", vol: 0.25 },
      { freq: 880, dur: 0.09, type: "triangle", vol: 0.25 },
      { freq: 990, dur: 0.14, type: "triangle", vol: 0.25 },
    ],
    ms(T.MUSIC0 + 60),
  );
  soundEngine.beep(1100, 0.05, "square", 0.22, ms(T.MUSIC0 + 380));
  soundEngine.beep(1300, 0.05, "square", 0.22, ms(T.MUSIC0 + 460));
  soundEngine.beep(1500, 0.08, "square", 0.25, ms(T.MUSIC0 + 540));

  // CONNECTIVITY — keypad/mobile/controller pulses, wifi, bluetooth
  const c0 = T.CONNECT0;
  soundEngine.tick(1, ms(c0 + 80));
  soundEngine.tick(1.2, ms(c0 + 170));
  soundEngine.tick(1.4, ms(c0 + 260));
  soundEngine.beep(1600, 0.1, "square", 0.3, ms(c0 + 400));
  soundEngine.sweep(500, 1800, 0.3, ms(c0 + 520), hw.wifi ? 0.25 : 0.15, "sine");
  soundEngine.beep(hw.wifi ? 1500 : 300, 0.12, "square", 0.28, ms(c0 + 820));
  soundEngine.beep(900, 0.07, "triangle", 0.22, ms(c0 + 950));
  soundEngine.beep(hw.bt ? 1500 : 260, 0.14, "square", 0.28, ms(c0 + 1150));

  // DATA / SAVE / SYSTEM
  const d0 = T.DATA0;
  const dLen = (T.DATA_END - T.DATA0) / 4;
  for (let i = 0; i < 4; i++) {
    soundEngine.tick(1 + i * 0.1, ms(d0 + i * dLen + 40));
    soundEngine.beep(1100 + i * 100, 0.06, "square", 0.22, ms(d0 + i * dLen + 140));
  }

  // RACE — countdown + launch
  const r0 = T.RACE0;
  soundEngine.beep(700, 0.12, "square", 0.3, ms(r0 + 60)); // 3
  soundEngine.beep(700, 0.12, "square", 0.3, ms(r0 + 420)); // 2
  soundEngine.beep(700, 0.12, "square", 0.3, ms(r0 + 780)); // 1
  soundEngine.beep(1400, 0.28, "square", 0.4, ms(r0 + 1140)); // GO
  soundEngine.sweep(200, 2200, 0.5, ms(r0 + 1180), 0.35, "sawtooth"); // launch
  soundEngine.noiseBurst(0.25, 0.3, ms(T.RACE_END - 140));

  // LOGO explosion — silence then BOOM then signature
  soundEngine.noiseBurst(0.3, 0.4, ms(T.LOGO0 + 80), 1600);
  soundEngine.signature(ms(T.LOGO0 + 260), 0.32);
}
