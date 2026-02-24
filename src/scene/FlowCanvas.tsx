import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { Texture } from "three";
import type { DestinationDatum, FlowDatum, NodeDatum } from "../data/types";
import { DestinationPeaks } from "./DestinationPeaks";
import { FlowRibbons } from "./FlowRibbons";
import { loadStrokeAlphaMaskTexture } from "../utils/createStrokeAlphaMask";

interface FlowCanvasProps {
  nodes: NodeDatum[];
  destinations: DestinationDatum[];
  flows: FlowDatum[];
  activeDestinationId: string | null;
  onDestinationHover: (id: string | null) => void;
  onDestinationSelect: (id: string | null) => void;
  enableBloom?: boolean;
}

export function FlowCanvas({
  nodes,
  destinations,
  flows,
  activeDestinationId,
  onDestinationHover,
  onDestinationSelect,
  enableBloom = true
}: FlowCanvasProps) {
  const [alphaMask, setAlphaMask] = useState<Texture | null>(null);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const destinationsById = useMemo(
    () => new Map(destinations.map((destination) => [destination.id, destination])),
    [destinations]
  );

  useEffect(() => {
    let disposed = false;
    let texture: Texture | null = null;
    loadStrokeAlphaMaskTexture().then((loadedTexture) => {
      if (disposed) {
        loadedTexture.dispose();
        return;
      }
      texture = loadedTexture;
      setAlphaMask(loadedTexture);
    });

    return () => {
      disposed = true;
      if (texture) {
        texture.dispose();
      }
    };
  }, []);

  return (
    <Canvas
      camera={{ position: [0, -170, 115], fov: 45, near: 0.1, far: 2000 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      onPointerMissed={() => onDestinationHover(null)}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 140, 480]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[120, -120, 180]} intensity={0.72} color="#d6e8ff" />

      <mesh position={[0, 0, -0.15]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color="#070a10" roughness={0.95} metalness={0.05} />
      </mesh>

      <DestinationPeaks
        destinations={destinations}
        activeDestinationId={activeDestinationId}
        onHover={onDestinationHover}
        onSelect={onDestinationSelect}
      />

      {alphaMask ? (
        <FlowRibbons
          flows={flows}
          nodesById={nodesById}
          destinationsById={destinationsById}
          activeDestinationId={activeDestinationId}
          alphaMask={alphaMask}
        />
      ) : null}

      <OrbitControls
        enablePan
        enableRotate
        enableZoom
        minDistance={50}
        maxDistance={420}
        maxPolarAngle={Math.PI * 0.48}
        target={[0, 0, 12]}
      />

      {enableBloom ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.08} luminanceSmoothing={0.25} />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}
