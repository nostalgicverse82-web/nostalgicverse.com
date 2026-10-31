import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { ConsoleSaveData, SystemState } from "../types";
import { soundEngine } from "../audio/soundEngine";

const GAMES = [
  {
    id: SystemState.GAME_PIXEL_QUEST,
    key: "pixelQuest" as const,
    title: "PIXEL QUEST",
    icon: "🟢",
    desc: "Jump, dash & collect coins across a vivid platforming world.",
  },
  {
    id: SystemState.GAME_ALIEN_SIEGE,
    key: "alienSiege" as const,
    title: "ALIEN SIEGE",
    icon: "🛸",
    desc: "Run-and-gun through relentless waves of alien invaders.",
  },
];

export default function GameLibrary({
  inputRef,
  onNavigate,
  onBack,
  data,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onNavigate: (s: SystemState) => void;
  onBack: () => void;
  data: ConsoleSaveData;
  wifi: boolean;
  bt: boolean;
}) {
  const [sel, setSel] = useState(0);

  usePolledInput(
    inputRef,
    {
      onUp: () => {
        setSel((v) => (v - 1 + GAMES.length) % GAMES.length);
        soundEngine.click();
      },
      onDown: () => {
        setSel((v) => (v + 1) % GAMES.length);
        soundEngine.click();
      },
      onA: () => {
        soundEngine.signature(0, 0.3);
        onNavigate(GAMES[sel].id);
      },
      onB: () => onBack(),
    },
    [sel],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="GAME LIBRARY" wifi={wifi} bt={bt} />
      <div className="min-h-0 flex-1 space-y-1 overflow-hidden px-2 py-1 font-['VT323']">
        {GAMES.map((g, i) => {
          const stats = data.games[g.key];
          return (
            <div
              key={g.id}
              className={`rounded-sm px-2 py-1 text-[14px] leading-tight ${i === sel ? "bg-current/20" : ""}`}
            >
              <div className="flex items-center gap-2 text-[16px]">
                <span className="inline-block w-3">{i === sel ? "▶" : ""}</span>
                <span>{g.icon}</span>
                <span className="tracking-wide">{g.title}</span>
              </div>
              <div className="pl-7 text-[12px] opacity-70">{g.desc}</div>
              <div className="pl-7 text-[12px] opacity-90">
                HIGH SCORE {stats.highScore} &nbsp; PLAYS {stats.timesPlayed}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ SELECT &nbsp; A PLAY &nbsp; B BACK
      </div>
    </div>
  );
}
