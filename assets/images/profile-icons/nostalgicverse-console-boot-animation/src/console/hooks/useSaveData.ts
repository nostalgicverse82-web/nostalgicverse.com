import { useCallback, useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS, ConsoleSaveData, DEFAULT_SAVE } from "../types";

const KEY = "nostalgicverse.save.v1";

function load(): ConsoleSaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw);
    // shallow-merge to survive schema additions
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
      stats: { ...DEFAULT_SAVE.stats, ...parsed.stats },
      games: {
        pixelQuest: { ...DEFAULT_SAVE.games.pixelQuest, ...parsed.games?.pixelQuest },
        alienSiege: { ...DEFAULT_SAVE.games.alienSiege, ...parsed.games?.alienSiege },
      },
      achievementsUnlocked: parsed.achievementsUnlocked ?? [],
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function useSaveData() {
  const [data, setData] = useState<ConsoleSaveData>(() => {
    const d = load();
    d.stats.sessionsCount += 1;
    return d;
  });
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full / unavailable — fail silently, console stays usable */
    }
  }, [data]);

  const checkAchievements = useCallback((s: ConsoleSaveData): ConsoleSaveData => {
    const unlocked = new Set(s.achievementsUnlocked);
    const fresh: string[] = [];
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.has(a.id) && a.check(s)) {
        unlocked.add(a.id);
        fresh.push(a.id);
      }
    }
    if (fresh.length) {
      setNewlyUnlocked((prev) => [...prev, ...fresh]);
      return { ...s, achievementsUnlocked: Array.from(unlocked) };
    }
    return s;
  }, []);

  const update = useCallback(
    (mutator: (draft: ConsoleSaveData) => void) => {
      setData((prev) => {
        const next = structuredClone(prev);
        mutator(next);
        return checkAchievements(next);
      });
    },
    [checkAchievements],
  );

  const resetSave = useCallback(() => {
    const fresh = structuredClone(DEFAULT_SAVE);
    fresh.stats.sessionsCount = 1;
    setData(fresh);
  }, []);

  const clearNewlyUnlocked = useCallback(() => setNewlyUnlocked([]), []);

  return { data, update, resetSave, newlyUnlocked, clearNewlyUnlocked };
}
