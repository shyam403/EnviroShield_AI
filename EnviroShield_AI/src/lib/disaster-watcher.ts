export type WatcherSeverity =
  | "safe"
  | "caution"
  | "high"
  | "critical";

export type WatcherEvent =
  | "initial"
  | "risk-increased"
  | "risk-decreased"
  | "route-became-unsafe"
  | "route-improved"
  | "gps-outside-map"
  | "gps-restored"
  | "safe-zone-near"
  | "monitoring";

export interface DisasterWatcherInput {
  online: boolean;
  gpsAvailable: boolean;
  gpsOutsideMap: boolean;

  risk: "none" | "green" | "yellow" | "red";

  hazardAhead: boolean;

  routeSafetyScore: number | null;
  dangerousSections: number;

  remainingDistanceM: number | null;

  nearestSafeZoneName: string | null;
  nearestSafeZoneDistanceM: number | null;
}

export interface DisasterWatcherAlert {
  id: string;
  event: WatcherEvent;
  severity: WatcherSeverity;
  title: string;
  message: string;
  actions: string[];
  timestamp: number;
  mode: "online" | "offline";
  priority: "low" | "medium" | "high" | "urgent";
}

export interface DisasterWatcherState {
  severity: WatcherSeverity;
  score: number;
  event: WatcherEvent;
  monitoring: boolean;
  lastCheckedAt: number;
  alert: DisasterWatcherAlert | null;
}

interface PreviousSnapshot {
  score: number;
  severity: WatcherSeverity;
  risk: DisasterWatcherInput["risk"];
  hazardAhead: boolean;
  routeSafetyScore: number | null;
  dangerousSections: number;
  gpsOutsideMap: boolean;
}

const ALERT_COOLDOWN_MS = 90_000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function severityFromScore(score: number): WatcherSeverity {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "caution";
  return "safe";
}

function riskScore(risk: DisasterWatcherInput["risk"]) {
  switch (risk) {
    case "red":
      return 45;
    case "yellow":
      return 25;
    case "green":
      return 5;
    default:
      return 0;
  }
}

function createAlert(
  input: DisasterWatcherInput,
  event: WatcherEvent,
  severity: WatcherSeverity,
  score: number,
  now: number,
): DisasterWatcherAlert {
  const mode = input.online ? "online" : "offline";

  let title = "Situation monitored";
  let message = "No immediate change detected.";
  let actions: string[] = [];
  let priority: DisasterWatcherAlert["priority"] = "low";

  if (event === "risk-increased") {
    title = "Flood risk increased";
    message = `Local risk conditions have changed to ${input.risk.toUpperCase()}.`;
    actions = [
      "Review the safest available route.",
      "Avoid marked danger zones.",
    ];
    priority = severity === "critical" ? "urgent" : "high";
  }

  if (event === "route-became-unsafe") {
    title = "Route safety changed";
    message =
      input.routeSafetyScore !== null
        ? `Current route safety is ${Math.round(input.routeSafetyScore)}/100.`
        : "The current route now contains dangerous sections.";
    actions = [
      "Check an alternate safe route.",
      "Avoid flooded or unsafe sections.",
    ];
    priority = "high";
  }

  if (event === "gps-outside-map") {
    title = "GPS outside offline coverage";
    message =
      "Your current GPS position is outside the stored offline map area.";
    actions = [
      "Set your position manually if you know where you are.",
      "Do not rely on offline route guidance outside the stored area.",
    ];
    priority = "medium";
  }

  if (event === "gps-restored") {
    title = "GPS coverage restored";
    message = "Your position is back inside the stored offline map.";
    actions = ["Continue monitoring your route."];
    priority = "low";
  }

  if (event === "safe-zone-near") {
    title = "Safe zone nearby";
    message =
      input.nearestSafeZoneName && input.nearestSafeZoneDistanceM !== null
        ? `${input.nearestSafeZoneName} is approximately ${Math.round(
            input.nearestSafeZoneDistanceM,
          )} m away.`
        : "A stored safe zone is nearby.";
    actions = ["Review the safe zone before proceeding."];
    priority = "medium";
  }

  if (event === "risk-decreased") {
    title = "Risk level improved";
    message = "The monitored local risk level has decreased.";
    actions = ["Continue monitoring conditions."];
    priority = "low";
  }

  if (event === "route-improved") {
    title = "Route safety improved";
    message = "The current route conditions are better than the previous check.";
    actions = ["Continue using the safest available route."];
    priority = "low";
  }

  if (event === "initial") {
    title =
      severity === "safe"
        ? "Area currently monitored as safe"
        : "Initial risk assessment complete";

    message =
      severity === "safe"
        ? "No significant local warning signal is currently detected."
        : `Current AI watcher score is ${Math.round(score)}/100.`;

    actions =
      severity === "safe"
        ? ["Continue monitoring while travelling."]
        : ["Review the current route and nearby safe zones."];

    priority = severity === "critical" ? "urgent" : "medium";
  }

  return {
    id: `${event}-${now}`,
    event,
    severity,
    title,
    message,
    actions,
    timestamp: now,
    mode,
    priority,
  };
}

