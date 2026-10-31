import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { ConsoleSaveData } from "../types";

function fmtPlaytime(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export default function Statistics({
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
  usePolledInput(inputRef, { onB: () => onBack() }, []);

  const totalPlays = data.games.pixelQuest.timesPlayed + data.games.alienSiege.timesPlayed;
  const bars = [
    { label: "PIXEL QUEST", value: data.games.pixelQuest.highScore, max: 1000 },
    { label: "ALIEN SIEGE", value: data.games.alienSiege.highScore, max: 1000 },
  ];

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="STATISTICS" wifi={wifi} bt={bt} />
      <div className="flex-1 space-y-2 overflow-hidden px-3 py-2 font-['VT323'] text-[13px]">
        <div>TOTAL PLAYTIME: {fmtPlaytime(data.stats.totalPlaytimeMs)}</div>
        <div>SESSIONS (BOOTS): {data.stats.sessionsCount}</div>
        <div>GAMES PLAYED: {totalPlays}</div>
        <div>COINS COLLECTED: {data.stats.coinsCollected}</div>
        <div className="pt-1">HIGH SCORES</div>
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-[80px] text-[11px] opacity-80">{b.label}</span>
            <div className="h-[8px] flex-1 border border-current/50">
              <div className="h-full bg-current/70" style={{ width: `${Math.min(100, (b.value / b.max) * 100)}%` }} />
            </div>
            <span className="w-[32px] text-right text-[11px]">{b.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">B BACK</div>
    </div>
  );
}
