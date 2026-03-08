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
import { generateLunarSurfaceMaps, generateLunarSurfaceMapsAsync, disposeLunarMaps, type LunarSurfaceMapSet, type GenerationProgress } from "@/lib/lunarSurfaceMaps";
import { useIsMobile } from "@/hooks/use-mobile";
import { Progress } from "@/components/ui/progress";
import MeasurementOverlay from "./MeasurementOverlay";

// ── Debounce hook for lunar texture regeneration ──────────────────
// Uses JSON serialization for stable deep comparison of object values
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [serialized, delayMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return debounced;
}

// ── Adaptive quality tier ─────────────────────────────────────────
// Tracks prop changes: while editing → "preview", after idle → "high"
export type QualityTier = "preview" | "high";

function useAdaptiveQuality(
  deps: unknown[],
  idleMs: number = 800,
): QualityTier {
  const [tier, setTier] = useState<QualityTier>("high");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Skip the initial mount — start in high quality
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // Props changed → drop to preview
    setTier("preview");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTier("high"), idleMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return tier;
}

// ── DPR controller inside Canvas ──────────────────────────────────
function AdaptiveDprController({ tier, isMobile, isShowcase, isInspection }: {
  tier: QualityTier;
  isMobile: boolean;
  isShowcase: boolean;
  isInspection: boolean;
}) {
  const { gl } = useThree();

  useEffect(() => {
    if (isShowcase || isInspection) {
      gl.setPixelRatio(2);
      return;
    }
    if (tier === "preview") {
      gl.setPixelRatio(isMobile ? 1 : 1);
    } else {
      gl.setPixelRatio(isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2));
    }
  }, [tier, isMobile, isShowcase, isInspection, gl]);

  return null;
}

export type SnapshotAngle = "front" | "angle" | "side" | "inside";

export interface RingViewportHandle {
  captureSnapshot(
    anglePreset: SnapshotAngle,
    viewMode: ViewMode
  ): Promise<string>;
}

