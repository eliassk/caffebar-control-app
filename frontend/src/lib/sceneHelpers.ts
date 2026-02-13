/**
 * Shared helpers for scene rendering (icons, colour sanitisation).
 */
import {
  Coffee, Home, Sun, Moon, Lightbulb, Flame,
  DoorOpen, DoorClosed, Sparkles, Zap, Play,
} from "lucide-svelte";

/** Map of icon key -> Lucide component for scene buttons. */
export const SCENE_ICONS: Record<string, typeof Coffee> = {
  coffee: Coffee,
  home: Home,
  sun: Sun,
  moon: Moon,
  lightbulb: Lightbulb,
  flame: Flame,
  doorOpen: DoorOpen,
  doorClosed: DoorClosed,
  sparkles: Sparkles,
  zap: Zap,
  play: Play,
};

export const SCENE_ICON_KEYS = Object.keys(SCENE_ICONS);

/** Predefined colour palette for scene colour pickers. */
export const SCENE_COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899",
  "#8b5cf6", "#06b6d4", "#84cc16", "#64748b",
];

/** Get the Lucide icon component for a scene, falling back to Play. */
export function getSceneIcon(icon?: string | null) {
  return (icon && SCENE_ICONS[icon]) || Play;
}

/** Strict hex colour regex to prevent CSS injection. */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Validate a hex colour string; returns the colour or null if invalid. */
export function safeColor(color?: string | null): string | null {
  return color && HEX_COLOR_RE.test(color) ? color : null;
}
