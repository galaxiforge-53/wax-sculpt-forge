export type CraterDensity = "low" | "med" | "high";
export type CraterSize = "small" | "med" | "large";

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
  // ── New v2 fields ──
  rimHeight: number;        // 0–100, how much rims protrude above surface
  bowlDepth: number;        // 0–100, how deep crater bowls carve
  erosion: number;          // 0–100, weathering/softening of older craters
  terrainRoughness: number; // 0–100, base landscape bumpiness
  craterVariation: number;  // 0–100, per-crater randomness in shape
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
};
