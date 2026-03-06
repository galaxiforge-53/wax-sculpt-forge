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
import { Moon, Shuffle, Dices, RotateCcw, ChevronDown, Sparkles, Globe, Lock, Unlock, Gem, Hammer } from "lucide-react";
import { useState, useMemo } from "react";
import SurfaceThumbnail from "./SurfaceThumbnail";
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

// ── Meteorite Surface Library ─────────────────────────────────────

interface MeteoritePreset {
  name: string;
  emoji: string;
  description: string;
  type: string; // classification
  color: string;
  build: () => LunarTextureState;
}

const METEORITE_PRESETS: MeteoritePreset[] = [
  {
    name: "Iron Widmanstätten",
    emoji: "⚔",
    type: "Iron (IIIAB)",
    color: "text-zinc-300",
    description: "Classic cross-hatched crystal pattern from slow cooling over millions of years — deep angular fractures with sharp metallic ridges",
    build: () => ({
      enabled: true, intensity: 70, craterDensity: "low", craterSize: "small",
      microDetail: 85, rimSharpness: 95, overlapIntensity: 15, smoothEdges: false, seed: newSeed(),
      rimHeight: 80, bowlDepth: 20, erosion: 5, terrainRoughness: 90, craterVariation: 30,
    }),
  },
  {
    name: "Pallasite Crystal",
    emoji: "💎",
    type: "Stony-Iron",
    color: "text-amber-300",
    description: "Olivine crystals embedded in nickel-iron matrix — smooth gem pockets surrounded by rough metallic ridges",
    build: () => ({
      enabled: true, intensity: 55, craterDensity: "med", craterSize: "large",
      microDetail: 40, rimSharpness: 30, overlapIntensity: 60, smoothEdges: true, seed: newSeed(),
      rimHeight: 25, bowlDepth: 75, erosion: 40, terrainRoughness: 45, craterVariation: 90,
    }),
  },
  {
    name: "Chondrite Regmaglypts",
    emoji: "🪨",
    type: "Stony (L5)",
    color: "text-stone-400",
    description: "Thumbprint-like ablation cavities from atmospheric entry — rounded pits with smooth interiors and rough ridges between",
    build: () => ({
      enabled: true, intensity: 65, craterDensity: "high", craterSize: "med",
      microDetail: 50, rimSharpness: 25, overlapIntensity: 55, smoothEdges: true, seed: newSeed(),
      rimHeight: 20, bowlDepth: 70, erosion: 50, terrainRoughness: 55, craterVariation: 75,
    }),
  },
  {
    name: "Gibeon Iron",
    emoji: "🔩",
    type: "Iron (IVA)",
    color: "text-slate-300",
    description: "Fine octahedrite — tight geometric etching with subtle pitting and highly polished fracture faces",
    build: () => ({
      enabled: true, intensity: 60, craterDensity: "low", craterSize: "small",
      microDetail: 95, rimSharpness: 85, overlapIntensity: 10, smoothEdges: false, seed: newSeed(),
      rimHeight: 70, bowlDepth: 15, erosion: 8, terrainRoughness: 95, craterVariation: 20,
    }),
  },
  {
    name: "Campo del Cielo",
    emoji: "🌋",
    type: "Iron (IAB)",
    color: "text-orange-400",
    description: "Coarse rust-pitted iron with deep irregular cavities — heavy weathering exposes rugged internal structure",
    build: () => ({
      enabled: true, intensity: 80, craterDensity: "med", craterSize: "large",
      microDetail: 60, rimSharpness: 55, overlapIntensity: 45, smoothEdges: false, seed: newSeed(),
      rimHeight: 50, bowlDepth: 85, erosion: 65, terrainRoughness: 80, craterVariation: 70,
    }),
  },
  {
    name: "Muonionalusta",
    emoji: "❄",
    type: "Iron (IVA)",
    color: "text-sky-300",
    description: "Ancient Swedish meteorite — ultra-fine Widmanstätten with frost-like crystalline micro-texture and subtle impact dimples",
    build: () => ({
      enabled: true, intensity: 50, craterDensity: "low", craterSize: "small",
      microDetail: 100, rimSharpness: 75, overlapIntensity: 5, smoothEdges: false, seed: newSeed(),
      rimHeight: 60, bowlDepth: 10, erosion: 15, terrainRoughness: 100, craterVariation: 15,
    }),
  },
  {
    name: "Sikhote-Alin Shrapnel",
    emoji: "💥",
    type: "Iron (IIAB)",
    color: "text-red-400",
    description: "Violent fragmentation — jagged torn edges, deep impact pits, and explosive shrapnel surface from 1947 fall",
    build: () => ({
      enabled: true, intensity: 95, craterDensity: "high", craterSize: "med",
      microDetail: 70, rimSharpness: 100, overlapIntensity: 80, smoothEdges: false, seed: newSeed(),
      rimHeight: 95, bowlDepth: 65, erosion: 3, terrainRoughness: 75, craterVariation: 85,
    }),
  },
  {
    name: "Lunar Meteorite",
    emoji: "🌙",
    type: "Achondrite",
    color: "text-neutral-300",
    description: "Ejected lunar rock — fused regolith breccia with vesicular glass pockets and micro-crater surface",
    build: () => ({
      enabled: true, intensity: 55, craterDensity: "med", craterSize: "small",
      microDetail: 75, rimSharpness: 45, overlapIntensity: 35, smoothEdges: true, seed: newSeed(),
      rimHeight: 40, bowlDepth: 50, erosion: 45, terrainRoughness: 65, craterVariation: 60,
    }),
  },
];

