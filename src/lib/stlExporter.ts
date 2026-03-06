import * as THREE from "three";
import { RingParameters, RingProfile } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { buildHeightmap, MAP_DIMENSIONS } from "@/lib/lunarSurfaceMaps";

/**
 * Generates a watertight STL binary from ring parameters with baked
 * lunar displacement and engraving carved into the vertices.
 */

// ── Geometry builder ─────────────────────────────────────────────

function buildExportGeometry(
  params: RingParameters,
  lunar: LunarTextureState | null,
  _engraving: EngravingState | null,
): THREE.BufferGeometry {
  const innerR = params.innerDiameter / 2 / 10; // mm → three.js units (cm-ish)
  const outerR = innerR + params.thickness / 10;
  const width = params.width / 10;
  const bevel = params.bevelSize / 10;

  // High subdivision for baked detail
  const widthSteps = 128;
  const circumSteps = 512;

  const points: THREE.Vector2[] = [];

  if (params.profile === "dome" || params.profile === "comfort") {
    for (let i = 0; i <= widthSteps; i++) {
      const t = i / widthSteps;
      const angle = t * Math.PI;
      const r = innerR + (outerR - innerR) * (0.5 + 0.5 * Math.sin(angle));
      points.push(new THREE.Vector2(r, (t - 0.5) * width));
    }
  } else if (params.profile === "flat") {
    for (let i = 0; i <= widthSteps; i++) {
      const t = i / widthSteps;
      const y = (t - 0.5) * width;
      const edgeDist = Math.min(t, 1 - t);
      const bevelT = Math.min(1, edgeDist / (bevel / width + 0.01));
      const r = innerR + (outerR - innerR) * Math.min(1, bevelT);
      points.push(new THREE.Vector2(r, y));
    }
  } else if (params.profile === "knife-edge") {
    for (let i = 0; i <= widthSteps; i++) {
      const t = i / widthSteps;
      const angle = t * Math.PI;
      const bulge = Math.pow(Math.sin(angle), 0.5);
      const r = innerR + (outerR - innerR) * bulge;
      points.push(new THREE.Vector2(r, (t - 0.5) * width));
    }
  } else {
    // square / fallback
    for (let i = 0; i <= widthSteps; i++) {
      const t = i / widthSteps;
      const y = (t - 0.5) * width;
      points.push(new THREE.Vector2(outerR, y));
    }
  }

  const geo = new THREE.LatheGeometry(points, circumSteps);

  // ── Bake lunar displacement into vertices ──
  if (lunar?.enabled) {
    const physicalAspect = (() => {
      const outerDiam = params.innerDiameter + 2 * params.thickness;
      const circ = Math.PI * outerDiam;
      return width > 0 ? circ / params.width : 1;
    })();

    const { hmap } = buildHeightmap(lunar, physicalAspect);
    const { width: MAP_W, height: MAP_H } = MAP_DIMENSIONS;

    const dispScale = outerR * (0.04 + (lunar.intensity / 100) * 0.10);
    const dispBias = -dispScale * 0.5;

    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;
    const uvAttr = geo.attributes.uv;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const r = Math.sqrt(x * x + z * z);

      // Skip inner surface vertices
      if (r < innerR + 0.005) continue;

      // Get UV
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);

      // Sample heightmap (bilinear)
      const px = (u * MAP_W) % MAP_W;
      const py = ((1 - v) * MAP_H);
      const ix = Math.floor(px) % MAP_W;
      const iy = Math.min(MAP_H - 1, Math.max(0, Math.floor(py)));
      const hVal = hmap[iy * MAP_W + ix];

      const disp = hVal * dispScale + dispBias;

      // Displace along normal
      const nx = normAttr.getX(i);
      const ny = normAttr.getY(i);
      const nz = normAttr.getZ(i);

      posAttr.setX(i, x + nx * disp);
      posAttr.setY(i, y + ny * disp);
      posAttr.setZ(i, z + nz * disp);
    }

    posAttr.needsUpdate = true;
  }

  geo.computeVertexNormals();
  return geo;
}

// ── STL binary writer ────────────────────────────────────────────

