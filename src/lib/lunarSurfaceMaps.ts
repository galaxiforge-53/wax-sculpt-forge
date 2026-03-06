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

export const MAP_W = 4096;
export const MAP_H = 1024;
export const MAP_DIMENSIONS = { width: MAP_W, height: MAP_H } as const;

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
  rimAsymmetry: number;    // 0-1 angular rim height variation
  rimAsymAngle: number;    // preferred direction for thicker rim
  slumpAngle: number;      // wall slump direction
  slumpStrength: number;   // 0-1
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
  // Physical aspect correction: V is stretched so craters are circular on the ring surface
  // U maps to circumference, V maps to width. physicalAspect = circumference / width.
  // A circle of physical radius R covers:
  //   U extent (in UV) = R / circumference
  //   V extent (in UV) = R / width = (R / circumference) * physicalAspect
  // So in pixel space, V pixels = U pixels * physicalAspect * (MAP_H / MAP_W)
  const vStretch = physicalAspect;

  // Pixel radii for distance normalisation — ensures circular craters
  const pxR = c.radius * w;
  const pyR = c.radius * h * vStretch;

  const spreadU = c.radius * 1.7;
  const spreadV = c.radius * 1.7 * vStretch;
  const x0 = Math.floor((c.cu - spreadU) * w);
  const x1 = Math.ceil((c.cu + spreadU) * w);
  const y0 = Math.max(0, Math.floor((c.cv - spreadV) * h));
  const y1 = Math.min(h - 1, Math.ceil((c.cv + spreadV) * h));

  // ── Realistic crater profile zones (based on lunar morphology) ──
  // Bowl uses hemispherical parabolic profile instead of flat floor
  const bowlEnd = 0.58;             // where bowl wall meets rim inner face
  const rimInner = 0.62 + rimSharpness * 0.04 + c.rimCenterJitter;
  const rimPeak = 0.72 + rimSharpness * 0.05 + c.rimCenterJitter;
  const rimOuter = 0.88 + c.rimWidthJitter;
  const ejectaEnd = 1.45;           // faint ejecta blanket

  const noiseScale = 6 + c.warpSeed * 3;

  // Central peak parameters (for mega/hero craters)
  const peakRadius = 0.18;
  const peakHeight = c.depth * 0.35;

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
      const wdu = du + warpAmp * 0.22 * wU;
      const wdv = dv + warpAmp * 0.22 * wV;

      const dist = Math.sqrt(wdu * wdu + wdv * wdv);
      if (dist > ejectaEnd) continue;

      // Angular position for asymmetric rim
      const angle = Math.atan2(wdv, wdu);

      // Rim asymmetry — one side higher (simulates oblique impact / gravity slump)
      const angleDiff = Math.cos(angle - c.rimAsymAngle);
      const rimAsymFactor = 1.0 + c.rimAsymmetry * 0.4 * angleDiff;

      // Wall slump — shifts bowl slightly off-center
      const slumpShift = c.slumpStrength * 0.08;
      const slumpDu = wdu + Math.cos(c.slumpAngle) * slumpShift;
      const slumpDv = wdv + Math.sin(c.slumpAngle) * slumpShift;
      const slumpDist = Math.sqrt(slumpDu * slumpDu + slumpDv * slumpDv);

      let delta = 0;
      const effectiveRimH = c.rimHeight * rimAsymFactor;

      if (dist < bowlEnd) {
        // ── Hemispherical parabolic bowl ──
        // Smooth parabolic curve: depth * (dist/bowlEnd)^2 - depth
        // This creates a natural concave bowl, deepest at center
        const t = slumpDist / bowlEnd;  // use slumped distance for asymmetry
        const tClamped = Math.min(t, 1.0);

        // Parabolic bowl: -depth at center, rises to ~0 at bowlEnd
        const parabola = tClamped * tClamped;
        delta = -c.depth * (1.0 - parabola * 0.92);

        // Central peak — smooth bell mound (complex craters only)
        if (hasCentralPeak && dist < peakRadius) {
          const pt = dist / peakRadius;
          const bell = Math.exp(-pt * pt * 5.0);
          delta += peakHeight * bell;
        }

        // Terraced inner walls (mega craters — concentric step-downs)
        if (terraceCount > 0 && tClamped > 0.35) {
          const terraceT = (tClamped - 0.35) / 0.65;
          const step = Math.floor(terraceT * terraceCount);
          const frac = terraceT * terraceCount - step;
          const stepSmooth = smoothstep(0.0, 0.3, frac);
          delta += c.depth * 0.08 * stepSmooth;
        }
      } else if (dist < rimInner) {
        // ── Steep inner wall — transition from bowl to rim ──
        const t = (dist - bowlEnd) / (rimInner - bowlEnd);
        // Cubic ease for steep inner wall face
        const s = t * t * (3 - 2 * t);
        delta = lerp(-c.depth * 0.08, effectiveRimH * 0.35, s);
      } else if (dist < rimPeak) {
        // ── Rim crest — sharp raised peak ──
        const t = (dist - rimInner) / (rimPeak - rimInner);
        // Sinusoidal peak for natural rounded crest
        const s = Math.sin(t * Math.PI);
        delta = effectiveRimH * 0.35 + s * effectiveRimH * 0.65;
      } else if (dist < rimOuter) {
        // ── Outer rim slope — gentler asymmetric decline ──
        const t = (dist - rimPeak) / (rimOuter - rimPeak);
        // Cubic falloff for natural outer slope
        const s = 1 - (1 - t) * (1 - t) * (1 - t);
        delta = effectiveRimH * (1 - s);
      } else if (dist < ejectaEnd) {
        // ── Ejecta blanket — very faint raised material ──
        const t = (dist - rimOuter) / (ejectaEnd - rimOuter);
        const falloff = (1 - t) * (1 - t) * (1 - t);
        delta = effectiveRimH * 0.05 * Math.max(0, falloff);
      }

      const mask = edgeMask[py * w + wpx];
      delta *= mask;

      const idx = py * w + wpx;
      // For overlapping impacts: newer craters can carve INTO older rims
      // Use additive for bowls (negative delta) and max for rims (positive delta)
      if (delta < 0) {
        // Bowl excavation — always applies (newer impact digs through old material)
        hmap[idx] = Math.max(0, Math.min(1, hmap[idx] + delta));
      } else {
        // Rim deposition — only raise if this rim is higher than existing surface
        // This prevents weird double-rim artifacts from overlapping craters
        const target = 0.5 + delta;
        if (target > hmap[idx]) {
          hmap[idx] = Math.min(1, hmap[idx] + delta * 0.7);
        } else {
          // Faint contribution even when below existing surface
          hmap[idx] = Math.min(1, hmap[idx] + delta * 0.15);
        }
      }
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
          rimAsymmetry: rand() * 0.3,
          rimAsymAngle: rand() * Math.PI * 2,
          slumpAngle: rand() * Math.PI * 2,
          slumpStrength: rand() * 0.15,
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

