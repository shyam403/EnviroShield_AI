export type ForestFireRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ForestFireMode = "AUTO" | "NORMAL" | "ELEVATED" | "FIRE" | "MANUAL";

export interface ForestFireThresholds {
  normalMaxC: number;
  elevatedMinC: number;
  elevatedMaxC: number;
  highMinC: number;
  highMaxC: number;
  criticalMinC: number;
  criticalIntensity: number;
  highIntensity: number;
  mediumIntensity: number;
  highConfidence: number;
  criticalConfidence: number;
}

export interface ForestFireTelemetry {
  device_id: string;
  temperature: number;
  thermal_intensity: number;
  fire_detected: boolean;
  fire_confidence: number;
  latitude: number;
  longitude: number;
  fire_risk: ForestFireRiskLevel;
  created_at: string;
  mode: ForestFireMode | string;
}

export interface ForestFireMapMarker {
  id: string;
  location: { lat: number; lng: number };
  risk: ForestFireRiskLevel;
  temperature: number;
  confidence: number;
  timestamp: string;
}

export const DEFAULT_FOREST_FIRE_THRESHOLDS: ForestFireThresholds = {
  normalMaxC: 45,
  elevatedMinC: 45,
  elevatedMaxC: 60,
  highMinC: 60,
  highMaxC: 75,
  criticalMinC: 75,
  criticalIntensity: 88,
  highIntensity: 70,
  mediumIntensity: 50,
  highConfidence: 75,
  criticalConfidence: 85,
};

