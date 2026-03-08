import { RingParameters, RING_SIZE_MAP } from "@/types/ring";
import { CastabilityReport, CastabilityCheck, CastabilityLevel } from "@/types/castability";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { InlayChannel } from "@/types/inlays";

export interface ManufacturingInput {
  params: RingParameters;
  lunar?: LunarTextureState | null;
  engraving?: EngravingState | null;
  inlays?: InlayChannel[] | null;
}

// ── Manufacturing tolerance constants ──────────────────────────────
const CAST_MIN_WALL_MM = 1.2;        // absolute minimum for investment casting
const CAST_SAFE_WALL_MM = 1.5;       // recommended minimum
const WAX_PRINT_MIN_FEATURE_MM = 0.1; // minimum feature detail for wax printers
const CAST_MIN_FEATURE_MM = 0.15;    // minimum detail surviving casting
const CAST_MIN_TEXT_HEIGHT_MM = 0.8;  // minimum legible engraving height
const CAST_MIN_TEXT_DEPTH_MM = 0.08;  // minimum depth the mould captures
const CAST_MAX_DEPTH_RATIO = 0.3;    // max engraving depth as fraction of wall
const WAX_MIN_CHANNEL_WIDTH_MM = 0.5; // minimum inlay channel width for wax printing
const CAST_MIN_CHANNEL_WIDTH_MM = 0.8; // minimum inlay channel width for casting

