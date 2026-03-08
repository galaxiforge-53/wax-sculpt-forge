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
  function lerpN(a: number, b: number, t: number) { return a + t * (b - a); }
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

    return lerpN(
      lerpN(dot2(grad[aa], xf, yf), dot2(grad[ba], xf - 1, yf), u),
      lerpN(dot2(grad[ab], xf, yf - 1), dot2(grad[bb], xf - 1, yf - 1), u),
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

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let wpx = px % w;
      if (wpx < 0) wpx += w;

      const du = (px - c.cu * w) / pxR;
      const dv = (py - c.cv * h) / pyR;

      const { dist, wdu, wdv } = shapedDistance(du, dv, sp, px, py, w, h);
      if (dist > ejectaEnd) continue;

      const angle = Math.atan2(wdv, wdu);
      const angleDiff = Math.cos(angle - c.rimAsymAngle);
      const rimAsymFactor = 1.0 + c.rimAsymmetry * 0.4 * angleDiff;

      const slumpShift = c.slumpStrength * 0.08;
      const slumpDu = wdu + Math.cos(c.slumpAngle) * slumpShift;
      const slumpDv = wdv + Math.sin(c.slumpAngle) * slumpShift;
      const slumpDist = Math.sqrt(slumpDu * slumpDu + slumpDv * slumpDv);

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
  // Sampling 2000 points gives <2% error on 4M-pixel maps
  const sampleCount = 2000;
  const sampleRng = seededRng(seed + 6500);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = hmap[Math.floor(sampleRng() * hmap.length)];
  }
  samples.sort();
  const threshold = samples[Math.floor(sampleCount * (0.35 + mariaFactor * 0.15))];

  const mariaNoise = makeNoise2D(seed + 6000);
  const mariaStrength = mariaFactor * 0.7;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const hVal = hmap[idx];
      if (hVal < threshold) {
        const depth = (threshold - hVal) / Math.max(0.01, threshold);
        const noise = mariaNoise(x / w * 6, y / h * 6) * 0.3 + 0.5;
        const fill = depth * mariaStrength * noise;
        const mask = edgeMask[idx];
        // Raise low areas toward threshold (fill in)
        hmap[idx] = lerp(hVal, threshold * 0.85, fill * mask);
      }
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

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w * 12;
      const v = y / h * 12 * aspectCorr;
      // Ridged noise: abs(fbm) creates sharp ridges
      const n = Math.abs(fbm(ridgeNoise, u, v, 4, 2.2, 0.5));
      // Invert so ridges are peaks
      const ridge = (1.0 - n * 2.0);
      if (ridge > 0) {
        const mask = edgeMask[y * w + x];
        hmap[y * w + x] += ridge * ridgeAmp * mask;
      }
    }
  }
}

// ── Erosion pass ──────────────────────────────────────────────────

