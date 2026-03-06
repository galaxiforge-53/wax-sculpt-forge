import * as THREE from "three";
import { LunarTextureState } from "@/types/lunar";

/**
 * Generates full-ring UV-space maps (normalMap, roughnessMap, aoMap, albedoMap, displacementMap)
 * from a heightmap with 5-tier crater distribution, central peaks, terraced walls,
 * ejecta rays, secondary impacts, erosion simulation, and terrain roughness.
 *
 * U = circumference, V = ring width.
 */

export interface LunarSurfaceMapSet {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  albedoMap: THREE.CanvasTexture;
  displacementMap: THREE.CanvasTexture;
  craterCount: number;
}

const MAP_W = 2048;
const MAP_H = 512;

const cache = new Map<string, LunarSurfaceMapSet>();

function cacheKey(lunar: LunarTextureState): string {
  return `${lunar.seed}-${lunar.craterDensity}-${lunar.craterSize}-${lunar.intensity}-${lunar.microDetail}-${lunar.rimSharpness}-${lunar.overlapIntensity}-${lunar.smoothEdges ? 1 : 0}-${lunar.rimHeight}-${lunar.bowlDepth}-${lunar.erosion}-${lunar.terrainRoughness}-${lunar.craterVariation}`;
}

// ── Seeded RNG ────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ── Seeded 2D value noise ─────────────────────────────────────────

function makeNoise2D(seed: number) {
  const rng = seededRng(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const grad: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    const angle = rng() * Math.PI * 2;
    grad.push([Math.cos(angle), Math.sin(angle)]);
  }
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

// ── fBm ───────────────────────────────────────────────────────────

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
  let sum = 0, amp = 1, freq = 1, maxAmp = 0;
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

function lerp(a: number, b: number, t: number) { return a + t * (b - a); }

// ── Edge polish mask ──────────────────────────────────────────────

function buildEdgeMask(w: number, h: number): Float32Array {
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const edgeDist = Math.min(v, 1 - v);
    const m = smoothstep(0.0, 0.18, edgeDist);
    for (let x = 0; x < w; x++) {
      mask[y * w + x] = m;
    }
  }
  return mask;
}

// ── Crater stamp ──────────────────────────────────────────────────