export function evaluateCastability(
  params: RingParameters,
  lunar?: LunarTextureState | null,
  engraving?: EngravingState | null,
  inlays?: InlayChannel[] | null,
): CastabilityReport {
  const targetMinThicknessMm = CAST_SAFE_WALL_MM;
  const checks: CastabilityCheck[] = [];
  let score = 100;

  // Helper: compute effective wall thickness at thinnest point
  const comfortDepth = params.comfortFit
    ? params.thickness * 0.35 * ((params.interiorCurvature ?? 40) / 100) * ((params.comfortFitDepth ?? 50) / 100)
    : 0;
  const effectiveMinThickness = params.thickness - comfortDepth;

  // Inner circumference for engraving calculations
  const innerCircumference = Math.PI * params.innerDiameter;

  // ═══════════════════════════════════════════════════════════════════
  // 1. WALL THICKNESS
  // ═══════════════════════════════════════════════════════════════════
  if (effectiveMinThickness < CAST_MIN_WALL_MM) {
    score -= 35;
    checks.push({
      id: "thickness_critical",
      label: "Critically thin wall",
      status: "risk",
      detail: `Effective thickness ${effectiveMinThickness.toFixed(2)}mm is below ${CAST_MIN_WALL_MM}mm casting minimum${comfortDepth > 0 ? ` (${params.thickness}mm wall − ${comfortDepth.toFixed(2)}mm comfort fit)` : ""}.`,
      suggestedFix: `Increase thickness to at least ${CAST_SAFE_WALL_MM}mm${comfortDepth > 0 ? " or reduce comfort fit depth" : ""}.`,
    });
  } else if (effectiveMinThickness < targetMinThicknessMm) {
    score -= 15;
    checks.push({
      id: "thickness_low",
      label: "Thin wall",
      status: "warn",
      detail: `Effective thickness ${effectiveMinThickness.toFixed(2)}mm is below recommended ${targetMinThicknessMm}mm${comfortDepth > 0 ? ` (comfort fit removes ${comfortDepth.toFixed(2)}mm)` : ""}.`,
      suggestedFix: "Consider increasing thickness for durability.",
    });
  } else {
    checks.push({
      id: "thickness_ok",
      label: "Wall thickness",
      status: "ok",
      detail: `${effectiveMinThickness.toFixed(2)}mm effective thickness meets requirements.`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. GROOVE DEPTH VS THICKNESS
  // ═══════════════════════════════════════════════════════════════════
  if (params.grooveCount > 0) {
    const grooveDepthMm = params.grooveDepth * params.thickness;
    const remainingWall = effectiveMinThickness - grooveDepthMm;
    const depthRatio = params.grooveDepth;

    if (remainingWall < CAST_MIN_WALL_MM) {
      score -= 30;
      checks.push({
        id: "groove_breakthrough",
        label: "Groove near breakthrough",
        status: "risk",
        detail: `Groove carves ${grooveDepthMm.toFixed(2)}mm deep, leaving only ${remainingWall.toFixed(2)}mm wall — below ${CAST_MIN_WALL_MM}mm minimum.`,
        suggestedFix: "Reduce groove depth or increase ring thickness.",
      });
    } else if (depthRatio > 0.35) {
      score -= 12;
      checks.push({
        id: "groove_moderate",
        label: "Deep grooves",
        status: "warn",
        detail: `Groove depth is ${Math.round(depthRatio * 100)}% of wall thickness.`,
        suggestedFix: "Consider shallower grooves for casting reliability.",
      });
    }

    // Multiple grooves on narrow ring — remaining material strips too thin
    if (params.grooveCount >= 3 && params.width < 5) {
      const stripWidth = params.width / (params.grooveCount + 1);
      if (stripWidth < 0.8) {
        score -= 12;
        checks.push({
          id: "groove_strip_narrow",
          label: "Thin strips between grooves",
          status: "warn",
          detail: `${params.grooveCount} grooves on ${params.width}mm band create ~${stripWidth.toFixed(1)}mm strips — fragile for casting.`,
          suggestedFix: "Reduce groove count or widen the ring.",
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. KNIFE-EDGE + BEVEL CHECKS
  // ═══════════════════════════════════════════════════════════════════
  if (params.profile === "knife-edge" && params.bevelSize < 0.2) {
    score -= 10;
    checks.push({
      id: "knife_edge_sharp",
      label: "Sharp knife edge",
      status: "warn",
      detail: "Knife-edge profile with minimal bevel may produce fragile edges.",
      suggestedFix: "Add at least 0.2mm bevel to soften the edge.",
    });
  }

  if (params.bevelSize > 0.6 * params.thickness) {
    score -= 15;
    checks.push({
      id: "bevel_thinning",
      label: "Edge thinning from bevel",
      status: "warn",
      detail: `Bevel (${params.bevelSize.toFixed(1)}mm) is large relative to thickness — edges may be paper-thin.`,
      suggestedFix: "Reduce bevel size or increase thickness.",
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. DELICATE BAND
  // ═══════════════════════════════════════════════════════════════════
  if (params.width < 3 && params.thickness < 1.5) {
    score -= 15;
    checks.push({
      id: "delicate_band",
      label: "Delicate band",
      status: "warn",
      detail: `Narrow (${params.width}mm) and thin (${params.thickness}mm) band is fragile.`,
      suggestedFix: "Increase width or thickness for structural integrity.",
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. ENGRAVING TOLERANCE CHECKS
  // ═══════════════════════════════════════════════════════════════════
  if (engraving?.enabled && engraving.text) {
    const engravingDepthRatio = engraving.depthMm / effectiveMinThickness;
    const remainingAfterEngraving = effectiveMinThickness - engraving.depthMm;

    // Depth vs wall
    if (remainingAfterEngraving < CAST_MIN_WALL_MM) {
      score -= 25;
      checks.push({
        id: "engraving_too_deep",
        label: "Engraving compromises wall",
        status: "risk",
        detail: `Engraving depth ${engraving.depthMm}mm leaves only ${remainingAfterEngraving.toFixed(2)}mm wall — below casting minimum.`,
        suggestedFix: "Reduce engraving depth or increase wall thickness.",
      });
    } else if (engravingDepthRatio > 0.2) {
      score -= 10;
      checks.push({
        id: "engraving_deep",
        label: "Deep engraving",
        status: "warn",
        detail: `Engraving depth uses ${Math.round(engravingDepthRatio * 100)}% of effective wall thickness.`,
        suggestedFix: "Consider reducing engraving depth for structural safety.",
      });
    }

    // Text too small to resolve
    if (engraving.sizeMm < CAST_MIN_TEXT_HEIGHT_MM) {
      score -= 10;
      checks.push({
        id: "engraving_small",
        label: "Text below casting resolution",
        status: "warn",
        detail: `Text height ${engraving.sizeMm}mm is below ${CAST_MIN_TEXT_HEIGHT_MM}mm casting resolution — characters may blur.`,
        suggestedFix: `Increase text size to at least ${CAST_MIN_TEXT_HEIGHT_MM}mm for legibility.`,
      });
    }

    // Depth too shallow to survive
    if (engraving.depthMm < CAST_MIN_TEXT_DEPTH_MM) {
      score -= 8;
      checks.push({
        id: "engraving_shallow",
        label: "Engraving too shallow",
        status: "warn",
        detail: `Depth ${engraving.depthMm}mm may not survive polishing — text could vanish.`,
        suggestedFix: `Set depth to at least ${CAST_MIN_TEXT_DEPTH_MM}mm so the mould captures it.`,
      });
    }

    // Letter spacing too tight — characters merge
    if (engraving.spacingMm < 0.05 && engraving.text.length > 3) {
      score -= 8;
      checks.push({
        id: "engraving_spacing_tight",
        label: "Letters may merge",
        status: "warn",
        detail: `Letter spacing ${engraving.spacingMm}mm is extremely tight — cast characters may fuse together.`,
        suggestedFix: "Increase letter spacing to 0.1mm or more.",
      });
    }

    // Text wraps more than once around bore
    const charWidth = engraving.sizeMm * 0.6 + engraving.spacingMm;
    const totalTextLength = engraving.text.length * charWidth;
    if (totalTextLength > innerCircumference) {
      score -= 8;
      checks.push({
        id: "engraving_overflow",
        label: "Text exceeds bore circumference",
        status: "warn",
        detail: `Text spans ~${totalTextLength.toFixed(1)}mm but inner bore is ${innerCircumference.toFixed(1)}mm around — text will overlap itself.`,
        suggestedFix: "Shorten text, reduce size, or reduce spacing.",
      });
    }

    // Engraving + grooves on thin ring
    if (params.grooveCount > 0 && effectiveMinThickness < 1.8) {
      score -= 10;
      checks.push({
        id: "engraving_groove_conflict",
        label: "Engraving + grooves on thin ring",
        status: "warn",
        detail: "Combined engraving and grooves on a thin ring reduce structural integrity.",
        suggestedFix: "Increase thickness to 2mm+ when combining features.",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. INLAY CHANNEL TOLERANCE CHECKS
  // ═══════════════════════════════════════════════════════════════════
  if (inlays && inlays.length > 0) {
    let totalChannelWidth = 0;

    for (const ch of inlays) {
      totalChannelWidth += ch.channelWidthMm;

      // Channel width too narrow for casting
      if (ch.channelWidthMm < CAST_MIN_CHANNEL_WIDTH_MM) {
        score -= 10;
        checks.push({
          id: `inlay_narrow_${ch.id}`,
          label: `Inlay channel too narrow`,
          status: "warn",
          detail: `"${ch.displayName}" channel is ${ch.channelWidthMm}mm wide — below ${CAST_MIN_CHANNEL_WIDTH_MM}mm casting minimum.`,
          suggestedFix: `Widen channel to at least ${CAST_MIN_CHANNEL_WIDTH_MM}mm.`,
        });
      }

      // Channel depth vs wall thickness
      if (ch.channelDepthMm > effectiveMinThickness * 0.5) {
        score -= 15;
        checks.push({
          id: `inlay_deep_${ch.id}`,
          label: `Inlay channel too deep`,
          status: "risk",
          detail: `"${ch.displayName}" depth ${ch.channelDepthMm}mm is >${Math.round(effectiveMinThickness * 50)}% of wall — structural risk.`,
          suggestedFix: "Reduce channel depth or increase wall thickness.",
        });
      }
    }

    // Total inlay width vs ring width
    if (totalChannelWidth > params.width * 0.8) {
      score -= 12;
      checks.push({
        id: "inlay_width_coverage",
        label: "Inlays cover too much width",
        status: "warn",
        detail: `Total inlay width ${totalChannelWidth.toFixed(1)}mm spans ${Math.round((totalChannelWidth / params.width) * 100)}% of ring width — thin lips remain.`,
        suggestedFix: "Reduce inlay count/width or widen the ring.",
      });
    }

    // Multiple edge-placed inlays stacking
    const edgeInlays = inlays.filter(i => i.placement !== "center");
    if (edgeInlays.length >= 2) {
      score -= 8;
      checks.push({
        id: "inlay_edge_stack",
        label: "Stacked edge inlays",
        status: "warn",
        detail: "Multiple inlays near edges weaken the ring's edge structure.",
        suggestedFix: "Move one inlay to center placement or reduce count.",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. LUNAR SURFACE TEXTURE CHECKS
  // ═══════════════════════════════════════════════════════════════════
  if (lunar?.enabled) {
    // Heavy texture on thin walls
    if (lunar.intensity > 75 && effectiveMinThickness < 1.8) {
      score -= 15;
      checks.push({
        id: "lunar_intensity_thin",
        label: "Heavy texture on thin wall",
        status: "warn",
        detail: `Lunar intensity ${lunar.intensity}% with ${effectiveMinThickness.toFixed(1)}mm effective wall may create weak spots.`,
        suggestedFix: "Reduce texture intensity below 60% or increase thickness to 2mm+.",
      });
    }

    // Small craters below casting resolution
    if (lunar.craterSize === "small" && lunar.intensity > 40) {
      score -= 10;
      checks.push({
        id: "lunar_craters_tiny",
        label: "Craters below casting resolution",
        status: "warn",
        detail: `Small craters at ${lunar.intensity}% intensity produce details below ~${CAST_MIN_FEATURE_MM}mm — lost in casting.`,
        suggestedFix: "Increase crater size to 'med' or 'large' for reliable casting.",
      });
    }

    // Extreme density + high intensity = fragile surface
    if (lunar.craterDensity === "high" && lunar.intensity > 70) {
      score -= 15;
      checks.push({
        id: "lunar_dense_intense",
        label: "Excessive surface disruption",
        status: "warn",
        detail: "High crater density with strong intensity may weaken the ring surface.",
        suggestedFix: "Lower crater density or intensity for reliable manufacturing.",
      });
    }

    // Micro detail too fine for wax printing
    if (lunar.microDetail > 80) {
      score -= 8;
      checks.push({
        id: "lunar_micro_fine",
        label: "Micro detail too fine",
        status: "warn",
        detail: `Micro detail ${lunar.microDetail}% produces features below ${WAX_PRINT_MIN_FEATURE_MM}mm — lost in casting.`,
        suggestedFix: "Reduce micro detail below 80% — fine grain is lost in investment casting.",
      });
    }

    // Deep bowl depth on thin ring
    if (lunar.bowlDepth > 70 && effectiveMinThickness < 2) {
      score -= 10;
      checks.push({
        id: "lunar_bowl_thin",
        label: "Deep craters on thin wall",
        status: "warn",
        detail: `Bowl depth ${lunar.bowlDepth}% with ${effectiveMinThickness.toFixed(1)}mm wall — deep impacts may breach the surface.`,
        suggestedFix: "Reduce bowl depth below 60% or increase thickness.",
      });
    }

    // High rim sharpness below wax print resolution
    if (lunar.rimSharpness > 85) {
      score -= 5;
      checks.push({
        id: "lunar_rim_sharp",
        label: "Rim detail too sharp for casting",
        status: "warn",
        detail: `Rim sharpness ${lunar.rimSharpness}% creates razor-thin edges that won't survive investment casting.`,
        suggestedFix: "Reduce rim sharpness below 80% for reliable reproduction.",
      });
    }

    // Texture + engraving combined on thin ring
    if (engraving?.enabled && engraving.text && lunar.intensity > 50 && effectiveMinThickness < 2) {
      score -= 10;
      checks.push({
        id: "lunar_engraving_combined",
        label: "Texture + engraving on thin wall",
        status: "warn",
        detail: "Surface texture and interior engraving both remove material — combined risk on thin wall.",
        suggestedFix: "Increase thickness to 2.5mm+ when combining texture and engraving.",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 8. WAX PRINTING GEOMETRY
  // ═══════════════════════════════════════════════════════════════════
  if (params.width > 10 && effectiveMinThickness < 1.5) {
    score -= 20;
    checks.push({
      id: "wax_warp_risk",
      label: "Wax print warping risk",
      status: "risk",
      detail: `Wide band (${params.width}mm) with thin wall (${effectiveMinThickness.toFixed(1)}mm) is prone to warping during wax printing.`,
      suggestedFix: "Either reduce width below 10mm or increase thickness above 1.5mm.",
    });
  }

  // Comfort fit + knife-edge = undercut concern
  if (params.comfortFit && params.profile === "knife-edge") {
    score -= 8;
    checks.push({
      id: "comfort_knife_undercut",
      label: "Comfort fit undercut",
      status: "warn",
      detail: "Comfort fit combined with knife-edge creates thin edges on the inner surface.",
      suggestedFix: "Switch to dome profile or disable comfort fit for knife-edge rings.",
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. SMALL RING + FEATURES
  // ═══════════════════════════════════════════════════════════════════
  if (params.size <= 4 && (params.grooveCount > 2 || (engraving?.enabled && engraving?.text))) {
    score -= 8;
    checks.push({
      id: "small_ring_features",
      label: "Features crowded on small ring",
      status: "warn",
      detail: `Size ${params.size} ring has limited surface area for detailed features.`,
      suggestedFix: "Reduce groove count or simplify engraving for small ring sizes.",
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. COMBINED FEATURE STACKING
  // ═══════════════════════════════════════════════════════════════════
  const featureCount = [
    params.grooveCount > 0,
    engraving?.enabled && engraving?.text,
    lunar?.enabled && lunar.intensity > 30,
    inlays && inlays.length > 0,
    params.comfortFit,
  ].filter(Boolean).length;

  if (featureCount >= 4 && effectiveMinThickness < 2.5) {
    score -= 12;
    checks.push({
      id: "feature_stacking",
      label: "Too many features on thin ring",
      status: "warn",
      detail: `${featureCount} active features (grooves, texture, engraving, inlays, comfort fit) — each removes material from a ${effectiveMinThickness.toFixed(1)}mm wall.`,
      suggestedFix: "Increase thickness to 2.5mm+ or disable some features.",
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCORE + SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  score = Math.max(0, Math.min(100, score));

  const worstStatus = checks.reduce<"ok" | "warn" | "risk">((worst, c) => {
    if (c.status === "risk") return "risk";
    if (c.status === "warn" && worst !== "risk") return "warn";
    return worst;
  }, "ok");

  const level: CastabilityLevel =
    worstStatus === "risk" ? "risk" : worstStatus === "warn" ? "warning" : "good";

  return {
    score,
    level,
    targetMinThicknessMm,
    metrics: {
      widthMm: params.width,
      thicknessMm: params.thickness,
      bevelMm: params.bevelSize,
      grooveCount: params.grooveCount,
      grooveDepthMm: params.grooveDepth,
      profile: params.profile,
      comfortFit: params.comfortFit,
    },
    checks,
  };
}
