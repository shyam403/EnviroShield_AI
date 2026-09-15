import test from "node:test";
import assert from "node:assert/strict";

import { evaluateOverallRisk } from "./ai-monitor.ts";

test("HIGH telemetry marks the system unsafe and LOW telemetry clears it", () => {
  const highRisk = evaluateOverallRisk({
    water_distance_cm: 8,
    flood_risk: "HIGH",
    earthquake_level: 30,
    earthquake_risk: "HIGH",
    air_quality: 45,
    air_risk: "HIGH",
    water_quality: 55,
    water_risk: "HIGH",
    mode: "MANUAL",
    created_at: new Date().toISOString(),
  });

  assert.equal(highRisk.overallRisk, "HIGH");
  assert.equal(highRisk.isSafe, false);
  assert.ok(highRisk.alerts.length >= 4);

  const lowRisk = evaluateOverallRisk({
    water_distance_cm: 100,
    flood_risk: "LOW",
    earthquake_level: 8,
    earthquake_risk: "LOW",
    air_quality: 70,
    air_risk: "MEDIUM",
    water_quality: 80,
    water_risk: "LOW",
    mode: "AUTO",
    created_at: new Date().toISOString(),
  });

  assert.equal(lowRisk.overallRisk, "MEDIUM");
  assert.equal(lowRisk.isSafe, false);
  assert.ok(lowRisk.alerts.length === 0);
});
