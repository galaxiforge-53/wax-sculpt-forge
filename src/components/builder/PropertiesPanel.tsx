import { RingParameters, RingProfile, InteriorProfile, RING_SIZE_MAP, ViewMode, MetalPreset, EdgeStyle, RingSizeStandard, DimensionUnit, formatRingSize, formatDimension, US_TO_UK, US_TO_EU } from "@/types/ring";
import { WaxMarkType } from "@/types/waxmarks";
import { StampSettings } from "@/hooks/useRingDesign";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useMemo, useState } from "react";
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

const PROFILES: { value: RingProfile; label: string; desc: string; tip: string }[] = [
  { value: "flat", label: "Flat", desc: "Sharp parallel walls", tip: "Best for wide bands, grooves, and surface texturing" },
  { value: "dome", label: "Dome", desc: "Classic rounded exterior", tip: "Timeless — comfortable and reflects light beautifully" },
  { value: "comfort", label: "Comfort Fit", desc: "Rounded inner & outer", tip: "Slides easily over knuckles, ideal for everyday wear" },
  { value: "square", label: "Square", desc: "Angular box profile", tip: "Modern and bold — pairs well with matte finishes" },
  { value: "knife-edge", label: "Knife Edge", desc: "Pointed peak", tip: "Dramatic silhouette — best at 4mm+ width" },
];

/** SVG cross-section path for each profile */
function ProfileCrossSectionSVG({ profile, isActive, thickness, width }: { profile: RingProfile; isActive: boolean; thickness: number; width: number }) {
  // Normalized cross-section: viewBox is 60x40, ring section drawn inside
  const t = Math.min(thickness / 4, 1); // normalized 0–1
  const w = Math.min(width / 14, 1);    // normalized 0–1

  const wallW = 6 + t * 10;  // wall thickness in SVG units
  const bandH = 10 + w * 20; // band height in SVG units
  const cx = 30;             // center x
  const cy = 20;             // center y
  const halfH = bandH / 2;

  // Outer profile path (left side = outer surface)
  let outerPath = "";
  // Inner profile path (right side = inner bore)
  const innerX = cx + wallW / 2;
  const outerX = cx - wallW / 2;

  switch (profile) {
    case "flat":
      outerPath = `M ${outerX} ${cy - halfH} L ${outerX} ${cy + halfH}`;
      break;
    case "dome":
      outerPath = `M ${outerX} ${cy - halfH} Q ${outerX - wallW * 0.4} ${cy} ${outerX} ${cy + halfH}`;
      break;
    case "comfort":
      outerPath = `M ${outerX} ${cy - halfH} Q ${outerX - wallW * 0.3} ${cy} ${outerX} ${cy + halfH}`;
      break;
    case "square":
      outerPath = `M ${outerX - 1} ${cy - halfH} L ${outerX - 1} ${cy + halfH}`;
      break;
    case "knife-edge":
      outerPath = `M ${outerX + 2} ${cy - halfH} L ${outerX - wallW * 0.35} ${cy} L ${outerX + 2} ${cy + halfH}`;
      break;
  }

  const innerPath = `M ${innerX} ${cy - halfH} L ${innerX} ${cy + halfH}`;

  // Top and bottom caps
  const topCap = `M ${outerX + (profile === "knife-edge" ? 2 : profile === "square" ? -1 : 0)} ${cy - halfH} L ${innerX} ${cy - halfH}`;
  const botCap = `M ${outerX + (profile === "knife-edge" ? 2 : profile === "square" ? -1 : 0)} ${cy + halfH} L ${innerX} ${cy + halfH}`;

  const strokeColor = isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
  const fillColor = isActive ? "hsl(var(--primary) / 0.12)" : "hsl(var(--muted) / 0.3)";

  return (
    <svg viewBox="0 0 60 40" className="w-full h-full" aria-label={`${profile} profile cross-section`}>
      {/* Fill area */}
      <path
        d={`${outerPath} L ${innerX} ${cy + halfH} L ${innerX} ${cy - halfH} Z`}
        fill={fillColor}
        stroke="none"
      />
      {/* Outer surface */}
      <path d={outerPath} fill="none" stroke={strokeColor} strokeWidth={isActive ? 1.5 : 1} strokeLinecap="round" />
      {/* Inner bore */}
      <path d={innerPath} fill="none" stroke={strokeColor} strokeWidth={isActive ? 1.5 : 1} strokeLinecap="round" strokeDasharray={profile === "comfort" ? "" : ""} />
      {/* Caps */}
      <path d={topCap} fill="none" stroke={strokeColor} strokeWidth={0.8} />
      <path d={botCap} fill="none" stroke={strokeColor} strokeWidth={0.8} />
      {/* Dimension line (outer arrow) */}
      {isActive && (
        <>
          <line x1={outerX - 6} y1={cy - halfH} x2={outerX - 6} y2={cy + halfH} stroke={strokeColor} strokeWidth={0.4} strokeDasharray="1.5 1" />
          <line x1={outerX - 8} y1={cy - halfH} x2={outerX - 4} y2={cy - halfH} stroke={strokeColor} strokeWidth={0.4} />
          <line x1={outerX - 8} y1={cy + halfH} x2={outerX - 4} y2={cy + halfH} stroke={strokeColor} strokeWidth={0.4} />
        </>
      )}
    </svg>
  );
}

