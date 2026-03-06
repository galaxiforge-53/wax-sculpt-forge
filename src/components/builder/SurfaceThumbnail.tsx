import { useEffect, useRef, memo } from "react";
import { LunarTextureState } from "@/types/lunar";

/**
 * Procedural canvas thumbnail that renders a tiny heightmap preview
 * of a LunarTextureState preset. Uses a simplified crater algorithm
 * for speed — generates a 64×64 heightmap and renders it as a lit
 * grayscale surface with simulated directional light.
 */

const THUMB_SIZE = 64;

function seededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

function generateThumbnailHeightmap(state: LunarTextureState): Float32Array {
  const w = THUMB_SIZE;
  const h = THUMB_SIZE;
  const heightmap = new Float32Array(w * h);
  const rng = seededRng(state.seed);

  // Terrain base noise
  const roughness = state.terrainRoughness / 100;
  const microDetail = state.microDetail / 100;

  for (let i = 0; i < w * h; i++) {
    heightmap[i] = 0.5 + (rng() - 0.5) * roughness * 0.3 + (rng() - 0.5) * microDetail * 0.15;
  }

  // Crater count based on density
  const densityMap = { low: 4, med: 10, high: 22 };
  const craterCount = densityMap[state.craterDensity] || 10;

  // Crater size range based on setting
  const sizeMap = { small: [2, 5], med: [4, 10], large: [7, 16] };
  const [minR, maxR] = sizeMap[state.craterSize] || [4, 10];

  const intensity = state.intensity / 100;
  const rimHeight = state.rimHeight / 100;
  const bowlDepth = state.bowlDepth / 100;
  const rimSharpness = state.rimSharpness / 100;
  const variation = state.craterVariation / 100;

  for (let c = 0; c < craterCount; c++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const r = minR + rng() * (maxR - minR) * (1 + (rng() - 0.5) * variation);
    const craterIntensity = intensity * (0.6 + rng() * 0.4);

    for (let y = Math.max(0, Math.floor(cy - r - 2)); y < Math.min(h, Math.ceil(cy + r + 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r - 2)); x < Math.min(w, Math.ceil(cx + r + 2)); x++) {
        // Wrap X for seamless tiling
        let dx = x - cx;
        if (dx > w / 2) dx -= w;
        if (dx < -w / 2) dx += w;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r + 1) continue;

        const t = dist / r;
        const idx = y * w + x;

        if (t < 1) {
          // Bowl — deeper in center
          const bowlProfile = Math.pow(t, 1.5 + rimSharpness) * bowlDepth;
          const rimProfile = t > 0.75 ? (t - 0.75) * 4 * rimHeight * 0.4 : 0;
          heightmap[idx] -= (bowlProfile - rimProfile) * craterIntensity * 0.5;
        } else if (t < 1.3) {
          // Rim
          const rimFade = 1 - (t - 1) / 0.3;
          heightmap[idx] += rimFade * rimHeight * craterIntensity * 0.15;
        }
      }
    }
  }

  // Erosion — blur pass
  const erosion = state.erosion / 100;
  if (erosion > 0.1) {
    const blurPasses = Math.ceil(erosion * 3);
    const temp = new Float32Array(w * h);
    for (let pass = 0; pass < blurPasses; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = heightmap[y * w + x] * 2;
          let count = 2;
          if (x > 0) { sum += heightmap[y * w + x - 1]; count++; }
          if (x < w - 1) { sum += heightmap[y * w + x + 1]; count++; }
          if (y > 0) { sum += heightmap[(y - 1) * w + x]; count++; }
          if (y < h - 1) { sum += heightmap[(y + 1) * w + x]; count++; }
          temp[y * w + x] = sum / count;
        }
      }
      heightmap.set(temp);
    }
  }

  // Smooth edges pass
  if (state.smoothEdges) {
    const temp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = heightmap[y * w + x] * 4;
        let count = 4;
        if (x > 0) { sum += heightmap[y * w + x - 1]; count++; }
        if (x < w - 1) { sum += heightmap[y * w + x + 1]; count++; }
        if (y > 0) { sum += heightmap[(y - 1) * w + x]; count++; }
        if (y < h - 1) { sum += heightmap[(y + 1) * w + x]; count++; }
        temp[y * w + x] = sum / count;
      }
    }
    heightmap.set(temp);
  }

  return heightmap;
}

function renderHeightmapToCanvas(
  ctx: CanvasRenderingContext2D,
  heightmap: Float32Array,
  w: number,
  h: number,
  displaySize: number,
) {
  const imageData = ctx.createImageData(displaySize, displaySize);
  const scaleX = w / displaySize;
  const scaleY = h / displaySize;

  // Find min/max for normalisation
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < heightmap.length; i++) {
    if (heightmap[i] < min) min = heightmap[i];
    if (heightmap[i] > max) max = heightmap[i];
  }
  const range = max - min || 1;

  // Directional light from top-left
  const lightDir = { x: -0.6, y: -0.7, z: 0.35 };

  for (let py = 0; py < displaySize; py++) {
    for (let px = 0; px < displaySize; px++) {
      const sx = Math.floor(px * scaleX);
      const sy = Math.floor(py * scaleY);
      const idx = sy * w + sx;

      // Compute simple normal from heightmap gradients
      const hL = sx > 0 ? heightmap[sy * w + sx - 1] : heightmap[idx];
      const hR = sx < w - 1 ? heightmap[sy * w + sx + 1] : heightmap[idx];
      const hU = sy > 0 ? heightmap[(sy - 1) * w + sx] : heightmap[idx];
      const hD = sy < h - 1 ? heightmap[(sy + 1) * w + sx] : heightmap[idx];

      const nx = (hL - hR) * 8;
      const ny = (hU - hD) * 8;
      const nz = 1;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

      // Dot product with light direction
      const dot = Math.max(0, (nx / nLen) * lightDir.x + (ny / nLen) * lightDir.y + (nz / nLen) * lightDir.z);

      // Base color from height
      const normalizedH = (heightmap[idx] - min) / range;
      const base = 0.15 + normalizedH * 0.25;
      const lit = base + dot * 0.55;

      const val = Math.round(Math.min(1, Math.max(0, lit)) * 255);
      const pidx = (py * displaySize + px) * 4;
      imageData.data[pidx] = val;
      imageData.data[pidx + 1] = Math.round(val * 0.95);
      imageData.data[pidx + 2] = Math.round(val * 0.9);
      imageData.data[pidx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

interface SurfaceThumbnailProps {
  preset: LunarTextureState;
  size?: number;
  className?: string;
}

function SurfaceThumbnailInner({ preset, size = 48, className = "" }: SurfaceThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const heightmap = generateThumbnailHeightmap(preset);
    renderHeightmapToCanvas(ctx, heightmap, THUMB_SIZE, THUMB_SIZE, size);
  }, [preset.seed, preset.craterDensity, preset.craterSize, preset.intensity, preset.rimHeight, preset.bowlDepth, preset.rimSharpness, preset.microDetail, preset.terrainRoughness, preset.erosion, preset.craterVariation, preset.smoothEdges, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`rounded-md flex-shrink-0 ${className}`}
      style={{ width: size, height: size, imageRendering: "auto" }}
    />
  );
}

const SurfaceThumbnail = memo(SurfaceThumbnailInner);
export default SurfaceThumbnail;