interface CraterStamp {
  cu: number;
  cv: number;
  radius: number;
  depth: number;
  rimHeight: number;
  rimCenterJitter: number;
  rimWidthJitter: number;
  warpSeed: number;
  tier: number; // 0=mega, 1=hero, 2=medium, 3=small, 4=micro
  age: number;  // 0=oldest(mega), 1=newest(micro) — for erosion weighting
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
  hasCentralPeak: boolean,
  hasTerraces: boolean,
  physicalAspect: number = 1,
) {
  // Physical aspect correction: stretch V so craters are circular on the ring surface
  const vStretch = physicalAspect;

  const pxR = c.radius * w;
  const pyR = c.radius * h * vStretch;

  const spreadU = c.radius * 1.6;
  const spreadV = c.radius * 1.6 * vStretch;
  const x0 = Math.floor((c.cu - spreadU) * w);
  const x1 = Math.ceil((c.cu + spreadU) * w);
  const y0 = Math.max(0, Math.floor((c.cv - spreadV) * h));
  const y1 = Math.min(h - 1, Math.ceil((c.cv + spreadV) * h));

  // Realistic crater profile zones
  const bowlFloor = 0.42;           // flat floor ends here
  const bowlWall = 0.55;            // steep inner wall transition
  const rimInner = 0.60 + rimSharpness * 0.05 + c.rimCenterJitter;
  const rimPeak = 0.68 + rimSharpness * 0.06 + c.rimCenterJitter;
  const rimOuter = 0.82;            // outer slope
  const ejectaEnd = 1.35;           // faint ejecta blanket

  const noiseScale = 6 + c.warpSeed * 3;

  // Central peak parameters (for mega/hero craters)
  const peakRadius = 0.20;
  const peakHeight = c.depth * 0.30;

  // Terrace parameters
  const terraceCount = hasTerraces ? 3 : 0;

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let wpx = px % w;
      if (wpx < 0) wpx += w;

      const du = (px - c.cu * w) / pxR;
      const dv = (py - c.cv * h) / pyR;

      // Domain warp for organic shapes
      const wU = warpNoise(px * noiseScale / w, py * noiseScale / h);
      const wV = warpNoise(py * noiseScale / h + 100, px * noiseScale / w + 100);
      const wdu = du + warpAmp * 0.25 * wU;
      const wdv = dv + warpAmp * 0.25 * wV;

      const dist = Math.sqrt(wdu * wdu + wdv * wdv);
      if (dist > ejectaEnd) continue;

      let delta = 0;

      if (dist < bowlFloor) {
        // Flat bowl floor with gentle parabolic center
        const t = dist / bowlFloor;
        delta = -c.depth * (1 - 0.15 * t * t);

        // Central peak — smooth bell mound
        if (hasCentralPeak && dist < peakRadius) {
          const pt = dist / peakRadius;
          const bell = Math.exp(-pt * pt * 4.0);
          delta += peakHeight * bell;
        }
      } else if (dist < bowlWall) {
        // Steep inner wall — cubic interpolation from floor to wall
        const t = (dist - bowlFloor) / (bowlWall - bowlFloor);
        const s = t * t * (3 - 2 * t); // smoothstep
        delta = -c.depth * (1 - s * 0.85);

        // Terraced inner walls
        if (terraceCount > 0) {
          const terraceT = t;
          const step = Math.floor(terraceT * terraceCount);
          const frac = terraceT * terraceCount - step;
          const stepSmooth = smoothstep(0.0, 0.35, frac);
          delta += c.depth * 0.06 * stepSmooth;
        }
      } else if (dist < rimInner) {
        // Transition from wall to rim — steep inner face
        const t = (dist - bowlWall) / (rimInner - bowlWall);
        const s = t * t * (3 - 2 * t);
        delta = lerp(-c.depth * 0.15, c.rimHeight * 0.3, s);
      } else if (dist < rimPeak) {
        // Rim crest — sharp peak
        const t = (dist - rimInner) / (rimPeak - rimInner);
        const s = Math.sin(t * Math.PI * 0.5);
        delta = lerp(c.rimHeight * 0.3, c.rimHeight * 0.5, s);
      } else if (dist < rimOuter) {
        // Outer rim slope — gentler decline (asymmetric)
        const t = (dist - rimPeak) / (rimOuter - rimPeak);
        const s = t * t; // quadratic falloff
        delta = c.rimHeight * 0.5 * (1 - s);
      } else if (dist < ejectaEnd) {
        // Ejecta blanket — very faint raised material
        const t = (dist - rimOuter) / (ejectaEnd - rimOuter);
        delta = c.rimHeight * 0.06 * Math.max(0, (1 - t) * (1 - t));
      }

      const mask = edgeMask[py * w + wpx];
      delta *= mask;

      const idx = py * w + wpx;
      hmap[idx] = Math.max(0, Math.min(1, hmap[idx] + delta));
    }
  }
}

// ── Ejecta rays ───────────────────────────────────────────────────

