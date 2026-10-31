// Core shared types for the NostalgicVerse Mini Console simulator.
// Mirrors the architecture described for the real ESP32 firmware:
// one unified SystemState drives the whole OS, and input is abstracted
// behind a single interface regardless of physical source (keypad / mobile / BT).

export enum SystemState {
  BOOT_INTRO = "BOOT_INTRO",
  MAIN_MENU = "MAIN_MENU",
  GAME_LIBRARY = "GAME_LIBRARY",
  ARCADE = "ARCADE",
  MUSIC_PLAYER = "MUSIC_PLAYER",
  CLOCK = "CLOCK",
  UTILITIES = "UTILITIES",
  ACHIEVEMENTS = "ACHIEVEMENTS",
  STATISTICS = "STATISTICS",
  DEVICES = "DEVICES",
  WIFI = "WIFI",
  SAVE_DATA = "SAVE_DATA",
  SETTINGS = "SETTINGS",
  GAME_PIXEL_QUEST = "GAME_PIXEL_QUEST",
  GAME_ALIEN_SIEGE = "GAME_ALIEN_SIEGE",
}

// Unified input abstraction — the real firmware would populate this same
// struct from the 4x4 keypad, the WiFi mobile controller, or a BLE gamepad.
export interface InputFrame {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean; // confirm / jump / fire
  b: boolean; // back / cancel / alt-fire
  start: boolean; // pause / press-start
  select: boolean; // menu toggle
  justUp: boolean;
  justDown: boolean;
  justLeft: boolean;
  justRight: boolean;
  justA: boolean;
  justB: boolean;
  justStart: boolean;
  justSelect: boolean;
}

export type InputSource = "KEYPAD" | "MOBILE" | "BLUETOOTH";

export interface ConsoleSettings {
  startupAnimation: boolean;
  soundOn: boolean;
  volume: number;
  theme: "cyan" | "amber" | "green" | "white";
  contrast: number;
  developerMode: boolean;
}

export interface GameStats {
  highScore: number;
  timesPlayed: number;
  bestTime: number | null;
  totalPlaytimeMs: number;
}

export interface ConsoleSaveData {
  settings: ConsoleSettings;
  stats: {
    totalPlaytimeMs: number;
    sessionsCount: number;
    coinsCollected: number;
    firstBootAt: number;
  };
  games: {
    pixelQuest: GameStats;
    alienSiege: GameStats;
  };
  achievementsUnlocked: string[];
}

export const DEFAULT_SAVE: ConsoleSaveData = {
  settings: {
    startupAnimation: true,
    soundOn: true,
    volume: 0.5,
    theme: "cyan",
    contrast: 1,
    developerMode: false,
  },
  stats: {
    totalPlaytimeMs: 0,
    sessionsCount: 0,
    coinsCollected: 0,
    firstBootAt: Date.now(),
  },
  games: {
    pixelQuest: { highScore: 0, timesPlayed: 0, bestTime: null, totalPlaytimeMs: 0 },
    alienSiege: { highScore: 0, timesPlayed: 0, bestTime: null, totalPlaytimeMs: 0 },
  },
  achievementsUnlocked: [],
};

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: (s: ConsoleSaveData) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "FIRST_BOOT", name: "FIRST BOOT", desc: "Power on the console for the first time.", check: () => true },
  { id: "FIRST_GAME", name: "FIRST GAME", desc: "Play any game once.", check: (s) => s.games.pixelQuest.timesPlayed + s.games.alienSiege.timesPlayed > 0 },
  { id: "HIGH_SCORER", name: "HIGH SCORER", desc: "Score 500+ in any game.", check: (s) => s.games.pixelQuest.highScore >= 500 || s.games.alienSiege.highScore >= 500 },
  { id: "COIN_100", name: "100 COINS", desc: "Collect 100 coins in Pixel Quest.", check: (s) => s.stats.coinsCollected >= 100 },
  { id: "ALIEN_HUNTER", name: "ALIEN HUNTER", desc: "Score 300+ in Alien Siege.", check: (s) => s.games.alienSiege.highScore >= 300 },
  { id: "DEDICATED", name: "DEDICATED", desc: "Play for a total of 5 minutes.", check: (s) => s.stats.totalPlaytimeMs >= 5 * 60 * 1000 },
  { id: "TEN_SESSIONS", name: "REGULAR", desc: "Boot the console 10 times.", check: (s) => s.stats.sessionsCount >= 10 },
  { id: "SECRET", name: "???", desc: "Find the secret.", check: (s) => s.games.pixelQuest.highScore >= 1000 },
];
