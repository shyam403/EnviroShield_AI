import { useCallback, useMemo, useState } from "react";
import type { SyncedDataset } from "../lib/sync";
import type { AIMonitorResult } from "../lib/ai-monitor";
import MapCanvas, { type MapCanvasHandle } from "@/components/MapCanvas";
import { useDeviceLocation, useOnlineStatus } from "@/lib/hooks";
import {
  mergeShelterStatus,
  recommendSafePlaces,
  ruleEngine,
  searchPlaces,
} from "@/lib/intelligence";
import {
  buildGraph,
  findSafeRoutes,
  nearestGraphNode,
  routeHazardWarnings,
  type Route as SafeRoute,
} from "@/lib/routing";
import { formatAge } from "@/lib/local-cache";
import {
  BASE_ZONES,
  CITY,
  CITY_NAME,
  DATASET_NOTICE,
  PLACE_LABELS,
  distanceM,
  riskAt,
  type Place,
} from "@/data/city";

interface MapScreenProps {
  dataset: SyncedDataset | null;
  aiMonitor: AIMonitorResult;
  online: boolean;
  onNavigate: (tab: string) => void;
  telemetryStatus: "connected" | "waiting" | "error";
  profileName: string;
  setEmergency: (val: boolean) => void;
}

const QUICK_SEARCHES = [
  "Nearest shelter",
  "Hospital",
  "Police",
  "Relief",
  "Safe zone",
  "Higher ground",
];

