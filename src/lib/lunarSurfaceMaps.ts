import * as THREE from "three";
import { LunarTextureState } from "@/types/lunar";

/**
 * Generates full-ring UV-space maps (normalMap + roughnessMap) from a heightmap
 * with seeded crater stamping. U = circumference, V = ring width.
 *
 * Returns THREE.CanvasTexture instances ready to assign to material.
 */

export interface LunarSurfaceMapSet {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const MAP_W = 1024;
const MAP_H = 256;

const cache = new Map<string, LunarSurfaceMapSet>();

function cacheKey(lunar: LunarTextureState): string {
  return `${lunar.seed}-${lunar.craterDensity}-${lunar.craterSize}-${lunar.intensity}-${lunar.microDetail}-${lunar.rimSharpness}-${lunar.overlapIntensity}-${lunar.smoothEdges ? 1 : 0}`;
}

// ── Seeded RNG ────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ── Crater stamp onto heightmap ───────────────────────────────────

interface CraterStamp {
  cu: number; // center U (0–1)
  cv: number; // center V (0–1)
  radius: number; // in UV units
  depth: number; // 0–1 strength
  rimHeight: number; // 0–1
}

function stampCrater(
  hmap: Float32Array,
  w: number,
  h: number,
  c: CraterStamp,
  rimSharpness: number,
) {
  const pxR = c.radius * w; // radius in pixels (U direction)
  const pyR = c.radius * h * (w / h); // compensate aspect ratio for V

  const x0 = Math.floor((c.cu - c.radius * 1.3) * w);
  const x1 = Math.ceil((c.cu + c.radius * 1.3) * w);
  const y0 = Math.max(0, Math.floor((c.cv - c.radius * 1.3 * (w / h)) * h));
  const y1 = Math.min(h - 1, Math.ceil((c.cv + c.radius * 1.3 * (w / h)) * h));

  const bowlEnd = 0.55;
  const rimCenter = 0.65 + rimSharpness * 0.1;
  const rimWidth = 0.1 - rimSharpness * 0.04;

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      // Wrap U
      let wpx = px % w;
      if (wpx < 0) wpx += w;

      const du = (px - c.cu * w) / pxR;
      const dv = (py - c.cv * h) / pyR;
      const dist = Math.sqrt(du * du + dv * dv);
      if (dist > 1.3) continue;

      let delta = 0;
      if (dist < bowlEnd) {
        // Bowl depression
        const t = dist / bowlEnd;
        delta = -c.depth * (1 - t * t) * 0.5;
      } else if (dist < rimCenter - rimWidth) {
        // Transition to rim
        const t = (dist - bowlEnd) / (rimCenter - rimWidth - bowlEnd);
        delta = -c.depth * 0.5 * (1 - t) + c.rimHeight * t * 0.3;
      } else if (dist < rimCenter + rimWidth) {
        // Rim peak
        const t = (dist - (rimCenter - rimWidth)) / (2 * rimWidth);
        delta = c.rimHeight * 0.3 * Math.sin(t * Math.PI);
      } else if (dist < 1.3) {
        // Outer falloff
        const t = (dist - (rimCenter + rimWidth)) / (1.3 - (rimCenter + rimWidth));
        delta = c.rimHeight * 0.05 * (1 - t);
      }

      const idx = py * w + wpx;
      hmap[idx] = Math.max(0, Math.min(1, hmap[idx] + delta));
    }
  }
}

// ── Build heightmap ───────────────────────────────────────────────

