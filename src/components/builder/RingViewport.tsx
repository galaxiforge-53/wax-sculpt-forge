import { Canvas, useThree, ThreeEvent, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Text } from "@react-three/drei";
import { useMemo, forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect, Suspense } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { RingParameters, ViewMode, MetalPreset, FinishPreset, ToolType } from "@/types/ring";
import { LightingSettings, DEFAULT_LIGHTING } from "@/types/lighting";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { StampSettings } from "@/hooks/useRingDesign";
import { generateLunarSurfaceMaps } from "@/lib/lunarSurfaceMaps";
import { useIsMobile } from "@/hooks/use-mobile";
import MeasurementOverlay from "./MeasurementOverlay";

export type SnapshotAngle = "front" | "angle" | "side" | "inside";

export interface RingViewportHandle {
  captureSnapshot(
    anglePreset: SnapshotAngle,
    viewMode: ViewMode
  ): Promise<string>;
}

const CAMERA_PRESETS: Record<SnapshotAngle, [number, number, number]> = {
  front: [0, 0, 3.5],
  angle: [2.5, 1.8, 2.5],
  side: [3.5, 0.2, 0],
  inside: [0, -0.1, 0.6],  // looking into the ring bore
};

// ── Ring Mesh ─────────────────────────────────────────────────────

interface RingMeshProps {
  params: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  activeTool: ToolType | null;
  onAddWaxMark?: (mark: Omit<WaxMark, "id" | "createdAt">) => void;
  stampSettings?: StampSettings;
  lunarTexture?: LunarTextureState;
}

// ── Physically-based metal material configs ───────────────────────
interface MetalMaterialConfig {
  color: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  reflectivity: number;
  sheen: number;
  sheenColor: string;
  sheenRoughness: number;
  ior: number;
}

const METAL_CONFIGS: Record<MetalPreset, MetalMaterialConfig> = {
  silver: {
    color: "#D4D4D8",
    roughness: 0.12,
    metalness: 1.0,
    envMapIntensity: 2.5,
    clearcoat: 0.15,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
    sheen: 0.1,
    sheenColor: "#E8E8F0",
    sheenRoughness: 0.2,
    ior: 2.5,
  },
  gold: {
    color: "#D4A520",
    roughness: 0.1,
    metalness: 1.0,
    envMapIntensity: 3.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
    sheen: 0.15,
    sheenColor: "#FFE4A0",
    sheenRoughness: 0.15,
    ior: 2.5,
  },
  "rose-gold": {
    color: "#C47A6A",
    roughness: 0.12,
    metalness: 1.0,
    envMapIntensity: 2.8,
    clearcoat: 0.18,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
    sheen: 0.2,
    sheenColor: "#F0C0B0",
    sheenRoughness: 0.18,
    ior: 2.4,
  },
  titanium: {
    color: "#8A8A85",
    roughness: 0.22,
    metalness: 0.95,
    envMapIntensity: 1.8,
    clearcoat: 0.05,
    clearcoatRoughness: 0.15,
    reflectivity: 0.85,
    sheen: 0.05,
    sheenColor: "#B0B0B8",
    sheenRoughness: 0.4,
    ior: 2.6,
  },
  tungsten: {
    color: "#5A5A5E",
    roughness: 0.15,
    metalness: 1.0,
    envMapIntensity: 2.2,
    clearcoat: 0.1,
    clearcoatRoughness: 0.08,
    reflectivity: 0.95,
    sheen: 0.0,
    sheenColor: "#888888",
    sheenRoughness: 0.3,
    ior: 2.7,
  },
};

const FINISH_ROUGHNESS_MOD: Record<FinishPreset, number> = {
  polished: 0,
  satin: 0.15,
  brushed: 0.25,
  matte: 0.45,
  hammered: 0.1,
};

