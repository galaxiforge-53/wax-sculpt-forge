/**
 * Image-to-Terrain Engine v3
 * Converts an uploaded image into displacement, normal, roughness, and AO maps
 * suitable for wrapping around a ring's outer surface.
 *
 * v3 additions:
 * - Terrain strength (amplitude multiplier)
 * - Terrain compression (dynamic range compression for manufacturability)
 * - Edge protection (fade to neutral near ring top/bottom borders)
 * - Improved detail balancing (multi-scale min-feature clamping)
 * - Enhanced seam blending (wider zone, hermite interpolation)
 * - Normal-map preview export for 3-panel UI
 */
import * as THREE from "three";
import { ImageTerrainState } from "@/types/imageTerrain";

export interface ImageTerrainMapSet {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  displacementMap: THREE.CanvasTexture;
}

const MAP_W = 2048;
const MAP_H = 512;

// ── Cache ──
const cache = new Map<string, ImageTerrainMapSet>();

function cacheKey(state: ImageTerrainState): string {
  const { enabled, imageDataUrl, ...rest } = state;
  const imgHash = imageDataUrl ? imageDataUrl.length.toString(36) + imageDataUrl.slice(-32) : "none";
  return imgHash + JSON.stringify(rest);
}

export function disposeImageTerrainMaps(maps: ImageTerrainMapSet) {
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.aoMap.dispose();
  maps.displacementMap.dispose();
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ── Separable Gaussian Blur (U-wrapping, V-clamping) ──
function separableBlur(data: Float32Array, w: number, h: number, radius: number) {
  if (radius < 1) return;
  const tmp = new Float32Array(data.length);
  const diam = radius * 2 + 1;
  const invDiam = 1 / diam;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      sum += data[y * w + ((x % w) + w) % w];
    }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum * invDiam;
      sum -= data[y * w + ((x - radius + w) % w)];
      sum += data[y * w + ((x + radius + 1) % w)];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    }
    for (let y = 0; y < h; y++) {
      data[y * w + x] = sum * invDiam;
      sum -= tmp[Math.max(0, y - radius) * w + x];
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x];
    }
  }
}

// ── Auto-cleanup: histogram normalisation + mild denoise ──
function autoCleanup(heightmap: Float32Array, w: number, h: number) {
  const sorted = Float32Array.from(heightmap).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const range = hi - lo || 1;

  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, Math.min(1, (heightmap[i] - lo) / range));
  }

  separableBlur(heightmap, w, h, 1);
}

// ── Unsharp-mask sharpening ──
function unsharpMask(heightmap: Float32Array, w: number, h: number, strength: number) {
  if (strength <= 0) return;
  const blurred = Float32Array.from(heightmap);
  separableBlur(blurred, w, h, 3);

  const factor = strength / 50;
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, Math.min(1,
      heightmap[i] + (heightmap[i] - blurred[i]) * factor
    ));
  }
}

// ── Circular wrap correction ──
function circularWrapCorrection(heightmap: Float32Array, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const factor = amount / 100;
  const tmp = new Float32Array(heightmap.length);

  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1)) * 2 - 1;
    const curveFactor = 1 / (1 + factor * 0.3 * (1 - v * v));

    for (let x = 0; x < w; x++) {
      const center = w / 2;
      const srcX = center + (x - center) * curveFactor;
      const sx = ((srcX % w) + w) % w;
      const x0 = Math.floor(sx);
      const x1 = (x0 + 1) % w;
      const fx = sx - x0;
      const row = y * w;
      tmp[row + x] = heightmap[row + x0] * (1 - fx) + heightmap[row + x1] * fx;
    }
  }

  heightmap.set(tmp);
}

// ── Hermite smooth-step for blend curves ──
function hermite(t: number): number {
  return t * t * (3 - 2 * t);
}

