import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { ConsoleSaveData, ConsoleSettings } from "../types";
import { soundEngine } from "../audio/soundEngine";

const THEMES: ConsoleSettings["theme"][] = ["cyan", "amber", "green", "white"];

export default function Settings({
  inputRef,
  onBack,
  data,
  update,
  onReplayBoot,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onBack: () => void;
  data: ConsoleSaveData;
  update: (fn: (d: ConsoleSaveData) => void) => void;
  onReplayBoot: () => void;
  wifi: boolean;
  bt: boolean;
}) {
  const s = data.settings;
  const rows = [
    { id: "startup", label: "STARTUP ANIMATION", value: s.startupAnimation ? "ON" : "OFF" },
    { id: "sound", label: "SOUND", value: s.soundOn ? "ON" : "OFF" },
    { id: "volume", label: "VOLUME", value: `${Math.round(s.volume * 100)}%` },
    { id: "theme", label: "SCREEN THEME", value: s.theme.toUpperCase() },
    { id: "contrast", label: "CONTRAST", value: `${Math.round(s.contrast * 100)}%` },
    { id: "dev", label: "DEVELOPER MODE", value: s.developerMode ? "ON" : "OFF" },
    ...(s.developerMode ? [{ id: "replay", label: "REPLAY BOOT INTRO", value: "▶" }] : []),
  ];
  const [sel, setSel] = useState(0);

  const adjust = (dir: 1 | -1) => {
    const id = rows[sel].id;
    update((d) => {
      const st = d.settings;
      if (id === "startup") st.startupAnimation = !st.startupAnimation;
      if (id === "sound") {
        st.soundOn = !st.soundOn;
        soundEngine.setMuted(!st.soundOn);
      }
      if (id === "volume") {
        st.volume = Math.max(0, Math.min(1, st.volume + dir * 0.1));
        soundEngine.setVolume(st.volume);
      }
      if (id === "theme") {
        const idx = THEMES.indexOf(st.theme);
        st.theme = THEMES[(idx + dir + THEMES.length) % THEMES.length];
      }
      if (id === "contrast") st.contrast = Math.max(0.6, Math.min(1.4, st.contrast + dir * 0.1));
      if (id === "dev") st.developerMode = !st.developerMode;
    });
    soundEngine.click();
  };

  usePolledInput(
    inputRef,
    {
      onUp: () => setSel((v) => (v - 1 + rows.length) % rows.length),
      onDown: () => setSel((v) => (v + 1) % rows.length),
      onLeft: () => adjust(-1),
      onRight: () => adjust(1),
      onA: () => {
        if (rows[sel].id === "replay") onReplayBoot();
        else adjust(1);
      },
      onB: () => onBack(),
    },
    [sel, rows.length],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="SETTINGS" wifi={wifi} bt={bt} />
      <div className="flex-1 space-y-1 overflow-hidden px-2 py-1 font-['VT323'] text-[13px]">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center justify-between px-1 ${i === sel ? "bg-current/20" : ""}`}>
            <span>
              {i === sel ? "▶ " : "  "}
              {r.label}
            </span>
            <span className="opacity-80">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ SELECT &nbsp; ◀▶/A CHANGE &nbsp; B BACK
      </div>
    </div>
  );
}
