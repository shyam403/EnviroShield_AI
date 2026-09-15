export type LocalRisk = "none" | "green" | "yellow" | "red";
export type AIMode = "online" | "offline";
export type AISeverity = "safe" | "caution" | "high" | "critical";
export type RiskLevel = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TelemetryRiskInput = {
  water_distance_cm?: number | null;
  flood_risk?: string | null;
  earthquake_level?: number | null;
  earthquake_risk?: string | null;
  air_quality?: number | null;
  air_risk?: string | null;
  water_quality?: number | null;
  water_risk?: string | null;
  mode?: string | null;
  created_at?: string | null;
};

export interface TelemetryAlert {
  id: string;
  type: string;
  sensor: string;
  value: string;
  risk: RiskLevel;
  severity: "info" | "watch" | "warning" | "severe";
  message: string;
  source: string;
  timestamp: string;
}

export interface TelemetryRiskResult {
  overallRisk: RiskLevel;
  isSafe: boolean;
  severity: AISeverity;
  alerts: TelemetryAlert[];
  reason: string;
  dominantRisk: string | null;
}

export interface AIMonitorInput {
  online: boolean;
  datasetAvailable: boolean;
  gpsAvailable: boolean;
  gpsOutsideMap: boolean;
  risk: LocalRisk;
  hazardAhead: boolean;
  routeSafetyScore: number | null;
  dangerousSections: number;
  remainingDistanceM: number | null;
  nearestSafeZoneName: string | null;
  nearestSafeZoneDistanceM: number | null;
  dataFreshness: string;
}

export interface AIMonitorResult {
  mode: AIMode;
  severity: AISeverity;
  score: number;
  title: string;
  summary: string;
  actions: string[];
  signals: string[];
  confidence: "high" | "medium" | "limited";
  updatedAt: number;
  sourceLabel: string;
}

const RISK_PRIORITY: Record<RiskLevel, number> = {
  SAFE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const normalizeRisk = (value?: string | null): RiskLevel => {
  if (!value) return "SAFE";

  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case "CRITICAL":
    case "SEVERE":
      return "CRITICAL";
    case "HIGH":
    case "RED":
    case "DANGEROUS":
      return "HIGH";
    case "MEDIUM":
    case "MODERATE":
    case "YELLOW":
    case "ELEVATED":
    case "WARNING":
      return "MEDIUM";
    case "LOW":
    case "SAFE":
    case "STABLE":
    case "GOOD":
    case "NORMAL":
    case "POOR":
    case "UNSAFE":
      return normalized === "POOR" || normalized === "UNSAFE" ? "MEDIUM" : "LOW";
    default:
      if (/^HIGH|^CRIT|^SEVERE/.test(normalized)) return "HIGH";
      if (/^MED|^MOD|^WARN|^ELEV/.test(normalized)) return "MEDIUM";
      if (/^LOW|^SAFE|^GOOD|^STABLE/.test(normalized)) return "LOW";
      return "SAFE";
  }
};

const riskToSeverity = (risk: RiskLevel): AISeverity => {
  switch (risk) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "caution";
    default:
      return "safe";
  }
};

const parseNumber = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return null;
  return value;
};

const deriveRiskFromValue = (field: "flood" | "air" | "water" | "earthquake", value: number | null): RiskLevel => {
  if (value == null) return "SAFE";

  switch (field) {
    case "flood":
      if (value <= 8) return "CRITICAL";
      if (value <= 12) return "HIGH";
      if (value <= 20) return "MEDIUM";
      return "LOW";
    case "air":
      if (value <= 45) return "HIGH";
      if (value <= 60) return "MEDIUM";
      return "LOW";
    case "water":
      if (value <= 55) return "HIGH";
      if (value <= 70) return "MEDIUM";
      return "LOW";
    case "earthquake":
      if (value >= 30) return "HIGH";
      if (value >= 18) return "MEDIUM";
      return "LOW";
    default:
      return "SAFE";
  }
};

