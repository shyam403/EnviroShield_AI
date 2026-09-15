import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  BASE_ZONES,
  CITY,
  CITY_NAME,
  type Place,
} from "@/data/city";

import EmergencyOverlay from "@/components/EmergencyOverlay";
import HomeDashboard from "@/components/HomeDashboard";
import AlertsDashboard from "@/components/AlertsDashboard";
import MapScreen from "@/components/MapScreen";
import ProfileScreen from "@/components/ProfileScreen";

import { useDeviceLocation, useOnlineStatus } from "@/lib/hooks";
import {
  indexEdgeGeometry,
  mergeShelterStatus,
  recommendSafePlaces,
  ruleEngine,
} from "@/lib/intelligence";
import { buildGraph, type Route as SafeRoute } from "@/lib/routing";
import { freshnessOf } from "@/lib/local-cache";
import { loadCachedDataset, syncDataset, type SyncedDataset } from "@/lib/sync";
import { supabase } from "@/integrations/supabase/client";
import { assessSituation, evaluateOverallRisk, type AIMonitorResult } from "@/lib/ai-monitor";

/* =========================================================
   STATIC MAP INDEX
========================================================= */

indexEdgeGeometry(CITY.edges, CITY.nodeById);

/* =========================================================
   ROUTE DEFINITION
========================================================= */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "EnviroShield AI — Intelligent Disaster & Environmental Monitoring",
      },
      {
        name: "description",
        content:
          "Real-time environmental monitoring, offline hazard maps, early disaster detection, and safe-route evacuation guidance.",
      },
      {
        property: "og:title",
        content: "EnviroShield AI — Intelligent Environmental Monitoring",
      },
      {
        property: "og:description",
        content:
          "Smarter monitoring for flood, earthquake, and pollution threats with offline-first safe navigation.",
      },
    ],
  }),

  component: AuthenticatedEnviroShieldApp,
});

/* =========================================================
   AUTHENTICATION GATE
========================================================= */

function AuthenticatedEnviroShieldApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthenticated(localStorage.getItem("enviroshield_authenticated") === "true");
  }, []);

  useEffect(() => {
    if (authenticated === false) {
      window.location.replace("/login.html");
    }
  }, [authenticated]);

  if (authenticated === null || authenticated === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1016] text-white">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-sm font-semibold tracking-wide">Loading EnviroShield AI...</span>
        </div>
      </div>
    );
  }

  return <EnviroShieldMainApp />;
}

/* =========================================================
   MAIN APP SHELL
========================================================= */

type AppTab = "home" | "map" | "alerts" | "profile";

