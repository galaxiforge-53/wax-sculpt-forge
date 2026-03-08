export type CraterDensity = "low" | "med" | "high";
export type CraterSize = "small" | "med" | "large";
export type CraterShape = "circular" | "oval" | "organic" | "angular";
export type TerrainType =
  | "generic"       // Default — pure parameter-driven
  | "lunar"         // Earth's Moon — large circular craters, maria, ejecta
  | "mercurian"     // Mercury — dense overlapping, lobate scarps
  | "martian"       // Mars — wind-eroded, dust-filled
  | "phobos"        // Phobos — irregular clusters, parallel grooves
  | "deimos"        // Deimos — buried soft craters
  | "europa"        // Europa — icy fractures, very few craters
  | "callisto"      // Callisto — saturated ancient bombardment
  | "titan"         // Titan — almost no craters, organic dunes
  | "asteroid";     // Asteroid — irregular rubble-pile, deep regolith pits

export interface LunarTextureState {
  enabled: boolean;
  intensity: number;       // 0–100
  craterDensity: CraterDensity;
  craterSize: CraterSize;
  smoothEdges: boolean;
  seed: number;
  microDetail: number;     // 0–100
  rimSharpness: number;    // 0–100
  overlapIntensity: number; // 0–100
  // ── v2 fields ──
  rimHeight: number;        // 0–100, how much rims protrude above surface
  bowlDepth: number;        // 0–100, how deep crater bowls carve
  erosion: number;          // 0–100, weathering/softening of older craters
  terrainRoughness: number; // 0–100, base landscape bumpiness
  craterVariation: number;  // 0–100, per-crater randomness in shape
  // ── v3 fields ──
  craterShape: CraterShape;     // overall crater shape mode
  ovalElongation: number;       // 0–100, how stretched oval craters are (only for oval mode)
  ovalAngle: number;            // 0–360, direction of elongation
  mariaFill: number;            // 0–100, dark smooth plains between craters (like lunar maria)
  highlandRidges: number;       // 0–100, raised ridge networks between craters
  craterFloorTexture: number;   // 0–100, roughness inside crater bowls
  ejectaStrength: number;       // 0–100, intensity of radial ejecta rays
  // ── v4 fields ──
  terrainType?: TerrainType;    // planet-specific terrain generation mode
  terrainContrast?: number;     // 0–100, how dramatic crater depth/height differences appear (default 60)
  // ── v5 layer mix fields ──
  layerLargeCraters?: number;   // 0–100, strength of mega + hero craters (default 50)
  layerMediumImpacts?: number;  // 0–100, strength of medium + small impacts (default 50)
  layerMicroPitting?: number;   // 0–100, strength of micro pits + regolith texture (default 50)
  // ── v6 freeze field ──
  frozen?: boolean;             // if true, terrain won't regenerate when ring params change
  // ── v7 symmetry fields ──
  symmetry?: SymmetryMode;      // how many times the pattern repeats around the ring
  symmetryBlend?: number;       // 0–100, how smoothly mirrored sections blend (0 = hard edge, 100 = gradient)
  // ── v8 surface zones ──
  zones?: SurfaceZone[];        // multiple texture zones across the ring width
  zonesEnabled?: boolean;       // whether to use multi-zone rendering
  // ── v9 surface masks ──
  masks?: SurfaceMask[];        // shape-based masks to control where texture applies
  masksEnabled?: boolean;       // whether to use masking
  maskMode?: MaskMode;          // how masks combine: "include" = texture only inside, "exclude" = texture everywhere except
}

export type SymmetryMode = "none" | "2" | "3" | "4" | "6" | "8";

/** A surface zone defines texture properties for a portion of the ring's width */
export interface SurfaceZone {
  id: string;
  name: string;
  startV: number;              // 0–1, where this zone starts along the width
  endV: number;                // 0–1, where this zone ends
  intensity: number;           // 0–100, texture intensity for this zone
  craterDensity: CraterDensity;
  craterSize: CraterSize;
  smoothness: number;          // 0–100, how smooth (0 = full texture, 100 = polished)
  blendWidth: number;          // 0–50, percentage of zone width to blend at edges
}

export type ZonePreset = "center-smooth" | "edges-smooth" | "thirds" | "gradient" | "custom";

export const DEFAULT_ZONE: SurfaceZone = {
  id: "zone-1",
  name: "Full Surface",
  startV: 0,
  endV: 1,
  intensity: 100,
  craterDensity: "med",
  craterSize: "med",
  smoothness: 0,
  blendWidth: 10,
};

