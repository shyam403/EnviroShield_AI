import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  BOUNDS,
  CANAL,
  RIVER,
  type Building,
  type MapNode,
  type Place,
  type RoadEdge,
  type Zone,
} from "@/data/city";
import type { Route } from "@/lib/routing";

const W = 1000;
const H = 1000;

export function toX(lng: number) {
  return ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
}
export function toY(lat: number) {
  return ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
}
function fromX(x: number) {
  return BOUNDS.minLng + (x / W) * (BOUNDS.maxLng - BOUNDS.minLng);
}
function fromY(y: number) {
  return BOUNDS.maxLat - (y / H) * (BOUNDS.maxLat - BOUNDS.minLat);
}

const MIN_K = 0.75;
const MAX_K = 9;

const RISK_STROKE: Record<string, string> = {
  red: "var(--risk-red)",
  yellow: "var(--risk-yellow)",
  green: "var(--risk-green)",
  none: "var(--road)",
};

const PLACE_GLYPH: Record<Place["kind"], string> = {
  shelter: "S",
  hospital: "H",
  police: "P",
  relief: "R",
  safe_zone: "\u25B2",
  school: "\u25A0",
  government: "G",
  landmark: "\u25CF",
};

export interface MapCanvasHandle {
  focus: (lat: number, lng: number, k?: number) => void;
  reset: () => void;
}

interface Props {
  zones: Zone[];
  edges: RoadEdge[];
  nodeById: Map<string, MapNode>;
  buildings: Building[];
  places: Place[];
  route: Route | null;
  alternatives: Route[];
  user: { lat: number; lng: number } | null;
  userStale: boolean;
  manualPin: { lat: number; lng: number } | null;
  pickMode: boolean;
  selectedPlaceId: string | null;
  lowMotion: boolean;
  onPickPoint: (lat: number, lng: number) => void;
  onSelectPlace: (place: Place) => void;
  handleRef?: Ref<MapCanvasHandle>;
}

