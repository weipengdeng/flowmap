import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { DestinationDatum, FlowDatum, NodeDatum } from "../data/types";
import { createFlowParticleMaterial } from "../shaders/flowParticleShader";

interface FlowParticlesProps {
  flows: FlowDatum[];
  nodesById: Map<string, NodeDatum>;
  destinationsById: Map<string, DestinationDatum>;
  dayMix: number;
  alpha?: number;
  distanceBoost?: boolean;
}

function hashNumber(input: number): number {
  const x = Math.sin(input * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildCurve(origin: NodeDatum, destination: DestinationDatum) {
  const start = new Vector3(origin.x, origin.y, 0.15);
  const end = new Vector3(destination.x, destination.y, 0.9 + destination.height * 0.28);
  const travel = new Vector3(end.x - start.x, end.y - start.y, 0);
  const distance = travel.length();
  const direction = travel.lengthSq() > 0 ? travel.normalize() : new Vector3(1, 0, 0);
  const arcHeight = Math.max(1.2, 1.8 + distance * 0.11 + destination.height * 0.15);

  const c1 = new Vector3(
    start.x + direction.x * distance * 0.24,
    start.y + direction.y * distance * 0.24,
    arcHeight
  );
  const c2 = new Vector3(
    start.x + direction.x * distance * 0.75,
    start.y + direction.y * distance * 0.75,
    Math.max(end.z + 0.7, arcHeight * 0.62)
  );

  return { start, c1, c2, end };
}

export function FlowParticles({
  flows,
  nodesById,
  destinationsById,
  dayMix,
  alpha = 1,
  distanceBoost = false
}: FlowParticlesProps) {
  const geometry = useMemo(() => {
    const starts: number[] = [];
    const c1s: number[] = [];
    const c2s: number[] = [];
    const ends: number[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    const intensities: number[] = [];
    const visibility: number[] = [];

    let seedIndex = 1;
    for (const flow of flows) {
      const origin = nodesById.get(flow.o);
      const destination = destinationsById.get(flow.d);
      if (!origin || !destination) {
        continue;
      }

      const curve = buildCurve(origin, destination);
      const distance2D = Math.hypot(destination.x - origin.x, destination.y - origin.y);
      const normalizedDistance = Math.min(1, distance2D / 160);
      const baseCount = distanceBoost
        ? Math.floor(1 + normalizedDistance * 6)
        : Math.floor(1 + flow.w * 9);
      const particleCount = Math.max(1, Math.min(distanceBoost ? 9 : 12, baseCount));
      for (let i = 0; i < particleCount; i += 1) {
        const r1 = hashNumber(seedIndex * 1.13);
        const r2 = hashNumber(seedIndex * 2.87);
        const r3 = hashNumber(seedIndex * 4.31);
        const spreadBase = distanceBoost ? normalizedDistance * 1.2 : flow.w * 1.55;
        const spread = 0.15 + spreadBase;

        starts.push(curve.start.x, curve.start.y, curve.start.z);
        c1s.push(curve.c1.x, curve.c1.y, curve.c1.z);
        c2s.push(curve.c2.x, curve.c2.y, curve.c2.z);
        ends.push(curve.end.x, curve.end.y, curve.end.z);

        phases.push(r1);
        const speedBase = distanceBoost ? 0.04 + normalizedDistance * 0.08 : 0.07 + flow.w * 0.2;
        speeds.push(speedBase + r2 * 0.05);
        offsets.push((r3 - 0.5) * spread);
        const sizeBase = distanceBoost ? 1.2 + normalizedDistance * 1.1 : 2.3 + flow.w * 2.8;
        sizes.push(sizeBase + r1 * (distanceBoost ? 0.45 : 0.9));
        const intensityBase = distanceBoost ? 0.12 + normalizedDistance * 0.4 : 0.2 + flow.w * 0.8;
        intensities.push(intensityBase);
        visibility.push(1);
        seedIndex += 1;
      }
    }

    const built = new BufferGeometry();
    built.setAttribute("position", new Float32BufferAttribute(new Float32Array(phases.length * 3), 3));
    built.setAttribute("aStart", new Float32BufferAttribute(starts, 3));
    built.setAttribute("aC1", new Float32BufferAttribute(c1s, 3));
    built.setAttribute("aC2", new Float32BufferAttribute(c2s, 3));
    built.setAttribute("aEnd", new Float32BufferAttribute(ends, 3));
    built.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
    built.setAttribute("aSpeed", new Float32BufferAttribute(speeds, 1));
    built.setAttribute("aOffset", new Float32BufferAttribute(offsets, 1));
    built.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    built.setAttribute("aIntensity", new Float32BufferAttribute(intensities, 1));
    built.setAttribute("aVisibility", new Float32BufferAttribute(visibility, 1));
    if (phases.length > 0) {
      built.computeBoundingSphere();
    }
    return built;
  }, [destinationsById, distanceBoost, flows, nodesById]);

  const material = useMemo(() => createFlowParticleMaterial(), []);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uDayMix.value = dayMix;
    material.uniforms.uGlobalAlpha.value = alpha;
    material.uniforms.uPointScale.value = distanceBoost ? 0.72 : 1.0;
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
