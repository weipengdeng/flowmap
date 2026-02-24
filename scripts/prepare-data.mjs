import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (insideQuote && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        insideQuote = !insideQuote;
      }
      continue;
    }
    if (char === "," && !insideQuote) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function sumRange(values, startInclusive, endExclusive) {
  let total = 0;
  for (let i = startInclusive; i < endExclusive; i += 1) {
    total += values[i] ?? 0;
  }
  return total;
}

function normalizeSqrt(value, minValue, maxValue) {
  if (maxValue <= minValue) {
    return 1;
  }
  const sMin = Math.sqrt(minValue);
  const sMax = Math.sqrt(maxValue);
  return (Math.sqrt(value) - sMin) / (sMax - sMin);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildCutsFromBins(bins) {
  const total = bins.reduce((acc, value) => acc + value, 0);
  if (total <= 0) {
    return [0.25, 0.5, 0.75];
  }
  const c1 = bins[0] / total;
  const c2 = (bins[0] + bins[1]) / total;
  const c3 = (bins[0] + bins[1] + bins[2]) / total;
  return [round(clamp01(c1)), round(clamp01(c2)), round(clamp01(Math.min(c3, 0.99)))];
}

function getIndex(headers, candidates) {
  for (const name of candidates) {
    const index = headers.indexOf(name);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

async function main() {
  const inputPath = process.argv[2] ?? "szflow.csv";
  const outputDir = process.argv[3] ?? "public/data";
  const csvText = await readFile(inputPath, "utf8");
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file is empty.");
  }

  const headers = parseCsvLine(lines[0]);
  const originLonIndex = getIndex(headers, ["起点_1", "origin_lon", "o_lon"]);
  const originLatIndex = getIndex(headers, ["起点_12", "origin_lat", "o_lat"]);
  const destLonIndex = getIndex(headers, ["终点_1", "destination_lon", "d_lon"]);
  const destLatIndex = getIndex(headers, ["终点_12", "destination_lat", "d_lat"]);
  const qtyIndex = getIndex(headers, ["数量", "count", "total", "value"]);
  const hourIndex = getIndex(headers, ["小时", "hour"]);

  if ([originLonIndex, originLatIndex, destLonIndex, destLatIndex, qtyIndex, hourIndex].some((i) => i < 0)) {
    throw new Error("CSV schema mismatch: expected origin/destination lon-lat, quantity, and hour columns.");
  }

  const nodeMap = new Map();
  const destinationMap = new Map();
  const flowMap = new Map();

  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  let nodeCounter = 0;
  let destinationCounter = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const oLon = Number(cells[originLonIndex]);
    const oLat = Number(cells[originLatIndex]);
    const dLon = Number(cells[destLonIndex]);
    const dLat = Number(cells[destLatIndex]);
    const qty = Number(cells[qtyIndex]);
    const hour = Number(cells[hourIndex]);

    if (
      !Number.isFinite(oLon) ||
      !Number.isFinite(oLat) ||
      !Number.isFinite(dLon) ||
      !Number.isFinite(dLat) ||
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      continue;
    }

    minLon = Math.min(minLon, oLon, dLon);
    maxLon = Math.max(maxLon, oLon, dLon);
    minLat = Math.min(minLat, oLat, dLat);
    maxLat = Math.max(maxLat, oLat, dLat);

    const oKey = `${oLon.toFixed(6)},${oLat.toFixed(6)}`;
    const dKey = `${dLon.toFixed(6)},${dLat.toFixed(6)}`;

    let origin = nodeMap.get(oKey);
    if (!origin) {
      origin = { id: `n${nodeCounter}`, lon: oLon, lat: oLat };
      nodeCounter += 1;
      nodeMap.set(oKey, origin);
    }

    let destination = destinationMap.get(dKey);
    if (!destination) {
      destination = { id: `d${destinationCounter}`, lon: dLon, lat: dLat, inbound: 0 };
      destinationCounter += 1;
      destinationMap.set(dKey, destination);
    }

    destination.inbound += qty;

    const flowKey = `${origin.id}|${destination.id}`;
    let flow = flowMap.get(flowKey);
    if (!flow) {
      flow = {
        o: origin.id,
        d: destination.id,
        total: 0,
        hourly: new Array(24).fill(0)
      };
      flowMap.set(flowKey, flow);
    }

    flow.total += qty;
    if (Number.isFinite(hour) && hour >= 0 && hour < 24) {
      flow.hourly[Math.floor(hour)] += qty;
    }
  }

  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const span = Math.max(maxLon - minLon, maxLat - minLat, 1e-9);
  const scale = 220 / span;

  const nodes = [...nodeMap.values()].map((node) => ({
    id: node.id,
    x: round((node.lon - centerLon) * scale, 4),
    y: round((node.lat - centerLat) * scale, 4)
  }));

  const inboundValues = [...destinationMap.values()].map((destination) => destination.inbound);
  const minInbound = Math.min(...inboundValues);
  const maxInbound = Math.max(...inboundValues);

  const destinations = [...destinationMap.values()].map((destination) => ({
    id: destination.id,
    x: round((destination.lon - centerLon) * scale, 4),
    y: round((destination.lat - centerLat) * scale, 4),
    inbound: round(destination.inbound, 4),
    height: round(2 + 28 * clamp01(normalizeSqrt(destination.inbound, minInbound, maxInbound)), 4)
  }));

  const flowBase = [...flowMap.values()].map((entry) => {
    const bins = [
      sumRange(entry.hourly, 0, 6),
      sumRange(entry.hourly, 6, 12),
      sumRange(entry.hourly, 12, 18),
      sumRange(entry.hourly, 18, 24)
    ];
    return {
      ...entry,
      bins,
      cuts: buildCutsFromBins(bins)
    };
  });

  const totals = flowBase.map((flow) => flow.total);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  const flows = flowBase
    .map((flow) => ({
      o: flow.o,
      d: flow.d,
      total: round(flow.total, 4),
      bins: flow.bins.map((value) => round(value, 4)),
      cuts: flow.cuts,
      w: round(clamp01(normalizeSqrt(flow.total, minTotal, maxTotal)))
    }))
    .sort((a, b) => b.total - a.total);

  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const frames = hours.map((hour) => {
    const hourValues = flowBase
      .map((flow) => ({
        flow,
        total: flow.hourly[hour] ?? 0
      }))
      .filter((entry) => entry.total > 0);

    if (!hourValues.length) {
      return { hour, flows: [] };
    }

    const frameMin = Math.min(...hourValues.map((entry) => entry.total));
    const frameMax = Math.max(...hourValues.map((entry) => entry.total));

    return {
      hour,
      flows: hourValues
        .map(({ flow, total }) => ({
          o: flow.o,
          d: flow.d,
          total: round(total, 4),
          bins: flow.bins.map((value) => round(value, 4)),
          cuts: flow.cuts,
          w: round(clamp01(normalizeSqrt(total, frameMin, frameMax)))
        }))
        .sort((a, b) => b.total - a.total)
    };
  });

  const bounds = {
    minX: Math.min(...nodes.map((node) => node.x), ...destinations.map((destination) => destination.x)),
    maxX: Math.max(...nodes.map((node) => node.x), ...destinations.map((destination) => destination.x)),
    minY: Math.min(...nodes.map((node) => node.y), ...destinations.map((destination) => destination.y)),
    maxY: Math.max(...nodes.map((node) => node.y), ...destinations.map((destination) => destination.y))
  };

  const meta = {
    source: path.basename(inputPath),
    createdAt: new Date().toISOString(),
    bounds,
    center: [round(centerLon, 8), round(centerLat, 8)],
    scale: round(scale, 8),
    nodeCount: nodes.length,
    destinationCount: destinations.length,
    flowCount: flows.length
  };

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8"),
    writeFile(path.join(outputDir, "nodes.json"), JSON.stringify(nodes, null, 2), "utf8"),
    writeFile(path.join(outputDir, "destinations.json"), JSON.stringify(destinations, null, 2), "utf8"),
    writeFile(path.join(outputDir, "flows.json"), JSON.stringify(flows, null, 2), "utf8"),
    writeFile(
      path.join(outputDir, "flows-hourly.json"),
      JSON.stringify({ hours, frames }, null, 2),
      "utf8"
    )
  ]);

  console.log(`Wrote ${flows.length} aggregated flows and ${frames.length} hourly frames to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

