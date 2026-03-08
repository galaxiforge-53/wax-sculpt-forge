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
  | "titan";        // Titan — almost no craters, organic dunes

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
}

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
};