function geometryToSTLBinary(geometry: THREE.BufferGeometry): ArrayBuffer {
  const posAttr = geometry.attributes.position;
  const index = geometry.index;

  let triangleCount: number;
  if (index) {
    triangleCount = index.count / 3;
  } else {
    triangleCount = posAttr.count / 3;
  }

  // STL binary format: 80-byte header + 4-byte triangle count + 50 bytes per triangle
  const bufferLength = 80 + 4 + triangleCount * 50;
  const buffer = new ArrayBuffer(bufferLength);
  const view = new DataView(buffer);

  // Header (80 bytes)
  const header = "ForgeLab STL Export - Ring Design";
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }

  // Triangle count
  view.setUint32(80, triangleCount, true);

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  let offset = 84;
  for (let t = 0; t < triangleCount; t++) {
    let i0: number, i1: number, i2: number;
    if (index) {
      i0 = index.getX(t * 3);
      i1 = index.getX(t * 3 + 1);
      i2 = index.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }

    vA.fromBufferAttribute(posAttr, i0);
    vB.fromBufferAttribute(posAttr, i1);
    vC.fromBufferAttribute(posAttr, i2);

    // Compute face normal
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    normal.crossVectors(cb, ab).normalize();

    // Write normal
    view.setFloat32(offset, normal.x, true); offset += 4;
    view.setFloat32(offset, normal.y, true); offset += 4;
    view.setFloat32(offset, normal.z, true); offset += 4;

    // Write vertices
    view.setFloat32(offset, vA.x, true); offset += 4;
    view.setFloat32(offset, vA.y, true); offset += 4;
    view.setFloat32(offset, vA.z, true); offset += 4;

    view.setFloat32(offset, vB.x, true); offset += 4;
    view.setFloat32(offset, vB.y, true); offset += 4;
    view.setFloat32(offset, vB.z, true); offset += 4;

    view.setFloat32(offset, vC.x, true); offset += 4;
    view.setFloat32(offset, vC.y, true); offset += 4;
    view.setFloat32(offset, vC.z, true); offset += 4;

    // Attribute byte count
    view.setUint16(offset, 0, true); offset += 2;
  }

  return buffer;
}

// ── Casting shrinkage profiles ───────────────────────────────────

export type ShrinkageMetal = "silver" | "gold" | "bronze" | "none";

export interface ShrinkageProfile {
  label: string;
  factor: number; // multiplicative scale, e.g. 1.02 = 2% oversize
  description: string;
}

export const SHRINKAGE_PROFILES: Record<ShrinkageMetal, ShrinkageProfile> = {
  none:   { label: "None (1:1)",        factor: 1.0,    description: "No compensation — export at exact design size" },
  silver: { label: "Sterling Silver",   factor: 1.018,  description: "~1.8% oversize to compensate for silver casting shrinkage" },
  gold:   { label: "14K Gold",          factor: 1.015,  description: "~1.5% oversize to compensate for gold alloy shrinkage" },
  bronze: { label: "Bronze",            factor: 1.022,  description: "~2.2% oversize to compensate for bronze casting shrinkage" },
};

// ── Public API ───────────────────────────────────────────────────

export interface STLExportResult {
  blob: Blob;
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  fileSizeKB: number;
  shrinkageMetal: ShrinkageMetal;
  scaleFactor: number;
}

export function generateExportSTL(
  params: RingParameters,
  lunar: LunarTextureState | null,
  engraving: EngravingState | null,
  shrinkage: ShrinkageMetal = "none",
): STLExportResult {
  const geometry = buildExportGeometry(params, lunar, engraving);

  // Apply shrinkage compensation by uniformly scaling the geometry
  const scaleFactor = SHRINKAGE_PROFILES[shrinkage]?.factor ?? 1.0;
  if (scaleFactor !== 1.0) {
    geometry.scale(scaleFactor, scaleFactor, scaleFactor);
    geometry.computeVertexNormals();
  }

  const stlBuffer = geometryToSTLBinary(geometry);
  const blob = new Blob([stlBuffer], { type: "application/octet-stream" });

  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : geometry.attributes.position.count / 3;

  return {
    blob,
    geometry,
    triangleCount,
    fileSizeKB: Math.round(stlBuffer.byteLength / 1024),
    shrinkageMetal: shrinkage,
    scaleFactor,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