function applyErosion(hmap: Float32Array, w: number, h: number, erosionFactor: number) {
  if (erosionFactor <= 0) return;

  // Separable box blur — O(n*2k) instead of O(n*k²)
  const kernelR = Math.max(1, Math.round(2 + erosionFactor * 4));
  const kernelSize = kernelR * 2 + 1;
  const temp = new Float32Array(hmap.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let sum = 0;
    // Initialize window
    for (let kx = -kernelR; kx <= kernelR; kx++) {
      const sx = ((kx % w) + w) % w;
      sum += hmap[y * w + sx];
    }
    temp[y * w + 0] = sum / kernelSize;
    for (let x = 1; x < w; x++) {
      const addX = ((x + kernelR) % w + w) % w;
      const removeX = ((x - kernelR - 1) % w + w) % w;
      sum += hmap[y * w + addX] - hmap[y * w + removeX];
      temp[y * w + x] = sum / kernelSize;
    }
  }

  // Vertical pass
  const blurred = new Float32Array(hmap.length);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let ky = -kernelR; ky <= kernelR; ky++) {
      const sy = Math.max(0, Math.min(h - 1, ky));
      sum += temp[sy * w + x];
    }
    blurred[x] = sum / kernelSize;
    for (let y = 1; y < h; y++) {
      const addY = Math.min(h - 1, y + kernelR);
      const removeY = Math.max(0, y - kernelR - 1);
      sum += temp[addY * w + x] - temp[removeY * w + x];
      blurred[y * w + x] = sum / kernelSize;
    }
  }

  const blend = erosionFactor * 0.6;
  for (let i = 0; i < hmap.length; i++) {
    hmap[i] = lerp(hmap[i], blurred[i], blend);
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
      // Moon is well-served by the base engine + maria fill + ejecta
      // Add subtle ray brightening around the map center for realism
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
      // Extra smoothing pass to bury features
      applyErosion(hmap, w, h, 0.6);
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

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w * 6;
      const v = y / h * 6;
      // Directional noise creating subtle linear brightening
      const n = rayNoise(u * 3, v * 0.5);
      if (n > 0.3) {
        const idx = y * w + x;
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
  // Wind-driven dust fills craters unevenly
  const dustNoise = makeNoise2D(seed + 14001);
  // Approximate percentile via random sampling (O(k) instead of O(n log n))
  const sampleCount = 2000;
  const sampleRng = seededRng(seed + 14500);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = hmap[Math.floor(sampleRng() * hmap.length)];
  }
  samples.sort();
  const fillLevel = samples[Math.floor(sampleCount * 0.45)];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (hmap[idx] < fillLevel) {
        const depth = (fillLevel - hmap[idx]) / Math.max(0.01, fillLevel);
        // Wind direction bias — dust accumulates on one side
        const windBias = 0.5 + 0.5 * dustNoise(x / w * 4, y / h * 2);
        const fill = depth * 0.6 * windBias;
        hmap[idx] = lerp(hmap[idx], fillLevel * 0.9, fill * edgeMask[idx]);
      }
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

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let du = (x / w - centerU);
      // Wrap around circumference
      if (du > 0.5) du -= 1;
      if (du < -0.5) du += 1;
      const dv = (y / h - centerV);
      const dist = Math.sqrt(du * du + dv * dv);

      // Concentric sine waves
      const ringPhase = dist * ringCount * Math.PI * 8;
      const ringVal = Math.sin(ringPhase) * Math.exp(-dist * 4);

      const idx = y * w + x;
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

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;

      // Long parallel dunes with meandering — primarily u-direction
      const dunePhase = v * 25 + duneNoise(u * 8, v * 3) * 3;
      const dune = Math.sin(dunePhase) * 0.5 + 0.5;
      // Cross-pattern secondary dunes
      const crossDune = Math.sin(u * 40 + duneNoise2(u * 5, v * 5) * 2) * 0.3 + 0.5;

      const combined = dune * 0.7 + crossDune * 0.3;
      const idx = y * w + x;
      hmap[idx] += (combined - 0.5) * duneAmp * edgeMask[idx];
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

  const folds = parseInt(symmetry, 10); // 2, 3, 4, 6, or 8
  if (isNaN(folds) || folds < 2) return;

  const segmentWidth = w / folds;
  const blendPx = Math.floor((blendPercent / 100) * segmentWidth * 0.5);

  // Create a copy of the first segment to use as source
  const sourceSegment = new Float32Array(Math.ceil(segmentWidth) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.ceil(segmentWidth); x++) {
      sourceSegment[y * Math.ceil(segmentWidth) + x] = hmap[y * w + x];
    }
  }

  // Apply the source segment to all other segments with optional blending
  for (let fold = 1; fold < folds; fold++) {
    const startX = Math.floor(fold * segmentWidth);
    const mirror = fold % 2 === 1; // Alternate mirroring for seamless look

    for (let y = 0; y < h; y++) {
      for (let localX = 0; localX < Math.ceil(segmentWidth); localX++) {
        const targetX = startX + localX;
        if (targetX >= w) continue;

        // Get source position (mirrored if needed)
        const srcX = mirror
          ? Math.min(Math.ceil(segmentWidth) - 1, Math.ceil(segmentWidth) - 1 - localX)
          : localX;
        const srcIdx = y * Math.ceil(segmentWidth) + srcX;
        const srcValue = sourceSegment[srcIdx] ?? 0.5;

        const targetIdx = y * w + targetX;
        const existingValue = hmap[targetIdx];

        // Blend at segment boundaries for smoother transitions
        let blend = 1.0;
        if (blendPx > 0) {
          if (localX < blendPx) {
            blend = localX / blendPx;
          } else if (localX > segmentWidth - blendPx) {
            blend = (segmentWidth - localX) / blendPx;
          }
        }

        hmap[targetIdx] = existingValue * (1 - blend) + srcValue * blend;
      }
    }
  }

  // Ensure seamless wrap at U=0/U=1 boundary
  if (blendPx > 0) {
    for (let y = 0; y < h; y++) {
      for (let dx = 0; dx < blendPx; dx++) {
        const leftIdx = y * w + dx;
        const rightIdx = y * w + (w - 1 - dx);
        const t = dx / blendPx;
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

  for (let y = 0; y < h; y++) {
    const v = y / h; // 0 to 1 along the ring width

    // Find which zone(s) this row belongs to
    let zoneInfluence = 1.0; // Default: full texture intensity
    let smoothnessFactor = 0; // 0 = full texture, 1 = completely smooth

    for (const zone of sortedZones) {
      if (v < zone.startV || v > zone.endV) continue;

      const zoneWidth = zone.endV - zone.startV;
      const blendRegion = (zone.blendWidth / 100) * zoneWidth;
      const posInZone = v - zone.startV;
      const distFromEnd = zone.endV - v;

      // Calculate blend factor at zone edges
      let edgeBlend = 1.0;
      if (blendRegion > 0) {
        if (posInZone < blendRegion) {
          edgeBlend = posInZone / blendRegion;
        } else if (distFromEnd < blendRegion) {
          edgeBlend = distFromEnd / blendRegion;
        }
      }

      // Apply zone's intensity and smoothness
      const zoneIntensity = (zone.intensity / 100) * edgeBlend;
      const zoneSmoothness = (zone.smoothness / 100) * edgeBlend;

      // Blend with existing influence (for overlapping zones)
      zoneInfluence = zoneInfluence * (1 - edgeBlend) + zoneIntensity * edgeBlend;
      smoothnessFactor = smoothnessFactor * (1 - edgeBlend) + zoneSmoothness * edgeBlend;
    }

    // Apply zone effects to this row
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const original = hmap[idx];

      // Reduce texture intensity based on zone settings
      // As smoothness increases, flatten toward 0.5 (neutral height)
      const flattened = 0.5 + (original - 0.5) * (1 - smoothnessFactor);

      // Apply intensity reduction
      const final = 0.5 + (flattened - 0.5) * zoneInfluence;

      hmap[idx] = final;
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

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const idx = y * w + x;
      const original = hmap[idx];

      // Combine all mask values (union for include, intersection for exclude)
      let combinedMask = mode === "include" ? 0 : 1;
      for (const mask of activeMasks) {
        const maskVal = computeMaskValue(u, v, mask, noiseFunc);
        if (mode === "include") {
          combinedMask = Math.max(combinedMask, maskVal);
        } else {
          combinedMask = Math.min(combinedMask, 1 - maskVal);
        }
      }

      // Apply mask: blend between original texture and flat surface
      const flat = 0.5;
      hmap[idx] = flat + (original - flat) * combinedMask;
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

  // ─── 1) fBm base terrain layer ──
  // Scale V coordinate by aspect correction so noise features stay circular
  // physicalAspect = circumference/width, pixel ratio = MAP_W/MAP_H = 4
  const aspectCorrection = physicalAspect / (MAP_W / MAP_H);
  const baseNoise = makeNoise2D(lunar.seed + 500);
  const baseAmp = (0.04 + terrainRough * 0.12) * depthScale;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W * 8;
      const v = y / MAP_H * 8 * aspectCorrection;
      const n = fbm(baseNoise, u, v, 6, 2.0, 0.5);
      const mask = edgeMask[y * MAP_W + x];
      hmap[y * MAP_W + x] += n * baseAmp * mask;
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

  function addCraters(count: number, rMin: number, rMax: number, depthMul: number, tier: number) {
    for (let i = 0; i < count; i++) {
      const t = Math.pow(rand(), 1.5);
      const radius = rMin + (rMax - rMin) * t;
      const cu = rand();
      const cv = 0.12 + rand() * 0.76;

      const varScale = 1.0 + (rand() - 0.5) * craterVar * 0.8;
      const depth = (0.5 + rand() * 0.5) * depthScale * depthMul * bowlDepthScale * varScale;
      const rimH = (0.35 + rimSharp * 0.65) * depthScale * depthMul * rimHeightScale * varScale;

      const rimCenterJitter = (rand() - 0.5) * 0.04;
      const rimWidthJitter = (rand() - 0.5) * 0.02;
      const warpSeed = rand();
      const age = tier / 4;

      const rimAsymmetry = rand() * (tier <= 1 ? 0.5 : 0.3);
      const rimAsymAngle = rand() * Math.PI * 2;
      const slumpAngle = rand() * Math.PI * 2;
      const slumpStrength = rand() * (tier <= 1 ? 0.3 : 0.15);

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

  // ─── 4) Maria fill pass ──
  applyMariaFill(hmap, MAP_W, MAP_H, mariaFactor, edgeMask, lunar.seed);

  // ─── 5) Erosion pass ──
  applyErosion(hmap, MAP_W, MAP_H, erosionFactor);

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

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          // Wrap x for seamless circumference
          let wpx = px % MAP_W;
          if (wpx < 0) wpx += MAP_W;
          const du = (px - pu * MAP_W) / pxR;
          const dv = (py - pv * MAP_H) / pyR;
          const d = Math.sqrt(du * du + dv * dv);
          if (d > 1.0) continue;
          const falloff = 1 - d * d;
          const mask = edgeMask[py * MAP_W + wpx];
          hmap[py * MAP_W + wpx] -= pd * falloff * mask;
        }
      }
    }

    // ─── 7) Single-pass regolith + grain + directional scratches ──
    // Previously 3 separate full-map traversals; now combined into one
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

    for (let y = 0; y < MAP_H; y++) {
      const vCoord8 = (y / MAP_H) * 8 * aspectCorrection;
      const vCoord48 = (y / MAP_H) * 48 * aspectCorrection;
      const vCoord96 = (y / MAP_H) * 96 * aspectCorrection;
      const vCoord200 = (y / MAP_H) * 200 * aspectCorrection;
      for (let x = 0; x < MAP_W; x++) {
        const idx = y * MAP_W + x;
        const mask = edgeMask[idx];
        if (mask < 0.01) continue; // Skip fully masked edge pixels

        const uNorm = x / MAP_W;

        // Coarse regolith (5 octave fBm)
        const regN = fbm(regolithNoise, uNorm * 48, vCoord48, 5, 2.2, 0.45);
        // Fine regolith (single octave)
        const fineN = fineRegolith(uNorm * 96, vCoord96);
        // Random grain particle
        const grain = (grainRng() - 0.5) * grainStrength;
        // Directional micro-scratch
        const ru = (uNorm * 200) * cosA + vCoord200 * sinA;
        const rv = -(uNorm * 200) * sinA + vCoord200 * cosA;
        const scratch = impactNoise(ru * 0.3, rv * 1.5) * grainStrength * 0.4;

        hmap[idx] += (regN * regolithStrength + fineN * fineStrength + grain + scratch) * mask;
      }
    }
  }

  // ─── 8) Normalize heightmap range then apply depth contrast ──
  // After allowing extended range (-0.3 to 1.2) for realistic overlap stacking,
  // remap back to 0–1 before contrast and downstream passes
  let hMin = Infinity, hMax = -Infinity;
  for (let i = 0; i < hmap.length; i++) {
    if (hmap[i] < hMin) hMin = hmap[i];
    if (hmap[i] > hMax) hMax = hmap[i];
  }
  const hRange = hMax - hMin;
  if (hRange > 0.001) {
    for (let i = 0; i < hmap.length; i++) {
      hmap[i] = (hmap[i] - hMin) / hRange;
    }
  }

  const contrastVal = (lunar.terrainContrast ?? 60) / 100; // 0–1
  // Map 0–1 to a contrast multiplier: 0→0.6 (flat), 0.5→1.0 (neutral), 1.0→1.8 (dramatic)
  const contrastMult = 0.6 + contrastVal * 1.2;
  for (let i = 0; i < hmap.length; i++) {
    hmap[i] = 0.5 + (hmap[i] - 0.5) * contrastMult;
    hmap[i] = Math.max(0, Math.min(1, hmap[i]));
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

  // ─── 12) Smooth edges final pass ──
  // Separable horizontal + vertical blur for better cache coherence
  // Previous 3×3 non-separable kernel required diagonal reads; separable is ~2× faster
  if (lunar.smoothEdges) {
    const smoothTemp = new Float32Array(hmap.length);
    // Horizontal pass — reads are contiguous in memory
    for (let y = 0; y < MAP_H; y++) {
      const rowOff = y * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        const xl = ((x - 1) % MAP_W + MAP_W) % MAP_W;
        const xr = ((x + 1) % MAP_W + MAP_W) % MAP_W;
        smoothTemp[rowOff + x] = hmap[rowOff + xl] * 0.25 + hmap[rowOff + x] * 0.5 + hmap[rowOff + xr] * 0.25;
      }
    }
    // Vertical pass on horizontally-blurred data
    const smoothResult = new Float32Array(hmap.length);
    for (let y = 0; y < MAP_H; y++) {
      const yAbove = Math.max(0, y - 1);
      const yBelow = Math.min(MAP_H - 1, y + 1);
      for (let x = 0; x < MAP_W; x++) {
        smoothResult[y * MAP_W + x] = smoothTemp[yAbove * MAP_W + x] * 0.25 + smoothTemp[y * MAP_W + x] * 0.5 + smoothTemp[yBelow * MAP_W + x] * 0.25;
      }
    }
    // Blend 40% smoothed for subtle effect
    for (let i = 0; i < hmap.length; i++) {
      hmap[i] = hmap[i] * 0.6 + smoothResult[i] * 0.4;
    }
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

  const yScale = physicalAspect * (h / w);

  const sample = (sx: number, sy: number) => {
    const wx = ((sx % w) + w) % w;
    const wy = Math.max(0, Math.min(h - 1, sy));
    return hmap[wy * w + wx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const tc = sample(x,     y - 1);
      const tr = sample(x + 1, y - 1);
      const ml = sample(x - 1, y);
      const mr = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const bc = sample(x,     y + 1);
      const br = sample(x + 1, y + 1);

      let nx = (tl - tr + 2 * (ml - mr) + bl - br) * strength * 0.25;
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

// ── Roughness map (computed at half resolution, then upscaled) ─────
// Roughness is a low-frequency property — half-res gives ~4× speedup
// with no visible quality loss on the curved ring surface.

function heightmapToRoughnessCanvas(hmap: Float32Array, w: number, h: number, microDetail: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const hw = w >> 1;
  const hh = h >> 1;
  const microFactor = microDetail / 100;
  const grainRng = seededRng(7777 + Math.round(microDetail));

  // Compute at half resolution
  const halfRough = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    const sy = y * 2;
    for (let x = 0; x < hw; x++) {
      const sx = x * 2;
      // 2×2 box filter downsample of heightmap
      const hVal = (
        hmap[sy * w + sx] +
        hmap[sy * w + sx + 1] +
        hmap[Math.min(sy + 1, h - 1) * w + sx] +
        hmap[Math.min(sy + 1, h - 1) * w + sx + 1]
      ) * 0.25;
      let roughness = 0.92 - (hVal - 0.5) * 0.9;
      if (microFactor > 0) {
        roughness += (grainRng() - 0.5) * 0.12 * microFactor;
      }
      halfRough[y * hw + x] = Math.max(0.2, Math.min(1.0, roughness));
    }
  }

  // Bilinear upscale to full resolution
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * (hh - 1);
    const iy = Math.floor(fy);
    const fy1 = fy - iy;
    const iy0 = Math.min(iy, hh - 1);
    const iy1 = Math.min(iy + 1, hh - 1);
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * (hw - 1);
      const ix = Math.floor(fx);
      const fx1 = fx - ix;
      const ix0 = ((ix) % hw + hw) % hw;
      const ix1 = ((ix + 1) % hw + hw) % hw;

      const v = Math.round((
        halfRough[iy0 * hw + ix0] * (1 - fx1) * (1 - fy1) +
        halfRough[iy0 * hw + ix1] * fx1 * (1 - fy1) +
        halfRough[iy1 * hw + ix0] * (1 - fx1) * fy1 +
        halfRough[iy1 * hw + ix1] * fx1 * fy1
      ) * 255);
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

// ── AO map (computed at half resolution for performance, then upscaled) ───
// The multi-kernel sampling is O(pixels × kernelSamples), so halving resolution
// gives ~4× speedup with minimal visual difference on a curved ring surface.

function heightmapToAOCanvas(hmap: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Compute at half resolution
  const hw = w >> 1;
  const hh = h >> 1;

  // Downsample heightmap with 2×2 box filter
  const halfHmap = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    const sy = y * 2;
    for (let x = 0; x < hw; x++) {
      const sx = x * 2;
      halfHmap[y * hw + x] = (
        hmap[sy * w + sx] +
        hmap[sy * w + sx + 1] +
        hmap[Math.min(sy + 1, h - 1) * w + sx] +
        hmap[Math.min(sy + 1, h - 1) * w + sx + 1]
      ) * 0.25;
    }
  }

  // Multi-scale AO at half resolution
  const kernels = [
    { radius: 2, step: 1, weight: 0.5 },   // Fine detail AO (was 3)
    { radius: 4, step: 1, weight: 0.35 },   // Medium-scale (was 8 step 2)
    { radius: 8, step: 2, weight: 0.15 },   // Broad occlusion (was 16 step 4)
  ];

  const halfAO = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const center = halfHmap[y * hw + x];
      let totalAO = 0;

      for (const kernel of kernels) {
        let higher = 0, samples = 0;
        let heightDiffSum = 0;

        for (let ky = -kernel.radius; ky <= kernel.radius; ky += kernel.step) {
          for (let kx = -kernel.radius; kx <= kernel.radius; kx += kernel.step) {
            const sy = Math.max(0, Math.min(hh - 1, y + ky));
            const sx = ((x + kx) % hw + hw) % hw;
            const sampleH = halfHmap[sy * hw + sx];
            if (sampleH > center) {
              higher++;
              heightDiffSum += (sampleH - center);
            }
            samples++;
          }
        }

        const countAO = higher / samples;
        const heightAO = Math.min(1, heightDiffSum / samples * 8);
        const kernelAO = countAO * 0.6 + heightAO * 0.4;
        totalAO += kernelAO * kernel.weight;
      }

      halfAO[y * hw + x] = 1.0 - totalAO * 0.7;
    }
  }

  // Bilinear upscale to full resolution
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * (hh - 1);
    const iy = Math.floor(fy);
    const fy1 = fy - iy;
    const iy0 = Math.min(iy, hh - 1);
    const iy1 = Math.min(iy + 1, hh - 1);
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * (hw - 1);
      const ix = Math.floor(fx);
      const fx1 = fx - ix;
      const ix0 = ((ix) % hw + hw) % hw;
      const ix1 = ((ix + 1) % hw + hw) % hw;

      const ao = (
        halfAO[iy0 * hw + ix0] * (1 - fx1) * (1 - fy1) +
        halfAO[iy0 * hw + ix1] * fx1 * (1 - fy1) +
        halfAO[iy1 * hw + ix0] * (1 - fx1) * fy1 +
        halfAO[iy1 * hw + ix1] * fx1 * fy1
      );

      const v = Math.round(Math.max(0.2, Math.min(1.0, ao)) * 255);
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

// ── Albedo map (computed at half resolution, then upscaled) ───────
// Albedo is a very low-frequency property (subtle stone color variation).
// Computing fBm at half-res eliminates ~3M redundant noise evaluations.

function heightmapToAlbedoCanvas(hmap: Float32Array, w: number, h: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const hw = w >> 1;
  const hh = h >> 1;
  const stoneNoise = makeNoise2D(seed + 7000);
  const grainRng = seededRng(seed + 8000);

  // Downsample heightmap for height-tint calculation
  const halfHmap = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    const sy = y * 2;
    for (let x = 0; x < hw; x++) {
      const sx = x * 2;
      halfHmap[y * hw + x] = (
        hmap[sy * w + sx] +
        hmap[sy * w + sx + 1] +
        hmap[Math.min(sy + 1, h - 1) * w + sx] +
        hmap[Math.min(sy + 1, h - 1) * w + sx + 1]
      ) * 0.25;
    }
  }

  // Compute albedo at half resolution
  const halfAlbedo = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const u = x / hw * 4;
      const v = y / hh * 4;
      const n = fbm(stoneNoise, u, v, 2, 2.0, 0.5) * 0.5 + 0.5;
      const grain = (grainRng() - 0.5) * 0.04;
      const hVal = halfHmap[y * hw + x];
      const heightTint = 0.95 + (hVal - 0.5) * 0.1;
      let albedo = 0.82 + n * 0.12 + grain;
      albedo *= heightTint;
      halfAlbedo[y * hw + x] = Math.max(0.6, Math.min(1.0, albedo));
    }
  }

  // Bilinear upscale to full resolution
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * (hh - 1);
    const iy = Math.floor(fy);
    const fy1 = fy - iy;
    const iy0 = Math.min(iy, hh - 1);
    const iy1 = Math.min(iy + 1, hh - 1);
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * (hw - 1);
      const ix = Math.floor(fx);
      const fx1 = fx - ix;
      const ix0 = ((ix) % hw + hw) % hw;
      const ix1 = ((ix + 1) % hw + hw) % hw;

      const val = Math.round((
        halfAlbedo[iy0 * hw + ix0] * (1 - fx1) * (1 - fy1) +
        halfAlbedo[iy0 * hw + ix1] * fx1 * (1 - fy1) +
        halfAlbedo[iy1 * hw + ix0] * (1 - fx1) * fy1 +
        halfAlbedo[iy1 * hw + ix1] * fx1 * fy1
      ) * 255);
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

export type GenerationStage = "heightmap" | "craters" | "erosion" | "normal" | "roughness" | "ao" | "albedo" | "displacement" | "done";

export interface GenerationProgress {
  stage: GenerationStage;
  label: string;
  craterCount: number;
  percent: number;
}

function buildMapsFromHeightmap(
  hmap: Float32Array,
  w: number,
  h: number,
  lunar: LunarTextureState,
  aspect: number,
  craterCount: number,
): LunarSurfaceMapSet {
  // Normal map strength scales with intensity: low intensity → subtle normals, high → sharp
  const normalStrength = 1.5 + (lunar.intensity / 100) * 2.0;
  const normalCanvas = heightmapToNormalCanvas(hmap, w, h, normalStrength, aspect);
  const roughnessCanvas = heightmapToRoughnessCanvas(hmap, w, h, lunar.microDetail);
  const aoCanvas = heightmapToAOCanvas(hmap, w, h);
  const albedoCanvas = heightmapToAlbedoCanvas(hmap, w, h, lunar.seed);
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
        onProgress({ stage: "normal", label: "Computing normal map…", craterCount, percent: 55 });
        const normalStrength = 1.5 + (lunar.intensity / 100) * 2.0;
        const normalCanvas = heightmapToNormalCanvas(hmap, MAP_W, MAP_H, normalStrength, aspect);
        const normalMap = new THREE.CanvasTexture(normalCanvas);
        setupDataTexture(normalMap);

        setTimeout(() => {
          onProgress({ stage: "roughness", label: "Computing roughness…", craterCount, percent: 65 });
          const roughnessCanvas = heightmapToRoughnessCanvas(hmap, MAP_W, MAP_H, lunar.microDetail);
          const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
          setupDataTexture(roughnessMap);

          setTimeout(() => {
            onProgress({ stage: "ao", label: "Computing ambient occlusion…", craterCount, percent: 75 });
            const aoCanvas = heightmapToAOCanvas(hmap, MAP_W, MAP_H);
            const aoMap = new THREE.CanvasTexture(aoCanvas);
            setupDataTexture(aoMap);

            setTimeout(() => {
              onProgress({ stage: "albedo", label: "Generating surface color…", craterCount, percent: 85 });
              const albedoCanvas = heightmapToAlbedoCanvas(hmap, MAP_W, MAP_H, lunar.seed);
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
