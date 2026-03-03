import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Decal } from "@react-three/drei";
import { useMemo, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import * as THREE from "three";
import { RingParameters, ViewMode, MetalPreset, ToolType } from "@/types/ring";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { StampSettings } from "@/hooks/useRingDesign";
import { getCraterTexture, getPitTexture, getGrainTexture } from "@/lib/lunarDecalTexture";

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

// ── Seeded RNG ────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };
}

// ── Lunar decal data types ────────────────────────────────────────
interface DecalDatum {
  position: [number, number, number];
  scale: [number, number, number];
  roll: number;
  opacity: number;
  kind: "crater" | "pit" | "grain";
}

function generateLunarDecals(params: RingParameters, lunar: LunarTextureState): DecalDatum[] {
  const innerRadius = params.innerDiameter / 2 / 10;
  const outerRadius = innerRadius + params.thickness / 10;
  const ringWidth = params.width / 10;
  const surfaceR = outerRadius + 0.001; // tiny offset to avoid z-fight
  const rand = seededRng(lunar.seed);
  const overlapFactor = lunar.overlapIntensity / 100;
  const microFactor = lunar.microDetail / 100;

  const edgeFalloff = lunar.smoothEdges
    ? (y: number) => { const t = Math.abs(y) / (ringWidth * 0.5); return Math.max(0, 1 - t * t); }
    : () => 1;

  const craterBase = lunar.craterDensity === "low" ? 12 : lunar.craterDensity === "med" ? 28 : 50;
  const craterCount = Math.min(craterBase, 60);
  const pitCount = Math.min(Math.round(20 + microFactor * 40), 60);
  const grainCount = Math.min(Math.round(microFactor * 80), 80);
  const baseSize = lunar.craterSize === "small" ? 0.025 : lunar.craterSize === "med" ? 0.045 : 0.07;

  const decals: DecalDatum[] = [];
  let lastAngle = 0;

  // Large craters
  for (let i = 0; i < craterCount; i++) {
    const y = (rand() - 0.5) * ringWidth * 0.85;
    const ef = edgeFalloff(y);
    if (ef < 0.05) continue;
    const angle = i > 0 && rand() < overlapFactor * 0.4
      ? lastAngle + (rand() - 0.5) * 0.3
      : rand() * Math.PI * 2;
    lastAngle = angle;
    const size = baseSize * (0.6 + rand() * 0.8) * ef;

    // Position in mesh local space (LatheGeometry around Y)
    const x = Math.cos(angle) * surfaceR;
    const z = Math.sin(angle) * surfaceR;

    decals.push({
      position: [x, y, z],
      scale: [size, size, size * 0.5],
      roll: rand() * Math.PI * 2,
      opacity: (0.4 + rand() * 0.4) * ef,
      kind: "crater",
    });
  }

  // Mid-scale pits
  for (let i = 0; i < pitCount; i++) {
    const y = (rand() - 0.5) * ringWidth * 0.9;
    const ef = edgeFalloff(y);
    if (ef < 0.05) continue;
    const angle = rand() * Math.PI * 2;
    const size = 0.012 + rand() * 0.015;

    decals.push({
      position: [Math.cos(angle) * surfaceR, y, Math.sin(angle) * surfaceR],
      scale: [size * ef, size * ef, size * 0.4],
      roll: rand() * Math.PI * 2,
      opacity: (0.25 + rand() * 0.25) * ef,
      kind: "pit",
    });
  }

  // Micro grain
  for (let i = 0; i < grainCount; i++) {
    const y = (rand() - 0.5) * ringWidth * 0.95;
    const ef = edgeFalloff(y);
    if (ef < 0.05) continue;
    const angle = rand() * Math.PI * 2;
    const size = 0.005 + rand() * 0.008;

    decals.push({
      position: [Math.cos(angle) * surfaceR, y, Math.sin(angle) * surfaceR],
      scale: [size * ef, size * ef, size * 0.3],
      roll: rand() * Math.PI * 2,
      opacity: (0.15 + rand() * 0.15) * ef,
      kind: "grain",
    });
  }

  return decals;
}

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
  const geometry = useMemo(() => {
    const innerRadius = params.innerDiameter / 2 / 10;
    const outerRadius = innerRadius + params.thickness / 10;
    const width = params.width / 10;
    const points: THREE.Vector2[] = [];
    const steps = 24;
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
      points.push(new THREE.Vector2(innerRadius, -width / 2));
      points.push(new THREE.Vector2(outerRadius - bevel, -width / 2));
      points.push(new THREE.Vector2(outerRadius, -width / 2 + bevel));
      points.push(new THREE.Vector2(outerRadius, width / 2 - bevel));
      points.push(new THREE.Vector2(outerRadius - bevel, width / 2));
      points.push(new THREE.Vector2(innerRadius, width / 2));
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
      points.push(new THREE.Vector2(outerRadius, -width / 2));
      points.push(new THREE.Vector2(outerRadius, width / 2));
      points.push(new THREE.Vector2(innerRadius, width / 2));
    }

    const lathe = new THREE.LatheGeometry(points, 64);

    if (params.grooveCount > 0) {
      const posAttr = lathe.attributes.position;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        for (let g = 0; g < params.grooveCount; g++) {
          const grooveY = ((g + 1) / (params.grooveCount + 1) - 0.5) * width;
          const dist = Math.abs(y - grooveY);
          const grooveWidth = 0.02;
          if (dist < grooveWidth) {
            const depth = params.grooveDepth / 10 * (1 - dist / grooveWidth);
            const scale = (r - depth) / r;
            posAttr.setX(i, x * scale);
            posAttr.setZ(i, z * scale);
          }
        }
      }
      posAttr.needsUpdate = true;
    }

    lathe.computeVertexNormals();
    return lathe;
  }, [params]);

  const material = useMemo(() => {
    if (viewMode === "wax") {
      return (
        <meshStandardMaterial
          color="#4a7a3a"
          roughness={0.85}
          metalness={0.0}
          envMapIntensity={0.2}
        />
      );
    }

    const metalColors: Record<MetalPreset, string> = {
      silver: "#C0C0C0",
      gold: "#FFD700",
      "rose-gold": "#E8A090",
      titanium: "#878681",
      tungsten: "#6B6B6B",
    };

    return (
      <meshStandardMaterial
        color={metalColors[metalPreset]}
        roughness={0.15}
        metalness={0.95}
        envMapIntensity={1.5}
      />
    );
  }, [viewMode, metalPreset]);

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

  // Generate lunar decals (memoized, seeded)
  const lunarDecals = useMemo(() => {
    if (!lunarTexture?.enabled) return [];
    return generateLunarDecals(params, lunarTexture);
  }, [
    lunarTexture?.enabled, lunarTexture?.seed, lunarTexture?.intensity,
    lunarTexture?.craterDensity, lunarTexture?.craterSize,
    lunarTexture?.microDetail, lunarTexture?.rimSharpness,
    lunarTexture?.overlapIntensity, lunarTexture?.smoothEdges,
    params,
  ]);

  const globalOpacity = (lunarTexture?.intensity ?? 50) / 100;
  const rimSharpness = (lunarTexture?.rimSharpness ?? 50) / 100;

  return (
    <mesh
      geometry={geometry}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      onPointerDown={handlePointerDown}
    >
      {material}

      {/* Lunar decals projected onto ring surface */}
      {lunarDecals.map((d, i) => {
        const map = d.kind === "crater"
          ? getCraterTexture(rimSharpness)
          : d.kind === "pit"
            ? getPitTexture()
            : getGrainTexture();

        return (
          <Decal
            key={`lunar-${d.kind}-${i}`}
            position={d.position}
            rotation={d.roll as any}
            scale={d.scale}
            map={map}
          >
            <meshStandardMaterial
              transparent
              depthWrite={false}
              depthTest
              polygonOffset
              polygonOffsetFactor={-4}
              map={map}
              opacity={globalOpacity * d.opacity}
              roughness={0.9}
              metalness={0}
            />
          </Decal>
        );
      })}
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
        // offset slightly above surface
        const offset = pos.clone().add(norm.clone().multiplyScalar(0.002));
        // orient plane to face along normal
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
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={1.2}
            castShadow
            color={viewMode === "wax" ? "#fff5e0" : "#ffffff"}
          />
          <pointLight
            position={[-3, 2, -2]}
            intensity={0.5}
            color={viewMode === "wax" ? "#ff8c00" : "#ffffff"}
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