// ── Hammered Metal Presets ─────────────────────────────────────────

interface HammeredPreset {
  name: string;
  description: string;
  color: string;
  build: () => LunarTextureState;
}

const HAMMERED_PRESETS: HammeredPreset[] = [
  {
    name: "Light Planished",
    color: "text-zinc-300",
    description: "Gentle, uniform dents — classic hand-finished jewellery look with subtle surface movement",
    build: () => ({
      enabled: true, intensity: 35, craterDensity: "med", craterSize: "med",
      microDetail: 20, rimSharpness: 15, overlapIntensity: 40, smoothEdges: true, seed: newSeed(),
      rimHeight: 10, bowlDepth: 40, erosion: 60, terrainRoughness: 25, craterVariation: 65,
    }),
  },
  {
    name: "Artisan Hammered",
    color: "text-amber-300",
    description: "Varied irregular dents with moderate depth — each strike unique, warm handcrafted character",
    build: () => ({
      enabled: true, intensity: 55, craterDensity: "high", craterSize: "med",
      microDetail: 30, rimSharpness: 25, overlapIntensity: 60, smoothEdges: true, seed: newSeed(),
      rimHeight: 15, bowlDepth: 60, erosion: 40, terrainRoughness: 30, craterVariation: 85,
    }),
  },
  {
    name: "Deep Forge Strike",
    color: "text-orange-400",
    description: "Bold, pronounced hammer marks — heavy blacksmith-style strikes with visible facets and sharp edges",
    build: () => ({
      enabled: true, intensity: 80, craterDensity: "med", craterSize: "large",
      microDetail: 15, rimSharpness: 50, overlapIntensity: 35, smoothEdges: false, seed: newSeed(),
      rimHeight: 30, bowlDepth: 85, erosion: 10, terrainRoughness: 20, craterVariation: 70,
    }),
  },
  {
    name: "Pin Hammer Fine",
    color: "text-sky-300",
    description: "Tiny dense dimples — delicate pin hammer texture giving a shimmering, light-catching surface",
    build: () => ({
      enabled: true, intensity: 45, craterDensity: "high", craterSize: "small",
      microDetail: 40, rimSharpness: 20, overlapIntensity: 70, smoothEdges: true, seed: newSeed(),
      rimHeight: 8, bowlDepth: 35, erosion: 50, terrainRoughness: 15, craterVariation: 55,
    }),
  },
  {
    name: "Rustic Beaten",
    color: "text-stone-400",
    description: "Rough, uneven strikes with weathered edges — organic, ancient-looking forged metal finish",
    build: () => ({
      enabled: true, intensity: 70, craterDensity: "high", craterSize: "large",
      microDetail: 55, rimSharpness: 35, overlapIntensity: 80, smoothEdges: false, seed: newSeed(),
      rimHeight: 25, bowlDepth: 75, erosion: 55, terrainRoughness: 45, craterVariation: 95,
    }),
  },
  {
    name: "Satin Peen",
    color: "text-violet-300",
    description: "Uniform ball-peen finish — consistent overlapping dimples creating a soft satin-like reflective surface",
    build: () => ({
      enabled: true, intensity: 40, craterDensity: "high", craterSize: "small",
      microDetail: 25, rimSharpness: 10, overlapIntensity: 90, smoothEdges: true, seed: newSeed(),
      rimHeight: 5, bowlDepth: 30, erosion: 70, terrainRoughness: 10, craterVariation: 20,
    }),
  },
];


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

