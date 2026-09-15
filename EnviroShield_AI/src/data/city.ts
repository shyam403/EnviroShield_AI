/**
 * Bundled offline city dataset for FloodSafe.
 *
 * Everything the app needs to render a map and compute routes lives here and
 * is generated deterministically at import time, so the app works with zero
 * network access. Cloud sync only *augments* this data (see lib/sync.ts).
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

export type Risk = "red" | "yellow" | "green" | "none";

export type PlaceKind =
  | "shelter"
  | "hospital"
  | "police"
  | "relief"
  | "safe_zone"
  | "school"
  | "government"
  | "landmark";

export interface Zone {
  id: string;
  name: string;
  risk: Exclude<Risk, "none">;
  reason: string;
  polygon: [number, number][];
  source: string;
  reportedAt: string;
}

export interface MapNode {
  id: string;
  lat: number;
  lng: number;
  /** Metres above the river datum. Higher is safer. */
  elevation: number;
}

export interface RoadEdge {
  id: string;
  a: string;
  b: string;
  name: string;
  kind: "road" | "street" | "bridge" | "evacuation";
  lengthM: number;
  risk: Risk;
  flooded: boolean;
  unsafe: boolean;
  /** Average elevation of the two endpoints. */
  elevation: number;
}

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  nodeId: string;
  capacity?: number | undefined;
  occupancy?: number | undefined;
  isOpen?: boolean | undefined;
  contact?: string | undefined;
}

export interface Building {
  id: string;
  lat: number;
  lng: number;
  w: number;
  h: number;
}

export const BOUNDS = {
  minLat: 20.296,
  maxLat: 20.36,
  minLng: 85.78,
  maxLng: 85.86,
};

export const CITY_NAME = "Rivermouth District";

export const DATASET_NOTICE =
  "FloodSafe uses a locally stored demonstration dataset for offline navigation. Flood zones and road conditions are illustrative and must not be treated as official emergency boundaries.";

/** Deterministic PRNG so the map is identical on every device / render. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The river running through the south of the district. */
export const RIVER: [number, number][] = [
  [20.3, 85.78],
  [20.308, 85.796],
  [20.3125, 85.812],
  [20.306, 85.83],
  [20.302, 85.845],
  [20.3035, 85.86],
];

/** Drain / canal line through the north-west. */
export const CANAL: [number, number][] = [
  [20.3255, 85.78],
  [20.334, 85.797],
  [20.3405, 85.812],
];

const NOW = "2026-09-03T06:10:00.000Z";

export const BASE_ZONES: Zone[] = [
  {
    id: "z-nadi-ghat",
    name: "Nadi Ghat Riverbank",
    risk: "red",
    reason: "Water level above danger mark; bank overtopped",
    polygon: [
      [20.302, 85.786],
      [20.318, 85.8],
      [20.312, 85.812],
      [20.298, 85.798],
    ],
    source: "State Disaster Management Authority",
    reportedAt: NOW,
  },
  {
    id: "z-old-market",
    name: "Old Market Low Ground",
    risk: "red",
    reason: "Standing water 1.2 m, drainage backflow",
    polygon: [
      [20.318, 85.802],
      [20.33, 85.812],
      [20.326, 85.822],
      [20.314, 85.814],
    ],
    source: "Municipal Corporation",
    reportedAt: NOW,
  },
  {
    id: "z-riverside-row",
    name: "Riverside Row",
    risk: "red",
    reason: "Low-lying settlement beside the river, previously flooded twice",
    polygon: [
      [20.298, 85.818],
      [20.31, 85.83],
      [20.3, 85.852],
      [20.296, 85.836],
    ],
    source: "State Disaster Management Authority",
    reportedAt: NOW,
  },
  {
    id: "z-canal-colony",
    name: "Canal Colony",
    risk: "yellow",
    reason: "Rising canal level, may flood within 12 hours",
    polygon: [
      [20.326, 85.788],
      [20.34, 85.8],
      [20.336, 85.81],
      [20.322, 85.8],
    ],
    source: "State Disaster Management Authority",
    reportedAt: NOW,
  },
  {
    id: "z-south-drain",
    name: "South Drain Corridor",
    risk: "yellow",
    reason: "Overflow risk during heavy rainfall",
    polygon: [
      [20.304, 85.812],
      [20.318, 85.824],
      [20.312, 85.834],
      [20.3, 85.824],
    ],
    source: "Municipal Corporation",
    reportedAt: NOW,
  },
  {
    id: "z-station-road",
    name: "Station Road Belt",
    risk: "yellow",
    reason: "Caution area — water enters through old culverts",
    polygon: [
      [20.318, 85.826],
      [20.33, 85.834],
      [20.326, 85.844],
      [20.314, 85.836],
    ],
    source: "Municipal Corporation",
    reportedAt: NOW,
  },
  {
    id: "z-hill-view",
    name: "Hill View Plateau",
    risk: "green",
    reason: "Elevated ground, designated evacuation zone",
    polygon: [
      [20.336, 85.822],
      [20.354, 85.834],
      [20.35, 85.852],
      [20.332, 85.842],
    ],
    source: "District Emergency Operations Centre",
    reportedAt: NOW,
  },
  {
    id: "z-ridge-road",
    name: "Ridge Road Heights",
    risk: "green",
    reason: "High ground with all-weather access road",
    polygon: [
      [20.322, 85.836],
      [20.336, 85.846],
      [20.33, 85.858],
      [20.316, 85.848],
    ],
    source: "District Emergency Operations Centre",
    reportedAt: NOW,
  },
  {
    id: "z-north-fields",
    name: "North Fields",
    risk: "green",
    reason: "Elevated open ground away from the river",
    polygon: [
      [20.344, 85.786],
      [20.36, 85.796],
      [20.358, 85.816],
      [20.342, 85.806],
    ],
    source: "District Emergency Operations Centre",
    reportedAt: NOW,
  },
];

