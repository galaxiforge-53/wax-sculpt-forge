import { LunarTextureState, CraterDensity, CraterSize } from "@/types/lunar";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Moon, Shuffle, Dices, RotateCcw, ChevronDown, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { generateLunarSurfaceMaps } from "@/lib/lunarSurfaceMaps";

// ── Presets ───────────────────────────────────────────────────────

interface LunarPreset {
  name: string;
  build: () => LunarTextureState;
}

const newSeed = () => Math.floor(Math.random() * 9999);
const randBetween = (lo: number, hi: number) => Math.round(lo + Math.random() * (hi - lo));

const LUNAR_PRESETS: LunarPreset[] = [
  {
    name: "Moon Craters Classic",
    build: () => ({
      enabled: true, intensity: 55, craterDensity: "med", craterSize: "med",
      microDetail: 40, rimSharpness: 50, overlapIntensity: 25, smoothEdges: true, seed: newSeed(),
      rimHeight: 55, bowlDepth: 60, erosion: 25, terrainRoughness: 35, craterVariation: 50,
    }),
  },
  {
    name: "Tycho Fresh Impact",
    build: () => ({
      enabled: true, intensity: 75, craterDensity: "med", craterSize: "large",
      microDetail: 35, rimSharpness: 90, overlapIntensity: 20, smoothEdges: false, seed: newSeed(),
      rimHeight: 85, bowlDepth: 80, erosion: 5, terrainRoughness: 20, craterVariation: 30,
    }),
  },
  {
    name: "South Pole Aitken",
    build: () => ({
      enabled: true, intensity: 65, craterDensity: "low", craterSize: "large",
      microDetail: 50, rimSharpness: 40, overlapIntensity: 35, smoothEdges: true, seed: newSeed(),
      rimHeight: 40, bowlDepth: 90, erosion: 45, terrainRoughness: 50, craterVariation: 60,
    }),
  },
  {
    name: "Weathered Highlands",
    build: () => ({
      enabled: true, intensity: 50, craterDensity: "high", craterSize: "med",
      microDetail: 60, rimSharpness: 25, overlapIntensity: 50, smoothEdges: true, seed: newSeed(),
      rimHeight: 30, bowlDepth: 45, erosion: 80, terrainRoughness: 65, craterVariation: 70,
    }),
  },
  {
    name: "Dense Bombardment",
    build: () => ({
      enabled: true, intensity: 90, craterDensity: "high", craterSize: "med",
      microDetail: 45, rimSharpness: 70, overlapIntensity: 85, smoothEdges: false, seed: newSeed(),
      rimHeight: 70, bowlDepth: 75, erosion: 15, terrainRoughness: 40, craterVariation: 80,
    }),
  },
  {
    name: "Heavy Impact",
    build: () => ({
      enabled: true, intensity: 80, craterDensity: "high", craterSize: "large",
      microDetail: 30, rimSharpness: 85, overlapIntensity: 75, smoothEdges: false, seed: newSeed(),
      rimHeight: 80, bowlDepth: 85, erosion: 10, terrainRoughness: 25, craterVariation: 40,
    }),
  },
  {
    name: "Ancient Mare",
    build: () => ({
      enabled: true, intensity: 40, craterDensity: "low", craterSize: "med",
      microDetail: 55, rimSharpness: 20, overlapIntensity: 10, smoothEdges: true, seed: newSeed(),
      rimHeight: 25, bowlDepth: 35, erosion: 70, terrainRoughness: 55, craterVariation: 45,
    }),
  },
  {
    name: "Micro Regolith",
    build: () => ({
      enabled: true, intensity: 60, craterDensity: "low", craterSize: "small",
      microDetail: 90, rimSharpness: 30, overlapIntensity: 15, smoothEdges: true, seed: newSeed(),
      rimHeight: 35, bowlDepth: 40, erosion: 30, terrainRoughness: 70, craterVariation: 55,
    }),
  },
  {
    name: "Rugged Terminator",
    build: () => ({
      enabled: true, intensity: 85, craterDensity: "med", craterSize: "large",
      microDetail: 50, rimSharpness: 95, overlapIntensity: 45, smoothEdges: false, seed: newSeed(),
      rimHeight: 90, bowlDepth: 70, erosion: 8, terrainRoughness: 45, craterVariation: 35,
    }),
  },
  {
    name: "Random Chaos",
    build: () => ({
      enabled: true,
      intensity: randBetween(30, 100),
      craterDensity: (["low", "med", "high"] as const)[Math.floor(Math.random() * 3)],
      craterSize: (["small", "med", "large"] as const)[Math.floor(Math.random() * 3)],
      microDetail: randBetween(10, 100),
      rimSharpness: randBetween(10, 100),
      overlapIntensity: randBetween(0, 100),
      smoothEdges: Math.random() > 0.5,
      seed: newSeed(),
      rimHeight: randBetween(10, 100),
      bowlDepth: randBetween(10, 100),
      erosion: randBetween(0, 90),
      terrainRoughness: randBetween(10, 100),
      craterVariation: randBetween(10, 100),
    }),
  },
];

