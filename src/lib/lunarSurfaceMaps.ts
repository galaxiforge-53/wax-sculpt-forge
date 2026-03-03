import * as THREE from "three";
import { LunarTextureState } from "@/types/lunar";

/**
 * Generates full-ring UV-space maps (normalMap, roughnessMap, aoMap, albedoMap)
 * from a heightmap with seeded crater stamping, domain-warp irregularity,
 * multi-scale fBm base terrain, micro-pitting, and edge polish masking.
 *
 * U = circumference, V = ring width.
 * Returns THREE.CanvasTexture instances ready to assign to material.
 */

export interface LunarSurfaceMapSet {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  albedoMap: THREE.CanvasTexture;
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

// ── Seeded 2D value noise (for domain warp + fBm) ─────────────────

function makeNoise2D(seed: number) {
  // Generate a permutation table seeded
  const rng = seededRng(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const grad: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    const angle = rng() * Math.PI * 2;
    grad.push([Math.cos(angle), Math.sin(angle)]);
  }
  // Fisher-Yates shuffle
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < SIZE; i++) perm[SIZE + i] = perm[i];

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  function dot2(g: number[], x: number, y: number) { return g[0] * x + g[1] * y; }

  return (x: number, y: number): number => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[xi] + yi] & 255;
    const ab = perm[perm[xi] + yi + 1] & 255;
    const ba = perm[perm[xi + 1] + yi] & 255;
    const bb = perm[perm[xi + 1] + yi + 1] & 255;

    return lerp(
      lerp(dot2(grad[aa], xf, yf), dot2(grad[ba], xf - 1, yf), u),
      lerp(dot2(grad[ab], xf, yf - 1), dot2(grad[bb], xf - 1, yf - 1), u),
      v
    );
  };
}

// ── fBm (fractional Brownian motion) ──────────────────────────────

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / maxAmp;
}

// ── Smoothstep ────────────────────────────────────────────────────

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Edge polish mask (V direction) ────────────────────────────────

function buildEdgeMask(w: number, h: number): Float32Array {
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0..1
    const edgeDist = Math.min(v, 1 - v); // distance from nearest edge
    // Smooth transition: 0 at edge, 1 at center band
    const m = smoothstep(0.0, 0.18, edgeDist);
    for (let x = 0; x < w; x++) {
      mask[y * w + x] = m;
    }
  }
  return mask;
}

// ── Crater stamp onto heightmap ───────────────────────────────────

interface CraterStamp {
  cu: number;
  cv: number;
  radius: number;
  depth: number;
  rimHeight: number;
  // Per-crater jitter for irregularity
  rimCenterJitter: number;
  rimWidthJitter: number;
  warpSeed: number;
}