export default function MapCanvas({
  zones,
  edges,
  nodeById,
  buildings,
  places,
  route,
  alternatives,
  user,
  userStale,
  manualPin,
  pickMode,
  selectedPlaceId,
  lowMotion,
  onPickPoint,
  onSelectPlace,
  handleRef,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; midpointX: number; midpointY: number } | null>(null);

  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    const v = viewRef.current;
    const next = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
    const ratio = next / v.k;
    setView({
      k: next,
      x: px - (px - v.x) * ratio,
      y: py - (py - v.y) * ratio,
    });
  }, []);

  const zoomRef = useRef(zoomAt);
  zoomRef.current = zoomAt;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const p = svgPoint(e.clientX, e.clientY);
      zoomRef.current(p.x, p.y, Math.exp(-dy * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [svgPoint]);

  useImperativeHandle(
    handleRef,
    () => ({
      focus: (lat: number, lng: number, k = 3.2) => {
        setView({ k, x: W / 2 - toX(lng) * k, y: H / 2 - toY(lat) * k });
      },
      reset: () => setView({ x: 0, y: 0, k: 1 }),
    }),
    [],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()].slice(0, 2);
      const [a, b] = points;
      if (!a || !b) return;
      pinchRef.current = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        midpointX: (a.x + b.x) / 2,
        midpointY: (a.y + b.y) / 2,
      };
      dragRef.current = null;
      return;
    }

    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pointers = pointersRef.current;
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointers.size >= 2) {
      const points = [...pointers.values()].slice(0, 2);
      const [a, b] = points;
      if (!a || !b) return;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const midpointX = (a.x + b.x) / 2;
      const midpointY = (a.y + b.y) / 2;
      const previous = pinchRef.current;

      if (previous && previous.distance > 0) {
        const centerBefore = svgPoint(previous.midpointX, previous.midpointY);
        const centerAfter = svgPoint(midpointX, midpointY);
        const factor = distance / previous.distance;
        const v = viewRef.current;
        const next = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
        const ratio = next / v.k;

        setView({
          k: next,
          x: v.x + (centerAfter.x - centerBefore.x) - (centerBefore.x - v.x) * (ratio - 1),
          y: v.y + (centerAfter.y - centerBefore.y) - (centerBefore.y - v.y) * (ratio - 1),
        });
      }

      pinchRef.current = { distance, midpointX, midpointY };
      dragRef.current = null;
      return;
    }

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const from = svgPoint(d.x, d.y);
    const to = svgPoint(e.clientX, e.clientY);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const wasPinching = pointersRef.current.size >= 2 || !!pinchRef.current;
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    const d = dragRef.current;
    dragRef.current = null;
    if (wasPinching || !d || d.moved) return;
    if (!pickMode) return;
    const p = svgPoint(e.clientX, e.clientY);
    const v = viewRef.current;
    onPickPoint(fromY((p.y - v.y) / v.k), fromX((p.x - v.x) / v.k));
  };

  const routeEdgeIds = new Set(route?.segments.map((s) => s.edge.id) ?? []);
  const strokeScale = 1 / Math.sqrt(view.k);

  const polyPath = (line: [number, number][]) =>
    line.map(([lat, lng]) => `${toX(lng).toFixed(1)},${toY(lat).toFixed(1)}`).join(" ");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full touch-none select-none bg-[var(--map-bg)]"
      style={{ cursor: pickMode ? "crosshair" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        pointersRef.current.delete(e.pointerId);
        dragRef.current = null;
        if (pointersRef.current.size < 2) pinchRef.current = null;
      }}
      role="img"
      aria-label="Offline flood evacuation map"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0v40" fill="none" stroke="var(--map-grid)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x={-2000} y={-2000} width={6000} height={6000} fill="url(#grid)" />

      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        {/* Zones */}
        {zones.map((z) => (
          <polygon
            key={z.id}
            points={polyPath(z.polygon)}
            fill={RISK_STROKE[z.risk]}
            fillOpacity={z.risk === "green" ? 0.14 : z.risk === "yellow" ? 0.16 : 0.2}
            stroke={RISK_STROKE[z.risk]}
            strokeOpacity={0.75}
            strokeWidth={1.6 * strokeScale}
            strokeDasharray={z.risk === "green" ? undefined : `${6 * strokeScale} ${4 * strokeScale}`}
          />
        ))}

        {/* Buildings */}
        {buildings.map((b) => (
          <rect
            key={b.id}
            x={toX(b.lng)}
            y={toY(b.lat)}
            width={(b.w / (BOUNDS.maxLng - BOUNDS.minLng)) * W}
            height={(b.h / (BOUNDS.maxLat - BOUNDS.minLat)) * H}
            fill="var(--building)"
            opacity={0.85}
          />
        ))}

        {/* Water */}
        <polyline
          points={polyPath(RIVER)}
          fill="none"
          stroke="var(--water)"
          strokeWidth={14 * strokeScale}
          strokeLinecap="round"
        />
        <polyline
          points={polyPath(CANAL)}
          fill="none"
          stroke="var(--water)"
          strokeWidth={7 * strokeScale}
          strokeLinecap="round"
        />

        {/* Roads */}
        {edges.map((e) => {
          const a = nodeById.get(e.a);
          const b = nodeById.get(e.b);
          if (!a || !b) return null;
          const blocked = e.flooded || e.unsafe;
          const arterial = e.kind === "road" || e.kind === "evacuation" || e.kind === "bridge";
          return (
            <line
              key={e.id}
              x1={toX(a.lng)}
              y1={toY(a.lat)}
              x2={toX(b.lng)}
              y2={toY(b.lat)}
              stroke={blocked ? "var(--risk-red)" : RISK_STROKE[e.risk]}
              strokeOpacity={blocked ? 0.95 : routeEdgeIds.has(e.id) ? 1 : 0.55}
              strokeWidth={(arterial ? 3 : 1.7) * strokeScale}
              strokeDasharray={blocked ? `${3 * strokeScale} ${3 * strokeScale}` : undefined}
              strokeLinecap="round"
            />
          );
        })}

        {/* Alternative routes */}
        {alternatives.map((r) => (
          <polyline
            key={r.id}
            points={r.nodes.map((n) => `${toX(n.lng)},${toY(n.lat)}`).join(" ")}
            fill="none"
            stroke="var(--route-alt)"
            strokeWidth={4 * strokeScale}
            strokeOpacity={0.5}
            strokeDasharray={`${8 * strokeScale} ${6 * strokeScale}`}
            strokeLinecap="round"
          />
        ))}

        {/* Active route */}
        {route && (
          <>
            <polyline
              points={route.nodes.map((n) => `${toX(n.lng)},${toY(n.lat)}`).join(" ")}
              fill="none"
              stroke="var(--route)"
              strokeWidth={9 * strokeScale}
              strokeOpacity={0.28}
              strokeLinecap="round"
            />
            <polyline
              points={route.nodes.map((n) => `${toX(n.lng)},${toY(n.lat)}`).join(" ")}
              fill="none"
              stroke="var(--route)"
              strokeWidth={4.2 * strokeScale}
              strokeLinecap="round"
              strokeDasharray={lowMotion ? undefined : `${14 * strokeScale} ${8 * strokeScale}`}
              className={lowMotion ? undefined : "map-route-flow"}
            />
          </>
        )}

        {/* Places */}
        {places.map((p) => {
          const selected = p.id === selectedPlaceId;
          const closed = p.isOpen === false;
          const size = (selected ? 11 : 8) * strokeScale;
          return (
            <g
              key={p.id}
              transform={`translate(${toX(p.lng)} ${toY(p.lat)})`}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (!dragRef.current?.moved) onSelectPlace(p);
              }}
              style={{ cursor: "pointer" }}
            >
              <circle
                r={size}
                fill={closed ? "var(--risk-red)" : selected ? "var(--accent)" : "var(--marker)"}
                stroke="var(--map-bg)"
                strokeWidth={1.6 * strokeScale}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9 * strokeScale}
                fontWeight={700}
                fill="var(--map-bg)"
              >
                {PLACE_GLYPH[p.kind]}
              </text>
              {view.k > 2.2 && (
                <text
                  x={size + 4 * strokeScale}
                  y={3 * strokeScale}
                  fontSize={10 * strokeScale}
                  fill="var(--map-label)"
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Manual pin */}
        {manualPin && (
          <g transform={`translate(${toX(manualPin.lng)} ${toY(manualPin.lat)})`}>
            <path
              d={`M0 0 l${-7 * strokeScale} ${-14 * strokeScale} h${14 * strokeScale} Z`}
              fill="var(--accent)"
            />
            <circle r={3 * strokeScale} fill="var(--accent)" />
          </g>
        )}

        {/* User position */}
        {user && (
          <g transform={`translate(${toX(user.lng)} ${toY(user.lat)})`}>
            <circle
              r={18 * strokeScale}
              fill={userStale ? "var(--muted-foreground)" : "var(--gps)"}
              opacity={0.18}
            />
            <circle
              r={7 * strokeScale}
              fill={userStale ? "var(--muted-foreground)" : "var(--gps)"}
              stroke="var(--map-bg)"
              strokeWidth={2 * strokeScale}
            />
          </g>
        )}
      </g>

      {/* Zoom controls */}
      <g transform="translate(920 40)">
        {[
          { label: "+", f: 1.5, y: 0 },
          { label: "\u2212", f: 1 / 1.5, y: 52 },
        ].map((b) => (
          <g
            key={b.label}
            transform={`translate(0 ${b.y})`}
            onPointerUp={(e) => {
              e.stopPropagation();
              dragRef.current = null;
              zoomAt(W / 2, H / 2, b.f);
            }}
            style={{ cursor: "pointer" }}
          >
            <rect
              width="44"
              height="44"
              rx="10"
              fill="var(--panel)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x="22"
              y="24"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="22"
              fill="var(--foreground)"
            >
              {b.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
