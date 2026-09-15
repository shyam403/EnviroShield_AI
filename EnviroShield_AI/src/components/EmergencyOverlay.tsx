import { PLACE_LABELS, type Place } from "@/data/city";
import type { Recommendation } from "@/lib/intelligence";
import type { Route } from "@/lib/routing";

const INSTRUCTIONS = [
  "Move to higher ground on foot. Do not wait for water to rise.",
  "Never walk or drive through moving water — 15 cm can knock you down.",
  "Avoid every road and bridge marked red on the map.",
  "Carry ID, medicines, drinking water and a charged torch.",
  "Switch off mains electricity and gas before leaving the building.",
  "Tell a neighbour which shelter you are heading to.",
];

interface Props {
  recommendations: Recommendation[];
  activeRoute: Route | null;
  positionLabel: string;
  positionStale: boolean;
  online: boolean;
  onSelect: (place: Place) => void;
  onExit: () => void;
}

function scoreColor(score: number) {
  if (score >= 78) return "text-risk-green";
  if (score >= 50) return "text-risk-yellow";
  return "text-risk-red";
}

export default function EmergencyOverlay({
  recommendations,
  activeRoute,
  positionLabel,
  positionStale,
  online,
  onSelect,
  onExit,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background/97 backdrop-blur-sm">
      <header className="flex items-center justify-between gap-3 border-b-2 border-risk-red bg-risk-red/15 px-4 py-3">
        <div>
          <p className="label-caps text-risk-red">Emergency mode active</p>
          <h2 className="font-display text-2xl leading-tight">Get to higher ground</h2>
        </div>
        <button
          onClick={onExit}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold uppercase tracking-wider"
        >
          Exit
        </button>
      </header>

      <div className="space-y-4 px-4 py-4">
        <section className="rounded-lg border border-border bg-panel p-3">
          <p className="label-caps text-muted-foreground">Your position</p>
          <p className="mt-1 text-lg font-semibold">{positionLabel}</p>
          {positionStale && (
            <p className="mt-1 text-sm text-risk-yellow">
              Location signal unavailable — this is your last known position. Tap the map to correct it.
            </p>
          )}
          {!online && (
            <p className="mt-1 text-sm text-muted-foreground">
              No network. Working entirely from the offline map and last synced hazard data.
            </p>
          )}
        </section>

        {activeRoute && (
          <section className="rounded-lg border-2 border-route bg-route/10 p-3">
            <p className="label-caps text-muted-foreground">Safest route selected</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={`font-display text-2xl ${scoreColor(activeRoute.safetyScore)}`}>
                  {activeRoute.safetyScore}
                </p>
                <p className="label-caps text-muted-foreground">Safety</p>
              </div>
              <div>
                <p className="font-display text-2xl">{(activeRoute.distanceM / 1000).toFixed(1)} km</p>
                <p className="label-caps text-muted-foreground">Distance</p>
              </div>
              <div>
                <p className="font-display text-2xl">{activeRoute.walkMinutes} min</p>
                <p className="label-caps text-muted-foreground">On foot</p>
              </div>
            </div>
            {activeRoute.dangerousSections > 0 && (
              <p className="mt-2 text-sm text-risk-red">
                {activeRoute.dangerousSections} dangerous section
                {activeRoute.dangerousSections > 1 ? "s" : ""} on this route — proceed with extreme care.
              </p>
            )}
          </section>
        )}

        <section>
          <p className="label-caps mb-2 text-muted-foreground">Nearest safe places</p>
          <ul className="space-y-2">
            {recommendations.map(({ place, route }) => (
              <li key={place.id}>
                <button
                  onClick={() => onSelect(place)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-panel px-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">{place.name}</span>
                    <span className="label-caps text-muted-foreground">
                      {PLACE_LABELS[place.kind]}
                      {place.isOpen === false ? " \u00b7 closed" : ""}
                      {place.capacity && place.occupancy
                        ? ` \u00b7 ${place.capacity - place.occupancy} spaces`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block font-display text-xl ${scoreColor(route.safetyScore)}`}>
                      {route.safetyScore}
                    </span>
                    <span className="label-caps text-muted-foreground">
                      {(route.distanceM / 1000).toFixed(1)} km
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!recommendations.length && (
              <li className="rounded-lg border border-border bg-panel p-3 text-sm text-muted-foreground">
                Set your position on the map to rank the nearest safe places.
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-panel p-3">
          <p className="label-caps text-muted-foreground">Emergency services</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { label: "Ambulance", num: "108" },
              { label: "Police", num: "100" },
              { label: "Disaster", num: "1077" },
            ].map((s) => (
              <a
                key={s.num}
                href={`tel:${s.num}`}
                className="rounded-md border border-border bg-secondary px-2 py-3 text-center"
              >
                <span className="block font-display text-2xl">{s.num}</span>
                <span className="label-caps text-muted-foreground">{s.label}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-panel p-3">
          <p className="label-caps text-muted-foreground">Safety instructions</p>
          <ol className="mt-2 space-y-2 text-sm">
            {INSTRUCTIONS.map((line, i) => (
              <li key={line} className="flex gap-2">
                <span className="font-display text-accent">{i + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="pb-6 text-xs text-muted-foreground">
          Animations and background work are reduced in emergency mode to save battery.
        </p>
      </div>
    </div>
  );
}