// ── Improved seam blending with wider zone + hermite ──
function seamBlend(heightmap: Float32Array, w: number, h: number) {
  const blendZone = Math.max(12, Math.round(w * 0.05)); // 5% each side

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const leftVals = new Float32Array(blendZone);
    const rightVals = new Float32Array(blendZone);
    for (let x = 0; x < blendZone; x++) {
      leftVals[x] = heightmap[row + x];
      rightVals[x] = heightmap[row + w - blendZone + x];
    }

    for (let x = 0; x < blendZone; x++) {
      const t = hermite(x / blendZone);
      // Left edge: blend from right mirror
      heightmap[row + x] = rightVals[blendZone - 1 - x] * (1 - t) + leftVals[x] * t;
      // Right edge: blend toward left mirror
      const ri = w - blendZone + x;
      heightmap[row + ri] = rightVals[x] * (1 - t) + leftVals[blendZone - 1 - x] * t;
    }
  }
}

// ── Terrain strength: amplitude multiplier around 0.5 midpoint ──
function applyStrength(heightmap: Float32Array, strength: number) {
  // strength 50 = 1×, 0 = flat, 100 = 2×
  const factor = strength / 50;
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, Math.min(1, 0.5 + (heightmap[i] - 0.5) * factor));
  }
}

// ── Terrain compression: squash dynamic range via soft-knee curve ──
function applyCompression(heightmap: Float32Array, compression: number) {
  if (compression <= 0) return;
  // compression 0–100 maps to knee factor 0–0.6
  const knee = compression / 100 * 0.6;
  for (let i = 0; i < heightmap.length; i++) {
    const centered = heightmap[i] * 2 - 1; // -1..1
    // Soft saturation: tanh-like
    const compressed = centered / (1 + Math.abs(centered) * knee);
    heightmap[i] = compressed * 0.5 + 0.5;
  }
}

// ── Edge protection: fade terrain to 0.5 near V borders ──
function applyEdgeProtection(heightmap: Float32Array, w: number, h: number, edgeProtection: number) {
  if (edgeProtection <= 0) return;
  // edgeProtection 0–100 maps to fade zone 0–40% of height from each edge
  const fadeRatio = (edgeProtection / 100) * 0.4;
  const fadeRows = Math.max(1, Math.round(h * fadeRatio));

  for (let y = 0; y < h; y++) {
    let fade = 1;
    if (y < fadeRows) {
      fade = hermite(y / fadeRows);
    } else if (y >= h - fadeRows) {
      fade = hermite((h - 1 - y) / fadeRows);
    }

    if (fade < 1) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        // Blend toward neutral (0.5)
        heightmap[row + x] = 0.5 + (heightmap[row + x] - 0.5) * fade;
      }
    }
  }
}

// ── Detail balance: clamp minimum feature size for printability ──
function detailBalance(heightmap: Float32Array, w: number, h: number) {
  // Compute local gradient magnitude; if gradient is extreme but feature is tiny,
  // smooth it out. Use a simple laplacian-based approach.
  const laplacian = new Float32Array(heightmap.length);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const lap = heightmap[row + xl] + heightmap[row + xr]
                + heightmap[(y - 1) * w + x] + heightmap[(y + 1) * w + x]
                - 4 * heightmap[row + x];
      laplacian[row + x] = Math.abs(lap);
    }
  }

  // Where laplacian is very high (sharp spikes), blend toward local average
  // This prevents un-printable needle-thin features
  const threshold = 0.15;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const lap = laplacian[row + x];
      if (lap > threshold) {
        const xl = (x - 1 + w) % w;
        const xr = (x + 1) % w;
        const avg = (heightmap[row + xl] + heightmap[row + xr]
                   + heightmap[(y - 1) * w + x] + heightmap[(y + 1) * w + x]) / 4;
        const blend = Math.min(1, (lap - threshold) / threshold);
        heightmap[row + x] = heightmap[row + x] * (1 - blend * 0.5) + avg * blend * 0.5;
      }
    }
  }
}

