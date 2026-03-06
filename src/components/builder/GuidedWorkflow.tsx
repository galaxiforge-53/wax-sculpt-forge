import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RingParameters, RingProfile, RING_SIZE_MAP, MetalPreset, FinishPreset, ViewMode } from "@/types/ring";
import { LunarTextureState, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { EngravingState, DEFAULT_ENGRAVING, ENGRAVING_FONTS } from "@/types/engraving";
import { CastabilityReport } from "@/types/castability";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Check, X, Sparkles,
  Ruler, Layers, Moon, Palette, PenTool, ShieldCheck, Eye,
} from "lucide-react";

// ── Step definitions ─────────────────────────────────────────────

interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
}

const STEPS: WizardStep[] = [
  { id: "size", label: "Ring Size", shortLabel: "Size", icon: Ruler, description: "Choose your ring size" },
  { id: "shape", label: "Width & Profile", shortLabel: "Shape", icon: Layers, description: "Set the width and cross-section shape" },
  { id: "surface", label: "Surface Style", shortLabel: "Surface", icon: Moon, description: "Choose a surface texture" },
  { id: "details", label: "Surface Details", shortLabel: "Details", icon: Sparkles, description: "Fine-tune the surface" },
  { id: "material", label: "Preview Material", shortLabel: "Material", icon: Palette, description: "See it in different metals and finishes" },
  { id: "engraving", label: "Engraving", shortLabel: "Engrave", icon: PenTool, description: "Add an optional interior engraving" },
  { id: "review", label: "Review & Save", shortLabel: "Review", icon: ShieldCheck, description: "Check your design and save" },
];

// ── Props ────────────────────────────────────────────────────────

interface GuidedWorkflowProps {
  params: RingParameters;
  onUpdate: (updates: Partial<RingParameters>) => void;
  lunarTexture: LunarTextureState;
  onLunarChange: (state: LunarTextureState) => void;
  engraving: EngravingState;
  onEngravingChange: (state: EngravingState) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  metalPreset: MetalPreset;
  onMetalChange: (metal: MetalPreset) => void;
  finishPreset: FinishPreset;
  onFinishChange: (finish: FinishPreset) => void;
  castabilityReport: CastabilityReport;
  onSave: () => void;
  onExitGuided: () => void;
}

// ── Surface presets for step 3 ───────────────────────────────────

const SURFACE_PRESETS = [
  {
    id: "none", label: "Smooth", icon: "✨", desc: "No texture",
    lunar: { enabled: false } as Partial<LunarTextureState>,
  },
  {
    id: "lunar-light", label: "Lunar Light", icon: "🌙", desc: "Subtle craters",
    lunar: {
      enabled: true, intensity: 35, craterDensity: "med" as const, craterSize: "med" as const,
      smoothEdges: true, microDetail: 25, rimSharpness: 40, overlapIntensity: 20,
      rimHeight: 40, bowlDepth: 45, erosion: 50, terrainRoughness: 25, craterVariation: 50,
    },
  },
  {
    id: "lunar-heavy", label: "Deep Craters", icon: "🌑", desc: "Bold impact texture",
    lunar: {
      enabled: true, intensity: 75, craterDensity: "high" as const, craterSize: "large" as const,
      smoothEdges: false, microDetail: 55, rimSharpness: 70, overlapIntensity: 50,
      rimHeight: 65, bowlDepth: 75, erosion: 15, terrainRoughness: 40, craterVariation: 60,
    },
  },
  {
    id: "hammered", label: "Hammered", icon: "🔨", desc: "Organic forged look",
    lunar: {
      enabled: true, intensity: 45, craterDensity: "med" as const, craterSize: "med" as const,
      smoothEdges: true, microDetail: 30, rimSharpness: 25, overlapIntensity: 40,
      rimHeight: 30, bowlDepth: 35, erosion: 70, terrainRoughness: 55, craterVariation: 80,
    },
  },
  {
    id: "rough-cosmic", label: "Rough Cosmic", icon: "💫", desc: "Asteroid terrain",
    lunar: {
      enabled: true, intensity: 85, craterDensity: "high" as const, craterSize: "small" as const,
      smoothEdges: false, microDetail: 90, rimSharpness: 55, overlapIntensity: 65,
      rimHeight: 45, bowlDepth: 50, erosion: 40, terrainRoughness: 95, craterVariation: 70,
    },
  },
];

const PROFILES: { value: RingProfile; label: string; desc: string }[] = [
  { value: "flat", label: "Flat", desc: "Sharp parallel walls" },
  { value: "dome", label: "Dome", desc: "Classic rounded exterior" },
  { value: "comfort", label: "Comfort Fit", desc: "Rounded inner surface" },
  { value: "square", label: "Square", desc: "Angular box profile" },
  { value: "knife-edge", label: "Knife Edge", desc: "Pointed peak" },
];

