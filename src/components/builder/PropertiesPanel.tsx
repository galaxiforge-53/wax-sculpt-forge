import { RingParameters, RingProfile, InteriorProfile, RING_SIZE_MAP, ViewMode, MetalPreset } from "@/types/ring";
import { WaxMarkType } from "@/types/waxmarks";
import { StampSettings } from "@/hooks/useRingDesign";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useMemo } from "react";
import { Scale } from "lucide-react";

// ── Metal density data (g/cm³) ───────────────────────────────────
const METAL_DENSITY: Record<MetalPreset, { density: number; label: string }> = {
  silver:     { density: 10.49, label: "Sterling Silver" },
  gold:       { density: 15.58, label: "14K Gold" },
  "rose-gold": { density: 14.85, label: "14K Rose Gold" },
  titanium:   { density: 4.51, label: "Titanium" },
  tungsten:   { density: 19.25, label: "Tungsten Carbide" },
};

/**
 * Estimate ring weight in grams using hollow cylinder volume.
 * Volume = π × width × (outerR² − innerR²) adjusted for profile.
 */
function estimateRingWeight(params: RingParameters, metal: MetalPreset): number {
  const innerR = params.innerDiameter / 2;          // mm
  const outerR = innerR + params.thickness;          // mm
  const width = params.width;                         // mm

  // Base hollow cylinder volume in mm³
  let volumeMm3 = Math.PI * width * (outerR * outerR - innerR * innerR);

  // Profile adjustments — dome/comfort removes material, square adds slightly
  const profileFactors: Record<RingProfile, number> = {
    flat: 1.0,
    dome: 0.88,
    comfort: 0.85,
    square: 1.0,
    "knife-edge": 0.78,
  };
  volumeMm3 *= profileFactors[params.profile] ?? 1.0;

  // Subtract groove material
  if (params.grooveCount > 0) {
    const grooveVolPerGroove = Math.PI * params.innerDiameter * params.grooveDepth * 0.8; // approx
    volumeMm3 -= grooveVolPerGroove * params.grooveCount;
  }

  // Convert mm³ → cm³ (÷ 1000)
  const volumeCm3 = Math.max(0, volumeMm3) / 1000;
  const density = METAL_DENSITY[metal]?.density ?? 10.49;
  return volumeCm3 * density;
}

interface PropertiesPanelProps {
  params: RingParameters;
  onUpdate: (updates: Partial<RingParameters>) => void;
  showMeasure: boolean;
  viewMode?: ViewMode;
  waxMarkCount?: number;
  onClearWaxMarks?: () => void;
  stampSettings?: StampSettings;
  onStampSettingsChange?: (s: StampSettings) => void;
  metalPreset?: MetalPreset;
}

const PROFILES: { value: RingProfile; label: string; desc: string }[] = [
  { value: "flat", label: "Flat", desc: "Sharp parallel walls" },
  { value: "dome", label: "Dome", desc: "Classic rounded exterior" },
  { value: "comfort", label: "Comfort Fit", desc: "Rounded inner surface" },
  { value: "square", label: "Square", desc: "Angular box profile" },
  { value: "knife-edge", label: "Knife Edge", desc: "Pointed peak" },
];

const STAMP_TYPES: { value: WaxMarkType; label: string }[] = [
  { value: "dent", label: "Dent" },
  { value: "scratch", label: "Scratch" },
  { value: "chisel", label: "Chisel" },
  { value: "heat-soften", label: "Heat Soften" },
  { value: "push", label: "Push" },
  { value: "carve-sculpt", label: "Carve" },
  { value: "smooth-sculpt", label: "Smooth" },
];

