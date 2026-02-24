import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { DestinationDatum, NodeDatum } from "../data/types";

interface BasemapLayerProps {
  nodes: NodeDatum[];
  destinations: DestinationDatum[];
  dayMix: number;
  visible: boolean;
  gridSize?: number;
}

interface GridCell {
  ix: number;
  iy: number;
  xSum: number;
  ySum: number;
  count: number;
}

function cellKey(ix: number, iy: number): string {
  return `${ix},${iy}`;
}

export function BasemapLayer({
  nodes,
  destinations,
  dayMix,
  visible,
  gridSize = 2.2
}: BasemapLayerProps) {
  const { lineGeometry, pointGeometry } = useMemo(() => {
    const cells = new Map<string, GridCell>();

    for (const point of nodes) {
      const ix = Math.round(point.x / gridSize);
      const iy = Math.round(point.y / gridSize);
      const key = cellKey(ix, iy);
      const cell = cells.get(key) ?? { ix, iy, xSum: 0, ySum: 0, count: 0 };
      cell.xSum += point.x;
      cell.ySum += point.y;
      cell.count += 1;
      cells.set(key, cell);
    }

    for (const point of destinations) {
      const ix = Math.round(point.x / gridSize);
      const iy = Math.round(point.y / gridSize);
      const key = cellKey(ix, iy);
      const cell = cells.get(key) ?? { ix, iy, xSum: 0, ySum: 0, count: 0 };
      cell.xSum += point.x;
      cell.ySum += point.y;
      cell.count += 1;
      cells.set(key, cell);
    }

    const centers = new Map<
      string,
      { ix: number; iy: number; x: number; y: number; density: number }
    >();
    for (const [key, cell] of cells) {
      centers.set(key, {
        ix: cell.ix,
        iy: cell.iy,
        x: cell.xSum / cell.count,
        y: cell.ySum / cell.count,
        density: cell.count
      });
    }

    const linePositions: number[] = [];
    const offsets = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1]
    ];

    for (const center of centers.values()) {
      for (const [dx, dy] of offsets) {
        const neighbor = centers.get(cellKey(center.ix + dx, center.iy + dy));
        if (!neighbor) {
          continue;
        }
        if ((center.density + neighbor.density) * 0.5 < 1.2) {
          continue;
        }
        linePositions.push(center.x, center.y, 0.02, neighbor.x, neighbor.y, 0.02);
      }
    }

    const pointPositions: number[] = [];
    for (const center of centers.values()) {
      if (center.density < 1) {
        continue;
      }
      pointPositions.push(center.x, center.y, 0.03);
    }

    const line = new BufferGeometry();
    line.setAttribute("position", new Float32BufferAttribute(linePositions, 3));
    if (linePositions.length > 0) {
      line.computeBoundingSphere();
    }

    const points = new BufferGeometry();
    points.setAttribute("position", new Float32BufferAttribute(pointPositions, 3));
    if (pointPositions.length > 0) {
      points.computeBoundingSphere();
    }

    return { lineGeometry: line, pointGeometry: points };
  }, [destinations, gridSize, nodes]);

  useEffect(
    () => () => {
      lineGeometry.dispose();
      pointGeometry.dispose();
    },
    [lineGeometry, pointGeometry]
  );

  const lineColor = useMemo(() => {
    const night = new Color("#0c2a4a");
    const day = new Color("#2a5f88");
    return night.lerp(day, dayMix).getStyle();
  }, [dayMix]);

  const pointColor = useMemo(() => {
    const night = new Color("#1f7ad0");
    const day = new Color("#66b7ff");
    return night.lerp(day, dayMix).getStyle();
  }, [dayMix]);

  if (!visible) {
    return null;
  }

  return (
    <group>
      <lineSegments geometry={lineGeometry} frustumCulled={false}>
        <lineBasicMaterial color={lineColor} transparent opacity={0.33} />
      </lineSegments>
      <points geometry={pointGeometry} frustumCulled={false}>
        <pointsMaterial color={pointColor} size={0.9} sizeAttenuation transparent opacity={0.34} />
      </points>
    </group>
  );
}

