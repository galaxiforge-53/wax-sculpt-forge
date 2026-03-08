import { LunarTextureState, CraterDensity, CraterSize, CraterShape, SymmetryMode, SurfaceZone, ZonePreset, ZONE_PRESETS, DEFAULT_ZONE, SurfaceMask, MaskMode, MaskShape, MASK_PRESETS, DEFAULT_MASK, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
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
import { Moon, Shuffle, Dices, RotateCcw, ChevronDown, Sparkles, Globe, Lock, Unlock, Gem, Hammer, Circle, Orbit, Waves, Diamond, SlidersHorizontal, Snowflake, RotateCw, Layers, Plus, Trash2, Eye, EyeOff, FlipHorizontal, Grid3x3, Blend, Wand2 } from "lucide-react";
import { useState, useMemo } from "react";
import SurfaceThumbnail from "./SurfaceThumbnail";
import { cn } from "@/lib/utils";
import { estimateCraterCount } from "@/lib/lunarSurfaceMaps";
import AdvancedTerrainEditor from "./AdvancedTerrainEditor";
import SeedExplorer from "./SeedExplorer";
import { enhanceSurface } from "@/lib/designEnhancer";

// ── Helper: build a full LunarTextureState from partial overrides ──
const preset = (overrides: Partial<LunarTextureState>): LunarTextureState => ({
  ...DEFAULT_LUNAR_TEXTURE,
  enabled: true,
  seed: newSeed(),
  ...overrides,
});

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
    build: () => preset({
      intensity: 55, craterDensity: "med", craterSize: "med",
      microDetail: 40, rimSharpness: 50, overlapIntensity: 25, smoothEdges: true,
      rimHeight: 55, bowlDepth: 60, erosion: 25, terrainRoughness: 35, craterVariation: 50,
      craterShape: "circular", ejectaStrength: 50,
    }),
  },
  {
    name: "Tycho Fresh Impact",
    build: () => preset({
      intensity: 75, craterDensity: "med", craterSize: "large",
      microDetail: 35, rimSharpness: 90, overlapIntensity: 20, smoothEdges: false,
      rimHeight: 85, bowlDepth: 80, erosion: 5, terrainRoughness: 20, craterVariation: 30,
      craterShape: "circular", ejectaStrength: 85,
    }),
  },
  {
    name: "South Pole Aitken",
    build: () => preset({
      intensity: 65, craterDensity: "low", craterSize: "large",
      microDetail: 50, rimSharpness: 40, overlapIntensity: 35, smoothEdges: true,
      rimHeight: 40, bowlDepth: 90, erosion: 45, terrainRoughness: 50, craterVariation: 60,
      craterShape: "organic", ejectaStrength: 40, mariaFill: 30,
    }),
  },
  {
    name: "Weathered Highlands",
    build: () => preset({
      intensity: 50, craterDensity: "high", craterSize: "med",
      microDetail: 60, rimSharpness: 25, overlapIntensity: 50, smoothEdges: true,
      rimHeight: 30, bowlDepth: 45, erosion: 80, terrainRoughness: 65, craterVariation: 70,
      craterShape: "organic", highlandRidges: 55, mariaFill: 15,
    }),
  },
  {
    name: "Dense Bombardment",
    build: () => preset({
      intensity: 90, craterDensity: "high", craterSize: "med",
      microDetail: 45, rimSharpness: 70, overlapIntensity: 85, smoothEdges: false,
      rimHeight: 70, bowlDepth: 75, erosion: 15, terrainRoughness: 40, craterVariation: 80,
      craterShape: "circular", ejectaStrength: 70,
    }),
  },
  {
    name: "Heavy Impact",
    build: () => preset({
      intensity: 80, craterDensity: "high", craterSize: "large",
      microDetail: 30, rimSharpness: 85, overlapIntensity: 75, smoothEdges: false,
      rimHeight: 80, bowlDepth: 85, erosion: 10, terrainRoughness: 25, craterVariation: 40,
      craterShape: "circular", ejectaStrength: 75,
    }),
  },
  {
    name: "Ancient Mare",
    build: () => preset({
      intensity: 40, craterDensity: "low", craterSize: "med",
      microDetail: 55, rimSharpness: 20, overlapIntensity: 10, smoothEdges: true,
      rimHeight: 25, bowlDepth: 35, erosion: 70, terrainRoughness: 55, craterVariation: 45,
      craterShape: "organic", mariaFill: 65, highlandRidges: 20,
    }),
  },
  {
    name: "Micro Regolith",
    build: () => preset({
      intensity: 60, craterDensity: "low", craterSize: "small",
      microDetail: 90, rimSharpness: 30, overlapIntensity: 15, smoothEdges: true,
      rimHeight: 35, bowlDepth: 40, erosion: 30, terrainRoughness: 70, craterVariation: 55,
      craterShape: "circular", craterFloorTexture: 60,
    }),
  },
  {
    name: "Rugged Terminator",
    build: () => preset({
      intensity: 85, craterDensity: "med", craterSize: "large",
      microDetail: 50, rimSharpness: 95, overlapIntensity: 45, smoothEdges: false,
      rimHeight: 90, bowlDepth: 70, erosion: 8, terrainRoughness: 45, craterVariation: 35,
      craterShape: "angular", ejectaStrength: 80, highlandRidges: 35,
    }),
  },
  {
    name: "Oblique Impacts",
    build: () => preset({
      intensity: 70, craterDensity: "med", craterSize: "large",
      microDetail: 40, rimSharpness: 60, overlapIntensity: 30, smoothEdges: false,
      rimHeight: 65, bowlDepth: 70, erosion: 20, terrainRoughness: 35, craterVariation: 60,
      craterShape: "oval", ovalElongation: 75, ovalAngle: 45, ejectaStrength: 65,
    }),
  },
  {
    name: "Faceted Crystal",
    build: () => preset({
      intensity: 65, craterDensity: "med", craterSize: "med",
      microDetail: 30, rimSharpness: 100, overlapIntensity: 40, smoothEdges: false,
      rimHeight: 75, bowlDepth: 55, erosion: 5, terrainRoughness: 50, craterVariation: 45,
      craterShape: "angular", craterFloorTexture: 20, highlandRidges: 40,
    }),
  },
  {
    name: "Random Chaos",
    build: () => preset({
      intensity: randBetween(30, 100),
      craterDensity: (["low", "med", "high"] as const)[Math.floor(Math.random() * 3)],
      craterSize: (["small", "med", "large"] as const)[Math.floor(Math.random() * 3)],
      microDetail: randBetween(10, 100),
      rimSharpness: randBetween(10, 100),
      overlapIntensity: randBetween(0, 100),
      smoothEdges: Math.random() > 0.5,
      rimHeight: randBetween(10, 100),
      bowlDepth: randBetween(10, 100),
      erosion: randBetween(0, 90),
      terrainRoughness: randBetween(10, 100),
      craterVariation: randBetween(10, 100),
      craterShape: (["circular", "oval", "organic", "angular"] as const)[Math.floor(Math.random() * 4)],
      ovalElongation: randBetween(20, 80),
      ovalAngle: randBetween(0, 360),
      mariaFill: randBetween(0, 60),
      highlandRidges: randBetween(0, 60),
      craterFloorTexture: randBetween(10, 80),
      ejectaStrength: randBetween(10, 90),
    }),
  },
];

