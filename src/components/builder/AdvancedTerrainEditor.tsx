import { useState, useCallback } from "react";
import { LunarTextureState, TerrainType, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, Copy, ClipboardPaste, RotateCcw, Sliders, Layers, Mountain, Droplets, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SurfaceThumbnail from "./SurfaceThumbnail";

// ── Compact slider+input row ──────────────────────────────────────

interface ParamRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
}

function ParamRow({ label, value, onChange, min = 0, max = 100, step = 1, unit = "%", hint }: ParamRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-center group">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <Label className="text-[9px] text-muted-foreground group-hover:text-foreground transition-colors">{label}</Label>
        </div>
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
        />
        {hint && <p className="text-[7px] text-muted-foreground/40 leading-tight">{hint}</p>}
      </div>
      <div className="flex items-center gap-0.5 pt-0.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          min={min}
          max={max}
          step={step}
          className="w-14 h-6 text-[9px] font-mono text-center px-1 bg-secondary/50 border-border/30"
        />
        <span className="text-[8px] text-muted-foreground/50 w-3">{unit}</span>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────

function AdvSection({ title, icon: Icon, defaultOpen = true, children }: {
  title: string;
  icon: typeof Sliders;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 px-2 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors group">
        <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70 font-display flex items-center gap-1.5 group-hover:text-muted-foreground transition-colors">
          <Icon className="w-3 h-3" />
          {title}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2 px-0.5 animate-in slide-in-from-top-1 duration-150">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Terrain type descriptions ─────────────────────────────────────

const TERRAIN_TYPES: { value: TerrainType; label: string; desc: string }[] = [
  { value: "generic", label: "Generic", desc: "Pure parameter-driven terrain" },
  { value: "lunar", label: "Lunar", desc: "Earth's Moon — maria, ejecta" },
  { value: "mercurian", label: "Mercurian", desc: "Dense overlapping, lobate scarps" },
  { value: "martian", label: "Martian", desc: "Wind-eroded, dust-filled" },
  { value: "phobos", label: "Phobos", desc: "Irregular clusters, grooves" },
  { value: "deimos", label: "Deimos", desc: "Buried soft craters" },
  { value: "europa", label: "Europa", desc: "Icy fractures, few craters" },
  { value: "callisto", label: "Callisto", desc: "Saturated ancient bombardment" },
  { value: "titan", label: "Titan", desc: "Organic dunes, no craters" },
];

// ── Main component ────────────────────────────────────────────────

interface AdvancedTerrainEditorProps {
  state: LunarTextureState;
  onChange: (state: LunarTextureState) => void;
}

export default function AdvancedTerrainEditor({ state, onChange }: AdvancedTerrainEditorProps) {
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState("");
  const [showJson, setShowJson] = useState(false);

  const patch = useCallback(
    (p: Partial<LunarTextureState>) => onChange({ ...state, ...p }),
    [state, onChange],
  );

  const handleCopyJson = () => {
    const exportObj: Record<string, unknown> = {};
    const keys: (keyof LunarTextureState)[] = [
      "intensity", "craterDensity", "craterSize", "smoothEdges", "seed",
      "microDetail", "rimSharpness", "overlapIntensity",
      "rimHeight", "bowlDepth", "erosion", "terrainRoughness", "craterVariation",
      "craterShape", "ovalElongation", "ovalAngle",
      "mariaFill", "highlandRidges", "craterFloorTexture", "ejectaStrength",
      "terrainType", "terrainContrast",
      "layerLargeCraters", "layerMediumImpacts", "layerMicroPitting",
    ];
    for (const k of keys) {
      if (state[k] !== undefined) exportObj[k] = state[k];
    }
    navigator.clipboard.writeText(JSON.stringify(exportObj, null, 2));
    toast({ title: "Copied", description: "Terrain parameters copied to clipboard" });
  };

  const handlePasteJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (typeof parsed !== "object" || parsed === null) throw new Error("Not an object");
      const merged = { ...state, ...parsed, enabled: true };
      onChange(merged);
      setJsonInput("");
      setShowJson(false);
      toast({ title: "Applied", description: "Terrain parameters imported successfully" });
    } catch {
      toast({ title: "Invalid JSON", description: "Could not parse the terrain data", variant: "destructive" });
    }
  };

  const handleResetToDefault = () => {
    onChange({ ...DEFAULT_LUNAR_TEXTURE, enabled: true, seed: state.seed });
    toast({ title: "Reset", description: "All parameters restored to defaults" });
  };

  return (
    <div className="space-y-3">
      {/* Header with live preview */}
      <div className="flex items-center gap-3">
        <SurfaceThumbnail preset={state} size={56} className="border border-primary/20 shadow-sm shadow-primary/10" />
        <div className="flex-1 space-y-1">
          <p className="text-[9px] text-muted-foreground/60 leading-tight">
            Fine-tune every terrain parameter with precise numeric inputs. Changes update the ring in real time.
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-5 text-[8px] px-2" onClick={handleCopyJson}>
              <Copy className="w-2.5 h-2.5 mr-0.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="h-5 text-[8px] px-2" onClick={() => setShowJson(!showJson)}>
              <ClipboardPaste className="w-2.5 h-2.5 mr-0.5" /> Import
            </Button>
            <Button variant="outline" size="sm" className="h-5 text-[8px] px-2" onClick={handleResetToDefault}>
              <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Reset
            </Button>
          </div>
        </div>
      </div>

      {/* JSON import area */}
      {showJson && (
        <div className="space-y-1.5 p-2 rounded-lg bg-secondary/20 border border-border/30">
          <Label className="text-[9px] text-muted-foreground">Paste terrain JSON</Label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"intensity": 60, "craterDensity": "med", ...}'
            className="w-full h-20 text-[9px] font-mono bg-background/50 border border-border/30 rounded px-2 py-1.5 resize-none text-foreground placeholder:text-muted-foreground/30"
          />
          <Button variant="default" size="sm" className="h-5 text-[8px] w-full" onClick={handlePasteJson} disabled={!jsonInput.trim()}>
            Apply Imported Parameters
          </Button>
        </div>
      )}

      {/* ── Terrain Generation Mode ── */}
      <AdvSection title="Terrain Generation" icon={Globe}>
        <div className="space-y-1.5">
          <Label className="text-[9px] text-muted-foreground">Terrain Type</Label>
          <Select value={state.terrainType ?? "generic"} onValueChange={(v) => patch({ terrainType: v as TerrainType })}>
            <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TERRAIN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <div className="flex flex-col">
                    <span className="text-[10px]">{t.label}</span>
                    <span className="text-[8px] text-muted-foreground">{t.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[7px] text-muted-foreground/40">
            Selects planet-specific algorithms for unique geological features
          </p>
        </div>

        <ParamRow label="Overall Intensity" value={state.intensity} onChange={(v) => patch({ intensity: v })} hint="Global strength of the surface displacement" />
        <ParamRow label="Terrain Contrast" value={state.terrainContrast ?? 60} onChange={(v) => patch({ terrainContrast: v })} hint="Depth/height difference drama" />
        <ParamRow label="Terrain Roughness" value={state.terrainRoughness} onChange={(v) => patch({ terrainRoughness: v })} hint="Base landscape bumpiness between features" />
        <ParamRow label="Micro Detail" value={state.microDetail} onChange={(v) => patch({ microDetail: v })} hint="Fine-grained dust-like surface noise" />
      </AdvSection>

      {/* ── Crater Morphology ── */}
      <AdvSection title="Crater Morphology" icon={Mountain}>
        <ParamRow label="Rim Height" value={state.rimHeight} onChange={(v) => patch({ rimHeight: v })} hint="How much rims protrude above the surface" />
        <ParamRow label="Bowl Depth" value={state.bowlDepth} onChange={(v) => patch({ bowlDepth: v })} hint="How deep crater interiors are carved" />
        <ParamRow label="Rim Sharpness" value={state.rimSharpness} onChange={(v) => patch({ rimSharpness: v })} hint="Crisp edges vs soft rounded rims" />
        <ParamRow label="Crater Variation" value={state.craterVariation} onChange={(v) => patch({ craterVariation: v })} hint="Per-crater randomness in shape and depth" />
        <ParamRow label="Crater Floor Texture" value={state.craterFloorTexture} onChange={(v) => patch({ craterFloorTexture: v })} hint="Roughness inside crater bowls" />
        <ParamRow label="Crater Overlap" value={state.overlapIntensity} onChange={(v) => patch({ overlapIntensity: v })} hint="How much craters merge into each other" />

        {state.craterShape === "oval" && (
          <>
            <ParamRow label="Oval Elongation" value={state.ovalElongation} onChange={(v) => patch({ ovalElongation: v })} hint="How stretched the oval shape is" />
            <ParamRow label="Oval Angle" value={state.ovalAngle} onChange={(v) => patch({ ovalAngle: v })} min={0} max={360} step={5} unit="°" hint="Direction of elongation" />
          </>
        )}
      </AdvSection>

      {/* ── Layer Mix ── */}
      <AdvSection title="Layer Mix" icon={Layers}>
        <p className="text-[8px] text-muted-foreground/50 -mt-1 mb-1">
          Independent scaling of each crater size tier (0 = disabled, 100 = 2× strength)
        </p>
        <ParamRow label="Large Craters" value={state.layerLargeCraters ?? 50} onChange={(v) => patch({ layerLargeCraters: v })} hint="Mega and hero-scale impact basins" />
        <ParamRow label="Medium Impacts" value={state.layerMediumImpacts ?? 50} onChange={(v) => patch({ layerMediumImpacts: v })} hint="Mid-size and small crater population" />
        <ParamRow label="Micro Pitting" value={state.layerMicroPitting ?? 50} onChange={(v) => patch({ layerMicroPitting: v })} hint="Micro pits, regolith grain, and fine texture" />
      </AdvSection>

      {/* ── Surface Features ── */}
      <AdvSection title="Surface Features" icon={Droplets} defaultOpen={false}>
        <ParamRow label="Ejecta Rays" value={state.ejectaStrength} onChange={(v) => patch({ ejectaStrength: v })} hint="Radial debris streaks from large impacts" />
        <ParamRow label="Maria Fill" value={state.mariaFill} onChange={(v) => patch({ mariaFill: v })} hint="Smooth dark plains filling low areas" />
        <ParamRow label="Highland Ridges" value={state.highlandRidges} onChange={(v) => patch({ highlandRidges: v })} hint="Raised ridge networks between craters" />
      </AdvSection>

      {/* ── Weathering ── */}
      <AdvSection title="Weathering" icon={Sliders} defaultOpen={false}>
        <ParamRow label="Erosion" value={state.erosion} onChange={(v) => patch({ erosion: v })} hint="Billions of years of surface weathering" />
        <ParamRow label="Seed" value={state.seed} onChange={(v) => patch({ seed: v })} min={0} max={9999} step={1} unit="#" hint="Same seed = same pattern" />
      </AdvSection>
    </div>
  );
}
