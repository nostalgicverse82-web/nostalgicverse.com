import { useEffect, useRef, useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const TABS = ["CLOCK", "STOPWATCH", "TIMER"] as const;

function fmt(ms: number) {
  const totalMs = Math.max(0, ms);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const cs = Math.floor((totalMs % 1000) / 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export default function ClockScreen({
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
  const [now, setNow] = useState(new Date());
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0);
  const swStart = useRef(0);
  const [timerTotal, setTimerTotal] = useState(60000);
  const [timerLeft, setTimerLeft] = useState(60000);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStart = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!swRunning) return;
    const id = setInterval(() => setSwElapsed(performance.now() - swStart.current), 30);
    return () => clearInterval(id);
  }, [swRunning]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      const left = timerTotal - (performance.now() - timerStart.current);
      if (left <= 0) {
        setTimerLeft(0);
        setTimerRunning(false);
        soundEngine.beep(1500, 0.3, "square", 0.3);
      } else {
        setTimerLeft(left);
      }
    }, 30);
    return () => clearInterval(id);
  }, [timerRunning, timerTotal]);

  usePolledInput(
    inputRef,
    {
      onLeft: () => setTab((v) => (v - 1 + TABS.length) % TABS.length),
      onRight: () => setTab((v) => (v + 1) % TABS.length),
      onA: () => {
        if (tab === 1) {
          if (swRunning) {
            setSwRunning(false);
          } else {
            swStart.current = performance.now() - swElapsed;
            setSwRunning(true);
          }
          soundEngine.click();
        } else if (tab === 2) {
          if (timerRunning) {
            setTimerRunning(false);
          } else {
            timerStart.current = performance.now() - (timerTotal - timerLeft);
            setTimerRunning(true);
          }
          soundEngine.click();
        }
      },
      onB: () => {
        if (tab === 1) {
          setSwRunning(false);
          setSwElapsed(0);
        } else if (tab === 2) {
          setTimerRunning(false);
          setTimerLeft(timerTotal);
        } else {
          onBack();
        }
      },
      onUp: () => {
        if (tab === 2 && !timerRunning) {
          setTimerTotal((v) => Math.min(599000, v + 30000));
          setTimerLeft((v) => Math.min(599000, v + 30000));
        }
      },
      onDown: () => {
        if (tab === 2 && !timerRunning) {
          setTimerTotal((v) => Math.max(10000, v - 30000));
          setTimerLeft((v) => Math.max(10000, v - 30000));
        }
      },
    },
    [tab, swRunning, swElapsed, timerRunning, timerLeft, timerTotal],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="CLOCK" wifi={wifi} bt={bt} />
      <div className="flex justify-center gap-3 pt-1 font-['VT323'] text-[12px] opacity-80">
        {TABS.map((t, i) => (
          <span key={t} className={i === tab ? "border-b border-current" : "opacity-50"}>
            {t}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center font-['VT323']">
        {tab === 0 && (
          <>
            <div className="text-[34px] tracking-widest">
              {now.getHours().toString().padStart(2, "0")}:{now.getMinutes().toString().padStart(2, "0")}:
              {now.getSeconds().toString().padStart(2, "0")}
            </div>
            <div className="text-[14px] opacity-70">
              {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
            </div>
            <div className="mt-1 text-[10px] opacity-50">DS1307 RTC — LIVE SYSTEM TIME</div>
          </>
        )}
        {tab === 1 && (
          <>
            <div className="text-[30px] tracking-wider">{fmt(swElapsed)}</div>
            <div className="mt-1 text-[11px] opacity-60">A {swRunning ? "STOP" : "START"} &nbsp; B RESET</div>
          </>
        )}
        {tab === 2 && (
          <>
            <div className="text-[30px] tracking-wider">{fmt(timerLeft)}</div>
            <div className="mt-1 text-[11px] opacity-60">
              ▲▼ ADJUST &nbsp; A {timerRunning ? "PAUSE" : "START"} &nbsp; B RESET
            </div>
          </>
        )}
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ◀▶ TAB &nbsp; A/B ACTIONS
      </div>
    </div>
  );
}
