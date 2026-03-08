import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";

export type ScaleReferenceType = "none" | "quarter" | "ruler" | "finger";

interface ScaleReferenceProps {
  type: ScaleReferenceType;
  ringOuterDiameter: number; // in mm
  ringInnerDiameter?: number; // in mm, used for finger sizing
  ringWidth?: number; // in mm, used for finger ring placement
}

/** Real-world scale reference objects rendered in the 3D scene */
export default function ScaleReference({ type, ringOuterDiameter, ringInnerDiameter, ringWidth }: ScaleReferenceProps) {
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

  // Finger: sized to match the ring's inner diameter
  const innerDiam = ringInnerDiameter ?? 17;
  const fingerRadius = (innerDiam / 2) * scale * 0.97; // Slightly smaller so ring sits snugly
  const fingerLength = 65 * scale; // ~65mm visible finger length
  const bandW = (ringWidth ?? 6) * scale;

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

  // Finger skin texture with subtle detail
  const fingerSkinMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.87, 0.72, 0.62),
      roughness: 0.75,
      metalness: 0.0,
    });
  }, []);

  // Build a tapered finger geometry — wider at the base, narrower at the tip
  const fingerGeometry = useMemo(() => {
    const segments = 32;
    const heightSegs = 24;
    const baseR = fingerRadius;
    const tipR = fingerRadius * 0.72; // Finger narrows toward tip

    // Use lathe for natural taper
    const points: THREE.Vector2[] = [];
    const halfLen = fingerLength / 2;

    for (let i = 0; i <= heightSegs; i++) {
      const t = i / heightSegs; // 0 = bottom (base), 1 = top (tip)
      const y = -halfLen + t * fingerLength;

      let r: number;
      if (t < 0.05) {
        // Base flat cap
        r = baseR * Math.sin(t / 0.05 * Math.PI / 2);
      } else if (t > 0.88) {
        // Fingertip rounding
        const tipT = (t - 0.88) / 0.12;
        r = tipR * Math.cos(tipT * Math.PI / 2);
      } else {
        // Natural taper from base to tip
        const taperT = (t - 0.05) / 0.83;
        r = baseR + (tipR - baseR) * taperT;
        // Slight bulge around the knuckle area (~30% from base)
        const knuckleT = Math.abs(taperT - 0.3) / 0.15;
        if (knuckleT < 1) {
          r += baseR * 0.06 * (1 - knuckleT * knuckleT);
        }
      }
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }

    const geo = new THREE.LatheGeometry(points, segments);
    geo.computeVertexNormals();
    return geo;
  }, [fingerRadius, fingerLength]);

  // Knuckle crease texture (subtle lines)
  const knuckleCreaseMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.78, 0.62, 0.52),
      roughness: 0.85,
      metalness: 0.0,
      transparent: true,
      opacity: 0.5,
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

      {/* ── Finger Visualizer ── */}
      {type === "finger" && (
        <group position={[0, 0, 0]}>
          {/* Finger — positioned so ring sits naturally around it */}
          {/* Ring is at y=0, finger extends up (tip) and down (base) */}
          <group position={[0, fingerLength * 0.12, 0]}>
            {/* Main finger body */}
            <mesh geometry={fingerGeometry} material={fingerSkinMaterial} castShadow receiveShadow />

            {/* Knuckle creases — thin torus rings at knuckle positions */}
            {[-0.12, -0.1, -0.08].map((kPos, i) => (
              <mesh
                key={i}
                position={[0, fingerLength * kPos, 0]}
                rotation={[0, 0, 0]}
              >
                <torusGeometry args={[
                  fingerRadius * (1 + 0.06 * (1 - Math.abs(kPos + 0.1) / 0.04)),
                  0.003,
                  4,
                  32
                ]} />
                <primitive object={knuckleCreaseMaterial} attach="material" />
              </mesh>
            ))}

            {/* Secondary creases between ring and knuckle */}
            {[0.08, 0.1].map((kPos, i) => (
              <mesh
                key={`c${i}`}
                position={[0, fingerLength * kPos, 0]}
              >
                <torusGeometry args={[fingerRadius * 0.88, 0.002, 4, 32]} />
                <primitive object={knuckleCreaseMaterial} attach="material" />
              </mesh>
            ))}

            {/* Fingernail */}
            <group position={[0, fingerLength * 0.42, -fingerRadius * 0.72 * 0.55]} rotation={[0.2, 0, 0]}>
              <mesh castShadow>
                <capsuleGeometry args={[fingerRadius * 0.72 * 0.55, fingerRadius * 0.72 * 0.35, 4, 16]} />
                <meshStandardMaterial color="#f2e4da" roughness={0.3} metalness={0.05} />
              </mesh>
              {/* Nail edge highlight */}
              <mesh position={[0, fingerRadius * 0.72 * 0.2, -0.005]}>
                <capsuleGeometry args={[fingerRadius * 0.72 * 0.45, fingerRadius * 0.72 * 0.1, 4, 16]} />
                <meshStandardMaterial color="#faf0ea" roughness={0.2} metalness={0.05} transparent opacity={0.6} />
              </mesh>
            </group>
          </group>

          {/* Info labels */}
          <Text
            position={[fingerRadius + 0.25, -fingerLength * 0.2, 0]}
            fontSize={0.05}
            color="hsl(var(--muted-foreground))"
            anchorX="left"
            anchorY="middle"
          >
            {`Size ${Math.round(innerDiam > 0 ? Number(Object.entries(RING_SIZE_APPROX).reduce((best, [size, diam]) => 
              Math.abs(diam - innerDiam) < Math.abs(best[1] - innerDiam) ? [size, diam] as [string, number] : best, 
              ["8", 18.1] as [string, number]
            )[0]) : 8)} · Ø${innerDiam.toFixed(1)}mm`}
          </Text>
          <Text
            position={[fingerRadius + 0.25, -fingerLength * 0.2 - 0.07, 0]}
            fontSize={0.038}
            color="hsl(var(--muted-foreground))"
            anchorX="left"
            anchorY="middle"
          >
            {`Band: ${(ringWidth ?? 6).toFixed(1)}mm wide`}
          </Text>
        </group>
      )}
    </group>
  );
}

// Approximate size-to-diameter mapping for labels
const RING_SIZE_APPROX: Record<string, number> = {
  "3": 14.0, "4": 14.8, "5": 15.7, "6": 16.5, "7": 17.3, "8": 18.1,
  "9": 19.0, "10": 19.8, "11": 20.6, "12": 21.4, "13": 22.2, "14": 23.0,
  "15": 23.8, "16": 24.6,
};