const CAMERA_PRESETS: Record<SnapshotAngle, [number, number, number]> = {
  front: [0, 0, 5.5],
  angle: [3.8, 2.8, 3.8],
  side: [5.5, 0.3, 0],
  inside: [0, -0.1, 0.8],
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
  wearPreview?: number; // 0–100, simulates aging/wear softening
  polishPreview?: number; // 0–100, simulates professional polishing finish
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
    color: "#C8C8CC",
    roughness: 0.08,
    metalness: 1.0,
    envMapIntensity: 3.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    sheen: 0.08,
    sheenColor: "#E0E0E8",
    sheenRoughness: 0.15,
    ior: 2.5,
  },
  gold: {
    color: "#C8962D",
    roughness: 0.06,
    metalness: 1.0,
    envMapIntensity: 3.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0,
    sheen: 0.12,
    sheenColor: "#FFD870",
    sheenRoughness: 0.12,
    ior: 2.5,
  },
  "rose-gold": {
    color: "#B76E5E",
    roughness: 0.08,
    metalness: 1.0,
    envMapIntensity: 3.2,
    clearcoat: 0.22,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    sheen: 0.18,
    sheenColor: "#E8B0A0",
    sheenRoughness: 0.14,
    ior: 2.4,
  },
  titanium: {
    color: "#7A7A78",
    roughness: 0.18,
    metalness: 0.95,
    envMapIntensity: 2.2,
    clearcoat: 0.08,
    clearcoatRoughness: 0.1,
    reflectivity: 0.9,
    sheen: 0.06,
    sheenColor: "#A0A0A8",
    sheenRoughness: 0.35,
    ior: 2.6,
  },
  tungsten: {
    color: "#4A4A50",
    roughness: 0.1,
    metalness: 1.0,
    envMapIntensity: 2.8,
    clearcoat: 0.12,
    clearcoatRoughness: 0.06,
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

  // Async procedural maps for micro-detail enhancement on top of real geometry
  const [lunarMaps, setLunarMaps] = useState<LunarSurfaceMapSet | null>(null);
  const stlGenIdRef = useRef(0);

  // Debounce lunar texture changes for STL mesh too
  const debouncedStlLunar = useDebouncedValue(lunarTexture, 300);

  useEffect(() => {
    if (!debouncedStlLunar?.enabled) {
      setLunarMaps(null);
      return;
    }
    const genId = ++stlGenIdRef.current;
    generateLunarSurfaceMapsAsync(debouncedStlLunar, physicalAspect, undefined, () => {}).then((maps) => {
      if (stlGenIdRef.current === genId) setLunarMaps(maps);
    });
  }, [debouncedStlLunar, physicalAspect]);

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
function buildSolidRingGeometry(params: RingParameters, hasLunar: boolean, isMobile: boolean = false, qualityTier: QualityTier = "high", wearAmount: number = 0) {
  const innerR = params.innerDiameter / 2 / 10;
  const outerR = innerR + params.thickness / 10;
  const halfW = params.width / 2 / 10;
  // Wear softens bevels: increases effective bevel size and rounds edges
  const wearFactor = wearAmount / 100; // 0–1
  const bevel = (params.bevelSize / 10) + wearFactor * (halfW * 0.15);
  // Wear slightly reduces outer radius at edges (worn-down edges)
  const wearEdgeLoss = wearFactor * (params.thickness / 10) * 0.04;

  // Adaptive segments: lower during preview tier and on mobile
  const isPreview = qualityTier === "preview";
  const radSegs = hasLunar
    ? (isMobile ? (isPreview ? 128 : 256) : (isPreview ? 256 : 768))
    : (isMobile ? (isPreview ? 32 : 64) : (isPreview ? 64 : 128));
  const profileSteps = hasLunar
    ? (isMobile ? (isPreview ? 32 : 64) : (isPreview ? 64 : 192))
    : (isMobile ? (isPreview ? 8 : 16) : (isPreview ? 16 : 32));

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
    const edgeStyle = params.edgeStyle ?? "soft-bevel";
    if (hasLunar) {
      // Continuous profile for lunar displacement — apply edge style via smooth function
      for (let i = 0; i <= profileSteps; i++) {
        const t = i / profileSteps;
        const y = (t - 0.5) * halfW * 2;
        const edgeDist = Math.min(t, 1 - t);
        const bevelZone = bevel / (halfW * 2) + 0.01;
        const bevelT = Math.min(1, edgeDist / bevelZone);
        let r: number;
        if (edgeStyle === "sharp") {
          // Hard 90° edge, no rounding
          r = outerR;
        } else if (edgeStyle === "chamfer") {
          // Linear 45° cut at edges
          r = innerR + (outerR - innerR) * Math.min(1, bevelT);
        } else if (edgeStyle === "rounded") {
          // Deep smooth radius — ease-in-out curve
          const smoothT = bevelT < 1 ? (1 - Math.cos(bevelT * Math.PI)) / 2 : 1;
          r = innerR + (outerR - innerR) * Math.min(1, smoothT);
        } else {
          // soft-bevel (default) — gentle quarter-circle
          r = innerR + (outerR - innerR) * Math.min(1, bevelT);
        }
        outerPoints.push(new THREE.Vector2(r, y));
      }
    } else {
      const b = Math.min(bevel, halfW * 0.4);
      if (edgeStyle === "sharp") {
        // Pure right-angle edges
        outerPoints.push(new THREE.Vector2(outerR, -halfW));
        outerPoints.push(new THREE.Vector2(outerR, halfW));
      } else if (edgeStyle === "chamfer") {
        // Straight 45° chamfer cut
        outerPoints.push(new THREE.Vector2(outerR - b, -halfW));
        outerPoints.push(new THREE.Vector2(outerR, -halfW + b));
        outerPoints.push(new THREE.Vector2(outerR, halfW - b));
        outerPoints.push(new THREE.Vector2(outerR - b, halfW));
      } else if (edgeStyle === "rounded") {
        // Full quarter-circle arcs with more segments for smoother rounding
        const arcSteps = 12;
        outerPoints.push(new THREE.Vector2(outerR - b, -halfW));
        for (let i = 0; i <= arcSteps; i++) {
          const t = i / arcSteps;
          outerPoints.push(new THREE.Vector2(
            outerR - b + b * Math.sin(t * Math.PI / 2),
            -halfW + b * (1 - Math.cos(t * Math.PI / 2))
          ));
        }
        outerPoints.push(new THREE.Vector2(outerR, -halfW + b));
        outerPoints.push(new THREE.Vector2(outerR, halfW - b));
        for (let i = 0; i <= arcSteps; i++) {
          const t = i / arcSteps;
          outerPoints.push(new THREE.Vector2(
            outerR - b * (1 - Math.cos(t * Math.PI / 2)),
            halfW - b + b * Math.sin(t * Math.PI / 2)
          ));
        }
      } else {
        // soft-bevel (default) — existing quarter-circle bevel
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
            halfW - b + b * Math.sin(t * Math.PI / 2)
          ));
        }
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
  } else { // square — also apply edge styles
    const edgeStyle = params.edgeStyle ?? "soft-bevel";
    const b = Math.min(bevel, halfW * 0.4);
    if (edgeStyle === "sharp" || b < 0.001) {
      for (let i = 0; i <= profileSteps; i++) {
        const t = i / profileSteps;
        const y = (t - 0.5) * halfW * 2;
        outerPoints.push(new THREE.Vector2(outerR, y));
      }
    } else if (edgeStyle === "chamfer") {
      outerPoints.push(new THREE.Vector2(outerR - b, -halfW));
      outerPoints.push(new THREE.Vector2(outerR, -halfW + b));
      outerPoints.push(new THREE.Vector2(outerR, halfW - b));
      outerPoints.push(new THREE.Vector2(outerR - b, halfW));
    } else {
      // rounded or soft-bevel on square profile
      const arcSteps = edgeStyle === "rounded" ? 12 : 8;
      outerPoints.push(new THREE.Vector2(outerR - b, -halfW));
      for (let i = 0; i <= arcSteps; i++) {
        const t = i / arcSteps;
        outerPoints.push(new THREE.Vector2(
          outerR - b + b * Math.sin(t * Math.PI / 2),
          -halfW + b * (1 - Math.cos(t * Math.PI / 2))
        ));
      }
      outerPoints.push(new THREE.Vector2(outerR, -halfW + b));
      outerPoints.push(new THREE.Vector2(outerR, halfW - b));
      for (let i = 0; i <= arcSteps; i++) {
        const t = i / arcSteps;
        outerPoints.push(new THREE.Vector2(
          outerR - b * (1 - Math.cos(t * Math.PI / 2)),
          halfW - b + b * Math.sin(t * Math.PI / 2)
        ));
      }
    }
  }

  // ── Wear post-processing: soften edges and slightly round the entire profile ──
  if (wearFactor > 0 && outerPoints.length > 2) {
    // Gaussian-like smoothing pass on the profile to simulate edge wear
    const smoothPasses = Math.ceil(wearFactor * 4); // more wear = more smoothing
    for (let pass = 0; pass < smoothPasses; pass++) {
      const smoothed = outerPoints.map((p, i) => {
        if (i === 0 || i === outerPoints.length - 1) {
          // Edges lose more material (wear effect)
          return new THREE.Vector2(
            p.x - wearEdgeLoss * (1 - Math.min(i, outerPoints.length - 1 - i) / (outerPoints.length * 0.3)),
            p.y,
          );
        }
        const prev = outerPoints[i - 1];
        const next = outerPoints[i + 1];
        const weight = 0.15 * wearFactor;
        return new THREE.Vector2(
          p.x * (1 - weight * 2) + prev.x * weight + next.x * weight,
          p.y,
        );
      });
      for (let i = 0; i < outerPoints.length; i++) {
        outerPoints[i] = smoothed[i];
      }
    }
  }

  // 1. Outer surface — LatheGeometry (this gets lunar textures)
  const outerGeo = new THREE.LatheGeometry(outerPoints, radSegs);
  outerGeo.computeVertexNormals();

  // 2. Inner bore — shaped by interiorProfile and curvature controls
  const interiorProfile = params.interiorProfile ?? "comfort-dome";
  const curvature = (params.interiorCurvature ?? 40) / 100;  // 0–1
  const comfortDepth = (params.comfortFitDepth ?? 50) / 100; // 0–1
  const innerProfileSteps = isMobile ? 32 : 64;

  // Build inner bore profile as a lathe curve
  const innerPoints: THREE.Vector2[] = [];
  const maxBulge = params.thickness / 10 * 0.35 * curvature * comfortDepth; // max inward bulge in scene units

  for (let i = 0; i <= innerProfileSteps; i++) {
    const t = i / innerProfileSteps; // 0 = bottom, 1 = top
    const y = (t - 0.5) * halfW * 2;
    let r = innerR;

    if (interiorProfile === "flat" || curvature < 0.01) {
      // Pure cylinder — no curvature
      r = innerR;
    } else if (interiorProfile === "comfort-dome") {
      // Classic comfort fit: smooth sine dome, max bulge at center
      const dome = Math.sin(t * Math.PI);
      r = innerR - maxBulge * dome;
    } else if (interiorProfile === "european") {
      // European fit: flatter center, steeper edges — squared sine
      const dome = Math.pow(Math.sin(t * Math.PI), 2);
      r = innerR - maxBulge * 0.7 * dome;
    } else if (interiorProfile === "anatomical") {
      // Anatomical: asymmetric — slightly more material on top (palm side)
      const asymmetry = 0.15 * curvature;
      const dome = Math.sin(t * Math.PI) * (1 + asymmetry * (t - 0.5));
      r = innerR - maxBulge * dome;
    }

    innerPoints.push(new THREE.Vector2(Math.max(r, innerR * 0.85), y));
  }

  const innerGeo = new THREE.LatheGeometry(innerPoints, radSegs);
  // Flip normals inward for inner bore
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
  innerGeo.computeVertexNormals();

  // 3. End caps — ring-shaped annular discs connecting outer edge to inner bore
  const capGeoTop = new THREE.RingGeometry(innerPoints[innerPoints.length - 1].x, outerPoints[outerPoints.length - 1].x, radSegs, 1);
  capGeoTop.rotateX(-Math.PI / 2);
  capGeoTop.translate(0, halfW, 0);

  const capGeoBot = new THREE.RingGeometry(innerPoints[0].x, outerPoints[0].x, radSegs, 1);
  capGeoBot.rotateX(Math.PI / 2);
  capGeoBot.translate(0, -halfW, 0);

  return { outerGeo, innerGeo, capGeoTop, capGeoBot };
}