export const ZONE_PRESETS: Record<ZonePreset, SurfaceZone[]> = {
  "center-smooth": [
    { id: "z1", name: "Top Edge", startV: 0, endV: 0.25, intensity: 100, craterDensity: "med", craterSize: "med", smoothness: 0, blendWidth: 15 },
    { id: "z2", name: "Center Band", startV: 0.25, endV: 0.75, intensity: 0, craterDensity: "low", craterSize: "small", smoothness: 100, blendWidth: 15 },
    { id: "z3", name: "Bottom Edge", startV: 0.75, endV: 1, intensity: 100, craterDensity: "med", craterSize: "med", smoothness: 0, blendWidth: 15 },
  ],
  "edges-smooth": [
    { id: "z1", name: "Top Edge", startV: 0, endV: 0.2, intensity: 0, craterDensity: "low", craterSize: "small", smoothness: 100, blendWidth: 10 },
    { id: "z2", name: "Center", startV: 0.2, endV: 0.8, intensity: 100, craterDensity: "med", craterSize: "med", smoothness: 0, blendWidth: 10 },
    { id: "z3", name: "Bottom Edge", startV: 0.8, endV: 1, intensity: 0, craterDensity: "low", craterSize: "small", smoothness: 100, blendWidth: 10 },
  ],
  "thirds": [
    { id: "z1", name: "Top Third", startV: 0, endV: 0.33, intensity: 100, craterDensity: "high", craterSize: "small", smoothness: 0, blendWidth: 8 },
    { id: "z2", name: "Middle Third", startV: 0.33, endV: 0.66, intensity: 50, craterDensity: "med", craterSize: "med", smoothness: 50, blendWidth: 8 },
    { id: "z3", name: "Bottom Third", startV: 0.66, endV: 1, intensity: 100, craterDensity: "high", craterSize: "small", smoothness: 0, blendWidth: 8 },
  ],
  "gradient": [
    { id: "z1", name: "Heavy Top", startV: 0, endV: 0.5, intensity: 100, craterDensity: "high", craterSize: "med", smoothness: 0, blendWidth: 25 },
    { id: "z2", name: "Light Bottom", startV: 0.5, endV: 1, intensity: 30, craterDensity: "low", craterSize: "small", smoothness: 60, blendWidth: 25 },
  ],
  "custom": [],
};

// ── Surface Masks ─────────────────────────────────────────────────

export type MaskMode = "include" | "exclude";
export type MaskShape = "circle" | "rectangle" | "stripe-h" | "stripe-v" | "noise" | "gradient-h" | "gradient-v";

export interface SurfaceMask {
  id: string;
  name: string;
  enabled: boolean;
  shape: MaskShape;
  // Position (0-1 in UV space)
  centerU: number;             // 0–1, horizontal position around ring
  centerV: number;             // 0–1, vertical position across width
  // Size (0-1 relative)
  width: number;               // 0–1, width of mask shape
  height: number;              // 0–1, height of mask shape
  // Properties
  feather: number;             // 0–100, edge softness
  rotation: number;            // 0–360 degrees
  invert: boolean;             // flip mask inside/outside
  // Stripe/pattern specific
  stripeCount?: number;        // for stripe patterns
  stripeGap?: number;          // 0–100, gap between stripes
  // Noise specific
  noiseScale?: number;         // 0–100, size of noise pattern
  noiseThreshold?: number;     // 0–100, cutoff point
}

export const DEFAULT_MASK: SurfaceMask = {
  id: "mask-1",
  name: "Mask 1",
  enabled: true,
  shape: "circle",
  centerU: 0.5,
  centerV: 0.5,
  width: 0.3,
  height: 0.3,
  feather: 20,
  rotation: 0,
  invert: false,
  stripeCount: 4,
  stripeGap: 50,
  noiseScale: 50,
  noiseThreshold: 50,
};

export const MASK_PRESETS: Record<string, SurfaceMask[]> = {
  "center-spot": [
    { ...DEFAULT_MASK, id: "m1", name: "Center Spot", shape: "circle", centerU: 0.5, centerV: 0.5, width: 0.4, height: 0.6, feather: 30 },
  ],
  "horizontal-band": [
    { ...DEFAULT_MASK, id: "m1", name: "Center Band", shape: "rectangle", centerU: 0.5, centerV: 0.5, width: 1, height: 0.4, feather: 15 },
  ],
  "vertical-stripes": [
    { ...DEFAULT_MASK, id: "m1", name: "Vertical Stripes", shape: "stripe-v", centerU: 0.5, centerV: 0.5, width: 1, height: 1, feather: 5, stripeCount: 6, stripeGap: 50 },
  ],
  "organic-patches": [
    { ...DEFAULT_MASK, id: "m1", name: "Organic Patches", shape: "noise", centerU: 0.5, centerV: 0.5, width: 1, height: 1, feather: 10, noiseScale: 40, noiseThreshold: 45 },
  ],
  "dual-spots": [
    { ...DEFAULT_MASK, id: "m1", name: "Top Spot", shape: "circle", centerU: 0.25, centerV: 0.5, width: 0.25, height: 0.5, feather: 25 },
    { ...DEFAULT_MASK, id: "m2", name: "Bottom Spot", shape: "circle", centerU: 0.75, centerV: 0.5, width: 0.25, height: 0.5, feather: 25 },
  ],
};

export const DEFAULT_LUNAR_TEXTURE: LunarTextureState = {
  enabled: false,
  intensity: 50,
  craterDensity: "med",
  craterSize: "med",
  smoothEdges: true,
  seed: Math.floor(Math.random() * 9999),
  microDetail: 40,
  rimSharpness: 50,
  overlapIntensity: 30,
  rimHeight: 55,
  bowlDepth: 60,
  erosion: 25,
  terrainRoughness: 35,
  craterVariation: 50,
  craterShape: "circular",
  ovalElongation: 50,
  ovalAngle: 0,
  mariaFill: 0,
  highlandRidges: 0,
  craterFloorTexture: 30,
  ejectaStrength: 50,
  terrainType: "generic",
  terrainContrast: 60,
  layerLargeCraters: 50,
  layerMediumImpacts: 50,
  layerMicroPitting: 50,
  frozen: false,
  symmetry: "none",
  symmetryBlend: 30,
  zonesEnabled: false,
  zones: [],
  masksEnabled: false,
  masks: [],
  maskMode: "include",
};
