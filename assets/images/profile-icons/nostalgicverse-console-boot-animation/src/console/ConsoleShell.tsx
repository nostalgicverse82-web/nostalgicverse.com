import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveData } from "./hooks/useSaveData";
import { useUnifiedInput } from "./hooks/useUnifiedInput";
import { AccentContext, THEME_COLORS } from "./ui/theme";
import OLEDFrame from "./ui/OLEDFrame";
import Keypad from "./ui/Keypad";
import { ACHIEVEMENTS, SystemState } from "./types";
import { soundEngine } from "./audio/soundEngine";

import BootIntro from "./screens/BootIntro";
import MainMenu from "./screens/MainMenu";
import GameLibrary from "./screens/GameLibrary";
import Arcade from "./screens/Arcade";
import MusicPlayer from "./screens/MusicPlayer";
import ClockScreen from "./screens/ClockScreen";
import Utilities from "./screens/Utilities";
import Achievements from "./screens/Achievements";
import Statistics from "./screens/Statistics";
import Devices from "./screens/Devices";
import WiFiScreen from "./screens/WiFiScreen";
import SaveData from "./screens/SaveData";
import Settings from "./screens/Settings";
import PixelQuest from "./games/PixelQuest";
import AlienSiege from "./games/AlienSiege";

export default function ConsoleShell() {
  const { data, update, resetSave, newlyUnlocked, clearNewlyUnlocked } = useSaveData();
  const inputRef = useUnifiedInput();
  const [screen, setScreen] = useState<SystemState>(
    data.settings.startupAnimation ? SystemState.BOOT_INTRO : SystemState.MAIN_MENU,
  );
  const launchOrigin = useRef<SystemState>(SystemState.MAIN_MENU);

  const accent = THEME_COLORS[data.settings.theme]?.fg ?? THEME_COLORS.cyan.fg;

  // Prevent any "just pressed" edge (e.g. the Enter key that dismissed the
  // boot intro) from leaking into the very next screen's input handling.
  useEffect(() => {
    inputRef.current?.consumeJust();
  }, [screen, inputRef]);

  // Make sure the audio engine is live even if the user skipped/disabled
  // the boot intro (browsers require a user gesture to start audio).
  useEffect(() => {
    const wake = () => {
      soundEngine.init();
      soundEngine.resume();
      soundEngine.setMuted(!data.settings.soundOn);
      soundEngine.setVolume(data.settings.volume);
    };
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (screen !== SystemState.BOOT_INTRO) {
        update((d) => {
          d.stats.totalPlaytimeMs += 1000;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [screen, update]);

  const navigate = useCallback((s: SystemState) => {
    if (s === SystemState.GAME_PIXEL_QUEST || s === SystemState.GAME_ALIEN_SIEGE) {
      // remember where we came from so B returns to the right library screen
    }
    setScreen(s);
  }, []);

  const goFromMenu = (s: SystemState, origin: SystemState) => {
    launchOrigin.current = origin;
    setScreen(s);
  };

  const backToMenu = () => setScreen(SystemState.MAIN_MENU);
  const backToOrigin = () => setScreen(launchOrigin.current);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (newlyUnlocked.length === 0) return;
    const id = newlyUnlocked[0];
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    setToast(ach ? ach.name : null);
    const t = setTimeout(() => {
      setToast(null);
      clearNewlyUnlocked();
    }, 2200);
    return () => clearTimeout(t);
  }, [newlyUnlocked, clearNewlyUnlocked]);

  const isGame = screen === SystemState.GAME_PIXEL_QUEST || screen === SystemState.GAME_ALIEN_SIEGE;
  const wifi = typeof navigator !== "undefined" ? navigator.onLine : true;
  const bt = typeof navigator !== "undefined" && "bluetooth" in navigator;

  function renderScreen() {
    switch (screen) {
      case SystemState.BOOT_INTRO:
        return <BootIntro settings={data.settings} onFinish={backToMenu} />;
      case SystemState.MAIN_MENU:
        return <MainMenu inputRef={inputRef} onNavigate={(s) => navigate(s)} wifi={wifi} bt={bt} />;
      case SystemState.GAME_LIBRARY:
        return (
          <GameLibrary
            inputRef={inputRef}
            data={data}
            wifi={wifi}
            bt={bt}
            onBack={backToMenu}
            onNavigate={(s) => goFromMenu(s, SystemState.GAME_LIBRARY)}
          />
        );
      case SystemState.ARCADE:
        return (
          <Arcade
            inputRef={inputRef}
            wifi={wifi}
            bt={bt}
            onBack={backToMenu}
            onNavigate={(s) => goFromMenu(s, SystemState.ARCADE)}
          />
        );
      case SystemState.MUSIC_PLAYER:
        return <MusicPlayer inputRef={inputRef} onBack={backToMenu} wifi={wifi} bt={bt} />;
      case SystemState.CLOCK:
        return <ClockScreen inputRef={inputRef} onBack={backToMenu} wifi={wifi} bt={bt} />;
      case SystemState.UTILITIES:
        return <Utilities inputRef={inputRef} onBack={backToMenu} wifi={wifi} bt={bt} />;
      case SystemState.ACHIEVEMENTS:
        return <Achievements inputRef={inputRef} onBack={backToMenu} data={data} wifi={wifi} bt={bt} />;
      case SystemState.STATISTICS:
        return <Statistics inputRef={inputRef} onBack={backToMenu} data={data} wifi={wifi} bt={bt} />;
      case SystemState.DEVICES:
        return <Devices inputRef={inputRef} onBack={backToMenu} wifi={wifi} bt={bt} />;
      case SystemState.WIFI:
        return <WiFiScreen inputRef={inputRef} onBack={backToMenu} wifi={wifi} bt={bt} />;
      case SystemState.SAVE_DATA:
        return <SaveData inputRef={inputRef} onBack={backToMenu} data={data} resetSave={resetSave} wifi={wifi} bt={bt} />;
      case SystemState.SETTINGS:
        return (
          <Settings
            inputRef={inputRef}
            onBack={backToMenu}
            data={data}
            update={update}
            onReplayBoot={() => setScreen(SystemState.BOOT_INTRO)}
            wifi={wifi}
            bt={bt}
          />
        );
      case SystemState.GAME_PIXEL_QUEST:
        return (
          <PixelQuest
            inputRef={inputRef}
            onExit={backToOrigin}
            onResult={({ score, win, coins }) => {
              update((d) => {
                const g = d.games.pixelQuest;
                g.timesPlayed += 1;
                g.highScore = Math.max(g.highScore, score);
                d.stats.coinsCollected += coins;
                void win;
              });
            }}
          />
        );
      case SystemState.GAME_ALIEN_SIEGE:
        return (
          <AlienSiege
            inputRef={inputRef}
            onExit={backToOrigin}
            onResult={({ score, win }) => {
              update((d) => {
                const g = d.games.alienSiege;
                g.timesPlayed += 1;
                g.highScore = Math.max(g.highScore, score);
                void win;
              });
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <AccentContext.Provider value={accent}>
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_top,_#1a1f2e,_#05060a_70%)] p-4 py-10 text-white">
        <header className="text-center">
          <h1 className="font-['Press_Start_2P'] text-[13px] tracking-widest text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] sm:text-base">
            NOSTALGICVERSE
          </h1>
          <p className="mt-2 font-['VT323'] text-lg tracking-[0.3em] text-zinc-400">MINI CONSOLE — WEB SIMULATOR</p>
        </header>

        <div className="relative w-full max-w-[640px] rounded-[26px] border border-zinc-700/80 bg-gradient-to-b from-zinc-800 via-zinc-850 to-zinc-900 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-7">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-zinc-600" />
              ))}
            </div>
            <button
              onClick={() => setScreen(SystemState.BOOT_INTRO)}
              title="Power cycle"
              className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.8)]"
            />
          </div>

          <div className="relative">
            {isGame ? (
              renderScreen()
            ) : (
              <OLEDFrame accent={accent} contrast={data.settings.contrast}>
                {renderScreen()}
              </OLEDFrame>
            )}
            {toast && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/85 px-3 py-1 font-['VT323'] text-sm text-amber-300 shadow-lg">
                🏆 ACHIEVEMENT: {toast}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 px-1">
            <div className="font-['VT323'] text-[11px] tracking-widest text-zinc-500">ESP32 · OLED · DS1307 · WiFi · BLE</div>
            <Keypad inputRef={inputRef} accent="#a7f3d0" />
          </div>
        </div>

        <p className="max-w-[640px] text-center font-['VT323'] text-sm text-zinc-500">
          Keyboard: Arrows/WASD move · Z/Space/Enter = A · X/Shift = B · P = Start · Click the power dot to reboot.
        </p>
      </div>
    </AccentContext.Provider>
  );
}
