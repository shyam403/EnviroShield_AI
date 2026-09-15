/**
 * FloodSafe offline hazard-weighted routing.
 *
 * Safety is prioritised over distance.
 * Blocked roads are never used.
 * Flooded / unsafe segments are used only as a last resort.
 */

import type {
  MapNode,
  RoadEdge,
  Risk,
  Zone,
} from "@/data/city";

import {
  distanceM,
  riskAt,
} from "@/data/city";

export interface RouteSegment {
  edge: RoadEdge;
  from: MapNode;
  to: MapNode;
}

export type SafetyLevel =
  | "safe"
  | "caution"
  | "dangerous";

export interface Route {
  id: string;
  nodes: MapNode[];
  segments: RouteSegment[];

  distanceM: number;
  walkMinutes: number;

  safetyScore: number;
  level: SafetyLevel;

  dangerousSections: number;

  redMeters: number;
  yellowMeters: number;
  greenMeters: number;

  floodedRoads: string[];
  unsafeBridges: string[];

  usesEvacuationRoute: boolean;
  minElevation: number;
}

export interface Graph {
  nodes: Map<string, MapNode>;
  adjacency: Map<
    string,
    { edge: RoadEdge; to: string }[]
  >;
  edges: RoadEdge[];
}

/* -------------------------------------------------------
 * GRAPH
 * ----------------------------------------------------- */

export function buildGraph(
  nodes: MapNode[],
  edges: RoadEdge[],
): Graph {
  const nodeMap = new Map(
    nodes.map((node) => [node.id, node]),
  );

  const adjacency = new Map<
    string,
    { edge: RoadEdge; to: string }[]
  >();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency
      .get(edge.a)
      ?.push({
        edge,
        to: edge.b,
      });

    adjacency
      .get(edge.b)
      ?.push({
        edge,
        to: edge.a,
      });
  }

  return {
    nodes: nodeMap,
    adjacency,
    edges,
  };
}

/* -------------------------------------------------------
 * EDGE SAFETY COST
 * ----------------------------------------------------- */

export function segmentCostMultiplier(
  edge: RoadEdge,
  options: {
    allowDanger: boolean;
  },
) {
  let multiplier = 1;

  switch (edge.risk) {
    case "red":
      multiplier *= 18;
      break;

    case "yellow":
      multiplier *= 3.5;
      break;

    case "green":
      multiplier *= 0.65;
      break;

    default:
      multiplier *= 1.1;
      break;
  }

  /*
   * Flooded and unsafe roads are effectively blocked
   * during the normal route search.
   */
  if (edge.flooded) {
    multiplier *= options.allowDanger
      ? 12
      : 1e9;
  }

  if (edge.unsafe) {
    multiplier *= options.allowDanger
      ? 15
      : 1e9;
  }

  /*
   * Bridges get a moderate penalty.
   */
  if (edge.kind === "bridge") {
    multiplier *= 1.8;
  }

  /*
   * Official evacuation routes are preferred.
   */
  if (edge.kind === "evacuation") {
    multiplier *= 0.5;
  }

  if (edge.kind === "road") {
    multiplier *= 0.9;
  }

  /*
   * Higher elevation is preferable during floods.
   */
  multiplier *= Math.max(
    0.55,
    1.25 - edge.elevation / 60,
  );

  return multiplier;
}

/* -------------------------------------------------------
 * RECONSTRUCT PATH
 * ----------------------------------------------------- */

function reconstruct(
  graph: Graph,
  cameFrom: Map<
    string,
    {
      prev: string;
      edge: RoadEdge;
    }
  >,
  goal: string,
  start: string,
) {
  const nodes: MapNode[] = [];
  const segments: RouteSegment[] = [];

  let current = goal;

  const guard = new Set<string>();

  while (current !== start) {
    const step = cameFrom.get(current);

    if (!step || guard.has(current)) {
      return null;
    }

    guard.add(current);

    const to = graph.nodes.get(current);
    const from = graph.nodes.get(step.prev);

    if (!to || !from) {
      return null;
    }

    nodes.unshift(to);

    segments.unshift({
      edge: step.edge,
      from,
      to,
    });

    current = step.prev;
  }

  const startNode = graph.nodes.get(start);

  if (!startNode) {
    return null;
  }

  nodes.unshift(startNode);

  return {
    nodes,
    segments,
  };
}

/* -------------------------------------------------------
 * A*
 * ----------------------------------------------------- */

