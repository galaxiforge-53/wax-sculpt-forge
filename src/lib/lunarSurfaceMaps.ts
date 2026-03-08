import * as THREE from "three";
import { LunarTextureState, TerrainType, SurfaceZone, SurfaceMask, MaskMode } from "@/types/lunar";

/**
 * Generates full-ring UV-space maps (normalMap, roughnessMap, aoMap, albedoMap, displacementMap)
 * from a heightmap with 5-tier crater distribution, central peaks, terraced walls,
 * ejecta rays, secondary impacts, erosion simulation, terrain roughness,
 * crater shape modes (circular/oval/organic/angular), maria fill, highland ridges,
 * and crater floor texturing.
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
export const MAP_W_PREVIEW = 2048;
export const MAP_H_PREVIEW = 512;
export const MAP_DIMENSIONS = { width: MAP_W, height: MAP_H } as const;

const MAX_CACHE_SIZE = 4;
const cache = new Map<string, LunarSurfaceMapSet>();

function evictCache() {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first inserted)
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      const old = cache.get(firstKey);
      if (old) disposeLunarMaps(old);
      cache.delete(firstKey);
    }
  }
}

function cacheKey(lunar: LunarTextureState, ringAspect?: number): string {
  const zonesKey = lunar.zonesEnabled && lunar.zones?.length
    ? lunar.zones.map(z => `${z.startV}-${z.endV}-${z.intensity}-${z.smoothness}-${z.blendWidth}`).join("|")
    : "no-zones";
  const masksKey = lunar.masksEnabled && lunar.masks?.length
    ? lunar.masks.filter(m => m.enabled).map(m => `${m.shape}-${m.centerU}-${m.centerV}-${m.width}-${m.height}-${m.feather}-${m.invert}`).join("|")
    : "no-masks";
  return [
    lunar.seed, lunar.craterDensity, lunar.craterSize, lunar.intensity,
    lunar.microDetail, lunar.rimSharpness, lunar.overlapIntensity,
    lunar.smoothEdges ? 1 : 0, lunar.rimHeight, lunar.bowlDepth,
    lunar.erosion, lunar.terrainRoughness, lunar.craterVariation,
    lunar.craterShape ?? "circular",
    lunar.ovalElongation ?? 50, lunar.ovalAngle ?? 0,
    lunar.mariaFill ?? 0, lunar.highlandRidges ?? 0,
    lunar.craterFloorTexture ?? 30, lunar.ejectaStrength ?? 50,
    lunar.terrainType ?? "generic",
    lunar.terrainContrast ?? 60,
    lunar.layerLargeCraters ?? 50,
    lunar.layerMediumImpacts ?? 50,
    lunar.layerMicroPitting ?? 50,
    lunar.symmetry ?? "none",
    lunar.symmetryBlend ?? 30,
    zonesKey,
    masksKey,
    lunar.maskMode ?? "include",
    // Include ring aspect ratio so different ring sizes get distinct textures
    ringAspect !== undefined ? ringAspect.toFixed(2) : "1.00",
  ].join("-");
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
  // Flatten gradient vectors into a single Float64Array with stride 2
  // Eliminates pointer indirection on every noise lookup (~50M+ calls per generation)
  const gradFlat = new Float64Array(SIZE * 2);
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    const angle = rng() * Math.PI * 2;
    gradFlat[i * 2] = Math.cos(angle);
    gradFlat[i * 2 + 1] = Math.sin(angle);
  }
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < SIZE; i++) perm[SIZE + i] = perm[i];

  return (x: number, y: number): number => {
    // Cache Math.floor results — eliminates 2 redundant calls per invocation
    // (was called twice each for x and y). On 50M+ calls this saves ~100M Math.floor ops.
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const xi = fx & 255;
    const yi = fy & 255;
    const xf = x - fx;
    const yf = y - fy;
    // Inline fade: t³(6t²-15t+10)
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const aa = (perm[perm[xi] + yi] & 255) * 2;
    const ab = (perm[perm[xi] + yi + 1] & 255) * 2;
    const ba = (perm[perm[xi + 1] + yi] & 255) * 2;
    const bb = (perm[perm[xi + 1] + yi + 1] & 255) * 2;

    // Inline dot products with flat gradient array
    const xf1 = xf - 1;
    const yf1 = yf - 1;
    const d00 = gradFlat[aa] * xf + gradFlat[aa + 1] * yf;
    const d10 = gradFlat[ba] * xf1 + gradFlat[ba + 1] * yf;
    const d01 = gradFlat[ab] * xf + gradFlat[ab + 1] * yf1;
    const d11 = gradFlat[bb] * xf1 + gradFlat[bb + 1] * yf1;

    // Inline bilinear interpolation
    const x0 = d00 + u * (d10 - d00);
    const x1 = d01 + u * (d11 - d01);
    return x0 + v * (x1 - x0);
  };
}

// ── fBm ───────────────────────────────────────────────────────────

// Optimized fBm with unrolled common octave counts (4, 5, 6)
// Avoids loop overhead + branch prediction misses on 50M+ calls
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
  // Unrolled fast paths for most common octave counts
  if (octaves === 4 && lacunarity === 2.0 && gain === 0.5) {
    const n0 = noise(x, y);
    const n1 = noise(x * 2, y * 2) * 0.5;
    const n2 = noise(x * 4, y * 4) * 0.25;
    const n3 = noise(x * 8, y * 8) * 0.125;
    return (n0 + n1 + n2 + n3) / 1.875;
  }
  if (octaves === 6 && lacunarity === 2.0 && gain === 0.5) {
    const n0 = noise(x, y);
    const n1 = noise(x * 2, y * 2) * 0.5;
    const n2 = noise(x * 4, y * 4) * 0.25;
    const n3 = noise(x * 8, y * 8) * 0.125;
    const n4 = noise(x * 16, y * 16) * 0.0625;
    const n5 = noise(x * 32, y * 32) * 0.03125;
    return (n0 + n1 + n2 + n3 + n4 + n5) / 1.96875;
  }
  if (octaves === 5) {
    let sum = 0, amp = 1, freq = 1, maxAmp = 0;
    sum += noise(x, y); maxAmp += 1;
    amp *= gain; freq *= lacunarity;
    sum += noise(x * freq, y * freq) * amp; maxAmp += amp;
    amp *= gain; freq *= lacunarity;
    sum += noise(x * freq, y * freq) * amp; maxAmp += amp;
    amp *= gain; freq *= lacunarity;
    sum += noise(x * freq, y * freq) * amp; maxAmp += amp;
    amp *= gain; freq *= lacunarity;
    sum += noise(x * freq, y * freq) * amp; maxAmp += amp;
    return sum / maxAmp;
  }
  // General fallback
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

// ── Edge polish mask (cached at module level) ─────────────────────
// This mask is always MAP_W × MAP_H and only depends on dimensions,
// so we build it once and reuse across all heightmap generations.

let _cachedEdgeMask: Float32Array | null = null;
let _cachedEdgeMaskW = 0;
let _cachedEdgeMaskH = 0;

function buildEdgeMask(w: number, h: number): Float32Array {
  if (_cachedEdgeMask && _cachedEdgeMaskW === w && _cachedEdgeMaskH === h) {
    return _cachedEdgeMask;
  }
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const edgeDist = Math.min(v, 1 - v);
    const m = smoothstep(0.0, 0.18, edgeDist);
    // Fill entire row with same value (row-constant mask)
    const rowStart = y * w;
    mask.fill(m, rowStart, rowStart + w);
  }
  _cachedEdgeMask = mask;
  _cachedEdgeMaskW = w;
  _cachedEdgeMaskH = h;
  return mask;
}

// ── Crater shape distance function ────────────────────────────────
// Returns a normalized distance (0 = center, 1 = edge) that respects
// the selected crater shape mode.

interface ShapeParams {
  shape: string;       // "circular" | "oval" | "organic" | "angular"
  ovalElongation: number;  // 0-1 normalized
  ovalAngleRad: number;    // per-crater random angle (derived from global + variation)
  warpNoise: (x: number, y: number) => number;
  noiseScale: number;
  warpAmp: number;
  angularFacets: number; // 4-8 for angular mode
  angularPhase: number;
}

function shapedDistance(
  du: number, dv: number,
  sp: ShapeParams,
  px: number, py: number,
  w: number, h: number,
): { dist: number; wdu: number; wdv: number } {
  let sdu = du;
  let sdv = dv;

  // Apply shape transformation
  switch (sp.shape) {
    case "oval": {
      // Rotate into oval frame, scale one axis
      const cos = Math.cos(sp.ovalAngleRad);
      const sin = Math.sin(sp.ovalAngleRad);
      const ru = du * cos + dv * sin;
      const rv = -du * sin + dv * cos;
      // Elongation: stretch one axis (0.3 to 1.0 ratio)
      const ratio = 1.0 - sp.ovalElongation * 0.7;
      sdu = ru / Math.max(0.3, ratio);
      sdv = rv;
      // Rotate back for warp
      const cos2 = Math.cos(-sp.ovalAngleRad);
      const sin2 = Math.sin(-sp.ovalAngleRad);
      const finalU = sdu * cos2 + sdv * sin2;
      const finalV = -sdu * sin2 + sdv * cos2;
      sdu = finalU;
      sdv = finalV;
      break;
    }
    case "angular": {
      // Polygonal distance — reduces circular to N-sided polygon
      const angle = Math.atan2(sdv, sdu);
      const r = Math.sqrt(sdu * sdu + sdv * sdv);
      const n = sp.angularFacets;
      const sector = (2 * Math.PI) / n;
      const sectorAngle = ((angle - sp.angularPhase) % sector + sector) % sector;
      const halfSector = sector / 2;
      // Scale distance by cos of angle within sector to make polygon
      const polyScale = Math.cos(halfSector) / Math.cos(sectorAngle - halfSector);
      const pr = r * polyScale;
      sdu = pr * Math.cos(angle);
      sdv = pr * Math.sin(angle);
      break;
    }
    case "organic": {
      // Extra domain warp for irregular natural shapes
      const wU2 = sp.warpNoise(px * sp.noiseScale * 1.5 / w + 200, py * sp.noiseScale * 1.5 / h + 200);
      const wV2 = sp.warpNoise(py * sp.noiseScale * 1.5 / h + 300, px * sp.noiseScale * 1.5 / w + 300);
      sdu += sp.warpAmp * 0.35 * wU2;
      sdv += sp.warpAmp * 0.35 * wV2;
      break;
    }
    // "circular" — no transformation
  }

  // Multi-octave domain warp for more organic, natural crater edges
  // Two octaves of warp: coarse (large-scale irregularity) + fine (edge detail)
  const coarseScale = sp.noiseScale * 0.5;
  const fineScale = sp.noiseScale * 2.0;
  const wU_coarse = sp.warpNoise(px * coarseScale / w, py * coarseScale / h);
  const wV_coarse = sp.warpNoise(py * coarseScale / h + 100, px * coarseScale / w + 100);
  const wU_fine = sp.warpNoise(px * fineScale / w + 50, py * fineScale / h + 50);
  const wV_fine = sp.warpNoise(py * fineScale / h + 150, px * fineScale / w + 150);
  const wU = wU_coarse * 0.7 + wU_fine * 0.3;
  const wV = wV_coarse * 0.7 + wV_fine * 0.3;
  const wdu = sdu + sp.warpAmp * 0.22 * wU;
  const wdv = sdv + sp.warpAmp * 0.22 * wV;

  const dist = Math.sqrt(wdu * wdu + wdv * wdv);
  return { dist, wdu, wdv };
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
  tier: number;
  age: number;
  rimAsymmetry: number;
  rimAsymAngle: number;
  slumpAngle: number;
  slumpStrength: number;
  // v3 shape per-crater
  shapeAngleRad: number;
  angularFacets: number;
  angularPhase: number;
  floorTextureFactor: number; // 0-1
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
  shapeMode: string = "circular",
  ovalElongation: number = 0.5,
  floorNoise?: (x: number, y: number) => number,
) {
  const vStretch = physicalAspect;
  const pxR = c.radius * w;
  const pyR = c.radius * h * vStretch;

  const spreadU = c.radius * 1.7;
  const spreadV = c.radius * 1.7 * vStretch;
  const x0 = Math.floor((c.cu - spreadU) * w);
  const x1 = Math.ceil((c.cu + spreadU) * w);
  const y0 = Math.max(0, Math.floor((c.cv - spreadV) * h));
  const y1 = Math.min(h - 1, Math.ceil((c.cv + spreadV) * h));

  const bowlEnd = 0.58;
  const rimInner = 0.62 + rimSharpness * 0.04 + c.rimCenterJitter;
  const rimPeak = 0.72 + rimSharpness * 0.05 + c.rimCenterJitter;
  const rimOuter = 0.88 + c.rimWidthJitter;
  const ejectaEnd = 1.45;

  const noiseScale = 6 + c.warpSeed * 3;

  const peakRadius = 0.18;
  const peakHeight = c.depth * 0.35;

  const terraceCount = hasTerraces ? 3 : 0;

  const sp: ShapeParams = {
    shape: shapeMode,
    ovalElongation,
    ovalAngleRad: c.shapeAngleRad,
    warpNoise,
    noiseScale,
    warpAmp,
    angularFacets: c.angularFacets,
    angularPhase: c.angularPhase,
  };

  // Pre-compute whether we need expensive shape/asymmetry calculations
  const isCircular = shapeMode === "circular";
  const hasAsymmetry = c.rimAsymmetry > 0.01;
  const hasSlump = c.slumpStrength > 0.01;
  const invPxR = 1 / pxR;
  const invPyR = 1 / pyR;
  // Squared radius for cheap early rejection (before expensive shapedDistance)
  const rejectR2 = (c.radius * 1.7) * (c.radius * 1.7);

  // Hoist per-crater constants outside the pixel loop
  const cuW = c.cu * w;
  const cvH = c.cv * h;
  const invVStretch2 = 1 / (vStretch * vStretch);
  const invW = 1 / w;
  const invH = 1 / h;
  // Circular fast-path constants (hoisted from inner loop)
  const circ_coarseScale = sp.noiseScale * 0.5;
  const circ_fineScale = sp.noiseScale * 2.0;
  const circ_warpFactor = sp.warpAmp * 0.22;
  // Pre-compute slump trig if needed
  const slumpCos = hasSlump ? Math.cos(c.slumpAngle) : 0;
  const slumpSin = hasSlump ? Math.sin(c.slumpAngle) : 0;
  const slumpShift = hasSlump ? c.slumpStrength * 0.08 : 0;

  for (let py = y0; py <= y1; py++) {
    const rowOff = py * w;
    for (let px = x0; px <= x1; px++) {
      let wpx = px % w;
      if (wpx < 0) wpx += w;

      const rawDu = px - cuW;
      const rawDv = py - cvH;

      // Cheap squared-distance early rejection in UV space
      const rawU = rawDu * invW;
      const rawV = rawDv * invH;
      if (rawU * rawU + rawV * rawV * invVStretch2 > rejectR2) continue;

      const du = rawDu * invPxR;
      const dv = rawDv * invPyR;

      let dist: number, wdu: number, wdv: number;

      if (isCircular) {
        // Fast path for circular craters: skip shape transformation, only do domain warp
        const pxInvW = px * invW;
        const pyInvH = py * invH;
        const wU = sp.warpNoise(pxInvW * circ_coarseScale, pyInvH * circ_coarseScale) * 0.7
                  + sp.warpNoise(pxInvW * circ_fineScale + 50, pyInvH * circ_fineScale + 50) * 0.3;
        const wV = sp.warpNoise(pyInvH * circ_coarseScale + 100, pxInvW * circ_coarseScale + 100) * 0.7
                  + sp.warpNoise(pyInvH * circ_fineScale + 150, pxInvW * circ_fineScale + 150) * 0.3;
        wdu = du + circ_warpFactor * wU;
        wdv = dv + circ_warpFactor * wV;
        dist = Math.sqrt(wdu * wdu + wdv * wdv);
      } else {
        const result = shapedDistance(du, dv, sp, px, py, w, h);
        dist = result.dist;
        wdu = result.wdu;
        wdv = result.wdv;
      }
      if (dist > ejectaEnd) continue;

      // Skip expensive atan2 for craters with no rim asymmetry
      let rimAsymFactor = 1.0;
      if (hasAsymmetry) {
        const angle = Math.atan2(wdv, wdu);
        rimAsymFactor = 1.0 + c.rimAsymmetry * 0.4 * Math.cos(angle - c.rimAsymAngle);
      }

      // Skip slump computation for craters with negligible slump
      let slumpDist = dist;
      if (hasSlump) {
        const slumpShift = c.slumpStrength * 0.08;
        const slumpDu = wdu + Math.cos(c.slumpAngle) * slumpShift;
        const slumpDv = wdv + Math.sin(c.slumpAngle) * slumpShift;
        slumpDist = Math.sqrt(slumpDu * slumpDu + slumpDv * slumpDv);
      }

      let delta = 0;
      const effectiveRimH = c.rimHeight * rimAsymFactor;

      if (dist < bowlEnd) {
        const t = slumpDist / bowlEnd;
        const tClamped = Math.min(t, 1.0);
        // Realistic crater bowl: flat floor in center transitioning to steep walls
        // Real craters have flat floors from melt pooling, with concave walls rising to rim
        const flatFloorEnd = 0.35; // inner 35% is nearly flat
        let bowlProfile: number;
        if (tClamped < flatFloorEnd) {
          // Flat floor with very subtle dish
          bowlProfile = 1.0 - tClamped * tClamped * 0.15;
        } else {
          // Steep concave wall rising to rim — cubic ease-out for realistic curvature
          const wallT = (tClamped - flatFloorEnd) / (1.0 - flatFloorEnd);
          const wallCurve = wallT * wallT * (3.0 - 2.0 * wallT); // smoothstep
          bowlProfile = (1.0 - flatFloorEnd * flatFloorEnd * 0.15) * (1.0 - wallCurve * 0.95);
        }
        delta = -c.depth * bowlProfile;

        // Crater floor texture — add roughness inside the bowl
        if (floorNoise && c.floorTextureFactor > 0 && tClamped < 0.7) {
          const floorN = floorNoise(wpx * 0.05, py * 0.05);
          delta += floorN * c.depth * 0.15 * c.floorTextureFactor * (1 - tClamped / 0.7);
        }

        if (hasCentralPeak && dist < peakRadius) {
          const pt = dist / peakRadius;
          const bell = Math.exp(-pt * pt * 5.0);
          delta += peakHeight * bell;
        }

        if (terraceCount > 0 && tClamped > 0.35) {
          const terraceT = (tClamped - 0.35) / 0.65;
          const step = Math.floor(terraceT * terraceCount);
          const frac = terraceT * terraceCount - step;
          const stepSmooth = smoothstep(0.0, 0.3, frac);
          delta += c.depth * 0.08 * stepSmooth;
        }
      } else if (dist < rimInner) {
        const t = (dist - bowlEnd) / (rimInner - bowlEnd);
        const s = t * t * (3 - 2 * t);
        delta = lerp(-c.depth * 0.08, effectiveRimH * 0.35, s);
      } else if (dist < rimPeak) {
        const t = (dist - rimInner) / (rimPeak - rimInner);
        const s = Math.sin(t * Math.PI);
        delta = effectiveRimH * 0.35 + s * effectiveRimH * 0.65;
      } else if (dist < rimOuter) {
        const t = (dist - rimPeak) / (rimOuter - rimPeak);
        const s = 1 - (1 - t) * (1 - t) * (1 - t);
        delta = effectiveRimH * (1 - s);
      } else if (dist < ejectaEnd) {
        const t = (dist - rimOuter) / (ejectaEnd - rimOuter);
        const falloff = (1 - t) * (1 - t) * (1 - t);
        delta = effectiveRimH * 0.05 * Math.max(0, falloff);
      }

      const mask = edgeMask[py * w + wpx];
      delta *= mask;

      const idx = py * w + wpx;
      if (delta < 0) {
        // Allow overlapping craters to stack deeper (minimum -0.3 for realistic depth)
        // Previous clamping to 0 prevented natural multi-impact basins
        hmap[idx] = Math.max(-0.3, hmap[idx] + delta);
      } else {
        // Rim accumulation: newer rims partially overwrite older terrain
        // Larger overlap factor means more aggressive stacking
        const target = 0.5 + delta;
        if (target > hmap[idx]) {
          hmap[idx] = Math.min(1.2, hmap[idx] + delta * 0.7);
        } else {
          hmap[idx] = Math.min(1.2, hmap[idx] + delta * 0.15);
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
  ejectaStrength: number = 0.5,
  shapeMode: string = "circular",
  ovalElongation: number = 0.5,
  globalOvalAngle: number = 0,
) {
  if (ejectaStrength <= 0.01) return;

  const rayCount = 4 + Math.floor(rand() * 5);
  const rayLength = c.radius * (2.5 + rand() * 2.0);
  const rayBrightness = c.rimHeight * 0.12 * ejectaStrength;

  for (let r = 0; r < rayCount; r++) {
    const angle = rand() * Math.PI * 2;
    const rayWidth = c.radius * (0.06 + rand() * 0.08);

    const steps = Math.floor(rayLength * w * 0.5);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const dist = c.radius * 0.8 + t * rayLength;
      const ru = c.cu + Math.cos(angle) * dist;
      const rv = c.cv + Math.sin(angle) * dist / physicalAspect;

      if (rv < 0.05 || rv > 0.95) continue;

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

      if (rand() < 0.03 * ejectaStrength) {
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
          shapeAngleRad: globalOvalAngle + (rand() - 0.5) * 0.5,
          angularFacets: 5 + Math.floor(rand() * 3),
          angularPhase: rand() * Math.PI * 2,
          floorTextureFactor: 0,
        });
      }
    }
  }
}

// ── Maria fill pass ──────────────────────────────────────────────
// Simulates dark smooth plains that fill low-lying areas

function applyMariaFill(hmap: Float32Array, w: number, h: number, mariaFactor: number, edgeMask: Float32Array, seed: number) {
  if (mariaFactor <= 0) return;

  // Approximate percentile via random sampling (O(k) instead of O(n log n) full sort)
  const sampleCount = 2000;
  const sampleRng = seededRng(seed + 6500);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = hmap[Math.floor(sampleRng() * hmap.length)];
  }
  samples.sort();
  const threshold = samples[Math.floor(sampleCount * (0.35 + mariaFactor * 0.15))];
  const invThreshold = 1 / Math.max(0.01, threshold);
  const fillTarget = threshold * 0.85;

  const mariaNoise = makeNoise2D(seed + 6000);
  const mariaStrength = mariaFactor * 0.7;
  const invW6 = 6 / w;
  const invH6 = 6 / h;

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const vCoord = y * invH6;
    for (let x = 0; x < w; x++) {
      const idx = rowOff + x;
      const hVal = hmap[idx];
      if (hVal >= threshold) continue; // branch: skip above-threshold pixels early
      const depth = (threshold - hVal) * invThreshold;
      const noise = mariaNoise(x * invW6, vCoord) * 0.3 + 0.5;
      const fill = depth * mariaStrength * noise;
      const mask = edgeMask[idx];
      hmap[idx] = hVal + (fillTarget - hVal) * fill * mask;
    }
  }
}

// ── Highland ridges pass ─────────────────────────────────────────
// Adds raised ridge networks using directional fBm

function applyHighlandRidges(hmap: Float32Array, w: number, h: number, ridgeFactor: number, edgeMask: Float32Array, seed: number, depthScale: number, physicalAspect: number = 1) {
  if (ridgeFactor <= 0) return;

  const ridgeNoise = makeNoise2D(seed + 7500);
  const ridgeAmp = ridgeFactor * 0.08 * depthScale;
  const aspectCorr = physicalAspect / (w / h);
  const invW = 12 / w;
  const invH = 12 / h * aspectCorr;

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const idx = rowOff + x;
      const mask = edgeMask[idx];
      if (mask < 0.01) continue;
      const u = x * invW;
      const n = Math.abs(fbm(ridgeNoise, u, v, 4, 2.2, 0.5));
      const ridge = 1.0 - n * 2.0;
      if (ridge > 0) {
        hmap[idx] += ridge * ridgeAmp * mask;
      }
    }
  }
}

// ── Erosion pass (with pooled temp buffers) ──────────────────────

// Module-level buffer pool to avoid repeated allocation of large Float32Arrays
let _erosionBuf1: Float32Array | null = null;
let _erosionBuf2: Float32Array | null = null;

function applyErosion(hmap: Float32Array, w: number, h: number, erosionFactor: number) {
  if (erosionFactor <= 0) return;

  const len = w * h;
  // Reuse pooled buffers if right size, otherwise allocate
  if (!_erosionBuf1 || _erosionBuf1.length !== len) _erosionBuf1 = new Float32Array(len);
  if (!_erosionBuf2 || _erosionBuf2.length !== len) _erosionBuf2 = new Float32Array(len);
  const temp = _erosionBuf1;
  const blurred = _erosionBuf2;

  const kernelR = Math.max(1, Math.round(2 + erosionFactor * 4));
  const kernelSize = kernelR * 2 + 1;
  const invKernel = 1 / kernelSize;

  // Horizontal pass — pre-compute wrap indices to avoid modular arithmetic in hot loop
  // Wrap index table: wrapIdx[x] = ((x % w) + w) % w for x in [-kernelR, w+kernelR]
  const wrapRange = w + kernelR * 2 + 2;
  const wrapIdx = new Int32Array(wrapRange);
  for (let i = 0; i < wrapRange; i++) {
    const x = i - kernelR - 1;
    wrapIdx[i] = ((x % w) + w) % w;
  }
  const wrapOff = kernelR + 1; // offset so wrapIdx[x + wrapOff] = wrapped(x)

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    let sum = 0;
    for (let kx = -kernelR; kx <= kernelR; kx++) {
      sum += hmap[rowOff + wrapIdx[kx + wrapOff]];
    }
    temp[rowOff] = sum * invKernel;
    for (let x = 1; x < w; x++) {
      sum += hmap[rowOff + wrapIdx[x + kernelR + wrapOff]] - hmap[rowOff + wrapIdx[x - kernelR - 1 + wrapOff]];
      temp[rowOff + x] = sum * invKernel;
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let ky = -kernelR; ky <= kernelR; ky++) {
      sum += temp[Math.max(0, Math.min(h - 1, ky)) * w + x];
    }
    blurred[x] = sum * invKernel;
    for (let y = 1; y < h; y++) {
      sum += temp[Math.min(h - 1, y + kernelR) * w + x] - temp[Math.max(0, y - kernelR - 1) * w + x];
      blurred[y * w + x] = sum * invKernel;
    }
  }

  const blend = erosionFactor * 0.6;
  const oneMinusBlend = 1 - blend;
  for (let i = 0; i < len; i++) {
    hmap[i] = hmap[i] * oneMinusBlend + blurred[i] * blend;
  }
}

// ── Planet-specific terrain passes ────────────────────────────────
// Each terrain type adds unique geological features on top of the
// base crater distribution, making each body visually distinct.

function applyTerrainType(
  hmap: Float32Array, w: number, h: number,
  terrainType: TerrainType,
  edgeMask: Float32Array, seed: number,
  depthScale: number, rand: () => number,
  physicalAspect: number,
) {
  if (terrainType === "generic") return;

  switch (terrainType) {
    case "mercurian":
      applyLobateScarps(hmap, w, h, edgeMask, seed, depthScale);
      break;

    case "phobos":
      applyPhobosGrooves(hmap, w, h, edgeMask, seed, depthScale, rand);
      break;

    case "europa":
      applyIceFractures(hmap, w, h, edgeMask, seed, depthScale);
      break;

    case "lunar":
      applyLunarRayBrightening(hmap, w, h, edgeMask, seed, depthScale);
      break;

    case "martian":
      applyDustFill(hmap, w, h, edgeMask, seed, depthScale);
      break;

    case "callisto":
      applyValhallaConcentric(hmap, w, h, edgeMask, seed, depthScale);
      break;

    case "titan":
      applyOrganicDunes(hmap, w, h, edgeMask, seed, depthScale);
      break;

    case "deimos":
      applyErosion(hmap, w, h, 0.6);
      break;

    case "asteroid":
      applyAsteroidRubble(hmap, w, h, edgeMask, seed, depthScale, rand, physicalAspect);
      break;
  }
}

// ── Mercury: Lobate scarps (thrust fault ridges from planetary cooling) ──

function applyLobateScarps(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
) {
  const scarpNoise = makeNoise2D(seed + 10001);
  const scarpCount = 3 + Math.floor(seededRng(seed + 10002)() * 4);
  const scarpRng = seededRng(seed + 10003);

  for (let s = 0; s < scarpCount; s++) {
    const startU = scarpRng();
    const startV = 0.15 + scarpRng() * 0.7;
    const angle = (scarpRng() - 0.5) * Math.PI * 0.4; // mostly horizontal
    const length = 0.3 + scarpRng() * 0.4;
    const scarpHeight = 0.06 * depthScale * (0.5 + scarpRng() * 0.5);
    const scarpWidth = 0.008 + scarpRng() * 0.012;

    const steps = Math.floor(length * w);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const u = startU + Math.cos(angle) * t * length;
      const v = startV + Math.sin(angle) * t * length;
      // Add wavy perturbation
      const waveOffset = scarpNoise(u * 20, v * 20) * 0.015;

      const px = Math.floor(((u % 1 + 1) % 1) * w);
      const halfWidthPx = Math.ceil(scarpWidth * h);

      for (let dy = -halfWidthPx; dy <= halfWidthPx; dy++) {
        const py = Math.floor((v + waveOffset) * h) + dy;
        if (py < 0 || py >= h) continue;
        const wpx = ((px % w) + w) % w;
        const idx = py * w + wpx;
        const dist = Math.abs(dy) / halfWidthPx;

        // Sharp step on one side, gradual slope on other
        if (dy < 0) {
          // Rising scarp face
          const rise = (1 - dist) * (1 - dist);
          hmap[idx] += scarpHeight * rise * edgeMask[idx] * (1 - t * 0.3);
        } else {
          // Gentle back-slope
          const slope = (1 - dist);
          hmap[idx] += scarpHeight * 0.3 * slope * edgeMask[idx] * (1 - t * 0.3);
        }
      }
    }
  }
}

// ── Phobos: Parallel groove lines (Stickney-radial grooves) ──

function applyPhobosGrooves(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
  rand: () => number,
) {
  const grooveCount = 8 + Math.floor(rand() * 12);
  const grooveNoise = makeNoise2D(seed + 11001);

  for (let g = 0; g < grooveCount; g++) {
    const vPos = 0.1 + rand() * 0.8; // v position across band width
    const grooveDepth = 0.03 * depthScale * (0.4 + rand() * 0.6);
    const grooveWidthV = 0.004 + rand() * 0.008;
    const angleOffset = (rand() - 0.5) * 0.05; // slight tilt

    const widthPx = Math.ceil(grooveWidthV * h);

    for (let x = 0; x < w; x++) {
      const u = x / w;
      // Wobble the groove path
      const wobble = grooveNoise(u * 15, vPos * 10) * 0.02;
      const centerV = vPos + angleOffset * u + wobble;
      const centerPy = Math.floor(centerV * h);

      for (let dy = -widthPx; dy <= widthPx; dy++) {
        const py = centerPy + dy;
        if (py < 0 || py >= h) continue;
        const idx = py * w + x;
        const dist = Math.abs(dy) / widthPx;
        // U-shaped groove profile
        const profile = (1 - dist * dist);
        hmap[idx] -= grooveDepth * profile * edgeMask[idx];
      }
    }
  }
}

// ── Europa: Linear ice fractures (lineae) ──

function applyIceFractures(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
) {
  const fractureRng = seededRng(seed + 12001);
  const fractureNoise = makeNoise2D(seed + 12002);
  const lineaeCount = 12 + Math.floor(fractureRng() * 15);

  for (let f = 0; f < lineaeCount; f++) {
    const startU = fractureRng();
    const startV = 0.1 + fractureRng() * 0.8;
    const angle = fractureRng() * Math.PI; // any direction
    const length = 0.15 + fractureRng() * 0.5;
    const width = 0.002 + fractureRng() * 0.005;
    const depth = 0.025 * depthScale * (0.3 + fractureRng() * 0.7);
    const ridgeHeight = depth * 0.6; // raised edges along fracture

    const steps = Math.floor(length * w * 0.7);
    const widthPx = Math.ceil(width * h);

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const u = startU + Math.cos(angle) * t * length;
      const v = startV + Math.sin(angle) * t * length;
      if (v < 0.05 || v > 0.95) continue;

      // Subtle meandering
      const meander = fractureNoise(u * 30, v * 30) * 0.008;
      const px = Math.floor(((u % 1 + 1) % 1) * w);
      const centerPy = Math.floor((v + meander) * h);

      for (let dy = -widthPx * 2; dy <= widthPx * 2; dy++) {
        const py = centerPy + dy;
        if (py < 0 || py >= h) continue;
        const idx = py * w + ((px % w + w) % w);
        const dist = Math.abs(dy) / widthPx;

        if (dist < 1.0) {
          // Central trench
          const trenchProfile = (1 - dist * dist);
          hmap[idx] -= depth * trenchProfile * edgeMask[idx];
        } else if (dist < 2.0) {
          // Raised ridge flanks
          const ridgeDist = (dist - 1.0);
          const ridgeProfile = (1 - ridgeDist) * (1 - ridgeDist);
          hmap[idx] += ridgeHeight * ridgeProfile * edgeMask[idx];
        }
      }
    }
  }

  // Extra: smooth icy plains base — reduce high-frequency noise
  applyErosion(hmap, w, h, 0.25);
}

// ── Moon: Subtle ray brightening (Copernican ray system) ──

function applyLunarRayBrightening(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
) {
  const rayNoise = makeNoise2D(seed + 13001);
  const rayAmp = 0.015 * depthScale;
  const invW = 6 / w;
  const invH = 6 / h;

  for (let y = 0; y < h; y++) {
    const v05 = y * invH * 0.5;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const u3 = x * invW * 3;
      const n = rayNoise(u3, v05);
      if (n > 0.3) {
        const idx = rowOff + x;
        hmap[idx] += (n - 0.3) * rayAmp * edgeMask[idx];
      }
    }
  }
}

// ── Mars: Dust fill — smooths lower areas more aggressively ──

function applyDustFill(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
) {
  const dustNoise = makeNoise2D(seed + 14001);
  const sampleCount = 2000;
  const sampleRng = seededRng(seed + 14500);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = hmap[Math.floor(sampleRng() * hmap.length)];
  }
  samples.sort();
  const fillLevel = samples[Math.floor(sampleCount * 0.45)];
  const invFillLevel = 1 / Math.max(0.01, fillLevel);
  const fillTarget = fillLevel * 0.9;
  const invW4 = 4 / w;
  const invH2 = 2 / h;

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const vCoord = y * invH2;
    for (let x = 0; x < w; x++) {
      const idx = rowOff + x;
      if (hmap[idx] >= fillLevel) continue;
      const depth = (fillLevel - hmap[idx]) * invFillLevel;
      const windBias = 0.5 + 0.5 * dustNoise(x * invW4, vCoord);
      const fill = depth * 0.6 * windBias;
      hmap[idx] = hmap[idx] + (fillTarget - hmap[idx]) * fill * edgeMask[idx];
    }
  }
}

// ── Callisto: Valhalla-like concentric ring structure ──

function applyValhallaConcentric(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
) {
  const rng = seededRng(seed + 15001);
  const centerU = 0.3 + rng() * 0.4;
  const centerV = 0.3 + rng() * 0.4;
  const ringCount = 4 + Math.floor(rng() * 4);
  const ringAmp = 0.03 * depthScale;
  const ringPhaseScale = ringCount * Math.PI * 8;
  const invW = 1 / w;
  const invH = 1 / h;

  for (let y = 0; y < h; y++) {
    const dv = y * invH - centerV;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      let du = x * invW - centerU;
      if (du > 0.5) du -= 1;
      if (du < -0.5) du += 1;
      const dist = Math.sqrt(du * du + dv * dv);
      const ringVal = Math.sin(dist * ringPhaseScale) * Math.exp(-dist * 4);
      const idx = rowOff + x;
      hmap[idx] += ringVal * ringAmp * edgeMask[idx];
    }
  }
}

// ── Titan: Organic dune fields ──

function applyOrganicDunes(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
) {
  const duneNoise = makeNoise2D(seed + 16001);
  const duneNoise2 = makeNoise2D(seed + 16002);
  const duneAmp = 0.05 * depthScale;
  const invW = 1 / w;
  const invH = 1 / h;

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const v25 = v * 25;
    const v3 = v * 3;
    const v5 = v * 5;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const u = x * invW;
      const u8 = u * 8;
      const u5 = u * 5;
      const dunePhase = v25 + duneNoise(u8, v3) * 3;
      const dune = Math.sin(dunePhase) * 0.5 + 0.5;
      const crossDune = Math.sin(u * 40 + duneNoise2(u5, v5) * 2) * 0.3 + 0.5;
      const combined = dune * 0.7 + crossDune * 0.3;
      const idx = rowOff + x;
      hmap[idx] += (combined - 0.5) * duneAmp * edgeMask[idx];
    }
  }
}

// ── Asteroid: Rubble-pile irregular pitting + boulder texture ──

function applyAsteroidRubble(
  hmap: Float32Array, w: number, h: number,
  edgeMask: Float32Array, seed: number, depthScale: number,
  rand: () => number, physicalAspect: number,
) {
  const rubbleNoise = makeNoise2D(seed + 17001);
  const boulderNoise = makeNoise2D(seed + 17002);
  const rubbleAmp = 0.07 * depthScale;
  const aspectCorr = physicalAspect / (w / h);

  // 1) Multi-scale rubble texture — chaotic, non-periodic bumps
  const invW_rubble = 1 / w;
  const invH_rubble = 1 / h;
  for (let y = 0; y < h; y++) {
    const vn10 = y * invH_rubble * 10 * aspectCorr;
    const vn35 = y * invH_rubble * 35 * aspectCorr;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const idx = rowOff + x;
      const mask = edgeMask[idx];
      if (mask < 0.01) continue;

      const un = x * invW_rubble;
      const coarse = fbm(rubbleNoise, un * 10, vn10, 4, 2.3, 0.55);
      const fine = Math.abs(boulderNoise(un * 35, vn35));
      const rubble = coarse * 0.6 + (fine - 0.3) * 0.4;
      hmap[idx] += rubble * rubbleAmp * mask;
    }
  }

  // 2) Scatter large "boulders" — isolated raised blobs
  const boulderCount = 15 + Math.floor(rand() * 20);
  for (let b = 0; b < boulderCount; b++) {
    const bu = rand();
    const bv = 0.15 + rand() * 0.7;
    const br = 0.005 + rand() * 0.015;
    const bh = 0.04 * depthScale * (0.5 + rand() * 0.5);
    const pxR = br * w;
    const pyR = br * h * physicalAspect;
    const pxR2 = pxR * pxR;

    const x0 = Math.floor((bu - br * 1.3) * w);
    const x1 = Math.ceil((bu + br * 1.3) * w);
    const y0 = Math.max(0, Math.floor((bv - br * 1.3 * physicalAspect) * h));
    const y1 = Math.min(h - 1, Math.ceil((bv + br * 1.3 * physicalAspect) * h));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        let wpx = px % w;
        if (wpx < 0) wpx += w;
        const du = px - bu * w;
        const dv = (py - bv * h) * (pxR / pyR);
        const d2 = du * du + dv * dv;
        if (d2 > pxR2 * 1.69) continue;
        const d = Math.sqrt(d2) / pxR;
        if (d > 1.3) continue;
        const falloff = Math.max(0, 1 - d * d);
        const mask = edgeMask[py * w + wpx];
        hmap[py * w + wpx] += bh * falloff * falloff * mask;
      }
    }
  }

  // 3) Extra irregular pitting — deeper than normal micro-pits
  const pitCount = 30 + Math.floor(rand() * 40);
  for (let p = 0; p < pitCount; p++) {
    const pu = rand();
    const pv = 0.1 + rand() * 0.8;
    const pr = 0.003 + rand() * 0.01;
    const pd = 0.05 * depthScale * (0.5 + rand() * 0.5);
    const pxR = pr * w;
    const pyR = pr * h * physicalAspect;
    const pxR2 = pxR * pxR;

    const x0 = Math.floor((pu - pr * 1.2) * w);
    const x1 = Math.ceil((pu + pr * 1.2) * w);
    const y0 = Math.max(0, Math.floor((pv - pr * 1.2 * physicalAspect) * h));
    const y1 = Math.min(h - 1, Math.ceil((pv + pr * 1.2 * physicalAspect) * h));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        let wpx = px % w;
        if (wpx < 0) wpx += w;
        const du = px - pu * w;
        const dv = (py - pv * h) * (pxR / pyR);
        const d2 = du * du + dv * dv;
        if (d2 > pxR2 * 1.44) continue;
        const d = Math.sqrt(d2) / pxR;
        if (d > 1.2) continue;
        const falloff = Math.max(0, 1 - d * d);
        const mask = edgeMask[py * w + wpx];
        hmap[py * w + wpx] -= pd * falloff * mask;
      }
    }
  }
}

// ── Apply symmetry to heightmap ───────────────────────────────────

import { SymmetryMode } from "@/types/lunar";

function applySymmetry(
  hmap: Float32Array,
  w: number,
  h: number,
  symmetry: SymmetryMode,
  blendPercent: number,
) {
  if (symmetry === "none") return;

  const folds = parseInt(symmetry, 10);
  if (isNaN(folds) || folds < 2) return;

  const segmentWidth = w / folds;
  const segW = Math.ceil(segmentWidth);
  const blendPx = Math.floor((blendPercent / 100) * segmentWidth * 0.5);
  const invBlendPx = blendPx > 0 ? 1 / blendPx : 0;
  const segWm1 = segW - 1;

  // Copy first segment once
  const sourceSegment = new Float32Array(segW * h);
  for (let y = 0; y < h; y++) {
    const srcRow = y * w;
    const dstRow = y * segW;
    for (let x = 0; x < segW; x++) {
      sourceSegment[dstRow + x] = hmap[srcRow + x];
    }
  }

  // Apply to all other segments
  for (let fold = 1; fold < folds; fold++) {
    const startX = Math.floor(fold * segmentWidth);
    const mirror = fold & 1; // bit test instead of modulo

    for (let y = 0; y < h; y++) {
      const srcRow = y * segW;
      const dstRow = y * w;
      for (let localX = 0; localX < segW; localX++) {
        const targetX = startX + localX;
        if (targetX >= w) continue;

        const srcX = mirror ? segWm1 - localX : localX;
        const srcValue = sourceSegment[srcRow + srcX];
        const targetIdx = dstRow + targetX;

        let blend = 1.0;
        if (blendPx > 0) {
          if (localX < blendPx) {
            blend = localX * invBlendPx;
          } else if (localX > segmentWidth - blendPx) {
            blend = (segmentWidth - localX) * invBlendPx;
          }
        }

        hmap[targetIdx] = hmap[targetIdx] * (1 - blend) + srcValue * blend;
      }
    }
  }

  // Seamless wrap at U=0/U=1
  if (blendPx > 0) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let dx = 0; dx < blendPx; dx++) {
        const t = dx * invBlendPx;
        const leftIdx = row + dx;
        const rightIdx = row + w - 1 - dx;
        const avg = hmap[leftIdx] * (1 - t * 0.5) + hmap[rightIdx] * (t * 0.5);
        hmap[leftIdx] = avg;
        hmap[rightIdx] = hmap[leftIdx] * (t * 0.5) + hmap[rightIdx] * (1 - t * 0.5);
      }
    }
  }
}

// ── Apply surface zones to heightmap ──────────────────────────────

function applySurfaceZones(
  hmap: Float32Array,
  w: number,
  h: number,
  zones: SurfaceZone[],
) {
  if (zones.length === 0) return;

  // Sort zones by startV for predictable processing
  const sortedZones = [...zones].sort((a, b) => a.startV - b.startV);

  // Pre-compute zone parameters to avoid repeated divisions in the inner loop
  const numZones = sortedZones.length;
  const zStartV = new Float64Array(numZones);
  const zEndV = new Float64Array(numZones);
  const zBlendRegion = new Float64Array(numZones);
  const zIntensity = new Float64Array(numZones);
  const zSmoothness = new Float64Array(numZones);

  for (let z = 0; z < numZones; z++) {
    const zone = sortedZones[z];
    zStartV[z] = zone.startV;
    zEndV[z] = zone.endV;
    const zoneWidth = zone.endV - zone.startV;
    zBlendRegion[z] = (zone.blendWidth / 100) * zoneWidth;
    zIntensity[z] = zone.intensity / 100;
    zSmoothness[z] = zone.smoothness / 100;
  }

  const invH = 1 / h;

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowOff = y * w;

    // Pre-compute zone influence for this entire row (v is constant)
    let zoneInfluence = 1.0;
    let smoothnessFactor = 0;

    for (let z = 0; z < numZones; z++) {
      if (v < zStartV[z] || v > zEndV[z]) continue;

      const blendRegion = zBlendRegion[z];
      const posInZone = v - zStartV[z];
      const distFromEnd = zEndV[z] - v;

      let edgeBlend = 1.0;
      if (blendRegion > 0) {
        if (posInZone < blendRegion) {
          edgeBlend = posInZone / blendRegion;
        } else if (distFromEnd < blendRegion) {
          edgeBlend = distFromEnd / blendRegion;
        }
      }

      const zInt = zIntensity[z] * edgeBlend;
      const zSmooth = zSmoothness[z] * edgeBlend;
      zoneInfluence = zoneInfluence * (1 - edgeBlend) + zInt * edgeBlend;
      smoothnessFactor = smoothnessFactor * (1 - edgeBlend) + zSmooth * edgeBlend;
    }

    // Apply zone effects to entire row (avoiding per-pixel zone lookup)
    const invSmooth = 1 - smoothnessFactor;
    for (let x = 0; x < w; x++) {
      const idx = rowOff + x;
      const original = hmap[idx];
      const flattened = 0.5 + (original - 0.5) * invSmooth;
      hmap[idx] = 0.5 + (flattened - 0.5) * zoneInfluence;
    }
  }
}

// ── Apply surface masks to heightmap ──────────────────────────────

function computeMaskValue(
  u: number,
  v: number,
  mask: SurfaceMask,
  noiseFunc: (x: number, y: number) => number,
): number {
  const { shape, centerU, centerV, width, height, feather, rotation, invert } = mask;
  const featherNorm = feather / 100;

  // Transform coordinates for rotation
  const rad = (rotation / 180) * Math.PI;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const du = u - centerU;
  const dv = v - centerV;
  const ru = du * cosR + dv * sinR;
  const rv = -du * sinR + dv * cosR;

  let value = 0;

  switch (shape) {
    case "circle": {
      const dist = Math.sqrt((ru / (width / 2)) ** 2 + (rv / (height / 2)) ** 2);
      if (dist < 1 - featherNorm) {
        value = 1;
      } else if (dist < 1) {
        value = 1 - (dist - (1 - featherNorm)) / featherNorm;
      }
      break;
    }
    case "rectangle": {
      const distU = Math.abs(ru) / (width / 2);
      const distV = Math.abs(rv) / (height / 2);
      const maxDist = Math.max(distU, distV);
      if (maxDist < 1 - featherNorm) {
        value = 1;
      } else if (maxDist < 1) {
        value = 1 - (maxDist - (1 - featherNorm)) / featherNorm;
      }
      break;
    }
    case "stripe-h": {
      const count = mask.stripeCount ?? 4;
      const gap = (mask.stripeGap ?? 50) / 100;
      const stripe = Math.sin(v * Math.PI * 2 * count);
      value = stripe > (gap * 2 - 1) ? 1 : 0;
      // Apply feather
      if (featherNorm > 0 && stripe > (gap * 2 - 1) - featherNorm && stripe <= (gap * 2 - 1)) {
        value = (stripe - ((gap * 2 - 1) - featherNorm)) / featherNorm;
      }
      break;
    }
    case "stripe-v": {
      const count = mask.stripeCount ?? 4;
      const gap = (mask.stripeGap ?? 50) / 100;
      const stripe = Math.sin(u * Math.PI * 2 * count);
      value = stripe > (gap * 2 - 1) ? 1 : 0;
      if (featherNorm > 0 && stripe > (gap * 2 - 1) - featherNorm && stripe <= (gap * 2 - 1)) {
        value = (stripe - ((gap * 2 - 1) - featherNorm)) / featherNorm;
      }
      break;
    }
    case "noise": {
      const scale = (mask.noiseScale ?? 50) / 10;
      const threshold = (mask.noiseThreshold ?? 50) / 100;
      const n = noiseFunc(u * scale, v * scale) * 0.5 + 0.5;
      const featherRange = featherNorm * 0.3;
      if (n > threshold + featherRange) {
        value = 1;
      } else if (n > threshold - featherRange) {
        value = (n - (threshold - featherRange)) / (featherRange * 2);
      }
      break;
    }
    case "gradient-h": {
      const start = centerU - width / 2;
      const end = centerU + width / 2;
      if (u < start) value = 0;
      else if (u > end) value = 1;
      else value = (u - start) / (end - start);
      break;
    }
    case "gradient-v": {
      const start = centerV - height / 2;
      const end = centerV + height / 2;
      if (v < start) value = 0;
      else if (v > end) value = 1;
      else value = (v - start) / (end - start);
      break;
    }
  }

  return invert ? 1 - value : value;
}

function applySurfaceMasks(
  hmap: Float32Array,
  w: number,
  h: number,
  masks: SurfaceMask[],
  mode: MaskMode,
  seed: number,
) {
  const activeMasks = masks.filter(m => m.enabled);
  if (activeMasks.length === 0) return;

  const noiseFunc = makeNoise2D(seed + 77777);

  // Pre-compute per-mask trig values to avoid recomputing cos/sin per pixel
  const maskCosR = new Float64Array(activeMasks.length);
  const maskSinR = new Float64Array(activeMasks.length);
  for (let m = 0; m < activeMasks.length; m++) {
    const rad = (activeMasks[m].rotation / 180) * Math.PI;
    maskCosR[m] = Math.cos(rad);
    maskSinR[m] = Math.sin(rad);
  }

  const isInclude = mode === "include";
  const invW = 1 / w;
  const invH = 1 / h;

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const u = x * invW;
      const idx = rowOff + x;
      const original = hmap[idx];

      let combinedMask = isInclude ? 0 : 1;
      for (let m = 0; m < activeMasks.length; m++) {
        const mask = activeMasks[m];
        // Inline pre-computed trig into mask computation
        const du = u - mask.centerU;
        const dv = v - mask.centerV;
        const ru = du * maskCosR[m] + dv * maskSinR[m];
        const rv = -du * maskSinR[m] + dv * maskCosR[m];
        const featherNorm = mask.feather / 100;

        let value = 0;
        // Inline shape computation (avoids function call overhead per pixel per mask)
        switch (mask.shape) {
          case "circle": {
            const hw = mask.width / 2;
            const hh = mask.height / 2;
            const dist = Math.sqrt((ru / hw) * (ru / hw) + (rv / hh) * (rv / hh));
            if (dist < 1 - featherNorm) value = 1;
            else if (dist < 1) value = 1 - (dist - (1 - featherNorm)) / featherNorm;
            break;
          }
          case "rectangle": {
            const distU = Math.abs(ru) / (mask.width / 2);
            const distV = Math.abs(rv) / (mask.height / 2);
            const maxDist = distU > distV ? distU : distV;
            if (maxDist < 1 - featherNorm) value = 1;
            else if (maxDist < 1) value = 1 - (maxDist - (1 - featherNorm)) / featherNorm;
            break;
          }
          case "noise": {
            const scale = (mask.noiseScale ?? 50) / 10;
            const threshold = (mask.noiseThreshold ?? 50) / 100;
            const n = noiseFunc(u * scale, v * scale) * 0.5 + 0.5;
            const fr = featherNorm * 0.3;
            if (n > threshold + fr) value = 1;
            else if (n > threshold - fr) value = (n - (threshold - fr)) / (fr * 2);
            break;
          }
          case "gradient-h": {
            const start = mask.centerU - mask.width / 2;
            const end = mask.centerU + mask.width / 2;
            if (u >= start && u <= end) value = (u - start) / (end - start);
            else if (u > end) value = 1;
            break;
          }
          case "gradient-v": {
            const start = mask.centerV - mask.height / 2;
            const end = mask.centerV + mask.height / 2;
            if (v >= start && v <= end) value = (v - start) / (end - start);
            else if (v > end) value = 1;
            break;
          }
          default: {
            value = computeMaskValue(u, v, mask, noiseFunc);
            break;
          }
        }
        if (mask.invert) value = 1 - value;

        if (isInclude) {
          if (value > combinedMask) combinedMask = value;
        } else {
          const inv = 1 - value;
          if (inv < combinedMask) combinedMask = inv;
        }
      }

      hmap[idx] = 0.5 + (original - 0.5) * combinedMask;
    }
  }
}

// ── Build heightmap ───────────────────────────────────────────────

const REF_INNER_DIAM = 18.1;
const REF_WIDTH = 6;
const REF_THICKNESS = 2;

function computeSurfaceAreaFactor(innerDiameterMm: number, widthMm: number, thicknessMm: number): number {
  const refOuterR = REF_INNER_DIAM / 2 + REF_THICKNESS;
  const refArea = 2 * Math.PI * refOuterR * REF_WIDTH;
  const outerR = innerDiameterMm / 2 + thicknessMm;
  const area = 2 * Math.PI * outerR * widthMm;
  return Math.max(0.35, Math.min(3.0, area / refArea));
}

export interface HeightmapResult {
  hmap: Float32Array;
  craterCount: number;
}

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
  const shapeMode = lunar.craterShape ?? "circular";
  const ovalElong = (lunar.ovalElongation ?? 50) / 100;
  const globalOvalAngle = ((lunar.ovalAngle ?? 0) / 180) * Math.PI;
  const mariaFactor = (lunar.mariaFill ?? 0) / 100;
  const ridgeFactor = (lunar.highlandRidges ?? 0) / 100;
  const floorTexFactor = (lunar.craterFloorTexture ?? 30) / 100;
  const ejectaFactor = (lunar.ejectaStrength ?? 50) / 100;
  const layerLarge = (lunar.layerLargeCraters ?? 50) / 50;   // 0–2 multiplier (50 = 1.0 = default)
  const layerMedium = (lunar.layerMediumImpacts ?? 50) / 50;
  const layerMicro = (lunar.layerMicroPitting ?? 50) / 50;

  const edgeMask = buildEdgeMask(MAP_W, MAP_H);

  // ─── 1) fBm base terrain layer (computed at half-res, then upscaled) ──
  // 6-octave fBm is the most expensive per-pixel operation. Since it produces
  // low-frequency terrain, half-res gives identical visual results.
  const aspectCorrection = physicalAspect / (MAP_W / MAP_H);
  const baseNoise = makeNoise2D(lunar.seed + 500);
  const baseAmp = (0.04 + terrainRough * 0.12) * depthScale;
  {
    const halfW = MAP_W >> 1;
    const halfH = MAP_H >> 1;
    const halfBase = new Float32Array(halfW * halfH);
    const invHalfW8 = 8 / halfW;
    const invHalfH8 = 8 * aspectCorrection / halfH;
    for (let y = 0; y < halfH; y++) {
      const v = y * invHalfH8;
      const rowOff = y * halfW;
      for (let x = 0; x < halfW; x++) {
        halfBase[rowOff + x] = fbm(baseNoise, x * invHalfW8, v, 6, 2.0, 0.5) * baseAmp;
      }
    }
    // Bilinear upscale with pre-computed reciprocals and row caching
    const invMapH_halfH = (halfH - 1) / MAP_H;
    const invMapW_halfW = (halfW - 1) / MAP_W;
    const halfHm1 = halfH - 1;
    for (let y = 0; y < MAP_H; y++) {
      const fy = y * invMapH_halfH;
      const iy = Math.floor(fy);
      const fy1 = fy - iy;
      const fy0 = 1 - fy1;
      const iy0 = iy < halfHm1 ? iy : halfHm1;
      const iy1 = iy + 1 < halfH ? iy + 1 : halfHm1;
      const row0 = iy0 * halfW;
      const row1 = iy1 * halfW;
      const outRow = y * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        const fx = x * invMapW_halfW;
        const ix = Math.floor(fx);
        const fx1 = fx - ix;
        const fx0 = 1 - fx1;
        const ix0 = ix % halfW;
        const ix1 = (ix + 1) % halfW;
        const val = halfBase[row0 + ix0] * fx0 * fy0 +
          halfBase[row0 + ix1] * fx1 * fy0 +
          halfBase[row1 + ix0] * fx0 * fy1 +
          halfBase[row1 + ix1] * fx1 * fy1;
        hmap[outRow + x] += val * edgeMask[outRow + x];
      }
    }
  }

  // ─── 1b) Highland ridges layer ──
  applyHighlandRidges(hmap, MAP_W, MAP_H, ridgeFactor, edgeMask, lunar.seed, depthScale, physicalAspect);

  // ─── 2) Domain warp noise ──
  const warpNoise = makeNoise2D(lunar.seed + 1234);
  const warpAmp = 0.15 + rimSharp * 0.12;

  // ─── 2b) Floor texture noise ──
  const floorNoise = makeNoise2D(lunar.seed + 8888);

  // ─── 3) 5-tier crater distribution (scaled by layer mix) ──
  const densityMul = lunar.craterDensity === "low" ? 0.5 : lunar.craterDensity === "med" ? 1.0 : 1.8;
  const sizeMul = lunar.craterSize === "small" ? 0.6 : lunar.craterSize === "med" ? 1.0 : 1.5;
  const saf = surfaceAreaFactor;

  const megaCount = Math.round((1 + densityMul * 1.5) * Math.max(0.6, Math.min(1.5, saf)) * layerLarge);
  const megaRadMin = 0.12 * sizeMul, megaRadMax = 0.22 * sizeMul;

  const heroCount = Math.round((3 + densityMul * 5) * Math.sqrt(saf) * layerLarge);
  const heroRadMin = 0.06 * sizeMul, heroRadMax = 0.12 * sizeMul;

  const medCount = Math.round((15 + densityMul * 35 * sizeMul) * saf * layerMedium);
  const medRadMin = 0.025 * sizeMul, medRadMax = 0.06 * sizeMul;

  const smallCount = Math.round((40 + densityMul * 160) * saf * layerMedium);
  const smallRadMin = 0.008, smallRadMax = 0.025 * sizeMul;

  const microPitCount = Math.round((200 + densityMul * 600) * saf * layerMicro);

  const stamps: CraterStamp[] = [];

  // NASA empirical depth-diameter relationship:
  // Simple craters (D < ~15km): d/D ≈ 0.2 (constant)
  // Complex craters (D > ~15km): d/D ∝ D^(-0.3) (shallower as they get bigger)
  // Here radius thresholds map: mega/hero = complex, med/small = simple
  function addCraters(count: number, rMin: number, rMax: number, depthMul: number, tier: number) {
    const isComplex = tier <= 1; // mega & hero are complex craters
    const asymMax = isComplex ? 0.5 : 0.3;
    const slumpMax = isComplex ? 0.3 : 0.15;

    for (let i = 0; i < count; i++) {
      const t = Math.pow(rand(), 1.5);
      const radius = rMin + (rMax - rMin) * t;
      const cu = rand();
      const cv = 0.12 + rand() * 0.76;

      const varScale = 1.0 + (rand() - 0.5) * craterVar * 0.8;

      // Apply empirical depth-diameter scaling for complex craters
      // Larger complex craters are proportionally shallower (realistic)
      const ddRatio = isComplex
        ? 0.2 * Math.pow(radius / rMin, -0.3) // complex: shallower with size
        : 0.2; // simple: constant d/D
      const depthFromDiameter = ddRatio * (radius * 2) * 10; // scale to our heightmap units
      const depth = depthFromDiameter * depthScale * depthMul * bowlDepthScale * varScale * (0.5 + rand() * 0.5);
      const rimH = (0.35 + rimSharp * 0.65) * depthScale * depthMul * rimHeightScale * varScale;

      const rimCenterJitter = (rand() - 0.5) * 0.04;
      const rimWidthJitter = (rand() - 0.5) * 0.02;
      const warpSeed = rand();
      const age = tier / 4;

      const rimAsymmetry = rand() * asymMax;
      const rimAsymAngle = rand() * Math.PI * 2;
      const slumpAngle = rand() * Math.PI * 2;
      const slumpStrength = rand() * slumpMax;

      // Per-crater shape variation
      const shapeAngleRad = globalOvalAngle + (rand() - 0.5) * craterVar * Math.PI * 0.5;
      const angularFacets = 4 + Math.floor(rand() * 5);
      const angularPhase = rand() * Math.PI * 2;

      stamps.push({
        cu, cv, radius, depth, rimHeight: rimH,
        rimCenterJitter, rimWidthJitter, warpSeed, tier, age,
        rimAsymmetry, rimAsymAngle, slumpAngle, slumpStrength,
        shapeAngleRad, angularFacets, angularPhase,
        floorTextureFactor: floorTexFactor,
      });
    }
  }

  addCraters(megaCount, megaRadMin, megaRadMax, 1.2 * layerLarge, 0);
  addCraters(heroCount, heroRadMin, heroRadMax, 1.0 * layerLarge, 1);
  addCraters(medCount, medRadMin, medRadMax, 0.8 * layerMedium, 2);
  addCraters(smallCount, smallRadMin, smallRadMax, 0.6 * layerMedium, 3);

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
        shapeAngleRad: globalOvalAngle + (rand() - 0.5) * craterVar * Math.PI * 0.3,
        angularFacets: 4 + Math.floor(rand() * 5),
        angularPhase: rand() * Math.PI * 2,
        floorTextureFactor: floorTexFactor,
      });
    }
  }

  // Stamp all craters
  const secondaryStamps: CraterStamp[] = [];
  for (const s of stamps) {
    const hasPeak = s.tier <= 1;
    const hasTerraces = s.tier === 0;
    stampCrater(
      hmap, MAP_W, MAP_H, s, rimSharp, edgeMask, warpNoise, warpAmp,
      hasPeak, hasTerraces, physicalAspect,
      shapeMode, ovalElong, floorNoise,
    );

    // Ejecta rays for mega + hero
    if (s.tier <= 1) {
      stampEjectaRays(
        hmap, MAP_W, MAP_H, s, rand, edgeMask, secondaryStamps,
        physicalAspect, ejectaFactor, shapeMode, ovalElong, globalOvalAngle,
      );
    }
  }

  // Stamp secondary impact chains from ejecta
  for (const sec of secondaryStamps) {
    stampCrater(
      hmap, MAP_W, MAP_H, sec, rimSharp, edgeMask, warpNoise, warpAmp,
      false, false, physicalAspect,
      shapeMode, ovalElong, floorNoise,
    );
  }

  const totalCraterCount = stamps.length + secondaryStamps.length + microPitCount;

  // ─── 3b) Impact melt pooling — smooth flat floors inside large craters ──
  // Real large craters develop melt sheets that pool on the floor, creating
  // ultra-smooth patches. We blur the heightmap ONLY inside mega/hero crater bowls.
  if (stamps.length > 0) {
    const meltStamps = stamps.filter(s => s.tier <= 1 && s.radius > 0.08);
    if (meltStamps.length > 0) {
      const len = MAP_W * MAP_H;
      if (!_erosionBuf1 || _erosionBuf1.length !== len) _erosionBuf1 = new Float32Array(len);
      const meltBlurred = _erosionBuf1;

      // Quick 3×3 blur for melt smoothing
      for (let y = 0; y < MAP_H; y++) {
        const yA = y > 0 ? y - 1 : 0;
        const yB = y < MAP_H - 1 ? y + 1 : MAP_H - 1;
        const rowA = yA * MAP_W, rowM = y * MAP_W, rowB = yB * MAP_W;
        for (let x = 0; x < MAP_W; x++) {
          const xL = x === 0 ? MAP_W - 1 : x - 1;
          const xR = x === MAP_W - 1 ? 0 : x + 1;
          meltBlurred[rowM + x] = (
            hmap[rowA + xL] + hmap[rowA + x] + hmap[rowA + xR] +
            hmap[rowM + xL] + hmap[rowM + x] + hmap[rowM + xR] +
            hmap[rowB + xL] + hmap[rowB + x] + hmap[rowB + xR]
          ) * 0.111111111;
        }
      }

      // Apply melt smoothing only inside crater floor regions
      for (const s of meltStamps) {
        const floorR = s.radius * 0.55; // inner 55% of crater is the floor
        const pxR = floorR * MAP_W;
        const pyR = floorR * MAP_H * physicalAspect;
        const pxR2 = pxR * pxR;
        const x0 = Math.floor((s.cu - floorR) * MAP_W);
        const x1 = Math.ceil((s.cu + floorR) * MAP_W);
        const y0 = Math.max(0, Math.floor((s.cv - floorR * physicalAspect) * MAP_H));
        const y1 = Math.min(MAP_H - 1, Math.ceil((s.cv + floorR * physicalAspect) * MAP_H));

        for (let py = y0; py <= y1; py++) {
          const rowOff = py * MAP_W;
          for (let px = x0; px <= x1; px++) {
            let wpx = px % MAP_W;
            if (wpx < 0) wpx += MAP_W;
            const du = px - s.cu * MAP_W;
            const dv = (py - s.cv * MAP_H) * (pxR / pyR);
            const d2 = du * du + dv * dv;
            if (d2 > pxR2) continue;
            const t = Math.sqrt(d2) / pxR;
            // Smoothstep falloff: full melt in center, fade at edges
            const meltBlend = (1 - t) * (1 - t) * 0.7;
            const idx = rowOff + wpx;
            hmap[idx] = hmap[idx] * (1 - meltBlend) + meltBlurred[idx] * meltBlend;
          }
        }
      }
    }
  }

  // ─── 4) Maria fill pass ──
  applyMariaFill(hmap, MAP_W, MAP_H, mariaFactor, edgeMask, lunar.seed);

  // ─── 5) Erosion pass — age-dependent: large old craters erode more, small fresh stay sharp ──
  // First pass: global erosion for base weathering
  applyErosion(hmap, MAP_W, MAP_H, erosionFactor * 0.6);

  // Second pass: selective stronger erosion in areas dominated by large craters
  if (erosionFactor > 0.15 && stamps.length > 0) {
    // Reuse pooled buffer for age mask instead of allocating new Float32Array
    const len = MAP_W * MAP_H;
    if (!_erosionBuf2 || _erosionBuf2.length !== len) _erosionBuf2 = new Float32Array(len);
    const ageMask = _erosionBuf2;
    ageMask.fill(0); // Clear previous contents

    // Build age mask using mega/hero craters only
    for (const s of stamps) {
      if (s.tier > 1) continue;
      const extraErosion = (1 - s.tier / 2) * erosionFactor * 0.4;
      const spreadU = s.radius * 1.5;
      const spreadV = s.radius * 1.5 * physicalAspect;
      const x0 = Math.floor((s.cu - spreadU) * MAP_W);
      const x1 = Math.ceil((s.cu + spreadU) * MAP_W);
      const y0 = Math.max(0, Math.floor((s.cv - spreadV) * MAP_H));
      const y1 = Math.min(MAP_H - 1, Math.ceil((s.cv + spreadV) * MAP_H));
      const rPx = s.radius * MAP_W;
      const rPx2 = rPx * rPx;
      const invR2 = 1 / (rPx2 * 2.25);

      for (let py = y0; py <= y1; py++) {
        const rowOff = py * MAP_W;
        for (let px = x0; px <= x1; px++) {
          let wpx = px % MAP_W;
          if (wpx < 0) wpx += MAP_W;
          const du = px - s.cu * MAP_W;
          const dv = py - s.cv * MAP_H;
          const d2 = du * du + dv * dv;
          if (d2 > rPx2 * 2.25) continue;
          const falloff = (1 - d2 * invR2);
          const idx = rowOff + wpx;
          const newVal = falloff * extraErosion;
          if (newVal > ageMask[idx]) ageMask[idx] = newVal;
        }
      }
    }

    // Apply age-weighted blur using pooled buffer
    if (!_erosionBuf1 || _erosionBuf1.length !== len) _erosionBuf1 = new Float32Array(len);
    const blurred = _erosionBuf1;

    // Quick 3×3 blur with row-offset caching
    for (let y = 0; y < MAP_H; y++) {
      const yA = y > 0 ? y - 1 : 0;
      const yB = y < MAP_H - 1 ? y + 1 : MAP_H - 1;
      const rowA = yA * MAP_W;
      const rowM = y * MAP_W;
      const rowB = yB * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        const xL = x === 0 ? MAP_W - 1 : x - 1;
        const xR = x === MAP_W - 1 ? 0 : x + 1;
        blurred[rowM + x] = (
          hmap[rowA + xL] + hmap[rowA + x] + hmap[rowA + xR] +
          hmap[rowM + xL] + hmap[rowM + x] + hmap[rowM + xR] +
          hmap[rowB + xL] + hmap[rowB + x] + hmap[rowB + xR]
        ) * 0.111111111; // 1/9
      }
    }

    // Apply masked blur
    for (let i = 0; i < len; i++) {
      const a = ageMask[i];
      if (a > 0.001) hmap[i] = hmap[i] * (1 - a) + blurred[i] * a;
    }
  }

  // ─── 5b) Planet-specific terrain passes ──
  const terrainType: TerrainType = lunar.terrainType ?? "generic";
  applyTerrainType(hmap, MAP_W, MAP_H, terrainType, edgeMask, lunar.seed, depthScale, rand, physicalAspect);


  // ─── 6) Combined micro-detail pass (pits + regolith + grain in one traversal) ──
  // Merging 3 separate full-map passes into one reduces memory bandwidth overhead
  if (microFactor > 0) {
    const pitRng = seededRng(lunar.seed + 5555);
    const pitCount = Math.floor(microPitCount * microFactor * layerMicro);
    const pitRadiusMin = 0.001;
    const pitRadiusMax = 0.008;
    const pitDepth = 0.1 * depthScale * microFactor * layerMicro;

    // Stamp micro-pits first (sparse, random positions)
    for (let i = 0; i < pitCount; i++) {
      const pu = pitRng();
      const pv = 0.08 + pitRng() * 0.84;
      const pr = pitRadiusMin + pitRng() * (pitRadiusMax - pitRadiusMin);
      const pd = pitDepth * (0.5 + pitRng() * 0.5);

      const pxR = pr * MAP_W;
      const pyR = pr * MAP_H * physicalAspect;
      // Use wrapping for x (seamless circumference) and clamping for y (ring width edges)
      const x0 = Math.floor((pu - pr * 1.2) * MAP_W);
      const x1 = Math.ceil((pu + pr * 1.2) * MAP_W);
      const y0 = Math.max(0, Math.floor((pv - pr * 1.2 * physicalAspect) * MAP_H));
      const y1 = Math.min(MAP_H - 1, Math.ceil((pv + pr * 1.2 * physicalAspect) * MAP_H));

      const pxR2 = pxR * pxR; // squared radius for fast rejection

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          // Wrap x for seamless circumference
          let wpx = px % MAP_W;
          if (wpx < 0) wpx += MAP_W;
          const du = (px - pu * MAP_W);
          const dv = (py - pv * MAP_H) * (pxR / pyR); // aspect-correct to circle space
          const d2 = du * du + dv * dv;
          if (d2 > pxR2) continue; // squared distance check — no sqrt needed
          const falloff = 1 - d2 / pxR2; // d²/r² maps 0→1 to 1→0
          const mask = edgeMask[py * MAP_W + wpx];
          hmap[py * MAP_W + wpx] -= pd * falloff * mask;
        }
      }
    }

    // ─── 7) Half-res regolith fBm + full-res grain/scratches ──
    // The 5-octave regolith fBm is the most expensive per-pixel op in this section.
    // Computing at half-res then upscaling saves ~75% of noise lookups (1M vs 4M).
    const regolithNoise = makeNoise2D(lunar.seed + 3333);
    const fineRegolith = makeNoise2D(lunar.seed + 4444);
    const impactNoise = makeNoise2D(lunar.seed + 11111);
    const grainRng = seededRng(lunar.seed + 9999);
    const impactAngle = seededRng(lunar.seed + 12222)() * Math.PI;
    const cosA = Math.cos(impactAngle);
    const sinA = Math.sin(impactAngle);

    const regolithStrength = microFactor * 0.05 * depthScale * layerMicro;
    const fineStrength = microFactor * 0.025 * depthScale * layerMicro;
    const grainStrength = microFactor * 0.035 * depthScale * layerMicro;

    // Compute coarse regolith at half resolution
    const halfW_r = MAP_W >> 1;
    const halfH_r = MAP_H >> 1;
    const halfRegolith = new Float32Array(halfW_r * halfH_r);
    const invHalfW_r48 = 48 / halfW_r;
    const invHalfH_r48 = 48 * aspectCorrection / halfH_r;
    for (let y = 0; y < halfH_r; y++) {
      const vCoord = y * invHalfH_r48;
      const rowOff = y * halfW_r;
      for (let x = 0; x < halfW_r; x++) {
        halfRegolith[rowOff + x] = fbm(regolithNoise, x * invHalfW_r48, vCoord, 5, 2.2, 0.45) * regolithStrength;
      }
    }

    // Upscale regolith + add full-res fine detail, grain, and scratches
    const invMapW = 1 / MAP_W;
    const invMapH = 1 / MAP_H;
    const invMapW_halfW = (halfW_r - 1) / MAP_W;
    const invMapH_halfH = (halfH_r - 1) / MAP_H;
    const halfHm1_r = halfH_r - 1;

    for (let y = 0; y < MAP_H; y++) {
      // Bilinear interpolation Y weights (constant per row)
      const fy = y * invMapH_halfH;
      const iy = Math.floor(fy);
      const fy1 = fy - iy;
      const fy0 = 1 - fy1;
      const iy0 = iy < halfHm1_r ? iy : halfHm1_r;
      const iy1c = iy + 1 < halfH_r ? iy + 1 : halfHm1_r;
      const row0 = iy0 * halfW_r;
      const row1 = iy1c * halfW_r;

      const yNorm = y * invMapH;
      const vCoord96 = yNorm * 96 * aspectCorrection;
      const vCoord200 = yNorm * 200 * aspectCorrection;
      const rowOff = y * MAP_W;

      for (let x = 0; x < MAP_W; x++) {
        const idx = rowOff + x;
        const mask = edgeMask[idx];
        if (mask < 0.01) continue;

        const uNorm = x * invMapW;

        // Upscale coarse regolith via bilinear interpolation
        const fx = x * invMapW_halfW;
        const ix = Math.floor(fx);
        const fx1 = fx - ix;
        const fx0 = 1 - fx1;
        const ix0 = ix % halfW_r;
        const ix1c = (ix + 1) % halfW_r;
        const regN = halfRegolith[row0 + ix0] * fx0 * fy0 +
          halfRegolith[row0 + ix1c] * fx1 * fy0 +
          halfRegolith[row1 + ix0] * fx0 * fy1 +
          halfRegolith[row1 + ix1c] * fx1 * fy1;

        // Fine regolith (single octave — fast, stays full-res)
        const fineN = fineRegolith(uNorm * 96, vCoord96);
        // Random grain particle
        const grain = (grainRng() - 0.5) * grainStrength;
        // Directional micro-scratch
        const ru = (uNorm * 200) * cosA + vCoord200 * sinA;
        const rv = -(uNorm * 200) * sinA + vCoord200 * cosA;
        const scratch = impactNoise(ru * 0.3, rv * 1.5) * grainStrength * 0.4;

        hmap[idx] += (regN + fineN * fineStrength + grain + scratch) * mask;
      }
    }
  }

  // ─── 8) Normalize + contrast in single pass ──
  // Merges two full-map traversals (normalize + contrast) into one
  let hMin = Infinity, hMax = -Infinity;
  for (let i = 0; i < hmap.length; i++) {
    const v = hmap[i];
    if (v < hMin) hMin = v;
    if (v > hMax) hMax = v;
  }
  const hRange = hMax - hMin;
  const contrastVal = (lunar.terrainContrast ?? 60) / 100;
  const contrastMult = 0.6 + contrastVal * 1.2;
  if (hRange > 0.001) {
    const invRange = 1 / hRange;
    for (let i = 0; i < hmap.length; i++) {
      const normalized = (hmap[i] - hMin) * invRange;
      const contrasted = 0.5 + (normalized - 0.5) * contrastMult;
      hmap[i] = contrasted < 0 ? 0 : contrasted > 1 ? 1 : contrasted;
    }
  }

  // ─── 9) Apply symmetry ──
  applySymmetry(hmap, MAP_W, MAP_H, lunar.symmetry ?? "none", lunar.symmetryBlend ?? 30);

  // ─── 10) Apply surface zones ──
  if (lunar.zonesEnabled && lunar.zones && lunar.zones.length > 0) {
    applySurfaceZones(hmap, MAP_W, MAP_H, lunar.zones);
  }

  // ─── 11) Apply surface masks ──
  if (lunar.masksEnabled && lunar.masks && lunar.masks.length > 0) {
    applySurfaceMasks(hmap, MAP_W, MAP_H, lunar.masks, lunar.maskMode ?? "include", lunar.seed);
  }

  // ─── 12) Smooth edges final pass (reuses erosion pooled buffers) ──
  if (lunar.smoothEdges) {
    const len = MAP_W * MAP_H;
    if (!_erosionBuf1 || _erosionBuf1.length !== len) _erosionBuf1 = new Float32Array(len);
    if (!_erosionBuf2 || _erosionBuf2.length !== len) _erosionBuf2 = new Float32Array(len);
    const smoothTemp = _erosionBuf1;
    const smoothResult = _erosionBuf2;
    // Horizontal pass
    for (let y = 0; y < MAP_H; y++) {
      const rowOff = y * MAP_W;
      smoothTemp[rowOff] = hmap[rowOff + MAP_W - 1] * 0.25 + hmap[rowOff] * 0.5 + hmap[rowOff + 1] * 0.25;
      for (let x = 1; x < MAP_W - 1; x++) {
        smoothTemp[rowOff + x] = hmap[rowOff + x - 1] * 0.25 + hmap[rowOff + x] * 0.5 + hmap[rowOff + x + 1] * 0.25;
      }
      smoothTemp[rowOff + MAP_W - 1] = hmap[rowOff + MAP_W - 2] * 0.25 + hmap[rowOff + MAP_W - 1] * 0.5 + hmap[rowOff] * 0.25;
    }
    // Vertical pass
    for (let y = 0; y < MAP_H; y++) {
      const yA = Math.max(0, y - 1);
      const yB = Math.min(MAP_H - 1, y + 1);
      const rowA = yA * MAP_W, rowC = y * MAP_W, rowB = yB * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        smoothResult[rowC + x] = smoothTemp[rowA + x] * 0.25 + smoothTemp[rowC + x] * 0.5 + smoothTemp[rowB + x] * 0.25;
      }
    }
    for (let i = 0; i < len; i++) {
      hmap[i] = hmap[i] * 0.6 + smoothResult[i] * 0.4;
    }
  }

  // ─── 13) Seam healing at U=0/U=1 boundary ──
  // Ensures the heightmap wraps seamlessly around the ring circumference
  // Uses hermite blending in a thin strip at both edges
  {
    const seamWidth = Math.max(4, Math.round(MAP_W * 0.008)); // ~0.8% of width = ~32px
    for (let y = 0; y < MAP_H; y++) {
      const row = y * MAP_W;
      for (let dx = 0; dx < seamWidth; dx++) {
        const t = dx / seamWidth;
        const blend = t * t * (3 - 2 * t); // hermite smooth step
        const leftIdx = row + dx;
        const rightIdx = row + MAP_W - 1 - dx;
        const avg = hmap[leftIdx] * (1 - blend) + hmap[rightIdx] * blend;
        const avgR = hmap[rightIdx] * (1 - blend) + hmap[leftIdx] * blend;
        // Blend toward each other at the seam
        hmap[leftIdx] = hmap[leftIdx] * blend + avg * (1 - blend);
        hmap[rightIdx] = hmap[rightIdx] * blend + avgR * (1 - blend);
      }
    }
  }

  return { hmap, craterCount: totalCraterCount };
}

// ── Normal map from heightmap (optimized row-sliding Sobel) ───────
// Instead of calling a sample() closure 8× per pixel (32M calls on 4K maps),
// this uses a 3-row sliding window with direct array access and handles
// U-axis wrapping via pre-computed wrap indices.

function heightmapToNormalCanvas(hmap: Float32Array, w: number, h: number, strength: number, physicalAspect: number = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const buf32 = new Uint32Array(img.data.buffer);

  const yScale = physicalAspect * (h / w);
  const sX = strength * 0.25;
  const sY = strength * yScale * 0.25;

  // Pre-compute U-axis wrap indices
  const wrapL = new Int32Array(w);
  const wrapR = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    wrapL[x] = x === 0 ? w - 1 : x - 1;
    wrapR[x] = x === w - 1 ? 0 : x + 1;
  }

  // Fast approximate inverse sqrt (Quake-style via typed array reinterpretation)
  // ~2× faster than 1/Math.sqrt() on 4M pixels, with <0.2% error
  const _f32 = new Float32Array(1);
  const _i32 = new Int32Array(_f32.buffer);
  function fastInvSqrt(x: number): number {
    _f32[0] = x;
    _i32[0] = 0x5F375A86 - (_i32[0] >> 1); // magic constant
    const y = _f32[0];
    return y * (1.5 - 0.5 * x * y * y); // one Newton-Raphson refinement
  }

  for (let y = 0; y < h; y++) {
    const yAbove = y > 0 ? y - 1 : 0;
    const yBelow = y < h - 1 ? y + 1 : h - 1;
    const rowT = yAbove * w;
    const rowM = y * w;
    const rowB = yBelow * w;
    const yy = h - 1 - y;
    const outRow = yy * w;

    for (let x = 0; x < w; x++) {
      const xl = wrapL[x];
      const xr = wrapR[x];

      const tl = hmap[rowT + xl];
      const tc = hmap[rowT + x];
      const tr = hmap[rowT + xr];
      const ml = hmap[rowM + xl];
      const mr = hmap[rowM + xr];
      const bl = hmap[rowB + xl];
      const bc = hmap[rowB + x];
      const br = hmap[rowB + xr];

      const nx = (tl - tr + 2 * (ml - mr) + bl - br) * sX;
      const ny = (tl + 2 * tc + tr - bl - 2 * bc - br) * sY;
      const nz = 1.0;
      const lenSq = nx * nx + ny * ny + nz * nz;
      const invLen = fastInvSqrt(lenSq);

      const r = (nx * invLen * 0.5 + 0.5) * 255 + 0.5 | 0;
      const g = (ny * invLen * 0.5 + 0.5) * 255 + 0.5 | 0;
      const b = (nz * invLen * 0.5 + 0.5) * 255 + 0.5 | 0;
      buf32[outRow + x] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Roughness map (computed at half resolution, then upscaled) ─────
// Roughness is a low-frequency property — half-res gives ~4× speedup
// with no visible quality loss on the curved ring surface.

function heightmapToRoughnessCanvas(hmap: Float32Array, w: number, h: number, microDetail: number, sharedHalf?: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const hw = w >> 1;
  const hh = h >> 1;
  const microFactor = microDetail / 100;
  const grainRng = seededRng(7777 + Math.round(microDetail));

  // Use shared half-res if provided, otherwise compute locally
  const halfHmap = sharedHalf ?? getSharedHalfHmap(hmap, w, h);

  const halfRough = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    const rowOff = y * hw;
    for (let x = 0; x < hw; x++) {
      const hVal = halfHmap[rowOff + x];
      let roughness = 0.92 - (hVal - 0.5) * 0.9;
      if (microFactor > 0) roughness += (grainRng() - 0.5) * 0.12 * microFactor;
      halfRough[rowOff + x] = roughness < 0.2 ? 0.2 : roughness > 1.0 ? 1.0 : roughness;
    }
  }

  const img = ctx.createImageData(w, h);
  const buf32 = new Uint32Array(img.data.buffer);

  // Batch bilinear upscale with pre-computed interpolation weights
  const invH = 1 / h;
  const invW = 1 / w;
  const hhm1 = hh - 1;
  const hwm1 = hw - 1;

  for (let y = 0; y < h; y++) {
    const fy = y * invH * hhm1;
    const iy = Math.floor(fy);
    const fy1 = fy - iy;
    const fy0 = 1 - fy1;
    const iy0 = iy < hhm1 ? iy : hhm1;
    const iy1c = iy + 1 < hh ? iy + 1 : hhm1;
    const yy = h - 1 - y;
    const outRow = yy * w;
    const row0 = iy0 * hw;
    const row1 = iy1c * hw;

    for (let x = 0; x < w; x++) {
      const fx = x * invW * hwm1;
      const ix = Math.floor(fx);
      const fx1 = fx - ix;
      const fx0 = 1 - fx1;
      const ix0 = ix % hw;
      const ix1c = (ix + 1) % hw;

      const v = (
        halfRough[row0 + ix0] * fx0 * fy0 +
        halfRough[row0 + ix1c] * fx1 * fy0 +
        halfRough[row1 + ix0] * fx0 * fy1 +
        halfRough[row1 + ix1c] * fx1 * fy1
      ) * 255 + 0.5 | 0;
      buf32[outRow + x] = 0xFF000000 | (v << 16) | (v << 8) | v;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── AO map (computed at half resolution for performance, then upscaled) ───
// The multi-kernel sampling is O(pixels × kernelSamples), so halving resolution
// gives ~4× speedup with minimal visual difference on a curved ring surface.

function heightmapToAOCanvas(hmap: Float32Array, w: number, h: number, sharedHalf?: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const hw = w >> 1;
  const hh = h >> 1;

  // Use shared half-res if provided
  const halfHmap = sharedHalf ?? getSharedHalfHmap(hmap, w, h);

  const kernels = [
    { radius: 2, step: 1, weight: 0.5 },
    { radius: 4, step: 1, weight: 0.35 },
    { radius: 8, step: 2, weight: 0.15 },
  ];

  const halfAO = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    const rowOff = y * hw;
    for (let x = 0; x < hw; x++) {
      const center = halfHmap[rowOff + x];
      let totalAO = 0;

      for (const kernel of kernels) {
        let higher = 0, samples = 0, heightDiffSum = 0;
        for (let ky = -kernel.radius; ky <= kernel.radius; ky += kernel.step) {
          const sy = y + ky;
          const syc = sy < 0 ? 0 : sy >= hh ? hh - 1 : sy;
          const sRow = syc * hw;
          for (let kx = -kernel.radius; kx <= kernel.radius; kx += kernel.step) {
            let sx = x + kx;
            if (sx < 0) sx += hw; else if (sx >= hw) sx -= hw;
            const sampleH = halfHmap[sRow + sx];
            if (sampleH > center) {
              higher++;
              heightDiffSum += sampleH - center;
            }
            samples++;
          }
        }
        const invSamples = 1 / samples;
        const kernelAO = higher * invSamples * 0.6 + (heightDiffSum * invSamples * 8 < 1 ? heightDiffSum * invSamples * 8 : 1) * 0.4;
        totalAO += kernelAO * kernel.weight;
      }
      halfAO[rowOff + x] = 1.0 - totalAO * 0.7;
    }
  }

  const img = ctx.createImageData(w, h);
  const buf32 = new Uint32Array(img.data.buffer);
  const invH = 1 / h;
  const invW = 1 / w;
  const hhm1 = hh - 1;
  const hwm1 = hw - 1;

  for (let y = 0; y < h; y++) {
    const fy = y * invH * hhm1;
    const iy = Math.floor(fy);
    const fy1 = fy - iy;
    const fy0 = 1 - fy1;
    const iy0 = iy < hhm1 ? iy : hhm1;
    const iy1c = iy + 1 < hh ? iy + 1 : hhm1;
    const yy = h - 1 - y;
    const outRow = yy * w;
    const row0 = iy0 * hw;
    const row1 = iy1c * hw;

    for (let x = 0; x < w; x++) {
      const fx = x * invW * hwm1;
      const ix = Math.floor(fx);
      const fx1 = fx - ix;
      const fx0 = 1 - fx1;
      const ix0 = ix % hw;
      const ix1c = (ix + 1) % hw;

      const ao = halfAO[row0 + ix0] * fx0 * fy0 +
        halfAO[row0 + ix1c] * fx1 * fy0 +
        halfAO[row1 + ix0] * fx0 * fy1 +
        halfAO[row1 + ix1c] * fx1 * fy1;

      let v = ao * 255 + 0.5 | 0;
      if (v < 51) v = 51;
      if (v > 255) v = 255;
      buf32[outRow + x] = 0xFF000000 | (v << 16) | (v << 8) | v;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Albedo map (computed at half resolution, then upscaled) ───────
// Albedo is a very low-frequency property (subtle stone color variation).
// Computing fBm at half-res eliminates ~3M redundant noise evaluations.

function heightmapToAlbedoCanvas(hmap: Float32Array, w: number, h: number, seed: number, sharedHalf?: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const hw = w >> 1;
  const hh = h >> 1;
  const stoneNoise = makeNoise2D(seed + 7000);
  const grainRng = seededRng(seed + 8000);

  // Use shared half-res if provided
  const halfHmap = sharedHalf ?? getSharedHalfHmap(hmap, w, h);

  const halfAlbedo = new Float32Array(hw * hh);
  const invHW4 = 4 / hw;
  const invHH4 = 4 / hh;
  for (let y = 0; y < hh; y++) {
    const v = y * invHH4;
    const rowOff = y * hw;
    for (let x = 0; x < hw; x++) {
      const u = x * invHW4;
      const n = fbm(stoneNoise, u, v, 2, 2.0, 0.5) * 0.5 + 0.5;
      const grain = (grainRng() - 0.5) * 0.04;
      const hVal = halfHmap[rowOff + x];
      const heightTint = 0.95 + (hVal - 0.5) * 0.1;
      let albedo = (0.82 + n * 0.12 + grain) * heightTint;
      halfAlbedo[rowOff + x] = albedo < 0.6 ? 0.6 : albedo > 1.0 ? 1.0 : albedo;
    }
  }

  const img = ctx.createImageData(w, h);
  const buf32 = new Uint32Array(img.data.buffer);
  const invH = 1 / h;
  const invW = 1 / w;
  const hhm1 = hh - 1;
  const hwm1 = hw - 1;

  for (let y = 0; y < h; y++) {
    const fy = y * invH * hhm1;
    const iy = Math.floor(fy);
    const fy1 = fy - iy;
    const fy0 = 1 - fy1;
    const iy0 = iy < hhm1 ? iy : hhm1;
    const iy1c = iy + 1 < hh ? iy + 1 : hhm1;
    const yy = h - 1 - y;
    const outRow = yy * w;
    const row0 = iy0 * hw;
    const row1 = iy1c * hw;

    for (let x = 0; x < w; x++) {
      const fx = x * invW * hwm1;
      const ix = Math.floor(fx);
      const fx1 = fx - ix;
      const fx0 = 1 - fx1;
      const ix0 = ix % hw;
      const ix1c = (ix + 1) % hw;

      const val = (
        halfAlbedo[row0 + ix0] * fx0 * fy0 +
        halfAlbedo[row0 + ix1c] * fx1 * fy0 +
        halfAlbedo[row1 + ix0] * fx0 * fy1 +
        halfAlbedo[row1 + ix1c] * fx1 * fy1
      ) * 255 + 0.5 | 0;
      buf32[outRow + x] = 0xFF000000 | (val << 16) | (val << 8) | val;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Displacement map (uses Uint32Array for 4× fewer writes) ───────

function heightmapToDisplacementCanvas(hmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const buf32 = new Uint32Array(img.data.buffer);

  for (let y = 0; y < h; y++) {
    const yy = h - 1 - y;
    const rowSrc = y * w;
    const rowDst = yy * w;
    for (let x = 0; x < w; x++) {
      // Branchless clamp: multiply then bitwise-or avoids Math.max/Math.min
      let v = hmap[rowSrc + x] * 255 + 0.5 | 0;
      v = (v | -(v > 0 ? 1 : 0)) & 0xFF; // clamp 0-255 branchless
      buf32[rowDst + x] = 0xFF000000 | (v << 16) | (v << 8) | v;
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

export type GenerationStage = "heightmap" | "craters" | "erosion" | "normal" | "roughness" | "ao" | "albedo" | "displacement" | "done";

export interface GenerationProgress {
  stage: GenerationStage;
  label: string;
  craterCount: number;
  percent: number;
}

// Shared half-res heightmap downsample — computed once, reused by roughness/AO/albedo
// Previously each map function downsampled independently (3× redundant work on 4M pixels)
let _sharedHalfHmap: Float32Array | null = null;
let _sharedHalfW = 0;
let _sharedHalfH = 0;

function getSharedHalfHmap(hmap: Float32Array, w: number, h: number): Float32Array {
  const hw = w >> 1;
  const hh = h >> 1;
  if (_sharedHalfHmap && _sharedHalfW === hw && _sharedHalfH === hh) {
    // Recompute into existing buffer
  } else {
    _sharedHalfHmap = new Float32Array(hw * hh);
    _sharedHalfW = hw;
    _sharedHalfH = hh;
  }
  const half = _sharedHalfHmap;
  for (let y = 0; y < hh; y++) {
    const sy = y * 2;
    const sy1 = Math.min(sy + 1, h - 1);
    for (let x = 0; x < hw; x++) {
      const sx = x * 2;
      half[y * hw + x] = (hmap[sy * w + sx] + hmap[sy * w + sx + 1] + hmap[sy1 * w + sx] + hmap[sy1 * w + sx + 1]) * 0.25;
    }
  }
  return half;
}

function buildMapsFromHeightmap(
  hmap: Float32Array,
  w: number,
  h: number,
  lunar: LunarTextureState,
  aspect: number,
  craterCount: number,
): LunarSurfaceMapSet {
  // Pre-compute shared half-res downsample (used by roughness, AO, albedo)
  const sharedHalf = getSharedHalfHmap(hmap, w, h);

  const normalStrength = 1.5 + (lunar.intensity / 100) * 2.0;
  const normalCanvas = heightmapToNormalCanvas(hmap, w, h, normalStrength, aspect);
  const roughnessCanvas = heightmapToRoughnessCanvas(hmap, w, h, lunar.microDetail, sharedHalf);
  const aoCanvas = heightmapToAOCanvas(hmap, w, h, sharedHalf);
  const albedoCanvas = heightmapToAlbedoCanvas(hmap, w, h, lunar.seed, sharedHalf);
  const displacementCanvas = heightmapToDisplacementCanvas(hmap, w, h);

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

  return { normalMap, roughnessMap, aoMap, albedoMap, displacementMap, craterCount };
}

export function generateLunarSurfaceMaps(
  lunar: LunarTextureState,
  physicalAspect?: number,
  ringDims?: RingDimensions,
): LunarSurfaceMapSet {
  const aspect = physicalAspect ?? 1;
  const dimsKey = ringDims ? `-d${ringDims.innerDiameterMm.toFixed(1)}_${ringDims.widthMm.toFixed(1)}_${ringDims.thicknessMm.toFixed(1)}` : "";
  const key = cacheKey(lunar) + `-a${aspect.toFixed(2)}` + dimsKey;
  if (cache.has(key)) return cache.get(key)!;

  const { hmap, craterCount } = buildHeightmap(lunar, aspect, ringDims);
  const maps = buildMapsFromHeightmap(hmap, MAP_W, MAP_H, lunar, aspect, craterCount);
  evictCache();
  cache.set(key, maps);
  return maps;
}

/** Generate a fast preview at half resolution */
export function generateLunarPreviewMaps(
  lunar: LunarTextureState,
  physicalAspect?: number,
  ringDims?: RingDimensions,
): LunarSurfaceMapSet {
  const aspect = physicalAspect ?? 1;
  const previewKey = "preview-" + cacheKey(lunar) + `-a${aspect.toFixed(2)}`;
  if (cache.has(previewKey)) return cache.get(previewKey)!;

  const { hmap, craterCount } = buildHeightmap(lunar, aspect, ringDims);
  const maps = buildMapsFromHeightmap(hmap, MAP_W, MAP_H, lunar, aspect, craterCount);
  evictCache();
  cache.set(previewKey, maps);
  return maps;
}

