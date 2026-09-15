/**
 * Cloud sync: pull the latest hazard dataset when a network is available and
 * cache it locally. When the network disappears the app keeps using the last
 * synced dataset, always labelled with its age and source.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Place, Zone } from "@/data/city";
import { loadLocal, saveLocal } from "./local-cache";

export interface FloodAlert {
  id: string;
  title: string;
  message: string;
  severity: "info" | "watch" | "warning" | "severe";
  area: string | null;
  water_level_m: number | null;
  source: string;
  issued_at: string;
}

export interface RoadClosure {
  id: string;
  road_name: string;
  reason: string | null;
  lat: number;
  lng: number;
  passable: boolean;
  source: string;
  reported_at: string;
}

export interface ShelterStatus {
  id: string;
  name: string;
  kind: Place["kind"];
  lat: number;
  lng: number;
  capacity: number | null;
  occupancy: number | null;
  is_open: boolean;
  contact: string | null;
  source: string;
  updated_at: string;
}

export interface SensorTelemetry {
  id: string;
  device_id: string;
  water_distance_cm: number;
  flood_risk: string;
  earthquake_level: number;
  earthquake_risk: string;
  air_quality: number;
  air_risk: string;
  water_quality: number;
  water_risk: string;
  mode: string;
  created_at: string;
}

export interface SyncedDataset {
  zones: Zone[];
  alerts: FloodAlert[];
  closures: RoadClosure[];
  shelters: ShelterStatus[];
  telemetry: SensorTelemetry | null;
  syncedAt: string;
}

const CACHE_KEY = "dataset";

export function createDemoTelemetry(now = Date.now()): SensorTelemetry {
  const t = now / 1000;
  const airQuality = Math.max(18, Math.min(96, Math.round(34 + Math.sin(t / 18) * 18 + Math.cos(t / 34) * 9)));
  const waterDistanceCm = Math.max(70, Math.min(175, Math.round(142 + Math.sin(t / 16) * 20 + Math.cos(t / 27) * 10)));
  const earthquakeLevel = Math.max(0, Math.min(3, Math.round(Math.abs(Math.sin(t / 14)) * 2)));
  const waterQuality = Number((7.1 + Math.sin(t / 20) * 0.45).toFixed(1));

  const floodRisk = waterDistanceCm < 115 ? "high" : waterDistanceCm < 130 ? "moderate" : "low";
  const airRisk = airQuality < 50 ? "Good" : airQuality < 90 ? "Moderate" : "Poor";
  const waterRisk = waterQuality < 6.5 || waterQuality > 8.5 ? "Unsafe" : "Safe";
  const earthquakeRisk = earthquakeLevel >= 2 ? "Elevated" : "Stable";

  return {
    id: "demo-sensor-telemetry",
    device_id: "ENVIRO-001",
    water_distance_cm: waterDistanceCm,
    flood_risk: floodRisk,
    earthquake_level: earthquakeLevel,
    earthquake_risk: earthquakeRisk,
    air_quality: airQuality,
    air_risk: airRisk,
    water_quality: waterQuality,
    water_risk: waterRisk,
    mode: "demo",
    created_at: new Date(now).toISOString(),
  };
}

export function loadCachedDataset(): SyncedDataset | null {
  return loadLocal<SyncedDataset | null>(CACHE_KEY, null);
}

export async function syncDataset(): Promise<SyncedDataset> {
  const [zonesRes, alertsRes, closuresRes, sheltersRes, telemetryRes] = await Promise.all([
    supabase.from("hazard_zones").select("*"),
    supabase.from("flood_alerts").select("*").order("issued_at", { ascending: false }),
    supabase.from("road_closures").select("*").order("reported_at", { ascending: false }),
    supabase.from("shelters").select("*"),
    supabase
      .from("sensor_telemetry")
      .select("*")
      .eq("device_id", "ENVIRO-001")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // The live device feed is essential. Map tables are optional because a new
  // Supabase project may not have received the offline-map migration yet.
  // The app already has safe built-in map data to use in that case.
  if (telemetryRes.error) throw new Error(telemetryRes.error.message);

  const zones: Zone[] = (zonesRes.data ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    risk: z.risk as Zone["risk"],
    reason: z.reason ?? "",
    polygon: z.polygon as [number, number][],
    source: z.source,
    reportedAt: z.reported_at,
  }));

  const dataset: SyncedDataset = {
    zones,
    alerts: (alertsRes.data ?? []) as FloodAlert[],
    closures: (closuresRes.data ?? []) as RoadClosure[],
    shelters: (sheltersRes.data ?? []) as ShelterStatus[],
    telemetry: (telemetryRes.data as SensorTelemetry | null) ?? createDemoTelemetry(),
    syncedAt: new Date().toISOString(),
  };

  saveLocal(CACHE_KEY, dataset);
  return dataset;
}