export function pointInPolygon(lat: number, lng: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]!;
    const [yj, xj] = poly[j]!;
    const intersect =
      xi > lng !== xj > lng && lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const RISK_ORDER: Record<Risk, number> = { none: 0, green: 1, yellow: 2, red: 3 };

export function riskAt(
  lat: number,
  lng: number,
  zones: Zone[],
): { risk: Risk; zone: Zone | undefined } {
  let best: Zone | undefined;
  for (const z of zones) {
    if (!pointInPolygon(lat, lng, z.polygon)) continue;
    if (!best || RISK_ORDER[z.risk] > RISK_ORDER[best.risk]) best = z;
  }
  return { risk: best ? best.risk : "none", zone: best };
}

const R_EARTH = 6371000;

export function distanceM(a: Coordinate, b: Coordinate): number;
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number;
export function distanceM(
  aOrLat: Coordinate | number,
  bOrLng: Coordinate | number,
  cLat?: number,
  cLng?: number,
) {
  const aLat = typeof aOrLat === "number" ? aOrLat : aOrLat.lat;
  const aLng = typeof aOrLat === "number" ? (bOrLng as number) : aOrLat.lng;
  const bLat = typeof aOrLat === "number" ? cLat! : (bOrLng as Coordinate).lat;
  const bLng = typeof aOrLat === "number" ? cLng! : (bOrLng as Coordinate).lng;

  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const m = Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
  const h = Math.sin(dLat / 2) ** 2 + m * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

function distanceToPolyline(lat: number, lng: number, line: [number, number][]) {
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [y1, x1] = line[i]!;
    const [y2, x2] = line[i + 1]!;
    const dy = y2 - y1;
    const dx = x2 - x1;
    const len2 = dy * dy + dx * dx || 1e-12;
    let t = ((lat - y1) * dy + (lng - x1) * dx) / len2;
    t = Math.max(0, Math.min(1, t));
    const py = y1 + t * dy;
    const px = x1 + t * dx;
    min = Math.min(min, distanceM(lat, lng, py, px));
  }
  return min;
}

