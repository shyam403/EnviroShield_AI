/**
 * On-device intelligence layer.
 *
 * Deterministic rule engine that scores hazards, ranks destinations and
 * detects hazard entry — no model download, works fully offline. The exported
 * `ScoringEngine` shape is the seam a learned model can slot into later.
 */

import type { Place, RoadEdge, Zone } from "@/data/city";
import { distanceM, riskAt } from "@/data/city";
import type { Graph, Route } from "./routing";
import { findSafeRoutes } from "./routing";
import type { RoadClosure, ShelterStatus } from "./sync";

export interface ScoringEngine {
  name: string;
  /** Applies live hazard reports on top of the bundled road network. */
  applyReports: (edges: RoadEdge[], zones: Zone[], closures: RoadClosure[]) => RoadEdge[];
}

/** Re-derives per-edge risk from the current zone set and live road closures. */
export const ruleEngine: ScoringEngine = {
  name: "Rule-based safety engine",
  applyReports: (edges, zones, closures) =>
    edges.map((edge) => {
      const next = { ...edge };
      // Recompute zone risk from the (possibly synced) zone set.
      // Midpoint is derived from the stored edge geometry cache below.
      const geo = EDGE_MIDPOINTS.get(edge.id);
      if (geo) {
        const { risk } = riskAt(geo.lat, geo.lng, zones);
        next.risk = risk;
        if (risk === "red" && edge.flooded) next.flooded = true;
        if (risk !== "red" && risk !== "yellow") next.unsafe = false;
      }
      for (const c of closures) {
        if (!geo) break;
        const d = distanceM(geo.lat, geo.lng, c.lat, c.lng);
        if (d < 320) {
          if (!c.passable) next.flooded = true;
          if (!c.passable && next.kind === "bridge") next.unsafe = true;
        }
      }
      return next;
    }),
};

export const EDGE_MIDPOINTS = new Map<string, { lat: number; lng: number }>();

export function indexEdgeGeometry(
  edges: RoadEdge[],
  nodeById: Map<string, { lat: number; lng: number }>,
) {
  for (const e of edges) {
    const a = nodeById.get(e.a);
    const b = nodeById.get(e.b);
    if (!a || !b) continue;
    EDGE_MIDPOINTS.set(e.id, { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });
  }
}

/** Merges live shelter availability into the bundled place list. */
export function mergeShelterStatus(places: Place[], shelters: ShelterStatus[]): Place[] {
  if (!shelters.length) return places;
  return places.map((p) => {
    const match = shelters.find(
      (s) => s.name.toLowerCase() === p.name.toLowerCase() || distanceM(p.lat, p.lng, s.lat, s.lng) < 200,
    );
    if (!match) return p;
    return {
      ...p,
      isOpen: match.is_open,
      capacity: match.capacity ?? p.capacity,
      occupancy: match.occupancy ?? p.occupancy,
      contact: match.contact ?? p.contact,
    };
  });
}

export interface Recommendation {
  place: Place;
  route: Route;
}

const SAFE_KINDS: Place["kind"][] = ["shelter", "safe_zone", "relief", "hospital", "police"];

/**
 * Ranks nearby safe destinations by route safety first, then travel distance.
 * Full shelters and closed facilities are pushed down but still listed.
 */
export function recommendSafePlaces(
  graph: Graph,
  places: Place[],
  fromNodeId: string,
  opts: { kinds?: Place["kind"][]; limit?: number } = {},
): Recommendation[] {
  const kinds = opts.kinds ?? SAFE_KINDS;
  const from = graph.nodes.get(fromNodeId);
  if (!from) return [];

  const candidates = places
    .filter((p) => kinds.includes(p.kind))
    .map((p) => ({ p, straight: distanceM(from.lat, from.lng, p.lat, p.lng) }))
    .sort((a, b) => a.straight - b.straight)
    .slice(0, 10);

  const out: Recommendation[] = [];
  for (const c of candidates) {
    const { routes } = findSafeRoutes(graph, fromNodeId, c.p.nodeId, 1);
    const route = routes[0];
    if (!route) continue;
    out.push({ place: c.p, route });
  }

  out.sort((a, b) => {
    const aPenalty = a.place.isOpen === false ? 25 : a.place.occupancy && a.place.capacity && a.place.occupancy >= a.place.capacity ? 12 : 0;
    const bPenalty = b.place.isOpen === false ? 25 : b.place.occupancy && b.place.capacity && b.place.occupancy >= b.place.capacity ? 12 : 0;
    return (
      b.route.safetyScore - bPenalty - (a.route.safetyScore - aPenalty) ||
      a.route.distanceM - b.route.distanceM
    );
  });

  return out.slice(0, opts.limit ?? 6);
}

export function searchPlaces(places: Place[], query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const synonyms: Record<string, Place["kind"][]> = {
    "nearest shelter": ["shelter"],
    shelter: ["shelter"],
    hospital: ["hospital"],
    doctor: ["hospital"],
    clinic: ["hospital"],
    police: ["police"],
    relief: ["relief"],
    food: ["relief"],
    "safe zone": ["safe_zone"],
    safe: ["safe_zone", "shelter"],
    "higher ground": ["safe_zone"],
    school: ["school"],
    government: ["government"],
  };
  const kinds = synonyms[q];
  if (kinds) return places.filter((p) => kinds.includes(p.kind));
  return places.filter(
    (p) => p.name.toLowerCase().includes(q) || p.kind.replace("_", " ").includes(q),
  );
}