// ── Image → Heightmap ──
function imageToHeightmap(
  img: HTMLImageElement,
  w: number,
  h: number,
  state: ImageTerrainState,
): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const tileU = Math.max(1, Math.round(state.tileU));
  const tileV = Math.max(1, Math.round(state.tileV));
  const scale = state.scale / 100;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);

  const imgW = w / tileU / scale;
  const imgH = h / tileV / scale;
  const offU = (state.offsetU / 100) * w;
  const offV = (state.offsetV / 100) * h;

  for (let tu = -1; tu <= tileU + 1; tu++) {
    for (let tv = -1; tv <= tileV + 1; tv++) {
      const dx = tu * (w / tileU) + offU;
      const dy = tv * (h / tileV) + offV;
      const cx = dx + (w / tileU - imgW) / 2;
      const cy = dy + (h / tileV - imgH) / 2;
      ctx.drawImage(img, cx, cy, imgW, imgH);
    }
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const heightmap = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3] / 255;
    let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lum = lum * a + 0.5 * (1 - a);
    heightmap[i] = lum;
  }

  // Pipeline order matters: cleanup → contrast → sharpen → mode → invert → smooth → strength → compression → wrap → edge → seam → detail

  if (state.autoCleanup) {
    autoCleanup(heightmap, w, h);
  }

  if (state.contrast !== 100) {
    const factor = state.contrast / 100;
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = Math.max(0, Math.min(1, 0.5 + (heightmap[i] - 0.5) * factor));
    }
  }

  unsharpMask(heightmap, w, h, state.sharpness);

  if (state.mode === "engraved" || state.mode === "raised") {
    const thresh = state.threshold / 100;
    for (let i = 0; i < heightmap.length; i++) {
      const d = (heightmap[i] - thresh) * 8;
      heightmap[i] = 1 / (1 + Math.exp(-d));
    }
    if (state.mode === "engraved") {
      for (let i = 0; i < heightmap.length; i++) {
        heightmap[i] = 1 - heightmap[i];
      }
    }
  }

  if (state.invert) {
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = 1 - heightmap[i];
    }
  }

  if (state.smoothing > 0) {
    const radius = Math.round(state.smoothing * (w / 512));
    if (radius > 0) separableBlur(heightmap, w, h, radius);
  }

  // New v3 processing stages
  applyStrength(heightmap, state.strength);
  applyCompression(heightmap, state.compression);
  circularWrapCorrection(heightmap, w, h, state.wrapCorrection);
  applyEdgeProtection(heightmap, w, h, state.edgeProtection);
  seamBlend(heightmap, w, h);
  detailBalance(heightmap, w, h);

  return heightmap;
}

// ── Map generators ──

