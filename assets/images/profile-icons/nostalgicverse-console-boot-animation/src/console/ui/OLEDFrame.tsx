import { CSSProperties, ReactNode } from "react";

// The visual "glass" of the 128x64 OLED: deep black, phosphor glow,
// scanlines and a subtle vignette. Both the canvas-driven boot intro and
// the HTML/CSS driven OS screens live inside this same frame so the whole
// experience feels like one continuous display.
export default function OLEDFrame({
  children,
  accent,
  contrast = 1,
}: {
  children: ReactNode;
  accent: string;
  contrast?: number;
}) {
  const style: CSSProperties = {
    color: accent,
    filter: `contrast(${contrast}) brightness(${contrast})`,
    textShadow: `0 0 2px ${accent}99, 0 0 6px ${accent}55`,
  };
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-[2px] bg-black" style={style}>
      <div className="absolute inset-0">{children}</div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, #000 0px, #000 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 14px 4px rgba(0,0,0,0.85)" }}
      />
    </div>
  );
}
