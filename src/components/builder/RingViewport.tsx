import { Canvas, useThree, ThreeEvent, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Text } from "@react-three/drei";
import { useMemo, forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect, Suspense } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { RingParameters, ViewMode, MetalPreset, FinishPreset, ToolType } from "@/types/ring";
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
      {isWax ? (
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

// ── Procedural ring mesh — high-poly with displacement when lunar enabled ──────
function ProceduralRingMesh({ params, viewMode, metalPreset, finishPreset, activeTool, onAddWaxMark, stampSettings, lunarTexture }: RingMeshProps) {
  const hasLunar = !!lunarTexture?.enabled;

  const geometry = useMemo(() => {
    const innerRadius = params.innerDiameter / 2 / 10;
    const outerRadius = innerRadius + params.thickness / 10;
    const width = params.width / 10;
    const bevel = params.bevelSize / 10;

    // When lunar is enabled, use much higher subdivision for displacement to work
    const steps = hasLunar ? 128 : 24;
    const segments = hasLunar ? 512 : 128;
    const points: THREE.Vector2[] = [];

    if (params.profile === "dome" || params.profile === "comfort") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const r = innerRadius + (outerRadius - innerRadius) * (0.5 + 0.5 * Math.sin(angle));
        const y = (t - 0.5) * width;
        points.push(new THREE.Vector2(r, y));
      }
    } else if (params.profile === "flat") {
      // For flat profile with lunar, interpolate more points for smooth displacement
      if (hasLunar) {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const y = (t - 0.5) * width;
          let r: number;
          // Create flat profile with beveled edges using more points
          const edgeDist = Math.min(t, 1 - t);
          const bevelT = Math.min(1, edgeDist / (bevel / width + 0.01));
          r = innerRadius + (outerRadius - innerRadius) * Math.min(1, bevelT);
          points.push(new THREE.Vector2(r, y));
        }
      } else {
        points.push(new THREE.Vector2(innerRadius, -width / 2));
        points.push(new THREE.Vector2(outerRadius - bevel, -width / 2));
        points.push(new THREE.Vector2(outerRadius, -width / 2 + bevel));
        points.push(new THREE.Vector2(outerRadius, width / 2 - bevel));
        points.push(new THREE.Vector2(outerRadius - bevel, width / 2));
        points.push(new THREE.Vector2(innerRadius, width / 2));
      }
    } else if (params.profile === "knife-edge") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const bulge = Math.pow(Math.sin(angle), 0.5);
        const r = innerRadius + (outerRadius - innerRadius) * bulge;
        const y = (t - 0.5) * width;
        points.push(new THREE.Vector2(r, y));
      }
    } else {
      points.push(new THREE.Vector2(innerRadius, -width / 2));
    }

    const lathe = new THREE.LatheGeometry(points, segments);
    lathe.computeVertexNormals();
    return lathe;
  }, [params, hasLunar]);

  const isWax = viewMode === "wax";
  const mc = METAL_CONFIGS[metalPreset] ?? METAL_CONFIGS.silver;
  const finishRoughMod = FINISH_ROUGHNESS_MOD[finishPreset] ?? 0;

  // Compute physical aspect ratio for circular craters
  const physicalAspect = useMemo(() => {
    const outerDiam = params.innerDiameter + 2 * params.thickness;
    const circumference = Math.PI * outerDiam;
    const width = params.width;
    return width > 0 ? circumference / width : 1;
  }, [params.innerDiameter, params.thickness, params.width]);

  // Generate lunar procedural maps for ANY ring shape
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
    // Strong normal mapping for visible crater relief
    const strength = 1.5 + (lunarTexture.intensity / 100) * 3.0;
    return new THREE.Vector2(strength, -strength);
  }, [lunarTexture?.enabled, lunarTexture?.intensity]);

  // Displacement scale — aggressive for real 3D crater depth
  const dispScale = useMemo(() => {
    if (!hasLunar || !lunarTexture) return 0;
    const outerR = params.innerDiameter / 2 / 10 + params.thickness / 10;
    // 4-12% of outer radius creates dramatic, visible craters
    return outerR * (0.04 + (lunarTexture.intensity / 100) * 0.10);
  }, [hasLunar, lunarTexture?.intensity, params.innerDiameter, params.thickness]);

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
      geometry={geometry}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      onPointerDown={handlePointerDown}
    >
      {isWax ? (
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
        />
      ) : (
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
        />
      )}
    </mesh>
  );
}