export const DEFAULT_FIRE_COORDINATES = {
  latitude: 16.9891,
  longitude: 82.2475,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evaluateForestFireRisk(
  input: {
    temperature?: number | null;
    thermal_intensity?: number | null;
    fire_confidence?: number | null;
    thresholds?: Partial<ForestFireThresholds>;
  } = {},
): ForestFireRiskLevel {
  const thresholds = { ...DEFAULT_FOREST_FIRE_THRESHOLDS, ...input.thresholds };
  const temperature = typeof input.temperature === "number" ? input.temperature : 0;
  const thermalIntensity = typeof input.thermal_intensity === "number" ? input.thermal_intensity : 0;
  const confidence = typeof input.fire_confidence === "number" ? input.fire_confidence : 0;

  if (temperature >= thresholds.criticalMinC || (thermalIntensity >= thresholds.criticalIntensity && confidence >= thresholds.criticalConfidence)) {
    return "CRITICAL";
  }

  if (temperature >= thresholds.highMinC || thermalIntensity >= thresholds.highIntensity || confidence >= thresholds.highConfidence) {
    return "HIGH";
  }

  if (temperature >= thresholds.elevatedMinC || thermalIntensity >= thresholds.mediumIntensity || confidence >= 40) {
    return "MEDIUM";
  }

  return "LOW";
}

export function isForestFireDetected(
  input: {
    temperature?: number | null;
    thermal_intensity?: number | null;
    fire_confidence?: number | null;
    fire_detected?: boolean | null;
    fire_risk?: string | null;
    thresholds?: Partial<ForestFireThresholds>;
  } = {},
): boolean {
  if (input.fire_detected === true) return true;
  const risk = input.fire_risk ? String(input.fire_risk).toUpperCase() : evaluateForestFireRisk(input);
  if (risk === "HIGH" || risk === "CRITICAL") return true;

  const temperature = typeof input.temperature === "number" ? input.temperature : 0;
  const intensity = typeof input.thermal_intensity === "number" ? input.thermal_intensity : 0;
  return temperature >= DEFAULT_FOREST_FIRE_THRESHOLDS.elevatedMinC || intensity >= DEFAULT_FOREST_FIRE_THRESHOLDS.mediumIntensity;
}

export function normalizeFireRisk(value?: string | null): ForestFireRiskLevel {
  const normalized = (value ?? "LOW").trim().toUpperCase();
  switch (normalized) {
    case "CRITICAL":
    case "SEVERE":
      return "CRITICAL";
    case "HIGH":
    case "DANGEROUS":
      return "HIGH";
    case "MEDIUM":
    case "MODERATE":
    case "ELEVATED":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function createForestFireTelemetry(
  input: Partial<ForestFireTelemetry> & { mode?: ForestFireMode | string; device_id?: string },
): ForestFireTelemetry {
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 32;
  const thermalIntensity = Number.isFinite(input.thermal_intensity) ? Number(input.thermal_intensity) : 24;
  const fireConfidence = clamp(
    Number.isFinite(input.fire_confidence) ? Number(input.fire_confidence) : 12,
    0,
    100,
  );
  const latitude = Number.isFinite(input.latitude) ? Number(input.latitude) : DEFAULT_FIRE_COORDINATES.latitude;
  const longitude = Number.isFinite(input.longitude) ? Number(input.longitude) : DEFAULT_FIRE_COORDINATES.longitude;

  const risk = normalizeFireRisk(
    input.fire_risk ?? evaluateForestFireRisk({ temperature, thermal_intensity: thermalIntensity, fire_confidence: fireConfidence }),
  );
  const fireDetected =
    input.fire_detected ??
    (risk !== "LOW" ||
      temperature >= DEFAULT_FOREST_FIRE_THRESHOLDS.elevatedMinC ||
      thermalIntensity >= DEFAULT_FOREST_FIRE_THRESHOLDS.mediumIntensity);

  return {
    device_id: input.device_id ?? "THERMAL-001",
    temperature,
    thermal_intensity: clamp(thermalIntensity, 0, 100),
    fire_detected: fireDetected,
    fire_confidence: clamp(fireConfidence, 0, 100),
    latitude,
    longitude,
    fire_risk: risk,
    created_at: input.created_at ?? new Date().toISOString(),
    mode: input.mode ?? "AUTO",
  };
}

export function generateThermalDemoTelemetry(
  mode: ForestFireMode | string = "AUTO",
  now = Date.now(),
): ForestFireTelemetry {
  const t = now / 1000;
  const base = mode === "NORMAL" ? 32 : mode === "ELEVATED" ? 55 : mode === "FIRE" ? 78.5 : 36 + Math.sin(t / 22) * 11;
  const temp = mode === "NORMAL" ? 32 + Math.sin(t / 18) * 6 : mode === "ELEVATED" ? 52 + Math.sin(t / 12) * 5 : mode === "FIRE" ? 78.5 + Math.sin(t / 10) * 8 : clamp(base, 20, 88);
  const intensity = mode === "NORMAL" ? 26 : mode === "ELEVATED" ? 68 : mode === "FIRE" ? 92 : clamp(Math.round(20 + Math.sin(t / 15) * 26 + Math.cos(t / 25) * 16), 10, 100);
  const confidence = mode === "NORMAL" ? 12 : mode === "ELEVATED" ? 68 : mode === "FIRE" ? 96 : clamp(Math.round(18 + Math.abs(Math.sin(t / 13)) * 62), 0, 100);
  const risk = evaluateForestFireRisk({ temperature: temp, thermal_intensity: intensity, fire_confidence: confidence });

  return createForestFireTelemetry({
    device_id: "THERMAL-001",
    temperature: temp,
    thermal_intensity: intensity,
    fire_confidence: confidence,
    fire_detected: mode === "FIRE" || mode === "ELEVATED" || risk !== "LOW" || temp >= DEFAULT_FOREST_FIRE_THRESHOLDS.elevatedMinC,
    fire_risk: risk,
    latitude: DEFAULT_FIRE_COORDINATES.latitude,
    longitude: DEFAULT_FIRE_COORDINATES.longitude,
    created_at: new Date(now).toISOString(),
    mode,
  });
}

export function buildForestFireMapMarker(telemetry: Partial<ForestFireTelemetry> | null | undefined): ForestFireMapMarker | null {
  if (!telemetry || !telemetry.device_id) return null;
  const temperature = typeof telemetry.temperature === "number" ? telemetry.temperature : 0;
  const intensity = typeof telemetry.thermal_intensity === "number" ? telemetry.thermal_intensity : 0;
  const confidence = typeof telemetry.fire_confidence === "number" ? telemetry.fire_confidence : 0;
  const risk = normalizeFireRisk(telemetry.fire_risk ?? evaluateForestFireRisk({ temperature, thermal_intensity: intensity, fire_confidence: confidence }));
  if (!telemetry.fire_detected && risk === "LOW") return null;

  return {
    id: `${telemetry.device_id}-${telemetry.created_at ?? Date.now()}`,
    location: {
      lat: Number.isFinite(telemetry.latitude) ? Number(telemetry.latitude) : DEFAULT_FIRE_COORDINATES.latitude,
      lng: Number.isFinite(telemetry.longitude) ? Number(telemetry.longitude) : DEFAULT_FIRE_COORDINATES.longitude,
    },
    risk,
    temperature,
    confidence,
    timestamp: telemetry.created_at ?? new Date().toISOString(),
  };
}
