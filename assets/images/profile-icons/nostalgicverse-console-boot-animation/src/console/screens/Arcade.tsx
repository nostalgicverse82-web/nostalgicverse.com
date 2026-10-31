import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { SystemState } from "../types";
import { soundEngine } from "../audio/soundEngine";

const TILES = [
  { id: SystemState.GAME_PIXEL_QUEST, icon: "🟢", label: "PIXEL QUEST", locked: false },
  { id: SystemState.GAME_ALIEN_SIEGE, icon: "🛸", label: "ALIEN SIEGE", locked: false },
  { id: null, icon: "🏎", label: "FQ RACING", locked: true },
  { id: null, icon: "🧩", label: "PUZZLE", locked: true },
  { id: null, icon: "🐍", label: "SNAKE", locked: true },
  { id: null, icon: "⚡", label: "REACTION", locked: true },
];

export default function Arcade({
  inputRef,
  onNavigate,
  onBack,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onNavigate: (s: SystemState) => void;
  onBack: () => void;
  wifi: boolean;
  bt: boolean;
}) {
  const [sel, setSel] = useState(0);
  const cols = 3;

  usePolledInput(
    inputRef,
    {
      onLeft: () => setSel((v) => (v - 1 + TILES.length) % TILES.length),
      onRight: () => setSel((v) => (v + 1) % TILES.length),
      onUp: () => setSel((v) => (v - cols + TILES.length) % TILES.length),
      onDown: () => setSel((v) => (v + cols) % TILES.length),
      onA: () => {
        const t = TILES[sel];
        if (t.locked || !t.id) {
          soundEngine.beep(220, 0.1, "square", 0.25);
          return;
        }
        soundEngine.signature(0, 0.3);
        onNavigate(t.id);
      },
      onB: () => onBack(),
    },
    [sel],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="ARCADE" wifi={wifi} bt={bt} />
      <div className="grid flex-1 grid-cols-3 gap-1 p-2 font-['VT323']">
        {TILES.map((t, i) => (
          <div
            key={t.label}
            className={`flex flex-col items-center justify-center gap-1 rounded-sm border text-center ${
              i === sel ? "border-current bg-current/20" : "border-current/30"
            } ${t.locked ? "opacity-40" : ""}`}
          >
            <span className="text-[20px]">{t.icon}</span>
            <span className="text-[11px] leading-none">{t.locked ? "LOCKED" : t.label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ◀▶▲▼ MOVE &nbsp; A PLAY &nbsp; B BACK
      </div>
    </div>
  );
}
