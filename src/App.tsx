import { useEffect, useMemo, useState } from "react";
import { loadODData } from "./data/loadODData";
import type { FlowDatum, ODData } from "./data/types";
import { FlowCanvas } from "./scene/FlowCanvas";

type ViewMode = "aggregated" | "hourly";
const MAX_RENDERED_FLOWS = 1800;

function findFrameFlows(data: ODData, mode: ViewMode, hour: number): FlowDatum[] {
  if (mode === "hourly" && data.hourly) {
    return data.hourly.frames.find((frame) => frame.hour === hour)?.flows ?? [];
  }
  return data.flows;
}

export default function App() {
  const [data, setData] = useState<ODData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("aggregated");
  const [threshold, setThreshold] = useState(0);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hoveredDestinationId, setHoveredDestinationId] = useState<string | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [enableBloom, setEnableBloom] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadODData()
      .then((result) => {
        if (!mounted) {
          return;
        }
        setData(result);
        const firstHour = result.hourly?.hours?.[0] ?? 0;
        setHour(firstHour);
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
    if (!hours.includes(hour)) {
      setHour(hours[0]);
    }
  }, [hour, hours]);

  const baseFlows = useMemo(() => {
    if (!data) {
      return [] as FlowDatum[];
    }
    return findFrameFlows(data, mode, hour);
  }, [data, mode, hour]);

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
    const timer = window.setInterval(() => {
      setHour((current) => {
        const index = hours.indexOf(current);
        const nextIndex = index < 0 ? 0 : (index + 1) % hours.length;
        return hours[nextIndex];
      });
    }, 1200);

    return () => {
      window.clearInterval(timer);
    };
  }, [hours, mode, playing]);

  const activeDestinationId = selectedDestinationId ?? hoveredDestinationId;

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
        activeDestinationId={activeDestinationId}
        onDestinationHover={setHoveredDestinationId}
        onDestinationSelect={(id) => {
          setSelectedDestinationId((current) => (current === id ? null : id));
        }}
        enableBloom={enableBloom}
      />

      <div className="overlay panel">
        <h1>Flowmap Wanderlust</h1>
        <p>
          {visibleFlows.length.toLocaleString()} / {baseFlows.length.toLocaleString()} flows
          {isCapped ? ` (top ${MAX_RENDERED_FLOWS.toLocaleString()})` : ""}
          {" | "}
          threshold: {Math.round(threshold).toLocaleString()}
          {mode === "hourly" ? ` | hour ${hour.toString().padStart(2, "0")}:00` : ""}
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

        {mode === "hourly" ? (
          <>
            <div className="row">
              <label htmlFor="hour">Hour</label>
              <input
                id="hour"
                type="range"
                min={0}
                max={23}
                step={1}
                value={hour}
                onChange={(event) => setHour(Number(event.target.value))}
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