const METALS: { value: MetalPreset; label: string; swatch: string }[] = [
  { value: "silver", label: "Silver", swatch: "bg-[hsl(210,5%,75%)]" },
  { value: "gold", label: "Gold", swatch: "bg-[hsl(43,80%,55%)]" },
  { value: "rose-gold", label: "Rose Gold", swatch: "bg-[hsl(10,50%,65%)]" },
  { value: "titanium", label: "Titanium", swatch: "bg-[hsl(210,5%,60%)]" },
  { value: "tungsten", label: "Tungsten", swatch: "bg-[hsl(210,3%,45%)]" },
];

const FINISHES: { value: FinishPreset; label: string }[] = [
  { value: "polished", label: "Polished" },
  { value: "brushed", label: "Brushed" },
  { value: "hammered", label: "Hammered" },
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin" },
];

// ── Component ────────────────────────────────────────────────────

export default function GuidedWorkflow({
  params, onUpdate,
  lunarTexture, onLunarChange,
  engraving, onEngravingChange,
  viewMode, onViewModeChange,
  metalPreset, onMetalChange,
  finishPreset, onFinishChange,
  castabilityReport,
  onSave, onExitGuided,
}: GuidedWorkflowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const sizes = useMemo(() => Object.keys(RING_SIZE_MAP).map(Number), []);

  const next = useCallback(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const prev = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);
  const isLast = stepIndex === STEPS.length - 1;

  const activeSurfaceId = useMemo(() => {
    if (!lunarTexture.enabled) return "none";
    return SURFACE_PRESETS.find(
      (p) => p.lunar.enabled && p.lunar.intensity === lunarTexture.intensity && p.lunar.terrainRoughness === lunarTexture.terrainRoughness
    )?.id ?? "custom";
  }, [lunarTexture]);

  const applySurface = (preset: typeof SURFACE_PRESETS[0]) => {
    onLunarChange({
      ...DEFAULT_LUNAR_TEXTURE,
      seed: lunarTexture.seed,
      ...preset.lunar,
    });
  };

  const issues = castabilityReport.checks.filter((c) => c.status !== "ok");

  // ── Step content renderers ─────────────────────────────────

  const renderStepContent = () => {
    switch (step.id) {
      case "size":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-5xl font-display text-primary">{params.size}</span>
              <p className="text-sm text-muted-foreground mt-1">US Ring Size</p>
            </div>
            <Slider
              min={sizes[0]} max={sizes[sizes.length - 1]} step={0.5}
              value={[params.size]}
              onValueChange={([v]) => onUpdate({ size: v, innerDiameter: RING_SIZE_MAP[v] ?? params.innerDiameter })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Size {sizes[0]}</span>
              <span>Size {sizes[sizes.length - 1]}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Inner diameter: {params.innerDiameter}mm
            </p>
          </div>
        );

      case "shape":
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Width: {params.width}mm</Label>
              <Slider min={2} max={14} step={0.5} value={[params.width]} onValueChange={([v]) => onUpdate({ width: v })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Thickness: {params.thickness}mm</Label>
              <Slider min={1.0} max={4.0} step={0.1} value={[params.thickness]} onValueChange={([v]) => onUpdate({ thickness: v })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-3 block">Profile</Label>
              <div className="grid grid-cols-2 gap-2">
                {PROFILES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => onUpdate({ profile: p.value })}
                    className={cn(
                      "text-left px-3 py-2.5 rounded-lg border text-xs transition-all",
                      params.profile === p.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    <span className="font-medium block">{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Comfort Fit</Label>
              <Switch checked={params.comfortFit} onCheckedChange={(v) => onUpdate({ comfortFit: v })} />
            </div>
          </div>
        );

      case "surface":
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Choose a surface texture to start with. You can fine-tune it in the next step.</p>
            <div className="grid grid-cols-1 gap-2">
              {SURFACE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applySurface(preset)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all",
                    activeSurfaceId === preset.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/50 hover:border-primary/30"
                  )}
                >
                  <span className="text-xl">{preset.icon}</span>
                  <div>
                    <span className="text-xs font-medium text-foreground block">{preset.label}</span>
                    <span className="text-[10px] text-muted-foreground">{preset.desc}</span>
                  </div>
                  {activeSurfaceId === preset.id && (
                    <Check className="w-4 h-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case "details":
        return (
          <div className="space-y-4">
            {!lunarTexture.enabled ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No texture selected. Go back and choose a surface style, or skip this step.
              </p>
            ) : (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Intensity: {lunarTexture.intensity}%</Label>
                  <Slider min={10} max={100} step={1} value={[lunarTexture.intensity]} onValueChange={([v]) => onLunarChange({ ...lunarTexture, intensity: v })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Terrain Roughness: {lunarTexture.terrainRoughness}%</Label>
                  <Slider min={0} max={100} step={1} value={[lunarTexture.terrainRoughness]} onValueChange={([v]) => onLunarChange({ ...lunarTexture, terrainRoughness: v })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Erosion: {lunarTexture.erosion}%</Label>
                  <Slider min={0} max={100} step={1} value={[lunarTexture.erosion]} onValueChange={([v]) => onLunarChange({ ...lunarTexture, erosion: v })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Rim Height: {lunarTexture.rimHeight}%</Label>
                  <Slider min={0} max={100} step={1} value={[lunarTexture.rimHeight]} onValueChange={([v]) => onLunarChange({ ...lunarTexture, rimHeight: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Smooth Edges</Label>
                  <Switch checked={lunarTexture.smoothEdges} onCheckedChange={(v) => onLunarChange({ ...lunarTexture, smoothEdges: v })} />
                </div>
              </>
            )}
          </div>
        );

      case "material":
        return (
          <div className="space-y-5">
            {viewMode !== "cast" && (
              <button
                onClick={() => onViewModeChange("cast")}
                className="w-full text-center py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 inline mr-1.5" />
                Switch to Cast view to preview metals
              </button>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-3 block">Metal</Label>
              <div className="grid grid-cols-2 gap-2">
                {METALS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { onMetalChange(m.value); if (viewMode !== "cast") onViewModeChange("cast"); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all",
                      metalPreset === m.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/50 hover:border-primary/30"
                    )}
                  >
                    <span className={cn("w-4 h-4 rounded-full border border-border/50", m.swatch)} />
                    <span className="text-foreground">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-3 block">Finish</Label>
              <div className="flex flex-wrap gap-2">
                {FINISHES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => onFinishChange(f.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-xs transition-all",
                      finishPreset === f.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "engraving":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Add Interior Engraving</Label>
              <Switch
                checked={engraving.enabled}
                onCheckedChange={(v) => onEngravingChange({ ...engraving, enabled: v })}
              />
            </div>
            {engraving.enabled && (
              <>
                <Input
                  value={engraving.text}
                  onChange={(e) => onEngravingChange({ ...engraving, text: e.target.value.slice(0, 60) })}
                  placeholder="Enter text…"
                  className="text-sm"
                  maxLength={60}
                />
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Font</Label>
                  <Select value={engraving.font} onValueChange={(v) => onEngravingChange({ ...engraving, font: v as any })}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENGRAVING_FONTS.map((f) => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">{f.label} — {f.desc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Size: {engraving.sizeMm}mm</Label>
                  <Slider min={0.5} max={3.0} step={0.1} value={[engraving.sizeMm]} onValueChange={([v]) => onEngravingChange({ ...engraving, sizeMm: v })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Depth: {engraving.depthMm}mm</Label>
                  <Slider min={0.1} max={0.5} step={0.05} value={[engraving.depthMm]} onValueChange={([v]) => onEngravingChange({ ...engraving, depthMm: v })} />
                </div>
                {engraving.text && (
                  <p className="text-center text-sm text-muted-foreground italic tracking-wide border-t border-border pt-3">
                    "{engraving.text}"
                  </p>
                )}
              </>
            )}
            {!engraving.enabled && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Engraving is optional — you can always add it later.
              </p>
            )}
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            {/* Score */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Progress value={castabilityReport.score} className="h-2" />
              </div>
              <Badge
                variant={castabilityReport.level === "good" ? "default" : castabilityReport.level === "warning" ? "secondary" : "destructive"}
                className={cn(
                  "text-[10px]",
                  castabilityReport.level === "good" && "bg-emerald-600 border-emerald-600",
                  castabilityReport.level === "warning" && "bg-amber-600 border-amber-600 text-white"
                )}
              >
                Score: {castabilityReport.score}
              </Badge>
            </div>

            {/* Specs summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Size", `${params.size} US`],
                ["Width", `${params.width}mm`],
                ["Thickness", `${params.thickness}mm`],
                ["Profile", params.profile],
                ["Metal", metalPreset],
                ["Finish", finishPreset],
                ["Surface", lunarTexture.enabled ? "Textured" : "Smooth"],
                ["Engraving", engraving.enabled ? `"${engraving.text || "—"}"` : "None"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-2.5 py-1.5 rounded bg-secondary/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-mono capitalize">{value}</span>
                </div>
              ))}
            </div>

            {/* Issues */}
            {issues.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Warnings</p>
                {issues.slice(0, 3).map((c) => (
                  <div key={c.id} className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5">
                    {c.label}{c.suggestedFix ? ` — ${c.suggestedFix}` : ""}
                  </div>
                ))}
              </div>
            )}

            <Button onClick={onSave} className="w-full">
              <Check className="w-4 h-4 mr-2" /> Save Design
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm tracking-wider text-foreground">Guided Design</h2>
          <button onClick={onExitGuided} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Exit guide
          </button>
        </div>
        <Progress value={progress} className="h-1" />
        {/* Step dots */}
        <div className="flex items-center gap-1 justify-center">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStepIndex(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === stepIndex ? "bg-primary scale-125" : i < stepIndex ? "bg-primary/40" : "bg-muted"
              )}
              title={s.label}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <step.icon className="w-4 h-4 text-primary" />
              <span className="text-xs font-display tracking-wide text-foreground">{step.label}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{stepIndex + 1}/{STEPS.length}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">{step.description}</p>
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={prev}
          disabled={stepIndex === 0}
          className="flex-1"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          size="sm"
          onClick={isLast ? onSave : next}
          className="flex-1"
        >
          {isLast ? (
            <><Check className="w-4 h-4 mr-1" /> Save</>
          ) : (
            <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