export class DisasterWatcher {
  private previous: PreviousSnapshot | null = null;
  private lastAlertAt = 0;
  private lastAlertKey = "";
  private monitoring = false;

  start() {
    this.monitoring = true;
  }

  stop() {
    this.monitoring = false;
  }

  isMonitoring() {
    return this.monitoring;
  }

  reset() {
    this.previous = null;
    this.lastAlertAt = 0;
    this.lastAlertKey = "";
  }

  evaluate(
    input: DisasterWatcherInput,
    now = Date.now(),
  ): DisasterWatcherState {
    let score = riskScore(input.risk);

    if (!input.gpsAvailable) {
      score += 8;
    }

    if (input.gpsOutsideMap) {
      score += 18;
    }

    if (input.hazardAhead) {
      score += 20;
    }

    if (input.routeSafetyScore !== null) {
      score += clamp(100 - input.routeSafetyScore, 0, 45) * 0.65;
    }

    score += Math.min(input.dangerousSections * 8, 24);

    if (
      input.nearestSafeZoneDistanceM !== null &&
      input.nearestSafeZoneDistanceM < 1000
    ) {
      score -= 5;
    }

    score = Math.round(clamp(score, 0, 100));

    const severity = severityFromScore(score);

    let event: WatcherEvent = "monitoring";

    if (!this.previous) {
      event = "initial";
    } else if (
      !this.previous.gpsOutsideMap &&
      input.gpsOutsideMap
    ) {
      event = "gps-outside-map";
    } else if (
      this.previous.gpsOutsideMap &&
      !input.gpsOutsideMap
    ) {
      event = "gps-restored";
    } else if (
      score - this.previous.score >= 12 ||
      (input.risk === "red" &&
        this.previous.risk !== "red")
    ) {
      event = "risk-increased";
    } else if (
      this.previous.risk !== "none" &&
      input.risk === "none"
    ) {
      event = "risk-decreased";
    } else if (
      this.previous.routeSafetyScore !== null &&
      input.routeSafetyScore !== null &&
      this.previous.routeSafetyScore >= 60 &&
      input.routeSafetyScore < 45
    ) {
      event = "route-became-unsafe";
    } else if (
      this.previous.routeSafetyScore !== null &&
      input.routeSafetyScore !== null &&
      this.previous.routeSafetyScore < 45 &&
      input.routeSafetyScore >= 60
    ) {
      event = "route-improved";
    } else if (
      input.nearestSafeZoneDistanceM !== null &&
      input.nearestSafeZoneDistanceM < 750 &&
      (this.previous === null ||
        this.previous.score >= score)
    ) {
      event = "safe-zone-near";
    }

    const alertKey = `${event}:${severity}:${input.risk}`;

    const shouldAlert =
      event !== "monitoring" &&
      (now - this.lastAlertAt >= ALERT_COOLDOWN_MS ||
        alertKey !== this.lastAlertKey);

    const alert = shouldAlert
      ? createAlert(input, event, severity, score, now)
      : null;

    if (alert) {
      this.lastAlertAt = now;
      this.lastAlertKey = alertKey;
    }

    this.previous = {
      score,
      severity,
      risk: input.risk,
      hazardAhead: input.hazardAhead,
      routeSafetyScore: input.routeSafetyScore,
      dangerousSections: input.dangerousSections,
      gpsOutsideMap: input.gpsOutsideMap,
    };

    return {
      severity,
      score,
      event,
      monitoring: this.monitoring,
      lastCheckedAt: now,
      alert,
    };
  }
}

export function createDisasterWatcher() {
  const watcher = new DisasterWatcher();
  watcher.start();
  return watcher;
}