function stampEjectaRays(
  hmap: Float32Array,
  w: number,
  h: number,
  c: CraterStamp,
  rand: () => number,
  edgeMask: Float32Array,
  secondaryStamps: CraterStamp[],
  physicalAspect: number = 1,
) {
  const rayCount = 4 + Math.floor(rand() * 5);
  const rayLength = c.radius * (2.5 + rand() * 2.0);
  const rayBrightness = c.rimHeight * 0.12;

  for (let r = 0; r < rayCount; r++) {
    const angle = rand() * Math.PI * 2;
    const rayWidth = c.radius * (0.06 + rand() * 0.08);

    // Walk along ray
    const steps = Math.floor(rayLength * w * 0.5);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const dist = c.radius * 0.8 + t * rayLength;
      const ru = c.cu + Math.cos(angle) * dist;
      // Use physicalAspect so rays extend equally in physical space
      const rv = c.cv + Math.sin(angle) * dist * physicalAspect;

      if (rv < 0.05 || rv > 0.95) continue;

      // Brighten pixels in a thin strip
      const px = Math.floor(((ru % 1 + 1) % 1) * w);
      const py = Math.floor(rv * h);
      if (py < 0 || py >= h) continue;

      const fadeoff = (1 - t) * (1 - t);
      const jitter = rayWidth * w;
      for (let j = -Math.ceil(jitter); j <= Math.ceil(jitter); j++) {
        const wpx = ((px + j) % w + w) % w;
        const idx = py * w + wpx;
        const mask = edgeMask[idx];
        hmap[idx] = Math.min(1, hmap[idx] + rayBrightness * fadeoff * mask);
      }

      // Occasional secondary crater along ray
      if (rand() < 0.03) {
        secondaryStamps.push({
          cu: ((ru % 1) + 1) % 1,
          cv: Math.max(0.08, Math.min(0.92, rv)),
          radius: c.radius * (0.05 + rand() * 0.1),
          depth: c.depth * 0.3 * (0.5 + rand() * 0.5),
          rimHeight: c.rimHeight * 0.25,
          rimCenterJitter: (rand() - 0.5) * 0.02,
          rimWidthJitter: (rand() - 0.5) * 0.01,
          warpSeed: rand(),
          tier: 4,
          age: 0.9,
        });
      }
    }
  }
}

// ── Erosion pass ──────────────────────────────────────────────────

function applyErosion(hmap: Float32Array, w: number, h: number, erosionFactor: number) {
  if (erosionFactor <= 0) return;

  const blurred = new Float32Array(hmap.length);
  const kernelR = Math.max(1, Math.round(2 + erosionFactor * 4));

  // Box blur approximation
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let ky = -kernelR; ky <= kernelR; ky++) {
        const sy = Math.max(0, Math.min(h - 1, y + ky));
        for (let kx = -kernelR; kx <= kernelR; kx++) {
          const sx = ((x + kx) % w + w) % w;
          sum += hmap[sy * w + sx];
          count++;
        }
      }
      blurred[y * w + x] = sum / count;
    }
  }

  // Blend original with blurred
  const blend = erosionFactor * 0.6;
  for (let i = 0; i < hmap.length; i++) {
    hmap[i] = lerp(hmap[i], blurred[i], blend);
  }
}

// ── Build heightmap ───────────────────────────────────────────────

interface HeightmapResult {
  hmap: Float32Array;
  craterCount: number;
}

