import { useEffect, useMemo } from "react";
import type { Texture } from "three";
import type { DestinationDatum, FlowDatum, NodeDatum } from "../data/types";
import { buildFlowRibbonGeometry } from "../geometry/buildFlowRibbonGeometry";
import { createFlowRibbonMaterial } from "../shaders/flowRibbonShader";

interface FlowRibbonsProps {
  flows: FlowDatum[];
  nodesById: Map<string, NodeDatum>;
  destinationsById: Map<string, DestinationDatum>;
  activeDestinationId: string | null;
  alphaMask: Texture;
}

interface ResolvedFlow {
  flow: FlowDatum;
  origin: NodeDatum;
  destination: DestinationDatum;
}

interface FlowRibbonMeshProps extends ResolvedFlow {
  alphaMask: Texture;
  activeDestinationId: string | null;
}

function FlowRibbonMesh({
  flow,
  origin,
  destination,
  activeDestinationId,
  alphaMask
}: FlowRibbonMeshProps) {
  const geometry = useMemo(
    () => buildFlowRibbonGeometry(flow, origin, destination, { samples: 30, minWidth: 0.3, maxWidth: 2.8 }),
    [destination, flow, origin]
  );
  const material = useMemo(() => createFlowRibbonMaterial(alphaMask), [alphaMask]);

  const isConnected = activeDestinationId
    ? flow.d === activeDestinationId || flow.o === activeDestinationId
    : true;
  const highlight = activeDestinationId ? (isConnected ? 1 : 0) : 0.68;
  const baseAlpha = activeDestinationId ? (isConnected ? 0.88 : 0.08) : 0.62;
  const brightness = activeDestinationId ? (isConnected ? 1 : 0.55) : 0.9;

  useEffect(() => {
    material.uniforms.uHighlight.value = highlight;
    material.uniforms.uBaseAlpha.value = baseAlpha;
    material.uniforms.uBrightness.value = brightness;
  }, [baseAlpha, brightness, highlight, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export function FlowRibbons({
  flows,
  nodesById,
  destinationsById,
  activeDestinationId,
  alphaMask
}: FlowRibbonsProps) {
  const resolvedFlows = useMemo(() => {
    const entries: ResolvedFlow[] = [];
    for (const flow of flows) {
      const origin = nodesById.get(flow.o);
      const destination = destinationsById.get(flow.d);
      if (!origin || !destination) {
        continue;
      }
      entries.push({ flow, origin, destination });
    }
    return entries.sort((a, b) => a.flow.w - b.flow.w);
  }, [destinationsById, flows, nodesById]);

  return (
    <group>
      {resolvedFlows.map(({ flow, origin, destination }) => (
        <FlowRibbonMesh
          key={`${flow.o}-${flow.d}`}
          flow={flow}
          origin={origin}
          destination={destination}
          alphaMask={alphaMask}
          activeDestinationId={activeDestinationId}
        />
      ))}
    </group>
  );
}