function astar(
  graph: Graph,
  startId: string,
  goalId: string,
  options: {
    allowDanger: boolean;
    penalty: Map<string, number>;
  },
) {
  const start = graph.nodes.get(startId);
  const goal = graph.nodes.get(goalId);

  if (!start || !goal) {
    return null;
  }

  const gScore = new Map<string, number>();

  gScore.set(startId, 0);

  const cameFrom = new Map<
    string,
    {
      prev: string;
      edge: RoadEdge;
    }
  >();

  const open: {
    id: string;
    f: number;
  }[] = [
    {
      id: startId,
      f: 0,
    },
  ];

  const closed = new Set<string>();

  const heuristic = (id: string) => {
    const node = graph.nodes.get(id);

    if (!node) {
      return Infinity;
    }

    /*
     * Keep heuristic below actual cost multiplier
     * so A* remains useful for this weighted graph.
     */
    return (
      distanceM(
        node.lat,
        node.lng,
        goal.lat,
        goal.lng,
      ) * 0.45
    );
  };

  while (open.length > 0) {
    open.sort(
      (a, b) => a.f - b.f,
    );

    const current = open.shift();

    if (!current) {
      break;
    }

    if (current.id === goalId) {
      return reconstruct(
        graph,
        cameFrom,
        goalId,
        startId,
      );
    }

    if (closed.has(current.id)) {
      continue;
    }

    closed.add(current.id);

    const links =
      graph.adjacency.get(current.id) ?? [];

    for (const link of links) {
      const multiplier =
        segmentCostMultiplier(
          link.edge,
          options,
        );

      /*
       * Penalise already-used edges so alternative
       * routes use a different corridor.
       */
      const alternativePenalty =
        options.penalty.get(
          link.edge.id,
        ) ?? 1;

      const cost =
        link.edge.lengthM *
        multiplier *
        alternativePenalty;

      const tentative =
        (gScore.get(current.id) ??
          Infinity) + cost;

      if (
        tentative <
        (gScore.get(link.to) ??
          Infinity)
      ) {
        gScore.set(
          link.to,
          tentative,
        );

        cameFrom.set(
          link.to,
          {
            prev: current.id,
            edge: link.edge,
          },
        );

        open.push({
          id: link.to,
          f:
            tentative +
            heuristic(link.to),
        });
      }
    }
  }

  return null;
}

/* -------------------------------------------------------
 * ROUTE SCORING
 * ----------------------------------------------------- */

export function scoreRoute(
  id: string,
  path: {
    nodes: MapNode[];
    segments: RouteSegment[];
  },
): Route {
  let distance = 0;

  let red = 0;
  let yellow = 0;
  let green = 0;

  let dangerousSections = 0;

  let minElevation = Infinity;

  const flooded = new Set<string>();
  const unsafeBridges = new Set<string>();

  let evacuation = false;

  for (const segment of path.segments) {
    const edge = segment.edge;

    distance += edge.lengthM;

    if (edge.risk === "red") {
      red += edge.lengthM;
    }

    if (edge.risk === "yellow") {
      yellow += edge.lengthM;
    }

    if (edge.risk === "green") {
      green += edge.lengthM;
    }

    if (edge.flooded) {
      flooded.add(edge.name);
    }

    if (edge.unsafe) {
      unsafeBridges.add(edge.name);
    }

    if (
      edge.kind ===
      "evacuation"
    ) {
      evacuation = true;
    }

    if (
      edge.risk === "red" ||
      edge.flooded ||
      edge.unsafe
    ) {
      dangerousSections += 1;
    }

    minElevation = Math.min(
      minElevation,
      edge.elevation,
    );
  }

  const total =
    Math.max(distance, 1);

  /*
   * Safety-first score.
   */
  let score = 100;

  score -=
    (red / total) * 75;

  score -=
    (yellow / total) * 22;

  score +=
    (green / total) * 8;

  score -=
    flooded.size * 10;

  score -=
    unsafeBridges.size * 10;

  if (evacuation) {
    score += 5;
  }

  if (
    Number.isFinite(
      minElevation,
    ) &&
    minElevation < 6
  ) {
    score -= 6;
  }

  score = Math.max(
    1,
    Math.min(
      100,
      Math.round(score),
    ),
  );

  const level: SafetyLevel =
    score >= 78
      ? "safe"
      : score >= 50
        ? "caution"
        : "dangerous";

  return {
    id,
    nodes: path.nodes,
    segments: path.segments,

    distanceM:
      Math.round(distance),

    walkMinutes:
      Math.max(
        1,
        Math.round(
          distance / 75,
        ),
      ),

    safetyScore: score,
    level,

    dangerousSections,

    redMeters:
      Math.round(red),

    yellowMeters:
      Math.round(yellow),

    greenMeters:
      Math.round(green),

    floodedRoads:
      [...flooded],

    unsafeBridges:
      [...unsafeBridges],

    usesEvacuationRoute:
      evacuation,

    minElevation:
      Number.isFinite(
        minElevation,
      )
        ? Math.round(
            minElevation,
          )
        : 0,
  };
}

