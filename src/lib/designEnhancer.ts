/**
 * Design Enhancement Engine
 * Analyzes a ring design and returns intelligent parameter adjustments
 * that improve visual quality while preserving the designer's intent.
 */

import { RingParameters } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";

export interface EnhancementResult {
  params: Partial<RingParameters>;
  lunar: Partial<LunarTextureState> | null;
  engraving: Partial<EngravingState> | null;
  summary: string[];
}

export interface SurfaceEnhancementResult {
  patch: Partial<LunarTextureState>;
  summary: string[];
}

/**
 * Intelligently enhance surface texture while preserving the user's design style.
 * Analyzes current settings and nudges them toward physically realistic ranges
 * without overriding creative intent.
 */
export function enhanceSurface(
  lunar: LunarTextureState,
  ringThickness: number = 2.0,
): SurfaceEnhancementResult {
  const patch: Partial<LunarTextureState> = {};
  const summary: string[] = [];

  // Detect design "style" to preserve intent
  const isHeavyTexture = lunar.intensity > 65;
  const isSubtle = lunar.intensity < 35;
  const isDense = lunar.craterDensity === "high";
  const isSparse = lunar.craterDensity === "low";

  // ── 1. Crater realism: rim-to-bowl ratio ──
  // Real craters have rim height ≈ 50-70% of bowl depth
  const bowlDepth = lunar.bowlDepth ?? 60;
  const rimHeight = lunar.rimHeight ?? 55;
  const rimRatio = bowlDepth > 0 ? rimHeight / bowlDepth : 1;
  if (rimRatio < 0.4 || rimRatio > 1.0) {
    const idealRim = Math.round(bowlDepth * 0.62);
    patch.rimHeight = idealRim;
    summary.push(`Balanced rim height to ${idealRim}% for natural crater profile`);
  }

  // ── 2. Crater variation — real surfaces have irregular craters ──
  const variation = lunar.craterVariation ?? 50;
  if (variation < 35) {
    patch.craterVariation = Math.min(variation + 20, 65);
    summary.push("Increased crater variation for organic irregularity");
  }

  // ── 3. Rim sharpness — optimize for light-catching ──
  const rimSharp = lunar.rimSharpness ?? 50;
  if (rimSharp < 35) {
    patch.rimSharpness = 45;
    summary.push("Sharpened crater rims for better light-catching definition");
  } else if (rimSharp > 80) {
    patch.rimSharpness = 72;
    summary.push("Softened rim edges for natural weathered appearance");
  }

  // ── 4. Micro detail — balance to crater density ──
  const idealMicro = isDense ? 55 : isSparse ? 28 : 42;
  const microDelta = Math.abs(lunar.microDetail - idealMicro);
  if (microDelta > 18) {
    patch.microDetail = idealMicro;
    summary.push(`Tuned micro-pitting to ${idealMicro}% to complement ${lunar.craterDensity} crater density`);
  }

  // ── 5. Terrain roughness — ensure base texture exists ──
  const roughness = lunar.terrainRoughness ?? 35;
  if (roughness < 18) {
    patch.terrainRoughness = 28;
    summary.push("Added base terrain texture for inter-crater surface realism");
  } else if (roughness > 75 && !isHeavyTexture) {
    patch.terrainRoughness = 60;
    summary.push("Reduced terrain roughness to let craters stand out");
  }

  // ── 6. Erosion — natural weathering balance ──
  const erosion = lunar.erosion ?? 25;
  if (erosion < 8) {
    patch.erosion = 18;
    summary.push("Added subtle erosion for natural weathered look");
  } else if (erosion > 65 && rimSharp > 40) {
    patch.erosion = 50;
    summary.push("Balanced erosion to preserve crater rim definition");
  }

  // ── 7. Ejecta strength — proportional to crater size ──
  const ejecta = lunar.ejectaStrength ?? 50;
  const idealEjecta = lunar.craterSize === "large" ? 65 : lunar.craterSize === "small" ? 25 : 45;
  if (Math.abs(ejecta - idealEjecta) > 25) {
    patch.ejectaStrength = idealEjecta;
    summary.push(`Adjusted ejecta to ${idealEjecta}% for ${lunar.craterSize} crater scale`);
  }

  // ── 8. Overlap intensity — prevent over-cratering ──
  const overlap = lunar.overlapIntensity ?? 25;
  if (isDense && overlap > 60) {
    patch.overlapIntensity = 45;
    summary.push("Reduced overlap to prevent over-saturated surface");
  } else if (isSparse && overlap < 15) {
    patch.overlapIntensity = 25;
    summary.push("Added secondary impacts for realistic bombardment pattern");
  }

  // ── 9. Crater floor texture — adds realism inside bowls ──
  const floorTex = lunar.craterFloorTexture ?? 30;
  if (floorTex < 15) {
    patch.craterFloorTexture = 30;
    summary.push("Added crater floor texture for interior detail");
  }

  // ── 10. Highland ridges — complement sparse surfaces ──
  const ridges = lunar.highlandRidges ?? 0;
  if (isSparse && ridges < 10 && roughness < 40) {
    patch.highlandRidges = 20;
    summary.push("Added subtle highland ridges to fill sparse terrain");
  }

  // ── 11. Intensity safety check vs ring thickness ──
  const maxSafeIntensity = Math.min(95, ringThickness * 35);
  if (lunar.intensity > maxSafeIntensity) {
    patch.intensity = Math.round(maxSafeIntensity);
    summary.push(`Capped intensity to ${patch.intensity}% for ${ringThickness}mm wall safety`);
  }

  // ── 12. Layer mix balance ──
  const layerLarge = lunar.layerLargeCraters ?? 50;
  const layerMedium = lunar.layerMediumImpacts ?? 50;
  const layerMicro = lunar.layerMicroPitting ?? 50;
  // Ensure at least some contribution from each active layer
  if (layerLarge < 15 && !isSparse) {
    patch.layerLargeCraters = 30;
    summary.push("Boosted large crater layer for scale hierarchy");
  }
  if (layerMedium < 15) {
    patch.layerMediumImpacts = 30;
    summary.push("Boosted medium impact layer for density fill");
  }
  if (layerMicro < 15 && lunar.microDetail > 20) {
    patch.layerMicroPitting = 30;
    summary.push("Boosted micro-pitting for fine surface grain");
  }

  // ── Fallback ──
  if (summary.length === 0) {
    summary.push("Surface is already well-optimized — no changes needed");
  }

  return { patch, summary };
}

