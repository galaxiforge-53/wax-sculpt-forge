/**
 * Surface Balance Engine
 * Analyzes the distribution of surface features around a ring and provides
 * intelligent corrections to prevent visual imbalance, weight asymmetry,
 * or excessive feature density in any area.
 */

import { RingParameters } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";

// ── Types ──────────────────────────────────────────────────────────

export interface BalanceAnalysis {
  /** Overall balance score 0-100 (100 = perfectly balanced) */
  score: number;
  /** Sector-by-sector density map (8 sectors around the ring) */
  sectorDensity: number[];
  /** Issues detected */
  issues: BalanceIssue[];
  /** Automatic fixes that can be applied */
  fixes: BalanceFix[];
  /** Summary messages */
  summary: string[];
}

export interface BalanceIssue {
  id: string;
  severity: "info" | "warn" | "risk";
  message: string;
  sector?: number; // Which sector (0-7) is affected
}

export interface BalanceFix {
  id: string;
  description: string;
  lunarPatch?: Partial<LunarTextureState>;
  paramsPatch?: Partial<RingParameters>;
  engravingPatch?: Partial<EngravingState>;
}

// ── Constants ──────────────────────────────────────────────────────

const NUM_SECTORS = 8;
const SECTOR_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Weight contribution of each feature type
const FEATURE_WEIGHTS = {
  waxMark: 1.0,
  groove: 0.6, // grooves go all the way around, so moderate per-sector
  inlay: 0.8,
  engraving: 0.3, // interior, less visual impact externally
  lunarCrater: 0.1, // distributed procedurally, per-sector estimate
};

// ── Helpers ────────────────────────────────────────────────────────

/** Map a 3D position on the ring surface to a sector index (0-7) */
function positionToSector(x: number, z: number): number {
  const angle = Math.atan2(z, x); // -π to π
  const normalized = ((angle + Math.PI) / (2 * Math.PI)) * NUM_SECTORS;
  return Math.floor(normalized) % NUM_SECTORS;
}

