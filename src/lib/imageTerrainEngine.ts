/**
 * Image-to-Terrain Engine v2
 * Converts an uploaded image into displacement, normal, roughness, and AO maps
 * suitable for wrapping around a ring's outer surface.
 *
 * v2 additions:
 * - Auto-cleanup (histogram normalisation + mild denoise)
 * - Unsharp-mask sharpening
 * - Circular wrap correction (compensates curvature stretch)
 * - Improved seam blending with cosine crossfade
 * - Depth balance clamping for manufacturability
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

  // Horizontal pass (wrapping U)
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

  // Vertical pass (clamping V)
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

// ── Auto-cleanup: histogram normalisation ──
function autoCleanup(heightmap: Float32Array) {
  // Find 2nd and 98th percentile for robust normalisation
  const sorted = Float32Array.from(heightmap).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const range = hi - lo || 1;

  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, Math.min(1, (heightmap[i] - lo) / range));
  }

  // Mild denoise: 1px blur
  separableBlur(heightmap, MAP_W, MAP_H, 1);
}

// ── Unsharp-mask sharpening ──
function unsharpMask(heightmap: Float32Array, w: number, h: number, strength: number) {
  if (strength <= 0) return;
  const blurred = Float32Array.from(heightmap);
  separableBlur(blurred, w, h, 3);

  const factor = strength / 50; // 50 = 1× sharpening
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = Math.max(0, Math.min(1,
      heightmap[i] + (heightmap[i] - blurred[i]) * factor
    ));
  }
}

// ── Circular wrap correction ──
// The outer surface of a ring stretches more at the "equator" (center of V)
// and compresses near the edges. This pre-distorts the U axis to compensate.
function circularWrapCorrection(heightmap: Float32Array, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const factor = amount / 100;
  const tmp = new Float32Array(heightmap.length);

  for (let y = 0; y < h; y++) {
    // v goes from -1 to 1 across the ring width
    const v = (y / (h - 1)) * 2 - 1;
    // At the edges of the band the circumference is smaller → compress U
    // At center it's larger → stretch U
    // The correction: scale U by 1/(1 + factor * (1 - v²))
    const curveFactor = 1 / (1 + factor * 0.3 * (1 - v * v));

    for (let x = 0; x < w; x++) {
      // Remap x through the curvature correction
      const center = w / 2;
      const srcX = center + (x - center) * curveFactor;
      // Bilinear sample with U wrapping
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

// ── Improved seam blending with cosine crossfade ──
function seamBlend(heightmap: Float32Array, w: number, h: number) {
  const blendZone = Math.max(8, Math.round(w * 0.04)); // 4% each side

  for (let y = 0; y < h; y++) {
    const row = y * w;
    // Collect left and right edge values
    const leftVals = new Float32Array(blendZone);
    const rightVals = new Float32Array(blendZone);
    for (let x = 0; x < blendZone; x++) {
      leftVals[x] = heightmap[row + x];
      rightVals[x] = heightmap[row + w - blendZone + x];
    }

    for (let x = 0; x < blendZone; x++) {
      // Cosine crossfade: smoother than linear
      const t = 0.5 - 0.5 * Math.cos(Math.PI * x / blendZone);
      // Left edge blends from right-side value
      heightmap[row + x] = rightVals[blendZone - 1 - x] * (1 - t) + leftVals[x] * t;
      // Right edge blends toward left-side value
      const ri = w - blendZone + x;
      heightmap[row + ri] = rightVals[x] * (1 - t) + leftVals[blendZone - 1 - x] * t;
    }
  }
}

// ── Depth balance: clamp extreme peaks/valleys for manufacturability ──
function depthBalance(heightmap: Float32Array) {
  // Soft-clamp: map through a tanh-like curve to prevent extremes
  // that would be too thin for wax printing / too deep for casting
  for (let i = 0; i < heightmap.length; i++) {
    const centered = heightmap[i] * 2 - 1; // -1..1
    // Soft saturation
    const balanced = centered / (1 + Math.abs(centered) * 0.15);
    heightmap[i] = balanced * 0.5 + 0.5;
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

  // ── Auto-cleanup ──
  if (state.autoCleanup) {
    autoCleanup(heightmap);
  }

  // ── Contrast ──
  if (state.contrast !== 100) {
    const factor = state.contrast / 100;
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = Math.max(0, Math.min(1, 0.5 + (heightmap[i] - 0.5) * factor));
    }
  }

  // ── Sharpening ──
  unsharpMask(heightmap, w, h, state.sharpness);

  // ── Mode processing ──
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

  // ── Invert ──
  if (state.invert) {
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = 1 - heightmap[i];
    }
  }

  // ── Smoothing ──
  if (state.smoothing > 0) {
    const radius = Math.round(state.smoothing * (w / 512));
    if (radius > 0) separableBlur(heightmap, w, h, radius);
  }

  // ── Circular wrap correction ──
  circularWrapCorrection(heightmap, w, h, state.wrapCorrection);

  // ── Seam blending ──
  seamBlend(heightmap, w, h);

  // ── Depth balance ──
  depthBalance(heightmap);

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
 * Generate a small preview canvas from the processed heightmap
 * for the before/after comparison UI.
 */
export async function generateHeightmapPreview(
  state: ImageTerrainState,
): Promise<string | null> {
  if (!state.imageDataUrl) return null;
  const img = await loadImage(state.imageDataUrl);
  const pw = 512;
  const ph = 128;
  const heightmap = imageToHeightmap(img, pw, ph, state);
  const canvas = heightmapToDisplacementCanvas(heightmap, pw, ph);
  return canvas.toDataURL("image/png");
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
