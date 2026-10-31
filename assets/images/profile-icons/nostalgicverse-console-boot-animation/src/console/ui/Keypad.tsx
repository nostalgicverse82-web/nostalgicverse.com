import type { InputFrame } from "../types";
import type { UnifiedInput } from "../hooks/useUnifiedInput";

// Physical 4x4 membrane keypad. Mapping follows the classic feature-phone
// "2/4/6/8" directional convention so the same keys double as a numeric
// pad for the Utilities calculator in a future firmware revision.
const KEYS: { label: string; btn?: keyof InputFrame }[][] = [
  [{ label: "1" }, { label: "2", btn: "up" }, { label: "3" }, { label: "A", btn: "start" }],
  [{ label: "4", btn: "left" }, { label: "5", btn: "a" }, { label: "6", btn: "right" }, { label: "B", btn: "select" }],
  [{ label: "7" }, { label: "8", btn: "down" }, { label: "9" }, { label: "C" }],
  [{ label: "*", btn: "select" }, { label: "0", btn: "b" }, { label: "#", btn: "start" }, { label: "D" }],
];

export default function Keypad({ inputRef, accent }: { inputRef: React.RefObject<UnifiedInput>; accent: string }) {
  const press = (btn?: keyof InputFrame) => btn && inputRef.current?.press(btn);
  const release = (btn?: keyof InputFrame) => btn && inputRef.current?.release(btn);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {KEYS.flat().map((k, i) => (
        <button
          key={i}
          disabled={!k.btn}
          onPointerDown={(e) => {
            e.preventDefault();
            press(k.btn);
          }}
          onPointerUp={() => release(k.btn)}
          onPointerLeave={() => release(k.btn)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ color: accent, borderColor: `${accent}55` }}
          className="flex h-8 w-8 touch-none select-none items-center justify-center rounded-md border bg-zinc-900 font-['VT323'] text-sm active:bg-zinc-700 disabled:opacity-30 sm:h-9 sm:w-9"
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
