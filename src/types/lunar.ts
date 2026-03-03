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
};
