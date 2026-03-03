import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useMemo, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import * as THREE from "three";
import { RingParameters, ViewMode, MetalPreset, ToolType } from "@/types/ring";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { StampSettings } from "@/hooks/useRingDesign";
import { generateLunarSurfaceMaps } from "@/lib/lunarSurfaceMaps";

export interface RingViewportHandle {
  captureSnapshot(
    anglePreset: "front" | "angle" | "side",
    viewMode: ViewMode
  ): Promise<string>;
}

const CAMERA_PRESETS: Record<"front" | "angle" | "side", [number, number, number]> = {
  front: [0, 0, 4],
  angle: [2.8, 2, 2.8],
  side: [4, 0, 0],
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

function RingMesh({ params, viewMode, metalPreset, activeTool, onAddWaxMark, stampSettings, lunarTexture }: RingMeshProps) {
  const hasLunarEnabled = !!lunarTexture?.enabled;

  const geometry = useMemo(() => {
    const innerRadius = params.innerDiameter / 2 / 10;
    const outerRadius = innerRadius + params.thickness / 10;
    const width = params.width / 10;
    const points: THREE.Vector2[] = [];
    // High resolution for displacement mapping when lunar is on
    const steps = hasLunarEnabled ? 80 : 24;
    const bevel = params.bevelSize / 10;

    if (params.profile === "dome" || params.profile === "comfort") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const r = innerRadius + (outerRadius - innerRadius) * (0.5 + 0.5 * Math.sin(angle));
        const y = (t - 0.5) * width;
        points.push(new THREE.Vector2(r, y));
      }
    } else if (params.profile === "flat") {
      // For flat profile, generate many intermediate points for displacement
      if (hasLunarEnabled) {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const y = (t - 0.5) * width;
          // Flat outer surface with small bevel at edges
          const edgeDist = Math.min(t, 1 - t) * steps;
          const bevelFactor = edgeDist < 2 ? edgeDist / 2 : 1;
          const r = innerRadius + (outerRadius - innerRadius) * bevelFactor;
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

    // More radial segments when lunar is active for smooth displacement
    const radialSegs = hasLunarEnabled ? 256 : 128;
    const lathe = new THREE.LatheGeometry(points, radialSegs);
    // Copy uv to uv2 so aoMap works (Three.js requires second UV set)
    if (lathe.attributes.uv) {
      lathe.setAttribute("uv2", lathe.attributes.uv);
    }

    lathe.computeVertexNormals();
    return lathe;
  }, [params, hasLunarEnabled]);

  // Generate UV-space lunar surface maps (normalMap + roughnessMap)
  const lunarMaps = useMemo(() => {
    if (!lunarTexture?.enabled) return null;
    return generateLunarSurfaceMaps(lunarTexture);
  }, [
    lunarTexture?.enabled, lunarTexture?.seed, lunarTexture?.intensity,
    lunarTexture?.craterDensity, lunarTexture?.craterSize,
    lunarTexture?.microDetail, lunarTexture?.rimSharpness,
    lunarTexture?.overlapIntensity, lunarTexture?.smoothEdges,
  ]);

  const normalScale = useMemo(() => {
    if (!lunarTexture?.enabled) return new THREE.Vector2(0, 0);
    // Normal map is now for micro-detail only; displacement handles macro depth
    const strength = 0.3 + (lunarTexture.intensity / 100) * 0.7;
    return new THREE.Vector2(strength, -strength);
  }, [lunarTexture?.enabled, lunarTexture?.intensity]);

  // Displacement scale: how deep craters physically carve into geometry
  const displacementScale = useMemo(() => {
    if (!lunarTexture?.enabled) return 0;
    const thickness = params.thickness / 10;
    // Aggressive displacement — craters should be visibly carved
    return thickness * 0.25 * (lunarTexture.intensity / 100);
  }, [lunarTexture?.enabled, lunarTexture?.intensity, params.thickness]);

  const isWax = viewMode === "wax";

  const metalColors: Record<MetalPreset, string> = {
    silver: "#C0C0C0",
    gold: "#FFD700",
    "rose-gold": "#E8A090",
    titanium: "#878681",
    tungsten: "#6B6B6B",
  };

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "wax" || activeTool !== "stamp" || !onAddWaxMark) return;
    e.stopPropagation();
    const point = e.point;
    const normal = e.face?.normal ?? new THREE.Vector3(0, 1, 0);
    const worldNormal = normal.clone();
    if (e.object) {
      worldNormal.transformDirection(e.object.matrixWorld);
    }
    onAddWaxMark({
      type: stampSettings?.type ?? "dent",
      position: { x: point.x, y: point.y, z: point.z },
      normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      radiusMm: stampSettings?.radiusMm ?? 1.2,
      intensity: stampSettings?.intensity ?? 0.65,
    });
  }, [viewMode, activeTool, onAddWaxMark, stampSettings]);

  const hasLunar = lunarTexture?.enabled && lunarMaps;

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
          roughness={0.85}
          metalness={0.05}
          normalMap={hasLunar ? lunarMaps.normalMap : null}
          roughnessMap={hasLunar ? lunarMaps.roughnessMap : null}
          aoMap={hasLunar ? lunarMaps.aoMap : null}
          aoMapIntensity={1.5}
          map={hasLunar ? lunarMaps.albedoMap : null}
          normalScale={normalScale}
          displacementMap={hasLunar ? lunarMaps.displacementMap : null}
          displacementScale={hasLunar ? -displacementScale : 0}
          displacementBias={hasLunar ? displacementScale * 0.5 : 0}
        />
      ) : (
        <meshPhysicalMaterial
          color={metalColors[metalPreset] ?? "#C0C0C0"}
          roughness={hasLunar ? 0.5 : 0.35}
          metalness={0.95}
          normalMap={hasLunar ? lunarMaps.normalMap : null}
          roughnessMap={hasLunar ? lunarMaps.roughnessMap : null}
          aoMap={hasLunar ? lunarMaps.aoMap : null}
          aoMapIntensity={2.0}
          normalScale={normalScale}
          envMapIntensity={hasLunar ? 1.8 : 1.0}
          clearcoat={hasLunar ? 0.1 : 0}
          clearcoatRoughness={0.4}
          reflectivity={0.9}
          displacementMap={hasLunar ? lunarMaps.displacementMap : null}
          displacementScale={hasLunar ? -displacementScale : 0}
          displacementBias={hasLunar ? displacementScale * 0.5 : 0}
        />
      )}
    </mesh>
  );
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
    const origTarget = new THREE.Vector3();
    camera.position.set(...pos);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    gl.render(scene, camera);

    let dataUrl = "";
    try {
      dataUrl = gl.domElement.toDataURL("image/webp", 0.85);
      if (!dataUrl || dataUrl.length < 100) {
        dataUrl = gl.domElement.toDataURL("image/png");
      }
    } catch {
      dataUrl = "";
    }

    camera.position.copy(origPos);
    camera.lookAt(origTarget);
    camera.updateProjectionMatrix();

    return dataUrl;
  }, [gl, camera, scene]);

  useMemo(() => {
    onReady({
      capture: (pos) => captureRef.current!(pos),
    });
  }, [onReady]);

  return null;
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
          <ambientLight intensity={0.2} />
          {/* Key light — rakes across craters to show relief */}
          <directionalLight
            position={[4, 6, 3]}
            intensity={1.6}
            castShadow
            color={viewMode === "wax" ? "#fff5e0" : "#ffffff"}
          />
          {/* Fill light — softer, opposite side */}
          <directionalLight
            position={[-4, 2, -3]}
            intensity={0.4}
            color={viewMode === "wax" ? "#ffe8c0" : "#e8e8ff"}
          />
          {/* Rim light — highlights edges and crater rims */}
          <pointLight
            position={[0, -3, 4]}
            intensity={0.6}
            color="#ffffff"
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

          <ContactShadows
            position={[0, -0.8, 0]}
            opacity={0.5}
            scale={5}
            blur={2}
            far={3}
          />

          <Environment preset={viewMode === "wax" ? "warehouse" : "studio"} />
          <OrbitControls
            enablePan={false}
            minDistance={2}
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
