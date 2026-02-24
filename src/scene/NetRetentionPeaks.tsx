import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { DestinationDatum, FlowDatum, NodeDatum } from "../data/types";
import { createPeakParticleMaterial } from "../shaders/peakParticleShader";

interface NetRetentionPeaksProps {
  flows: FlowDatum[];
  nodesById: Map<string, NodeDatum>;
  destinationsById: Map<string, DestinationDatum>;
  gridSize: number;
  dayMix: number;
  alpha?: number;
}

interface CellMetric {
  x: number;
  y: number;
  net: number;
}

function keyForCell(x: number, y: number): string {
  return `${x.toFixed(4)},${y.toFixed(4)}`;
}

function snap(value: number, spacing: number): number {
  return Math.round(value / spacing) * spacing;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hashNumber(input: number): number {
  const x = Math.sin(input * 17.123) * 14758.389;
  return x - Math.floor(x);
}

function parseCellKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function NetRetentionPeaks({
  flows,
  nodesById,
  destinationsById,
  gridSize,
  dayMix,
  alpha = 1
}: NetRetentionPeaksProps) {
  const smoothNetRef = useRef<Map<string, number>>(new Map());
  const smoothMaxRef = useRef(1);

  const geometry = useMemo(() => {
    const rawCells = new Map<string, CellMetric>();

    for (const flow of flows) {
      const origin = nodesById.get(flow.o);
      const destination = destinationsById.get(flow.d);
      if (!origin || !destination) {
        continue;
      }

      const ox = snap(origin.x, gridSize);
      const oy = snap(origin.y, gridSize);
      const originKey = keyForCell(ox, oy);
      const originCell = rawCells.get(originKey) ?? { x: ox, y: oy, net: 0 };
      originCell.net -= flow.total;
      rawCells.set(originKey, originCell);

      const dx = snap(destination.x, gridSize);
      const dy = snap(destination.y, gridSize);
      const destKey = keyForCell(dx, dy);
      const destCell = rawCells.get(destKey) ?? { x: dx, y: dy, net: 0 };
      destCell.net += flow.total;
      rawCells.set(destKey, destCell);
    }

    const smoothCells = smoothNetRef.current;
    const allKeys = new Set<string>([...rawCells.keys(), ...smoothCells.keys()]);
    const smoothFactor = 0.17;

    for (const key of allKeys) {
      const target = rawCells.get(key)?.net ?? 0;
      const previous = smoothCells.get(key) ?? 0;
      const next = previous + (target - previous) * smoothFactor;

      if (Math.abs(next) < 0.06 && target === 0) {
        smoothCells.delete(key);
      } else {
        smoothCells.set(key, next);
      }
    }

    const positiveCells: CellMetric[] = [];
    for (const [key, net] of smoothCells) {
      if (net <= 0.12) {
        continue;
      }
      const raw = rawCells.get(key);
      const coord = raw ?? { ...parseCellKey(key), net: 0 };
      positiveCells.push({ x: coord.x, y: coord.y, net });
    }
    positiveCells.sort((a, b) => b.net - a.net);

    const maxTarget = positiveCells.length ? positiveCells[0].net : 1;
    smoothMaxRef.current += (maxTarget - smoothMaxRef.current) * 0.12;
    const maxReference = Math.max(1, smoothMaxRef.current);

    const positions: number[] = [];
    const strengths: number[] = [];
    const activities: number[] = [];
    const seeds: number[] = [];
    const drifts: number[] = [];

    const maxParticles = 70000;
    const maxLayers = 42;
    let seedIndex = 1;

    for (const cell of positiveCells) {
      const normalized = clamp01(Math.sqrt(cell.net / maxReference));
      const stackHeight = 1.5 + normalized * 36.0;
      const layerCount = Math.min(maxLayers, Math.ceil(stackHeight + 1.5));

      for (let layer = 0; layer < layerCount; layer += 1) {
        if (strengths.length >= maxParticles) {
          break;
        }

        const activity = clamp01(stackHeight - layer);
        if (activity <= 0.015) {
          continue;
        }

        const r1 = hashNumber(seedIndex * 0.73);
        const r2 = hashNumber(seedIndex * 1.91);
        const r3 = hashNumber(seedIndex * 3.37);
        const r4 = hashNumber(seedIndex * 4.71);

        const coreJitter = gridSize * (0.08 + 0.12 * (1 - normalized));
        const x = cell.x + (r1 - 0.5) * coreJitter;
        const y = cell.y + (r2 - 0.5) * coreJitter;
        const z = 0.18 + layer * (0.22 + normalized * 0.3) + r3 * 0.06;

        const gatherRadius =
          gridSize * (0.45 + (1 - activity) * 1.8 + normalized * 0.5 + layer * 0.008);
        const theta = r4 * Math.PI * 2;
        const driftX = Math.cos(theta) * gatherRadius;
        const driftY = Math.sin(theta) * gatherRadius;

        positions.push(x, y, z);
        strengths.push(normalized);
        activities.push(activity);
        seeds.push(r3);
        drifts.push(driftX, driftY);
        seedIndex += 1;
      }
      if (strengths.length >= maxParticles) {
        break;
      }
    }

    const built = new BufferGeometry();
    built.setAttribute("position", new Float32BufferAttribute(positions, 3));
    built.setAttribute("aStrength", new Float32BufferAttribute(strengths, 1));
    built.setAttribute("aActivity", new Float32BufferAttribute(activities, 1));
    built.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
    built.setAttribute("aDrift", new Float32BufferAttribute(drifts, 2));
    if (strengths.length > 0) {
      built.computeBoundingSphere();
    }
    return built;
  }, [destinationsById, flows, gridSize, nodesById]);

  const material = useMemo(() => createPeakParticleMaterial(), []);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uDayMix.value = dayMix;
    material.uniforms.uGlobalAlpha.value = alpha;
  });

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry]
  );

  useEffect(
    () => () => {
      material.dispose();
    },
    [material]
  );

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