// ── Procedural ring mesh — SOLID with separate inner/outer/cap surfaces ──────
function ProceduralRingMesh({ params, viewMode, metalPreset, finishPreset, activeTool, onAddWaxMark, stampSettings, lunarTexture, wearPreview = 0, onGenProgress }: RingMeshProps & { onGenProgress?: (p: GenerationProgress | null) => void }) {
  const hasLunar = !!lunarTexture?.enabled;
  const isMobile = useIsMobile();
  const wearAmount = wearPreview;

  // Debounce params for geometry builds to avoid thrashing during slider drags
  const debouncedParams = useDebouncedValue(params, isMobile ? 150 : 80);
  const debouncedWear = useDebouncedValue(wearAmount, 100);

  // Adaptive quality for geometry detail
  const geoQuality = useAdaptiveQuality(
    [debouncedParams.size, debouncedParams.innerDiameter, debouncedParams.width, debouncedParams.thickness, debouncedParams.profile, debouncedParams.bevelSize, debouncedParams.edgeStyle, debouncedParams.grooveCount, debouncedParams.interiorProfile, debouncedParams.interiorCurvature, debouncedParams.comfortFitDepth, hasLunar, debouncedWear],
    isMobile ? 1200 : 600,
  );

  // Build geometry and dispose previous on param changes
  const geoRef = useRef<{ outerGeo: THREE.LatheGeometry; innerGeo: THREE.LatheGeometry; capGeoTop: THREE.RingGeometry; capGeoBot: THREE.RingGeometry } | null>(null);

  const { outerGeo, innerGeo, capGeoTop, capGeoBot } = useMemo(() => {
    // Dispose previous geometries to free GPU memory
    if (geoRef.current) {
      geoRef.current.outerGeo.dispose();
      geoRef.current.innerGeo.dispose();
      geoRef.current.capGeoTop.dispose();
      geoRef.current.capGeoBot.dispose();
    }
    const result = buildSolidRingGeometry(debouncedParams, hasLunar, isMobile, geoQuality, debouncedWear);
    geoRef.current = result;
    return result;
  }, [debouncedParams, hasLunar, isMobile, geoQuality, debouncedWear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geoRef.current) {
        geoRef.current.outerGeo.dispose();
        geoRef.current.innerGeo.dispose();
        geoRef.current.capGeoTop.dispose();
        geoRef.current.capGeoBot.dispose();
        geoRef.current = null;
      }
    };
  }, []);

  const isWax = viewMode === "wax";
  const isWaxPrint = viewMode === "wax-print";
  const mc = METAL_CONFIGS[metalPreset] ?? METAL_CONFIGS.silver;
  const finishRoughMod = FINISH_ROUGHNESS_MOD[finishPreset] ?? 0;

  // ── Wear material adjustments ──
  // Wear increases roughness slightly (micro-scratches), reduces clearcoat (worn polish),
  // and slightly increases env map intensity (smoother worn metal reflects more)
  const wearFactor = debouncedWear / 100;
  const wearRoughnessBoost = wearFactor * 0.12;   // worn surfaces get slightly rougher
  const wearClearcoatLoss = wearFactor * 0.8;      // clearcoat wears off
  const wearSheenBoost = wearFactor * 0.15;        // subtle patina sheen

  // ── Lunar-specific wear: craters flatten, rims soften, texture detail erodes ──
  // High-contact areas (outer ring edges, raised rims) wear fastest
  const lunarWearNormalReduction = wearFactor * 0.55;   // normal map strength drops — rims flatten
  const lunarWearAoReduction = wearFactor * 0.5;        // AO fades — debris fills crevices
  const lunarWearDispReduction = wearFactor * 0.45;     // displacement softens — craters shallow out
  const lunarWearRoughnessUniformity = wearFactor * 0.3; // roughness map becomes more uniform

  // Compute physical aspect ratio for circular craters
  const physicalAspect = useMemo(() => {
    const outerDiam = debouncedParams.innerDiameter + 2 * debouncedParams.thickness;
    const circumference = Math.PI * outerDiam;
    const width = debouncedParams.width;
    return width > 0 ? circumference / width : 1;
  }, [debouncedParams.innerDiameter, debouncedParams.thickness, debouncedParams.width]);

  // Ring dimensions for surface-area-aware texture scaling
  const ringDims = useMemo(() => ({
    innerDiameterMm: debouncedParams.innerDiameter,
    widthMm: debouncedParams.width,
    thicknessMm: debouncedParams.thickness,
  }), [debouncedParams.innerDiameter, debouncedParams.width, debouncedParams.thickness]);

  // ── Freeze terrain support ──
  // When frozen, cache the aspect/dims at freeze time so terrain doesn't regenerate
  const frozenAspectRef = useRef<number | null>(null);
  const frozenDimsRef = useRef<typeof ringDims | null>(null);
  
  const isFrozen = !!lunarTexture?.frozen;
  
  // When freeze is toggled ON, snapshot current values
  useEffect(() => {
    if (isFrozen && frozenAspectRef.current === null) {
      frozenAspectRef.current = physicalAspect;
      frozenDimsRef.current = ringDims;
    } else if (!isFrozen) {
      frozenAspectRef.current = null;
      frozenDimsRef.current = null;
    }
  }, [isFrozen, physicalAspect, ringDims]);
  
  // Use frozen values if terrain is frozen, otherwise use live values
  const effectiveAspect = isFrozen && frozenAspectRef.current !== null ? frozenAspectRef.current : physicalAspect;
  const effectiveDims = isFrozen && frozenDimsRef.current !== null ? frozenDimsRef.current : ringDims;

  // Async texture generation with progress tracking + debounce
  const [lunarMaps, setLunarMaps] = useState<LunarSurfaceMapSet | null>(null);
  const [genProgress, setGenProgress] = useState<GenerationProgress | null>(null);
  const genIdRef = useRef(0);
  const prevMapsRef = useRef<LunarSurfaceMapSet | null>(null);

  // Debounce all lunar params so rapid slider drags don't spam regeneration
  const debouncedLunar = useDebouncedValue(lunarTexture, isMobile ? 400 : 250);

  // Build a stable key for the lunar params (excluding frozen flag itself)
  const lunarParamsKey = useMemo(() => {
    if (!debouncedLunar) return "";
    const { frozen, ...rest } = debouncedLunar;
    return JSON.stringify(rest);
  }, [debouncedLunar]);

  useEffect(() => {
    if (!debouncedLunar?.enabled) {
      // Dispose previous maps
      if (prevMapsRef.current) {
        disposeLunarMaps(prevMapsRef.current);
        prevMapsRef.current = null;
      }
      setLunarMaps(null);
      setGenProgress(null);
      onGenProgress?.(null);
      return;
    }
    const genId = ++genIdRef.current;
    setGenProgress({ stage: "heightmap", label: "Preparing…", craterCount: 0, percent: 0 });
    onGenProgress?.({ stage: "heightmap", label: "Preparing…", craterCount: 0, percent: 0 });

    generateLunarSurfaceMapsAsync(
      debouncedLunar,
      effectiveAspect,
      effectiveDims,
      (progress) => {
        if (genIdRef.current !== genId) return;
        setGenProgress(progress);
        onGenProgress?.(progress);
      },
    ).then((maps) => {
      if (genIdRef.current !== genId) return;
      // Dispose previous maps to free GPU memory
      if (prevMapsRef.current && prevMapsRef.current !== maps) {
        disposeLunarMaps(prevMapsRef.current);
      }
      prevMapsRef.current = maps;
      setLunarMaps(maps);
      // Clear progress after brief delay to show completion
      setTimeout(() => {
        if (genIdRef.current === genId) setGenProgress(null);
      }, 1200);
    });
    // When frozen, only regenerate if lunar params (excluding frozen) change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunarParamsKey, effectiveAspect, effectiveDims]);

  // Scale normal and displacement strength relative to a reference ring (size 8, 6mm wide)
  // Smaller rings → stronger normals per-texel; larger rings → softer
  const dimScale = useMemo(() => {
    const refOuterR = 18.1 / 2 + 2; // reference outer radius for size 8
    const outerR = debouncedParams.innerDiameter / 2 + debouncedParams.thickness;
    const refWidth = 6;
    // Geometric mean so both radius and width contribute
    const sizeRatio = Math.sqrt((outerR / refOuterR) * (debouncedParams.width / refWidth));
    return Math.max(0.5, Math.min(2.0, 1 / sizeRatio));
  }, [debouncedParams.innerDiameter, debouncedParams.thickness, debouncedParams.width]);

  const normalScale = useMemo(() => {
    if (!lunarTexture?.enabled) return new THREE.Vector2(0, 0);
    const baseStrength = 1.5 + (lunarTexture.intensity / 100) * 3.0;
    // Wear erodes crater rims — normal detail progressively flattens
    const strength = baseStrength * dimScale * (1 - lunarWearNormalReduction);
    return new THREE.Vector2(strength, -strength);
  }, [lunarTexture?.enabled, lunarTexture?.intensity, dimScale, lunarWearNormalReduction]);

  const dispScale = useMemo(() => {
    if (!hasLunar || !lunarTexture) return 0;
    const outerR = debouncedParams.innerDiameter / 2 / 10 + debouncedParams.thickness / 10;
    const baseDisp = outerR * (0.04 + (lunarTexture.intensity / 100) * 0.10) * (1 / dimScale);
    // Wear progressively shallows craters — rims erode, bowls fill with wear debris
    return baseDisp * (1 - lunarWearDispReduction);
  }, [hasLunar, lunarTexture?.intensity, debouncedParams.innerDiameter, debouncedParams.thickness, dimScale, lunarWearDispReduction]);

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
        roughness={Math.min(1, (hasLunar ? mc.roughness + 0.15 * (1 - lunarWearRoughnessUniformity) : mc.roughness) + finishRoughMod + wearRoughnessBoost)}
        metalness={mc.metalness}
        normalMap={lunarMaps?.normalMap ?? null}
        roughnessMap={lunarMaps?.roughnessMap ?? null}
        aoMap={lunarMaps?.aoMap ?? null}
        aoMapIntensity={hasLunar ? 2.0 * (1 - lunarWearAoReduction) : 0}
        normalScale={normalScale}
        envMapIntensity={mc.envMapIntensity * (1 + wearFactor * 0.15)}
        clearcoat={Math.max(0, (hasLunar ? mc.clearcoat : mc.clearcoat * 1.5) * (1 - wearClearcoatLoss))}
        clearcoatRoughness={mc.clearcoatRoughness + wearFactor * 0.15}
        reflectivity={mc.reflectivity}
        sheen={mc.sheen + wearSheenBoost}
        sheenColor={mc.sheenColor}
        sheenRoughness={Math.min(1, mc.sheenRoughness + wearFactor * 0.1)}
        ior={mc.ior}
        displacementMap={hasLunar ? lunarMaps?.displacementMap ?? null : null}
        displacementScale={dispScale}
        displacementBias={-dispScale * 0.5}
        side={THREE.FrontSide}
      />
    );
  }, [isWax, isWaxPrint, mc, finishRoughMod, lunarMaps, normalScale, hasLunar, dispScale, wearFactor, wearRoughnessBoost, wearClearcoatLoss, wearSheenBoost, lunarWearAoReduction, lunarWearRoughnessUniformity]);

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
        roughness={Math.min(1, mc.roughness * 0.6 + finishRoughMod * 0.3 + wearRoughnessBoost * 1.5)}
        metalness={mc.metalness}
        envMapIntensity={mc.envMapIntensity * 0.8}
        clearcoat={Math.max(0, 0.4 * (1 - wearClearcoatLoss * 0.5))}
        clearcoatRoughness={0.03 + wearFactor * 0.1}
        reflectivity={mc.reflectivity}
        ior={mc.ior}
        side={THREE.FrontSide}
      />
    );
  }, [isWax, isWaxPrint, mc, finishRoughMod, wearRoughnessBoost, wearClearcoatLoss, wearFactor]);

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
function RingMesh(props: RingMeshProps & { onGenProgress?: (p: GenerationProgress | null) => void }) {
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
  const halfW = params.width / 2 / 10;

  // Vertical offset based on placement
  const placement = engraving.placement ?? "center";
  let yOffset = 0;
  if (placement === "top-edge") {
    yOffset = halfW * 0.6;
  } else if (placement === "bottom-edge") {
    yOffset = -halfW * 0.6;
  } else if (placement === "custom") {
    yOffset = (engraving.verticalOffsetMm ?? 0) / 10;
  }

  // Start angle offset (degrees → radians)
  const startAngleOffset = ((engraving.startAngleDeg ?? 0) * Math.PI) / 180;

  const chars = engraving.text.split("");
  const charWidth = fontSize * 0.6 + letterSpacing;
  const totalArc = chars.length * charWidth;
  const circumference = 2 * Math.PI * textR;
  const arcFraction = totalArc / circumference;
  const baseStartAngle = -arcFraction * Math.PI + startAngleOffset;

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {chars.map((char, i) => {
        const angle = baseStartAngle + (i + 0.5) * (charWidth / textR);
        const x = Math.cos(angle) * textR;
        const z = Math.sin(angle) * textR;
        const rotY = -angle - Math.PI / 2;

        return (
          <Text
            key={`${i}-${char}`}
            position={[x, yOffset, z]}
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
  const innerR = params.innerDiameter / 2 / 10;
  const gridY = -(outerR + 0.12); // Position grid just below the ring's outer radius
  const outerDiam = (params.innerDiameter + 2 * params.thickness) / 10;
  const gridSize = Math.max(3, Math.ceil(outerDiam * 3));
  const majorDivisions = gridSize; // every 10mm
  const minorDivisions = gridSize * 5; // every 2mm

  // Diameter reference circle points
  const diamCirclePoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * innerR, 0, Math.sin(angle) * innerR));
    }
    return pts;
  }, [innerR]);

  // Scale ruler ticks (5 ticks at 10mm intervals = 50mm ruler)
  const rulerLength = Math.min(5, gridSize - 1); // in cm (each unit = 10mm)
  const rulerZ = outerR + 0.6;

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

      {/* ── Diameter reference circle on the bed ── */}
      <group position={[0, 0.004, 0]}>
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={diamCirclePoints.length}
              array={new Float32Array(diamCirclePoints.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#667788" transparent opacity={0.4} />
        </line>
        {/* Diameter label */}
        <Text
          position={[0, 0.002, innerR + 0.12]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.05}
          color="#667788"
          anchorX="center"
          anchorY="middle"
        >
          {`Ø${params.innerDiameter.toFixed(1)}mm`}
        </Text>
      </group>

      {/* ── Scale ruler near the ring ── */}
      <group position={[-rulerLength / 2, 0.005, rulerZ]}>
        {/* Main ruler bar */}
        <mesh position={[rulerLength / 2, 0, 0]}>
          <boxGeometry args={[rulerLength, 0.002, 0.008]} />
          <meshBasicMaterial color="#778899" />
        </mesh>

        {/* Tick marks + labels every 10mm */}
        {Array.from({ length: rulerLength + 1 }, (_, i) => {
          const isMajor = i % 1 === 0;
          const tickH = isMajor ? 0.06 : 0.03;
          return (
            <group key={i} position={[i, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.003, 0.002, tickH]} />
                <meshBasicMaterial color="#778899" />
              </mesh>
              {isMajor && (
                <Text
                  position={[0, 0.002, tickH / 2 + 0.04]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={0.035}
                  color="#778899"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`${i * 10}`}
                </Text>
              )}
            </group>
          );
        })}

        {/* mm label at end */}
        <Text
          position={[rulerLength + 0.15, 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.04}
          color="#667788"
          anchorX="left"
          anchorY="middle"
        >
          mm
        </Text>
      </group>

      {/* ── Ring size callout — small badge on the bed ── */}
      <Text
        position={[0, 0.004, -(innerR + 0.2)]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.045}
        color="#556677"
        anchorX="center"
        anchorY="middle"
      >
        {`US ${params.size}`}
      </Text>
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

export type CutawayMode = "normal" | "inside" | "cross-section" | "quarter-cut";

import ScaleReference, { ScaleReferenceType } from "./ScaleReference";

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
  cutawayOffset?: number; // -1 to 1, controls where the clip plane sits
  lighting?: LightingSettings;
  showcaseMode?: boolean;
  inspectionMode?: boolean;
  ringPosition?: [number, number, number];
  ringRotation?: [number, number, number];
  showPrinterBed?: boolean;
  rotationLocked?: boolean; // When true, disables orbit rotation but keeps zoom
  scaleReference?: ScaleReferenceType; // Show real-world scale reference objects
  wearPreview?: number; // 0–100, simulates polishing/wear softening
  turntableSpeed?: number; // 0 = off, positive = RPM (e.g. 4 for slow spin)
  bgPreset?: BackgroundPreset;
}

export type BackgroundPreset = "dark-studio" | "light-studio" | "cosmic" | "neutral";

export const BG_PRESETS: { id: BackgroundPreset; label: string; icon: string; bgClass: string; envPreset: LightingSettings["envPreset"]; envIntensityMul: number; toneMappingExposure: number }[] = [
  { id: "dark-studio", label: "Dark Studio", icon: "🌑", bgClass: "bg-forge-dark", envPreset: "studio", envIntensityMul: 1, toneMappingExposure: 0.95 },
  { id: "light-studio", label: "Light Studio", icon: "☀️", bgClass: "bg-[hsl(220,10%,88%)]", envPreset: "warehouse", envIntensityMul: 1.3, toneMappingExposure: 1.15 },
  { id: "cosmic", label: "Cosmic", icon: "🌌", bgClass: "bg-[hsl(240,30%,6%)]", envPreset: "night", envIntensityMul: 0.8, toneMappingExposure: 0.85 },
  { id: "neutral", label: "Neutral", icon: "📦", bgClass: "bg-[hsl(0,0%,75%)]", envPreset: "lobby", envIntensityMul: 1.5, toneMappingExposure: 1.1 },
];

// ── Clipping plane manager with interactive offset ─────────────────
function ClipPlaneManager({ mode, offset = 0, params }: { mode: CutawayMode; offset: number; params: RingParameters }) {
  const { gl } = useThree();
  const outerR = (params.innerDiameter / 2 + params.thickness) / 10;

  const clipPlanes = useMemo(() => {
    const scaledOffset = offset * outerR * 1.2;

    if (mode === "cross-section") {
      return [new THREE.Plane(new THREE.Vector3(0, 0, -1), scaledOffset)];
    }
    if (mode === "inside") {
      return [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.001 + scaledOffset * 0.5)];
    }
    if (mode === "quarter-cut") {
      // Two planes to cut a quarter away — reveals both profile and bore
      return [
        new THREE.Plane(new THREE.Vector3(0, 0, -1), scaledOffset * 0.1),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), scaledOffset * 0.1),
      ];
    }
    return [];
  }, [mode, offset, outerR]);

  useEffect(() => {
    if (clipPlanes.length > 0) {
      gl.clippingPlanes = clipPlanes;
      gl.localClippingEnabled = true;
    } else {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
    }
    return () => {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
    };
  }, [clipPlanes, gl]);

  return null;
}