// ── Wrapper ───────────────────────────────────────────────────────
function RingMesh(props: RingMeshProps) {
  return <ProceduralRingMesh {...props} />;
}

// Render wax marks as small decal-like circles
function WaxMarkOverlays({ marks }: { marks: WaxMark[] }) {
  const visible = marks.slice(-80);

  return (
    <>
      {visible.map((mark) => {
        const pos = new THREE.Vector3(mark.position.x, mark.position.y, mark.position.z);
        const norm = new THREE.Vector3(mark.normal.x, mark.normal.y, mark.normal.z).normalize();
        const offset = pos.clone().add(norm.clone().multiplyScalar(0.002));
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
        const euler = new THREE.Euler().setFromQuaternion(quat);
        const radius = mark.radiusMm / 10;

        return (
          <mesh
            key={mark.id}
            position={[offset.x, offset.y, offset.z]}
            rotation={euler}
          >
            <circleGeometry args={[radius, 16]} />
            <meshBasicMaterial
              color="#2a4a22"
              transparent
              opacity={mark.intensity * 0.45}
              depthWrite={false}
              side={THREE.DoubleSide}
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
  const outerDiam = (params.innerDiameter + 2 * params.thickness) / 10;
  const gridSize = Math.max(3, Math.ceil(outerDiam * 3));
  const majorDivisions = gridSize; // every 10mm
  const minorDivisions = gridSize * 5; // every 2mm

  const scaleLen = 1; // 10mm

  return (
    <group position={[0, -0.85, 0]}>
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
  function RingViewport({ params, viewMode, metalPreset, finishPreset = "polished", activeTool, onAddWaxMark, waxMarks, stampSettings, inlays, lunarTexture, engraving, cameraPreset, onPresetApplied, showMeasurements, cutawayMode = "normal" }, ref) {
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
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
        >
          <ClipPlaneManager mode={cutawayMode} />
          <ambientLight intensity={viewMode === "cast" ? 0.15 : 0.3} />
          {/* Key light — rakes across craters to show relief */}
          <directionalLight
            position={[4, 6, 3]}
            intensity={viewMode === "cast" ? 2.2 : 1.8}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.001}
            color={viewMode === "wax" ? "#fff5e0" : "#fff8f0"}
          />
          {/* Fill light — cool complement for metal contrast */}
          <directionalLight
            position={[-4, 2, -3]}
            intensity={viewMode === "cast" ? 0.8 : 0.6}
            color={viewMode === "wax" ? "#ffe8c0" : "#d8e0f8"}
          />
          {/* Rim light — highlights edges and crater rims */}
          <pointLight
            position={[0, -3, 4]}
            intensity={viewMode === "cast" ? 1.0 : 0.7}
            color="#ffffff"
          />
          {/* Top accent — broad specular highlight on crown */}
          <pointLight
            position={[0, 5, 0]}
            intensity={viewMode === "cast" ? 0.6 : 0.4}
            color="#f8f4ff"
          />
          {/* Side kicker — warm edge for depth on metals */}
          <pointLight
            position={[-5, 1, -2]}
            intensity={viewMode === "cast" ? 0.5 : 0.3}
            color={viewMode === "cast" ? "#ffe0c0" : "#d0d0ff"}
          />
          {/* Back-rim grazer — catches crater rims from behind */}
          <pointLight
            position={[2, -1, -4]}
            intensity={viewMode === "cast" ? 0.4 : 0}
            color="#e8e8ff"
          />

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

          {/* Workbench measurement bed */}
          <WorkbenchGrid params={params} />

          {/* Measurement dimension guides */}
          <MeasurementOverlay params={params} visible={!!showMeasurements} />

          <ContactShadows
            position={[0, -0.84, 0]}
            opacity={0.5}
            scale={6}
            blur={2}
            far={4}
          />

          <Environment preset={viewMode === "wax" ? "warehouse" : "city"} />
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
