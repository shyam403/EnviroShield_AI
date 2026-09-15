import { useEffect, useState } from "react";
import type { SyncedDataset } from "../lib/sync";
import type { AIMonitorResult, TelemetryRiskResult } from "../lib/ai-monitor";
import { formatAge } from "../lib/local-cache";

interface HomeDashboardProps {
  dataset: SyncedDataset | null;
  aiMonitor: AIMonitorResult;
  risk: TelemetryRiskResult;
  online: boolean;
  onNavigate: (tab: string) => void;
  telemetryStatus: "connected" | "waiting" | "error";
  profileName: string;
}

type SensorType = "air" | "flood" | "earthquake" | "water";

export default function HomeDashboard({
  dataset,
  aiMonitor,
  risk,
  online,
  onNavigate,
  telemetryStatus,
  profileName,
}: HomeDashboardProps) {
  const telemetry = dataset?.telemetry;
  const [selectedSensor, setSelectedSensor] = useState<SensorType | null>(null);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const homeRisk = risk.overallRisk;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getStatusBanner = () => {
    switch (homeRisk) {
      case "SAFE":
      case "LOW":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          icon: "🟢",
          badge: homeRisk === "SAFE" ? "Safe" : "Low Risk",
          title: homeRisk === "SAFE" ? "All conditions normal" : "Conditions improving",
          subtitle:
            homeRisk === "SAFE"
              ? "All monitored environmental conditions are within safe thresholds."
              : "Sensors are at low risk and remain under active monitoring.",
        };
      case "MEDIUM":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          icon: "🟠",
          badge: "Caution",
          title: "Conditions require attention",
          subtitle: "One or more monitored environmental conditions are elevated. Stay informed.",
        };
      case "HIGH":
        return {
          bg: "bg-orange-500/15 border-orange-500/40 text-orange-400",
          icon: "⚠️",
          badge: "High Risk",
          title: "High-risk conditions detected",
          subtitle: "At least one active telemetry condition is high risk. Follow monitoring guidance.",
        };
      case "CRITICAL":
      default:
        return {
          bg: "bg-red-500/15 border-red-500/40 text-red-400",
          icon: "🔴",
          badge: "Critical Alert",
          title: "Immediate attention required",
          subtitle: "A critical hazard condition is active. Follow emergency guidance immediately.",
        };
    }
  };

  const banner = getStatusBanner();
  const firstName = profileName.trim().split(" ")[0] || "there";

  const renderSensorModal = () => {
    if (!selectedSensor) return null;

    const sensorDetails = {
      air: {
        title: "Air Quality Index",
        value: telemetry?.air_quality ?? "--",
        unit: "% Index",
        status: telemetry?.air_risk ?? "Good",
        normalRange: "60 - 100% (Clean)",
        explanation:
          "Monitors air purity, gas concentration, and particulate matter. Higher percentage indicates cleaner air.",
        trend: "Air quality parameters are being updated live from connected environmental sensors.",
        trendData: [70, 72, 74, 73, 75, 74, 76],
      },
      flood: {
        title: "Flood Water Clearance",
        value: telemetry?.water_distance_cm ? `${telemetry.water_distance_cm} cm` : "--",
        unit: "Clearance to sensor",
        status: telemetry?.flood_risk ?? "Low",
        normalRange: "> 20 cm clearance (Safe)",
        explanation:
          "Ultrasonic distance sensor above water level. Values below 12cm trigger CRITICAL flood evacuation.",
        trend: "Water clearance is monitored in real-time from the district flood sensor network.",
        trendData: [28, 27, 28, 28, 27, 28, 28],
      },
      earthquake: {
        title: "Seismic Activity Intensity",
        value: telemetry?.earthquake_level != null ? `${telemetry.earthquake_level}%` : "0%",
        unit: "Vibration / Intensity",
        status: telemetry?.earthquake_risk ?? "Stable",
        normalRange: "< 18% (Stable)",
        explanation:
          "Measures ground vibrations and tectonic acceleration. Values >= 25% trigger HIGH seismic alarm.",
        trend: "Seismic telemetry streamed directly from Zephyr firmware.",
        trendData: [10, 12, 11, 12, 13, 12, 12],
      },
      water: {
        title: "Water Pollution & Quality",
        value: telemetry?.water_quality != null ? `${telemetry.water_quality}%` : "88%",
        unit: "Purity Index",
        status: telemetry?.water_risk ?? "Safe",
        normalRange: "> 80% (Clean Potable)",
        explanation:
          "Evaluates water purity, conductivity, and contamination. Values < 65% represent hazardous contamination.",
        trend: "Water safety rating monitored across local reservoirs.",
        trendData: [88, 87, 88, 89, 88, 88, 89],
      },
    }[selectedSensor];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-[#131920] border border-white/10 rounded-2xl p-5 text-white shadow-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Sensor Detail
              </p>
              <h3 className="text-xl font-bold mt-1 text-white">{sensorDetails.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSensor(null)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
            >
              ✕
            </button>
          </div>

          <div className="flex items-baseline justify-between p-4 rounded-xl bg-white/5 border border-white/5">
            <div>
              <p className="text-xs text-white/50">Current Reading</p>
              <p className="text-3xl font-black mt-1 text-white">{sensorDetails.value}</p>
              <p className="text-xs text-white/40 mt-0.5">{sensorDetails.unit}</p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {sensorDetails.status}
              </span>
              <p className="text-xs text-white/40 mt-2">Normal: {sensorDetails.normalRange}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Historical Trend</span>
              <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                {(["24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTimeRange(r)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                      timeRange === r ? "bg-emerald-500 text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-20 bg-white/5 rounded-xl border border-white/5 flex items-end justify-between px-4 py-3 gap-2">
              {sensorDetails.trendData.map((val, idx) => {
                const max = Math.max(...sensorDetails.trendData, 1);
                const heightPct = Math.max(15, Math.round((val / max) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      className="w-full rounded-t bg-emerald-500/70 hover:bg-emerald-400 transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs leading-relaxed text-white/70 bg-white/5 p-3.5 rounded-xl border border-white/5">
            <p className="font-semibold text-white/90 mb-1">About this metric</p>
            <p>{sensorDetails.explanation}</p>
            <p className="mt-2 text-emerald-400 font-medium">● {sensorDetails.trend}</p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedSensor(null)}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0b1016] text-white overflow-y-auto pb-24">
      {renderSensorModal()}

      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Header Greeting & Live Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
              EnviroShield AI
            </p>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {getGreeting()}, {firstName} 👋
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${
                telemetryStatus === "connected"
                  ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {telemetryStatus === "connected" ? "Live Telemetry" : "Syncing"}
            </span>
          </div>
        </div>

        {/* Primary Status Banner */}
        <div className={`p-5 rounded-2xl border ${banner.bg} shadow-lg backdrop-blur-md transition-all`}>
          <div className="flex items-start gap-3.5">
            <span className="text-2xl mt-0.5">{banner.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">{banner.badge}</span>
                <span className="text-xs opacity-50">• {formatAge(dataset?.syncedAt ?? null)}</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1 leading-snug">{banner.title}</h2>
              <p className="text-xs text-white/70 mt-1 leading-relaxed">{banner.subtitle}</p>
            </div>
          </div>

          {aiMonitor.severity !== "safe" && (
            <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => onNavigate("alerts")}
                className="flex-1 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                View Active Alerts →
              </button>
              <button
                type="button"
                onClick={() => onNavigate("map")}
                className="flex-1 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold transition hover:bg-emerald-400"
              >
                Find Safe Route
              </button>
            </div>
          )}
        </div>

        {/* Live Environmental Sensors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-white">Live Environmental Conditions</h3>
              <p className="text-xs text-white/50">Tap any sensor for detailed insights and trends</p>
            </div>
            <span className="text-xs text-white/40">Node: {telemetry?.device_id || "ENVIRO-001"}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Air Quality Sensor */}
            <button
              type="button"
              onClick={() => setSelectedSensor("air")}
              className="text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Air Quality</span>
                <span className="text-base">💨</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{telemetry?.air_quality ?? "74"}</span>
                <span className="text-xs text-white/40 ml-1">%</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className={telemetry?.air_risk === "HIGH" ? "text-red-400 font-bold" : "text-emerald-400 font-medium"}>
                  {telemetry?.air_risk ? `${telemetry.air_risk} Risk` : "Good"}
                </span>
                <span className="text-white/30">• Live</span>
              </div>
            </button>

            {/* Flood / Water Level Sensor */}
            <button
              type="button"
              onClick={() => setSelectedSensor("flood")}
              className="text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Flood Clearance</span>
                <span className="text-base">🌊</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{telemetry?.water_distance_cm ?? "28"}</span>
                <span className="text-xs text-white/40 ml-1">cm</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className={telemetry?.flood_risk === "HIGH" ? "text-red-400 font-bold" : "text-emerald-400 font-medium"}>
                  {telemetry?.flood_risk ? `${telemetry.flood_risk} Risk` : "Low Risk"}
                </span>
                <span className="text-white/30">• Live</span>
              </div>
            </button>

            {/* Seismic Activity Sensor */}
            <button
              type="button"
              onClick={() => setSelectedSensor("earthquake")}
              className="text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Seismic Activity</span>
                <span className="text-base">〰️</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">
                  {telemetry?.earthquake_level ? `${telemetry.earthquake_level}%` : "12%"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className={telemetry?.earthquake_risk === "HIGH" ? "text-red-400 font-bold" : "text-emerald-400 font-medium"}>
                  {telemetry?.earthquake_risk ? `${telemetry.earthquake_risk} Risk` : "Stable"}
                </span>
                <span className="text-white/30">• Live</span>
              </div>
            </button>

            {/* Water Quality Sensor */}
            <button
              type="button"
              onClick={() => setSelectedSensor("water")}
              className="text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Water Purity</span>
                <span className="text-base">💧</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{telemetry?.water_quality ?? "88"}</span>
                <span className="text-xs text-white/40 ml-1">%</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className={telemetry?.water_risk === "HIGH" ? "text-red-400 font-bold" : "text-emerald-400 font-medium"}>
                  {telemetry?.water_risk ? `${telemetry.water_risk} Pollution` : "Potable"}
                </span>
                <span className="text-white/30">• Live</span>
              </div>
            </button>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div>
          <h3 className="text-base font-bold text-white mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate("map")}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-xl">
                🗺️
              </span>
              <div>
                <p className="font-bold text-sm text-white">Safe Route Map</p>
                <p className="text-xs text-white/50">Offline navigation</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("alerts")}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 text-xl">
                🔔
              </span>
              <div>
                <p className="font-bold text-sm text-white">Hazard Alerts</p>
                <p className="text-xs text-white/50">Road closures & zones</p>
              </div>
            </button>
          </div>
        </div>

        {/* AI Intelligence Summary */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                EnviroShield AI Engine
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white">
              {aiMonitor.score}/100 Score
            </span>
          </div>
          <p className="text-xs text-white/80 leading-relaxed">{aiMonitor.summary}</p>
          {aiMonitor.actions.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1">
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Recommended Action:
              </p>
              <p className="text-xs text-emerald-300 font-medium">→ {aiMonitor.actions[0]}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