// ── STL-based lunar ring mesh ──────────────────────────────────────
function LunarSTLMesh({ params, viewMode, metalPreset, finishPreset, lunarTexture, activeTool, onAddWaxMark, stampSettings }: RingMeshProps) {
  const stlGeometry = useLoader(STLLoader, "/models/Ring_8_mm.stl");

  // Compute target dimensions from params
  const targetInnerR = params.innerDiameter / 2 / 10;
  const targetOuterR = targetInnerR + params.thickness / 10;
  const targetWidth = params.width / 10;
  const targetMidR = (targetInnerR + targetOuterR) / 2;

  const preparedGeometry = useMemo(() => {
    const geo = stlGeometry.clone();

    // Center the STL at origin
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);

    // Measure STL reference dimensions
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const stlWidth = bb.max.y - bb.min.y;
    const stlDiamX = bb.max.x - bb.min.x;
    const stlDiamZ = bb.max.z - bb.min.z;
    const stlOuterR = Math.max(stlDiamX, stlDiamZ) / 2;

    // UNIFORM scale based on outer radius to preserve crater proportions
    const uniformScale = targetOuterR / stlOuterR;
    geo.scale(uniformScale, uniformScale, uniformScale);

    // Now adjust width independently by scaling only Y
    // to match target width while keeping craters round in XZ
    geo.computeBoundingBox();
    const currentWidth = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    if (currentWidth > 0.001) {
      const widthCorrection = targetWidth / currentWidth;
      // Clamp width correction to avoid extreme distortion
      const clampedCorrection = Math.max(0.5, Math.min(2.0, widthCorrection));
      if (Math.abs(clampedCorrection - 1.0) > 0.01) {
        // Full Y-axis width correction — wider clamp range for accurate sizing
        const finalCorrection = clampedCorrection;
        const posAttr = geo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          posAttr.setY(i, posAttr.getY(i) * finalCorrection);
        }
        posAttr.needsUpdate = true;
      }
    }

    // Generate UVs (cylindrical projection)
    const pos = geo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    geo.computeBoundingBox();
    const finalBB = geo.boundingBox!;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const u = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) % 1;
      const v = (y - finalBB.min.y) / (finalBB.max.y - finalBB.min.y);
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("uv2", new THREE.BufferAttribute(uvs.slice(), 2));

    geo.computeVertexNormals();
    return geo;
  }, [stlGeometry, targetOuterR, targetWidth]);

  const isWax = viewMode === "wax";
  const isWaxPrint = viewMode === "wax-print";
  const mc = METAL_CONFIGS[metalPreset] ?? METAL_CONFIGS.silver;
  const finishRoughMod = FINISH_ROUGHNESS_MOD[finishPreset] ?? 0;

  // Compute physical aspect ratio: circumference / width so craters are circular
  const physicalAspect = useMemo(() => {
    const outerDiam = params.innerDiameter + 2 * params.thickness;
    const circumference = Math.PI * outerDiam;
    const width = params.width;
    return width > 0 ? circumference / width : 1;
  }, [params.innerDiameter, params.thickness, params.width]);

  // Generate procedural maps for micro-detail enhancement on top of real geometry
  const lunarMaps = useMemo(() => {
    if (!lunarTexture?.enabled) return null;
    return generateLunarSurfaceMaps(lunarTexture, physicalAspect);
  }, [
    lunarTexture?.enabled, lunarTexture?.seed, lunarTexture?.intensity,
    lunarTexture?.craterDensity, lunarTexture?.craterSize,
    lunarTexture?.microDetail, lunarTexture?.rimSharpness,
    lunarTexture?.overlapIntensity, lunarTexture?.smoothEdges,
    lunarTexture?.rimHeight, lunarTexture?.bowlDepth,
    lunarTexture?.erosion, lunarTexture?.terrainRoughness,
    lunarTexture?.craterVariation,
    physicalAspect,
  ]);

  const normalScale = useMemo(() => {
    if (!lunarTexture?.enabled) return new THREE.Vector2(0, 0);
    // Subtle normal map on top of real geometry for micro grain/pitting detail
    const strength = 0.2 + (lunarTexture.intensity / 100) * 0.5;
    return new THREE.Vector2(strength, -strength);
  }, [lunarTexture?.enabled, lunarTexture?.intensity]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "wax" || activeTool !== "stamp" || !onAddWaxMark) return;
    e.stopPropagation();
    const point = e.point;
    const normal = e.face?.normal ?? new THREE.Vector3(0, 1, 0);
    const worldNormal = normal.clone();
    if (e.object) worldNormal.transformDirection(e.object.matrixWorld);
    onAddWaxMark({
      type: stampSettings?.type ?? "dent",
      position: { x: point.x, y: point.y, z: point.z },
      normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      radiusMm: stampSettings?.radiusMm ?? 1.2,
      intensity: stampSettings?.intensity ?? 0.65,
    });
  }, [viewMode, activeTool, onAddWaxMark, stampSettings]);

  return (
    <mesh
      geometry={preparedGeometry}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      onPointerDown={handlePointerDown}
    >
      {isWaxPrint ? (
        <meshStandardMaterial
          color="#C8B896"
          roughness={0.6}
          metalness={0.0}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={2.0}
          normalScale={normalScale}
        />
      ) : isWax ? (
        <meshStandardMaterial
          color="#78A85B"
          roughness={0.82}
          metalness={0.05}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={1.2}
          normalScale={normalScale}
        />
      ) : (
        <meshPhysicalMaterial
          color={mc.color}
          roughness={Math.min(1, mc.roughness + finishRoughMod)}
          metalness={mc.metalness}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={1.8}
          normalScale={normalScale}
          envMapIntensity={mc.envMapIntensity}
          clearcoat={mc.clearcoat}
          clearcoatRoughness={mc.clearcoatRoughness}
          reflectivity={mc.reflectivity}
          sheen={mc.sheen}
          sheenColor={mc.sheenColor}
          sheenRoughness={mc.sheenRoughness}
          ior={mc.ior}
        />
      )}
    </mesh>
  );
}