export function evaluateOverallRisk(telemetry: TelemetryRiskInput | null | undefined): TelemetryRiskResult {
  const current = telemetry ?? {};

  const floodRisk = normalizeRisk(current.flood_risk ?? (current.water_distance_cm != null ? deriveRiskFromValue("flood", current.water_distance_cm) : undefined));
  const airRisk = normalizeRisk(current.air_risk ?? (current.air_quality != null ? deriveRiskFromValue("air", current.air_quality) : undefined));
  const waterRisk = normalizeRisk(current.water_risk ?? (current.water_quality != null ? deriveRiskFromValue("water", current.water_quality) : undefined));
  const earthquakeRisk = normalizeRisk(
    current.earthquake_risk ?? (current.earthquake_level != null ? deriveRiskFromValue("earthquake", current.earthquake_level) : undefined),
  );

  const riskValues = [floodRisk, airRisk, waterRisk, earthquakeRisk];
  const overallRisk = riskValues.reduce((highest, candidate) => {
    if (RISK_PRIORITY[candidate] > RISK_PRIORITY[highest]) return candidate;
    return highest;
  }, "SAFE" as RiskLevel);

  const timestamp = current.created_at ?? new Date().toISOString();
  const alerts: TelemetryAlert[] = [];

  const pushAlert = (type: string, sensor: string, value: number | string | null, risk: RiskLevel, message: string, source: string) => {
    if (risk === "LOW" || risk === "SAFE") return;

    alerts.push({
      id: `${sensor}-${type}-${timestamp}`,
      type,
      sensor,
      value: value == null ? "--" : String(value),
      risk,
      severity: risk === "CRITICAL" ? "severe" : risk === "HIGH" ? "warning" : "watch",
      message,
      source,
      timestamp,
    });
  };

  const waterDistance = parseNumber(current.water_distance_cm);
  const airQuality = parseNumber(current.air_quality);
  const waterQuality = parseNumber(current.water_quality);
  const earthquakeLevel = parseNumber(current.earthquake_level);

  if (waterDistance != null) {
    pushAlert(
      "Flood",
      "water_distance_cm",
      `${waterDistance} cm`,
      deriveRiskFromValue("flood", waterDistance),
      waterDistance <= 8
        ? "Water clearance is critically low. Immediate evacuation is recommended."
        : waterDistance <= 12
          ? "Floodwater is approaching a high-risk threshold. Move to higher ground."
          : "Water clearance is elevated and requires monitoring.",
      "telemetry",
    );
  }

  if (airQuality != null) {
    pushAlert(
      "Air Pollution",
      "air_quality",
      `${airQuality}`,
      deriveRiskFromValue("air", airQuality),
      airQuality <= 45
        ? "Air quality is dangerously poor and may affect breathing."
        : "Air quality is elevated and requires attention.",
      "telemetry",
    );
  }

  if (waterQuality != null) {
    pushAlert(
      "Water Pollution",
      "water_quality",
      `${waterQuality}`,
      deriveRiskFromValue("water", waterQuality),
      waterQuality <= 55
        ? "Water quality is hazardous and not suitable for safe use."
        : "Water quality is deteriorating and should be monitored.",
      "telemetry",
    );
  }

  if (earthquakeLevel != null) {
    pushAlert(
      "Earthquake",
      "earthquake_level",
      `${earthquakeLevel}%`,
      deriveRiskFromValue("earthquake", earthquakeLevel),
      earthquakeLevel >= 30
        ? "Seismic activity is high and may indicate a developing hazard."
        : "Seismic activity is elevated and should stay under observation.",
      "telemetry",
    );
  }

  const activeAlerts = alerts.filter((alert) => alert.risk !== "LOW" && alert.risk !== "SAFE");

  const dominantRisk = activeAlerts.length
    ? activeAlerts.reduce((highest, candidate) => {
        if (RISK_PRIORITY[candidate.risk] > RISK_PRIORITY[highest.risk]) return candidate;
        return highest;
      }, activeAlerts[0]).risk
    : null;

  const reason =
    overallRisk === "SAFE"
      ? "No active sensor conditions exceed safe thresholds."
      : `${overallRisk} risk detected across active telemetry conditions.`;

  return {
    overallRisk,
    isSafe: overallRisk === "SAFE" || overallRisk === "LOW",
    severity: riskToSeverity(overallRisk),
    alerts: activeAlerts,
    reason,
    dominantRisk,
  };
}

/**
 * EnviroShield AI Monitor V1
 *
 * This is deliberately an on-device decision engine. It works without
 * internet and becomes more current when online dataset synchronization
 * succeeds. It never invents live hazard information.
 */
