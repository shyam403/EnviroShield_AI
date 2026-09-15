import { useCallback, useEffect, useState } from "react";
import { loadLocal, saveLocal } from "./local-cache";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export type FixState = "idle" | "locating" | "live" | "lost" | "denied" | "unsupported";

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: string;
}

/**
 * Device GNSS with an honest fallback: when the signal drops we keep the last
 * known fix and say so, instead of pretending to know where the user is.
 */
export function useDeviceLocation() {
  const [state, setState] = useState<FixState>("idle");
  const [fix, setFix] = useState<Fix | null>(null);
  const [lastKnown, setLastKnown] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLastKnown(loadLocal<Fix | null>("lastFix", null));
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return () => {};
    }
    setState("locating");
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          at: new Date().toISOString(),
        };
        setFix(next);
        setLastKnown(next);
        saveLocal("lastFix", next);
        setState("live");
      },
      (err) => {
        setFix(null);
        setError(err.message);
        setState(err.code === err.PERMISSION_DENIED ? "denied" : "lost");
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { state, fix, lastKnown, error, start };
}
