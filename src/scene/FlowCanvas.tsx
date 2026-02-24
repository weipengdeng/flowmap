import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Color } from "three";
import type { DestinationDatum, FlowDatum, NodeDatum } from "../data/types";
import { BasemapLayer } from "./BasemapLayer";
import { FlowParticles } from "./FlowParticles";
import { NetRetentionPeaks } from "./NetRetentionPeaks";

interface FlowCanvasProps {
  nodes: NodeDatum[];
  destinations: DestinationDatum[];
  flows: FlowDatum[];
  aggregationSpacing: number;
  dayMix: number;
  showBasemap: boolean;
  enableBloom?: boolean;
}

export function FlowCanvas({
  nodes,
  destinations,
  flows,
  aggregationSpacing,
  dayMix,
  showBasemap,
  enableBloom = true
}: FlowCanvasProps) {
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const destinationsById = useMemo(
    () => new Map(destinations.map((destination) => [destination.id, destination])),
    [destinations]
  );
  const backgroundColor = useMemo(() => {
    const night = new Color("#010207");
    const day = new Color("#091c30");
    return night.lerp(day, dayMix * 0.85).getStyle();
  }, [dayMix]);
  const fogColor = useMemo(() => {
    const night = new Color("#02040b");
    const day = new Color("#10253b");
    return night.lerp(day, dayMix * 0.85).getStyle();
  }, [dayMix]);
  const groundColor = useMemo(() => {
    const night = new Color("#03060c");
    const day = new Color("#0b2136");
    return night.lerp(day, dayMix * 0.7).getStyle();
  }, [dayMix]);
  const ambientIntensity = 0.16 + dayMix * 0.24;
  const dirIntensity = 0.35 + dayMix * 0.45;

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

      <mesh position={[0, 0, -0.15]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color={groundColor} roughness={0.98} metalness={0.02} />
      </mesh>

      <BasemapLayer
        nodes={nodes}
        destinations={destinations}
        dayMix={dayMix}
        visible={showBasemap}
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
        minPolarAngle={0.02}
        maxPolarAngle={Math.PI * 0.98}
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
