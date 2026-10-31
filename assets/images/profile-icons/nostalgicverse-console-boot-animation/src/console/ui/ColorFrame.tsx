import { ReactNode } from "react";

// A secondary display mode for the games — representing the console's
// upcoming color SPI/TFT display. Same physical frame language as the
// OLED (scanlines, vignette, 2:1 aspect) but full color.
export default function ColorFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-[2px] bg-black">
      <div className="absolute inset-0">{children}</div>
      <div className="pointer-events-none absolute left-1 top-1 rounded-sm bg-black/50 px-1 text-[8px] tracking-wide text-white/70 font-['VT323']">
        COLOR TFT PREVIEW
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, #000 0px, #000 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 16px 4px rgba(0,0,0,0.75)" }}
      />
    </div>
  );
}
