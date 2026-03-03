import * as THREE from "three";

/**
 * Cached procedural crater textures for lunar decals.
 * Each texture is a radial gradient: dark center (bowl) → thin bright ring (rim) → transparent falloff.
 */

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getCraterTexture(rimSharpness: number): THREE.CanvasTexture {
  const key = `crater-${Math.round(rimSharpness * 10)}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Radial gradient: dark bowl center → rim highlight → transparent edge
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const rimPos = 0.55 + rimSharpness * 0.2; // rim ring position (0.55–0.75)
  const rimWidth = 0.06 - rimSharpness * 0.03; // sharper = thinner rim

  grad.addColorStop(0, "rgba(15, 20, 10, 0.85)");        // deep bowl center
  grad.addColorStop(0.35, "rgba(25, 35, 18, 0.6)");       // mid bowl
  grad.addColorStop(rimPos - rimWidth, "rgba(40, 55, 30, 0.3)"); // pre-rim
  grad.addColorStop(rimPos, "rgba(90, 110, 70, 0.45)");   // rim highlight
  grad.addColorStop(rimPos + rimWidth, "rgba(50, 65, 35, 0.2)"); // post-rim
  grad.addColorStop(0.9, "rgba(30, 40, 20, 0.05)");       // falloff
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");               // fully transparent

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

export function getPitTexture(): THREE.CanvasTexture {
  if (textureCache.has("pit")) return textureCache.get("pit")!;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0, "rgba(20, 28, 14, 0.7)");
  grad.addColorStop(0.6, "rgba(25, 35, 18, 0.3)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  textureCache.set("pit", tex);
  return tex;
}

export function getGrainTexture(): THREE.CanvasTexture {
  if (textureCache.has("grain")) return textureCache.get("grain")!;

  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0, "rgba(18, 24, 12, 0.5)");
  grad.addColorStop(0.7, "rgba(20, 28, 15, 0.15)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  textureCache.set("grain", tex);
  return tex;
}