// ── Sub-section ───────────────────────────────────────────────────

function SubSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1 group">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-display group-hover:text-muted-foreground transition-colors">
          {title}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-1 animate-in slide-in-from-top-1 duration-150">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Panel ─────────────────────────────────────────────────────────

interface LunarTexturePanelProps {
  state: LunarTextureState;
  onChange: (state: LunarTextureState) => void;
  onApplyPreset: (state: LunarTextureState, presetName: string) => void;
  onRandomize: (state: LunarTextureState) => void;
}

export default function LunarTexturePanel({ state, onChange, onApplyPreset, onRandomize }: LunarTexturePanelProps) {
  const patch = (p: Partial<LunarTextureState>) => onChange({ ...state, ...p });

  const handlePreset = (name: string) => {
    const preset = LUNAR_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    onApplyPreset(preset.build(), name);
  };

  const handleRandomize = () => {
    const chaos = LUNAR_PRESETS.find((p) => p.name === "Random Chaos")!;
    onRandomize(chaos.build());
  };

  const handleReseed = () => {
    onChange({ ...state, seed: newSeed() });
  };

  // Live crater count
  const craterCount = useMemo(() => {
    if (!state.enabled) return 0;
    try {
      const maps = generateLunarSurfaceMaps(state);
      return maps.craterCount;
    } catch {
      return 0;
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display flex items-center gap-1.5">
          <Moon className="w-3 h-3" />
          Lunar Texture
        </h3>
        <Switch
          checked={state.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>

      {state.enabled && (
        <div className="space-y-3 pt-1">
          {/* Crater count badge */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/50 rounded px-2 py-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>{craterCount.toLocaleString()} craters generated</span>
          </div>

          {/* Presets */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Preset</Label>
            <Select value="" onValueChange={handlePreset}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Apply preset…" />
              </SelectTrigger>
              <SelectContent>
                {LUNAR_PRESETS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick actions */}
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={handleRandomize}>
              <Dices className="w-3 h-3 mr-1" /> Randomize
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={handleReseed}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reseed
            </Button>
          </div>

          {/* ── Shape ── */}
          <SubSection title="Shape">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Intensity: {state.intensity}%</Label>
              <Slider value={[state.intensity]} onValueChange={([v]) => patch({ intensity: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Crater Density</Label>
              <Select value={state.craterDensity} onValueChange={(v) => patch({ craterDensity: v as CraterDensity })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="med">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Crater Size</Label>
              <Select value={state.craterSize} onValueChange={(v) => patch({ craterSize: v as CraterSize })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="med">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Rim Height: {state.rimHeight}%</Label>
              <Slider value={[state.rimHeight]} onValueChange={([v]) => patch({ rimHeight: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Bowl Depth: {state.bowlDepth}%</Label>
              <Slider value={[state.bowlDepth]} onValueChange={([v]) => patch({ bowlDepth: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Rim Sharpness: {state.rimSharpness}%</Label>
              <Slider value={[state.rimSharpness]} onValueChange={([v]) => patch({ rimSharpness: v })} min={0} max={100} step={1} />
            </div>
          </SubSection>

          {/* ── Surface ── */}
          <SubSection title="Surface">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Micro Detail: {state.microDetail}%</Label>
              <Slider value={[state.microDetail]} onValueChange={([v]) => patch({ microDetail: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Terrain Roughness: {state.terrainRoughness}%</Label>
              <Slider value={[state.terrainRoughness]} onValueChange={([v]) => patch({ terrainRoughness: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Overlap: {state.overlapIntensity}%</Label>
              <Slider value={[state.overlapIntensity]} onValueChange={([v]) => patch({ overlapIntensity: v })} min={0} max={100} step={1} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Smooth Edges</Label>
              <Switch checked={state.smoothEdges} onCheckedChange={(v) => patch({ smoothEdges: v })} />
            </div>
          </SubSection>

          {/* ── Advanced ── */}
          <SubSection title="Advanced" defaultOpen={false}>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Erosion: {state.erosion}%</Label>
              <Slider value={[state.erosion]} onValueChange={([v]) => patch({ erosion: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Crater Variation: {state.craterVariation}%</Label>
              <Slider value={[state.craterVariation]} onValueChange={([v]) => patch({ craterVariation: v })} min={0} max={100} step={1} />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Seed: {state.seed}</Label>
              <div className="flex gap-1.5">
                <Slider value={[state.seed]} onValueChange={([v]) => patch({ seed: v })} min={0} max={9999} step={1} className="flex-1" />
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={handleReseed}>
                  <Shuffle className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </SubSection>
        </div>
      )}
    </div>
  );
}
