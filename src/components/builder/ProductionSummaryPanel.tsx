import { useMemo } from "react";
import { RingParameters, MetalPreset, FinishPreset, RING_SIZE_MAP } from "@/types/ring";
import { LunarTextureState, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { EngravingState, DEFAULT_ENGRAVING } from "@/types/engraving";
import { CastabilityReport } from "@/types/castability";
import { CraftState } from "@/types/craft";
import {
  Ruler,
  Box,
  Weight,
  Layers,
  Moon,
  PenTool,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Metal density constants (matches PropertiesPanel) ─────────── */

const METAL_DENSITY: Record<MetalPreset, { density: number; label: string }> = {
  silver:    { density: 10.36, label: "Sterling Silver" },
  gold:      { density: 13.07, label: "14K Gold" },
  "rose-gold": { density: 12.8, label: "14K Rose Gold" },
  titanium:  { density: 4.51,  label: "Titanium" },
  tungsten:  { density: 15.63, label: "Tungsten Carbide" },
};

function estimateWeight(params: RingParameters, metal: MetalPreset): number {
  const outerR = params.innerDiameter / 2 + params.thickness;
  const innerR = params.innerDiameter / 2;
  const volume = Math.PI * (outerR ** 2 - innerR ** 2) * params.width; // mm³
  const profileFactor =
    params.profile === "dome" ? 0.88
    : params.profile === "knife-edge" ? 0.82
    : params.profile === "comfort" ? 0.92
    : 1.0;
  const grooveVol = params.grooveCount * params.grooveDepth * 0.5 * params.width * 0.4;
  return ((volume * profileFactor - grooveVol) * METAL_DENSITY[metal].density) / 1000;
}

/* ── Surface complexity score ──────────────────────────────────── */

function computeSurfaceComplexity(
  params: RingParameters,
  lunar: LunarTextureState | null,
  engraving: EngravingState | null,
): { score: number; level: "simple" | "moderate" | "complex"; features: string[] } {
  let score = 0;
  const features: string[] = [];

  if (params.grooveCount > 0) {
    score += params.grooveCount * 8;
    features.push(`${params.grooveCount} groove${params.grooveCount > 1 ? "s" : ""}`);
  }
  if (params.bevelSize > 0.3) {
    score += 5;
    features.push("Beveled edges");
  }
  if (params.profile === "knife-edge") {
    score += 10;
    features.push("Knife-edge profile");
  }

  if (lunar?.enabled) {
    const lunarScore = Math.round(
      (lunar.craterDensity / 100) * 20 +
      (lunar.roughness / 100) * 10 +
      ((lunar.rimHeight ?? 50) / 100) * 5 +
      ((lunar.bowlDepth ?? 50) / 100) * 5
    );
    score += lunarScore;
    features.push("Lunar surface texture");
  }

  if (engraving?.enabled) {
    score += 15 + (engraving.text?.length ?? 0) * 0.5;
    features.push(`Engraving: "${(engraving.text ?? "").slice(0, 20)}${(engraving.text ?? "").length > 20 ? "…" : ""}"`);
  }

  const level = score <= 15 ? "simple" : score <= 40 ? "moderate" : "complex";
  return { score: Math.min(100, Math.round(score)), level, features };
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface ProductionSummaryPanelProps {
  params: RingParameters;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  craftState?: CraftState;
  castabilityReport?: CastabilityReport;
  className?: string;
}

/* ── Stat row ──────────────────────────────────────────────────── */

function StatRow({
  icon: Icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
        warn ? "bg-destructive/10" : "bg-primary/10"
      )}>
        <Icon className={cn("w-3.5 h-3.5", warn ? "text-destructive" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className={cn("text-xs font-mono font-medium", warn ? "text-destructive" : "text-foreground")}>{value}</p>
      </div>
      {sub && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{sub}</span>}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

export default function ProductionSummaryPanel({
  params,
  metalPreset,
  finishPreset,
  craftState,
  castabilityReport,
  className,
}: ProductionSummaryPanelProps) {
  const lunar = craftState?.lunarTexture ?? null;
  const engraving = craftState?.engraving ?? null;

  const weight = useMemo(() => estimateWeight(params, metalPreset), [params, metalPreset]);
  const complexity = useMemo(() => computeSurfaceComplexity(params, lunar, engraving), [params, lunar, engraving]);

  const outerDiameter = params.innerDiameter + params.thickness * 2;

  const complexityColor =
    complexity.level === "simple" ? "text-green-400"
    : complexity.level === "moderate" ? "text-amber-400"
    : "text-orange-400";

  const complexityBg =
    complexity.level === "simple" ? "bg-green-500/10 border-green-500/20"
    : complexity.level === "moderate" ? "bg-amber-500/10 border-amber-500/20"
    : "bg-orange-500/10 border-orange-500/20";

  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-display uppercase tracking-[0.12em] text-foreground">
          Production Summary
        </h3>
        {castabilityReport && (
          <span className={cn(
            "ml-auto text-[10px] font-mono font-medium px-2 py-0.5 rounded-full",
            castabilityReport.level === "good" ? "bg-green-500/15 text-green-400"
            : castabilityReport.level === "warning" ? "bg-amber-500/15 text-amber-400"
            : "bg-destructive/15 text-destructive"
          )}>
            {castabilityReport.score}/100 castability
          </span>
        )}
      </div>

      <div className="p-4 space-y-0.5">
        {/* ── Dimensions ── */}
        <StatRow icon={Box} label="Ring Size" value={`${params.size} US`} sub={`${params.innerDiameter}mm ID`} />
        <StatRow
          icon={Ruler}
          label="Dimensions"
          value={`${params.width}mm W × ${params.thickness}mm T`}
          sub={`${outerDiameter.toFixed(1)}mm OD`}
          warn={params.thickness < 1.2}
        />
        <StatRow
          icon={Layers}
          label="Profile"
          value={`${params.profile.charAt(0).toUpperCase() + params.profile.slice(1)}${params.comfortFit ? " · Comfort Fit" : ""}`}
        />
        <StatRow
          icon={Weight}
          label="Est. Weight"
          value={`${weight.toFixed(1)}g`}
          sub={METAL_DENSITY[metalPreset].label}
        />

        {/* ── Surface Complexity ── */}
        <div className="border-t border-border/40 mt-2 pt-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className={cn("w-3.5 h-3.5", complexityColor)} />
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Surface Complexity</span>
            <span className={cn("ml-auto text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border", complexityBg, complexityColor)}>
              {complexity.level} ({complexity.score}/100)
            </span>
          </div>

          {complexity.features.length > 0 ? (
            <ul className="space-y-1">
              {complexity.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-primary/60 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 italic">No surface features applied</p>
          )}
        </div>

        {/* ── Material & Finish ── */}
        <div className="border-t border-border/40 mt-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-secondary/30">
              <p className="text-[8px] uppercase tracking-widest text-muted-foreground/50">Metal</p>
              <p className="text-[11px] font-medium text-foreground capitalize">{METAL_DENSITY[metalPreset].label}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/30">
              <p className="text-[8px] uppercase tracking-widest text-muted-foreground/50">Finish</p>
              <p className="text-[11px] font-medium text-foreground capitalize">{finishPreset}</p>
            </div>
          </div>
        </div>

        {/* ── Warnings ── */}
        {castabilityReport && castabilityReport.checks.filter(c => c.status !== "ok").length > 0 && (
          <div className="border-t border-border/40 mt-2 pt-2 space-y-1">
            {castabilityReport.checks
              .filter(c => c.status !== "ok")
              .slice(0, 3)
              .map((check) => (
                <div
                  key={check.id}
                  className={cn(
                    "flex items-start gap-2 text-[10px] rounded-lg px-2.5 py-1.5 border",
                    check.status === "risk"
                      ? "bg-destructive/5 border-destructive/20 text-destructive"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-400"
                  )}
                >
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{check.detail}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
