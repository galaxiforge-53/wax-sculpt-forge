import { RingParameters } from "@/types/ring";
import { CastabilityReport, CastabilityCheck, CastabilityLevel } from "@/types/castability";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";

export interface ManufacturingInput {
  params: RingParameters;
  lunar?: LunarTextureState | null;
  engraving?: EngravingState | null;
}

export function evaluateCastability(params: RingParameters, lunar?: LunarTextureState | null, engraving?: EngravingState | null): CastabilityReport {
  const targetMinThicknessMm = 1.5;
  const checks: CastabilityCheck[] = [];
  let score = 100;

  // ── Wall thickness checks ──────────────────────────────────
  if (params.thickness < 1.2) {
    score -= 35;
    checks.push({
      id: "thickness_critical",
      label: "Critically thin wall",
      status: "risk",
      detail: `Thickness ${params.thickness}mm is below 1.2mm casting minimum.`,
      suggestedFix: "Increase thickness to at least 1.5mm for reliable casting.",
    });
  } else if (params.thickness < targetMinThicknessMm) {
    score -= 15;
    checks.push({
      id: "thickness_low",
      label: "Thin wall",
      status: "warn",
      detail: `Thickness ${params.thickness}mm is below recommended ${targetMinThicknessMm}mm.`,
      suggestedFix: "Consider increasing thickness for durability.",
    });
  } else {
    checks.push({
      id: "thickness_ok",
      label: "Wall thickness",
      status: "ok",
      detail: `${params.thickness}mm meets casting requirements.`,
    });
  }

  // ── Groove depth vs thickness ──────────────────────────────
  if (params.grooveCount > 0) {
    const depthRatio = params.grooveDepth / params.thickness;
    if (depthRatio > 0.5) {
      score -= 30;
      checks.push({
        id: "groove_deep",
        label: "Groove too deep",
        status: "risk",
        detail: `Groove depth (${params.grooveDepth}mm) exceeds 50% of wall thickness.`,
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
  }

  // ── Knife-edge + small bevel ───────────────────────────────
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

  // ── Bevel vs thickness ─────────────────────────────────────
  if (params.bevelSize > 0.6 * params.thickness) {
    score -= 15;
    checks.push({
      id: "bevel_thinning",
      label: "Edge thinning",
      status: "warn",
      detail: `Bevel (${params.bevelSize.toFixed(1)}mm) is large relative to thickness.`,
      suggestedFix: "Reduce bevel size or increase thickness.",
    });
  }

  // ── Delicate band ──────────────────────────────────────────
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

  // ── Engraving depth checks ─────────────────────────────────
  if (engraving?.enabled && engraving.text) {
    const engravingDepthRatio = engraving.depthMm / params.thickness;

    if (engravingDepthRatio > 0.3) {
      score -= 25;
      checks.push({
        id: "engraving_too_deep",
        label: "Engraving too deep",
        status: "risk",
        detail: `Engraving depth (${engraving.depthMm}mm) is ${Math.round(engravingDepthRatio * 100)}% of wall thickness.`,
        suggestedFix: "Reduce engraving depth below 0.3mm or increase wall thickness.",
      });
    } else if (engravingDepthRatio > 0.2) {
      score -= 10;
      checks.push({
        id: "engraving_deep",
        label: "Deep engraving",
        status: "warn",
        detail: `Engraving depth uses ${Math.round(engravingDepthRatio * 100)}% of wall thickness.`,
        suggestedFix: "Consider reducing engraving depth for structural safety.",
      });
    }

    if (engraving.sizeMm < 0.8) {
      score -= 10;
      checks.push({
        id: "engraving_small",
        label: "Tiny engraving text",
        status: "warn",
        detail: `Text height ${engraving.sizeMm}mm may not resolve clearly in casting.`,
        suggestedFix: "Increase text size to at least 0.8mm for legibility.",
      });
    }

    // Engraving + grooves on thin ring
    if (params.grooveCount > 0 && params.thickness < 1.8) {
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

  // ── Lunar surface detail checks ────────────────────────────
  if (lunar?.enabled) {
    // Very high intensity on thin walls
    if (lunar.intensity > 75 && params.thickness < 1.8) {
      score -= 15;
      checks.push({
        id: "lunar_intensity_thin",
        label: "Heavy texture on thin wall",
        status: "warn",
        detail: `Lunar intensity ${lunar.intensity}% with ${params.thickness}mm wall may create weak spots.`,
        suggestedFix: "Reduce texture intensity below 60% or increase thickness to 2mm+.",
      });
    }

    // Very small craters below casting resolution
    if (lunar.craterSize === "small") {
      score -= 10;
      checks.push({
        id: "lunar_craters_tiny",
        label: "Craters too small for casting",
        status: "warn",
        detail: `Small crater size may produce details below casting resolution (~0.1mm).`,
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

    // Micro detail below printable threshold
    if (lunar.microDetail > 80) {
      score -= 8;
      checks.push({
        id: "lunar_micro_fine",
        label: "Micro detail too fine",
        status: "warn",
        detail: `Micro detail ${lunar.microDetail}% may not survive the casting process.`,
        suggestedFix: "Reduce micro detail below 80% — fine grain is lost in investment casting.",
      });
    }
  }

  // ── Wax printing geometry checks ───────────────────────────
  // Very wide + thin = warping risk
  if (params.width > 10 && params.thickness < 1.5) {
    score -= 20;
    checks.push({
      id: "wax_warp_risk",
      label: "Wax print warping risk",
      status: "risk",
      detail: `Wide band (${params.width}mm) with thin wall (${params.thickness}mm) is prone to warping during wax printing.`,
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

  // Extremely small ring + features
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
