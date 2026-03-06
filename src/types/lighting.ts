export interface LightingSettings {
  /** Spherical azimuth in degrees (0=front, 90=right, 180=back, 270=left) */
  azimuth: number;
  /** Spherical elevation in degrees (0=horizon, 90=top) */
  elevation: number;
  /** Key light intensity multiplier 0.2–4.0 */
  keyIntensity: number;
  /** Fill light intensity multiplier 0–2.0 */
  fillIntensity: number;
  /** Ambient light intensity 0–1.5 */
  ambientIntensity: number;
  /** Environment map intensity 0–5.0 */
  envIntensity: number;
  /** Environment preset id */
  envPreset: "city" | "warehouse" | "studio" | "sunset" | "dawn" | "night" | "forest" | "apartment" | "park" | "lobby";
  /** Color temperature shift — warm/cool key light */
  warmth: number; // 0=cool blue, 50=neutral, 100=warm amber
}

export const DEFAULT_LIGHTING: LightingSettings = {
  azimuth: 35,
  elevation: 45,
  keyIntensity: 2.4,
  fillIntensity: 0.7,
  ambientIntensity: 0.15,
  envIntensity: 1.4,
  envPreset: "studio",
  warmth: 55,
};

export const LIGHTING_PRESETS: { id: string; label: string; icon: string; settings: Partial<LightingSettings> }[] = [
  {
    id: "jeweller",
    label: "Jeweller's Bench",
    icon: "💎",
    settings: { azimuth: 35, elevation: 45, keyIntensity: 2.4, fillIntensity: 0.7, ambientIntensity: 0.15, envIntensity: 1.4, envPreset: "studio", warmth: 55 },
  },
  {
    id: "studio",
    label: "Studio",
    icon: "💡",
    settings: { azimuth: 30, elevation: 55, keyIntensity: 2.5, fillIntensity: 0.8, ambientIntensity: 0.25, envIntensity: 1.2, envPreset: "studio", warmth: 55 },
  },
  {
    id: "product",
    label: "Product Shot",
    icon: "📸",
    settings: { azimuth: 20, elevation: 40, keyIntensity: 2.0, fillIntensity: 1.0, ambientIntensity: 0.3, envIntensity: 1.8, envPreset: "lobby", warmth: 50 },
  },
  {
    id: "dramatic",
    label: "Dramatic",
    icon: "🌑",
    settings: { azimuth: 80, elevation: 30, keyIntensity: 3.5, fillIntensity: 0.2, ambientIntensity: 0.05, envIntensity: 0.6, envPreset: "night", warmth: 45 },
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    icon: "🌅",
    settings: { azimuth: 15, elevation: 20, keyIntensity: 2.8, fillIntensity: 0.5, ambientIntensity: 0.15, envIntensity: 1.5, envPreset: "sunset", warmth: 85 },
  },
  {
    id: "showroom",
    label: "Showroom",
    icon: "✨",
    settings: { azimuth: 45, elevation: 60, keyIntensity: 2.0, fillIntensity: 1.0, ambientIntensity: 0.4, envIntensity: 2.0, envPreset: "lobby", warmth: 50 },
  },
  {
    id: "texture-reveal",
    label: "Texture Reveal",
    icon: "🔍",
    settings: { azimuth: 85, elevation: 15, keyIntensity: 3.0, fillIntensity: 0.1, ambientIntensity: 0.08, envIntensity: 0.4, envPreset: "warehouse", warmth: 50 },
  },
  {
    id: "soft-dawn",
    label: "Soft Dawn",
    icon: "🌤",
    settings: { azimuth: 0, elevation: 40, keyIntensity: 1.5, fillIntensity: 0.9, ambientIntensity: 0.35, envIntensity: 1.8, envPreset: "dawn", warmth: 65 },
  },
];
