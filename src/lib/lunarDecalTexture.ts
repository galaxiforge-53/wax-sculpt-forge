import * as THREE from "three";

/**
 * Lunar decal texture generator v2.
 * Produces alphaMap, normalMap, and roughnessMap per crater type,
 * derived from a heightmap so lighting creates real relief.
 */

interface CraterMaps {
  alphaMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const cache = new Map<string, CraterMaps>();

// ── Heightmap helpers ─────────────────────────────────────────────

/** Build a 2D float heightmap array [0–1] */
function buildCraterHeightmap(size: number, rimSharpness: number): Float32Array {
  const data = new Float32Array(size * size);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxR; // 0 at center, 1 at edge

      let h: number;
      if (dist > 1) {
        h = 0.5; // outside — neutral
      } else {
        // Bowl: dip from center to ~0.6 radius
        const bowlEnd = 0.55;
        const rimCenter = 0.65 + rimSharpness * 0.08; // 0.65–0.73
        const rimWidth = 0.08 - rimSharpness * 0.03;  // sharper = thinner

        if (dist < bowlEnd) {
          // Smooth bowl depression: 0.15 at center → 0.4 at bowl edge
          const t = dist / bowlEnd;
          h = 0.15 + 0.25 * t * t;
        } else if (dist < rimCenter - rimWidth) {
          // Transition bowl → rim
          const t = (dist - bowlEnd) / (rimCenter - rimWidth - bowlEnd);
          h = 0.4 + 0.45 * t; // 0.4 → 0.85
        } else if (dist < rimCenter + rimWidth) {
          // Rim peak
          const t = (dist - (rimCenter - rimWidth)) / (2 * rimWidth);
          h = 0.85 + 0.15 * Math.sin(t * Math.PI); // peaks at ~1.0
        } else {
          // Outer falloff
          const t = (dist - (rimCenter + rimWidth)) / (1 - (rimCenter + rimWidth));
          h = 0.85 * (1 - t * t); // smooth decay to ~0
        }
      }
      data[y * size + x] = Math.max(0, Math.min(1, h));
    }
  }
  return data;
}

function buildPitHeightmap(size: number): Float32Array {
  const data = new Float32Array(size * size);
  const cx = size / 2;
  const maxR = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cx) ** 2) / maxR;
      if (dist > 1) { data[y * size + x] = 0.5; continue; }
      // Simple depression, slight rim
      const bowl = 0.2 + 0.3 * dist * dist;
      const rim = dist > 0.7 ? 0.6 + 0.25 * Math.sin(((dist - 0.7) / 0.3) * Math.PI) : 0;
      data[y * size + x] = Math.max(0, Math.min(1, dist < 0.7 ? bowl : rim || bowl));
    }
  }
  return data;
}

function buildGrainHeightmap(size: number, microDetail: number): Float32Array {
  const data = new Float32Array(size * size);
  const cx = size / 2;
  const maxR = size / 2;
  // Simple noisy dimple
  let seed = Math.round(microDetail * 137);
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cx) ** 2) / maxR;
      if (dist > 1) { data[y * size + x] = 0.5; continue; }
      const noise = (rng() - 0.5) * 0.15 * (microDetail / 100);
      const base = 0.3 + 0.2 * dist;
      data[y * size + x] = Math.max(0, Math.min(1, base + noise));
    }
  }
  return data;
}

// ── Derive normal map from heightmap (Sobel) ─────────────────────

function heightmapToNormalCanvas(hmap: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const sample = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(size - 1, x));
    const cy = Math.max(0, Math.min(size - 1, y));
    return hmap[cy * size + cx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel-style gradient
      const left = sample(x - 1, y);
      const right = sample(x + 1, y);
      const up = sample(x, y - 1);
      const down = sample(x, y + 1);

      let nx = (left - right) * strength;
      let ny = (up - down) * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Alpha map from heightmap ──────────────────────────────────────

function heightmapToAlphaCanvas(hmap: Float32Array, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const cx = size / 2;
  const maxR = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cx) ** 2) / maxR;
      // Circular mask with soft edge
      const alpha = dist > 1 ? 0 : dist > 0.8 ? (1 - (dist - 0.8) / 0.2) : 1;
      const idx = (y * size + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Roughness map from heightmap ──────────────────────────────────

function heightmapToRoughnessCanvas(hmap: Float32Array, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = hmap[y * size + x];
      // Lower heightmap = rougher (bowl interior), higher = smoother (rim catches light)
      // Bowl (h~0.15–0.4): high roughness ~0.9
      // Rim (h~0.85–1.0): lower roughness ~0.5 (catches specular)
      const roughness = 0.95 - h * 0.5;
      const idx = (y * size + x) * 4;
      const v = Math.round(Math.max(0, Math.min(1, roughness)) * 255);
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Public API ────────────────────────────────────────────────────

export function getCraterMaps(rimSharpness: number): CraterMaps {
  const key = `crater-${Math.round(rimSharpness * 20)}`;
  if (cache.has(key)) return cache.get(key)!;

  const size = 256;
  const hmap = buildCraterHeightmap(size, rimSharpness);

  const alphaCanvas = heightmapToAlphaCanvas(hmap, size);
  const normalCanvas = heightmapToNormalCanvas(hmap, size, 3.0);
  const roughnessCanvas = heightmapToRoughnessCanvas(hmap, size);

  const alphaMap = new THREE.CanvasTexture(alphaCanvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  [alphaMap, normalMap, roughnessMap].forEach(t => { t.needsUpdate = true; });

  const maps: CraterMaps = { alphaMap, normalMap, roughnessMap };
  cache.set(key, maps);
  return maps;
}

export function getPitMaps(): CraterMaps {
  if (cache.has("pit")) return cache.get("pit")!;

  const size = 128;
  const hmap = buildPitHeightmap(size);

  const maps: CraterMaps = {
    alphaMap: new THREE.CanvasTexture(heightmapToAlphaCanvas(hmap, size)),
    normalMap: new THREE.CanvasTexture(heightmapToNormalCanvas(hmap, size, 2.0)),
    roughnessMap: new THREE.CanvasTexture(heightmapToRoughnessCanvas(hmap, size)),
  };
  Object.values(maps).forEach(t => { (t as THREE.CanvasTexture).needsUpdate = true; });
  cache.set("pit", maps);
  return maps;
}

export function getGrainMaps(microDetail: number): CraterMaps {
  const key = `grain-${Math.round(microDetail / 10)}`;
  if (cache.has(key)) return cache.get(key)!;

  const size = 64;
  const hmap = buildGrainHeightmap(size, microDetail);

  const maps: CraterMaps = {
    alphaMap: new THREE.CanvasTexture(heightmapToAlphaCanvas(hmap, size)),
    normalMap: new THREE.CanvasTexture(heightmapToNormalCanvas(hmap, size, 1.5)),
    roughnessMap: new THREE.CanvasTexture(heightmapToRoughnessCanvas(hmap, size)),
  };
  Object.values(maps).forEach(t => { (t as THREE.CanvasTexture).needsUpdate = true; });
  cache.set(key, maps);
  return maps;
}
