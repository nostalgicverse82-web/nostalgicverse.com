import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";

const BT_SUPPORTED = typeof navigator !== "undefined" && "bluetooth" in navigator;

export default function Devices({
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
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [connected, setConnected] = useState<string | null>(null);
  const [sel, setSel] = useState(0);

  const scan = () => {
    if (scanning) return;
    setScanning(true);
    setFound([]);
    soundEngine.sweep(500, 1600, 0.4, 0, 0.2, "sine");
    window.setTimeout(() => {
      setFound(["COSMIC BYTE LUMORA", "GENERIC BLE PAD"]);
      setScanning(false);
      soundEngine.beep(1300, 0.1, "square", 0.25);
    }, 1400);
  };

  const list = found;
  usePolledInput(
    inputRef,
    {
      onUp: () => setSel((v) => Math.max(0, v - 1)),
      onDown: () => setSel((v) => Math.min(list.length, v + 1)),
      onA: () => {
        if (sel === list.length) {
          scan();
          return;
        }
        if (list[sel]) {
          const name = list[sel];
          setConnected((c) => (c === name ? null : name));
          soundEngine.beep(connected === list[sel] ? 300 : 1500, 0.12, "square", 0.3);
        }
      },
      onB: () => onBack(),
    },
    [sel, list, connected, scanning],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="DEVICES" wifi={wifi} bt={bt} />
      <div className="flex-1 space-y-1 overflow-hidden px-2 py-1 font-['VT323'] text-[12px]">
        <div className="opacity-80">⌨ KEYPAD — ACTIVE (BUILT-IN)</div>
        <div className="opacity-80">📱 MOBILE CONTROLLER — READY (LOCAL WIFI)</div>
        <div className="pt-1 opacity-90">🎮 BLUETOOTH {BT_SUPPORTED ? "" : "(UNSUPPORTED ON THIS BROWSER)"}</div>
        {found.map((name, i) => (
          <div key={name} className={`flex items-center gap-2 pl-3 ${sel === i ? "bg-current/20" : ""}`}>
            <span>{i === sel ? "▶" : " "}</span>
            <span>{name}</span>
            {connected === name && <span className="text-[10px] opacity-80">CONNECTED ✓</span>}
          </div>
        ))}
        <div className={`flex items-center gap-2 pl-3 ${sel === list.length ? "bg-current/20" : ""}`}>
          <span>{sel === list.length ? "▶" : " "}</span>
          <span>{scanning ? "SCANNING..." : "SCAN FOR DEVICES"}</span>
        </div>
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ SELECT &nbsp; A CONNECT/SCAN &nbsp; B BACK
      </div>
    </div>
  );
}
