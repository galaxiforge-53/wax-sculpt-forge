import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";

export type ScaleReferenceType = "none" | "quarter" | "ruler" | "finger";

interface ScaleReferenceProps {
  type: ScaleReferenceType;
  ringOuterDiameter: number; // in mm
}

/** Real-world scale reference objects rendered in the 3D scene */
export default function ScaleReference({ type, ringOuterDiameter }: ScaleReferenceProps) {
  // Convert mm to scene units (divided by 10)
  const scale = 0.1;
  const ringOuterR = (ringOuterDiameter / 2) * scale;

  // US Quarter: 24.26mm diameter, 1.75mm thick
  const quarterRadius = 24.26 / 2 * scale;
  const quarterThickness = 1.75 * scale;

  // Ruler: 50mm visible length, 10mm wide, 2mm thick
  const rulerLength = 50 * scale;
  const rulerWidth = 12 * scale;
  const rulerThickness = 2 * scale;

  // Finger (average ring finger): ~17mm diameter, ~50mm length
  const fingerRadius = 17 / 2 * scale;
  const fingerLength = 50 * scale;

  const quarterGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(quarterRadius, quarterRadius, quarterThickness, 64);
  }, [quarterRadius, quarterThickness]);

  const quarterMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.72, 0.72, 0.72),
      metalness: 0.9,
      roughness: 0.3,
    });
  }, []);

  // Create ruler with mm markings using canvas texture
  const rulerTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(0, 0, 512, 128);

    // Border
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 510, 126);

    // mm markings (50mm visible = 512px, so ~10.24px per mm)
    const pxPerMm = 512 / 50;
    ctx.fillStyle = "#222";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";

    for (let i = 0; i <= 50; i++) {
      const x = i * pxPerMm;
      let tickHeight = 10;

      if (i % 10 === 0) {
        tickHeight = 35;
        ctx.fillText(`${i}`, x, 70);
      } else if (i % 5 === 0) {
        tickHeight = 25;
      }

      ctx.fillRect(x - 1, 0, 2, tickHeight);
      ctx.fillRect(x - 1, 128 - tickHeight, 2, tickHeight);
    }

    // "mm" label
    ctx.font = "12px sans-serif";
    ctx.fillText("mm", 490, 110);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const fingerGeometry = useMemo(() => {
    // Simple capsule-like finger
    const geo = new THREE.CapsuleGeometry(fingerRadius, fingerLength - fingerRadius * 2, 16, 32);
    return geo;
  }, [fingerRadius, fingerLength]);

  const fingerMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.87, 0.72, 0.62),
      roughness: 0.7,
      metalness: 0.0,
    });
  }, []);

  if (type === "none") return null;

  const offsetX = ringOuterR + 0.35; // Position reference to the right of ring

  return (
    <group>
      {/* ── US Quarter ── */}
      {type === "quarter" && (
        <group position={[offsetX + quarterRadius, 0, 0]}>
          <mesh geometry={quarterGeometry} material={quarterMaterial} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow />
          {/* Coin details - simple raised edge */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <torusGeometry args={[quarterRadius - 0.01, 0.008, 8, 64]} />
            <meshStandardMaterial color="#888" metalness={0.9} roughness={0.4} />
          </mesh>
          {/* Label */}
          <Text
            position={[0, -quarterThickness / 2 - 0.08, 0]}
            fontSize={0.06}
            color="hsl(var(--muted-foreground))"
            anchorX="center"
            anchorY="top"
            rotation={[-Math.PI / 2, 0, 0]}
          >
            US Quarter (24.3mm)
          </Text>
        </group>
      )}

      {/* ── Ruler ── */}
      {type === "ruler" && (
        <group position={[offsetX + 0.1, -rulerThickness / 2, 0]} rotation={[0, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[rulerLength, rulerThickness, rulerWidth]} />
            <meshStandardMaterial 
              map={rulerTexture} 
              roughness={0.6} 
              metalness={0.0}
            />
          </mesh>
          {/* Side edges for depth */}
          <mesh position={[0, 0, rulerWidth / 2 - 0.005]}>
            <boxGeometry args={[rulerLength, rulerThickness, 0.01]} />
            <meshStandardMaterial color="#ddd5c8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, -rulerWidth / 2 + 0.005]}>
            <boxGeometry args={[rulerLength, rulerThickness, 0.01]} />
            <meshStandardMaterial color="#ddd5c8" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* ── Finger ── */}
      {type === "finger" && (
        <group position={[0, fingerLength / 2 - 0.15, 0]} rotation={[0, 0, 0]}>
          <mesh geometry={fingerGeometry} material={fingerMaterial} castShadow receiveShadow />
          {/* Fingernail hint */}
          <mesh position={[0, fingerLength / 2 - fingerRadius * 0.8, -fingerRadius * 0.7]} rotation={[0.3, 0, 0]}>
            <capsuleGeometry args={[fingerRadius * 0.6, fingerRadius * 0.4, 4, 16]} />
            <meshStandardMaterial color="#f0e0d6" roughness={0.4} metalness={0.1} />
          </mesh>
          {/* Label */}
          <Text
            position={[fingerRadius + 0.15, 0, 0]}
            fontSize={0.055}
            color="hsl(var(--muted-foreground))"
            anchorX="left"
            anchorY="middle"
          >
            Ring Finger
          </Text>
          <Text
            position={[fingerRadius + 0.15, -0.08, 0]}
            fontSize={0.04}
            color="hsl(var(--muted-foreground))"
            anchorX="left"
            anchorY="middle"
          >
            (~17mm Ø)
          </Text>
        </group>
      )}
    </group>
  );
}