function EnviroShieldMainApp() {
  const online = useOnlineStatus();
  const loc = useDeviceLocation();

  const [dataset, setDataset] = useState<SyncedDataset | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [telemetryStatus, setTelemetryStatus] = useState<"connected" | "waiting" | "error">("waiting");
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [tab, setTab] = useState<AppTab>("home");
  const [emergency, setEmergency] = useState(false);
  const [disasterMenuOpen, setDisasterMenuOpen] = useState(false);
  const [selectedDisaster, setSelectedDisaster] = useState<"earthquake" | "air-pollution" | "flood" | null>(null);
  const [sosResult, setSosResult] = useState<string | null>(null);

  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    phone: string;
    bloodGroup: string;
    emergencyName: string;
    emergencyPhone: string;
  }>(() => {
    try {
      const saved = localStorage.getItem("enviroshield_profile");
      return saved
        ? JSON.parse(saved)
        : {
            name: "Alex Morgan",
            email: "demo@enviroshield.ai",
            phone: "+91 98765 43210",
            bloodGroup: "O+",
            emergencyName: "Sarah Morgan",
            emergencyPhone: "+91 98765 43211",
          };
    } catch {
      return {
        name: "Alex Morgan",
        email: "demo@enviroshield.ai",
        phone: "+91 98765 43210",
        bloodGroup: "O+",
        emergencyName: "Sarah Morgan",
        emergencyPhone: "+91 98765 43211",
      };
    }
  });

  // Initial load
  useEffect(() => {
    setDataset(loadCachedDataset());
    const stopLoc = loc.start();
    return stopLoc;
  }, []);

  // Sync Dataset
  const runSync = async () => {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    setSyncError(null);
    try {
      setDataset(await syncDataset());
      setSyncState("idle");
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
      setSyncState("error");
    }
  };

  const getLocalBackendBaseUrl = () => {
    const androidCapacitor = !!(window as any).Capacitor && /Android/i.test(navigator.userAgent);
    return androidCapacitor ? "http://10.0.2.2:3001" : "http://localhost:3001";
  };

  const getLocalBackendWsUrl = () => {
    const androidCapacitor = !!(window as any).Capacitor && /Android/i.test(navigator.userAgent);
    return androidCapacitor ? "ws://10.0.2.2:3001" : "ws://localhost:3001";
  };

  const hydrateTelemetryIntoDataset = (telemetry: SyncedDataset["telemetry"]) => {
    setDataset((current) => {
      if (current) {
        return { ...current, telemetry };
      }

      return {
        zones: BASE_ZONES,
        alerts: [],
        closures: [],
        shelters: [],
        telemetry,
        syncedAt: new Date().toISOString(),
      };
    });
  };

  // Fetch live telemetry from the Local Backend first, with Supabase as fallback.
  // The Local Backend is the source of truth for Renode -> serial_bridge telemetry.
  const fetchLatestTelemetry = async () => {
    try {
      setTelemetryError(null);
      const backendBase = getLocalBackendBaseUrl();

      // 1. Local Backend: complete latest Renode telemetry.
      // This works even when the phone/app has no internet connection.
      try {
        const localRes = await fetch(
          `${backendBase}/api/telemetry/latest`,
          {
            signal: AbortSignal.timeout(1500),
            cache: "no-store",
          },
        );

        if (localRes.ok) {
          const localData = await localRes.json();

          if (localData && localData.device_id) {
            setTelemetryStatus("connected");
            hydrateTelemetryIntoDataset(localData);
            return;
          }
        }
      } catch {
        // Local backend unavailable; continue to Supabase fallback.
      }

      // 2. Supabase fallback when the local backend is unavailable.
      if (!online) {
        setTelemetryStatus("waiting");
        return;
      }

      const { data, error } = await supabase
        .from("sensor_telemetry")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTelemetryStatus("connected");
        hydrateTelemetryIntoDataset(data as SyncedDataset["telemetry"]);
      } else {
        setTelemetryStatus("waiting");
      }
    } catch (err) {
      setTelemetryStatus("error");
      setTelemetryError(
        err instanceof Error ? err.message : "Telemetry connection error",
      );
    }
  };

  // Local WebSocket Realtime Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(getLocalBackendWsUrl());
        ws.onopen = () => {
          setTelemetryStatus("connected");
        };
        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "telemetry_update" && parsed.data) {
              setTelemetryStatus("connected");
              hydrateTelemetryIntoDataset(parsed.data);
            } else if (parsed.type === "alert_new" && parsed.data) {
              setDataset((cur) => {
                if (!cur) return cur;
                const existing = cur.alerts || [];
                return { ...cur, alerts: [parsed.data, ...existing] };
              });
            }
          } catch (e) {
            console.error("WS Parse error", e);
          }
        };
        ws.onerror = () => {
          ws?.close();
        };
        ws.onclose = () => {
          reconnectTimer = window.setTimeout(connectWs, 3000);
        };
      } catch {
        reconnectTimer = window.setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Live telemetry polling.
  // Do NOT gate this on `online`: the Local Backend is intentionally
  // available for offline/local operation.
  useEffect(() => {
    void fetchLatestTelemetry();

    const intervalId = window.setInterval(() => {
      void fetchLatestTelemetry();
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [online]);

  // Cloud dataset sync is separate from live telemetry so a slower/stale
  // Supabase sync cannot overwrite the latest Renode values.
  useEffect(() => {
    if (!online) return;

    void runSync();
  }, [online]);

  // Realtime Supabase subscription
  useEffect(() => {
    if (!online) return;
    const channel = supabase
      .channel("sensor_telemetry_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_telemetry" },
        (payload) => {
          const nextRow = payload.new as SyncedDataset["telemetry"];
          if (nextRow) {
            setTelemetryStatus("connected");
            setDataset((cur) => (cur ? { ...cur, telemetry: nextRow } : cur));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sensor_telemetry" },
        (payload) => {
          const nextRow = payload.new as SyncedDataset["telemetry"];
          if (nextRow) {
            setTelemetryStatus("connected");
            setDataset((cur) => (cur ? { ...cur, telemetry: nextRow } : cur));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [online]);

  const zones = dataset?.zones.length ? dataset.zones : BASE_ZONES;
  const closures = dataset?.closures ?? [];
  const places = useMemo(() => mergeShelterStatus(CITY.places, dataset?.shelters ?? []), [dataset]);
  const edges = useMemo(() => ruleEngine.applyReports(CITY.edges, zones, closures), [zones, closures]);
  const graph = useMemo(() => buildGraph(CITY.nodes, edges), [edges]);

  const livePosition = loc.state === "live" ? loc.fix : null;
  const fallbackPosition = loc.lastKnown;
  const freshness = freshnessOf(dataset?.syncedAt ?? null);

  const telemetryRisk = useMemo(() => evaluateOverallRisk(dataset?.telemetry ?? null), [dataset?.telemetry]);

  // AI Monitor Assessment
  const aiMonitor = useMemo<AIMonitorResult>(
    () =>
      assessSituation({
        online,
        datasetAvailable: Boolean(dataset),
        gpsAvailable: Boolean(livePosition ?? fallbackPosition),
        gpsOutsideMap: false,
        risk: telemetryRisk.overallRisk === "HIGH" || telemetryRisk.overallRisk === "CRITICAL" ? "red" : telemetryRisk.overallRisk === "MEDIUM" ? "yellow" : "green",
        hazardAhead: telemetryRisk.overallRisk === "HIGH" || telemetryRisk.overallRisk === "CRITICAL",
        routeSafetyScore:
          telemetryRisk.overallRisk === "CRITICAL"
            ? 20
            : telemetryRisk.overallRisk === "HIGH"
              ? 45
              : telemetryRisk.overallRisk === "MEDIUM"
                ? 70
                : 92,
        dangerousSections: telemetryRisk.alerts.length,
        remainingDistanceM: null,
        nearestSafeZoneName: telemetryRisk.overallRisk === "SAFE" ? "High Ridge Relief Center" : "High Ridge Relief Center",
        nearestSafeZoneDistanceM: 850,
        dataFreshness: freshness,
      }),
    [online, dataset, livePosition, fallbackPosition, freshness, telemetryRisk],
  );

  // SOS Handler
  const handleSendSos = async () => {
    const pos = livePosition ?? fallbackPosition ?? null;
    const text = pos
      ? `🚨 EnviroShield AI SOS! I require emergency assistance at coordinates: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}.`
      : "🚨 EnviroShield AI SOS! I require emergency assistance. Position unknown.";

    try {
      if (navigator.share) {
        await navigator.share({ title: "EnviroShield AI SOS", text });
        setSosResult("SOS broadcasted to sharing apps.");
      } else {
        await navigator.clipboard.writeText(text);
        setSosResult("Emergency SOS coordinates copied to clipboard.");
      }
    } catch {
      setSosResult("Please call Disaster Helpline 1077 directly.");
    }
  };

  const handleUpdateProfile = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    try {
      localStorage.setItem("enviroshield_profile", JSON.stringify(profile));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("enviroshield_authenticated");
    window.location.replace("/login.html");
  };

  const alertsCount = (dataset?.alerts?.length || 0) + (dataset?.closures?.length || 0);

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#070c12] font-sans antialiased select-none">
      {/* ===================================================
          TOP GLOBAL APP BAR
      =================================================== */}
      <header className="relative z-40 flex items-center justify-between border-b border-white/10 bg-[#0b1016]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src="/logo.jpg" alt="EnviroShield AI" className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/15" />
          <div>
            <span className="font-display text-base font-black tracking-wider text-white">
              ENVIROSHIELD
            </span>
            <span className="text-[10px] font-bold text-emerald-400 ml-1">AI</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDisasterMenuOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition"
          >
            <span>⚡</span>
            <span className="hidden sm:inline">Disaster Hub</span>
          </button>

          <button
            type="button"
            onClick={() => setEmergency(true)}
            className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold tracking-wider uppercase transition shadow-lg shadow-red-600/30 animate-pulse"
          >
            SOS
          </button>
        </div>
      </header>

      {/* ===================================================
          PERSISTENT CRITICAL ALERT BANNER (IF CRITICAL)
      =================================================== */}
      {aiMonitor.severity === "critical" && (
        <div className="z-30 bg-red-600 px-4 py-2.5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 text-xs font-bold truncate">
            <span>🚨</span>
            <span className="truncate">CRITICAL HAZARD: Immediate Evacuation Suggested</span>
          </div>
          <button
            type="button"
            onClick={() => setTab("map")}
            className="px-3 py-1 rounded bg-black/40 text-xs font-bold hover:bg-black/60 shrink-0"
          >
            View Route
          </button>
        </div>
      )}

      {/* ===================================================
          MAIN CONTENT AREA (TAB ROUTING)
      =================================================== */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {tab === "home" && (
          <HomeDashboard
            dataset={dataset}
            aiMonitor={aiMonitor}
            risk={telemetryRisk}
            online={online}
            onNavigate={(nextTab) => setTab(nextTab as AppTab)}
            telemetryStatus={telemetryStatus}
            profileName={profile.name}
          />
        )}

        {tab === "map" && (
          <MapScreen
            dataset={dataset}
            aiMonitor={aiMonitor}
            online={online}
            onNavigate={(nextTab) => setTab(nextTab as AppTab)}
            telemetryStatus={telemetryStatus}
            profileName={profile.name}
            setEmergency={setEmergency}
          />
        )}

        {tab === "alerts" && (
          <AlertsDashboard
            dataset={dataset}
            risk={telemetryRisk}
            closures={closures}
            onNavigateToMap={() => setTab("map")}
          />
        )}

        {tab === "profile" && (
          <ProfileScreen
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onSaveProfile={handleSaveProfile}
            onLogout={handleLogout}
            online={online}
            syncState={syncState}
            syncError={syncError}
            dataset={dataset}
            onSync={runSync}
            onSendSos={handleSendSos}
            sosResult={sosResult}
          />
        )}
      </div>

      {/* ===================================================
          INSTAGRAM-STYLE BOTTOM NAVIGATION BAR
      =================================================== */}
      <nav className="relative z-40 flex h-16 shrink-0 items-center justify-around border-t border-white/10 bg-[#0b1016]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {[
          { id: "home" as const, label: "Home", icon: "🏠" },
          { id: "map" as const, label: "Map", icon: "🗺️" },
          { id: "alerts" as const, label: "Alerts", icon: "🔔", badge: alertsCount },
          { id: "profile" as const, label: "Profile", icon: "👤" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                active ? "text-emerald-400 scale-105 font-bold" : "text-white/50 hover:text-white/80 font-medium"
              }`}
            >
              <div className="relative">
                <span className="text-xl">{item.icon}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight mt-0.5">{item.label}</span>
              {active && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ===================================================
          EMERGENCY FULLSCREEN OVERLAY
      =================================================== */}
      {emergency && (
        <EmergencyOverlay
          recommendations={recommendSafePlaces(graph, places, CITY.nodes[0]?.id ?? "0", { limit: 4 })}
          activeRoute={null}
          positionLabel={livePosition ? `${livePosition.lat.toFixed(4)}, ${livePosition.lng.toFixed(4)}` : "Live GPS"}
          positionStale={!livePosition}
          online={online}
          onSelect={() => {
            setEmergency(false);
            setTab("map");
          }}
          onExit={() => setEmergency(false)}
        />
      )}

      {/* ===================================================
          DISASTER HUB OVERLAY
      =================================================== */}
      {disasterMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050505]/95 backdrop-blur-xl text-white p-4 flex flex-col justify-between">
          <div className="max-w-md mx-auto w-full pt-4 space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDisasterMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20"
              >
                ✕
              </button>
              <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-300 uppercase tracking-widest">
                Disaster Hub
              </span>
            </div>

            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-600/30 to-black border border-red-500/30 flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(220,38,38,0.3)]">
                ⚡
              </div>
              <h2 className="text-2xl font-black text-white">Disaster Monitoring Hub</h2>
              <p className="text-xs text-white/60">
                Select a live environmental monitoring module to inspect conditions and risk vectors.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: "flood" as const,
                  title: "Flood & Surge Warning",
                  subtitle: "Water level clearance & evacuation corridors",
                  icon: "🌊",
                  status: dataset?.telemetry?.flood_risk ?? "Low Risk",
                },
                {
                  id: "earthquake" as const,
                  title: "Earthquake & Seismic",
                  subtitle: "Ground displacement & tremor sensors",
                  icon: "〰️",
                  status: `Level ${dataset?.telemetry?.earthquake_level ?? 0}`,
                },
                {
                  id: "air-pollution" as const,
                  title: "Air Pollution & Toxicity",
                  subtitle: "PM2.5 particulate & hazardous gas index",
                  icon: "💨",
                  status: dataset?.telemetry?.air_risk ?? "Good Quality",
                },
              ].map((item) => {
                const isSelected = selectedDisaster === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedDisaster(item.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-red-500 bg-red-950/40 shadow-lg shadow-red-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-white">{item.title}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-emerald-400">
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDisaster && (
              <button
                type="button"
                onClick={() => {
                  setDisasterMenuOpen(false);
                  setTab("map");
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-sm tracking-wider uppercase shadow-xl hover:brightness-110 transition"
              >
                Open {selectedDisaster.toUpperCase()} Route Map →
              </button>
            )}
          </div>

          <p className="text-center text-[10px] text-white/30 uppercase tracking-widest pt-4">
            EnviroShield AI • A safer planet for tomorrow
          </p>
        </div>
      )}
    </main>
  );
}
