import { Canvas, useThree, ThreeEvent, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useMemo, forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect, Suspense } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { RingParameters, ViewMode, MetalPreset, ToolType } from "@/types/ring";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { StampSettings } from "@/hooks/useRingDesign";
import { generateLunarSurfaceMaps } from "@/lib/lunarSurfaceMaps";

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
  activeTool: ToolType | null;
  onAddWaxMark?: (mark: Omit<WaxMark, "id" | "createdAt">) => void;
  stampSettings?: StampSettings;
  lunarTexture?: LunarTextureState;
}

// ── STL-based lunar ring mesh ──────────────────────────────────────
function LunarSTLMesh({ params, viewMode, metalPreset, lunarTexture, activeTool, onAddWaxMark, stampSettings }: RingMeshProps) {
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
  const metalColors: Record<MetalPreset, string> = {
    silver: "#C0C0C0", gold: "#FFD700", "rose-gold": "#E8A090",
    titanium: "#878681", tungsten: "#6B6B6B",
  };

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
          color={metalColors[metalPreset] ?? "#C0C0C0"}
          roughness={0.45}
          metalness={0.95}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={1.8}
          normalScale={normalScale}
          envMapIntensity={2.0}
          clearcoat={0.08}
          clearcoatRoughness={0.3}
          reflectivity={0.95}
        />
      )}
    </mesh>
  );
}

// ── Procedural ring mesh — high-poly with displacement when lunar enabled ──────
function ProceduralRingMesh({ params, viewMode, metalPreset, activeTool, onAddWaxMark, stampSettings, lunarTexture }: RingMeshProps) {
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
  const metalColors: Record<MetalPreset, string> = {
    silver: "#C0C0C0", gold: "#FFD700", "rose-gold": "#E8A090",
    titanium: "#878681", tungsten: "#6B6B6B",
  };

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
          color={metalColors[metalPreset] ?? "#C0C0C0"}
          roughness={hasLunar ? 0.45 : 0.35}
          metalness={0.95}
          normalMap={lunarMaps?.normalMap ?? null}
          roughnessMap={lunarMaps?.roughnessMap ?? null}
          aoMap={lunarMaps?.aoMap ?? null}
          aoMapIntensity={hasLunar ? 2.0 : 0}
          normalScale={normalScale}
          envMapIntensity={hasLunar ? 2.0 : 1.0}
          clearcoat={hasLunar ? 0.08 : 0}
          clearcoatRoughness={0.3}
          reflectivity={hasLunar ? 0.95 : 0.9}
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
  const gridSize = Math.max(4, Math.ceil(outerDiam * 4));
  const divisions = gridSize * 10; // 1mm divisions

  // Scale indicator length in scene units (10mm = 1cm)
  const scaleLen = 1; // 10mm in scene units (1 unit = 10mm)

  return (
    <group position={[0, -0.85, 0]}>
      {/* Measurement bed plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[gridSize, gridSize]} />
        <meshStandardMaterial
          color="#1a1a1e"
          roughness={0.95}
          metalness={0.05}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Subtle grid lines */}
      <gridHelper
        args={[gridSize, divisions, "#333340", "#222228"]}
        position={[0, 0.001, 0]}
      />

      {/* Major grid lines (every 10mm) */}
      <gridHelper
        args={[gridSize, gridSize, "#444450", "#2a2a32"]}
        position={[0, 0.002, 0]}
      />

      {/* Scale indicator bar */}
      <group position={[gridSize * 0.35, 0.003, gridSize * 0.35]}>
        {/* Bar */}
        <mesh>
          <boxGeometry args={[scaleLen, 0.004, 0.02]} />
          <meshBasicMaterial color="#666680" />
        </mesh>
        {/* End ticks */}
        <mesh position={[-scaleLen / 2, 0, 0]}>
          <boxGeometry args={[0.005, 0.004, 0.05]} />
          <meshBasicMaterial color="#666680" />
        </mesh>
        <mesh position={[scaleLen / 2, 0, 0]}>
          <boxGeometry args={[0.005, 0.004, 0.05]} />
          <meshBasicMaterial color="#666680" />
        </mesh>
      </group>
    </group>
  );
}

interface RingViewportProps {
  params: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  activeTool?: ToolType | null;
  onAddWaxMark?: (mark: Omit<WaxMark, "id" | "createdAt">) => void;
  waxMarks?: WaxMark[];
  stampSettings?: StampSettings;
  inlays?: InlayChannel[];
  lunarTexture?: LunarTextureState;
}

const RingViewport = forwardRef<RingViewportHandle, RingViewportProps>(
  function RingViewport({ params, viewMode, metalPreset, activeTool, onAddWaxMark, waxMarks, stampSettings, inlays, lunarTexture }, ref) {
    const snapshotApiRef = useRef<{ capture: (pos: [number, number, number]) => Promise<string> } | null>(null);

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

    return (
      <div className="w-full h-full bg-forge-dark rounded-lg overflow-hidden">
        <Canvas
          camera={{ position: [0, 2, 4], fov: 35 }}
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <ambientLight intensity={0.25} />
          {/* Key light — rakes across craters to show relief */}
          <directionalLight
            position={[4, 6, 3]}
            intensity={1.8}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.001}
            color={viewMode === "wax" ? "#fff5e0" : "#ffffff"}
          />
          {/* Fill light — softer, opposite side */}
          <directionalLight
            position={[-4, 2, -3]}
            intensity={0.5}
            color={viewMode === "wax" ? "#ffe8c0" : "#e8e8ff"}
          />
          {/* Rim light — highlights edges and crater rims */}
          <pointLight
            position={[0, -3, 4]}
            intensity={0.7}
            color="#ffffff"
          />
          {/* Top accent for specular highlights */}
          <pointLight
            position={[0, 5, 0]}
            intensity={0.3}
            color="#f0f0ff"
          />

          <RingMesh
            params={params}
            viewMode={viewMode}
            metalPreset={metalPreset}
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

          {/* Workbench measurement bed */}
          <WorkbenchGrid params={params} />

          <ContactShadows
            position={[0, -0.84, 0]}
            opacity={0.6}
            scale={6}
            blur={2.5}
            far={4}
          />

          <Environment preset={viewMode === "wax" ? "warehouse" : "studio"} />
          <OrbitControls
            enablePan={false}
            minDistance={1.5}
            maxDistance={8}
            autoRotate
            autoRotateSpeed={0.5}
          />

          <SnapshotHelper onReady={handleSnapshotReady} />
        </Canvas>
      </div>
    );
  }
);

export default RingViewport;