const OFFLINE_MAP_BOUNDS = (() => {
  const lats = CITY.nodes.map((node) => node.lat);
  const lngs = CITY.nodes.map((node) => node.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
})();

function isInsideOfflineMap(position: { lat: number; lng: number } | null) {
  if (!position) return false;
  return (
    position.lat >= OFFLINE_MAP_BOUNDS.minLat &&
    position.lat <= OFFLINE_MAP_BOUNDS.maxLat &&
    position.lng >= OFFLINE_MAP_BOUNDS.minLng &&
    position.lng <= OFFLINE_MAP_BOUNDS.maxLng
  );
}

function scoreClass(score: number) {
  if (score >= 78) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function levelLabel(route: SafeRoute) {
  return route.level === "safe"
    ? "Safe route"
    : route.level === "caution"
      ? "Use caution"
      : "Dangerous";
}

export default function MapScreen({
  dataset,
  aiMonitor,
  online,
  onNavigate,
  telemetryStatus,
  profileName,
  setEmergency,
}: MapScreenProps) {
  const loc = useDeviceLocation();
  const onlineStatus = useOnlineStatus();
  const isOnline = online || onlineStatus;

  const [mapRef, setMapRef] = useState<MapCanvasHandle | null>(null);
  const [manualPin, setManualPin] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [pickMode, setPickMode] = useState(false);
  const [mapSubTab, setMapSubTab] = useState<"safe_zones" | "search" | "route">("safe_zones");
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(true);

  const zones = dataset?.zones.length ? dataset.zones : BASE_ZONES;
  const closures = dataset?.closures ?? [];
  const places = useMemo(() => mergeShelterStatus(CITY.places, dataset?.shelters ?? []), [dataset]);
  const edges = useMemo(() => ruleEngine.applyReports(CITY.edges, zones, closures), [zones, closures]);
  const graph = useMemo(() => buildGraph(CITY.nodes, edges), [edges]);

  const livePosition = loc.state === "live" ? loc.fix : null;
  const fallbackPosition = loc.lastKnown;

  const origin = livePosition ?? manualPin ?? fallbackPosition ?? null;
  const gpsOutsideOfflineMap = !!livePosition && !isInsideOfflineMap(livePosition);

  const usableManualPin = isInsideOfflineMap(manualPin) ? manualPin : null;
  const usableFallback = isInsideOfflineMap(fallbackPosition) ? fallbackPosition : null;

  const navigationOrigin =
    livePosition && isInsideOfflineMap(livePosition)
      ? livePosition
      : (usableManualPin ?? usableFallback ?? null);

  const originNode = useMemo(
    () =>
      navigationOrigin
        ? nearestGraphNode(CITY.nodes, navigationOrigin.lat, navigationOrigin.lng)
        : null,
    [navigationOrigin],
  );

  const safeZones = useMemo(
    () => places.filter((place) => place.kind === "safe_zone" && place.isOpen !== false),
    [places],
  );

  const nearestSafeZone = useMemo(() => {
    if (!navigationOrigin || !safeZones.length) return null;
    return safeZones.reduce<Place | null>((nearest, place) => {
      if (!nearest) return place;
      const currentDistance = distanceM(navigationOrigin, place);
      const nearestDistance = distanceM(navigationOrigin, nearest);
      return currentDistance < nearestDistance ? place : nearest;
    }, null);
  }, [navigationOrigin, safeZones]);

  const recommendations = useMemo(
    () => (originNode ? recommendSafePlaces(graph, places, originNode.id, { limit: 6 }) : []),
    [graph, places, originNode],
  );

  const searchResults = useMemo(() => searchPlaces(places, searchQuery), [places, searchQuery]);

  const routeResult = useMemo(() => {
    if (!originNode || !destination || !destination.nodeId) return null;
    return findSafeRoutes(graph, originNode.id, destination.nodeId, 3);
  }, [graph, originNode, destination]);

  const routes = routeResult?.routes ?? [];
  const activeRoute = routes[Math.min(routeIndex, Math.max(routes.length - 1, 0))] ?? null;
  const hazardWarnings = activeRoute ? routeHazardWarnings(activeRoute, zones) : [];

  const routeProgress = useMemo(() => {
    if (!activeRoute || !navigationOrigin || !destination) return null;
    const remainingDistance = distanceM(navigationOrigin, destination);
    const remainingMinutes = Math.max(1, Math.round(remainingDistance / 75));
    const arrived = remainingDistance <= 80;
    return { remainingDistance, remainingMinutes, arrived };
  }, [activeRoute, navigationOrigin, destination]);

  const handlePick = useCallback((lat: number, lng: number) => {
    const pin = { lat, lng };
    setManualPin(pin);
    setPickMode(false);
    setRouteIndex(0);
  }, []);

  const chooseDestination = (place: Place) => {
    setDestination(place);
    setRouteIndex(0);
    setMapSubTab("route");
    mapRef?.focus(place.lat, place.lng, 2.6);
  };

  const chooseNearestSafeZone = () => {
    if (!nearestSafeZone) return;
    chooseDestination(nearestSafeZone);
  };

  const originRisk = navigationOrigin ? riskAt(navigationOrigin.lat, navigationOrigin.lng, zones) : null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#070c12]">
      {/* Top Floating Action Bar */}
      <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-[#0f172a]/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide uppercase">
            {CITY_NAME} Map
          </span>
          {originRisk && originRisk.risk !== "none" && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                originRisk.risk === "red"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : originRisk.risk === "yellow"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {originRisk.zone?.name || originRisk.risk}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setPickMode((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md border transition-all ${
              pickMode
                ? "bg-emerald-500 text-black border-emerald-400"
                : "bg-[#0f172a]/90 text-white border-white/10 hover:bg-white/10"
            }`}
          >
            {pickMode ? "📍 Tap Map to Set" : "📍 Set Position"}
          </button>
          {navigationOrigin && (
            <button
              type="button"
              onClick={() => mapRef?.focus(navigationOrigin.lat, navigationOrigin.lng, 3.4)}
              className="p-2 rounded-xl bg-[#0f172a]/90 text-white border border-white/10 shadow-lg hover:bg-white/10 text-xs font-bold"
              title="Centre on me"
            >
              🎯
            </button>
          )}
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative flex-1">
        <MapCanvas
          zones={zones}
          edges={edges}
          nodeById={CITY.nodeById}
          buildings={CITY.buildings}
          places={places}
          route={activeRoute}
          alternatives={routes.filter((r) => r.id !== activeRoute?.id)}
          user={isInsideOfflineMap(origin) ? origin : null}
          userStale={!livePosition && !!fallbackPosition}
          manualPin={manualPin}
          pickMode={pickMode}
          selectedPlaceId={destination?.id ?? null}
          lowMotion={false}
          onPickPoint={handlePick}
          onSelectPlace={chooseDestination}
          handleRef={setMapRef}
        />

        {/* Map Legend */}
        <div className="absolute bottom-4 right-3 rounded-xl border border-white/10 bg-[#0f172a]/85 p-2 text-[10px] text-white shadow-lg backdrop-blur pointer-events-none space-y-1">
          <p className="font-bold text-white/50 uppercase tracking-wider mb-1">Risk Zones</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
            <span>High Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span>Caution</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            <span>Elevated Safe</span>
          </div>
        </div>
      </div>

      {/* Bottom Floating Navigation Drawer */}
      <div className="relative z-30 bg-[#0b1016]/95 border-t border-white/10 shadow-2xl backdrop-blur-xl flex flex-col max-h-[48dvh]">
        {/* Drawer Drag Bar / Toggle */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMapSubTab("safe_zones");
                setSheetOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                mapSubTab === "safe_zones"
                  ? "bg-emerald-500 text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Safe Destinations
            </button>
            <button
              type="button"
              onClick={() => {
                setMapSubTab("search");
                setSheetOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                mapSubTab === "search" ? "bg-emerald-500 text-black" : "text-white/60 hover:text-white"
              }`}
            >
              Search
            </button>
            {destination && (
              <button
                type="button"
                onClick={() => {
                  setMapSubTab("route");
                  setSheetOpen(true);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  mapSubTab === "route" ? "bg-emerald-500 text-black" : "text-white/60 hover:text-white"
                }`}
              >
                Active Route
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            className="text-xs text-white/50 hover:text-white"
          >
            {sheetOpen ? "Minimize ↓" : "Expand ↑"}
          </button>
        </div>

        {/* Drawer Content */}
        {sheetOpen && (
          <div className="overflow-y-auto p-4 space-y-3">
            {/* Safe Destinations Subtab */}
            {mapSubTab === "safe_zones" && (
              <div className="space-y-2.5">
                {navigationOrigin && nearestSafeZone && (
                  <button
                    type="button"
                    onClick={chooseNearestSafeZone}
                    className="w-full p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-left hover:bg-emerald-500/20 transition flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        ⚡ Quick Evacuation
                      </span>
                      <h4 className="font-bold text-white text-base mt-0.5">{nearestSafeZone.name}</h4>
                      <p className="text-xs text-white/60">
                        Nearest safe ground • {PLACE_LABELS[nearestSafeZone.kind]}
                      </p>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs">
                      Navigate
                    </span>
                  </button>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                    Recommended Shelters & Relief
                  </p>
                  {recommendations.map(({ place, route }) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => chooseDestination(place)}
                      className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left flex items-center justify-between gap-2 transition"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-white truncate">{place.name}</p>
                        <p className="text-xs text-white/40">
                          {PLACE_LABELS[place.kind]} • {(route.distanceM / 1000).toFixed(1)} km
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-base font-bold ${scoreClass(route.safetyScore)}`}>
                          {route.safetyScore}/100
                        </span>
                        <p className="text-[10px] text-white/40">Safety</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Subtab */}
            {mapSubTab === "search" && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hospitals, shelters, police..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500"
                />

                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_SEARCHES.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setSearchQuery(chip.toLowerCase())}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 font-semibold border border-white/5"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {searchResults.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => chooseDestination(place)}
                      className="w-full p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-sm text-white truncate">{place.name}</p>
                        <p className="text-xs text-white/40">{PLACE_LABELS[place.kind]}</p>
                      </div>
                      <span className="text-xs text-emerald-400 font-semibold">Route →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Route Subtab */}
            {mapSubTab === "route" && activeRoute && destination && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Destination
                    </span>
                    <h4 className="font-bold text-white text-base">{destination.name}</h4>
                    <p className="text-xs text-white/60">
                      {(activeRoute.distanceM / 1000).toFixed(2)} km • {activeRoute.walkMinutes} min walking
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xl font-bold ${scoreClass(activeRoute.safetyScore)}`}>
                      {activeRoute.safetyScore}/100
                    </span>
                    <p className="text-[10px] text-white/40">{levelLabel(activeRoute)}</p>
                  </div>
                </div>

                {hazardWarnings.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 space-y-1">
                    <p className="font-bold">⚠️ Warning: Route intersects hazard area:</p>
                    <p>{hazardWarnings.map((w) => w.zone).join(", ")}</p>
                  </div>
                )}

                {/* Alternative Routes */}
                {routes.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                      Available Routes
                    </p>
                    <div className="flex gap-2">
                      {routes.map((r, idx) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRouteIndex(idx)}
                          className={`flex-1 p-2.5 rounded-xl border text-center text-xs transition ${
                            activeRoute.id === r.id
                              ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                              : "bg-white/5 border-white/5 text-white/60 hover:text-white"
                          }`}
                        >
                          <p>{idx === 0 ? "Safest Route" : `Alt ${idx}`}</p>
                          <p className={`font-bold mt-0.5 ${scoreClass(r.safetyScore)}`}>
                            {r.safetyScore}/100
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