// ── Build solid ring geometry with separate outer, inner, and cap surfaces ──
function buildSolidRingGeometry(params: RingParameters, hasLunar: boolean) {
  const innerR = params.innerDiameter / 2 / 10;
  const outerR = innerR + params.thickness / 10;
  const halfW = params.width / 2 / 10;
  const bevel = params.bevelSize / 10;

  const radSegs = hasLunar ? 512 : 128;
  const profileSteps = hasLunar ? 128 : 32;

  // Build outer profile curve (only outer surface, from one edge to other)
  const outerPoints: THREE.Vector2[] = [];
  if (params.profile === "dome" || params.profile === "comfort") {
    for (let i = 0; i <= profileSteps; i++) {
      const t = i / profileSteps;
      const angle = t * Math.PI;
      const r = innerR + (outerR - innerR) * (0.5 + 0.5 * Math.sin(angle));
      const y = (t - 0.5) * halfW * 2;
      outerPoints.push(new THREE.Vector2(r, y));
    }
  } else if (params.profile === "flat") {
    if (hasLunar) {
      for (let i = 0; i <= profileSteps; i++) {
        const t = i / profileSteps;
        const y = (t - 0.5) * halfW * 2;
        const edgeDist = Math.min(t, 1 - t);
        const bevelT = Math.min(1, edgeDist / (bevel / (halfW * 2) + 0.01));
        const r = innerR + (outerR - innerR) * Math.min(1, bevelT);
        outerPoints.push(new THREE.Vector2(r, y));
      }
    } else {
      const b = Math.min(bevel, halfW * 0.4);
      outerPoints.push(new THREE.Vector2(outerR - b, -halfW));
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        outerPoints.push(new THREE.Vector2(
          outerR - b + b * Math.sin(t * Math.PI / 2),
          -halfW + b * (1 - Math.cos(t * Math.PI / 2))
        ));
      }
      outerPoints.push(new THREE.Vector2(outerR, -halfW + b));
      outerPoints.push(new THREE.Vector2(outerR, halfW - b));
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        outerPoints.push(new THREE.Vector2(
          outerR - b * Math.sin(t * Math.PI / 2),
          halfW - b + b * Math.sin(t * Math.PI / 2) // fixed: was incorrect
        ));
      }
    }
  } else if (params.profile === "knife-edge") {
    for (let i = 0; i <= profileSteps; i++) {
      const t = i / profileSteps;
      const angle = t * Math.PI;
      const bulge = Math.pow(Math.sin(angle), 0.5);
      const r = innerR + (outerR - innerR) * bulge;
      const y = (t - 0.5) * halfW * 2;
      outerPoints.push(new THREE.Vector2(r, y));
    }
  } else { // square
    for (let i = 0; i <= profileSteps; i++) {
      const t = i / profileSteps;
      const y = (t - 0.5) * halfW * 2;
      outerPoints.push(new THREE.Vector2(outerR, y));
    }
  }

  // 1. Outer surface — LatheGeometry (this gets lunar textures)
  const outerGeo = new THREE.LatheGeometry(outerPoints, radSegs);
  outerGeo.computeVertexNormals();

  // 2. Inner bore — smooth cylinder (NO lunar texture, just polished inner surface)
  const innerGeo = new THREE.CylinderGeometry(innerR, innerR, halfW * 2, radSegs, 1, true);
  // Flip normals inward for inner bore
  const innerPos = innerGeo.attributes.position;
  const innerNorm = innerGeo.attributes.normal;
  for (let i = 0; i < innerNorm.count; i++) {
    innerNorm.setXYZ(i, -innerNorm.getX(i), -innerNorm.getY(i), -innerNorm.getZ(i));
  }
  // Flip face winding
  const innerIdx = innerGeo.index;
  if (innerIdx) {
    const arr = innerIdx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i];
      arr[i] = arr[i + 2];
      arr[i + 2] = tmp;
    }
  }

  // 3. End caps — ring-shaped annular discs connecting outer edge to inner bore
  const capGeoTop = new THREE.RingGeometry(innerR, outerPoints[outerPoints.length - 1].x, radSegs, 1);
  capGeoTop.rotateX(-Math.PI / 2);
  capGeoTop.translate(0, halfW, 0);

  const capGeoBot = new THREE.RingGeometry(innerR, outerPoints[0].x, radSegs, 1);
  capGeoBot.rotateX(Math.PI / 2);
  capGeoBot.translate(0, -halfW, 0);

  return { outerGeo, innerGeo, capGeoTop, capGeoBot };
}

