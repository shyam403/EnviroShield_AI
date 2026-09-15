/** Tiny persistence layer for offline state (survives reloads with no network). */

const PREFIX = "floodsafe:";

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — offline map still works from bundled data */
  }
}

export function formatAge(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "unknown";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export type Freshness = "live" | "recent" | "stale" | "none";

export function freshnessOf(iso: string | null): Freshness {
  if (!iso) return "none";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 15 * 60 * 1000) return "live";
  if (ms < 6 * 60 * 60 * 1000) return "recent";
  return "stale";
}