function heightmapToNormalCanvas(heightmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(w, h);
  const px = imageData.data;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const l = heightmap[row + ((x - 1 + w) % w)];
      const r = heightmap[row + ((x + 1) % w)];
      const u = heightmap[Math.max(0, y - 1) * w + x];
      const d = heightmap[Math.min(h - 1, y + 1) * w + x];

      const dx = (l - r) * 2;
      const dy = (u - d) * 2;
      const len = Math.sqrt(dx * dx + dy * dy + 1);

      const i = (row + x) * 4;
      px[i]     = ((dx / len) * 0.5 + 0.5) * 255 | 0;
      px[i + 1] = ((dy / len) * 0.5 + 0.5) * 255 | 0;
      px[i + 2] = ((1 / len) * 0.5 + 0.5) * 255 | 0;
      px[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function heightmapToDisplacementCanvas(heightmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(w, h);
  const px = imageData.data;

  let min = 1, max = 0;
  for (let i = 0; i < heightmap.length; i++) {
    if (heightmap[i] < min) min = heightmap[i];
    if (heightmap[i] > max) max = heightmap[i];
  }
  const range = max - min || 1;

  for (let i = 0; i < heightmap.length; i++) {
    const v = ((heightmap[i] - min) / range) * 255 | 0;
    px[i * 4] = v;
    px[i * 4 + 1] = v;
    px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function heightmapToRoughnessCanvas(heightmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(w, h);
  const px = imageData.data;

  for (let i = 0; i < heightmap.length; i++) {
    const v = (0.3 + heightmap[i] * 0.5) * 255 | 0;
    px[i * 4] = v;
    px[i * 4 + 1] = v;
    px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function heightmapToAOCanvas(heightmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(w, h);
  const px = imageData.data;

  for (let i = 0; i < heightmap.length; i++) {
    const v = (0.5 + heightmap[i] * 0.5) * 255 | 0;
    px[i * 4] = v;
    px[i * 4 + 1] = v;
    px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generate preview images for the 3-panel terrain preview.
 * Returns { heightmap, normalMap } as data URLs.
 */
export async function generateTerrainPreviews(
  state: ImageTerrainState,
): Promise<{ heightmap: string; normalMap: string } | null> {
  if (!state.imageDataUrl) return null;
  const img = await loadImage(state.imageDataUrl);
  const pw = 512;
  const ph = 128;
  const hm = imageToHeightmap(img, pw, ph, state);
  const dispCanvas = heightmapToDisplacementCanvas(hm, pw, ph);
  const normCanvas = heightmapToNormalCanvas(hm, pw, ph);
  return {
    heightmap: dispCanvas.toDataURL("image/png"),
    normalMap: normCanvas.toDataURL("image/png"),
  };
}

// Keep backward-compat export
export async function generateHeightmapPreview(
  state: ImageTerrainState,
): Promise<string | null> {
  const result = await generateTerrainPreviews(state);
  return result?.heightmap ?? null;
}

/**
 * Generate all texture maps from an image terrain state.
 */
export async function generateImageTerrainMaps(
  state: ImageTerrainState,
  onProgress?: (percent: number, label: string) => void,
): Promise<ImageTerrainMapSet | null> {
  if (!state.enabled || !state.imageDataUrl) return null;

  const key = cacheKey(state);
  const cached = cache.get(key);
  if (cached) return cached;

  onProgress?.(10, "Loading image…");
  const img = await loadImage(state.imageDataUrl);

  onProgress?.(25, "Processing heightmap…");
  const heightmap = imageToHeightmap(img, MAP_W, MAP_H, state);

  onProgress?.(50, "Generating normal map…");
  const normalCanvas = heightmapToNormalCanvas(heightmap, MAP_W, MAP_H);

  onProgress?.(65, "Generating displacement…");
  const dispCanvas = heightmapToDisplacementCanvas(heightmap, MAP_W, MAP_H);

  onProgress?.(80, "Generating roughness & AO…");
  const roughCanvas = heightmapToRoughnessCanvas(heightmap, MAP_W, MAP_H);
  const aoCanvas = heightmapToAOCanvas(heightmap, MAP_W, MAP_H);

  onProgress?.(95, "Finalizing textures…");

  const wrapS = THREE.RepeatWrapping;
  const wrapT = THREE.ClampToEdgeWrapping;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = wrapS;
  normalMap.wrapT = wrapT;

  const displacementMap = new THREE.CanvasTexture(dispCanvas);
  displacementMap.wrapS = wrapS;
  displacementMap.wrapT = wrapT;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = wrapS;
  roughnessMap.wrapT = wrapT;

  const aoMap = new THREE.CanvasTexture(aoCanvas);
  aoMap.wrapS = wrapS;
  aoMap.wrapT = wrapT;

  const maps: ImageTerrainMapSet = { normalMap, roughnessMap, aoMap, displacementMap };

  if (cache.size >= 4) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      const old = cache.get(oldest);
      if (old) disposeImageTerrainMaps(old);
      cache.delete(oldest);
    }
  }
  cache.set(key, maps);

  onProgress?.(100, "Done");
  return maps;
}
