import { createContext, useContext } from "react";

export const THEME_COLORS: Record<string, { fg: string; glow: string; dim: string }> = {
  cyan: { fg: "#9df5ff", glow: "#5be6ff", dim: "#2a5b66" },
  amber: { fg: "#ffd79a", glow: "#ffb14e", dim: "#6b4c1f" },
  green: { fg: "#b6ff9d", glow: "#7dff4e", dim: "#355c22" },
  white: { fg: "#f4f8ff", glow: "#ffffff", dim: "#5a5f6b" },
};

export const AccentContext = createContext<string>(THEME_COLORS.cyan.fg);
export const useAccent = () => useContext(AccentContext);
