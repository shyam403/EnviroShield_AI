import { useState } from "react";
import type { TelemetryRiskResult } from "../lib/ai-monitor";
import { formatAge } from "../lib/local-cache";
import type { SyncedDataset } from "../lib/sync";

interface AlertsDashboardProps {
  dataset: SyncedDataset | null;
  risk: TelemetryRiskResult;
  closures: Array<{
    id: string;
    road_name: string;
    reason: string | null;
    lat: number;
    lng: number;
    passable: boolean;
    source: string;
    reported_at: string;
  }>;
  onNavigateToMap?: () => void;
}

export default function AlertsDashboard({
  dataset,
  risk,
  closures,
  onNavigateToMap,
}: AlertsDashboardProps) {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "closures">("all");
  const alerts =
    dataset?.telemetry && risk.alerts.length === 0
      ? []
      : risk.alerts.length > 0
        ? risk.alerts
        : dataset?.alerts || [];

  const getSeverityStyle = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "severe":
      case "critical":
        return {
          badge: "bg-red-500/20 text-red-400 border-red-500/30",
          border: "border-red-500/40",
          dot: "bg-red-500",
          icon: "🔴",
          label: "Critical Alert",
        };
      case "warning":
      case "high":
        return {
          badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          border: "border-orange-500/40",
          dot: "bg-orange-500",
          icon: "🟠",
          label: "Warning",
        };
      case "watch":
      case "caution":
        return {
          badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          border: "border-amber-500/30",
          dot: "bg-amber-500",
          icon: "🟡",
          label: "Advisory",
        };
      default:
        return {
          badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          border: "border-blue-500/30",
          dot: "bg-blue-500",
          icon: "ℹ️",
          label: "Notice",
        };
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "all") return true;
    if (filter === "critical") return alert.severity === "severe" || (alert.severity as string) === "critical";
    if (filter === "warning") return alert.severity === "warning" || alert.severity === "watch";
    return false;
  });

  const criticalCount = alerts.filter((a) => a.severity === "severe" || (a.severity as string) === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning" || a.severity === "watch").length;

  return (
    <div className="flex flex-col h-full bg-[#0b1016] text-white overflow-y-auto pb-24">
      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            Operational Safety Feed
          </p>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Hazard & Disaster Alerts</h1>
            <span className="text-xs text-white/50">
              Synced {formatAge(dataset?.syncedAt ?? null)}
            </span>
          </div>
        </div>

        {/* Severity Count Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filter === "all"
                ? "bg-white text-black shadow-md"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            All Alerts ({alerts.length + closures.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("critical")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filter === "critical"
                ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                : "bg-white/5 text-red-400 hover:bg-white/10"
            }`}
          >
            <span>🔴 Critical ({criticalCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("warning")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filter === "warning"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                : "bg-white/5 text-amber-400 hover:bg-white/10"
            }`}
          >
            <span>🟠 Warning ({warningCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("closures")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filter === "closures"
                ? "bg-white text-black shadow-md"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <span>🚧 Road Closures ({closures.length})</span>
          </button>
        </div>

        {/* Empty State */}
        {filteredAlerts.length === 0 && (filter !== "closures" || closures.length === 0) && (
          <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
            <div className="text-4xl">🛡️</div>
            <h3 className="text-base font-bold text-white">You're all clear</h3>
            <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
              No active disaster warnings or road closures match your filter. EnviroShield is actively
              monitoring environmental sensors.
            </p>
          </div>
        )}

        {/* Alerts List */}
        {filter !== "closures" && (
          <div className="space-y-4">
            {filteredAlerts.map((alert) => {
              const isLegacyAlert = "area" in alert && "title" in alert && "issued_at" in alert;
              const area = isLegacyAlert ? alert.area : null;
              const title = isLegacyAlert ? alert.title : alert.type;
              const issuedAt = isLegacyAlert ? alert.issued_at : alert.timestamp;
              const waterLevelM = isLegacyAlert ? alert.water_level_m : null;
              const style = getSeverityStyle(alert.severity);

              return (
                <article
                  key={alert.id}
                  className={`p-4 rounded-2xl bg-white/5 border ${style.border} space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${style.badge}`}>
                        {style.label}
                      </span>
                      {area && (
                        <span className="text-xs text-white/70 font-medium truncate">
                          📍 {area}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/40 shrink-0">
                      {formatAge(issuedAt)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white leading-snug">{title}</h3>
                    <p className="text-xs text-white/70 mt-1 leading-relaxed">{alert.message}</p>
                  </div>

                  {waterLevelM && (
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                      <span className="text-white/60">Estimated Flood Depth</span>
                      <span className="font-bold text-red-400">{waterLevelM} meters</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                    <span>Source: {alert.source || "State Disaster Management"}</span>
                    {onNavigateToMap && (
                      <button
                        type="button"
                        onClick={onNavigateToMap}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        View zone on map →
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Road Closures Section */}
        {(filter === "all" || filter === "closures") && closures.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>🚧</span> Road Closures & Blockages ({closures.length})
            </h3>
            <div className="space-y-2.5">
              {closures.map((closure) => (
                <div
                  key={closure.id}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3"
                >
                  <span className="text-xl mt-0.5">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-white truncate">{closure.road_name}</p>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          closure.passable
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {closure.passable ? "Passable on foot" : "Blocked"}
                      </span>
                    </div>
                    {closure.reason && (
                      <p className="text-xs text-white/60 mt-1">{closure.reason}</p>
                    )}
                    <p className="text-[10px] text-white/40 mt-1.5">
                      Reported {formatAge(closure.reported_at)} • {closure.source}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