// ── Planetary Surface Library ─────────────────────────────────────

interface PlanetaryPreset {
  name: string;
  emoji: string;
  description: string;
  parent: string;
  color: string;
  build: () => LunarTextureState;
}

const PLANETARY_PRESETS: PlanetaryPreset[] = [
  {
    name: "Earth's Moon", emoji: "🌕", parent: "Earth", color: "text-zinc-300",
    description: "Classic highlands — large circular craters, maria plains, prominent ejecta rays",
    build: () => preset({
      intensity: 60, craterDensity: "med", craterSize: "large",
      microDetail: 55, rimSharpness: 50, overlapIntensity: 40, smoothEdges: true,
      rimHeight: 55, bowlDepth: 60, erosion: 35, terrainRoughness: 40, craterVariation: 55,
      craterShape: "circular", mariaFill: 35, ejectaStrength: 65,
      terrainType: "lunar",
    }),
  },
  {
    name: "Mercury", emoji: "☿", parent: "Sun", color: "text-amber-400",
    description: "Dense overlapping impacts — sharp rims, lobate scarps from planetary cooling, Caloris-scale basins",
    build: () => preset({
      intensity: 85, craterDensity: "high", craterSize: "med",
      microDetail: 40, rimSharpness: 80, overlapIntensity: 80, smoothEdges: false,
      rimHeight: 75, bowlDepth: 70, erosion: 8, terrainRoughness: 30, craterVariation: 65,
      craterShape: "circular", ejectaStrength: 75,
      terrainType: "mercurian",
    }),
  },
  {
    name: "Mars", emoji: "♂", parent: "Sun", color: "text-red-400",
    description: "Wind-eroded craters — dust-filled basins, volcanic plains, wind-driven infill softening all features",
    build: () => preset({
      intensity: 50, craterDensity: "med", craterSize: "large",
      microDetail: 35, rimSharpness: 35, overlapIntensity: 30, smoothEdges: true,
      rimHeight: 40, bowlDepth: 50, erosion: 55, terrainRoughness: 60, craterVariation: 70,
      craterShape: "organic", mariaFill: 40, highlandRidges: 30,
      terrainType: "martian",
    }),
  },
  {
    name: "Phobos", emoji: "🪨", parent: "Mars", color: "text-stone-400",
    description: "Irregular crater clusters — Stickney-radial parallel grooves, rubble-pile texture, stretched shapes",
    build: () => preset({
      intensity: 70, craterDensity: "med", craterSize: "large",
      microDetail: 30, rimSharpness: 35, overlapIntensity: 25, smoothEdges: true,
      rimHeight: 30, bowlDepth: 85, erosion: 50, terrainRoughness: 75, craterVariation: 60,
      craterShape: "oval", ovalElongation: 65, highlandRidges: 35,
      terrainType: "phobos",
    }),
  },
  {
    name: "Deimos", emoji: "🌑", parent: "Mars", color: "text-neutral-500",
    description: "Smooth buried craters — thick regolith blanket softening all features into gentle undulations",
    build: () => preset({
      intensity: 35, craterDensity: "low", craterSize: "med",
      microDetail: 70, rimSharpness: 15, overlapIntensity: 10, smoothEdges: true,
      rimHeight: 15, bowlDepth: 30, erosion: 90, terrainRoughness: 50, craterVariation: 25,
      craterShape: "organic",
      terrainType: "deimos",
    }),
  },
  {
    name: "Europa", emoji: "❄", parent: "Jupiter", color: "text-cyan-300",
    description: "Icy fracture networks — smooth plains criss-crossed by raised lineae ridges, almost no craters",
    build: () => preset({
      intensity: 25, craterDensity: "low", craterSize: "small",
      microDetail: 85, rimSharpness: 60, overlapIntensity: 5, smoothEdges: true,
      rimHeight: 45, bowlDepth: 25, erosion: 60, terrainRoughness: 70, craterVariation: 20,
      craterShape: "circular", highlandRidges: 50, mariaFill: 10,
      terrainType: "europa",
    }),
  },
  {
    name: "Callisto", emoji: "🌐", parent: "Jupiter", color: "text-amber-300",
    description: "Ancient saturated bombardment — Valhalla concentric rings, 4-billion-year impact history",
    build: () => preset({
      intensity: 95, craterDensity: "high", craterSize: "large",
      microDetail: 50, rimSharpness: 30, overlapIntensity: 90, smoothEdges: true,
      rimHeight: 35, bowlDepth: 55, erosion: 75, terrainRoughness: 60, craterVariation: 80,
      craterShape: "organic", mariaFill: 20,
      terrainType: "callisto",
    }),
  },
  {
    name: "Titan", emoji: "🟠", parent: "Saturn", color: "text-orange-400",
    description: "Organic dune fields — methane-eroded parallel dunes, almost no visible craters, hydrocarbon haze",
    build: () => preset({
      intensity: 20, craterDensity: "low", craterSize: "small",
      microDetail: 90, rimSharpness: 10, overlapIntensity: 5, smoothEdges: true,
      rimHeight: 10, bowlDepth: 15, erosion: 95, terrainRoughness: 85, craterVariation: 15,
      craterShape: "organic", mariaFill: 55,
      terrainType: "titan",
    }),
  },
];