function buildHeightmap(lunar: LunarTextureState, physicalAspect: number = 1): HeightmapResult {
  const hmap = new Float32Array(MAP_W * MAP_H).fill(0.5);
  const rand = seededRng(lunar.seed);
  const rimSharp = lunar.rimSharpness / 100;
  const overlapFactor = lunar.overlapIntensity / 100;
  const microFactor = lunar.microDetail / 100;
  const depthScale = lunar.intensity / 100;
  const rimHeightScale = (lunar.rimHeight ?? 55) / 100;
  const bowlDepthScale = (lunar.bowlDepth ?? 60) / 100;
  const erosionFactor = (lunar.erosion ?? 25) / 100;
  const terrainRough = (lunar.terrainRoughness ?? 35) / 100;
  const craterVar = (lunar.craterVariation ?? 50) / 100;

  const edgeMask = buildEdgeMask(MAP_W, MAP_H);

  // ─── 1) fBm base terrain layer ─────────────────────────
  const baseNoise = makeNoise2D(lunar.seed + 500);
  const baseAmp = (0.04 + terrainRough * 0.12) * depthScale;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W * 6;
      const v = y / MAP_H * 6;
      const n = fbm(baseNoise, u, v, 4, 2.0, 0.5);
      const mask = edgeMask[y * MAP_W + x];
      hmap[y * MAP_W + x] += n * baseAmp * mask;
    }
  }

  // ─── 2) Domain warp noise ──────────────────────────────
  const warpNoise = makeNoise2D(lunar.seed + 1234);
  const warpAmp = 0.15 + rimSharp * 0.12;

  // ─── 3) 5-tier crater distribution ─────────────────────
  const densityMul = lunar.craterDensity === "low" ? 0.5 : lunar.craterDensity === "med" ? 1.0 : 1.8;
  const sizeMul = lunar.craterSize === "small" ? 0.6 : lunar.craterSize === "med" ? 1.0 : 1.5;

  // Tier 0: MEGA craters (1-3, massive basin impacts)
  const megaCount = Math.round(1 + densityMul * 1.5);
  const megaRadMin = 0.12 * sizeMul, megaRadMax = 0.22 * sizeMul;

  // Tier 1: HERO craters (3-8)
  const heroCount = Math.round(3 + densityMul * 5);
  const heroRadMin = 0.06 * sizeMul, heroRadMax = 0.12 * sizeMul;

  // Tier 2: MEDIUM craters (15-50)
  const medCount = Math.round(15 + densityMul * 35 * sizeMul);
  const medRadMin = 0.025 * sizeMul, medRadMax = 0.06 * sizeMul;

  // Tier 3: SMALL craters (40-200)
  const smallCount = Math.round(40 + densityMul * 160);
  const smallRadMin = 0.008, smallRadMax = 0.025 * sizeMul;

  // Tier 4: MICRO-PITS (hundreds, handled separately)
  const microPitCount = Math.round(200 + densityMul * 600);

  const stamps: CraterStamp[] = [];

  function addCraters(count: number, rMin: number, rMax: number, depthMul: number, tier: number) {
    for (let i = 0; i < count; i++) {
      const t = rand();
      const radius = rMin + (rMax - rMin) * t;
      const cu = rand();
      const cv = 0.12 + rand() * 0.76;

      // Apply crater variation — randomize depth and rim per-crater
      const varScale = 1.0 + (rand() - 0.5) * craterVar * 0.8;
      const depth = (0.5 + rand() * 0.5) * depthScale * depthMul * bowlDepthScale * varScale;
      const rimH = (0.35 + rimSharp * 0.65) * depthScale * depthMul * rimHeightScale * varScale;

      const rimCenterJitter = (rand() - 0.5) * 0.04;
      const rimWidthJitter = (rand() - 0.5) * 0.02;
      const warpSeed = rand();
      const age = tier / 4; // mega=0 (oldest), micro=1 (newest)

      stamps.push({ cu, cv, radius, depth, rimHeight: rimH, rimCenterJitter, rimWidthJitter, warpSeed, tier, age });
    }
  }

  // Stamp largest first (oldest impacts)
  addCraters(megaCount, megaRadMin, megaRadMax, 1.2, 0);
  addCraters(heroCount, heroRadMin, heroRadMax, 1.0, 1);
  addCraters(medCount, medRadMin, medRadMax, 0.8, 2);
  addCraters(smallCount, smallRadMin, smallRadMax, 0.6, 3);

  // Overlap pass
  if (overlapFactor > 0) {
    const overlapCount = Math.round(stamps.length * overlapFactor * 0.4);
    for (let i = 0; i < overlapCount; i++) {
      const parent = stamps[Math.floor(rand() * stamps.length)];
      const radius = parent.radius * (0.3 + rand() * 0.5);
      const angle = rand() * Math.PI * 2;
      const dist = parent.radius * (0.6 + rand() * 0.8);
      const cu = ((parent.cu + Math.cos(angle) * dist) % 1 + 1) % 1;
      const cv = Math.max(0.08, Math.min(0.92, parent.cv + Math.sin(angle) * dist));

      const varScale = 1.0 + (rand() - 0.5) * craterVar * 0.6;
      const depth = (0.4 + rand() * 0.4) * depthScale * 0.7 * bowlDepthScale * varScale;
      const rimH = (0.3 + rimSharp * 0.5) * depthScale * 0.7 * rimHeightScale * varScale;

      stamps.push({
        cu, cv, radius, depth, rimHeight: rimH,
        rimCenterJitter: (rand() - 0.5) * 0.03,
        rimWidthJitter: (rand() - 0.5) * 0.02,
        warpSeed: rand(), tier: 3, age: 0.7,
      });
    }
  }

  // Stamp all craters
  const secondaryStamps: CraterStamp[] = [];
  for (const s of stamps) {
    const hasPeak = s.tier <= 1; // mega + hero get central peaks
    const hasTerraces = s.tier === 0; // only mega gets terraces
    stampCrater(hmap, MAP_W, MAP_H, s, rimSharp, edgeMask, warpNoise, warpAmp, hasPeak, hasTerraces, physicalAspect);

    // Ejecta rays for mega + hero
    if (s.tier <= 1) {
      stampEjectaRays(hmap, MAP_W, MAP_H, s, rand, edgeMask, secondaryStamps, physicalAspect);
    }
  }

  // Stamp secondary impact chains from ejecta
  for (const sec of secondaryStamps) {
    stampCrater(hmap, MAP_W, MAP_H, sec, rimSharp, edgeMask, warpNoise, warpAmp, false, false, physicalAspect);
  }

  const totalCraterCount = stamps.length + secondaryStamps.length + microPitCount;

  // ─── 4) Erosion pass — blur older craters ──────────────
  applyErosion(hmap, MAP_W, MAP_H, erosionFactor);

  // ─── 5) Micro-pitting layer ────────────────────────────
  if (microFactor > 0) {
    const pitRng = seededRng(lunar.seed + 5555);
    const pitCount = Math.floor(microPitCount * microFactor);
    const pitRadiusMin = 0.001;
    const pitRadiusMax = 0.008;
    const pitDepth = 0.1 * depthScale * microFactor;

    for (let i = 0; i < pitCount; i++) {
      const pu = pitRng();
      const pv = 0.08 + pitRng() * 0.84;
      const pr = pitRadiusMin + pitRng() * (pitRadiusMax - pitRadiusMin);
      const pd = pitDepth * (0.5 + pitRng() * 0.5);

      const pxR = pr * MAP_W;
      const pyR = pr * MAP_H * physicalAspect;
      const x0 = Math.max(0, Math.floor((pu - pr * 1.2) * MAP_W));
      const x1 = Math.min(MAP_W - 1, Math.ceil((pu + pr * 1.2) * MAP_W));
      const y0 = Math.max(0, Math.floor((pv - pr * 1.2 * physicalAspect) * MAP_H));
      const y1 = Math.min(MAP_H - 1, Math.ceil((pv + pr * 1.2 * physicalAspect) * MAP_H));

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

  // ─── 6) Regolith micro-texture (coherent noise + grain) ─────
  if (microFactor > 0) {
    // Coherent regolith noise — gives a powdery surface feel
    const regolithNoise = makeNoise2D(lunar.seed + 3333);
    const regolithStrength = microFactor * 0.05 * depthScale;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const u = x / MAP_W * 24;  // high frequency
        const v = y / MAP_H * 24;
        const n = fbm(regolithNoise, u, v, 3, 2.2, 0.45);
        const mask = edgeMask[y * MAP_W + x];
        hmap[y * MAP_W + x] += n * regolithStrength * mask;
      }
    }

    // Fine grain noise on top
    const grainRng = seededRng(lunar.seed + 9999);
    const grainStrength = microFactor * 0.04 * depthScale;
    for (let i = 0; i < hmap.length; i++) {
      const mask = edgeMask[i];
      hmap[i] += (grainRng() - 0.5) * grainStrength * mask;
    }
  }

  // ─── 7) Depth contrast boost ───────────────────────────
  for (let i = 0; i < hmap.length; i++) {
    hmap[i] = 0.5 + (hmap[i] - 0.5) * 1.2;
    hmap[i] = Math.max(0, Math.min(1, hmap[i]));
  }

  return { hmap, craterCount: totalCraterCount };
}

