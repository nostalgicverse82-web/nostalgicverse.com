import { useEffect, useRef, useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";

const TABS = ["CALC", "DICE", "COIN", "RANDOM", "REACTION"] as const;
const OPS = ["+", "-", "×", "÷"];

export default function Utilities({
  inputRef,
  onBack,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onBack: () => void;
  wifi: boolean;
  bt: boolean;
}) {
  const [tab, setTab] = useState(0);

  // calc
  const [a, setA] = useState(5);
  const [b, setB] = useState(3);
  const [op, setOp] = useState(0);
  const [field, setField] = useState<0 | 1>(0);

  // dice / coin / random
  const [die, setDie] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [coin, setCoin] = useState<"HEADS" | "TAILS" | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [maxRand, setMaxRand] = useState(100);
  const [rand, setRand] = useState<number | null>(null);

  // reaction
  const [reactState, setReactState] = useState<"idle" | "waiting" | "go" | "result" | "early">("idle");
  const [reactMs, setReactMs] = useState<number | null>(null);
  const reactTimer = useRef<number | null>(null);
  const reactStartAt = useRef(0);

  const result = (() => {
    switch (OPS[op]) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      default:
        return b === 0 ? NaN : +(a / b).toFixed(2);
    }
  })();

  const rollDie = () => {
    setRolling(true);
    soundEngine.tick(1);
    let n = 0;
    const id = setInterval(() => {
      setDie(1 + Math.floor(Math.random() * 6));
      n++;
      if (n > 8) {
        clearInterval(id);
        setRolling(false);
        soundEngine.beep(900, 0.1, "square", 0.3);
      }
    }, 60);
  };

  const flipCoin = () => {
    setFlipping(true);
    soundEngine.tick(1.2);
    let n = 0;
    const id = setInterval(() => {
      setCoin(Math.random() < 0.5 ? "HEADS" : "TAILS");
      n++;
      if (n > 8) {
        clearInterval(id);
        setFlipping(false);
        soundEngine.beep(1100, 0.1, "square", 0.3);
      }
    }, 60);
  };

  const rollRandom = () => {
    setRand(1 + Math.floor(Math.random() * maxRand));
    soundEngine.click();
  };

  const startReaction = () => {
    setReactState("waiting");
    setReactMs(null);
    const delay = 800 + Math.random() * 2200;
    reactTimer.current = window.setTimeout(() => {
      reactStartAt.current = performance.now();
      setReactState("go");
      soundEngine.beep(1400, 0.1, "square", 0.3);
    }, delay);
  };

  const handleReactionPress = () => {
    if (reactState === "waiting") {
      if (reactTimer.current) clearTimeout(reactTimer.current);
      setReactState("early");
      soundEngine.beep(200, 0.2, "square", 0.3);
    } else if (reactState === "go") {
      setReactMs(Math.round(performance.now() - reactStartAt.current));
      setReactState("result");
      soundEngine.beep(1600, 0.08, "square", 0.3);
    } else {
      startReaction();
    }
  };

  useEffect(() => () => {
    if (reactTimer.current) clearTimeout(reactTimer.current);
  }, []);

  usePolledInput(
    inputRef,
    {
      onLeft: () => {
        if (tab === 0) setField(0);
        else setTab((v) => (v - 1 + TABS.length) % TABS.length);
      },
      onRight: () => {
        if (tab === 0) setField(1);
        else setTab((v) => (v + 1) % TABS.length);
      },
      onUp: () => {
        if (tab === 0) {
          if (field === 0) setA((v) => v + 1);
          else setB((v) => v + 1);
        } else if (tab === 3) setMaxRand((v) => Math.min(9999, v + 10));
      },
      onDown: () => {
        if (tab === 0) {
          if (field === 0) setA((v) => v - 1);
          else setB((v) => v - 1);
        } else if (tab === 3) setMaxRand((v) => Math.max(2, v - 10));
      },
      onA: () => {
        if (tab === 0) setOp((v) => (v + 1) % OPS.length);
        else if (tab === 1) rollDie();
        else if (tab === 2) flipCoin();
        else if (tab === 3) rollRandom();
        else if (tab === 4) handleReactionPress();
      },
      onB: () => onBack(),
      onSelect: () => setTab((v) => (v + 1) % TABS.length),
    },
    [tab, field, a, b, op, maxRand, reactState],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="UTILITIES" wifi={wifi} bt={bt} />
      <div className="flex justify-center gap-2 pt-1 font-['VT323'] text-[11px] opacity-80">
        {TABS.map((t, i) => (
          <span key={t} className={i === tab ? "border-b border-current" : "opacity-45"}>
            {t}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center font-['VT323']">
        {tab === 0 && (
          <div className="text-center text-[22px]">
            <span className={field === 0 ? "underline" : ""}>{a}</span> {OPS[op]}{" "}
            <span className={field === 1 ? "underline" : ""}>{b}</span> = {Number.isNaN(result) ? "ERR" : result}
            <div className="mt-1 text-[11px] opacity-60">◀▶ FIELD &nbsp; ▲▼ VALUE &nbsp; A CYCLE OP</div>
          </div>
        )}
        {tab === 1 && (
          <div className="text-center">
            <div className="text-[42px]">{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][die]}</div>
            <div className="text-[11px] opacity-60">{rolling ? "ROLLING..." : "A TO ROLL"}</div>
          </div>
        )}
        {tab === 2 && (
          <div className="text-center">
            <div className="text-[24px]">{flipping ? "..." : coin ?? "—"}</div>
            <div className="text-[11px] opacity-60">A TO FLIP</div>
          </div>
        )}
        {tab === 3 && (
          <div className="text-center text-[20px]">
            {rand ?? "—"}
            <div className="text-[11px] opacity-60">RANGE 1–{maxRand} &nbsp; ▲▼ RANGE &nbsp; A ROLL</div>
          </div>
        )}
        {tab === 4 && (
          <div className="text-center text-[16px]">
            {reactState === "idle" && <div>A TO START</div>}
            {reactState === "waiting" && <div className="opacity-70">WAIT...</div>}
            {reactState === "go" && <div className="text-[22px]">PRESS A!</div>}
            {reactState === "early" && <div>TOO SOON — A TO RETRY</div>}
            {reactState === "result" && (
              <div>
                {reactMs} ms
                <div className="text-[11px] opacity-60">A TO RETRY</div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        SELECT/◀▶ TAB &nbsp; B BACK
      </div>
    </div>
  );
}