export function assessSituation(input: AIMonitorInput, now = Date.now()): AIMonitorResult {
  const mode: AIMode = input.online && input.datasetAvailable ? "online" : "offline";
  const signals: string[] = [];
  const actions: string[] = [];

  let score = 100;

  if (!input.gpsAvailable) {
    score -= 18;
    signals.push("GPS position is unavailable");
    actions.push("Set your position manually on the stored map");
  } else if (input.gpsOutsideMap) {
    score -= 12;
    signals.push("Live GPS is outside the stored offline map");
    actions.push("Do not use long-distance offline routing from this GPS position");
    actions.push("Select a valid position on the stored map before routing");
  } else {
    signals.push("Position is available for local assessment");
  }

  if (input.risk === "red") {
    score -= 42;
    signals.push("Current stored zone is high risk");
    actions.push("Move away from the high-risk zone toward safer or elevated ground");
  } else if (input.risk === "yellow") {
    score -= 22;
    signals.push("Current stored zone requires caution");
    actions.push("Prefer a safer route and avoid low-lying or blocked sections");
  } else if (input.risk === "green") {
    signals.push("Current stored zone is marked safer / elevated");
  } else {
    signals.push("No stored hazard zone is currently assigned to this position");
  }

  if (input.hazardAhead) {
    score -= 30;
    signals.push("Selected route contains a hazard ahead");
    actions.push("Use the safer alternative route if one is available");
  }

  if (input.routeSafetyScore != null) {
    if (input.routeSafetyScore < 50) {
      score -= 24;
      signals.push(`Current route safety score is ${input.routeSafetyScore}/100`);
    } else if (input.routeSafetyScore < 78) {
      score -= 10;
      signals.push(`Current route safety score is ${input.routeSafetyScore}/100`);
    } else {
      signals.push(`Current route safety score is ${input.routeSafetyScore}/100`);
    }
  }

  if (input.dangerousSections > 0) {
    score -= Math.min(18, input.dangerousSections * 6);
    signals.push(`${input.dangerousSections} dangerous route section${input.dangerousSections === 1 ? "" : "s"} detected`);
  }

  if (input.nearestSafeZoneName && input.nearestSafeZoneDistanceM != null) {
    const distanceKm = input.nearestSafeZoneDistanceM / 1000;
    signals.push(`Nearest stored safe zone: ${input.nearestSafeZoneName} (${distanceKm.toFixed(1)} km)`);
    if (input.risk === "red" || input.hazardAhead) {
      actions.push(`Consider ${input.nearestSafeZoneName} as the next safe destination`);
    }
  }

  if (mode === "offline") {
    signals.push("Assessment is running locally from stored/cached disaster data");
  } else {
    signals.push(`Online data available · ${input.dataFreshness}`);
  }

  score = Math.max(0, Math.min(100, score));

  let severity: AISeverity = "safe";
  let title = "Conditions look stable";
  let summary = "No high-priority hazard signal is currently detected in the stored disaster data.";
  let confidence: AIMonitorResult["confidence"] = mode === "online" ? "high" : "medium";

  if (score < 35 || input.risk === "red" && input.hazardAhead) {
    severity = "critical";
    title = "Immediate caution required";
    summary = "Multiple high-risk signals are active. Avoid hazardous sections and move toward a safer destination.";
  } else if (score < 60 || input.risk === "red" || input.hazardAhead) {
    severity = "high";
    title = "High-risk conditions detected";
    summary = "The current stored data indicates a significant hazard. Prefer the safest available route and avoid red-zone sections.";
  } else if (score < 80 || input.risk === "yellow" || input.dangerousSections > 0) {
    severity = "caution";
    title = "Stay alert";
    summary = "Caution signals are present. Keep monitoring the route and prefer safer or elevated areas.";
  }

  if (!input.datasetAvailable) {
    confidence = "limited";
    summary += " The stored disaster dataset is limited, so this assessment should not be treated as a live official warning.";
  }

  if (!input.gpsAvailable || input.gpsOutsideMap) {
    confidence = "limited";
  }

  return {
    mode,
    severity,
    score,
    title,
    summary,
    actions: Array.from(new Set(actions)).slice(0, 3),
    signals: Array.from(new Set(signals)).slice(0, 6),
    confidence,
    updatedAt: now,
    sourceLabel:
      mode === "online"
        ? "Local AI + latest synced disaster dataset"
        : "Local AI + stored offline disaster dataset",
  };
}