/** Calculate standard deviation of an array */
function stdDev(arr: number[]): number {
  const n = arr.length;
  if (n === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/** Calculate coefficient of variation (normalized spread) */
function coefficientOfVariation(arr: number[]): number {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  if (mean === 0) return 0;
  return stdDev(arr) / mean;
}

// ── Core Analysis ──────────────────────────────────────────────────

export function analyzeSurfaceBalance(
  params: RingParameters,
  lunar: LunarTextureState,
  engraving: EngravingState,
  waxMarks: WaxMark[],
  inlays: InlayChannel[]
): BalanceAnalysis {
  const sectorDensity = new Array(NUM_SECTORS).fill(0);
  const issues: BalanceIssue[] = [];
  const fixes: BalanceFix[] = [];
  const summary: string[] = [];

  // ── 1. Wax mark distribution ──────────────────────────────────
  if (waxMarks.length > 0) {
    const markSectors = new Array(NUM_SECTORS).fill(0);
    for (const mark of waxMarks) {
      const sector = positionToSector(mark.position.x, mark.position.z);
      markSectors[sector] += FEATURE_WEIGHTS.waxMark * mark.intensity;
      sectorDensity[sector] += FEATURE_WEIGHTS.waxMark * mark.intensity;
    }

    const markCV = coefficientOfVariation(markSectors);
    if (markCV > 0.8 && waxMarks.length >= 4) {
      const maxSector = markSectors.indexOf(Math.max(...markSectors));
      const minSector = markSectors.indexOf(Math.min(...markSectors));
      issues.push({
        id: "wax_marks_clustered",
        severity: "warn",
        message: `Wax marks are clustered in the ${SECTOR_LABELS[maxSector]} area — ${SECTOR_LABELS[minSector]} side is sparse`,
        sector: maxSector,
      });
      summary.push(`Sculpt marks concentrated in ${SECTOR_LABELS[maxSector]} sector`);
    }

    // Extreme concentration — more than 60% of marks in 2 adjacent sectors
    const maxPair = Math.max(...markSectors.map((v, i) => v + markSectors[(i + 1) % NUM_SECTORS]));
    const totalMarks = markSectors.reduce((s, v) => s + v, 0);
    if (totalMarks > 0 && maxPair / totalMarks > 0.6 && waxMarks.length >= 6) {
      issues.push({
        id: "wax_marks_extreme_cluster",
        severity: "risk",
        message: "Over 60% of sculpt marks are concentrated in one area — ring will feel lopsided",
      });
    }
  }

  // ── 2. Groove balance (grooves are circumferential, so inherently balanced)
  if (params.grooveCount > 0) {
    const grooveContrib = params.grooveCount * params.grooveDepth * FEATURE_WEIGHTS.groove;
    for (let i = 0; i < NUM_SECTORS; i++) {
      sectorDensity[i] += grooveContrib; // evenly distributed
    }
  }

  // ── 3. Inlay distribution ─────────────────────────────────────
  if (inlays.length > 0) {
    // Inlays are circumferential bands, so they add evenly
    const inlayContrib = inlays.length * FEATURE_WEIGHTS.inlay;
    for (let i = 0; i < NUM_SECTORS; i++) {
      sectorDensity[i] += inlayContrib;
    }

    // But check if too many features stack vertically (grooves + inlays + engraving)
    const verticalFeatureCount = params.grooveCount + inlays.length + (engraving.enabled ? 1 : 0);
    if (verticalFeatureCount > 4) {
      issues.push({
        id: "vertical_crowding",
        severity: "warn",
        message: `${verticalFeatureCount} stacked features may crowd the ring width (${params.width}mm band)`,
      });
      if (params.width < 8) {
        fixes.push({
          id: "widen_for_features",
          description: `Widen band to ${Math.max(8, params.width + 2)}mm to fit ${verticalFeatureCount} stacked features`,
          paramsPatch: { width: Math.max(8, params.width + 2) },
        });
      }
    }
  }

  // ── 4. Lunar texture balance analysis ─────────────────────────
  if (lunar.enabled) {
    // Procedural craters are seed-based and generally uniform,
    // but extreme parameters can create visual weight issues
    const lunarWeight = (lunar.intensity / 100) * FEATURE_WEIGHTS.lunarCrater;
    const densityMultiplier = lunar.craterDensity === "high" ? 3 : lunar.craterDensity === "med" ? 2 : 1;
    const sizeMultiplier = lunar.craterSize === "large" ? 2.5 : lunar.craterSize === "med" ? 1.5 : 1;

    for (let i = 0; i < NUM_SECTORS; i++) {
      sectorDensity[i] += lunarWeight * densityMultiplier * sizeMultiplier;
    }

    // Check for parameter combinations that create visual heaviness
    const surfaceLoad = lunar.intensity * densityMultiplier * sizeMultiplier;
    if (surfaceLoad > 400) {
      issues.push({
        id: "lunar_too_heavy",
        severity: "warn",
        message: "Surface texture is extremely heavy — large, dense craters at high intensity",
      });
      fixes.push({
        id: "balance_lunar_intensity",
        description: "Reduce crater intensity to balance surface weight",
        lunarPatch: { intensity: Math.min(60, lunar.intensity) },
      });
    }

    // Overlap + high variation = uneven visual weight
    if (lunar.overlapIntensity > 70 && lunar.craterVariation > 70) {
      issues.push({
        id: "lunar_uneven_variation",
        severity: "info",
        message: "High overlap with high variation may create uneven-looking zones",
      });
      fixes.push({
        id: "balance_lunar_overlap",
        description: "Moderate overlap intensity for more even distribution",
        lunarPatch: { overlapIntensity: 50, craterVariation: 55 },
      });
    }

    // Extreme rim height + low erosion = visually aggressive surface
    if (lunar.rimHeight > 80 && lunar.erosion < 15) {
      issues.push({
        id: "lunar_aggressive_rims",
        severity: "info",
        message: "Sharp, tall rims without erosion create an aggressive, unbalanced look",
      });
      fixes.push({
        id: "balance_lunar_rims",
        description: "Add subtle erosion to soften rim intensity and balance surface",
        lunarPatch: { erosion: Math.max(20, lunar.erosion), rimHeight: Math.min(70, lunar.rimHeight) },
      });
    }
  }

  // ── 5. Engraving weight contribution ──────────────────────────
  if (engraving.enabled && engraving.text) {
    // Engraving occupies an arc of the inner circumference
    const innerCirc = Math.PI * params.innerDiameter;
    const textWidth = engraving.text.length * (engraving.sizeMm * 0.6 + engraving.spacingMm);
    const arcFraction = Math.min(1, textWidth / innerCirc);
    const sectorsOccupied = Math.ceil(arcFraction * NUM_SECTORS);

    // Add engraving weight to occupied sectors
    const engWeight = FEATURE_WEIGHTS.engraving * (engraving.depthMm / 0.3);
    for (let i = 0; i < sectorsOccupied; i++) {
      sectorDensity[i] += engWeight;
    }

    if (arcFraction > 0.85) {
      issues.push({
        id: "engraving_wrapping",
        severity: "info",
        message: "Engraving wraps nearly the full circumference — may feel visually heavy inside",
      });
    }
  }

  // ── 6. Combined feature density analysis ──────────────────────
  const totalDensity = sectorDensity.reduce((s, v) => s + v, 0);
  const maxDensity = Math.max(...sectorDensity);
  const minDensity = Math.min(...sectorDensity);

  if (totalDensity > 0) {
    const overallCV = coefficientOfVariation(sectorDensity);

    if (overallCV > 0.5) {
      const heaviestSector = sectorDensity.indexOf(maxDensity);
      const lightestSector = sectorDensity.indexOf(minDensity);
      issues.push({
        id: "overall_imbalance",
        severity: overallCV > 0.8 ? "risk" : "warn",
        message: `Feature weight is ${Math.round((maxDensity / (minDensity || 0.01)) * 100) / 100}× heavier in ${SECTOR_LABELS[heaviestSector]} vs ${SECTOR_LABELS[lightestSector]}`,
        sector: heaviestSector,
      });
      summary.push(`Overall balance: ${SECTOR_LABELS[heaviestSector]} side is heaviest`);
    }
  }

  // ── 7. Feature stacking on thin rings ─────────────────────────
  const featureCount =
    (params.grooveCount > 0 ? 1 : 0) +
    (lunar.enabled ? 1 : 0) +
    (engraving.enabled ? 1 : 0) +
    (inlays.length > 0 ? 1 : 0) +
    (waxMarks.length > 0 ? 1 : 0);

  if (featureCount >= 4 && params.thickness < 2) {
    issues.push({
      id: "too_many_features_thin",
      severity: "risk",
      message: `${featureCount} feature types on a ${params.thickness}mm ring — surface is overloaded`,
    });
    fixes.push({
      id: "increase_thickness_features",
      description: "Increase thickness to support multiple surface features",
      paramsPatch: { thickness: Math.max(2.2, params.thickness) },
    });
    summary.push("Too many features for ring thickness");
  }

  // ── Compute balance score ─────────────────────────────────────
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "risk") score -= 20;
    else if (issue.severity === "warn") score -= 10;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  if (issues.length === 0) {
    summary.push("Surface features are well balanced");
  }

  return { score, sectorDensity, issues, fixes, summary };
}

/**
 * Auto-balance: apply all recommended fixes and return the patches
 */
export function computeAutoBalance(
  params: RingParameters,
  lunar: LunarTextureState,
  engraving: EngravingState,
  waxMarks: WaxMark[],
  inlays: InlayChannel[]
): {
  paramsPatch: Partial<RingParameters>;
  lunarPatch: Partial<LunarTextureState> | null;
  engravingPatch: Partial<EngravingState> | null;
  analysis: BalanceAnalysis;
} {
  const analysis = analyzeSurfaceBalance(params, lunar, engraving, waxMarks, inlays);
  const paramsPatch: Partial<RingParameters> = {};
  let lunarPatch: Partial<LunarTextureState> = {};
  let engravingPatch: Partial<EngravingState> = {};
  let hasLunar = false;
  let hasEngraving = false;

  for (const fix of analysis.fixes) {
    if (fix.paramsPatch) Object.assign(paramsPatch, fix.paramsPatch);
    if (fix.lunarPatch) { Object.assign(lunarPatch, fix.lunarPatch); hasLunar = true; }
    if (fix.engravingPatch) { Object.assign(engravingPatch, fix.engravingPatch); hasEngraving = true; }
  }

  return {
    paramsPatch,
    lunarPatch: hasLunar ? lunarPatch : null,
    engravingPatch: hasEngraving ? engravingPatch : null,
    analysis,
  };
}
