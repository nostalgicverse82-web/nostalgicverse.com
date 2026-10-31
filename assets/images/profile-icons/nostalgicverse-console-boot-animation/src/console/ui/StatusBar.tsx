import { useEffect, useState } from "react";

export default function StatusBar({ title, wifi, bt }: { title: string; wifi: boolean; bt: boolean }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");
  return (
    <div className="flex items-center justify-between border-b border-current/20 px-2 py-[2px] font-['VT323'] text-[13px] leading-none tracking-wide">
      <span className="truncate opacity-90">{title}</span>
      <span className="flex items-center gap-2 opacity-80">
        <span className={wifi ? "opacity-100" : "opacity-30"}>WIFI</span>
        <span className={bt ? "opacity-100" : "opacity-30"}>BT</span>
        <span>
          {hh}:{mm}
        </span>
      </span>
    </div>
  );
}