// Reference ring for surface-area scaling (US size 8, 6mm wide, 2mm thick)
const REF_INNER_DIAM = 18.1; // mm
const REF_WIDTH = 6;         // mm
const REF_THICKNESS = 2;     // mm

function computeSurfaceAreaFactor(innerDiameterMm: number, widthMm: number, thicknessMm: number): number {
  const refOuterR = REF_INNER_DIAM / 2 + REF_THICKNESS;
  const refArea = 2 * Math.PI * refOuterR * REF_WIDTH;
  const outerR = innerDiameterMm / 2 + thicknessMm;
  const area = 2 * Math.PI * outerR * widthMm;
  // Clamp so very small rings don't drop to zero craters
  return Math.max(0.35, Math.min(3.0, area / refArea));
}

export interface HeightmapResult {
  hmap: Float32Array;
  craterCount: number;
}

/**
 * Build the lunar heightmap. When ring dimensions are provided, crater counts
 * scale proportionally to the physical surface area so a narrow size-3 ring
 * isn't overcrowded and a wide size-16 ring isn't sparse.
 */
export function buildHeightmap(
  lunar: LunarTextureState,
  physicalAspect: number = 1,
  ringDims?: { innerDiameterMm: number; widthMm: number; thicknessMm: number },
): HeightmapResult {
  const surfaceAreaFactor = ringDims
    ? computeSurfaceAreaFactor(ringDims.innerDiameterMm, ringDims.widthMm, ringDims.thicknessMm)
    : 1;

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

  // ─── 1) fBm base terrain layer (6 octaves for high-res detail) ──
  const baseNoise = makeNoise2D(lunar.seed + 500);
  const baseAmp = (0.04 + terrainRough * 0.12) * depthScale;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W * 8;
      const v = y / MAP_H * 8;
      const n = fbm(baseNoise, u, v, 6, 2.0, 0.5);
      const mask = edgeMask[y * MAP_W + x];
      hmap[y * MAP_W + x] += n * baseAmp * mask;
    }
  }

  // ─── 2) Domain warp noise ──────────────────────────────
  const warpNoise = makeNoise2D(lunar.seed + 1234);
  const warpAmp = 0.15 + rimSharp * 0.12;

  // ─── 3) 5-tier crater distribution (scaled by surface area) ─────
  const densityMul = lunar.craterDensity === "low" ? 0.5 : lunar.craterDensity === "med" ? 1.0 : 1.8;
  const sizeMul = lunar.craterSize === "small" ? 0.6 : lunar.craterSize === "med" ? 1.0 : 1.5;
  const saf = surfaceAreaFactor; // shorthand

  // Tier 0: MEGA craters (1-3, massive basin impacts) — count barely scales
  const megaCount = Math.round((1 + densityMul * 1.5) * Math.max(0.6, Math.min(1.5, saf)));
  const megaRadMin = 0.12 * sizeMul, megaRadMax = 0.22 * sizeMul;

  // Tier 1: HERO craters (3-8) — moderate scaling
  const heroCount = Math.round((3 + densityMul * 5) * Math.sqrt(saf));
  const heroRadMin = 0.06 * sizeMul, heroRadMax = 0.12 * sizeMul;

  // Tier 2: MEDIUM craters (15-50) — full scaling
  const medCount = Math.round((15 + densityMul * 35 * sizeMul) * saf);
  const medRadMin = 0.025 * sizeMul, medRadMax = 0.06 * sizeMul;

  // Tier 3: SMALL craters (40-200) — full scaling
  const smallCount = Math.round((40 + densityMul * 160) * saf);
  const smallRadMin = 0.008, smallRadMax = 0.025 * sizeMul;

  // Tier 4: MICRO-PITS (hundreds) — full scaling
  const microPitCount = Math.round((200 + densityMul * 600) * saf);

  const stamps: CraterStamp[] = [];

  function addCraters(count: number, rMin: number, rMax: number, depthMul: number, tier: number) {
    for (let i = 0; i < count; i++) {
      // Power-law size distribution: more small craters, fewer large ones
      const t = Math.pow(rand(), 1.5);
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

      // Asymmetric rim and slump for realism
      const rimAsymmetry = rand() * (tier <= 1 ? 0.5 : 0.3);
      const rimAsymAngle = rand() * Math.PI * 2;
      const slumpAngle = rand() * Math.PI * 2;
      const slumpStrength = rand() * (tier <= 1 ? 0.3 : 0.15);

      stamps.push({
        cu, cv, radius, depth, rimHeight: rimH,
        rimCenterJitter, rimWidthJitter, warpSeed, tier, age,
        rimAsymmetry, rimAsymAngle, slumpAngle, slumpStrength,
      });
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
        rimAsymmetry: rand() * 0.4,
        rimAsymAngle: rand() * Math.PI * 2,
        slumpAngle: rand() * Math.PI * 2,
        slumpStrength: rand() * 0.2,
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

  // ─── 6) Regolith micro-texture (high-frequency coherent noise + grain) ─────
  if (microFactor > 0) {
    // Primary regolith noise — powdery surface at medium scale
    const regolithNoise = makeNoise2D(lunar.seed + 3333);
    const regolithStrength = microFactor * 0.05 * depthScale;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const u = x / MAP_W * 48;  // higher frequency for 4K maps
        const v = y / MAP_H * 48;
        const n = fbm(regolithNoise, u, v, 5, 2.2, 0.45);
        const mask = edgeMask[y * MAP_W + x];
        hmap[y * MAP_W + x] += n * regolithStrength * mask;
      }
    }

    // Secondary high-frequency regolith — very fine powdery detail
    const fineRegolith = makeNoise2D(lunar.seed + 4444);
    const fineStrength = microFactor * 0.025 * depthScale;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const u = x / MAP_W * 96;
        const v = y / MAP_H * 96;
        const n = fineRegolith(u, v);
        const mask = edgeMask[y * MAP_W + x];
        hmap[y * MAP_W + x] += n * fineStrength * mask;
      }
    }

    // Fine grain noise on top — per-pixel randomness for gritty texture
    const grainRng = seededRng(lunar.seed + 9999);
    const grainStrength = microFactor * 0.035 * depthScale;
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

