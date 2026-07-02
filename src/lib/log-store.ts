import { useSyncExternalStore } from "react";
import type { ParsedCollection } from "./types";

const KEY = "mule-log-collection";

let current: ParsedCollection | null = null;
const listeners = new Set<() => void>();

function load(): ParsedCollection | null {
  if (current) return current;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) current = JSON.parse(raw) as ParsedCollection;
  } catch {
    current = null;
  }
  return current;
}

export function setCollection(c: ParsedCollection) {
  current = c;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(KEY, JSON.stringify(c));
  }
  listeners.forEach((l) => l());
}

export function clearCollection() {
  current = null;
  if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function useCollection(): ParsedCollection | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => load(),
    () => null,
  );
}
