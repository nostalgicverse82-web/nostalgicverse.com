import { useRef, useState } from "react";
import StatusBar from "../ui/StatusBar";
import { usePolledInput } from "../hooks/usePolledInput";
import type { UnifiedInput } from "../hooks/useUnifiedInput";
import { ConsoleSaveData } from "../types";
import { soundEngine } from "../audio/soundEngine";

export default function SaveData({
  inputRef,
  onBack,
  data,
  resetSave,
  wifi,
  bt,
}: {
  inputRef: React.RefObject<UnifiedInput>;
  onBack: () => void;
  data: ConsoleSaveData;
  resetSave: () => void;
  wifi: boolean;
  bt: boolean;
}) {
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const json = JSON.stringify(data);
  const sizeKb = (new Blob([json]).size / 1024).toFixed(2);

  const items = ["EXPORT SAVE FILE", "IMPORT SAVE FILE", "ERASE SAVE DATA"];

  const exportSave = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nostalgicverse-save.json";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("EXPORTED ✓");
    soundEngine.beep(1300, 0.1, "square", 0.3);
  };

  const importSave = () => fileRef.current?.click();

  usePolledInput(
    inputRef,
    {
      onUp: () => setSel((v) => (v - 1 + items.length) % items.length),
      onDown: () => setSel((v) => (v + 1) % items.length),
      onA: () => {
        if (sel === 0) exportSave();
        else if (sel === 1) importSave();
        else {
          resetSave();
          setMsg("SAVE DATA ERASED");
          soundEngine.noiseBurst(0.2, 0.3);
        }
      },
      onB: () => onBack(),
    },
    [sel],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar title="SAVE DATA" wifi={wifi} bt={bt} />
      <div className="flex-1 space-y-2 px-3 py-2 font-['VT323'] text-[13px]">
        <div>STORAGE USED: {sizeKb} KB (localStorage)</div>
        <div>ACHIEVEMENTS: {data.achievementsUnlocked.length} saved</div>
        <div className="space-y-1 pt-1">
          {items.map((it, i) => (
            <div key={it} className={`px-1 ${i === sel ? "bg-current/20" : ""}`}>
              {i === sel ? "▶ " : "  "}
              {it}
            </div>
          ))}
        </div>
        {msg && <div className="pt-1 text-[11px] opacity-80">{msg}</div>}
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            file.text().then((text) => {
              try {
                JSON.parse(text);
                localStorage.setItem("nostalgicverse.save.v1", text);
                setMsg("IMPORTED — RESTART TO APPLY");
                soundEngine.beep(1500, 0.12, "square", 0.3);
              } catch {
                setMsg("INVALID SAVE FILE");
              }
            });
          }}
        />
      </div>
      <div className="border-t border-current/20 px-2 py-[2px] font-['VT323'] text-[12px] opacity-70">
        ▲▼ SELECT &nbsp; A CONFIRM &nbsp; B BACK
      </div>
    </div>
  );
}