export default function PropertiesPanel({ params, onUpdate, showMeasure, viewMode, waxMarkCount, onClearWaxMarks, stampSettings, onStampSettingsChange, metalPreset = "silver" }: PropertiesPanelProps) {
  const sizes = Object.keys(RING_SIZE_MAP).map(Number);

  // Weight calculation for all metals
  const weightEstimates = useMemo(() => {
    return (Object.keys(METAL_DENSITY) as MetalPreset[]).map((metal) => ({
      metal,
      label: METAL_DENSITY[metal].label,
      weight: estimateRingWeight(params, metal),
      isActive: metal === metalPreset,
    }));
  }, [params, metalPreset]);

  const handleDirectInput = useCallback((field: keyof RingParameters, value: string, min: number, max: number, step: number) => {
    let num = parseFloat(value);
    if (isNaN(num)) return;
    num = Math.round(num / step) * step;
    num = Math.max(min, Math.min(max, num));
    onUpdate({ [field]: num });
  }, [onUpdate]);

  const outerDiameter = params.innerDiameter + 2 * params.thickness;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Ring Size ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-secondary-foreground">Ring Size (US)</Label>
          <span className="text-xs font-mono text-primary">{params.size}</span>
        </div>
        <Slider
          value={[params.size]}
          onValueChange={([v]) => onUpdate({ size: v })}
          min={sizes[0]}
          max={sizes[sizes.length - 1]}
          step={1}
          className="w-full"
        />
        <p className="text-[10px] text-muted-foreground">
          Inner Ø {params.innerDiameter.toFixed(1)}mm · Circumference {(params.innerDiameter * Math.PI).toFixed(1)}mm
        </p>
      </div>

      {/* ── Width ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-secondary-foreground">Width</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={params.width}
              onChange={(e) => handleDirectInput("width", e.target.value, 2, 14, 0.5)}
              className="w-16 h-6 text-xs text-right font-mono bg-secondary border-border px-1"
              step={0.5}
              min={2}
              max={14}
            />
            <span className="text-[10px] text-muted-foreground">mm</span>
          </div>
        </div>
        <Slider
          value={[params.width]}
          onValueChange={([v]) => onUpdate({ width: v })}
          min={2}
          max={14}
          step={0.5}
        />
      </div>

      {/* ── Thickness ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-secondary-foreground">Thickness</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={params.thickness}
              onChange={(e) => handleDirectInput("thickness", e.target.value, 1, 4, 0.1)}
              className="w-16 h-6 text-xs text-right font-mono bg-secondary border-border px-1"
              step={0.1}
              min={1}
              max={4}
            />
            <span className="text-[10px] text-muted-foreground">mm</span>
          </div>
        </div>
        <Slider
          value={[params.thickness]}
          onValueChange={([v]) => onUpdate({ thickness: v })}
          min={1}
          max={4}
          step={0.1}
        />
        {params.thickness < 1.2 && (
          <p className="text-[10px] text-amber-400">⚠ Below 1.2mm may be too thin for casting</p>
        )}
      </div>

      {/* ── Profile ── */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Profile</Label>
        <Select
          value={params.profile}
          onValueChange={(v) => onUpdate({ profile: v as RingProfile })}
        >
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <div className="flex flex-col">
                  <span>{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Comfort Fit ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-secondary-foreground">Comfort Fit</Label>
          <Switch
            checked={params.comfortFit}
            onCheckedChange={(v) => onUpdate({ comfortFit: v })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {params.comfortFit
            ? "Inner surface is gently curved for all-day wear"
            : "Flat inner surface — standard fit"}
        </p>
      </div>

      {/* ── Grooves ── */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Grooves: {params.grooveCount}</Label>
        <Slider
          value={[params.grooveCount]}
          onValueChange={([v]) => onUpdate({ grooveCount: v })}
          min={0}
          max={5}
          step={1}
        />
      </div>

      {/* ── Bevel ── */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Bevel: {params.bevelSize.toFixed(1)}mm</Label>
        <Slider
          value={[params.bevelSize]}
          onValueChange={([v]) => onUpdate({ bevelSize: v })}
          min={0}
          max={2}
          step={0.1}
        />
      </div>

      {/* ── Weight Estimate ── */}
      <div className="mt-1 p-3 rounded-lg bg-secondary/60 border border-border space-y-2">
        <div className="flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-primary" />
          <h4 className="text-[11px] font-display text-primary uppercase tracking-wider">Est. Weight</h4>
        </div>
        <div className="space-y-1">
          {weightEstimates.map(({ metal, label, weight, isActive }) => (
            <div
              key={metal}
              className={`flex items-center justify-between py-1 px-2 rounded-md transition-colors ${
                isActive ? "bg-primary/10 border border-primary/20" : ""
              }`}
            >
              <span className={`text-[10px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
                {isActive && <span className="ml-1 text-primary text-[8px]">●</span>}
              </span>
              <span className={`text-[11px] font-mono ${isActive ? "text-primary font-semibold" : "text-foreground"}`}>
                {weight.toFixed(1)}g
              </span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
          Approximate weight based on ring geometry. Actual weight varies with surface texture and finishing.
        </p>
      </div>

      {showMeasure && (
        <div className="mt-2 p-3 rounded-md bg-secondary border border-border space-y-2">
          <h4 className="text-xs font-display text-primary uppercase tracking-wider">Dimensions</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-[10px] text-muted-foreground">Inner Ø</span>
            <span className="text-[10px] font-mono text-foreground text-right">{params.innerDiameter.toFixed(1)} mm</span>
            <span className="text-[10px] text-muted-foreground">Outer Ø</span>
            <span className="text-[10px] font-mono text-foreground text-right">{outerDiameter.toFixed(1)} mm</span>
            <span className="text-[10px] text-muted-foreground">Width</span>
            <span className="text-[10px] font-mono text-foreground text-right">{params.width.toFixed(1)} mm</span>
            <span className="text-[10px] text-muted-foreground">Thickness</span>
            <span className="text-[10px] font-mono text-foreground text-right">{params.thickness.toFixed(1)} mm</span>
            <span className="text-[10px] text-muted-foreground">Profile</span>
            <span className="text-[10px] font-mono text-foreground text-right">{params.profile}</span>
            <span className="text-[10px] text-muted-foreground">Comfort Fit</span>
            <span className="text-[10px] font-mono text-foreground text-right">{params.comfortFit ? "Yes" : "No"}</span>
          </div>
          <div className="pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground italic">
              All dimensions are manufacturing-ready for wax printing & investment casting.
            </p>
          </div>
        </div>
      )}

      {/* Wax Marks section (wax mode only) */}
      {viewMode === "wax" && (
        <div className="mt-2 p-3 rounded-md bg-secondary border border-border space-y-3">
          <h4 className="text-xs font-display text-primary uppercase tracking-wider">Stamp Settings</h4>

          {/* Stamp type */}
          {stampSettings && onStampSettingsChange && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Mark Type</Label>
                <Select
                  value={stampSettings.type}
                  onValueChange={(v) => onStampSettingsChange({ ...stampSettings, type: v as WaxMarkType })}
                >
                  <SelectTrigger className="bg-card border-border h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAMP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Radius: {stampSettings.radiusMm.toFixed(1)}mm</Label>
                <Slider
                  value={[stampSettings.radiusMm]}
                  onValueChange={([v]) => onStampSettingsChange({ ...stampSettings, radiusMm: v })}
                  min={0.4}
                  max={3.0}
                  step={0.1}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Intensity: {(stampSettings.intensity * 100).toFixed(0)}%</Label>
                <Slider
                  value={[stampSettings.intensity]}
                  onValueChange={([v]) => onStampSettingsChange({ ...stampSettings, intensity: v })}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                />
              </div>
            </>
          )}

          {waxMarkCount !== undefined && waxMarkCount > 0 && (
            <div className="pt-2 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">{waxMarkCount} mark{waxMarkCount !== 1 ? "s" : ""} placed</p>
              {onClearWaxMarks && (
                <Button variant="outline" size="sm" onClick={onClearWaxMarks} className="w-full text-xs h-7">
                  Clear Marks
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
