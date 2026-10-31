import { useEffect } from "react";
import type { UnifiedInput } from "./useUnifiedInput";

interface Handlers {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onA?: () => void;
  onB?: () => void;
  onStart?: () => void;
  onSelect?: () => void;
}

// Every menu screen (and game) polls the same unified input frame once per
// frame — this is exactly how the firmware's main loop would dispatch
// input regardless of whether it came from the keypad, the mobile
// controller, or a paired Bluetooth gamepad.
export function usePolledInput(inputRef: React.RefObject<UnifiedInput>, handlers: Handlers, deps: unknown[] = []) {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const api = inputRef.current;
      if (api) {
        const f = api.frame;
        if (f.justUp) handlers.onUp?.();
        if (f.justDown) handlers.onDown?.();
        if (f.justLeft) handlers.onLeft?.();
        if (f.justRight) handlers.onRight?.();
        if (f.justA) handlers.onA?.();
        if (f.justB) handlers.onB?.();
        if (f.justStart) handlers.onStart?.();
        if (f.justSelect) handlers.onSelect?.();
        api.consumeJust();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
