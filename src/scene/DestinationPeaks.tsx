import type { ThreeEvent } from "@react-three/fiber";
import type { DestinationDatum } from "../data/types";

interface DestinationPeaksProps {
  destinations: DestinationDatum[];
  activeDestinationId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

export function DestinationPeaks({
  destinations,
  activeDestinationId,
  onHover,
  onSelect
}: DestinationPeaksProps) {
  const handleOver = (event: ThreeEvent<PointerEvent>, id: string) => {
    event.stopPropagation();
    onHover(id);
  };

  const handleOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>, id: string) => {
    event.stopPropagation();
    onSelect(id);
  };

  return (
    <group>
      {destinations.map((destination) => {
        const isActive = destination.id === activeDestinationId;
        const baseColor = isActive ? "#ffe066" : "#21445f";
        const emissive = isActive ? "#ff9f1c" : "#0e1625";
        const radius = Math.max(0.35, Math.min(1.2, 0.2 + Math.sqrt(destination.height) * 0.08));

        return (
          <group
            key={destination.id}
            position={[destination.x, destination.y, 0]}
            onPointerOver={(event) => handleOver(event, destination.id)}
            onPointerOut={handleOut}
            onClick={(event) => handleClick(event, destination.id)}
          >
            <mesh position={[0, 0, destination.height / 2]}>
              <cylinderGeometry args={[radius * 0.45, radius, destination.height, 8]} />
              <meshStandardMaterial color={baseColor} emissive={emissive} emissiveIntensity={isActive ? 1.1 : 0.2} />
            </mesh>
            <mesh position={[0, 0, destination.height + 0.45]}>
              <sphereGeometry args={[0.26, 10, 10]} />
              <meshStandardMaterial color={isActive ? "#fff7d6" : "#7ec8ff"} emissive={isActive ? "#ffd166" : "#204060"} emissiveIntensity={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