// ── Normal map from heightmap (Sobel) ─────────────────────────────

function heightmapToNormalCanvas(hmap: Float32Array, w: number, h: number, strength: number, physicalAspect: number = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  // Correct Y gradient for physical aspect ratio so normals match circular craters
  const yScale = physicalAspect * (h / w);

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
      let ny = (up - down) * strength * yScale;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

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

// ── Roughness map ─────────────────────────────────────────────────

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
      let roughness = 0.92 - (hVal - 0.5) * 0.9;
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

// ── AO map ────────────────────────────────────────────────────────

function heightmapToAOCanvas(hmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  const kernelR = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const center = hmap[y * w + x];
      let higher = 0, samples = 0;

      for (let ky = -kernelR; ky <= kernelR; ky += 2) {
        for (let kx = -kernelR; kx <= kernelR; kx += 2) {
          const sy = Math.max(0, Math.min(h - 1, y + ky));
          const sx = ((x + kx) % w + w) % w;
          if (hmap[sy * w + sx] > center) higher++;
          samples++;
        }
      }

      const ao = 1.0 - (higher / samples) * 0.6;
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

// ── Albedo map ────────────────────────────────────────────────────

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
      const n = fbm(stoneNoise, u, v, 2, 2.0, 0.5) * 0.5 + 0.5;
      const grain = (grainRng() - 0.5) * 0.04;
      const hVal = hmap[y * w + x];
      const heightTint = 0.95 + (hVal - 0.5) * 0.1;

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

// ── Displacement map ──────────────────────────────────────────────

function heightmapToDisplacementCanvas(hmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hVal = hmap[y * w + x];
      const v = Math.round(Math.max(0, Math.min(1, hVal)) * 255);
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

export function generateLunarSurfaceMaps(lunar: LunarTextureState, physicalAspect?: number): LunarSurfaceMapSet {
  // physicalAspect = circumference / width; defaults to 1 (square) for backward compat
  const aspect = physicalAspect ?? 1;
  const key = cacheKey(lunar) + `-a${aspect.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key)!;

  const { hmap, craterCount } = buildHeightmap(lunar, aspect);

  // Scale normal map Y gradient by aspect ratio so lighting responds to circular craters correctly
  const normalCanvas = heightmapToNormalCanvas(hmap, MAP_W, MAP_H, 2.5, aspect);
  const roughnessCanvas = heightmapToRoughnessCanvas(hmap, MAP_W, MAP_H, lunar.microDetail);
  const aoCanvas = heightmapToAOCanvas(hmap, MAP_W, MAP_H);
  const albedoCanvas = heightmapToAlbedoCanvas(hmap, MAP_W, MAP_H, lunar.seed);
  const displacementCanvas = heightmapToDisplacementCanvas(hmap, MAP_W, MAP_H);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  const aoMap = new THREE.CanvasTexture(aoCanvas);
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  const displacementMap = new THREE.CanvasTexture(displacementCanvas);

  setupDataTexture(normalMap);
  setupDataTexture(roughnessMap);
  setupDataTexture(aoMap);
  setupDataTexture(albedoMap);
  setupDataTexture(displacementMap);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const maps: LunarSurfaceMapSet = { normalMap, roughnessMap, aoMap, albedoMap, displacementMap, craterCount };
  cache.set(key, maps);
  return maps;
}

/** Dispose old textures when no longer needed */
export function disposeLunarMaps(maps: LunarSurfaceMapSet) {
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.aoMap.dispose();
  maps.albedoMap.dispose();
  maps.displacementMap.dispose();
}
