import { uuid } from "@/lib/utils";

const KEY = "pictionary_player";
export type StoredPlayer = { id: string; name: string; color: string };

const COLORS = ["#FF0099", "#CCFF00", "#00FAFF", "#FF6B00", "#A855F7", "#22D3EE", "#F59E0B", "#10B981"];

export function getOrCreatePlayer(name?: string): StoredPlayer {
  if (typeof window === "undefined") return { id: "ssr", name: "Guest", color: "#FF0099" };
  const raw = localStorage.getItem(KEY);
  if (raw && !name) {
    try { return JSON.parse(raw); } catch { /* ignore */ }
  }
  const player: StoredPlayer = {
    id: uuid(),
    name: name || `Player${Math.floor(Math.random() * 999)}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  localStorage.setItem(KEY, JSON.stringify(player));
  return player;
}

export function updatePlayerName(name: string): StoredPlayer {
  const p = getOrCreatePlayer();
  const next = { ...p, name };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
