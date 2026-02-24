import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Color } from "three";
import type { DestinationDatum, FlowDatum, MetaData, NodeDatum } from "../data/types";
import { BasemapLayer } from "./BasemapLayer";
import { FlowParticles } from "./FlowParticles";
import { NetRetentionPeaks } from "./NetRetentionPeaks";
import { RasterBasemapLayer } from "./RasterBasemapLayer";

export type BasemapMode = "none" | "network" | "raster";

interface FlowCanvasProps {
  meta: MetaData;
  nodes: NodeDatum[];
  destinations: DestinationDatum[];
  flows: FlowDatum[];
  aggregationSpacing: number;
  hourPosition: number;
  dayMix: number;
  basemapMode: BasemapMode;
  basemapTemplate: string;
  enableBloom?: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function FlowCanvas({
  meta,
  nodes,
  destinations,
  flows,
  aggregationSpacing,
  hourPosition,
  dayMix,
  basemapMode,
  basemapTemplate,
  enableBloom = true
}: FlowCanvasProps) {
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const destinationsById = useMemo(
    () => new Map(destinations.map((destination) => [destination.id, destination])),
    [destinations]
  );
  const normalizedHour = ((hourPosition % 24) + 24) % 24;
  const solar = Math.sin(((normalizedHour - 6) / 12) * Math.PI);
  const daylight = clamp01((solar + 0.14) / 1.14);
  const twilight = Math.exp(-Math.pow(solar / 0.34, 2));
  const noonWhiten = Math.pow(daylight, 1.55);
  const sunTravel = normalizedHour / 24;
  const sunX = -240 + sunTravel * 480;
  const sunY = -210 + Math.sin((sunTravel - 0.16) * Math.PI * 2) * 24;
  const sunZ = 22 + daylight * 118 + twilight * 22;
  const sunGlow = clamp01(daylight * 0.82 + twilight * 0.64);
  const backgroundColor = useMemo(() => {
    const night = new Color("#020611");
    const day = new Color("#2c688f");
    const bright = new Color("#eaf3ff");
    const sunset = new Color("#7a3f27");
    const base = night.lerp(day, dayMix * 0.86);
    return base.lerp(bright, noonWhiten * 0.08).lerp(sunset, twilight * 0.2).getStyle();
  }, [dayMix, noonWhiten, twilight]);
  const fogColor = useMemo(() => {
    const night = new Color("#02060f");
    const day = new Color("#5b8fb8");
    const bright = new Color("#f2f7ff");
    const warm = new Color("#8a5730");
    const base = night.lerp(day, dayMix * 0.84);
    return base.lerp(bright, noonWhiten * 0.12).lerp(warm, twilight * 0.14).getStyle();
  }, [dayMix, noonWhiten, twilight]);
  const groundColor = useMemo(() => {
    const night = new Color("#03070d");
    const day = new Color("#275274");
    const bright = new Color("#6c91af");
    const warm = new Color("#4f2f1f");
    const base = night.lerp(day, dayMix * 0.72);
    return base.lerp(bright, noonWhiten * 0.07).lerp(warm, twilight * 0.1).getStyle();
  }, [dayMix, noonWhiten, twilight]);
  const ambientIntensity = 0.17 + dayMix * 0.31 + twilight * 0.06;
  const dirIntensity = 0.34 + daylight * 0.66 + twilight * 0.2;

  return (
    <Canvas
      camera={{ position: [0, -170, 115], fov: 45, near: 0.1, far: 2000 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[backgroundColor]} />
      <fog attach="fog" args={[fogColor, 140, 500]} />
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={[120, -120, 180]} intensity={dirIntensity} color="#9dd5ff" />
      <hemisphereLight args={["#f2f8ff", "#0f1d2d", 0.08 + daylight * 0.34]} />

      <mesh position={[0, 0, -0.15]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color={groundColor} roughness={0.98} metalness={0.02} />
      </mesh>

      <group position={[sunX, sunY, sunZ]}>
        <pointLight
          color="#fff4dd"
          intensity={sunGlow * 2.9}
          distance={680}
          decay={1.55}
        />
        <mesh>
          <sphereGeometry args={[4.8, 16, 16]} />
          <meshBasicMaterial color="#fff5df" transparent opacity={sunGlow * 0.84} />
        </mesh>
        <mesh>
          <sphereGeometry args={[16, 20, 20]} />
          <meshBasicMaterial color="#ffd08c" transparent opacity={sunGlow * 0.24} />
        </mesh>
      </group>

      <BasemapLayer
        nodes={nodes}
        destinations={destinations}
        dayMix={dayMix}
        visible={basemapMode === "network"}
      />
      <RasterBasemapLayer
        meta={meta}
        dayMix={dayMix}
        visible={basemapMode === "raster"}
        template={basemapTemplate}
      />

      <NetRetentionPeaks
        flows={flows}
        nodesById={nodesById}
        destinationsById={destinationsById}
        gridSize={aggregationSpacing}
        dayMix={dayMix}
        alpha={1}
      />
      <FlowParticles
        flows={flows}
        nodesById={nodesById}
        destinationsById={destinationsById}
        dayMix={dayMix}
        alpha={1}
      />
      <FlowParticles
        flows={flows}
        nodesById={nodesById}
        destinationsById={destinationsById}
        dayMix={dayMix}
        alpha={0.38}
        distanceBoost
      />

      <OrbitControls
        enablePan
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.06}
        minDistance={35}
        maxDistance={520}
        minPolarAngle={0.001}
        maxPolarAngle={Math.PI * 0.999}
        target={[0, 0, 12]}
      />

      {enableBloom ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={1.25} luminanceThreshold={0.06} luminanceSmoothing={0.3} />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}
