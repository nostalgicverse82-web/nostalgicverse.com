import { useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { soundEngine } from "../audio/soundEngine";

export default function WiFiScreen({
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
  const [apMode, setApMode] = useState(true);
  const [sel, setSel] = useState(0);

  const items = ["TOGGLE AP MODE", "RESCAN NETWORKS"];

  usePolledInput(
    inputRef,
    {
      onUp: () => setSel((v) => (v - 1 + items.length) % items.length),
      onDown: () => setSel((v) => (v + 1) % items.length),
      onA: () => {
        if (sel === 0) {
          setApMode((v) => !v);
          soundEngine.click();
        } else {
          soundEngine.sweep(400, 1200, 0.3, 0, 0.2);
        }
      },
      onB: () => onBack(),
    },
    [sel],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="WI-FI MANAGER" wifi={wifi} bt={bt} />
      <div className="flex-1 space-y-2 px-3 py-2 font-['VT323'] text-[13px]">
        <div>LINK STATUS: {wifi ? "ONLINE" : "OFFLINE"}</div>
        <div>MODE: {apMode ? "ACCESS POINT (AP)" : "CLIENT"}</div>
        {apMode && (
          <>
            <div>SSID: NostalgicVerse-AP</div>
            <div className="text-[11px] opacity-70">
              📱 PHONE → WIFI → CONSOLE
              <br />
              Connect a phone to this network to use the browser-based mobile controller — no app required.
            </div>
          </>
        )}
        <div className="pt-2 space-y-1">
          {items.map((it, i) => (
            <div key={it} className={`px-1 ${i === sel ? "bg-current/20" : ""}`}>
              {i === sel ? "▶ " : "  "}
              {it}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ SELECT &nbsp; A TOGGLE/SCAN &nbsp; B BACK
      </div>
    </div>
  );
}
