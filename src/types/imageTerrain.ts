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
}

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
};
