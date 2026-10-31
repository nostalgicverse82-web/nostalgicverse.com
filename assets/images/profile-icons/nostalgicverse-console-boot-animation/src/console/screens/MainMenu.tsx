import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import MenuList, { MenuItem } from "../ui/MenuList";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { SystemState } from "../types";
import { soundEngine } from "../audio/soundEngine";

const ITEMS: { id: SystemState; label: string; icon: string }[] = [
  { id: SystemState.GAME_LIBRARY, label: "GAME LIBRARY", icon: "🎮" },
  { id: SystemState.ARCADE, label: "ARCADE", icon: "👾" },
  { id: SystemState.MUSIC_PLAYER, label: "MUSIC PLAYER", icon: "♪" },
  { id: SystemState.CLOCK, label: "CLOCK", icon: "🕐" },
  { id: SystemState.UTILITIES, label: "UTILITIES", icon: "🧮" },
  { id: SystemState.ACHIEVEMENTS, label: "ACHIEVEMENTS", icon: "🏆" },
  { id: SystemState.STATISTICS, label: "STATISTICS", icon: "📊" },
  { id: SystemState.DEVICES, label: "DEVICES", icon: "📡" },
  { id: SystemState.WIFI, label: "WI-FI", icon: "📶" },
  { id: SystemState.SAVE_DATA, label: "SAVE DATA", icon: "💾" },
  { id: SystemState.SETTINGS, label: "SETTINGS", icon: "⚙" },
];

export default function MainMenu({
  inputRef,
  onNavigate,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onNavigate: (s: SystemState) => void;
  wifi: boolean;
  bt: boolean;
}) {
  const [sel, setSel] = useState(0);

  usePolledInput(
    inputRef,
    {
      onUp: () => {
        setSel((v) => (v - 1 + ITEMS.length) % ITEMS.length);
        soundEngine.click();
      },
      onDown: () => {
        setSel((v) => (v + 1) % ITEMS.length);
        soundEngine.click();
      },
      onA: () => {
        soundEngine.beep(1200, 0.06, "square", 0.25);
        onNavigate(ITEMS[sel].id);
      },
    },
    [sel],
  );

  const menuItems: MenuItem[] = ITEMS.map((it) => ({ id: it.id, label: it.label, icon: <span>{it.icon}</span> }));

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="NOSTALGICVERSE OS" wifi={wifi} bt={bt} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <MenuList items={menuItems} selected={sel} />
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ NAVIGATE &nbsp; A SELECT
      </div>
    </div>
  );
}
