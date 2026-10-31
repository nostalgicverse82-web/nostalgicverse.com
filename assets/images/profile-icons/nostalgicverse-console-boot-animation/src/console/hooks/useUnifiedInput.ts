import { useEffect, useRef } from "react";
import type { InputFrame } from "../types";

// Unified input system: physical keyboard (standing in for the 4x4 keypad),
// and on-screen touch buttons (standing in for the WiFi mobile controller)
// all funnel into the same InputFrame — games and menus never need to know
// which "controller" produced the signal.

const KEY_MAP: Record<string, keyof InputFrame> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  " ": "a",
  Enter: "a",
  z: "a",
  Z: "a",
  Shift: "b",
  x: "b",
  X: "b",
  Escape: "b",
  Backspace: "select",
  Tab: "select",
};

function freshFrame(): InputFrame {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false,
    start: false,
    select: false,
    justUp: false,
    justDown: false,
    justLeft: false,
    justRight: false,
    justA: false,
    justB: false,
    justStart: false,
    justSelect: false,
  };
}

export interface UnifiedInput {
  frame: InputFrame;
  press: (btn: keyof InputFrame) => void;
  release: (btn: keyof InputFrame) => void;
  consumeJust: () => void;
}

export function useUnifiedInput(): React.RefObject<UnifiedInput> {
  const ref = useRef<UnifiedInput>({
    frame: freshFrame(),
    press: () => {},
    release: () => {},
    consumeJust: () => {},
  });

  useEffect(() => {
    const held = new Set<string>();
    const api = ref.current;

    api.press = (btn) => {
      const f = api.frame as unknown as Record<string, boolean>;
      if (!f[btn]) f[`just${btn[0].toUpperCase()}${btn.slice(1)}`] = true;
      f[btn] = true;
    };
    api.release = (btn) => {
      (api.frame as unknown as Record<string, boolean>)[btn] = false;
    };
    api.consumeJust = () => {
      api.frame.justUp = false;
      api.frame.justDown = false;
      api.frame.justLeft = false;
      api.frame.justRight = false;
      api.frame.justA = false;
      api.frame.justB = false;
      api.frame.justStart = false;
      api.frame.justSelect = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const btn = KEY_MAP[e.key];
      if (e.key === "Enter" && e.repeat) return;
      if (btn) {
        if (!held.has(e.key)) api.press(btn);
        held.add(e.key);
        e.preventDefault();
      } else if (e.key === "p" || e.key === "P") {
        api.press("start");
        held.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const btn = KEY_MAP[e.key];
      held.delete(e.key);
      if (btn) api.release(btn);
      if (e.key === "p" || e.key === "P") api.release("start");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return ref;
}