// ── Pre-computed thumbnail states (stable refs, no hooks needed) ──
const LUNAR_THUMB_STATES = LUNAR_PRESETS.filter(p => p.name !== "Random Chaos").map(p => ({ name: p.name, state: p.build() }));
const PLANETARY_THUMB_STATES = PLANETARY_PRESETS.map(p => ({ name: p.name, state: p.build() }));
const METEORITE_THUMB_STATES = METEORITE_PRESETS.map(p => ({ name: p.name, state: p.build() }));
const HAMMERED_THUMB_STATES = HAMMERED_PRESETS.map(p => ({ name: p.name, state: p.build() }));

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

          {/* Presets — visual grid with thumbnails */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Quick Presets</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {LUNAR_THUMB_STATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handlePreset(t.name)}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all",
                      "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30"
                    )}
                  >
                    <SurfaceThumbnail preset={t.state} size={36} className="border border-border/30" />
                    <span className="text-[9px] font-medium text-muted-foreground leading-tight">{t.name}</span>
                  </button>
              ))}
            </div>
          </div>

          {/* Planetary Surface Library */}
          <SubSection title="Planetary Surfaces">
            <div className="grid grid-cols-2 gap-1.5">
              {PLANETARY_PRESETS.map((p) => {
                const thumbState = PLANETARY_THUMB_STATES.find(t => t.name === p.name)?.state;
                return (
                  <button
                    key={p.name}
                    onClick={() => onApplyPreset(p.build(), p.name)}
                    className={cn(
                      "flex items-start gap-2 p-1.5 rounded-lg border text-left transition-all",
                      "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30"
                    )}
                  >
                    {thumbState && <SurfaceThumbnail preset={thumbState} size={40} className="border border-border/30 mt-0.5" />}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{p.emoji}</span>
                        <span className={cn("text-[9px] font-medium truncate", p.color)}>{p.name}</span>
                      </div>
                      <span className="text-[7px] text-muted-foreground/70 leading-tight">{p.parent}</span>
                      <span className="text-[7px] text-muted-foreground leading-tight line-clamp-2">{p.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SubSection>

          {/* Meteorite Surface Library */}
          <SubSection title="Meteorite Surfaces">
            <div className="grid grid-cols-2 gap-1.5">
              {METEORITE_PRESETS.map((p) => {
                const thumbState = METEORITE_THUMB_STATES.find(t => t.name === p.name)?.state;
                return (
                  <button
                    key={p.name}
                    onClick={() => onApplyPreset(p.build(), p.name)}
                    className={cn(
                      "flex items-start gap-2 p-1.5 rounded-lg border text-left transition-all",
                      "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30"
                    )}
                  >
                    {thumbState && <SurfaceThumbnail preset={thumbState} size={40} className="border border-border/30 mt-0.5" />}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{p.emoji}</span>
                        <span className={cn("text-[9px] font-medium truncate", p.color)}>{p.name}</span>
                      </div>
                      <span className="text-[7px] text-muted-foreground/70 leading-tight">{p.type}</span>
                      <span className="text-[7px] text-muted-foreground leading-tight line-clamp-2">{p.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SubSection>

          {/* Hammered Metal Styles */}
          <SubSection title="Hammered Metal">
            <p className="text-[8px] text-muted-foreground/60 leading-tight -mt-1 mb-1">
              Hand-hammered jewellery textures. After applying, fine-tune with the controls below.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {HAMMERED_PRESETS.map((p) => {
                const thumbState = HAMMERED_THUMB_STATES.find(t => t.name === p.name)?.state;
                return (
                  <button
                    key={p.name}
                    onClick={() => onApplyPreset(p.build(), p.name)}
                    className={cn(
                      "flex items-start gap-2 p-1.5 rounded-lg border text-left transition-all",
                      "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30"
                    )}
                  >
                    {thumbState && <SurfaceThumbnail preset={thumbState} size={36} className="border border-border/30 mt-0.5" />}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className={cn("text-[9px] font-medium truncate", p.color)}>{p.name}</span>
                      <span className="text-[7px] text-muted-foreground leading-tight line-clamp-2">{p.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dedicated hammered controls */}
            <div className="space-y-2 mt-2 p-2 rounded-lg bg-secondary/20 border border-border/30">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 font-display flex items-center gap-1">
                <Hammer className="w-3 h-3" /> Hammer Controls
              </span>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Hammer Density</Label>
                <Select value={state.craterDensity} onValueChange={(v) => patch({ craterDensity: v as CraterDensity })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Light tapping</SelectItem>
                    <SelectItem value="med">Medium coverage</SelectItem>
                    <SelectItem value="high">Dense hammering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Hammer Depth: {state.bowlDepth}%</Label>
                <Slider value={[state.bowlDepth]} onValueChange={([v]) => patch({ bowlDepth: v })} min={0} max={100} step={1} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Hammer Size</Label>
                <Select value={state.craterSize} onValueChange={(v) => patch({ craterSize: v as CraterSize })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Pin hammer</SelectItem>
                    <SelectItem value="med">Ball peen</SelectItem>
                    <SelectItem value="large">Planishing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SubSection>

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

          {/* ── Crater Shape ── */}
          <SubSection title="Crater Shape">
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-1.5">
              Control crater size, density, and form
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Overall Intensity</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.intensity}%</span>
              </div>
              <Slider value={[state.intensity]} onValueChange={([v]) => patch({ intensity: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">How prominent the texture appears on the surface</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <Label className="text-[10px] text-muted-foreground">Crater Density</Label>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { value: "low" as CraterDensity, label: "Sparse", desc: "Few scattered" },
                  { value: "med" as CraterDensity, label: "Medium", desc: "Balanced coverage" },
                  { value: "high" as CraterDensity, label: "Dense", desc: "Heavily cratered" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => patch({ craterDensity: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md text-center transition-all border",
                      state.craterDensity === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <span className="text-[10px] font-medium">{opt.label}</span>
                    <span className="text-[7px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <Label className="text-[10px] text-muted-foreground">Crater Size</Label>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { value: "small" as CraterSize, label: "Small", desc: "Fine pitting" },
                  { value: "med" as CraterSize, label: "Medium", desc: "Natural craters" },
                  { value: "large" as CraterSize, label: "Large", desc: "Deep basins" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => patch({ craterSize: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md text-center transition-all border",
                      state.craterSize === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <span className="text-[10px] font-medium">{opt.label}</span>
                    <span className="text-[7px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Rim Height</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.rimHeight}%</span>
              </div>
              <Slider value={[state.rimHeight]} onValueChange={([v]) => patch({ rimHeight: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Height of raised edges around each crater</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Bowl Depth</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.bowlDepth}%</span>
              </div>
              <Slider value={[state.bowlDepth]} onValueChange={([v]) => patch({ bowlDepth: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">How deep the crater interiors are carved</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Rim Sharpness</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.rimSharpness}%</span>
              </div>
              <Slider value={[state.rimSharpness]} onValueChange={([v]) => patch({ rimSharpness: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Crisp edges (high) vs soft rounded rims (low)</p>
            </div>
          </SubSection>

          {/* ── Surface Texture ── */}
          <SubSection title="Surface Texture">
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-1.5">
              Fine-tune the terrain between craters
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Micro Detail</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.microDetail}%</span>
              </div>
              <Slider value={[state.microDetail]} onValueChange={([v]) => patch({ microDetail: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Fine grain — adds dust-like surface noise</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Terrain Roughness</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.terrainRoughness}%</span>
              </div>
              <Slider value={[state.terrainRoughness]} onValueChange={([v]) => patch({ terrainRoughness: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Rolling hills and ridges between craters</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Crater Overlap</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.overlapIntensity}%</span>
              </div>
              <Slider value={[state.overlapIntensity]} onValueChange={([v]) => patch({ overlapIntensity: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">How much craters merge into each other</p>
            </div>

            <div className="flex items-center justify-between mt-2 p-2 rounded-md bg-secondary/20">
              <div>
                <Label className="text-[10px] text-muted-foreground">Smooth Edges</Label>
                <p className="text-[8px] text-muted-foreground/40">Soften transitions between features</p>
              </div>
              <Switch checked={state.smoothEdges} onCheckedChange={(v) => patch({ smoothEdges: v })} />
            </div>
          </SubSection>

          {/* ── Weathering & Seed ── */}
          <SubSection title="Weathering & Seed" defaultOpen={false}>
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-1.5">
              Age the surface and control randomisation
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Erosion</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.erosion}%</span>
              </div>
              <Slider value={[state.erosion]} onValueChange={([v]) => patch({ erosion: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Billions of years of weathering — wears down sharp features</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Crater Variation</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.craterVariation}%</span>
              </div>
              <Slider value={[state.craterVariation]} onValueChange={([v]) => patch({ craterVariation: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Randomness in crater shapes — uniform vs chaotic</p>
            </div>

            <div className="space-y-1.5 mt-2 p-2 rounded-md bg-secondary/20">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                Seed: <span className="font-mono text-primary/80">{state.seed}</span>
                {seedLocked && <Lock className="w-2.5 h-2.5 text-primary" />}
              </Label>
              <p className="text-[8px] text-muted-foreground/40">Same seed = same pattern. Lock to keep your surface while tweaking.</p>
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
