import { useEffect, useMemo, useState } from "react";
import { loadODData } from "./data/loadODData";
import type { FlowDatum, ODData } from "./data/types";
import { FlowCanvas } from "./scene/FlowCanvas";

type ViewMode = "aggregated" | "hourly";
const MAX_RENDERED_FLOWS = 1800;

function flowKey(flow: { o: string; d: string }): string {
  return `${flow.o}|${flow.d}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeSqrt(value: number, minValue: number, maxValue: number): number {
  if (maxValue <= minValue) {
    return 1;
  }
  const sMin = Math.sqrt(minValue);
  const sMax = Math.sqrt(maxValue);
  return clamp01((Math.sqrt(value) - sMin) / (sMax - sMin));
}

function cutsFromBins(values: [number, number, number, number]): [number, number, number] {
  const total = values[0] + values[1] + values[2] + values[3];
  if (total <= 0) {
    return [0.25, 0.5, 0.75];
  }
  const c1 = values[0] / total;
  const c2 = (values[0] + values[1]) / total;
  const c3 = (values[0] + values[1] + values[2]) / total;
  return [clamp01(c1), clamp01(c2), clamp01(Math.min(c3, 0.99))];
}

function formatHourPosition(value: number): string {
  const normalized = ((value % 24) + 24) % 24;
  const totalMinutes = Math.round(normalized * 60);
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function interpolateHourlyFlows(
  frameMaps: Map<number, Map<string, FlowDatum>>,
  hourPosition: number
): FlowDatum[] {
  const normalizedHour = ((hourPosition % 24) + 24) % 24;
  const lowerHour = Math.floor(normalizedHour);
  const upperHour = (lowerHour + 1) % 24;
  const blend = normalizedHour - lowerHour;

  const lower = frameMaps.get(lowerHour) ?? new Map<string, FlowDatum>();
  const upper = frameMaps.get(upperHour) ?? new Map<string, FlowDatum>();
  const keys = new Set<string>([...lower.keys(), ...upper.keys()]);

  const merged: FlowDatum[] = [];
  for (const key of keys) {
    const from = lower.get(key);
    const to = upper.get(key);
    const fromBins = from?.bins ?? [0, 0, 0, 0];
    const toBins = to?.bins ?? [0, 0, 0, 0];
    const bins: [number, number, number, number] = [
      fromBins[0] * (1 - blend) + toBins[0] * blend,
      fromBins[1] * (1 - blend) + toBins[1] * blend,
      fromBins[2] * (1 - blend) + toBins[2] * blend,
      fromBins[3] * (1 - blend) + toBins[3] * blend
    ];
    const total = (from?.total ?? 0) * (1 - blend) + (to?.total ?? 0) * blend;
    if (total <= 1e-4) {
      continue;
    }
    const [o, d] = key.split("|");
    merged.push({
      o,
      d,
      total,
      bins,
      cuts: cutsFromBins(bins),
      w: 0
    });
  }

  if (!merged.length) {
    return merged;
  }
  const totals = merged.map((flow) => flow.total);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  for (const flow of merged) {
    flow.w = normalizeSqrt(flow.total, minTotal, maxTotal);
  }
  return merged.sort((a, b) => b.total - a.total);
}

export default function App() {
  const [data, setData] = useState<ODData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("aggregated");
  const [threshold, setThreshold] = useState(0);
  const [hourPosition, setHourPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [aggregationSpacing, setAggregationSpacing] = useState(3);
  const [enableBloom, setEnableBloom] = useState(true);
  const [showBasemap, setShowBasemap] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadODData()
      .then((result) => {
        if (!mounted) {
          return;
        }
        setData(result);
        const firstHour = result.hourly?.hours?.[0] ?? 0;
        setHourPosition(firstHour);
        const sortedTotals = result.flows
          .map((flow) => flow.total)
          .sort((a, b) => a - b);
        const defaultIndex = Math.floor(sortedTotals.length * 0.9);
        setThreshold(sortedTotals[defaultIndex] ?? 0);
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load data.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const hourlyAvailable = Boolean(data?.hourly?.frames.length);
  const hours = data?.hourly?.hours ?? [];

  useEffect(() => {
    if (mode === "hourly" && !hourlyAvailable) {
      setMode("aggregated");
    }
  }, [hourlyAvailable, mode]);

  useEffect(() => {
    if (!hours.length) {
      return;
    }
    const normalizedHour = ((hourPosition % 24) + 24) % 24;
    const nearestHour = Math.floor(normalizedHour);
    if (!hours.includes(nearestHour)) {
      setHourPosition(hours[0]);
    }
  }, [hourPosition, hours]);

  const hourlyFrameMaps = useMemo(() => {
    if (!data?.hourly) {
      return null;
    }
    const maps = new Map<number, Map<string, FlowDatum>>();
    for (const frame of data.hourly.frames) {
      const frameMap = new Map<string, FlowDatum>();
      for (const flow of frame.flows) {
        frameMap.set(flowKey(flow), flow);
      }
      maps.set(frame.hour, frameMap);
    }
    return maps;
  }, [data]);

  const baseFlows = useMemo(() => {
    if (!data) {
      return [] as FlowDatum[];
    }
    if (mode === "hourly" && hourlyFrameMaps) {
      return interpolateHourlyFlows(hourlyFrameMaps, hourPosition);
    }
    return data.flows;
  }, [data, mode, hourlyFrameMaps, hourPosition]);

  const maxTotal = useMemo(
    () => baseFlows.reduce((maxValue, flow) => Math.max(maxValue, flow.total), 0),
    [baseFlows]
  );
  const thresholdStep = Math.max(1, Math.floor(maxTotal / 250));

  useEffect(() => {
    setThreshold((previous) => Math.min(previous, maxTotal));
  }, [maxTotal]);

  const filteredFlows = useMemo(
    () => baseFlows.filter((flow) => flow.total >= threshold).sort((a, b) => b.total - a.total),
    [baseFlows, threshold]
  );
  const visibleFlows = useMemo(() => filteredFlows.slice(0, MAX_RENDERED_FLOWS), [filteredFlows]);
  const isCapped = filteredFlows.length > MAX_RENDERED_FLOWS;

  useEffect(() => {
    if (mode !== "hourly" || !playing || hours.length < 2) {
      return;
    }
    let frameId = 0;
    let lastTime = performance.now();
    const hoursPerSecond = 0.2;
    const tick = (now: number) => {
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;
      setHourPosition((current) => {
        const next = current + deltaSeconds * hoursPerSecond;
        return next >= 24 ? next - 24 : next;
      });
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [hours, mode, playing]);

  const dayMix = useMemo(() => {
    const normalizedHour = ((hourPosition % 24) + 24) % 24;
    const phase = ((normalizedHour - 12) / 12) * Math.PI;
    return Math.pow(clamp01((Math.cos(phase) + 1) * 0.5), 0.78);
  }, [hourPosition]);
  const hourLabel = useMemo(() => formatHourPosition(hourPosition), [hourPosition]);

  if (error) {
    return <div className="overlay error">Error: {error}</div>;
  }

  if (!data) {
    return <div className="overlay loading">Loading OD flow data...</div>;
  }

  return (
    <div className="app-shell">
      <FlowCanvas
        nodes={data.nodes}
        destinations={data.destinations}
        flows={visibleFlows}
        aggregationSpacing={aggregationSpacing}
        dayMix={dayMix}
        showBasemap={showBasemap}
        enableBloom={enableBloom}
      />

      <div className="overlay panel">
        <h1>Flowmap Wanderlust</h1>
        <p>
          {visibleFlows.length.toLocaleString()} / {baseFlows.length.toLocaleString()} flows
          {isCapped ? ` (top ${MAX_RENDERED_FLOWS.toLocaleString()})` : ""}
          {" | "}
          threshold: {Math.round(threshold).toLocaleString()}
          {" | "}
          grid: {aggregationSpacing.toFixed(1)}
          {mode === "hourly" ? ` | hour ${hourLabel}` : ""}
        </p>

        <div className="row">
          <label>Mode</label>
          <div className="toggle-group">
            <button
              className={mode === "aggregated" ? "active" : ""}
              type="button"
              onClick={() => setMode("aggregated")}
            >
              Aggregated
            </button>
            <button
              className={mode === "hourly" ? "active" : ""}
              type="button"
              onClick={() => setMode("hourly")}
              disabled={!hourlyAvailable}
            >
              Hourly
            </button>
          </div>
        </div>

        <div className="row">
          <label htmlFor="threshold">Min total</label>
          <input
            id="threshold"
            type="range"
            min={0}
            max={maxTotal}
            step={thresholdStep}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </div>

        <div className="row">
          <label htmlFor="grid">Grid size</label>
          <input
            id="grid"
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={aggregationSpacing}
            onChange={(event) => setAggregationSpacing(Number(event.target.value))}
          />
        </div>

        <div className="row">
          <label>Basemap</label>
          <button type="button" onClick={() => setShowBasemap((state) => !state)}>
            {showBasemap ? "On" : "Off"}
          </button>
        </div>

        {mode === "hourly" ? (
          <>
            <div className="row">
              <label htmlFor="hour">Hour</label>
              <input
                id="hour"
                type="range"
                min={0}
                max={23.95}
                step={0.05}
                value={hourPosition}
                onChange={(event) => setHourPosition(Number(event.target.value))}
              />
            </div>
            <div className="row">
              <label>Animate</label>
              <button type="button" onClick={() => setPlaying((state) => !state)}>
                {playing ? "Pause" : "Play"}
              </button>
            </div>
          </>
        ) : null}

        <div className="row">
          <label>Bloom</label>
          <button type="button" onClick={() => setEnableBloom((state) => !state)}>
            {enableBloom ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}