// ── Normal map from heightmap (enhanced Sobel with 3×3 kernel) ────

function heightmapToNormalCanvas(hmap: Float32Array, w: number, h: number, strength: number, physicalAspect: number = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);

  // Correct Y gradient for physical aspect ratio so normals match circular craters
  const yScale = physicalAspect * (h / w);

  // Helper to sample with wrapping (U wraps, V clamps)
  const sample = (sx: number, sy: number) => {
    const wx = ((sx % w) + w) % w;
    const wy = Math.max(0, Math.min(h - 1, sy));
    return hmap[wy * w + wx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Full 3×3 Sobel kernel for sharper gradients
      const tl = sample(x - 1, y - 1);
      const tc = sample(x,     y - 1);
      const tr = sample(x + 1, y - 1);
      const ml = sample(x - 1, y);
      const mr = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const bc = sample(x,     y + 1);
      const br = sample(x + 1, y + 1);

      // Sobel X: [-1 0 1; -2 0 2; -1 0 1]
      let nx = (tl - tr + 2 * (ml - mr) + bl - br) * strength * 0.25;
      // Sobel Y: [-1 -2 -1; 0 0 0; 1 2 1]
      let ny = (tl + 2 * tc + tr - bl - 2 * bc - br) * strength * yScale * 0.25;
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

export interface RingDimensions {
  innerDiameterMm: number;
  widthMm: number;
  thicknessMm: number;
}

export function generateLunarSurfaceMaps(
  lunar: LunarTextureState,
  physicalAspect?: number,
  ringDims?: RingDimensions,
): LunarSurfaceMapSet {
  // physicalAspect = circumference / width; defaults to 1 (square) for backward compat
  const aspect = physicalAspect ?? 1;
  const dimsKey = ringDims ? `-d${ringDims.innerDiameterMm.toFixed(1)}_${ringDims.widthMm.toFixed(1)}_${ringDims.thicknessMm.toFixed(1)}` : "";
  const key = cacheKey(lunar) + `-a${aspect.toFixed(2)}` + dimsKey;
  if (cache.has(key)) return cache.get(key)!;

  const { hmap, craterCount } = buildHeightmap(lunar, aspect, ringDims);

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