// ── Procedural ring mesh — SOLID with separate inner/outer/cap surfaces ──────
function ProceduralRingMesh({ params, viewMode, metalPreset, finishPreset, activeTool, onAddWaxMark, stampSettings, lunarTexture }: RingMeshProps) {
  const hasLunar = !!lunarTexture?.enabled;

  const { outerGeo, innerGeo, capGeoTop, capGeoBot } = useMemo(
    () => buildSolidRingGeometry(params, hasLunar),
    [params, hasLunar]
  );

  const isWax = viewMode === "wax";
  const isWaxPrint = viewMode === "wax-print";
  const mc = METAL_CONFIGS[metalPreset] ?? METAL_CONFIGS.silver;
  const finishRoughMod = FINISH_ROUGHNESS_MOD[finishPreset] ?? 0;

  // Compute physical aspect ratio for circular craters
  const physicalAspect = useMemo(() => {
    const outerDiam = params.innerDiameter + 2 * params.thickness;
    const circumference = Math.PI * outerDiam;
    const width = params.width;
    return width > 0 ? circumference / width : 1;
  }, [params.innerDiameter, params.thickness, params.width]);

  // Generate lunar procedural maps for outer surface only
  const lunarMaps = useMemo(() => {
    if (!lunarTexture?.enabled) return null;
    return generateLunarSurfaceMaps(lunarTexture, physicalAspect);
  }, [
    lunarTexture?.enabled, lunarTexture?.seed, lunarTexture?.intensity,
    lunarTexture?.craterDensity, lunarTexture?.craterSize,
    lunarTexture?.microDetail, lunarTexture?.rimSharpness,
    lunarTexture?.overlapIntensity, lunarTexture?.smoothEdges,
    lunarTexture?.rimHeight, lunarTexture?.bowlDepth,
    lunarTexture?.erosion, lunarTexture?.terrainRoughness,
    lunarTexture?.craterVariation,
    physicalAspect,
  ]);

  const normalScale = useMemo(() => {
    if (!lunarTexture?.enabled) return new THREE.Vector2(0, 0);
    const strength = 1.5 + (lunarTexture.intensity / 100) * 3.0;
    return new THREE.Vector2(strength, -strength);
  }, [lunarTexture?.enabled, lunarTexture?.intensity]);

  const dispScale = useMemo(() => {
    if (!hasLunar || !lunarTexture) return 0;
    const outerR = params.innerDiameter / 2 / 10 + params.thickness / 10;
    return outerR * (0.04 + (lunarTexture.intensity / 100) * 0.10);
  }, [hasLunar, lunarTexture?.intensity, params.innerDiameter, params.thickness]);

  // Map active tool to wax mark type for sculpting tools
  const SCULPT_TOOL_MAP: Record<string, import("@/types/waxmarks").WaxMarkType> = {
    stamp: stampSettings?.type ?? "dent",
    push: "push",
    "sculpt-carve": "carve-sculpt",
    "sculpt-smooth": "smooth-sculpt",
  };

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "wax" || !onAddWaxMark) return;
    const markType = SCULPT_TOOL_MAP[activeTool ?? ""];
    if (!markType) return;
    e.stopPropagation();
    const point = e.point;
    const normal = e.face?.normal ?? new THREE.Vector3(0, 1, 0);
    const worldNormal = normal.clone();
    if (e.object) worldNormal.transformDirection(e.object.matrixWorld);
    onAddWaxMark({
      type: markType,
      position: { x: point.x, y: point.y, z: point.z },
      normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      radiusMm: stampSettings?.radiusMm ?? 1.2,
      intensity: stampSettings?.intensity ?? 0.65,
    });
  }, [viewMode, activeTool, onAddWaxMark, stampSettings]);

  // Outer material — has lunar textures
  const outerMaterial = useMemo(() => {
    if (isWaxPrint) {
      return (
        <meshStandardMaterial
          color="#C8B896"
          roughness={0.6}
          metalness={0.0}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={hasLunar ? 2.5 : 0.5}
          normalScale={normalScale}
          displacementMap={hasLunar ? lunarMaps?.displacementMap ?? null : null}
          displacementScale={dispScale}
          displacementBias={-dispScale * 0.5}
          side={THREE.FrontSide}
        />
      );
    }
    if (isWax) {
      return (
        <meshStandardMaterial
          color="#78A85B"
          roughness={hasLunar ? 0.82 : 0.85}
          metalness={0.05}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={hasLunar ? 1.4 : 0}
          normalScale={normalScale}
          displacementMap={hasLunar ? lunarMaps?.displacementMap ?? null : null}
          displacementScale={dispScale}
          displacementBias={-dispScale * 0.5}
          side={THREE.FrontSide}
        />
      );
    }
    return (
      <meshPhysicalMaterial
        color={mc.color}
        roughness={Math.min(1, (hasLunar ? mc.roughness + 0.15 : mc.roughness) + finishRoughMod)}
        metalness={mc.metalness}
        normalMap={lunarMaps?.normalMap ?? null}
        roughnessMap={lunarMaps?.roughnessMap ?? null}
        aoMap={lunarMaps?.aoMap ?? null}
        aoMapIntensity={hasLunar ? 2.0 : 0}
        normalScale={normalScale}
        envMapIntensity={mc.envMapIntensity}
        clearcoat={hasLunar ? mc.clearcoat : mc.clearcoat * 1.5}
        clearcoatRoughness={mc.clearcoatRoughness}
        reflectivity={mc.reflectivity}
        sheen={mc.sheen}
        sheenColor={mc.sheenColor}
        sheenRoughness={mc.sheenRoughness}
        ior={mc.ior}
        displacementMap={hasLunar ? lunarMaps?.displacementMap ?? null : null}
        displacementScale={dispScale}
        displacementBias={-dispScale * 0.5}
        side={THREE.FrontSide}
      />
    );
  }, [isWax, isWaxPrint, mc, finishRoughMod, lunarMaps, normalScale, hasLunar, dispScale]);

  // Inner bore material — always smooth, polished, NO lunar texture
  const innerMaterial = useMemo(() => {
    if (isWaxPrint) {
      return <meshStandardMaterial color="#D4CFC0" roughness={0.35} metalness={0.0} side={THREE.FrontSide} />;
    }
    if (isWax) {
      return <meshStandardMaterial color="#6B9650" roughness={0.5} metalness={0.05} side={THREE.FrontSide} />;
    }
    return (
      <meshPhysicalMaterial
        color={mc.color}
        roughness={Math.min(1, mc.roughness * 0.6 + finishRoughMod * 0.3)}
        metalness={mc.metalness}
        envMapIntensity={mc.envMapIntensity * 0.8}
        clearcoat={0.4}
        clearcoatRoughness={0.03}
        reflectivity={mc.reflectivity}
        ior={mc.ior}
        side={THREE.FrontSide}
      />
    );
  }, [isWax, isWaxPrint, mc, finishRoughMod]);

  // Cap material — matches inner but matte
  const capMaterial = useMemo(() => {
    if (isWaxPrint) {
      return <meshStandardMaterial color="#C8B896" roughness={0.55} metalness={0.0} side={THREE.DoubleSide} />;
    }
    if (isWax) {
      return <meshStandardMaterial color="#6E9A55" roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />;
    }
    return (
      <meshPhysicalMaterial
        color={mc.color}
        roughness={Math.min(1, mc.roughness + 0.05 + finishRoughMod)}
        metalness={mc.metalness}
        envMapIntensity={mc.envMapIntensity * 0.7}
        clearcoat={mc.clearcoat * 0.5}
        clearcoatRoughness={mc.clearcoatRoughness}
        reflectivity={mc.reflectivity * 0.9}
        ior={mc.ior}
        side={THREE.DoubleSide}
      />
    );
  }, [isWax, isWaxPrint, mc, finishRoughMod]);

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {/* Outer surface — textured with lunar/displacement */}
      <mesh geometry={outerGeo} castShadow onPointerDown={handlePointerDown}>
        {outerMaterial}
      </mesh>

      {/* Inner bore — smooth polished surface */}
      <mesh geometry={innerGeo} castShadow>
        {innerMaterial}
      </mesh>

      {/* End caps */}
      <mesh geometry={capGeoTop} castShadow>
        {capMaterial}
      </mesh>
      <mesh geometry={capGeoBot} castShadow>
        {capMaterial}
      </mesh>
    </group>
  );
}

// ── Wrapper ───────────────────────────────────────────────────────
function RingMesh(props: RingMeshProps) {
  return <ProceduralRingMesh {...props} />;
}

// ── Visual config per wax mark type ──
const WAX_MARK_VISUALS: Record<string, { color: string; opacity: number; scale: number; shape: "circle" | "sphere" | "box" }> = {
  dent:           { color: "#2a4a22", opacity: 0.45, scale: 1.0, shape: "circle" },
  scratch:        { color: "#3a3a1f", opacity: 0.35, scale: 0.6, shape: "box" },
  chisel:         { color: "#1f2f1f", opacity: 0.5,  scale: 1.1, shape: "box" },
  "heat-soften":  { color: "#5a4a22", opacity: 0.3,  scale: 1.4, shape: "sphere" },
  push:           { color: "#1a3a3a", opacity: 0.55, scale: 1.0, shape: "sphere" },
  "carve-sculpt": { color: "#3a1a1a", opacity: 0.6,  scale: 0.8, shape: "box" },
  "smooth-sculpt":{ color: "#2a3a4a", opacity: 0.25, scale: 1.5, shape: "sphere" },
};

