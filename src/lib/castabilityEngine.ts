import { RingParameters } from "@/types/ring";
import { CastabilityReport, CastabilityCheck, CastabilityLevel } from "@/types/castability";

export function evaluateCastability(params: RingParameters): CastabilityReport {
  const targetMinThicknessMm = 1.5;
  const checks: CastabilityCheck[] = [];
  let score = 100;

  // Thickness checks
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

  // Groove depth vs thickness
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

  // Knife-edge + small bevel
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

  // Bevel vs thickness
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

  // Delicate band
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