// ── Meteorite Surface Library ─────────────────────────────────────

interface MeteoritePreset {
  name: string;
  emoji: string;
  description: string;
  type: string;
  color: string;
  build: () => LunarTextureState;
}

const METEORITE_PRESETS: MeteoritePreset[] = [
  {
    name: "Iron Widmanstätten", emoji: "⚔", type: "Iron (IIIAB)", color: "text-zinc-300",
    description: "Classic cross-hatched crystal pattern from slow cooling over millions of years — deep angular fractures with sharp metallic ridges",
    build: () => preset({
      intensity: 70, craterDensity: "low", craterSize: "small",
      microDetail: 85, rimSharpness: 95, overlapIntensity: 15, smoothEdges: false,
      rimHeight: 80, bowlDepth: 20, erosion: 5, terrainRoughness: 90, craterVariation: 30,
      craterShape: "angular", highlandRidges: 80,
    }),
  },
  {
    name: "Pallasite Crystal", emoji: "💎", type: "Stony-Iron", color: "text-amber-300",
    description: "Olivine crystals embedded in nickel-iron matrix — smooth gem pockets surrounded by rough metallic ridges",
    build: () => preset({
      intensity: 55, craterDensity: "med", craterSize: "large",
      microDetail: 40, rimSharpness: 30, overlapIntensity: 60, smoothEdges: true,
      rimHeight: 25, bowlDepth: 75, erosion: 40, terrainRoughness: 45, craterVariation: 90,
      craterShape: "organic", craterFloorTexture: 15,
    }),
  },
  {
    name: "Chondrite Regmaglypts", emoji: "🪨", type: "Stony (L5)", color: "text-stone-400",
    description: "Thumbprint-like ablation cavities from atmospheric entry — rounded pits with smooth interiors and rough ridges between",
    build: () => preset({
      intensity: 65, craterDensity: "high", craterSize: "med",
      microDetail: 50, rimSharpness: 25, overlapIntensity: 55, smoothEdges: true,
      rimHeight: 20, bowlDepth: 70, erosion: 50, terrainRoughness: 55, craterVariation: 75,
      craterShape: "oval", ovalElongation: 55, craterFloorTexture: 10,
    }),
  },
  {
    name: "Gibeon Iron", emoji: "🔩", type: "Iron (IVA)", color: "text-slate-300",
    description: "Fine octahedrite — tight geometric etching with subtle pitting and highly polished fracture faces",
    build: () => preset({
      intensity: 60, craterDensity: "low", craterSize: "small",
      microDetail: 95, rimSharpness: 85, overlapIntensity: 10, smoothEdges: false,
      rimHeight: 70, bowlDepth: 15, erosion: 8, terrainRoughness: 95, craterVariation: 20,
      craterShape: "angular", highlandRidges: 70,
    }),
  },
  {
    name: "Campo del Cielo", emoji: "🌋", type: "Iron (IAB)", color: "text-orange-400",
    description: "Coarse rust-pitted iron with deep irregular cavities — heavy weathering exposes rugged internal structure",
    build: () => preset({
      intensity: 80, craterDensity: "med", craterSize: "large",
      microDetail: 60, rimSharpness: 55, overlapIntensity: 45, smoothEdges: false,
      rimHeight: 50, bowlDepth: 85, erosion: 65, terrainRoughness: 80, craterVariation: 70,
      craterShape: "organic",
    }),
  },
  {
    name: "Muonionalusta", emoji: "❄", type: "Iron (IVA)", color: "text-sky-300",
    description: "Ancient Swedish meteorite — ultra-fine Widmanstätten with frost-like crystalline micro-texture and subtle impact dimples",
    build: () => preset({
      intensity: 50, craterDensity: "low", craterSize: "small",
      microDetail: 100, rimSharpness: 75, overlapIntensity: 5, smoothEdges: false,
      rimHeight: 60, bowlDepth: 10, erosion: 15, terrainRoughness: 100, craterVariation: 15,
      craterShape: "angular", highlandRidges: 60, craterFloorTexture: 5,
    }),
  },
  {
    name: "Sikhote-Alin Shrapnel", emoji: "💥", type: "Iron (IIAB)", color: "text-red-400",
    description: "Violent fragmentation — jagged torn edges, deep impact pits, and explosive shrapnel surface from 1947 fall",
    build: () => preset({
      intensity: 95, craterDensity: "high", craterSize: "med",
      microDetail: 70, rimSharpness: 100, overlapIntensity: 80, smoothEdges: false,
      rimHeight: 95, bowlDepth: 65, erosion: 3, terrainRoughness: 75, craterVariation: 85,
      craterShape: "angular", ejectaStrength: 90,
    }),
  },
  {
    name: "Lunar Meteorite", emoji: "🌙", type: "Achondrite", color: "text-neutral-300",
    description: "Ejected lunar rock — fused regolith breccia with vesicular glass pockets and micro-crater surface",
    build: () => preset({
      intensity: 55, craterDensity: "med", craterSize: "small",
      microDetail: 75, rimSharpness: 45, overlapIntensity: 35, smoothEdges: true,
      rimHeight: 40, bowlDepth: 50, erosion: 45, terrainRoughness: 65, craterVariation: 60,
      craterShape: "circular", craterFloorTexture: 55,
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
    name: "Light Planished", color: "text-zinc-300",
    description: "Gentle, uniform dents — classic hand-finished jewellery look with subtle surface movement",
    build: () => preset({
      intensity: 35, craterDensity: "med", craterSize: "med",
      microDetail: 20, rimSharpness: 15, overlapIntensity: 40, smoothEdges: true,
      rimHeight: 10, bowlDepth: 40, erosion: 60, terrainRoughness: 25, craterVariation: 65,
      craterShape: "oval", ovalElongation: 40, craterFloorTexture: 10,
    }),
  },
  {
    name: "Artisan Hammered", color: "text-amber-300",
    description: "Varied irregular dents with moderate depth — each strike unique, warm handcrafted character",
    build: () => preset({
      intensity: 55, craterDensity: "high", craterSize: "med",
      microDetail: 30, rimSharpness: 25, overlapIntensity: 60, smoothEdges: true,
      rimHeight: 15, bowlDepth: 60, erosion: 40, terrainRoughness: 30, craterVariation: 85,
      craterShape: "organic",
    }),
  },
  {
    name: "Deep Forge Strike", color: "text-orange-400",
    description: "Bold, pronounced hammer marks — heavy blacksmith-style strikes with visible facets and sharp edges",
    build: () => preset({
      intensity: 80, craterDensity: "med", craterSize: "large",
      microDetail: 15, rimSharpness: 50, overlapIntensity: 35, smoothEdges: false,
      rimHeight: 30, bowlDepth: 85, erosion: 10, terrainRoughness: 20, craterVariation: 70,
      craterShape: "angular", craterFloorTexture: 25,
    }),
  },
  {
    name: "Pin Hammer Fine", color: "text-sky-300",
    description: "Tiny dense dimples — delicate pin hammer texture giving a shimmering, light-catching surface",
    build: () => preset({
      intensity: 45, craterDensity: "high", craterSize: "small",
      microDetail: 40, rimSharpness: 20, overlapIntensity: 70, smoothEdges: true,
      rimHeight: 8, bowlDepth: 35, erosion: 50, terrainRoughness: 15, craterVariation: 55,
      craterShape: "circular",
    }),
  },
  {
    name: "Rustic Beaten", color: "text-stone-400",
    description: "Rough, uneven strikes with weathered edges — organic, ancient-looking forged metal finish",
    build: () => preset({
      intensity: 70, craterDensity: "high", craterSize: "large",
      microDetail: 55, rimSharpness: 35, overlapIntensity: 80, smoothEdges: false,
      rimHeight: 25, bowlDepth: 75, erosion: 55, terrainRoughness: 45, craterVariation: 95,
      craterShape: "organic",
    }),
  },
  {
    name: "Satin Peen", color: "text-violet-300",
    description: "Uniform ball-peen finish — consistent overlapping dimples creating a soft satin-like reflective surface",
    build: () => preset({
      intensity: 40, craterDensity: "high", craterSize: "small",
      microDetail: 25, rimSharpness: 10, overlapIntensity: 90, smoothEdges: true,
      rimHeight: 5, bowlDepth: 30, erosion: 70, terrainRoughness: 10, craterVariation: 20,
      craterShape: "circular",
    }),
  },
];

// ── UI helpers ────────────────────────────────────────────────────

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

// ── Pre-computed thumbnail states ──
const LUNAR_THUMB_STATES = LUNAR_PRESETS.filter(p => p.name !== "Random Chaos").map(p => ({ name: p.name, state: p.build() }));
const PLANETARY_THUMB_STATES = PLANETARY_PRESETS.map(p => ({ name: p.name, state: p.build() }));
const METEORITE_THUMB_STATES = METEORITE_PRESETS.map(p => ({ name: p.name, state: p.build() }));
const HAMMERED_THUMB_STATES = HAMMERED_PRESETS.map(p => ({ name: p.name, state: p.build() }));

// ── Crater shape icons ───────────────────────────────────────────

const SHAPE_OPTIONS: { value: CraterShape; label: string; desc: string; icon: typeof Circle }[] = [
  { value: "circular", label: "Circular", desc: "Perfect round craters", icon: Circle },
  { value: "oval", label: "Oval", desc: "Elongated impacts", icon: Orbit },
  { value: "organic", label: "Organic", desc: "Natural irregular shapes", icon: Waves },
  { value: "angular", label: "Angular", desc: "Faceted crystalline", icon: Diamond },
];

// ── Panel ─────────────────────────────────────────────────────────

interface LunarTexturePanelProps {
  state: LunarTextureState;
  onChange: (state: LunarTextureState) => void;
  onApplyPreset: (state: LunarTextureState, presetName: string) => void;
  onRandomize: (state: LunarTextureState) => void;
  ringThickness?: number;
  onEnhanceSummary?: (summary: string[]) => void;
}

export default function LunarTexturePanel({ state, onChange, onApplyPreset, onRandomize, ringThickness = 2.0, onEnhanceSummary }: LunarTexturePanelProps) {
  const [seedLocked, setSeedLocked] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const patch = (p: Partial<LunarTextureState>) => onChange({ ...state, ...p });

  const handlePreset = (name: string) => {
    const found = LUNAR_PRESETS.find((p) => p.name === name);
    if (!found) return;
    onApplyPreset(found.build(), name);
  };

  const handleRandomize = () => {
    const chaos = LUNAR_PRESETS.find((p) => p.name === "Random Chaos")!;
    onRandomize(chaos.build());
  };

  const handleEnhanceSurface = () => {
    setIsEnhancing(true);
    setTimeout(() => {
      const result = enhanceSurface(state, ringThickness);
      if (Object.keys(result.patch).length > 0) {
        onChange({ ...state, ...result.patch });
      }
      onEnhanceSummary?.(result.summary);
      setIsEnhancing(false);
    }, 300);
  };

  const handleReseed = () => {
    if (seedLocked) return;
    onChange({ ...state, seed: newSeed() });
  };

  const handleResurface = () => {
    if (seedLocked) return;
    onChange({ ...state, seed: newSeed() });
  };

  // Fast crater count estimate (no texture generation)
  const craterCount = useMemo(() => {
    if (!state.enabled) return 0;
    return estimateCraterCount(state);
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
          {/* Freeze & crater count row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/50 rounded px-2 py-1 flex-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>{craterCount.toLocaleString()} craters generated</span>
            </div>
            <Button
              size="sm"
              variant={state.frozen ? "default" : "outline"}
              onClick={() => patch({ frozen: !state.frozen })}
              className={cn(
                "h-7 px-2.5 gap-1.5 text-[10px]",
                state.frozen && "bg-primary/90 hover:bg-primary"
              )}
              title={state.frozen ? "Terrain is frozen — ring size/shape changes won't regenerate surface" : "Freeze terrain to lock current surface while adjusting ring dimensions"}
            >
              <Snowflake className={cn("w-3 h-3", state.frozen && "animate-pulse")} />
              {state.frozen ? "Frozen" : "Freeze"}
            </Button>
          </div>

          {/* Frozen info banner */}
          {state.frozen && (
            <div className="flex items-center gap-2 text-[10px] text-primary/80 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-2">
              <Snowflake className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Terrain is frozen. Adjust ring size, width, or thickness without regenerating the surface.</span>
            </div>
          )}

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

          {/* Enhance Surface */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[10px] h-7 border-accent/50 text-accent hover:bg-accent/10 hover:text-accent gap-1.5"
            onClick={handleEnhanceSurface}
            disabled={isEnhancing}
          >
            <Wand2 className="w-3 h-3" />
            {isEnhancing ? "Enhancing…" : "Enhance Surface"}
          </Button>

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
              Control crater geometry, size, density, and form
            </p>

            {/* Shape selector */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Crater Shape</Label>
              <div className="grid grid-cols-4 gap-1">
                {SHAPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => patch({ craterShape: opt.value })}
                      className={cn(
                        "flex flex-col items-center gap-0.5 px-1 py-2 rounded-md text-center transition-all border",
                        state.craterShape === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[8px] font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] text-muted-foreground/40">
                {SHAPE_OPTIONS.find(o => o.value === state.craterShape)?.desc}
              </p>
            </div>

            {/* Oval-specific controls */}
            {state.craterShape === "oval" && (
              <div className="space-y-1.5 mt-2 p-2 rounded-md bg-secondary/20 border border-border/30">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 font-display">Oval Settings</span>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Elongation</Label>
                    <span className="text-[10px] font-mono text-primary/80">{state.ovalElongation}%</span>
                  </div>
                  <Slider value={[state.ovalElongation]} onValueChange={([v]) => patch({ ovalElongation: v })} min={10} max={90} step={1} />
                  <p className="text-[8px] text-muted-foreground/40">How stretched the oval shape is</p>
                </div>
                <div className="space-y-1.5 mt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Direction</Label>
                    <span className="text-[10px] font-mono text-primary/80">{state.ovalAngle}°</span>
                  </div>
                  <Slider value={[state.ovalAngle]} onValueChange={([v]) => patch({ ovalAngle: v })} min={0} max={360} step={5} />
                  <p className="text-[8px] text-muted-foreground/40">Angle of elongation (0° = horizontal)</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5 mt-2">
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
                <Label className="text-[10px] text-muted-foreground">Terrain Contrast</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.terrainContrast ?? 60}%</span>
              </div>
              <Slider value={[state.terrainContrast ?? 60]} onValueChange={([v]) => patch({ terrainContrast: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">How dramatic crater depth/height differences appear</p>
            </div>

            {/* ── Layer Mix ── */}
            <div className="border-t border-border/30 mt-3 pt-2">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50 mb-2 font-display">Layer Mix</p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Large Craters</Label>
                  <span className="text-[10px] font-mono text-primary/80">{state.layerLargeCraters ?? 50}%</span>
                </div>
                <Slider value={[state.layerLargeCraters ?? 50]} onValueChange={([v]) => patch({ layerLargeCraters: v })} min={0} max={100} step={1} />
                <p className="text-[8px] text-muted-foreground/40">Mega and hero-scale impact basins</p>
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Medium Impacts</Label>
                  <span className="text-[10px] font-mono text-primary/80">{state.layerMediumImpacts ?? 50}%</span>
                </div>
                <Slider value={[state.layerMediumImpacts ?? 50]} onValueChange={([v]) => patch({ layerMediumImpacts: v })} min={0} max={100} step={1} />
                <p className="text-[8px] text-muted-foreground/40">Mid-size and small crater population</p>
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Micro Pitting</Label>
                  <span className="text-[10px] font-mono text-primary/80">{state.layerMicroPitting ?? 50}%</span>
                </div>
                <Slider value={[state.layerMicroPitting ?? 50]} onValueChange={([v]) => patch({ layerMicroPitting: v })} min={0} max={100} step={1} />
                <p className="text-[8px] text-muted-foreground/40">Micro pits, regolith grain, and fine surface texture</p>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Crater Overlap</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.overlapIntensity}%</span>
              </div>
              <Slider value={[state.overlapIntensity]} onValueChange={([v]) => patch({ overlapIntensity: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">How much craters merge into each other</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Crater Floor Texture</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.craterFloorTexture}%</span>
              </div>
              <Slider value={[state.craterFloorTexture]} onValueChange={([v]) => patch({ craterFloorTexture: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Roughness inside crater bowls — smooth vs fractured</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Ejecta Rays</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.ejectaStrength}%</span>
              </div>
              <Slider value={[state.ejectaStrength]} onValueChange={([v]) => patch({ ejectaStrength: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Radial debris streaks from large impacts</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Maria Fill</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.mariaFill}%</span>
              </div>
              <Slider value={[state.mariaFill]} onValueChange={([v]) => patch({ mariaFill: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Smooth dark plains filling low areas (like lunar maria)</p>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Highland Ridges</Label>
                <span className="text-[10px] font-mono text-primary/80">{state.highlandRidges}%</span>
              </div>
              <Slider value={[state.highlandRidges]} onValueChange={([v]) => patch({ highlandRidges: v })} min={0} max={100} step={1} />
              <p className="text-[8px] text-muted-foreground/40">Raised ridge networks between craters</p>
            </div>

            <div className="flex items-center justify-between mt-2 p-2 rounded-md bg-secondary/20">
              <div>
                <Label className="text-[10px] text-muted-foreground">Smooth Edges</Label>
                <p className="text-[8px] text-muted-foreground/40">Soften transitions between features</p>
              </div>
              <Switch checked={state.smoothEdges} onCheckedChange={(v) => patch({ smoothEdges: v })} />
            </div>
          </SubSection>

          {/* ── Pattern Symmetry ── */}
          <SubSection title="Pattern Symmetry" defaultOpen={false}>
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-1.5">
              Repeat the surface pattern evenly around the ring for a balanced look
            </p>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCw className="w-3 h-3" /> Symmetry Mode
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { value: "none" as SymmetryMode, label: "None", desc: "Organic flow" },
                  { value: "2" as SymmetryMode, label: "2-fold", desc: "Mirrored halves" },
                  { value: "3" as SymmetryMode, label: "3-fold", desc: "Trinity pattern" },
                  { value: "4" as SymmetryMode, label: "4-fold", desc: "Quarter repeat" },
                  { value: "6" as SymmetryMode, label: "6-fold", desc: "Hex symmetry" },
                  { value: "8" as SymmetryMode, label: "8-fold", desc: "Octagonal" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => patch({ symmetry: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md text-center transition-all border",
                      (state.symmetry ?? "none") === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <span className="text-[10px] font-medium">{opt.label}</span>
                    <span className="text-[7px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-muted-foreground/40">
                Higher symmetry creates more uniform, mandala-like patterns
              </p>
            </div>

            {(state.symmetry ?? "none") !== "none" && (
              <div className="space-y-1.5 mt-3 p-2 rounded-md bg-secondary/20 border border-border/30">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Blend Smoothness</Label>
                  <span className="text-[10px] font-mono text-primary/80">{state.symmetryBlend ?? 30}%</span>
                </div>
                <Slider 
                  value={[state.symmetryBlend ?? 30]} 
                  onValueChange={([v]) => patch({ symmetryBlend: v })} 
                  min={0} 
                  max={100} 
                  step={1} 
                />
                <p className="text-[8px] text-muted-foreground/40">
                  How smoothly the pattern blends at segment boundaries (0 = sharp, 100 = gradient)
                </p>
              </div>
            )}
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

          {/* ── Seed Explorer ── */}
          <SubSection title="Seed Explorer" defaultOpen={false}>
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-1.5 flex items-center gap-1">
              <Dices className="w-3 h-3" />
              Browse and preview different terrain seeds instantly
            </p>
            <SeedExplorer state={state} onChange={onChange} />
          </SubSection>

          {/* ── Surface Zones ── */}
          <SubSection title="Surface Zones" defaultOpen={false}>
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-2">
              <Layers className="w-3 h-3 inline mr-1" />
              Create multiple texture zones across the ring width — smooth center with textured edges, or vice versa
            </p>

            <div className="flex items-center justify-between mb-2 p-2 rounded-md bg-secondary/20">
              <div>
                <Label className="text-[10px] text-muted-foreground">Enable Zones</Label>
                <p className="text-[8px] text-muted-foreground/40">Override global texture with zone-specific settings</p>
              </div>
              <Switch 
                checked={state.zonesEnabled ?? false} 
                onCheckedChange={(v) => patch({ zonesEnabled: v })} 
              />
            </div>

            {(state.zonesEnabled ?? false) && (
              <div className="space-y-3">
                {/* Zone presets */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Quick Presets</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { value: "center-smooth" as ZonePreset, label: "Smooth Center", desc: "Polished band in middle" },
                      { value: "edges-smooth" as ZonePreset, label: "Smooth Edges", desc: "Textured center band" },
                      { value: "thirds" as ZonePreset, label: "Three Bands", desc: "Alternating zones" },
                      { value: "gradient" as ZonePreset, label: "Gradient", desc: "Fade top to bottom" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => patch({ zones: ZONE_PRESETS[opt.value] })}
                        className={cn(
                          "flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-md text-left transition-all border",
                          "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-primary/30"
                        )}
                      >
                        <span className="text-[10px] font-medium">{opt.label}</span>
                        <span className="text-[7px] opacity-60">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zone list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Zones ({(state.zones ?? []).length})</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        const newZone: SurfaceZone = {
                          ...DEFAULT_ZONE,
                          id: `zone-${Date.now()}`,
                          name: `Zone ${(state.zones ?? []).length + 1}`,
                          startV: 0.4,
                          endV: 0.6,
                        };
                        patch({ zones: [...(state.zones ?? []), newZone] });
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Zone
                    </Button>
                  </div>

                  {(state.zones ?? []).map((zone, idx) => (
                    <div key={zone.id} className="p-2 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={zone.name}
                          onChange={(e) => {
                            const newZones = [...(state.zones ?? [])];
                            newZones[idx] = { ...zone, name: e.target.value };
                            patch({ zones: newZones });
                          }}
                          className="bg-transparent border-none text-[10px] font-medium text-foreground focus:outline-none w-24"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive"
                          onClick={() => {
                            const newZones = (state.zones ?? []).filter((_, i) => i !== idx);
                            patch({ zones: newZones });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Zone position */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>Position: {(zone.startV * 100).toFixed(0)}% – {(zone.endV * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex gap-1">
                          <Slider
                            value={[zone.startV * 100]}
                            onValueChange={([v]) => {
                              const newZones = [...(state.zones ?? [])];
                              newZones[idx] = { ...zone, startV: Math.min(v / 100, zone.endV - 0.05) };
                              patch({ zones: newZones });
                            }}
                            min={0}
                            max={95}
                            step={1}
                            className="flex-1"
                          />
                          <Slider
                            value={[zone.endV * 100]}
                            onValueChange={([v]) => {
                              const newZones = [...(state.zones ?? [])];
                              newZones[idx] = { ...zone, endV: Math.max(v / 100, zone.startV + 0.05) };
                              patch({ zones: newZones });
                            }}
                            min={5}
                            max={100}
                            step={1}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* Zone intensity & smoothness */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Intensity: {zone.intensity}%</Label>
                          <Slider
                            value={[zone.intensity]}
                            onValueChange={([v]) => {
                              const newZones = [...(state.zones ?? [])];
                              newZones[idx] = { ...zone, intensity: v };
                              patch({ zones: newZones });
                            }}
                            min={0}
                            max={100}
                            step={1}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Smoothness: {zone.smoothness}%</Label>
                          <Slider
                            value={[zone.smoothness]}
                            onValueChange={([v]) => {
                              const newZones = [...(state.zones ?? [])];
                              newZones[idx] = { ...zone, smoothness: v };
                              patch({ zones: newZones });
                            }}
                            min={0}
                            max={100}
                            step={1}
                          />
                        </div>
                      </div>

                      {/* Blend width */}
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Edge Blend: {zone.blendWidth}%</Label>
                        <Slider
                          value={[zone.blendWidth]}
                          onValueChange={([v]) => {
                            const newZones = [...(state.zones ?? [])];
                            newZones[idx] = { ...zone, blendWidth: v };
                            patch({ zones: newZones });
                          }}
                          min={0}
                          max={50}
                          step={1}
                        />
                      </div>
                    </div>
                  ))}

                  {(state.zones ?? []).length === 0 && (
                    <p className="text-[9px] text-muted-foreground/50 text-center py-3">
                      No zones defined. Add zones or select a preset above.
                    </p>
                  )}
                </div>

                {/* Visual zone preview bar */}
                {(state.zones ?? []).length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Zone Map (Ring Width)</Label>
                    <div className="h-4 rounded-full overflow-hidden bg-secondary/50 border border-border/40 relative">
                      {(state.zones ?? []).map((zone, idx) => (
                        <div
                          key={zone.id}
                          className="absolute top-0 h-full"
                          style={{
                            left: `${zone.startV * 100}%`,
                            width: `${(zone.endV - zone.startV) * 100}%`,
                            background: `linear-gradient(to right, 
                              hsla(var(--primary), ${(100 - zone.smoothness) / 100}) ${zone.blendWidth}%, 
                              hsla(var(--primary), ${(100 - zone.smoothness) / 100}) ${100 - zone.blendWidth}%, 
                              hsla(var(--primary), ${(100 - zone.smoothness) / 100})
                            )`,
                            opacity: zone.intensity / 100 * 0.8 + 0.2,
                          }}
                          title={zone.name}
                        />
                      ))}
                    </div>
                    <p className="text-[7px] text-muted-foreground/40 text-center">
                      Top edge ← Ring width → Bottom edge
                    </p>
                  </div>
                )}
              </div>
            )}
          </SubSection>

          {/* ── Surface Masks ── */}
          <SubSection title="Surface Masks" defaultOpen={false}>
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-2">
              <Grid3x3 className="w-3 h-3 inline mr-1" />
              Mask areas of the ring so terrain only applies to selected regions
            </p>

            <div className="flex items-center justify-between mb-2 p-2 rounded-md bg-secondary/20">
              <div>
                <Label className="text-[10px] text-muted-foreground">Enable Masks</Label>
                <p className="text-[8px] text-muted-foreground/40">Control where texture appears on the surface</p>
              </div>
              <Switch
                checked={state.masksEnabled ?? false}
                onCheckedChange={(v) => patch({ masksEnabled: v })}
              />
            </div>

            {(state.masksEnabled ?? false) && (
              <div className="space-y-3">
                {/* Mask mode toggle */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Mask Mode</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { value: "include" as MaskMode, label: "Include", desc: "Texture only inside masks" },
                      { value: "exclude" as MaskMode, label: "Exclude", desc: "Texture everywhere except masks" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => patch({ maskMode: opt.value })}
                        className={cn(
                          "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md text-center transition-all border",
                          (state.maskMode ?? "include") === opt.value
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

                {/* Mask presets */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Quick Presets</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { key: "center-spot", label: "Center Spot", desc: "Round masked area" },
                      { key: "horizontal-band", label: "Band", desc: "Horizontal strip" },
                      { key: "vertical-stripes", label: "Stripes", desc: "Repeating columns" },
                      { key: "organic-patches", label: "Organic", desc: "Noise-based patches" },
                    ]).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => patch({ masks: MASK_PRESETS[opt.key] })}
                        className={cn(
                          "flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-md text-left transition-all border",
                          "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-primary/30"
                        )}
                      >
                        <span className="text-[10px] font-medium">{opt.label}</span>
                        <span className="text-[7px] opacity-60">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mask list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Masks ({(state.masks ?? []).length})</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        const newMask: SurfaceMask = {
                          ...DEFAULT_MASK,
                          id: `mask-${Date.now()}`,
                          name: `Mask ${(state.masks ?? []).length + 1}`,
                        };
                        patch({ masks: [...(state.masks ?? []), newMask] });
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Mask
                    </Button>
                  </div>

                  {(state.masks ?? []).map((mask, idx) => {
                    const updateMask = (updates: Partial<SurfaceMask>) => {
                      const newMasks = [...(state.masks ?? [])];
                      newMasks[idx] = { ...mask, ...updates };
                      patch({ masks: newMasks });
                    };

                    return (
                      <div key={mask.id} className={cn(
                        "p-2 rounded-lg border space-y-2",
                        mask.enabled
                          ? "bg-secondary/30 border-border/40"
                          : "bg-secondary/10 border-border/20 opacity-60"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateMask({ enabled: !mask.enabled })}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title={mask.enabled ? "Disable mask" : "Enable mask"}
                            >
                              {mask.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <input
                              type="text"
                              value={mask.name}
                              onChange={(e) => updateMask({ name: e.target.value })}
                              className="bg-transparent border-none text-[10px] font-medium text-foreground focus:outline-none w-20"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateMask({ invert: !mask.invert })}
                              className={cn(
                                "p-0.5 rounded transition-colors",
                                mask.invert ? "text-primary" : "text-muted-foreground hover:text-foreground"
                              )}
                              title="Invert mask"
                            >
                              <FlipHorizontal className="w-3 h-3" />
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive"
                              onClick={() => {
                                const newMasks = (state.masks ?? []).filter((_, i) => i !== idx);
                                patch({ masks: newMasks });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {mask.enabled && (
                          <>
                            {/* Shape selector */}
                            <div className="space-y-1">
                              <Label className="text-[9px] text-muted-foreground">Shape</Label>
                              <Select value={mask.shape} onValueChange={(v) => updateMask({ shape: v as MaskShape })}>
                                <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="circle">Circle</SelectItem>
                                  <SelectItem value="rectangle">Rectangle</SelectItem>
                                  <SelectItem value="stripe-h">Horizontal Stripes</SelectItem>
                                  <SelectItem value="stripe-v">Vertical Stripes</SelectItem>
                                  <SelectItem value="noise">Organic Noise</SelectItem>
                                  <SelectItem value="gradient-h">Horizontal Gradient</SelectItem>
                                  <SelectItem value="gradient-v">Vertical Gradient</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Position — only for positioned shapes */}
                            {(mask.shape === "circle" || mask.shape === "rectangle" || mask.shape === "gradient-h" || mask.shape === "gradient-v") && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">U Pos: {(mask.centerU * 100).toFixed(0)}%</Label>
                                  <Slider value={[mask.centerU * 100]} onValueChange={([v]) => updateMask({ centerU: v / 100 })} min={0} max={100} step={1} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">V Pos: {(mask.centerV * 100).toFixed(0)}%</Label>
                                  <Slider value={[mask.centerV * 100]} onValueChange={([v]) => updateMask({ centerV: v / 100 })} min={0} max={100} step={1} />
                                </div>
                              </div>
                            )}

                            {/* Size */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[9px] text-muted-foreground">Width: {(mask.width * 100).toFixed(0)}%</Label>
                                <Slider value={[mask.width * 100]} onValueChange={([v]) => updateMask({ width: v / 100 })} min={5} max={100} step={1} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] text-muted-foreground">Height: {(mask.height * 100).toFixed(0)}%</Label>
                                <Slider value={[mask.height * 100]} onValueChange={([v]) => updateMask({ height: v / 100 })} min={5} max={100} step={1} />
                              </div>
                            </div>

                            {/* Feather & Rotation */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[9px] text-muted-foreground">Feather: {mask.feather}%</Label>
                                <Slider value={[mask.feather]} onValueChange={([v]) => updateMask({ feather: v })} min={0} max={100} step={1} />
                              </div>
                              {(mask.shape === "circle" || mask.shape === "rectangle") && (
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Rotate: {mask.rotation}°</Label>
                                  <Slider value={[mask.rotation]} onValueChange={([v]) => updateMask({ rotation: v })} min={0} max={360} step={1} />
                                </div>
                              )}
                            </div>

                            {/* Stripe-specific controls */}
                            {(mask.shape === "stripe-h" || mask.shape === "stripe-v") && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Count: {mask.stripeCount ?? 4}</Label>
                                  <Slider value={[mask.stripeCount ?? 4]} onValueChange={([v]) => updateMask({ stripeCount: v })} min={1} max={16} step={1} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Gap: {mask.stripeGap ?? 50}%</Label>
                                  <Slider value={[mask.stripeGap ?? 50]} onValueChange={([v]) => updateMask({ stripeGap: v })} min={10} max={90} step={1} />
                                </div>
                              </div>
                            )}

                            {/* Noise-specific controls */}
                            {mask.shape === "noise" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Scale: {mask.noiseScale ?? 50}</Label>
                                  <Slider value={[mask.noiseScale ?? 50]} onValueChange={([v]) => updateMask({ noiseScale: v })} min={5} max={100} step={1} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Threshold: {mask.noiseThreshold ?? 50}%</Label>
                                  <Slider value={[mask.noiseThreshold ?? 50]} onValueChange={([v]) => updateMask({ noiseThreshold: v })} min={10} max={90} step={1} />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {(state.masks ?? []).length === 0 && (
                    <p className="text-[9px] text-muted-foreground/50 text-center py-3">
                      No masks defined. Add masks or select a preset above.
                    </p>
                  )}
                </div>
              </div>
            )}
          </SubSection>

          {/* ── Advanced Terrain Editor ── */}
          <SubSection title="Advanced Terrain Editor" defaultOpen={false}>
            <p className="text-[8px] text-muted-foreground/50 leading-tight -mt-0.5 mb-1.5 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Precise numeric controls with JSON import/export for power users
            </p>
            <AdvancedTerrainEditor state={state} onChange={onChange} />
          </SubSection>
        </div>
      )}
    </div>
  );
}