const STAMP_TYPES: { value: WaxMarkType; label: string }[] = [
  { value: "dent", label: "Dent" },
  { value: "scratch", label: "Scratch" },
  { value: "chisel", label: "Chisel" },
  { value: "heat-soften", label: "Heat Soften" },
  { value: "push", label: "Push" },
  { value: "carve-sculpt", label: "Carve" },
  { value: "smooth-sculpt", label: "Smooth" },
];

/** Small SVG icon showing edge cross-section shape */
function EdgeStyleIcon({ style, active }: { style: EdgeStyle; active: boolean }) {
  const stroke = active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
  const w = 24, h = 16;
  let d = "";
  switch (style) {
    case "sharp":
      d = "M4 14 L4 2 L20 2 L20 14";
      break;
    case "soft-bevel":
      d = "M4 14 L4 5 Q4 2 7 2 L17 2 Q20 2 20 5 L20 14";
      break;
    case "rounded":
      d = "M4 14 L4 8 C4 2 8 2 12 2 C16 2 20 2 20 8 L20 14";
      break;
    case "chamfer":
      d = "M4 14 L4 6 L8 2 L16 2 L20 6 L20 14";
      break;
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={d} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PropertiesPanel({ params, onUpdate, showMeasure, viewMode, waxMarkCount, onClearWaxMarks, stampSettings, onStampSettingsChange, metalPreset = "silver" }: PropertiesPanelProps) {
  const sizes = Object.keys(RING_SIZE_MAP).map(Number);
  const [sizeStandard, setSizeStandard] = useState<RingSizeStandard>("US");
  const [dimUnit, setDimUnit] = useState<DimensionUnit>("mm");

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

      {/* ── Unit System Selector ── */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 p-0.5 rounded-md bg-secondary/60 border border-border/50">
          {(["US", "UK", "EU"] as RingSizeStandard[]).map((std) => (
            <button
              key={std}
              onClick={() => setSizeStandard(std)}
              className={`flex-1 px-2 py-1 text-[9px] font-semibold rounded transition-all
                ${sizeStandard === std
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {std}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-secondary/60 border border-border/50">
          {(["mm", "inch"] as DimensionUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => setDimUnit(u)}
              className={`px-2 py-1 text-[9px] font-semibold rounded transition-all
                ${dimUnit === u
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {u === "mm" ? "mm" : "in"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ring Size ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-secondary-foreground">Ring Size ({sizeStandard})</Label>
          <span className="text-xs font-mono text-primary">{formatRingSize(params.size, sizeStandard)}</span>
        </div>
        <Slider
          value={[params.size]}
          onValueChange={([v]) => onUpdate({ size: v })}
          min={sizes[0]}
          max={sizes[sizes.length - 1]}
          step={1}
          className="w-full"
        />
        {/* Show all standards at once */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>US {params.size}</span>
          <span className="text-border">·</span>
          <span>UK {US_TO_UK[params.size] ?? "—"}</span>
          <span className="text-border">·</span>
          <span>EU {US_TO_EU[params.size] ?? "—"}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Inner Ø {formatDimension(params.innerDiameter, dimUnit)} · Circ. {formatDimension(params.innerDiameter * Math.PI, dimUnit)}
        </p>
      </div>

      {/* ── Quick Profile Presets ── */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Quick Presets</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { label: "Flat Band", desc: "Classic flat, sharp edges", params: { profile: "flat" as RingProfile, width: 6, thickness: 2, bevelSize: 0.2, edgeStyle: "sharp" as EdgeStyle, comfortFit: false } },
            { label: "Comfort Fit", desc: "Rounded, easy all-day wear", params: { profile: "comfort" as RingProfile, width: 6, thickness: 2, bevelSize: 0.3, edgeStyle: "rounded" as EdgeStyle, comfortFit: true, interiorProfile: "comfort-dome" as InteriorProfile, interiorCurvature: 50, comfortFitDepth: 60 } },
            { label: "Domed Band", desc: "Gently curved exterior", params: { profile: "dome" as RingProfile, width: 5, thickness: 1.8, bevelSize: 0.3, edgeStyle: "soft-bevel" as EdgeStyle, comfortFit: true } },
            { label: "Knife-Edge", desc: "Dramatic peaked ridge", params: { profile: "knife-edge" as RingProfile, width: 5, thickness: 2.2, bevelSize: 0.1, edgeStyle: "sharp" as EdgeStyle, comfortFit: true } },
            { label: "Wide Flat", desc: "Bold 10mm flat band", params: { profile: "flat" as RingProfile, width: 10, thickness: 2.5, bevelSize: 0.5, edgeStyle: "chamfer" as EdgeStyle, comfortFit: true } },
            { label: "Slim Round", desc: "Delicate 3mm rounded", params: { profile: "dome" as RingProfile, width: 3, thickness: 1.5, bevelSize: 0.2, edgeStyle: "rounded" as EdgeStyle, comfortFit: true } },
          ]).map((preset) => {
            // Check if current params roughly match this preset
            const isActive = params.profile === preset.params.profile
              && Math.abs(params.width - preset.params.width) < 0.5
              && Math.abs(params.thickness - preset.params.thickness) < 0.3;
            return (
              <button
                key={preset.label}
                onClick={() => onUpdate(preset.params)}
                className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg border transition-all text-left
                  ${isActive
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                    : "bg-card border-border hover:bg-secondary hover:border-primary/30"
                  }`}
                title={preset.desc}
              >
                <span className={`text-[10px] font-semibold leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>
                  {preset.label}
                </span>
                <span className="text-[8px] text-muted-foreground leading-tight">{preset.desc}</span>
              </button>
            );
          })}
        </div>
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
            <span className="text-[10px] text-muted-foreground">{dimUnit === "mm" ? "mm" : "in"}</span>
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

      {/* ── Profile Editor ── */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Cross-Section Profile</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {PROFILES.map((p) => {
            const isActive = params.profile === p.value;
            return (
              <button
                key={p.value}
                onClick={() => onUpdate({ profile: p.value })}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all
                  ${isActive
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                    : "bg-card border-border hover:bg-secondary hover:border-border"
                  }`}
                title={p.desc}
              >
                <div className="w-full aspect-[3/2]">
                  <ProfileCrossSectionSVG
                    profile={p.value}
                    isActive={isActive}
                    thickness={params.thickness}
                    width={params.width}
                  />
                </div>
                <span className={`text-[9px] font-medium leading-tight text-center
                  ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Active profile tip */}
        <div className="p-2 rounded-md bg-secondary/60 border border-border/50">
          <p className="text-[10px] text-muted-foreground">
            <span className="text-primary font-medium">{PROFILES.find(p => p.value === params.profile)?.label}:</span>{" "}
            {PROFILES.find(p => p.value === params.profile)?.tip}
          </p>
        </div>
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

      {/* ── Interior Shape ── */}
      <div className="mt-1 p-3 rounded-lg bg-secondary/60 border border-border space-y-3">
        <h4 className="text-[11px] font-display text-primary uppercase tracking-wider">Interior Shape</h4>

        {/* Interior profile selector */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Bore Profile</Label>
          <div className="grid grid-cols-2 gap-1">
            {([
              { value: "flat" as InteriorProfile, label: "Flat", icon: "▬" },
              { value: "comfort-dome" as InteriorProfile, label: "Comfort Dome", icon: "◠" },
              { value: "european" as InteriorProfile, label: "European", icon: "⌢" },
              { value: "anatomical" as InteriorProfile, label: "Anatomical", icon: "∿" },
            ]).map((p) => (
              <button
                key={p.value}
                onClick={() => onUpdate({ interiorProfile: p.value })}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-md border transition-all
                  ${(params.interiorProfile ?? "comfort-dome") === p.value
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-card/80"
                  }`}
              >
                <span className="text-sm">{p.icon}</span>
                <span className="font-medium">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Interior curvature */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Curvature</Label>
            <span className="text-[10px] font-mono text-primary">{(params.interiorCurvature ?? 40)}%</span>
          </div>
          <Slider
            value={[params.interiorCurvature ?? 40]}
            onValueChange={([v]) => onUpdate({ interiorCurvature: v })}
            min={0}
            max={100}
            step={5}
          />
          <p className="text-[10px] text-muted-foreground">
            {(params.interiorCurvature ?? 40) === 0 ? "Flat cylinder bore" 
              : (params.interiorCurvature ?? 40) < 30 ? "Subtle curve for slim bands"
              : (params.interiorCurvature ?? 40) < 70 ? "Standard comfort curvature"
              : "Deep curvature — maximizes comfort"}
          </p>
        </div>

        {/* Comfort fit depth */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Comfort Depth</Label>
            <span className="text-[10px] font-mono text-primary">{(params.comfortFitDepth ?? 50)}%</span>
          </div>
          <Slider
            value={[params.comfortFitDepth ?? 50]}
            onValueChange={([v]) => onUpdate({ comfortFitDepth: v })}
            min={0}
            max={100}
            step={5}
          />
          <p className="text-[10px] text-muted-foreground">
            How deep the inner dome extends into the wall thickness
          </p>
          {(params.comfortFitDepth ?? 50) > 75 && params.thickness < 1.5 && (
            <p className="text-[10px] text-amber-400">⚠ High depth on thin bands may weaken the ring</p>
          )}
        </div>

        {/* Interior info */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
            Use the Inside or X-Section camera view to inspect interior shape changes.
            Interior curvature affects comfort, weight, and engraving depth clearance.
          </p>
        </div>
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

      {/* ── Edge Style ── */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Edge Style</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { value: "sharp" as EdgeStyle, label: "Sharp", desc: "Hard 90° edge" },
            { value: "soft-bevel" as EdgeStyle, label: "Bevel", desc: "Gentle quarter-round" },
            { value: "rounded" as EdgeStyle, label: "Round", desc: "Full smooth radius" },
            { value: "chamfer" as EdgeStyle, label: "Chamfer", desc: "Straight 45° cut" },
          ]).map(es => {
            const active = (params.edgeStyle ?? "soft-bevel") === es.value;
            return (
              <button
                key={es.value}
                onClick={() => onUpdate({ edgeStyle: es.value })}
                className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-all text-center ${
                  active
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={es.desc}
              >
                <EdgeStyleIcon style={es.value} active={active} />
                <span className="text-[9px] font-medium leading-tight">{es.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bevel Size ── */}
      {(params.edgeStyle ?? "soft-bevel") !== "sharp" && (
        <div className="space-y-2">
          <Label className="text-xs text-secondary-foreground">Bevel Size: {params.bevelSize.toFixed(1)}mm</Label>
          <Slider
            value={[params.bevelSize]}
            onValueChange={([v]) => onUpdate({ bevelSize: v })}
            min={0}
            max={2}
            step={0.1}
          />
        </div>
      )}

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