// ── Cross-section dimension annotations ────────────────────────────
function CrossSectionAnnotations({ params, cutawayMode, engraving }: {
  params: RingParameters;
  cutawayMode: CutawayMode;
  engraving?: EngravingState;
}) {
  const innerR = params.innerDiameter / 2 / 10;
  const outerR = innerR + params.thickness / 10;
  const halfW = params.width / 2 / 10;
  const wallThickness = params.thickness / 10;

  if (cutawayMode === "normal") return null;

  // Only show annotations for cross-section and quarter-cut
  const showProfile = cutawayMode === "cross-section" || cutawayMode === "quarter-cut";
  const showBore = cutawayMode === "inside" || cutawayMode === "quarter-cut";

  return (
    <group>
      {/* Wall thickness dimension line — vertical on the cross-section face */}
      {showProfile && (
        <group position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Outer edge marker */}
          <mesh position={[outerR, 0, 0]}>
            <boxGeometry args={[0.008, halfW * 1.6, 0.001]} />
            <meshBasicMaterial color="#ff6644" transparent opacity={0.8} />
          </mesh>
          {/* Inner edge marker */}
          <mesh position={[innerR, 0, 0]}>
            <boxGeometry args={[0.008, halfW * 1.6, 0.001]} />
            <meshBasicMaterial color="#ff6644" transparent opacity={0.8} />
          </mesh>
          {/* Connecting line */}
          <mesh position={[(innerR + outerR) / 2, halfW * 0.9, 0]}>
            <boxGeometry args={[wallThickness, 0.004, 0.001]} />
            <meshBasicMaterial color="#ff6644" transparent opacity={0.6} />
          </mesh>
          {/* Thickness label */}
          <Text
            position={[(innerR + outerR) / 2, halfW * 0.9 + 0.06, 0.005]}
            fontSize={0.04}
            color="#ff6644"
            anchorX="center"
            anchorY="bottom"
          >
            {`${params.thickness.toFixed(1)}mm`}
          </Text>

          {/* Width dimension — horizontal */}
          <mesh position={[outerR + 0.08, 0, 0]}>
            <boxGeometry args={[0.004, halfW * 2, 0.001]} />
            <meshBasicMaterial color="#44aaff" transparent opacity={0.6} />
          </mesh>
          {/* Width top tick */}
          <mesh position={[outerR + 0.08, halfW, 0]}>
            <boxGeometry args={[0.04, 0.004, 0.001]} />
            <meshBasicMaterial color="#44aaff" transparent opacity={0.6} />
          </mesh>
          {/* Width bottom tick */}
          <mesh position={[outerR + 0.08, -halfW, 0]}>
            <boxGeometry args={[0.04, 0.004, 0.001]} />
            <meshBasicMaterial color="#44aaff" transparent opacity={0.6} />
          </mesh>
          {/* Width label */}
          <Text
            position={[outerR + 0.15, 0, 0.005]}
            fontSize={0.035}
            color="#44aaff"
            anchorX="left"
            anchorY="middle"
          >
            {`${params.width.toFixed(1)}mm`}
          </Text>

          {/* Inner diameter label */}
          <Text
            position={[innerR * 0.5, -halfW - 0.08, 0.005]}
            fontSize={0.03}
            color="#888888"
            anchorX="center"
            anchorY="top"
          >
            {`⌀${params.innerDiameter.toFixed(1)}mm`}
          </Text>
        </group>
      )}

      {/* Engraving depth indicator */}
      {showProfile && engraving?.enabled && engraving.text && (
        <group position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[innerR - (engraving.depthMm / 10) / 2, 0, 0]}>
            <boxGeometry args={[engraving.depthMm / 10, 0.004, 0.001]} />
            <meshBasicMaterial color="#ffaa22" transparent opacity={0.7} />
          </mesh>
          <Text
            position={[innerR - engraving.depthMm / 10 - 0.02, 0, 0.005]}
            fontSize={0.025}
            color="#ffaa22"
            anchorX="right"
            anchorY="middle"
          >
            {`Engrave ${engraving.depthMm.toFixed(1)}mm`}
          </Text>
        </group>
      )}

      {/* Inside view — bore diameter callout */}
      {showBore && (
        <group position={[0, 0, 0]}>
          <Text
            position={[0, 0.02, innerR + 0.08]}
            fontSize={0.04}
            color="#66bbff"
            anchorX="center"
            anchorY="bottom"
          >
            {`Bore ⌀${params.innerDiameter.toFixed(1)}mm`}
          </Text>
        </group>
      )}
    </group>
  );
}