/**
 * Analyze current design state and return recommended enhancements.
 * The algorithm preserves the user's creative direction while optimizing
 * for manufacturing viability, visual balance, and realism.
 */
export function computeEnhancements(
  params: RingParameters,
  lunar: LunarTextureState,
  engraving: EngravingState
): EnhancementResult {
  const patchParams: Partial<RingParameters> = {};
  const patchLunar: Partial<LunarTextureState> = {};
  const patchEngraving: Partial<EngravingState> = {};
  const summary: string[] = [];
  let hasLunarChanges = false;
  let hasEngravingChanges = false;

  // ── 1. Structural integrity ────────────────────────────────────
  // Ensure minimum wall thickness for casting viability
  if (params.thickness < 1.5) {
    patchParams.thickness = 1.5;
    summary.push("Increased thickness to 1.5mm for casting strength");
  }

  // Ensure width is proportional — too narrow for the thickness looks off
  const aspectRatio = params.width / params.thickness;
  if (aspectRatio < 2.0 && params.width < 4) {
    patchParams.width = Math.round(params.thickness * 2.5 * 10) / 10;
    summary.push(`Widened band to ${patchParams.width}mm for balanced proportions`);
  }

  // ── 2. Comfort fit optimization ────────────────────────────────
  if (!params.comfortFit && params.width >= 6) {
    patchParams.comfortFit = true;
    summary.push("Enabled comfort fit for wide band wearability");
  }

  // ── 3. Bevel refinement ────────────────────────────────────────
  // If bevel is 0 on a non-flat profile, add subtle bevel for edge safety
  if (params.bevelSize === 0 && params.profile !== "flat") {
    patchParams.bevelSize = 0.2;
    summary.push("Added subtle edge bevel for comfort and casting safety");
  }
  // If bevel is too aggressive relative to thickness, tame it
  if (params.bevelSize > params.thickness * 0.4) {
    patchParams.bevelSize = Math.round(params.thickness * 0.3 * 10) / 10;
    summary.push("Reduced bevel to preserve band structure");
  }

  // ── 4. Groove depth balancing ──────────────────────────────────
  if (params.grooveCount > 0 && params.grooveDepth > params.thickness * 0.25) {
    patchParams.grooveDepth = Math.round(params.thickness * 0.2 * 10) / 10;
    summary.push("Optimized groove depth relative to wall thickness");
  }

  // ── 5. Lunar texture enhancement ───────────────────────────────
  if (lunar.enabled) {
    // Balance intensity — too low looks flat, too high looks noisy
    if (lunar.intensity < 30) {
      patchLunar.intensity = 40;
      hasLunarChanges = true;
      summary.push("Boosted crater intensity for visible surface detail");
    } else if (lunar.intensity > 85) {
      patchLunar.intensity = 75;
      hasLunarChanges = true;
      summary.push("Softened crater intensity to avoid surface noise");
    }

    // Ensure rim-to-bowl balance (rims should be ≈60-70% of bowl depth for realism)
    const idealRimRatio = 0.65;
    const currentRatio = lunar.bowlDepth > 0 ? lunar.rimHeight / lunar.bowlDepth : 1;
    if (Math.abs(currentRatio - idealRimRatio) > 0.25) {
      patchLunar.rimHeight = Math.round(lunar.bowlDepth * idealRimRatio);
      hasLunarChanges = true;
      summary.push("Balanced crater rim height to bowl depth ratio");
    }

    // Micro detail should complement density
    const idealMicro = lunar.craterDensity === "high" ? 55 : lunar.craterDensity === "med" ? 40 : 25;
    if (Math.abs(lunar.microDetail - idealMicro) > 20) {
      patchLunar.microDetail = idealMicro;
      hasLunarChanges = true;
      summary.push("Tuned micro-detail to match crater density");
    }

    // Terrain roughness — ensure enough base texture
    if (lunar.terrainRoughness < 20) {
      patchLunar.terrainRoughness = 30;
      hasLunarChanges = true;
      summary.push("Added base terrain roughness for surface realism");
    }

    // Erosion should be moderate for natural look
    if (lunar.erosion < 10) {
      patchLunar.erosion = 20;
      hasLunarChanges = true;
      summary.push("Added subtle erosion for weathered, natural appearance");
    } else if (lunar.erosion > 70) {
      patchLunar.erosion = 55;
      hasLunarChanges = true;
      summary.push("Reduced erosion to preserve crater definition");
    }

    // Rim sharpness — ensure crisp but not harsh
    if (lunar.rimSharpness < 30) {
      patchLunar.rimSharpness = 45;
      hasLunarChanges = true;
      summary.push("Sharpened crater rims for better light catching");
    } else if (lunar.rimSharpness > 85) {
      patchLunar.rimSharpness = 70;
      hasLunarChanges = true;
      summary.push("Softened rim edges for natural crater look");
    }

    // Crater variation — ensure enough per-crater randomness
    if (lunar.craterVariation < 30) {
      patchLunar.craterVariation = 45;
      hasLunarChanges = true;
      summary.push("Increased crater variation for organic feel");
    }
  }

  // ── 6. Engraving readability ───────────────────────────────────
  if (engraving.enabled && engraving.text.length > 0) {
    const innerCircumference = Math.PI * params.innerDiameter;
    const textWidthEst = engraving.text.length * (engraving.sizeMm * 0.6 + engraving.spacingMm);

    // If text wraps more than 80% of circumference, reduce size
    if (textWidthEst > innerCircumference * 0.8) {
      const targetWidth = innerCircumference * 0.7;
      const newSize = Math.max(0.6, (targetWidth / engraving.text.length - engraving.spacingMm) / 0.6);
      patchEngraving.sizeMm = Math.round(newSize * 10) / 10;
      hasEngravingChanges = true;
      summary.push("Reduced engraving size to fit inner circumference");
    }

    // If text is very short, can afford larger size
    if (engraving.text.length <= 8 && engraving.sizeMm < 1.5) {
      patchEngraving.sizeMm = 1.8;
      hasEngravingChanges = true;
      summary.push("Enlarged short engraving for better readability");
    }

    // Depth optimization — balance readability vs structural safety
    const maxSafeDepth = Math.min(0.4, params.thickness * 0.15);
    if (engraving.depthMm > maxSafeDepth) {
      patchEngraving.depthMm = Math.round(maxSafeDepth * 100) / 100;
      hasEngravingChanges = true;
      summary.push("Adjusted engraving depth for structural safety");
    } else if (engraving.depthMm < 0.15) {
      patchEngraving.depthMm = 0.18;
      hasEngravingChanges = true;
      summary.push("Deepened engraving for visible casting result");
    }

    // Spacing optimization for readability
    if (engraving.spacingMm < 0.06) {
      patchEngraving.spacingMm = 0.1;
      hasEngravingChanges = true;
      summary.push("Increased letter spacing for clarity");
    }
  }

  // ── 7. Fallback — if nothing needed, still provide value ───────
  if (summary.length === 0) {
    summary.push("Design is already well-optimized — no changes needed");
  }

  return {
    params: patchParams,
    lunar: hasLunarChanges ? patchLunar : null,
    engraving: hasEngravingChanges ? patchEngraving : null,
    summary,
  };
}
