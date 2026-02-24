import { BufferGeometry, CubicBezierCurve3, Float32BufferAttribute, Vector3 } from "three";
import type { DestinationDatum, FlowDatum, NodeDatum } from "../data/types";

export interface RibbonBuildOptions {
  samples?: number;
  minWidth?: number;
  maxWidth?: number;
}

function getWidth(weight: number, minWidth: number, maxWidth: number): number {
  return minWidth + (maxWidth - minWidth) * Math.min(1, Math.max(0, weight));
}

function createArcCurve(origin: NodeDatum, destination: DestinationDatum): CubicBezierCurve3 {
  const start = new Vector3(origin.x, origin.y, 0);
  const end = new Vector3(destination.x, destination.y, destination.height);
  const travel = new Vector3(end.x - start.x, end.y - start.y, 0);
  const distance = travel.length();
  const direction = travel.lengthSq() > 0 ? travel.normalize() : new Vector3(1, 0, 0);

  const arcHeight = Math.max(5, destination.height * 0.8 + distance * 0.25);
  const c1 = new Vector3(
    start.x + direction.x * distance * 0.2,
    start.y + direction.y * distance * 0.2,
    arcHeight
  );
  const c2 = new Vector3(
    start.x + direction.x * distance * 0.78,
    start.y + direction.y * distance * 0.78,
    Math.max(destination.height * 1.15, arcHeight * 0.6)
  );

  return new CubicBezierCurve3(start, c1, c2, end);
}

export function buildFlowRibbonGeometry(
  flow: FlowDatum,
  origin: NodeDatum,
  destination: DestinationDatum,
  options: RibbonBuildOptions = {}
): BufferGeometry {
  const samples = Math.max(24, Math.min(40, options.samples ?? 30));
  const minWidth = options.minWidth ?? 0.3;
  const maxWidth = options.maxWidth ?? 2.8;
  const width = getWidth(flow.w, minWidth, maxWidth);
  const curve = createArcCurve(origin, destination);

  const positions: number[] = [];
  const tangents: number[] = [];
  const sides: number[] = [];
  const us: number[] = [];
  const widths: number[] = [];
  const cuts: number[] = [];
  const stripV: number[] = [];
  const indices: number[] = [];

  const fallback = new Vector3(1, 0, 0);
  for (let i = 0; i < samples; i += 1) {
    const u = i / (samples - 1);
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    if (tangent.lengthSq() < 1e-6) {
      tangent.copy(fallback);
    }

    for (let side = -1; side <= 1; side += 2) {
      positions.push(point.x, point.y, point.z);
      tangents.push(tangent.x, tangent.y, tangent.z);
      sides.push(side);
      us.push(u);
      widths.push(width);
      cuts.push(flow.cuts[0], flow.cuts[1], flow.cuts[2]);
      stripV.push(side < 0 ? 0 : 1);
    }
  }

  for (let i = 0; i < samples - 1; i += 1) {
    const i0 = i * 2;
    const i1 = i0 + 1;
    const i2 = i0 + 2;
    const i3 = i0 + 3;
    indices.push(i0, i2, i1, i2, i3, i1);
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aTangent", new Float32BufferAttribute(tangents, 3));
  geometry.setAttribute("aSide", new Float32BufferAttribute(sides, 1));
  geometry.setAttribute("aU", new Float32BufferAttribute(us, 1));
  geometry.setAttribute("aWidth", new Float32BufferAttribute(widths, 1));
  geometry.setAttribute("aCuts", new Float32BufferAttribute(cuts, 3));
  geometry.setAttribute("aV", new Float32BufferAttribute(stripV, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

