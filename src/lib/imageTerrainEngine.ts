/**
 * Image-to-Terrain Engine
 * Converts an uploaded image into displacement, normal, roughness, and AO maps
 * suitable for wrapping around a ring's outer surface.
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
  // Use a hash of the dataUrl length + params to avoid massive keys
  const imgHash = imageDataUrl ? imageDataUrl.length.toString(36) + imageDataUrl.slice(-32) : "none";
  return imgHash + JSON.stringify(rest);
}

export function disposeImageTerrainMaps(maps: ImageTerrainMapSet) {
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.aoMap.dispose();
  maps.displacementMap.dispose();
}

/**
 * Load image from data URL into an HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Convert image to grayscale heightmap Float32Array
 */
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

  // Compute tiled source dimensions
  const tileU = Math.max(1, Math.round(state.tileU));
  const tileV = Math.max(1, Math.round(state.tileV));
  const scale = state.scale / 100;
  
  // Clear to mid-gray (neutral height)
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);

  // Draw the image tiled, scaled, and offset
  const imgW = w / tileU / scale;
  const imgH = h / tileV / scale;
  const offU = (state.offsetU / 100) * w;
  const offV = (state.offsetV / 100) * h;

  for (let tu = -1; tu <= tileU + 1; tu++) {
    for (let tv = -1; tv <= tileV + 1; tv++) {
      const dx = tu * (w / tileU) + offU;
      const dy = tv * (h / tileV) + offV;
      // Center the image within each tile
      const cx = dx + (w / tileU - imgW) / 2;
      const cy = dy + (h / tileV - imgH) / 2;
      ctx.drawImage(img, cx, cy, imgW, imgH);
    }
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const heightmap = new Float32Array(w * h);

  // Convert to luminance
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3] / 255;
    // Standard luminance with alpha premultiply
    let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lum = lum * a + 0.5 * (1 - a); // Alpha blends toward neutral
    heightmap[i] = lum;
  }

  // Apply contrast
  if (state.contrast !== 100) {
    const factor = state.contrast / 100;
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = 0.5 + (heightmap[i] - 0.5) * factor;
    }
  }

  // Apply threshold for engraved/raised modes
  if (state.mode === "engraved" || state.mode === "raised") {
    const thresh = state.threshold / 100;
    for (let i = 0; i < heightmap.length; i++) {
      // Soft threshold with a sigmoid-like curve
      const d = (heightmap[i] - thresh) * 8;
      heightmap[i] = 1 / (1 + Math.exp(-d));
    }
    if (state.mode === "engraved") {
      // Invert: bright areas become cuts
      for (let i = 0; i < heightmap.length; i++) {
        heightmap[i] = 1 - heightmap[i];
      }
    }
  }

  // Invert if requested
  if (state.invert) {
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = 1 - heightmap[i];
    }
  }

  // Gaussian smoothing (separable)
  if (state.smoothing > 0) {
    const radius = Math.round(state.smoothing * (w / 512));
    if (radius > 0) {
      separableBlur(heightmap, w, h, radius);
    }
  }

  // Ensure seamless U-wrapping by blending edges
  const blendZone = Math.max(4, Math.round(w * 0.02));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < blendZone; x++) {
      const t = x / blendZone;
      const idx = y * w + x;
      const mirrorIdx = y * w + (w - blendZone + x);
      const blend = heightmap[idx] * t + heightmap[mirrorIdx] * (1 - t);
      heightmap[idx] = blend;
      heightmap[mirrorIdx] = heightmap[mirrorIdx] * t + heightmap[idx] * (1 - t);
    }
  }

  return heightmap;
}

function separableBlur(data: Float32Array, w: number, h: number, radius: number) {
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
    // Lower areas = rougher, raised areas = smoother
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

  // Simple AO: lower areas darker
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
 * Generate all texture maps from an image terrain state.
 * Returns null if no image is set or not enabled.
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

  onProgress?.(30, "Building heightmap…");
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

  // Limit cache to 4 entries
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