function buildHeightmap(lunar: LunarTextureState): Float32Array {
  const hmap = new Float32Array(MAP_W * MAP_H).fill(0.5);
  const rand = seededRng(lunar.seed);
  const rimSharp = lunar.rimSharpness / 100;
  const overlapFactor = lunar.overlapIntensity / 100;
  const microFactor = lunar.microDetail / 100;
  const edgeFade = lunar.smoothEdges;

  // Determine crater count + size range
  const baseCount = lunar.craterDensity === "low" ? 30 : lunar.craterDensity === "med" ? 70 : 140;
  const baseSizeMin = lunar.craterSize === "small" ? 0.008 : lunar.craterSize === "med" ? 0.015 : 0.025;
  const baseSizeMax = lunar.craterSize === "small" ? 0.025 : lunar.craterSize === "med" ? 0.05 : 0.09;
  const depthScale = lunar.intensity / 100;

  // Power-law: many small, few large
  const stamps: CraterStamp[] = [];
  let lastU = rand();
  let lastV = 0.5;

  for (let i = 0; i < baseCount; i++) {
    // Power-law radius: bias toward small
    const t = rand();
    const radius = baseSizeMin + (baseSizeMax - baseSizeMin) * (t * t);

    // Position: optionally cluster near previous
    let cu: number, cv: number;
    if (i > 0 && rand() < overlapFactor * 0.5) {
      cu = lastU + (rand() - 0.5) * radius * 4;
      cv = lastV + (rand() - 0.5) * radius * 4 * (MAP_W / MAP_H);
    } else {
      cu = rand();
      cv = 0.1 + rand() * 0.8; // stay away from edges
    }
    // Wrap U
    cu = ((cu % 1) + 1) % 1;
    cv = Math.max(0.05, Math.min(0.95, cv));

    const depth = (0.3 + rand() * 0.7) * depthScale;
    const rimH = (0.3 + rimSharp * 0.7) * depthScale;

    // Edge fade: reduce depth near V edges
    let edgeMult = 1;
    if (edgeFade) {
      const edgeDist = Math.min(cv, 1 - cv);
      if (edgeDist < 0.15) edgeMult = edgeDist / 0.15;
    }

    stamps.push({ cu, cv, radius, depth: depth * edgeMult, rimHeight: rimH * edgeMult });
    lastU = cu;
    lastV = cv;
  }

  // Stamp all craters
  for (const s of stamps) {
    stampCrater(hmap, MAP_W, MAP_H, s, rimSharp);
  }

  // Micro grain noise
  if (microFactor > 0) {
    const grainRng = seededRng(lunar.seed + 9999);
    const strength = microFactor * 0.08 * depthScale;
    for (let i = 0; i < hmap.length; i++) {
      hmap[i] += (grainRng() - 0.5) * strength;
      hmap[i] = Math.max(0, Math.min(1, hmap[i]));
    }
  }

  return hmap;
}

// ── Normal map from heightmap (Sobel) ─────────────────────────────

function heightmapToNormalCanvas(hmap: Float32Array, w: number, h: number, strength: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Wrap U for seamless normals
      const xl = ((x - 1) + w) % w;
      const xr = (x + 1) % w;
      const yu = Math.max(0, y - 1);
      const yd = Math.min(h - 1, y + 1);

      const left = hmap[y * w + xl];
      const right = hmap[y * w + xr];
      const up = hmap[yu * w + x];
      const down = hmap[yd * w + x];

      let nx = (left - right) * strength;
      let ny = (up - down) * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const yy = (h - 1 - y);
      const idx = (yy * w + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Roughness map from heightmap ──────────────────────────────────

function heightmapToRoughnessCanvas(hmap: Float32Array, w: number, h: number, microDetail: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  const microFactor = microDetail / 100;
  const grainRng = seededRng(7777 + Math.round(microDetail));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hVal = hmap[y * w + x];
      // Bowl (low h) = rough, rim (high h) = smoother (catches specular)
      let roughness = 0.9 - (hVal - 0.5) * 0.6; // neutral 0.5 → 0.9, rim ~0.6, bowl ~1.0
      // Add micro grain speckle
      if (microFactor > 0) {
        roughness += (grainRng() - 0.5) * 0.12 * microFactor;
      }
      roughness = Math.max(0.2, Math.min(1.0, roughness));

      const v = Math.round(roughness * 255);
      const yy = (h - 1 - y);
      const idx = (yy * w + x) * 4;
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

export function generateLunarSurfaceMaps(lunar: LunarTextureState): LunarSurfaceMapSet {
  const key = cacheKey(lunar);
  if (cache.has(key)) return cache.get(key)!;

  const hmap = buildHeightmap(lunar);

  // Normal strength baked at generation: 3.0 base (will also be scaled by material.normalScale)
  const normalCanvas = heightmapToNormalCanvas(hmap, MAP_W, MAP_H, 3.0);
  const roughnessCanvas = heightmapToRoughnessCanvas(hmap, MAP_W, MAP_H, lunar.microDetail);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.flipY = false;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;
  normalMap.minFilter = THREE.LinearMipMapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.flipY = false;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.minFilter = THREE.LinearMipMapLinearFilter;
  roughnessMap.magFilter = THREE.LinearFilter;
  roughnessMap.needsUpdate = true;

  const maps: LunarSurfaceMapSet = { normalMap, roughnessMap };
  cache.set(key, maps);
  return maps;
}

/** Dispose old textures when no longer needed */
export function disposeLunarMaps(maps: LunarSurfaceMapSet) {
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
}