function stampCrater(
  hmap: Float32Array,
  w: number,
  h: number,
  c: CraterStamp,
  rimSharpness: number,
  edgeMask: Float32Array,
  warpNoise: (x: number, y: number) => number,
  warpAmp: number,
) {
  const pxR = c.radius * w;
  const pyR = c.radius * h * (w / h);

  const x0 = Math.floor((c.cu - c.radius * 1.5) * w);
  const x1 = Math.ceil((c.cu + c.radius * 1.5) * w);
  const y0 = Math.max(0, Math.floor((c.cv - c.radius * 1.5 * (w / h)) * h));
  const y1 = Math.min(h - 1, Math.ceil((c.cv + c.radius * 1.5 * (w / h)) * h));

  const bowlEnd = 0.55;
  const rimCenter = (0.65 + rimSharpness * 0.1) + c.rimCenterJitter;
  const rimWidth = Math.max(0.02, (0.1 - rimSharpness * 0.04) + c.rimWidthJitter);

  // Noise scale for domain warp per crater
  const noiseScale = 8 + c.warpSeed * 4;

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let wpx = px % w;
      if (wpx < 0) wpx += w;

      const du = (px - c.cu * w) / pxR;
      const dv = (py - c.cv * h) / pyR;

      // Domain warp: perturb distance field
      const warpU = warpNoise(px * noiseScale / w, py * noiseScale / h);
      const warpV = warpNoise(py * noiseScale / h + 100, px * noiseScale / w + 100);
      const wdu = du + warpAmp * warpU;
      const wdv = dv + warpAmp * warpV;

      const dist = Math.sqrt(wdu * wdu + wdv * wdv);
      if (dist > 1.4) continue;

      let delta = 0;
      if (dist < bowlEnd) {
        const t = dist / bowlEnd;
        delta = -c.depth * (1 - t * t) * 0.5;
      } else if (dist < rimCenter - rimWidth) {
        const t = (dist - bowlEnd) / (rimCenter - rimWidth - bowlEnd);
        delta = -c.depth * 0.5 * (1 - t) + c.rimHeight * t * 0.3;
      } else if (dist < rimCenter + rimWidth) {
        const t = (dist - (rimCenter - rimWidth)) / (2 * rimWidth);
        delta = c.rimHeight * 0.3 * Math.sin(t * Math.PI);
      } else if (dist < 1.4) {
        const t = (dist - (rimCenter + rimWidth)) / (1.4 - (rimCenter + rimWidth));
        delta = c.rimHeight * 0.05 * Math.max(0, 1 - t);
      }

      // Apply edge mask so edges stay polished
      const mask = edgeMask[py * w + wpx];
      delta *= mask;

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
  const depthScale = lunar.intensity / 100;

  // ─── Edge polish mask ───────────────────────────────────
  const edgeMask = buildEdgeMask(MAP_W, MAP_H);

  // ─── 1) fBm base regolith layer (before craters) ───────
  const baseNoise = makeNoise2D(lunar.seed + 500);
  const baseAmp = 0.06 * depthScale;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W * 6;
      const v = y / MAP_H * 6;
      const n = fbm(baseNoise, u, v, 3, 2.0, 0.5);
      const mask = edgeMask[y * MAP_W + x];
      hmap[y * MAP_W + x] += n * baseAmp * mask;
    }
  }

  // ─── 2) Domain warp noise for crater irregularity ───────
  const warpNoise = makeNoise2D(lunar.seed + 1234);
  const warpAmp = 0.15 + rimSharp * 0.12; // more warp = more irregular craters

  // ─── 3) Crater stamps ──────────────────────────────────
  // Dramatically increased counts for dense lunar coverage like reference images
  const baseCount = lunar.craterDensity === "low" ? 60 : lunar.craterDensity === "med" ? 150 : 300;
  const baseSizeMin = lunar.craterSize === "small" ? 0.006 : lunar.craterSize === "med" ? 0.012 : 0.02;
  const baseSizeMax = lunar.craterSize === "small" ? 0.03 : lunar.craterSize === "med" ? 0.065 : 0.11;

  const stamps: CraterStamp[] = [];
  let lastU = rand();
  let lastV = 0.5;

  for (let i = 0; i < baseCount; i++) {
    const t = rand();
    const radius = baseSizeMin + (baseSizeMax - baseSizeMin) * (t * t);

    let cu: number, cv: number;
    if (i > 0 && rand() < overlapFactor * 0.5) {
      cu = lastU + (rand() - 0.5) * radius * 4;
      cv = lastV + (rand() - 0.5) * radius * 4 * (MAP_W / MAP_H);
    } else {
      cu = rand();
      cv = 0.1 + rand() * 0.8;
    }
    cu = ((cu % 1) + 1) % 1;
    cv = Math.max(0.05, Math.min(0.95, cv));

    const depth = (0.5 + rand() * 0.5) * depthScale * 1.4;
    const rimH = (0.4 + rimSharp * 0.8) * depthScale * 1.3;

    // Per-crater rim jitter for irregularity
    const rimCenterJitter = (rand() - 0.5) * 0.06;
    const rimWidthJitter = (rand() - 0.5) * 0.03;
    const warpSeed = rand();

    stamps.push({ cu, cv, radius, depth, rimHeight: rimH, rimCenterJitter, rimWidthJitter, warpSeed });
    lastU = cu;
    lastV = cv;
  }

  for (const s of stamps) {
    stampCrater(hmap, MAP_W, MAP_H, s, rimSharp, edgeMask, warpNoise, warpAmp);
  }

  // ─── 4) Micro-pitting layer (many tiny shallow pits) ───
  if (microFactor > 0) {
    const pitRng = seededRng(lunar.seed + 5555);
    const pitCount = Math.floor(600 + microFactor * 2000);
    const pitRadiusMin = 0.001;
    const pitRadiusMax = 0.008;
    const pitDepth = 0.14 * depthScale * microFactor;

    for (let i = 0; i < pitCount; i++) {
      const pu = pitRng();
      const pv = 0.08 + pitRng() * 0.84;
      const pr = pitRadiusMin + pitRng() * (pitRadiusMax - pitRadiusMin);
      const pd = pitDepth * (0.5 + pitRng() * 0.5);

      const pxR = pr * MAP_W;
      const pyR = pr * MAP_H * (MAP_W / MAP_H);
      const x0 = Math.max(0, Math.floor((pu - pr * 1.2) * MAP_W));
      const x1 = Math.min(MAP_W - 1, Math.ceil((pu + pr * 1.2) * MAP_W));
      const y0 = Math.max(0, Math.floor((pv - pr * 1.2 * (MAP_W / MAP_H)) * MAP_H));
      const y1 = Math.min(MAP_H - 1, Math.ceil((pv + pr * 1.2 * (MAP_W / MAP_H)) * MAP_H));

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const du = (px - pu * MAP_W) / pxR;
          const dv = (py - pv * MAP_H) / pyR;
          const d = Math.sqrt(du * du + dv * dv);
          if (d > 1.0) continue;
          const falloff = 1 - d * d;
          const mask = edgeMask[py * MAP_W + px];
          hmap[py * MAP_W + px] -= pd * falloff * mask;
        }
      }
    }
  }

  // ─── 5) High-frequency grain noise (break gradients) ───
  if (microFactor > 0) {
    const grainRng = seededRng(lunar.seed + 9999);
    const strength = microFactor * 0.1 * depthScale;
    for (let i = 0; i < hmap.length; i++) {
      const mask = edgeMask[i];
      hmap[i] += (grainRng() - 0.5) * strength * mask;
    }
  }

  // ─── 6) Depth contrast boost ───────────────────────────
  for (let i = 0; i < hmap.length; i++) {
    hmap[i] = 0.5 + (hmap[i] - 0.5) * 1.4;
    hmap[i] = Math.max(0, Math.min(1, hmap[i]));
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
      let roughness = 0.98 - (hVal - 0.5) * 1.6;
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

// ── AO map from heightmap (darker in bowls, between pits) ─────────

function heightmapToAOCanvas(hmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  // Simple screen-space-like AO: compare each pixel to local neighborhood average
  const kernelR = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const center = hmap[y * w + x];
      let higher = 0;
      let samples = 0;

      for (let ky = -kernelR; ky <= kernelR; ky += 2) {
        for (let kx = -kernelR; kx <= kernelR; kx += 2) {
          const sy = Math.max(0, Math.min(h - 1, y + ky));
          const sx = ((x + kx) % w + w) % w;
          const neighbor = hmap[sy * w + sx];
          if (neighbor > center) higher++;
          samples++;
        }
      }

      // More neighbors above = more occluded (darker)
      const occlusion = higher / samples;
      // AO value: 1 = fully lit, 0 = fully occluded
      const ao = 1.0 - occlusion * 0.6;
      const v = Math.round(Math.max(0.3, Math.min(1.0, ao)) * 255);

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

// ── Albedo map (subtle stoney variation) ──────────────────────────

function heightmapToAlbedoCanvas(hmap: Float32Array, w: number, h: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  const stoneNoise = makeNoise2D(seed + 7000);
  const grainRng = seededRng(seed + 8000);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w * 4;
      const v = y / h * 4;
      // Low-frequency stone color variation
      const n = fbm(stoneNoise, u, v, 2, 2.0, 0.5) * 0.5 + 0.5;
      // Micro grain
      const grain = (grainRng() - 0.5) * 0.04;
      // Height-based darkening (bowls slightly darker)
      const hVal = hmap[y * w + x];
      const heightTint = 0.95 + (hVal - 0.5) * 0.1;

      // Map to narrow grayscale band (0.75..0.95) for subtle variation
      let albedo = 0.82 + n * 0.12 + grain;
      albedo *= heightTint;
      albedo = Math.max(0.6, Math.min(1.0, albedo));

      const val = Math.round(albedo * 255);
      const yy = (h - 1 - y);
      const idx = (yy * w + x) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Texture setup helper ──────────────────────────────────────────

function setupDataTexture(tex: THREE.CanvasTexture) {
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
}

// ── Public API ────────────────────────────────────────────────────

export function generateLunarSurfaceMaps(lunar: LunarTextureState): LunarSurfaceMapSet {
  const key = cacheKey(lunar);
  if (cache.has(key)) return cache.get(key)!;

  const hmap = buildHeightmap(lunar);

  const normalCanvas = heightmapToNormalCanvas(hmap, MAP_W, MAP_H, 3.0);
  const roughnessCanvas = heightmapToRoughnessCanvas(hmap, MAP_W, MAP_H, lunar.microDetail);
  const aoCanvas = heightmapToAOCanvas(hmap, MAP_W, MAP_H);
  const albedoCanvas = heightmapToAlbedoCanvas(hmap, MAP_W, MAP_H, lunar.seed);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  const aoMap = new THREE.CanvasTexture(aoCanvas);
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);

  setupDataTexture(normalMap);
  setupDataTexture(roughnessMap);
  setupDataTexture(aoMap);
  setupDataTexture(albedoMap);
  // Albedo needs sRGB for correct color
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const maps: LunarSurfaceMapSet = { normalMap, roughnessMap, aoMap, albedoMap };
  cache.set(key, maps);
  return maps;
}

/** Dispose old textures when no longer needed */
export function disposeLunarMaps(maps: LunarSurfaceMapSet) {
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.aoMap.dispose();
  maps.albedoMap.dispose();
}
