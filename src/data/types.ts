export interface MetaData {
  source: string;
  createdAt: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  center: [number, number];
  scale: number;
  nodeCount: number;
  destinationCount: number;
  flowCount: number;
}

export interface NodeDatum {
  id: string;
  x: number;
  y: number;
}

export interface DestinationDatum {
  id: string;
  x: number;
  y: number;
  inbound: number;
  height: number;
}

export interface FlowDatum {
  o: string;
  d: string;
  total: number;
  bins: [number, number, number, number];
  cuts: [number, number, number];
  w: number;
}

export interface HourlyFrame {
  hour: number;
  flows: FlowDatum[];
}

export interface HourlyFlowData {
  hours: number[];
  frames: HourlyFrame[];
}

export interface ODData {
  meta: MetaData;
  nodes: NodeDatum[];
  destinations: DestinationDatum[];
  flows: FlowDatum[];
  hourly?: HourlyFlowData;
}

