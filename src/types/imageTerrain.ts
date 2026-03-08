/** Image-to-Terrain feature types */

export type ImageTerrainMode = "heightmap" | "engraved" | "raised";

export interface ImageTerrainState {
  enabled: boolean;
  /** Base64 data URL of the uploaded image */
  imageDataUrl: string | null;
  /** Original filename for display */
  fileName: string | null;
  mode: ImageTerrainMode;
  /** Depth/height of the terrain displacement, 0–100 */
  depth: number;
  /** Scale of the image mapping on the ring, 10–400 (%) */
  scale: number;
  /** Contrast adjustment, 0–200 (100 = neutral) */
  contrast: number;
  /** Gaussian smoothing radius, 0–20 */
  smoothing: number;
  /** Brightness threshold for what counts as "surface", 0–100 */
  threshold: number;
  /** Horizontal offset around the ring, 0–100 (%) */
  offsetU: number;
  /** Vertical offset along the ring width, 0–100 (%) */
  offsetV: number;
  /** Invert the height values */
  invert: boolean;
  /** Number of times to tile the image around the circumference */
  tileU: number;
  /** Number of times to tile along the width */
  tileV: number;
  /** Sharpness / unsharp-mask strength, 0–100 */
  sharpness: number;
  /** Circular wrap correction to compensate for curvature stretch, 0–100 */
  wrapCorrection: number;
  /** Auto-cleanup: histogram normalisation + noise reduction */
  autoCleanup: boolean;
  /** Active preset id or null for custom */
  presetId: string | null;
}

export interface ImageTerrainPreset {
  id: string;
  label: string;
  desc: string;
  icon: string; // lucide icon name hint
  params: Partial<ImageTerrainState>;
}

export const IMAGE_TERRAIN_PRESETS: ImageTerrainPreset[] = [
  {
    id: "lunar",
    label: "Lunar Terrain",
    desc: "Gentle craters & micro detail",
    icon: "moon",
    params: {
      mode: "heightmap",
      depth: 40,
      contrast: 130,
      smoothing: 4,
      sharpness: 25,
      wrapCorrection: 60,
      autoCleanup: true,
      invert: false,
      threshold: 50,
    },
  },
  {
    id: "volcanic",
    label: "Volcanic",
    desc: "Rough, aggressive texture",
    icon: "flame",
    params: {
      mode: "heightmap",
      depth: 70,
      contrast: 170,
      smoothing: 1,
      sharpness: 60,
      wrapCorrection: 50,
      autoCleanup: true,
      invert: false,
      threshold: 50,
    },
  },
  {
    id: "meteorite",
    label: "Meteorite",
    desc: "Deep pitted Widmanstätten-style",
    icon: "zap",
    params: {
      mode: "heightmap",
      depth: 55,
      contrast: 150,
      smoothing: 3,
      sharpness: 40,
      wrapCorrection: 70,
      autoCleanup: true,
      invert: true,
      threshold: 50,
    },
  },
  {
    id: "engraved-relief",
    label: "Engraved Relief",
    desc: "Clean cut into surface",
    icon: "arrow-down",
    params: {
      mode: "engraved",
      depth: 60,
      contrast: 140,
      smoothing: 3,
      sharpness: 50,
      wrapCorrection: 40,
      autoCleanup: true,
      invert: false,
      threshold: 45,
    },
  },
  {
    id: "raised-relief",
    label: "Raised Relief",
    desc: "Bold relief above surface",
    icon: "arrow-up",
    params: {
      mode: "raised",
      depth: 55,
      contrast: 130,
      smoothing: 2,
      sharpness: 45,
      wrapCorrection: 50,
      autoCleanup: true,
      invert: false,
      threshold: 55,
    },
  },
];

export const DEFAULT_IMAGE_TERRAIN: ImageTerrainState = {
  enabled: false,
  imageDataUrl: null,
  fileName: null,
  mode: "heightmap",
  depth: 50,
  scale: 100,
  contrast: 100,
  smoothing: 2,
  threshold: 50,
  offsetU: 0,
  offsetV: 0,
  invert: false,
  tileU: 1,
  tileV: 1,
  sharpness: 0,
  wrapCorrection: 50,
  autoCleanup: false,
  presetId: null,
};