const RingViewport = forwardRef<RingViewportHandle, RingViewportProps>(
  function RingViewport({ params, viewMode, metalPreset, finishPreset = "polished", activeTool, onAddWaxMark, waxMarks, stampSettings, inlays, lunarTexture, engraving, cameraPreset, onPresetApplied, showMeasurements, cutawayMode = "normal", cutawayOffset = 0, lighting: lightingProp, showcaseMode = false, inspectionMode = false, ringPosition, ringRotation, showPrinterBed = false, rotationLocked = false, scaleReference = "none", wearPreview = 0, turntableSpeed = 0, bgPreset = "dark-studio" }, ref) {
    const lighting = lightingProp ?? DEFAULT_LIGHTING;
    const sc = showcaseMode;
    const insp = inspectionMode;
    const rPos = ringPosition ?? [0, 0, 0];
    const rRot = ringRotation ?? [0, 0, 0];
    const isRotationLocked = rotationLocked;
    const activeScaleRef = scaleReference;
    const snapshotApiRef = useRef<{ capture: (pos: [number, number, number]) => Promise<string> } | null>(null);
    const isMobile = useIsMobile();
    const [surfaceProgress, setSurfaceProgress] = useState<GenerationProgress | null>(null);

    // Adaptive quality: drops to preview during editing, upgrades after idle
    const qualityTier = useAdaptiveQuality(
      [params, viewMode, metalPreset, finishPreset, lunarTexture, engraving, lighting],
      isMobile ? 1000 : 800,
    );

    const handleGenProgress = useCallback((p: GenerationProgress | null) => {
      setSurfaceProgress(p);
    }, []);

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

    // Camera positioned further back so ring is fully visible
    const initialCamPos: [number, number, number] = insp
      ? [0, 1.8, 3.5]
      : isMobile ? [1.0, 1.5, 4.0] : [0, 3, 6];

      const activeBg = BG_PRESETS.find(b => b.id === bgPreset) ?? BG_PRESETS[0];

      return (
        <div className={`w-full h-full ${activeBg.bgClass} rounded-lg overflow-hidden touch-none relative`}>
        {/* Surface generation progress overlay */}
        {surfaceProgress && surfaceProgress.stage !== "done" && (
          <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
            <div className="bg-background/90 backdrop-blur-md border border-primary/20 rounded-lg px-4 py-3 shadow-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-foreground/90">{surfaceProgress.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{surfaceProgress.percent}%</span>
              </div>
              <Progress value={surfaceProgress.percent} className="h-1.5" />
              {surfaceProgress.craterCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
                  <span>🌑 {surfaceProgress.craterCount.toLocaleString()} craters</span>
                  <span>·</span>
                  <span className="capitalize">{surfaceProgress.stage.replace(/([A-Z])/g, " $1")}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Completion flash */}
        {surfaceProgress?.stage === "done" && (
          <div className="absolute bottom-4 left-4 z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-primary/15 backdrop-blur-md border border-primary/30 rounded-lg px-3 py-2 shadow-lg">
              <span className="text-[11px] font-medium text-primary">
                ✓ {surfaceProgress.craterCount.toLocaleString()} craters · Surface ready
              </span>
            </div>
          </div>
        )}
        {/* Quality tier indicator — bottom-left to avoid toolbar overlap */}
        {qualityTier === "preview" && !surfaceProgress && (
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none animate-in fade-in duration-150">
            <span className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70 bg-muted/40 border border-border/30 rounded-full backdrop-blur-sm">
              Preview
            </span>
          </div>
        )}
        {qualityTier === "high" && !surfaceProgress && !insp && !sc && (
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none animate-in fade-in duration-500">
            <span className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-primary/60 bg-primary/5 border border-primary/15 rounded-full backdrop-blur-sm">
              HD
            </span>
          </div>
        )}
        {/* Rotation lock indicator */}
        {isRotationLocked && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-warning/15 backdrop-blur-sm border border-warning/30 rounded-lg">
              <svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-[10px] font-medium text-warning/90">Rotation Locked</span>
            </div>
          </div>
        )}
        {/* Wear preview indicator */}
        {wearPreview > 0 && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: isRotationLocked ? '3.5rem' : '0.75rem' }}>
            <div className="flex flex-col gap-0.5 px-2.5 py-1.5 bg-accent/15 backdrop-blur-sm border border-accent/30 rounded-lg">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-accent-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-medium text-accent-foreground/70">
                  Wear {wearPreview}% · {wearPreview <= 25 ? "1 year" : wearPreview <= 50 ? "5 years" : wearPreview <= 75 ? "10 years" : "20+ years"}
                </span>
              </div>
              {!!lunarTexture?.enabled && wearPreview > 15 && (
                <span className="text-[8px] text-accent-foreground/50 pl-5">
                  {wearPreview <= 40 ? "Crater rims softening" : wearPreview <= 70 ? "Surface detail eroding" : "Terrain significantly worn"}
                </span>
              )}
            </div>
          </div>
        )}
        {/* Inspection mode vignette overlay */}
        {insp && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 55%, hsl(var(--background) / 0.6) 100%)",
            }}
          />
        )}
        {/* Inspection mode label */}
        {insp && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span className="px-3 py-1 text-[10px] font-display uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/25 rounded-full backdrop-blur-sm">
              🔍 Inspection Mode
            </span>
          </div>
        )}
        <Canvas
          camera={{ position: initialCamPos, fov: insp ? 25 : (isMobile ? 30 : 35) }}
          shadows={sc || insp ? "soft" : (isMobile ? false : true)}
          frameloop="always"
          gl={{
            preserveDrawingBuffer: true,
            antialias: !isMobile,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: insp ? 1.15 : (sc ? 1.05 : activeBg.toneMappingExposure),
            powerPreference: isMobile ? "low-power" : "high-performance",
          }}
          dpr={insp ? [2, 2] : (sc ? [2, 2] : (isMobile ? [1, 1.5] : [1, 2]))}
        >
          <AdaptiveDprController tier={qualityTier} isMobile={isMobile} isShowcase={sc} isInspection={insp} />
          <ClipPlaneManager mode={cutawayMode} offset={cutawayOffset} params={params} />

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
                  <directionalLight position={[keyX, keyY, keyZ]} intensity={lighting.keyIntensity * 0.6} castShadow={!isMobile} shadow-mapSize-width={isMobile ? 512 : 1024} shadow-mapSize-height={isMobile ? 512 : 1024} shadow-bias={-0.001} color="#ffffff" />
                  <directionalLight position={[fillX, fillY, fillZ]} intensity={lighting.fillIntensity + 0.2} color="#f0f0f0" />
                  <pointLight position={[0, -2, 3]} intensity={0.4} color="#ffffff" />
                </>
              );
            }

            // ── Jewellery photography lighting rig ──
            // Key: directional with soft shadow, Fill: opposite-side softbox,
            // Rim/kicker: backlight for edge sparkle, Overhead softbox: even illumination,
            // Under-fill: subtle uplight to reduce harsh shadows under the band
            const isCast = viewMode === "cast";
            const rimX = -keyX * 1.1;
            const rimZ = -keyZ * 1.1;

            return (
              <>
                <ambientLight intensity={lighting.ambientIntensity} color="#f0f0f5" />

                {/* Key light — slightly warm, soft shadow */}
                <directionalLight
                  position={[keyX, keyY, keyZ]}
                  intensity={sc ? lighting.keyIntensity * 1.3 : lighting.keyIntensity}
                  castShadow={!isMobile || qualityTier === "high"}
                  shadow-mapSize-width={qualityTier === "preview" ? 512 : (isMobile ? 512 : (sc || insp ? 2048 : 1024))}
                  shadow-mapSize-height={qualityTier === "preview" ? 512 : (isMobile ? 512 : (sc || insp ? 2048 : 1024))}
                  shadow-bias={-0.0003}
                  shadow-radius={4}
                  color={keyColor}
                />

                {/* Fill light — cool-tinted softbox from opposite side */}
                <directionalLight
                  position={[fillX, fillY, fillZ]}
                  intensity={lighting.fillIntensity}
                  color={fillColor}
                />

                {/* Overhead softbox — large area light for smooth gradients on curved surfaces */}
                <rectAreaLight
                  width={5}
                  height={5}
                  position={[0, 5, 0]}
                  intensity={isCast ? 0.8 : 0.5}
                  color="#ffffff"
                />

                {/* Rim / kicker light — edge highlights that separate ring from background */}
                <spotLight
                  position={[rimX, keyY * 0.3, rimZ]}
                  intensity={isCast ? 2.0 : 1.2}
                  angle={0.45}
                  penumbra={0.85}
                  color="#e8eeff"
                />

                {/* Front-bottom accent — lifts shadow under the band, reveals inner bore */}
                <pointLight
                  position={[0, -2.5, 3.5]}
                  intensity={isCast ? 0.8 : 0.5}
                  color="#ffffff"
                />

                {/* Top-back hair light — subtle rim highlight on upper edge */}
                <pointLight
                  position={[0, 4, -3]}
                  intensity={isCast ? 0.6 : 0.3}
                  color="#f0f0ff"
                />

                {/* Side accent — warm kiss light that catches crater rims */}
                <pointLight
                  position={[-4, 0.5, 1]}
                  intensity={isCast ? 0.5 : 0.3}
                  color={isCast ? "#ffe0c0" : "#d0d0ff"}
                />

                {/* Showcase extra lights — rim light and accent */}
                {sc && (
                  <>
                    <spotLight position={[rimX * 1.3, keyY * 0.5, rimZ * 1.3]} intensity={2.5} angle={0.3} penumbra={0.95} color="#e0e8ff" />
                    <pointLight position={[keyX * 0.5, -1, keyZ * 0.5]} intensity={0.8} color="#fff0d8" />
                    <rectAreaLight width={3} height={3} position={[0, 4.5, 1]} intensity={0.8} color="#ffffff" />
                  </>
                )}
                {/* Inspection mode — strong multi-angle lighting to reveal surface detail */}
                {insp && (
                  <>
                    {/* Raking light from low angle — reveals crater depth and engraving */}
                    <spotLight position={[3, 0.5, 2]} intensity={3.5} angle={0.4} penumbra={0.6} color="#ffffff" castShadow />
                    <spotLight position={[-3, 0.3, -1]} intensity={2.5} angle={0.5} penumbra={0.7} color="#f0f0ff" />
                    {/* Overhead fill for even coverage */}
                    <rectAreaLight width={4} height={4} position={[0, 5, 0]} intensity={1.2} color="#ffffff" />
                    {/* Backlight rim for edge definition */}
                    <pointLight position={[0, 0, -4]} intensity={1.5} color="#e8e0ff" />
                    {/* Under-light to reveal bottom surface detail */}
                    <pointLight position={[0, -3, 2]} intensity={0.8} color="#fff8e0" />
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
              wearPreview={wearPreview}
              onGenProgress={handleGenProgress}
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

            {/* Cross-section dimension annotations */}
            <CrossSectionAnnotations params={params} cutawayMode={cutawayMode} engraving={engraving} />
          </group>

          {/* Real-world scale reference objects */}
          {activeScaleRef !== "none" && (
            <ScaleReference
              type={activeScaleRef}
              ringOuterDiameter={params.innerDiameter + 2 * params.thickness}
              ringInnerDiameter={params.innerDiameter}
              ringWidth={params.width}
            />
          )}

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
                opacity={sc ? 0.65 : (qualityTier === "preview" ? 0.3 : (isMobile ? 0.35 : 0.5))}
                scale={sc ? 8 : (isMobile ? 4 : 6)}
                blur={sc ? 3 : (qualityTier === "preview" ? 1 : (isMobile ? 1.5 : 2))}
                far={sc ? 5 : (isMobile ? 3 : 4)}
                resolution={sc ? 512 : (qualityTier === "preview" ? 64 : (isMobile ? 128 : 256))}
              />
            );
          })()}

          <Environment preset={activeBg.envPreset} environmentIntensity={insp ? lighting.envIntensity * 2.2 : (sc ? lighting.envIntensity * 1.8 : lighting.envIntensity * activeBg.envIntensityMul)} />
          <OrbitControls
            enablePan={false}
            enableRotate={!isRotationLocked && turntableSpeed === 0}
            minDistance={insp ? 0.8 : (isMobile ? 1.5 : 2.0)}
            maxDistance={insp ? 8 : (isMobile ? 12 : 14)}
            autoRotate={turntableSpeed > 0}
            autoRotateSpeed={turntableSpeed}
            enableDamping
            dampingFactor={isMobile ? 0.12 : 0.08}
            rotateSpeed={isMobile ? 0.5 : 1.0}
            zoomSpeed={isMobile ? 0.7 : 1.0}
            touches={{ ONE: isRotationLocked ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
          />

          {/* Rotation lock indicator */}
          {isRotationLocked && (
            <></> // Indicator rendered outside Canvas in the parent div
          )}

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
