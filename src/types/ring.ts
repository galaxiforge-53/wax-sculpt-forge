export type RingProfile = "flat" | "dome" | "comfort" | "square" | "knife-edge";
export type MetalPreset = "silver" | "gold" | "rose-gold" | "titanium" | "tungsten";
export type FinishPreset = "polished" | "brushed" | "hammered" | "matte" | "satin";
export type ViewMode = "wax" | "cast" | "wax-print";

export type ToolType = "carve" | "smooth" | "bevel" | "groove" | "measure" | "flatten" | "stamp";

export interface RingParameters {
  size: number; // US ring size 3-16
  innerDiameter: number; // mm
  width: number; // mm
  thickness: number; // mm
  profile: RingProfile;
  comfortFit: boolean;
  grooveCount: number;
  grooveDepth: number;
  bevelSize: number;
}

export interface DesignPreview {
  id: "front" | "angle" | "side" | "inside";
  label: string;
  viewMode: ViewMode;
  dataUrl: string;
}

export interface DesignPackage {
  id: string;
  version: string;
  createdAt: string;
  parameters: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  toolHistory: ToolHistoryEntry[];
  previews: DesignPreview[];
  craftState: import("./craft").CraftState;
  castabilityReport: import("./castability").CastabilityReport;
  pipelineState: import("./pipeline").ForgePipelineState;
}

export interface ToolHistoryEntry {
  tool: ToolType;
  timestamp: number;
  params: Record<string, number>;
}

// US ring size to inner diameter (mm)
export const RING_SIZE_MAP: Record<number, number> = {
  3: 14.0, 4: 14.8, 5: 15.7, 6: 16.5, 7: 17.3, 8: 18.1,
  9: 19.0, 10: 19.8, 11: 20.6, 12: 21.4, 13: 22.2, 14: 23.0,
  15: 23.8, 16: 24.6,
};

export const DEFAULT_RING: RingParameters = {
  size: 8,
  innerDiameter: 18.1,
  width: 6,
  thickness: 2,
  profile: "comfort",
  comfortFit: true,
  grooveCount: 0,
  grooveDepth: 0.3,
  bevelSize: 0.3,
};