function segmentsCross(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
) {
  const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function crossesLine(a: MapNode, b: MapNode, line: [number, number][]) {
  const p: [number, number] = [a.lat, a.lng];
  const q: [number, number] = [b.lat, b.lng];
  for (let i = 0; i < line.length - 1; i++) {
    if (segmentsCross(p, q, line[i]!, line[i + 1]!)) return true;
  }
  return false;
}

const ROWS = 15;
const COLS = 15;

const STREET_NAMES = [
  "Ghat Street",
  "Bazaar Lane",
  "Temple Road",
  "Canal Road",
  "Station Road",
  "Market Link Road",
  "Old Mill Street",
  "School Lane",
  "Civil Lines",
  "Ridge Road",
  "Plateau Avenue",
  "Hill View Road",
  "North Field Road",
  "Relief Camp Road",
  "Upper Terrace",
];

const AVENUE_NAMES = [
  "West Bund",
  "Ghat Cross",
  "First Cross",
  "Second Cross",
  "Grain Market Cross",
  "Hospital Cross",
  "Third Cross",
  "Fourth Cross",
  "Depot Cross",
  "Ridge Cross",
  "Plateau Cross",
  "Terrace Cross",
  "East Cross",
  "Boundary Cross",
  "East Bund",
];

function buildDataset() {
  const rand = mulberry32(20260903);
  const zones = BASE_ZONES;

  const nodes: MapNode[] = [];
  const nodeGrid: MapNode[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: MapNode[] = [];
    for (let c = 0; c < COLS; c++) {
      const lat = BOUNDS.minLat + ((BOUNDS.maxLat - BOUNDS.minLat) * r) / (ROWS - 1);
      const lng = BOUNDS.minLng + ((BOUNDS.maxLng - BOUNDS.minLng) * c) / (COLS - 1);
      const jLat = lat + (rand() - 0.5) * 0.0009;
      const jLng = lng + (rand() - 0.5) * 0.0009;
      const riverDist = distanceToPolyline(jLat, jLng, RIVER);
      const elevation = Math.round(Math.min(46, riverDist / 90 + (jLat - BOUNDS.minLat) * 240));
      const node: MapNode = { id: `n${r}-${c}`, lat: jLat, lng: jLng, elevation };
      row.push(node);
      nodes.push(node);
    }
    nodeGrid.push(row);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges: RoadEdge[] = [];

  const addEdge = (a: MapNode, b: MapNode, name: string, arterial: boolean) => {
    const midLat = (a.lat + b.lat) / 2;
    const midLng = (a.lng + b.lng) / 2;
    const { risk, zone } = riskAt(midLat, midLng, zones);
    const isBridge = crossesLine(a, b, RIVER) || crossesLine(a, b, CANAL);
    const elevation = (a.elevation + b.elevation) / 2;
    const floodedByZone =
      risk === "red" && (zone?.reason.toLowerCase().includes("water") ? rand() < 0.75 : rand() < 0.45);
    const kind: RoadEdge["kind"] = isBridge
      ? "bridge"
      : risk === "green" && arterial
        ? "evacuation"
        : arterial
          ? "road"
          : "street";
    edges.push({
      id: `${a.id}_${b.id}`,
      a: a.id,
      b: b.id,
      name,
      kind,
      lengthM: Math.round(distanceM(a.lat, a.lng, b.lat, b.lng)),
      risk,
      flooded: floodedByZone,
      unsafe: isBridge && (risk === "red" || (risk === "yellow" && rand() < 0.4)),
      elevation,
    });
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const n = nodeGrid[r]![c]!;
      const arterialRow = r % 3 === 0;
      const arterialCol = c % 3 === 0;
      if (c + 1 < COLS && (arterialRow || rand() > 0.16)) {
        addEdge(n, nodeGrid[r]![c + 1]!, STREET_NAMES[r % STREET_NAMES.length]!, arterialRow);
      }
      if (r + 1 < ROWS && (arterialCol || rand() > 0.16)) {
        addEdge(n, nodeGrid[r + 1]![c]!, AVENUE_NAMES[c % AVENUE_NAMES.length]!, arterialCol);
      }
    }
  }

  const nearestNode = (lat: number, lng: number) => {
    let best = nodes[0]!;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = distanceM(lat, lng, n.lat, n.lng);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };

  const rawPlaces: Omit<Place, "nodeId">[] = [
    {
      id: "p-hill-school",
      name: "Hill View Government High School Shelter",
      kind: "shelter",
      lat: 20.344,
      lng: 85.834,
      capacity: 800,
      occupancy: 410,
      isOpen: true,
      contact: "1077",
    },
    {
      id: "p-ridge-cc",
      name: "Ridge Road Community Centre",
      kind: "shelter",
      lat: 20.328,
      lng: 85.845,
      capacity: 450,
      occupancy: 445,
      isOpen: true,
      contact: "1077",
    },
    {
      id: "p-plateau-stadium",
      name: "Plateau Stadium Evacuation Centre",
      kind: "shelter",
      lat: 20.348,
      lng: 85.842,
      capacity: 1500,
      occupancy: 260,
      isOpen: true,
      contact: "1070",
    },
    {
      id: "p-market-hall",
      name: "Old Market Municipal Hall",
      kind: "shelter",
      lat: 20.32,
      lng: 85.812,
      capacity: 300,
      occupancy: 300,
      isOpen: false,
      contact: "1077",
    },
    {
      id: "p-north-field-shelter",
      name: "North Fields Cyclone Shelter",
      kind: "shelter",
      lat: 20.352,
      lng: 85.8,
      capacity: 600,
      occupancy: 120,
      isOpen: true,
      contact: "1077",
    },
    {
      id: "p-district-hospital",
      name: "District General Hospital",
      kind: "hospital",
      lat: 20.336,
      lng: 85.83,
      isOpen: true,
      contact: "108",
    },
    {
      id: "p-plateau-trauma",
      name: "Plateau Trauma Centre",
      kind: "hospital",
      lat: 20.346,
      lng: 85.848,
      isOpen: true,
      contact: "108",
    },
    {
      id: "p-riverside-clinic",
      name: "Riverside Primary Health Centre",
      kind: "hospital",
      lat: 20.306,
      lng: 85.802,
      isOpen: false,
      contact: "108",
    },
    {
      id: "p-ridge-police",
      name: "Ridge Road Police Station",
      kind: "police",
      lat: 20.33,
      lng: 85.84,
      isOpen: true,
      contact: "100",
    },
    {
      id: "p-canal-police",
      name: "Canal Colony Police Outpost",
      kind: "police",
      lat: 20.332,
      lng: 85.798,
      isOpen: true,
      contact: "100",
    },
    {
      id: "p-hill-relief",
      name: "Hill View Relief Distribution Point",
      kind: "relief",
      lat: 20.34,
      lng: 85.838,
      isOpen: true,
      contact: "1077",
    },
    {
      id: "p-south-relief",
      name: "South Ward Relief Camp",
      kind: "relief",
      lat: 20.312,
      lng: 85.828,
      isOpen: true,
      contact: "1077",
    },
    {
      id: "p-plateau-safe",
      name: "Hill View Plateau Safe Zone",
      kind: "safe_zone",
      lat: 20.345,
      lng: 85.838,
    },
    { id: "p-ridge-safe", name: "Ridge Heights Safe Zone", kind: "safe_zone", lat: 20.326, lng: 85.85 },
    { id: "p-north-safe", name: "North Fields Safe Zone", kind: "safe_zone", lat: 20.353, lng: 85.808 },
    { id: "p-govt-school", name: "Station Road Government School", kind: "school", lat: 20.322, lng: 85.832 },
    { id: "p-girls-school", name: "Canal Colony Girls School", kind: "school", lat: 20.331, lng: 85.792 },
    { id: "p-collectorate", name: "District Collectorate", kind: "government", lat: 20.338, lng: 85.824 },
    { id: "p-eoc", name: "Emergency Operations Centre", kind: "government", lat: 20.342, lng: 85.828 },
    { id: "p-fire", name: "Fire & Rescue Station", kind: "government", lat: 20.334, lng: 85.816 },
    { id: "p-clock-tower", name: "Old Market Clock Tower", kind: "landmark", lat: 20.321, lng: 85.808 },
    { id: "p-ghat-temple", name: "Nadi Ghat Temple", kind: "landmark", lat: 20.306, lng: 85.792 },
    { id: "p-bus-stand", name: "Central Bus Stand", kind: "landmark", lat: 20.326, lng: 85.82 },
    { id: "p-water-tank", name: "Ridge Water Tank", kind: "landmark", lat: 20.332, lng: 85.844 },
    { id: "p-rail-halt", name: "Rivermouth Railway Halt", kind: "landmark", lat: 20.318, lng: 85.838 },
  ];

  const places: Place[] = rawPlaces.map((p) => ({ ...p, nodeId: nearestNode(p.lat, p.lng).id }));

  const buildings: Building[] = [];
  for (let i = 0; i < 220; i++) {
    const lat = BOUNDS.minLat + rand() * (BOUNDS.maxLat - BOUNDS.minLat);
    const lng = BOUNDS.minLng + rand() * (BOUNDS.maxLng - BOUNDS.minLng);
    buildings.push({
      id: `b${i}`,
      lat,
      lng,
      w: 0.0009 + rand() * 0.0014,
      h: 0.0007 + rand() * 0.0011,
    });
  }

  return { nodes, nodeById, edges, places, buildings, zones };
}

export const CITY = buildDataset();

export const PLACE_LABELS: Record<PlaceKind, string> = {
  shelter: "Shelter",
  hospital: "Hospital",
  police: "Police",
  relief: "Relief centre",
  safe_zone: "Safe zone",
  school: "School",
  government: "Government",
  landmark: "Landmark",
};
