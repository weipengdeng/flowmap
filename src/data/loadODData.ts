import type { HourlyFlowData, ODData, DestinationDatum, FlowDatum, MetaData, NodeDatum } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function loadODData(dataPath = "/data"): Promise<ODData> {
  const [meta, nodes, destinations, flows] = await Promise.all([
    fetchJson<MetaData>(`${dataPath}/meta.json`),
    fetchJson<NodeDatum[]>(`${dataPath}/nodes.json`),
    fetchJson<DestinationDatum[]>(`${dataPath}/destinations.json`),
    fetchJson<FlowDatum[]>(`${dataPath}/flows.json`)
  ]);

  let hourly: HourlyFlowData | undefined;
  try {
    hourly = await fetchJson<HourlyFlowData>(`${dataPath}/flows-hourly.json`);
  } catch {
    hourly = undefined;
  }

  return { meta, nodes, destinations, flows, hourly };
}