/** Async generation with progress callback — non-blocking via setTimeout chunks */
export function generateLunarSurfaceMapsAsync(
  lunar: LunarTextureState,
  physicalAspect: number,
  ringDims: RingDimensions | undefined,
  onProgress: (progress: GenerationProgress) => void,
): Promise<LunarSurfaceMapSet> {
  const aspect = physicalAspect;
  const dimsKey = ringDims ? `-d${ringDims.innerDiameterMm.toFixed(1)}_${ringDims.widthMm.toFixed(1)}_${ringDims.thicknessMm.toFixed(1)}` : "";
  const key = cacheKey(lunar) + `-a${aspect.toFixed(2)}` + dimsKey;

  if (cache.has(key)) {
    const cached = cache.get(key)!;
    onProgress({ stage: "done", label: "Complete", craterCount: cached.craterCount, percent: 100 });
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    // Step 1: heightmap (most expensive)
    onProgress({ stage: "heightmap", label: "Building terrain…", craterCount: 0, percent: 5 });

    setTimeout(() => {
      const { hmap, craterCount } = buildHeightmap(lunar, aspect, ringDims);
      onProgress({ stage: "craters", label: `${craterCount.toLocaleString()} craters stamped`, craterCount, percent: 40 });

      setTimeout(() => {
        onProgress({ stage: "normal", label: "Computing normal map…", craterCount, percent: 50 });
        const normalStrength = 1.5 + (lunar.intensity / 100) * 2.0;
        const normalCanvas = heightmapToNormalCanvas(hmap, MAP_W, MAP_H, normalStrength, aspect);
        const normalMap = new THREE.CanvasTexture(normalCanvas);
        setupDataTexture(normalMap);

        // Pre-compute shared half-res downsample for roughness/AO/albedo
        const sharedHalf = getSharedHalfHmap(hmap, MAP_W, MAP_H);

        setTimeout(() => {
          onProgress({ stage: "roughness", label: "Computing roughness…", craterCount, percent: 62 });
          const roughnessCanvas = heightmapToRoughnessCanvas(hmap, MAP_W, MAP_H, lunar.microDetail, sharedHalf);
          const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
          setupDataTexture(roughnessMap);

          setTimeout(() => {
            onProgress({ stage: "ao", label: "Computing ambient occlusion…", craterCount, percent: 74 });
            const aoCanvas = heightmapToAOCanvas(hmap, MAP_W, MAP_H, sharedHalf);
            const aoMap = new THREE.CanvasTexture(aoCanvas);
            setupDataTexture(aoMap);

            setTimeout(() => {
              onProgress({ stage: "albedo", label: "Generating surface color…", craterCount, percent: 86 });
              const albedoCanvas = heightmapToAlbedoCanvas(hmap, MAP_W, MAP_H, lunar.seed, sharedHalf);
              const albedoMap = new THREE.CanvasTexture(albedoCanvas);
              setupDataTexture(albedoMap);
              albedoMap.colorSpace = THREE.SRGBColorSpace;

              setTimeout(() => {
                onProgress({ stage: "displacement", label: "Computing displacement…", craterCount, percent: 95 });
                const displacementCanvas = heightmapToDisplacementCanvas(hmap, MAP_W, MAP_H);
                const displacementMap = new THREE.CanvasTexture(displacementCanvas);
                setupDataTexture(displacementMap);

                const maps: LunarSurfaceMapSet = { normalMap, roughnessMap, aoMap, albedoMap, displacementMap, craterCount };
                evictCache();
                cache.set(key, maps);
                onProgress({ stage: "done", label: "Surface complete ✓", craterCount, percent: 100 });
                resolve(maps);
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    }, 0);
  });
}

/** Get crater count without generating full maps (uses cached heightmap result) */
export function estimateCraterCount(lunar: LunarTextureState): number {
  const densityMul = lunar.craterDensity === "low" ? 0.5 : lunar.craterDensity === "med" ? 1.0 : 1.8;
  const sizeMul = lunar.craterSize === "small" ? 0.6 : lunar.craterSize === "med" ? 1.0 : 1.5;
  const overlapFactor = lunar.overlapIntensity / 100;
  const microFactor = lunar.microDetail / 100;

  const mega = Math.round(1 + densityMul * 1.5);
  const hero = Math.round(3 + densityMul * 5);
  const med = Math.round(15 + densityMul * 35 * sizeMul);
  const small = Math.round(40 + densityMul * 160);
  const micro = Math.round((200 + densityMul * 600) * microFactor);

  const base = mega + hero + med + small;
  const overlap = Math.round(base * overlapFactor * 0.4);
  // Estimate secondary from ejecta rays (~3% hit rate per ray step for mega+hero)
  const ejectaSecondary = Math.round((mega + hero) * 6 * 0.03 * (lunar.ejectaStrength ?? 50) / 100 * 20);

  return base + overlap + ejectaSecondary + micro;
}

/** Dispose old textures when no longer needed */
export function disposeLunarMaps(maps: LunarSurfaceMapSet) {
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.aoMap.dispose();
  maps.albedoMap.dispose();
  maps.displacementMap.dispose();
}