/* -------------------------------------------------------
 * MULTI-ROUTE SEARCH
 * ----------------------------------------------------- */

export function findSafeRoutes(
  graph: Graph,
  startId: string,
  goalId: string,
  count = 3,
): {
  routes: Route[];
  compromised: boolean;
} {
  /*
   * First attempt:
   * completely avoid flooded / unsafe roads.
   */
  const findCandidates = (
    allowDanger: boolean,
  ) => {
    const routes: Route[] = [];

    const penalty =
      new Map<string, number>();

    const seen =
      new Set<string>();

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const path = astar(
        graph,
        startId,
        goalId,
        {
          allowDanger,
          penalty,
        },
      );

      if (!path) {
        break;
      }

      const key =
        path.segments
          .map(
            (segment) =>
              segment.edge.id,
          )
          .join("|");

      if (!seen.has(key)) {
        seen.add(key);

        routes.push(
          scoreRoute(
            `route-${i + 1}`,
            path,
          ),
        );
      }

      /*
       * Make this corridor more expensive
       * for the next candidate.
       */
      for (const segment of path.segments) {
        const edgeId =
          segment.edge.id;

        const oldPenalty =
          penalty.get(edgeId) ??
          1;

        penalty.set(
          edgeId,
          oldPenalty * 3,
        );
      }
    }

    routes.sort(
      (a, b) =>
        b.safetyScore -
          a.safetyScore ||
        a.distanceM -
          b.distanceM,
    );

    return routes;
  };

  const cleanRoutes =
    findCandidates(false);

  if (cleanRoutes.length > 0) {
    return {
      routes: cleanRoutes,
      compromised: false,
    };
  }

  /*
   * No completely safe route exists.
   * Last-resort routes are allowed.
   */
  const emergencyRoutes =
    findCandidates(true);

  return {
    routes: emergencyRoutes,
    compromised:
      emergencyRoutes.length > 0,
  };
}

/* -------------------------------------------------------
 * NEAREST NODE
 * ----------------------------------------------------- */

export function nearestGraphNode(
  nodes: MapNode[],
  lat: number,
  lng: number,
) {
  if (!nodes.length) {
    throw new Error(
      "Graph contains no nodes",
    );
  }

  let best = nodes[0];
  let bestDistance = Infinity;

  for (const node of nodes) {
    const distance =
      distanceM(
        lat,
        lng,
        node.lat,
        node.lng,
      );

    if (
      distance <
      bestDistance
    ) {
      bestDistance =
        distance;

      best = node;
    }
  }

  return best;
}

/* -------------------------------------------------------
 * ROUTE HAZARDS
 * ----------------------------------------------------- */

export function routeHazardWarnings(
  route: Route,
  zones: Zone[],
) {
  const hits =
    new Map<
      string,
      {
        zone: string;
        reason: string;
      }
    >();

  for (
    const segment of route.segments
  ) {
    const midLat =
      (segment.from.lat +
        segment.to.lat) /
      2;

    const midLng =
      (segment.from.lng +
        segment.to.lng) /
      2;

    const result =
      riskAt(
        midLat,
        midLng,
        zones,
      );

    if (
      result.risk === "red" &&
      result.zone
    ) {
      hits.set(
        result.zone.id,
        {
          zone:
            result.zone.name,
          reason:
            result.zone.reason,
        },
      );
    }
  }

  return [
    ...hits.values(),
  ];
}

/* -------------------------------------------------------
 * LABELS
 * ----------------------------------------------------- */

export const RISK_LABEL: Record<
  Risk,
  string
> = {
  red: "High risk",
  yellow: "Moderate risk",
  green: "Safer / elevated",
  none: "No data",
};