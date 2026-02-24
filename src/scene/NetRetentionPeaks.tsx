import { useEffect, useMemo } from "react";
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

function snap(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function hashNumber(input: number): number {
  const x = Math.sin(input * 17.123) * 14758.389;
  return x - Math.floor(x);
}

export function NetRetentionPeaks({
  flows,
  nodesById,
  destinationsById,
  gridSize,
  dayMix,
  alpha = 1
}: NetRetentionPeaksProps) {
  const geometry = useMemo(() => {
    const cellMap = new Map<string, CellMetric>();
    for (const flow of flows) {
      const origin = nodesById.get(flow.o);
      const destination = destinationsById.get(flow.d);
      if (!origin || !destination) {
        continue;
      }

      const ox = snap(origin.x, gridSize);
      const oy = snap(origin.y, gridSize);
      const ok = keyForCell(ox, oy);
      const oCell = cellMap.get(ok) ?? { x: ox, y: oy, net: 0 };
      oCell.net -= flow.total;
      cellMap.set(ok, oCell);

      const dx = snap(destination.x, gridSize);
      const dy = snap(destination.y, gridSize);
      const dk = keyForCell(dx, dy);
      const dCell = cellMap.get(dk) ?? { x: dx, y: dy, net: 0 };
      dCell.net += flow.total;
      cellMap.set(dk, dCell);
    }

    const positive = [...cellMap.values()]
      .filter((cell) => cell.net > 0)
      .sort((a, b) => b.net - a.net);
    const maxNet = positive.length ? positive[0].net : 1;

    const positions: number[] = [];
    const strengths: number[] = [];
    const maxPoints = 60000;
    let seedIndex = 1;

    for (const cell of positive) {
      const normalized = Math.sqrt(cell.net / maxNet);
      const stackCount = Math.max(2, Math.floor(2 + normalized * 34));
      for (let i = 0; i < stackCount; i += 1) {
        if (strengths.length >= maxPoints) {
          break;
        }
        const r1 = hashNumber(seedIndex * 0.73);
        const r2 = hashNumber(seedIndex * 1.91);
        const jitter = gridSize * 0.24;
        const x = cell.x + (r1 - 0.5) * jitter;
        const y = cell.y + (r2 - 0.5) * jitter;
        const z = 0.2 + i * (0.26 + normalized * 0.28) + hashNumber(seedIndex * 3.37) * 0.08;

        positions.push(x, y, z);
        strengths.push(normalized);
        seedIndex += 1;
      }
      if (strengths.length >= maxPoints) {
        break;
      }
    }

    const built = new BufferGeometry();
    built.setAttribute("position", new Float32BufferAttribute(positions, 3));
    built.setAttribute("aStrength", new Float32BufferAttribute(strengths, 1));
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
