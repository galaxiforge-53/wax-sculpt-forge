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
import { Moon, Shuffle, Dices, RotateCcw, ChevronDown, Sparkles, Globe, Lock, Unlock } from "lucide-react";
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

// ── Planetary Surface Library ─────────────────────────────────────

interface PlanetaryPreset {
  name: string;
  emoji: string;
  description: string;
  parent: string;
  color: string; // tailwind-safe accent for the card
  build: () => LunarTextureState;
}

const PLANETARY_PRESETS: PlanetaryPreset[] = [
  {
    name: "Earth's Moon",
    emoji: "🌕",
    parent: "Earth",
    color: "text-zinc-300",
    description: "Classic highlands — mixed crater sizes, moderate erosion, fine regolith dust",
    build: () => ({
      enabled: true, intensity: 60, craterDensity: "med", craterSize: "med",
      microDetail: 55, rimSharpness: 50, overlapIntensity: 40, smoothEdges: true, seed: newSeed(),
      rimHeight: 55, bowlDepth: 60, erosion: 35, terrainRoughness: 40, craterVariation: 55,
    }),
  },
  {
    name: "Mercury",
    emoji: "☿",
    parent: "Sun",
    color: "text-amber-400",
    description: "No atmosphere — sharp rims preserved, dense overlapping basins, Caloris-scale impacts",
    build: () => ({
      enabled: true, intensity: 85, craterDensity: "high", craterSize: "med",
      microDetail: 40, rimSharpness: 80, overlapIntensity: 70, smoothEdges: false, seed: newSeed(),
      rimHeight: 75, bowlDepth: 70, erosion: 10, terrainRoughness: 30, craterVariation: 65,
    }),
  },
  {
    name: "Mars",
    emoji: "♂",
    parent: "Sun",
    color: "text-red-400",
    description: "Wind-eroded craters, dust-filled basins, volcanic plains with scattered impacts",
    build: () => ({
      enabled: true, intensity: 50, craterDensity: "med", craterSize: "large",
      microDetail: 35, rimSharpness: 35, overlapIntensity: 30, smoothEdges: true, seed: newSeed(),
      rimHeight: 40, bowlDepth: 50, erosion: 55, terrainRoughness: 60, craterVariation: 70,
    }),
  },
  {
    name: "Phobos",
    emoji: "🪨",
    parent: "Mars",
    color: "text-stone-400",
    description: "Stickney crater dominates — grooved terrain, low gravity stretching, rubble-pile texture",
    build: () => ({
      enabled: true, intensity: 70, craterDensity: "low", craterSize: "large",
      microDetail: 30, rimSharpness: 35, overlapIntensity: 20, smoothEdges: true, seed: newSeed(),
      rimHeight: 30, bowlDepth: 85, erosion: 60, terrainRoughness: 75, craterVariation: 40,
    }),
  },
  {
    name: "Deimos",
    emoji: "🌑",
    parent: "Mars",
    color: "text-neutral-500",
    description: "Smooth, buried craters — thick regolith blanket softening all features into gentle undulations",
    build: () => ({
      enabled: true, intensity: 35, craterDensity: "low", craterSize: "med",
      microDetail: 70, rimSharpness: 15, overlapIntensity: 10, smoothEdges: true, seed: newSeed(),
      rimHeight: 15, bowlDepth: 30, erosion: 90, terrainRoughness: 50, craterVariation: 25,
    }),
  },
  {
    name: "Europa",
    emoji: "❄",
    parent: "Jupiter",
    color: "text-cyan-300",
    description: "Icy shell — very few craters, ultra-smooth plains with faint lineae ridges and cryovolcanic marks",
    build: () => ({
      enabled: true, intensity: 25, craterDensity: "low", craterSize: "small",
      microDetail: 85, rimSharpness: 60, overlapIntensity: 5, smoothEdges: true, seed: newSeed(),
      rimHeight: 45, bowlDepth: 25, erosion: 70, terrainRoughness: 80, craterVariation: 20,
    }),
  },
  {
    name: "Callisto",
    emoji: "🌐",
    parent: "Jupiter",
    color: "text-amber-300",
    description: "Ancient, saturated — maximum bombardment over 4 billion years, heavily weathered Valhalla basin",
    build: () => ({
      enabled: true, intensity: 95, craterDensity: "high", craterSize: "large",
      microDetail: 50, rimSharpness: 30, overlapIntensity: 90, smoothEdges: true, seed: newSeed(),
      rimHeight: 35, bowlDepth: 55, erosion: 75, terrainRoughness: 60, craterVariation: 80,
    }),
  },
  {
    name: "Titan",
    emoji: "🟠",
    parent: "Saturn",
    color: "text-orange-400",
    description: "Dense atmosphere — almost no visible craters, methane-eroded dunes, hydrocarbon lakes, organic haze",
    build: () => ({
      enabled: true, intensity: 20, craterDensity: "low", craterSize: "small",
      microDetail: 90, rimSharpness: 10, overlapIntensity: 5, smoothEdges: true, seed: newSeed(),
      rimHeight: 10, bowlDepth: 15, erosion: 95, terrainRoughness: 85, craterVariation: 15,
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
  const [seedLocked, setSeedLocked] = useState(false);
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
    if (seedLocked) return;
    onChange({ ...state, seed: newSeed() });
  };

  const handleResurface = () => {
    if (seedLocked) return;
    onChange({ ...state, seed: newSeed() });
  };

  // Live crater count
  const craterCount = useMemo(() => {
    if (!state.enabled) return 0;
    try {
      const maps = generateLunarSurfaceMaps(state, 8); // approximate aspect for count display
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

          {/* Planetary Surface Library */}
          <SubSection title="Planetary Surfaces">
            <div className="grid grid-cols-2 gap-1.5">
              {PLANETARY_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => onApplyPreset(p.build(), p.name)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 p-2 rounded-lg border text-left transition-all",
                    "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-sm">{p.emoji}</span>
                    <span className={cn("text-[10px] font-medium", p.color)}>{p.name}</span>
                  </div>
                  <span className="text-[8px] text-muted-foreground/70 leading-tight">{p.parent}</span>
                  <span className="text-[8px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">{p.description}</span>
                </button>
              ))}
            </div>
          </SubSection>
          {/* Quick actions */}
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={handleResurface} disabled={seedLocked}>
              <Shuffle className="w-3 h-3 mr-1" /> New Surface
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={handleRandomize}>
              <Dices className="w-3 h-3 mr-1" /> Randomize
            </Button>
          </div>

          {/* Seed lock */}
          <div className="flex items-center justify-between bg-secondary/30 rounded px-2 py-1">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              {seedLocked ? <Lock className="w-3 h-3 text-primary" /> : <Unlock className="w-3 h-3" />}
              Seed Lock
            </Label>
            <Switch checked={seedLocked} onCheckedChange={setSeedLocked} />
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
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                Seed: {state.seed}
                {seedLocked && <Lock className="w-2.5 h-2.5 text-primary" />}
              </Label>
              <div className="flex gap-1.5">
                <Slider value={[state.seed]} onValueChange={([v]) => { if (!seedLocked) patch({ seed: v }); }} min={0} max={9999} step={1} className="flex-1" disabled={seedLocked} />
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={handleReseed} disabled={seedLocked}>
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