// Render wax marks as 3D sculpting indicators
function WaxMarkOverlays({ marks }: { marks: WaxMark[] }) {
  const visible = marks.slice(-120);

  return (
    <>
      {visible.map((mark) => {
        const pos = new THREE.Vector3(mark.position.x, mark.position.y, mark.position.z);
        const norm = new THREE.Vector3(mark.normal.x, mark.normal.y, mark.normal.z).normalize();
        const vis = WAX_MARK_VISUALS[mark.type] ?? WAX_MARK_VISUALS.dent;
        const radius = mark.radiusMm / 10;

        // Push/carve displace inward, smooth stays on surface
        const displaceDir = mark.type === "push" || mark.type === "carve-sculpt" ? -1 : 1;
        const displaceAmount = mark.type === "smooth-sculpt" ? 0.001 : radius * 0.3 * mark.intensity * displaceDir;
        const offset = pos.clone().add(norm.clone().multiplyScalar(mark.type === "push" || mark.type === "carve-sculpt" ? -displaceAmount : 0.002));

        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
        const euler = new THREE.Euler().setFromQuaternion(quat);
        const s = radius * vis.scale;

        return (
          <mesh
            key={mark.id}
            position={[offset.x, offset.y, offset.z]}
            rotation={euler}
            scale={mark.type === "carve-sculpt" ? [s * 0.4, s * 1.8, s] : undefined}
          >
            {vis.shape === "sphere" ? (
              <sphereGeometry args={[s, 12, 12]} />
            ) : vis.shape === "box" ? (
              <boxGeometry args={[s * 1.5, s * 0.3, s]} />
            ) : (
              <circleGeometry args={[s, 16]} />
            )}
            <meshStandardMaterial
              color={vis.color}
              transparent
              opacity={mark.intensity * vis.opacity}
              depthWrite={false}
              side={THREE.DoubleSide}
              roughness={0.9}
            />
          </mesh>
        );
      })}
    </>
  );
}

