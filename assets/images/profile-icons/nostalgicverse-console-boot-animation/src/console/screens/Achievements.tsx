import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { ACHIEVEMENTS, ConsoleSaveData } from "../types";

export default function Achievements({
  inputRef,
  onBack,
  data,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onBack: () => void;
  data: ConsoleSaveData;
  wifi: boolean;
  bt: boolean;
}) {
  const [sel, setSel] = useState(0);
  usePolledInput(
    inputRef,
    {
      onUp: () => setSel((v) => (v - 1 + ACHIEVEMENTS.length) % ACHIEVEMENTS.length),
      onDown: () => setSel((v) => (v + 1) % ACHIEVEMENTS.length),
      onB: () => onBack(),
    },
    [sel],
  );
  const unlockedCount = data.achievementsUnlocked.length;

  return (
    <div className="flex h-full flex-col">
      <StatusBar title={`ACHIEVEMENTS ${unlockedCount}/${ACHIEVEMENTS.length}`} wifi={wifi} bt={bt} />
      <div className="min-h-0 flex-1 overflow-hidden px-2 py-1 font-['VT323'] text-[13px]">
        {ACHIEVEMENTS.map((ach, i) => {
          const unlocked = data.achievementsUnlocked.includes(ach.id);
          return (
            <div
              key={ach.id}
              className={`flex items-center gap-2 rounded-sm px-1 py-[2px] ${i === sel ? "bg-current/20" : ""} ${
                unlocked ? "" : "opacity-40"
              }`}
            >
              <span>{unlocked ? "🏆" : "🔒"}</span>
              <span className="flex-1">
                <div className="leading-none">{unlocked ? ach.name : "???"}</div>
                <div className="text-[10px] opacity-70">{unlocked ? ach.desc : "LOCKED"}</div>
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ BROWSE &nbsp; B BACK
      </div>
    </div>
  );
}
