import { useMemo } from "react";
import { Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { RingParameters, RingSizeStandard, DimensionUnit, formatRingSize, formatDimension } from "@/types/ring";

interface MeasurementOverlayProps {
  params: RingParameters;
  visible: boolean;
  sizeStandard?: RingSizeStandard;
  dimensionUnit?: DimensionUnit;
}

/** Subtle 3D dimension guides rendered inside the Canvas */
export default function MeasurementOverlay({ params, visible, sizeStandard = "US", dimensionUnit = "mm" }: MeasurementOverlayProps) {
  const innerR = params.innerDiameter / 2 / 10;
  const outerR = innerR + params.thickness / 10;
  const width = params.width / 10;
  const halfW = width / 2;

  const guideColor = "#6688aa";
  const dimColor = "#88aacc";
  const fontSize = 0.045;
  const lineWidth = 1;

  // Inner diameter guide — horizontal line through bore
  const innerDiamLine = useMemo(() => {
    const pts: [number, number, number][] = [[-innerR, 0, 0], [innerR, 0, 0]];
    return pts;
  }, [innerR]);

  // Outer diameter guide (dashed style via two short ticks + label)
  const outerDiamLine = useMemo(() => {
    const pts: [number, number, number][] = [[-outerR, 0, 0], [outerR, 0, 0]];
    return pts;
  }, [outerR]);

  // Width guide — vertical line on the side
  const widthGuideX = outerR + 0.15;
  const widthLine = useMemo((): [number, number, number][] => {
    return [[widthGuideX, -halfW, 0], [widthGuideX, halfW, 0]];
  }, [widthGuideX, halfW]);

  // Thickness guide — horizontal line showing wall thickness
  const thicknessY = halfW + 0.12;
  const thicknessLine = useMemo((): [number, number, number][] => {
    return [[innerR, thicknessY, 0], [outerR, thicknessY, 0]];
  }, [innerR, outerR, thicknessY]);

  // Inner diameter arc (partial circle to show the bore)
  const innerArcPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * innerR, 0, Math.sin(angle) * innerR));
    }
    return pts;
  }, [innerR]);

  // Comfort fit curve indicator — small arc on inside surface
  const comfortArcPoints = useMemo(() => {
    if (!params.comfortFit) return null;
    const pts: THREE.Vector3[] = [];
    const segments = 32;
    const comfortDepth = params.thickness * 0.15 / 10; // subtle curve depth
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = (t - 0.5) * width;
      const curve = Math.sin(t * Math.PI) * comfortDepth;
      pts.push(new THREE.Vector3(innerR - curve, y, 0));
    }
    return pts;
  }, [params.comfortFit, innerR, width, params.thickness]);

  // Tick marks helper
  const tickLen = 0.04;

  if (!visible) return null;

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {/* ── Inner Diameter ── */}
      <Line
        points={innerDiamLine}
        color={guideColor}
        lineWidth={lineWidth}
        dashed
        dashSize={0.03}
        gapSize={0.02}
        transparent
        opacity={0.6}
      />
      {/* End ticks */}
      <Line points={[[-innerR, -tickLen, 0], [-innerR, tickLen, 0]]} color={guideColor} lineWidth={lineWidth} transparent opacity={0.6} />
      <Line points={[[innerR, -tickLen, 0], [innerR, tickLen, 0]]} color={guideColor} lineWidth={lineWidth} transparent opacity={0.6} />
      {/* Label */}
      <Text
        position={[0, -0.08, 0]}
        fontSize={fontSize}
        color={dimColor}
        anchorX="center"
        anchorY="top"
      >
        {`Ø${formatDimension(params.innerDiameter, dimensionUnit)} (ID)`}
      </Text>

      {/* ── Width ── */}
      <Line
        points={widthLine}
        color={guideColor}
        lineWidth={lineWidth}
        transparent
        opacity={0.6}
      />
      {/* Top/bottom ticks */}
      <Line points={[[widthGuideX - tickLen, -halfW, 0], [widthGuideX + tickLen, -halfW, 0]]} color={guideColor} lineWidth={lineWidth} transparent opacity={0.6} />
      <Line points={[[widthGuideX - tickLen, halfW, 0], [widthGuideX + tickLen, halfW, 0]]} color={guideColor} lineWidth={lineWidth} transparent opacity={0.6} />
      <Text
        position={[widthGuideX + 0.08, 0, 0]}
        fontSize={fontSize}
        color={dimColor}
        anchorX="left"
        anchorY="middle"
        rotation={[0, 0, -Math.PI / 2]}
      >
        {`${formatDimension(params.width, dimensionUnit)} W`}
      </Text>

      {/* ── Thickness ── */}
      <Line
        points={thicknessLine}
        color={guideColor}
        lineWidth={lineWidth}
        transparent
        opacity={0.6}
      />
      <Line points={[[innerR, thicknessY - tickLen, 0], [innerR, thicknessY + tickLen, 0]]} color={guideColor} lineWidth={lineWidth} transparent opacity={0.6} />
      <Line points={[[outerR, thicknessY - tickLen, 0], [outerR, thicknessY + tickLen, 0]]} color={guideColor} lineWidth={lineWidth} transparent opacity={0.6} />
      <Text
        position={[(innerR + outerR) / 2, thicknessY + 0.06, 0]}
        fontSize={fontSize * 0.9}
        color={dimColor}
        anchorX="center"
        anchorY="bottom"
      >
        {`${formatDimension(params.thickness, dimensionUnit)} T`}
      </Text>

      {/* ── Inner bore circle ── */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={innerArcPoints.length}
            array={new Float32Array(innerArcPoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={guideColor} transparent opacity={0.25} />
      </line>

      {/* ── Comfort Fit Curve ── */}
      {comfortArcPoints && (
        <>
          <Line
            points={comfortArcPoints.map(p => [p.x, p.y, p.z] as [number, number, number])}
            color="#99cc88"
            lineWidth={1.5}
            transparent
            opacity={0.7}
          />
          <Text
            position={[innerR - 0.08, 0, 0.06]}
            fontSize={fontSize * 0.8}
            color="#99cc88"
            anchorX="right"
            anchorY="middle"
          >
            Comfort Fit
          </Text>
        </>
      )}

      {/* ── Ring Size label ── */}
      <Text
        position={[0, halfW + 0.18, 0]}
        fontSize={fontSize * 1.1}
        color={dimColor}
        anchorX="center"
        anchorY="bottom"
        fontWeight="bold"
      >
        {`${sizeStandard} Size ${formatRingSize(params.size, sizeStandard)}`}
      </Text>

      {/* ── Outer diameter (faint) ── */}
      <Line
        points={outerDiamLine}
        color={guideColor}
        lineWidth={lineWidth}
        dashed
        dashSize={0.02}
        gapSize={0.03}
        transparent
        opacity={0.25}
      />
      <Text
        position={[0, 0.08, 0]}
        fontSize={fontSize * 0.75}
        color={guideColor}
        anchorX="center"
        anchorY="bottom"
      >
        {`OD ${formatDimension(params.innerDiameter + 2 * params.thickness, dimensionUnit)}`}
      </Text>
    </group>
  );
}