// Render inlay channel band markers as translucent rings
function InlayBandMarkers({ inlays, params }: { inlays: InlayChannel[]; params: RingParameters }) {
  const innerRadius = params.innerDiameter / 2 / 10;
  const outerRadius = innerRadius + params.thickness / 10;
  const midRadius = (innerRadius + outerRadius) / 2 + 0.002;
  const ringWidth = params.width / 10;

  const materialColor: Record<string, string> = {
    crystal: "#88ccff",
    opal: "#ffaadd",
    meteorite: "#aaaaaa",
  };

  return (
    <>
      {inlays.slice(0, 20).map((ch) => {
        const yOffset =
          ch.placement === "center" ? 0
          : ch.placement === "edgeLeft" ? -ringWidth * 0.35
          : ringWidth * 0.35;
        const bandWidth = ch.channelWidthMm / 10;
        return (
          <mesh key={ch.id} rotation={[Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
            <torusGeometry args={[midRadius, bandWidth / 2, 8, 64]} />
            <meshBasicMaterial
              color={materialColor[ch.materialType] ?? "#88ccff"}
              transparent
              opacity={0.35}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ── Interior Engraving Text ────────────────────────────────────────
function EngravingText3D({ params, engraving }: { params: RingParameters; engraving: EngravingState }) {
  if (!engraving.enabled || !engraving.text) return null;

  const innerR = params.innerDiameter / 2 / 10;
  const depthOffset = engraving.depthMm / 10;
  const textR = innerR - depthOffset * 0.5;
  const fontSize = engraving.sizeMm / 10;
  const letterSpacing = engraving.spacingMm / 10;

  const chars = engraving.text.split("");
  const charWidth = fontSize * 0.6 + letterSpacing;
  const totalArc = chars.length * charWidth;
  const circumference = 2 * Math.PI * textR;
  const arcFraction = totalArc / circumference;
  const startAngle = -arcFraction * Math.PI;

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {chars.map((char, i) => {
        const angle = startAngle + (i + 0.5) * (charWidth / textR);
        const x = Math.cos(angle) * textR;
        const z = Math.sin(angle) * textR;
        const rotY = -angle + Math.PI / 2;

        return (
          <Text
            key={`${i}-${char}`}
            position={[x, 0, z]}
            rotation={[0, rotY, 0]}
            fontSize={fontSize}
            color="#555555"
            anchorX="center"
            anchorY="middle"
          >
            {char}
          </Text>
        );
      })}
    </group>
  );
}

function SnapshotHelper({ onReady }: { onReady: (api: { capture: (pos: [number, number, number]) => Promise<string> }) => void }) {
  const { gl, camera, scene } = useThree();
  const captureRef = useRef<(pos: [number, number, number]) => Promise<string>>();

  captureRef.current = useCallback(async (pos: [number, number, number]) => {
    const origPos = camera.position.clone();
    const origSize = gl.getSize(new THREE.Vector2());
    const origPixelRatio = gl.getPixelRatio();

    // Boost render resolution to 1024x1024
    const snapshotSize = 1024;
    gl.setPixelRatio(1);
    gl.setSize(snapshotSize, snapshotSize, false);

    // Auto-frame: compute scene bounding box and position camera so ring fills ~70%
    const bbox = new THREE.Box3();
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) bbox.expandByObject(obj);
    });
    const sphere = new THREE.Sphere();
    bbox.getBoundingSphere(sphere);
    const ringCenter = sphere.center.clone();
    const ringRadius = sphere.radius || 1;

    // Calculate distance so ring fills 70% of frame
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const fillRatio = 0.70;
    const halfFovRad = THREE.MathUtils.degToRad(fov / 2);
    const idealDist = (ringRadius / fillRatio) / Math.tan(halfFovRad);

    // Position camera at the preset direction but at the ideal distance
    const dir = new THREE.Vector3(...pos).normalize();
    const camPos = ringCenter.clone().add(dir.multiplyScalar(idealDist));

    camera.position.copy(camPos);
    (camera as THREE.PerspectiveCamera).aspect = 1;
    camera.lookAt(ringCenter);
    camera.updateProjectionMatrix();
    gl.render(scene, camera);

    let dataUrl = "";
    try {
      dataUrl = gl.domElement.toDataURL("image/webp", 0.92);
      if (!dataUrl || dataUrl.length < 100) {
        dataUrl = gl.domElement.toDataURL("image/png");
      }
    } catch {
      dataUrl = "";
    }

    // Restore original state
    camera.position.copy(origPos);
    (camera as THREE.PerspectiveCamera).aspect = origSize.x / origSize.y;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    gl.setPixelRatio(origPixelRatio);
    gl.setSize(origSize.x, origSize.y, false);

    return dataUrl;
  }, [gl, camera, scene]);

  useMemo(() => {
    onReady({
      capture: (pos) => captureRef.current!(pos),
    });
  }, [onReady]);

  return null;
}

// ── Forge Workbench Environment ────────────────────────────────────
function WorkbenchGrid({ params }: { params: RingParameters }) {
  const outerR = (params.innerDiameter / 2 + params.thickness) / 10;
  const gridY = -(outerR + 0.12); // Position grid just below the ring's outer radius
  const outerDiam = (params.innerDiameter + 2 * params.thickness) / 10;
  const gridSize = Math.max(3, Math.ceil(outerDiam * 3));
  const majorDivisions = gridSize; // every 10mm
  const minorDivisions = gridSize * 5; // every 2mm

  const scaleLen = 1; // 10mm

  return (
    <group position={[0, gridY, 0]}>
      {/* Measurement bed plane — very subtle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[gridSize, gridSize]} />
        <meshStandardMaterial
          color="#141418"
          roughness={0.98}
          metalness={0.02}
          transparent
          opacity={0.45}
        />
      </mesh>

      {/* Minor grid — very faint 2mm lines */}
      <gridHelper
        args={[gridSize, minorDivisions, "#252530", "#1e1e26"]}
        position={[0, 0.001, 0]}
      />

      {/* Major grid — 10mm lines slightly brighter */}
      <gridHelper
        args={[gridSize, majorDivisions, "#3a3a48", "#282832"]}
        position={[0, 0.002, 0]}
      />

      {/* Scale indicator bar with label */}
      <group position={[gridSize * 0.32, 0.003, gridSize * 0.32]}>
        <mesh>
          <boxGeometry args={[scaleLen, 0.003, 0.015]} />
          <meshBasicMaterial color="#555570" />
        </mesh>
        <mesh position={[-scaleLen / 2, 0, 0]}>
          <boxGeometry args={[0.004, 0.003, 0.04]} />
          <meshBasicMaterial color="#555570" />
        </mesh>
        <mesh position={[scaleLen / 2, 0, 0]}>
          <boxGeometry args={[0.004, 0.003, 0.04]} />
          <meshBasicMaterial color="#555570" />
        </mesh>
        {/* 10mm label */}
        <Text
          position={[0, 0.01, 0.05]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.06}
          color="#555570"
          anchorX="center"
          anchorY="middle"
        >
          10 mm
        </Text>
      </group>
    </group>
  );
}

// ── Camera Preset Animator ──────────────────────────────────────────
function CameraPresetAnimator({ targetPreset, onComplete }: { targetPreset: SnapshotAngle | null; onComplete: () => void }) {
  const { camera } = useThree();
  const animating = useRef(false);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const progress = useRef(0);

  useEffect(() => {
    if (!targetPreset) return;
    const pos = CAMERA_PRESETS[targetPreset];
    startPos.current.copy(camera.position);
    endPos.current.set(...pos);
    progress.current = 0;
    animating.current = true;
  }, [targetPreset, camera]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    progress.current = Math.min(1, progress.current + delta * 3);
    const t = 1 - Math.pow(1 - progress.current, 3); // ease-out cubic
    camera.position.lerpVectors(startPos.current, endPos.current, t);
    camera.lookAt(0, 0, 0);
    if (progress.current >= 1) {
      animating.current = false;
      onComplete();
    }
  });

  return null;
}

// ── 3D Printer Bed Simulation ──────────────────────────────────────
function PrinterBedSimulation({ params }: { params: RingParameters }) {
  const outerR = (params.innerDiameter / 2 + params.thickness) / 10;
  const bedY = -(outerR + 0.12);
  const bedSize = 12; // 120mm build plate
  const outerDiam = (params.innerDiameter + 2 * params.thickness) / 10;
  const ringWidth = params.width / 10;

  // Concentric circles for build area reference
  const circleSegs = 64;
  const circleRadii = [2, 4, 6]; // 20mm, 40mm, 60mm radius circles

  return (
    <group position={[0, bedY, 0]}>
      {/* Printer bed platform — raised aluminum look */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <boxGeometry args={[bedSize, bedSize, 0.08]} />
        <meshStandardMaterial color="#2a2a30" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Build surface — slightly inset glass/flex plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.041, 0]}>
        <planeGeometry args={[bedSize - 0.3, bedSize - 0.3]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.6} metalness={0.3} transparent opacity={0.9} />
      </mesh>

      {/* Grid lines — print bed grid */}
      <gridHelper
        args={[bedSize - 0.3, 12, "#3a3a4a", "#252530"]}
        position={[0, 0.045, 0]}
      />
      <gridHelper
        args={[bedSize - 0.3, 60, "#1e1e28", "#1a1a24"]}
        position={[0, 0.044, 0]}
      />

      {/* Concentric build area circles */}
      {circleRadii.map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.046, 0]}>
          <torusGeometry args={[r, 0.005, 4, circleSegs]} />
          <meshBasicMaterial color="#3a3a50" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Center crosshair */}
      <group position={[0, 0.047, 0]}>
        <mesh>
          <boxGeometry args={[0.6, 0.001, 0.008]} />
          <meshBasicMaterial color="#5a5a70" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.008, 0.001, 0.6]} />
          <meshBasicMaterial color="#5a5a70" />
        </mesh>
      </group>

      {/* Ring footprint outline — shows print contact area */}
      {(() => {
        const innerR = params.innerDiameter / 2 / 10;
        return (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.048, 0]}>
              <torusGeometry args={[outerR, 0.006, 4, circleSegs]} />
              <meshBasicMaterial color="#ff6644" transparent opacity={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.048, 0]}>
              <torusGeometry args={[innerR, 0.004, 4, circleSegs]} />
              <meshBasicMaterial color="#ff6644" transparent opacity={0.4} />
            </mesh>
          </>
        );
      })()}

      {/* Scale rulers — X and Z axes */}
      {[
        { axis: "X", pos: [0, 0.05, -bedSize / 2 + 0.3] as [number, number, number], rot: [0, 0, 0] as [number, number, number] },
        { axis: "Z", pos: [-bedSize / 2 + 0.3, 0.05, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number] },
      ].map(({ axis, pos, rot }) => (
        <group key={axis} position={pos} rotation={rot}>
          {/* Ruler ticks every 10mm */}
          {Array.from({ length: 13 }, (_, i) => {
            const x = (i - 6) * 1; // 10mm spacing = 1 unit
            const isMajor = i % 2 === 0;
            return (
              <group key={i} position={[x, 0, 0]}>
                <mesh>
                  <boxGeometry args={[0.005, 0.001, isMajor ? 0.12 : 0.06]} />
                  <meshBasicMaterial color={isMajor ? "#6a6a80" : "#4a4a5a"} />
                </mesh>
                {isMajor && (
                  <Text
                    position={[0, 0, 0.14]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.04}
                    color="#6a6a80"
                    anchorX="center"
                    anchorY="middle"
                  >
                    {`${(i - 6) * 10}`}
                  </Text>
                )}
              </group>
            );
          })}
        </group>
      ))}

      {/* Dimension callouts */}
      <Text
        position={[bedSize / 2 - 0.5, 0.06, bedSize / 2 - 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.06}
        color="#5a7a5a"
        anchorX="right"
        anchorY="middle"
      >
        {`⌀${outerDiam.toFixed(1)}mm × ${ringWidth.toFixed(1)}mm`}
      </Text>

      {/* Build plate label */}
      <Text
        position={[-bedSize / 2 + 0.5, 0.06, bedSize / 2 - 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.05}
        color="#4a4a5a"
        anchorX="left"
        anchorY="middle"
      >
        120×120mm Build Plate
      </Text>

      {/* Platform legs — subtle industrial look */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} position={[x * (bedSize / 2 - 0.3), -0.15, z * (bedSize / 2 - 0.3)]}>
          <cylinderGeometry args={[0.08, 0.1, 0.26, 8]} />
          <meshStandardMaterial color="#222228" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export type CutawayMode = "normal" | "inside" | "cross-section";

interface RingViewportProps {
  params: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset?: FinishPreset;
  activeTool?: ToolType | null;
  onAddWaxMark?: (mark: Omit<WaxMark, "id" | "createdAt">) => void;
  waxMarks?: WaxMark[];
  stampSettings?: StampSettings;
  inlays?: InlayChannel[];
  lunarTexture?: LunarTextureState;
  cameraPreset?: SnapshotAngle | null;
  onPresetApplied?: () => void;
  showMeasurements?: boolean;
  engraving?: EngravingState;
  cutawayMode?: CutawayMode;
  lighting?: LightingSettings;
  showcaseMode?: boolean;
  ringPosition?: [number, number, number];
  ringRotation?: [number, number, number];
  showPrinterBed?: boolean;
}

// ── Clipping plane manager ─────────────────────────────────────────
function ClipPlaneManager({ mode }: { mode: CutawayMode }) {
  const { gl } = useThree();

  const clipPlane = useMemo(() => {
    if (mode === "cross-section") {
      // Clip along Z axis — shows cross-section from front
      return new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    }
    if (mode === "inside") {
      // Clip top half — reveals interior bore
      return new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.001);
    }
    return null;
  }, [mode]);

  useEffect(() => {
    if (clipPlane) {
      gl.clippingPlanes = [clipPlane];
      gl.localClippingEnabled = true;
    } else {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
    }
    return () => {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
    };
  }, [clipPlane, gl]);

  return null;
}

const RingViewport = forwardRef<RingViewportHandle, RingViewportProps>(
  function RingViewport({ params, viewMode, metalPreset, finishPreset = "polished", activeTool, onAddWaxMark, waxMarks, stampSettings, inlays, lunarTexture, engraving, cameraPreset, onPresetApplied, showMeasurements, cutawayMode = "normal", lighting: lightingProp, showcaseMode = false, ringPosition, ringRotation, showPrinterBed = false }, ref) {
    const lighting = lightingProp ?? DEFAULT_LIGHTING;
    const sc = showcaseMode;
    const rPos = ringPosition ?? [0, 0, 0];
    const rRot = ringRotation ?? [0, 0, 0];
    const snapshotApiRef = useRef<{ capture: (pos: [number, number, number]) => Promise<string> } | null>(null);
    const isMobile = useIsMobile();

    const handleSnapshotReady = useCallback((api: { capture: (pos: [number, number, number]) => Promise<string> }) => {
      snapshotApiRef.current = api;
    }, []);

    useImperativeHandle(ref, () => ({
      async captureSnapshot(anglePreset, _viewMode) {
        if (!snapshotApiRef.current) return "";
        try {
          const pos = CAMERA_PRESETS[anglePreset];
          return await snapshotApiRef.current.capture(pos);
        } catch {
          return "";
        }
      },
    }), []);

    // Closer camera on mobile so ring fills screen
    const initialCamPos: [number, number, number] = isMobile ? [0, 1.4, 2.8] : [0, 2, 4];

    return (
      <div className="w-full h-full bg-forge-dark rounded-lg overflow-hidden touch-none">
        <Canvas
          camera={{ position: initialCamPos, fov: isMobile ? 30 : 35 }}
          shadows={sc ? "soft" : true}
          gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: sc ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping, toneMappingExposure: sc ? 1.1 : 1.0 }}
          dpr={sc ? [2, 2] : (isMobile ? [1, 1.5] : [1, 2])}
        >
          <ClipPlaneManager mode={cutawayMode} />

          {/* Dynamic lighting from Lighting Studio */}
          {(() => {
            // Compute key light position from azimuth/elevation
            const azRad = (lighting.azimuth * Math.PI) / 180;
            const elRad = (lighting.elevation * Math.PI) / 180;
            const dist = 6;
            const keyX = Math.sin(azRad) * Math.cos(elRad) * dist;
            const keyY = Math.sin(elRad) * dist;
            const keyZ = Math.cos(azRad) * Math.cos(elRad) * dist;
            // Fill from opposite
            const fillX = -keyX * 0.7;
            const fillY = keyY * 0.4;
            const fillZ = -keyZ * 0.7;
            // Warmth → color
            const w = lighting.warmth / 100;
            const keyR = Math.round(255 * (0.85 + 0.15 * w));
            const keyG = Math.round(255 * (0.9 + 0.1 * w - 0.05 * (1 - w)));
            const keyB = Math.round(255 * (0.75 + 0.25 * (1 - w)));
            const keyColor = `rgb(${keyR},${keyG},${keyB})`;
            const fillColor = viewMode === "wax" ? "#ffe8c0" : "#d8e0f8";

            if (viewMode === "wax-print") {
              return (
                <>
                  <ambientLight intensity={lighting.ambientIntensity + 0.3} color="#f5f0e8" />
                  <directionalLight position={[keyX, keyY, keyZ]} intensity={lighting.keyIntensity * 0.6} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.001} color="#ffffff" />
                  <directionalLight position={[fillX, fillY, fillZ]} intensity={lighting.fillIntensity + 0.2} color="#f0f0f0" />
                  <pointLight position={[0, -2, 3]} intensity={0.4} color="#ffffff" />
                </>
              );
            }

            return (
              <>
                <ambientLight intensity={lighting.ambientIntensity} />
                <directionalLight position={[keyX, keyY, keyZ]} intensity={sc ? lighting.keyIntensity * 1.3 : lighting.keyIntensity} castShadow shadow-mapSize-width={sc ? 2048 : 1024} shadow-mapSize-height={sc ? 2048 : 1024} shadow-bias={-0.0005} color={keyColor} />
                <directionalLight position={[fillX, fillY, fillZ]} intensity={lighting.fillIntensity} color={fillColor} />
                <pointLight position={[0, -3, 4]} intensity={viewMode === "cast" ? 1.0 : 0.7} color="#ffffff" />
                <pointLight position={[0, 5, 0]} intensity={viewMode === "cast" ? 0.6 : 0.4} color="#f8f4ff" />
                <pointLight position={[-5, 1, -2]} intensity={viewMode === "cast" ? 0.5 : 0.3} color={viewMode === "cast" ? "#ffe0c0" : "#d0d0ff"} />
                {/* Showcase extra lights — rim light and accent */}
                {sc && (
                  <>
                    <spotLight position={[-keyX * 1.2, keyY * 0.3, -keyZ * 1.2]} intensity={1.8} angle={0.35} penumbra={0.9} color="#e0e8ff" />
                    <pointLight position={[keyX * 0.5, -1, keyZ * 0.5]} intensity={0.8} color="#fff0d8" />
                    <rectAreaLight width={3} height={3} position={[0, 4, 0]} intensity={0.6} color="#ffffff" />
                  </>
                )}
              </>
            );
          })()}

          {/* Ring group — positioned and rotated */}
          <group position={rPos} rotation={rRot}>
            <RingMesh
              params={params}
              viewMode={viewMode}
              metalPreset={metalPreset}
              finishPreset={finishPreset}
              activeTool={activeTool ?? null}
              onAddWaxMark={onAddWaxMark}
              stampSettings={stampSettings}
              lunarTexture={lunarTexture}
            />

            {viewMode === "wax" && waxMarks && waxMarks.length > 0 && (
              <WaxMarkOverlays marks={waxMarks} />
            )}

            {viewMode === "wax" && inlays && inlays.length > 0 && (
              <InlayBandMarkers inlays={inlays} params={params} />
            )}

            {/* Interior engraving */}
            {engraving?.enabled && engraving.text && (
              <EngravingText3D params={params} engraving={engraving} />
            )}

            {/* Measurement dimension guides */}
            <MeasurementOverlay params={params} visible={viewMode === "wax-print" || !!showMeasurements} />
          </group>

          {/* Environment bed — printer bed or workbench */}
          {showPrinterBed ? (
            <PrinterBedSimulation params={params} />
          ) : (
            <WorkbenchGrid params={params} />
          )}

          {(() => {
            const outerR = (params.innerDiameter / 2 + params.thickness) / 10;
            const shadowY = -(outerR + 0.11);
            return (
              <ContactShadows
                position={[0, shadowY, 0]}
                opacity={sc ? 0.65 : 0.5}
                scale={sc ? 8 : 6}
                blur={sc ? 3 : 2}
                far={sc ? 5 : 4}
                resolution={sc ? 512 : 256}
              />
            );
          })()}

          <Environment preset={lighting.envPreset} environmentIntensity={sc ? lighting.envIntensity * 1.8 : lighting.envIntensity} />
          <OrbitControls
            enablePan={false}
            minDistance={isMobile ? 1.2 : 1.5}
            maxDistance={isMobile ? 6 : 8}
            autoRotate={!isMobile}
            autoRotateSpeed={0.4}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={isMobile ? 0.6 : 1}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
          />

          {/* Camera preset animator */}
          {cameraPreset && (
            <CameraPresetAnimator
              targetPreset={cameraPreset}
              onComplete={onPresetApplied ?? (() => {})}
            />
          )}

          <SnapshotHelper onReady={handleSnapshotReady} />
        </Canvas>
      </div>
    );
  }
);

export default RingViewport;
