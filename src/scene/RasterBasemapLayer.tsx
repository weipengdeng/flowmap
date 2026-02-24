import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping } from "three";
import type { MetaData } from "../data/types";

interface RasterBasemapLayerProps {
  meta: MetaData;
  dayMix: number;
  visible: boolean;
  template: string;
}

interface TileDescriptor {
  key: string;
  url: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

const WEB_MERCATOR_LIMIT = 85.05112878;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lonToTileX(lon: number, zoom: number): number {
  const n = 2 ** zoom;
  return ((lon + 180) / 360) * n;
}

function latToTileY(lat: number, zoom: number): number {
  const n = 2 ** zoom;
  const latRad = (clamp(lat, -WEB_MERCATOR_LIMIT, WEB_MERCATOR_LIMIT) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
}

function tileXToLon(x: number, zoom: number): number {
  const n = 2 ** zoom;
  return (x / n) * 360 - 180;
}

function tileYToLat(y: number, zoom: number): number {
  const n = 2 ** zoom;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return (latRad * 180) / Math.PI;
}

function fillTemplate(template: string, x: number, y: number, z: number): string {
  const subdomains = ["a", "b", "c", "d"];
  const s = subdomains[Math.abs(x + y) % subdomains.length];
  return template
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y))
    .replace(/\{z\}/g, String(z))
    .replace(/\{s\}/g, s);
}

function buildTileDescriptors(meta: MetaData, template: string): TileDescriptor[] {
  const centerLon = meta.center[0];
  const centerLat = meta.center[1];
  const scale = meta.scale;

  const lonMin = centerLon + meta.bounds.minX / scale;
  const lonMax = centerLon + meta.bounds.maxX / scale;
  const latMin = centerLat + meta.bounds.minY / scale;
  const latMax = centerLat + meta.bounds.maxY / scale;
  const lonSpan = Math.max(0.03, lonMax - lonMin);

  const targetTilesAcross = 6;
  const zoomRaw = Math.log2((targetTilesAcross * 360) / lonSpan);
  const zoom = clamp(Math.round(zoomRaw), 8, 14);

  const xStart = Math.floor(lonToTileX(lonMin, zoom));
  const xEnd = Math.floor(lonToTileX(lonMax, zoom));
  const yStart = Math.floor(latToTileY(latMax, zoom));
  const yEnd = Math.floor(latToTileY(latMin, zoom));

  const descriptors: TileDescriptor[] = [];
  const n = 2 ** zoom;
  const xMin = clamp(xStart - 1, 0, n - 1);
  const xMax = clamp(xEnd + 1, 0, n - 1);
  const yMin = clamp(yStart - 1, 0, n - 1);
  const yMax = clamp(yEnd + 1, 0, n - 1);

  for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) {
      const lonLeft = tileXToLon(x, zoom);
      const lonRight = tileXToLon(x + 1, zoom);
      const latTop = tileYToLat(y, zoom);
      const latBottom = tileYToLat(y + 1, zoom);

      const left = (lonLeft - centerLon) * scale;
      const right = (lonRight - centerLon) * scale;
      const top = (latTop - centerLat) * scale;
      const bottom = (latBottom - centerLat) * scale;

      descriptors.push({
        key: `${zoom}-${x}-${y}`,
        url: fillTemplate(template, x, y, zoom),
        centerX: (left + right) * 0.5,
        centerY: (top + bottom) * 0.5,
        width: Math.abs(right - left),
        height: Math.abs(top - bottom)
      });
    }
  }
  return descriptors;
}

function RasterTile({ tile, dayMix }: { tile: TileDescriptor; dayMix: number }) {
  const texture = useTexture(tile.url);

  useEffect(() => {
    texture.anisotropy = 4;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[tile.centerX, tile.centerY, -0.12]} frustumCulled={false}>
      <planeGeometry args={[tile.width, tile.height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.38 + dayMix * 0.24}
        color={dayMix > 0.55 ? "#f2f7ff" : "#e7ecf6"}
      />
    </mesh>
  );
}

export function RasterBasemapLayer({ meta, dayMix, visible, template }: RasterBasemapLayerProps) {
  const tiles = useMemo(() => buildTileDescriptors(meta, template), [meta, template]);

  if (!visible) {
    return null;
  }

  return (
    <group>
      {tiles.map((tile) => (
        <RasterTile key={tile.key} tile={tile} dayMix={dayMix} />
      ))}
    </group>
  );
}
