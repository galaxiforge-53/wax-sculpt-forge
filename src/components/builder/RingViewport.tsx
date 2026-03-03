import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useMemo, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import * as THREE from "three";
import { RingParameters, ViewMode, MetalPreset } from "@/types/ring";

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

interface RingMeshProps {
  params: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
}

function RingMesh({ params, viewMode, metalPreset }: RingMeshProps) {
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

  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
      {material}
    </mesh>
  );
}

function SnapshotHelper({ onReady }: { onReady: (api: { capture: (pos: [number, number, number]) => Promise<string> }) => void }) {
  const { gl, camera, scene } = useThree();
  const captureRef = useRef<(pos: [number, number, number]) => Promise<string>>();

  captureRef.current = useCallback(async (pos: [number, number, number]) => {
    const origPos = camera.position.clone();
    const origTarget = new THREE.Vector3();
    // OrbitControls sets camera lookAt to 0,0,0 by default
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

    // restore
    camera.position.copy(origPos);
    camera.lookAt(origTarget);
    camera.updateProjectionMatrix();

    return dataUrl;
  }, [gl, camera, scene]);

  // expose capture function once on mount
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
}

const RingViewport = forwardRef<RingViewportHandle, RingViewportProps>(
  function RingViewport({ params, viewMode, metalPreset }, ref) {
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

          <RingMesh params={params} viewMode={viewMode} metalPreset={metalPreset} />

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
