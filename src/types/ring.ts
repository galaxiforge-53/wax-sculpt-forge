export type RingProfile = "flat" | "dome" | "comfort" | "square" | "knife-edge";
export type MetalPreset = "silver" | "gold" | "rose-gold" | "titanium" | "tungsten";
export type FinishPreset = "polished" | "brushed" | "hammered" | "matte" | "satin";
export type ViewMode = "wax" | "cast" | "wax-print";

export type ToolType = "carve" | "smooth" | "bevel" | "groove" | "measure" | "flatten" | "stamp" | "push" | "sculpt-carve" | "sculpt-smooth";

export type InteriorProfile = "flat" | "comfort-dome" | "european" | "anatomical";

/** Edge style controls how the ring's outer edges transition at the top/bottom of the band */
export type EdgeStyle = "sharp" | "soft-bevel" | "rounded" | "chamfer";

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
  // ── Edge style (optional for backward compat) ──
  edgeStyle?: EdgeStyle; // defaults to "soft-bevel" for backward compat
  // ── Interior controls (optional for backward compat) ──
  interiorCurvature?: number;    // 0–100, how domed the inner bore surface is (0 = flat cylinder, 100 = deep dome)
  comfortFitDepth?: number;      // 0–100, how deep the comfort curve extends into the band
  interiorProfile?: InteriorProfile; // shape of the inner bore cross-section
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

// ── Measurement unit system ──
export type RingSizeStandard = "US" | "UK" | "EU";

/** US → UK letter mapping (approximate) */
export const US_TO_UK: Record<number, string> = {
  3: "F", 4: "H", 5: "J½", 6: "L½", 7: "N½", 8: "P½",
  9: "R½", 10: "T½", 11: "V½", 12: "X½", 13: "Z+1", 14: "Z+2",
  15: "Z+3", 16: "Z+4",
};

/** US → EU size mapping (approximate, based on inner circumference) */
export const US_TO_EU: Record<number, number> = {
  3: 44, 4: 46.5, 5: 49, 6: 51.5, 7: 54, 8: 57,
  9: 59.5, 10: 62, 11: 64.5, 12: 67, 13: 69.5, 14: 72,
  15: 74.5, 16: 77,
};

/** Get ring size display string for a given US size in any standard */
export function formatRingSize(usSize: number, standard: RingSizeStandard): string {
  switch (standard) {
    case "US": return `${usSize}`;
    case "UK": return US_TO_UK[usSize] ?? `~${usSize}`;
    case "EU": return `${US_TO_EU[usSize] ?? Math.round(usSize * 2.5 + 36.5)}`;
  }
}

/** Get inner diameter in mm or inches */
export type DimensionUnit = "mm" | "inch";

export function formatDimension(mm: number, unit: DimensionUnit, decimals = 1): string {
  if (unit === "inch") return `${(mm / 25.4).toFixed(decimals + 1)}"`;
  return `${mm.toFixed(decimals)}mm`;
}

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
  edgeStyle: "soft-bevel",
  interiorCurvature: 40,
  comfortFitDepth: 50,
  interiorProfile: "comfort-dome",
};
