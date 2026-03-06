// TemplateRegistry: ring presets that map to RingParameters + optional surface/material state
import { RingParameters } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import type { MetalPreset, FinishPreset } from "@/types/ring";

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: "classic" | "modern" | "mythic" | "cosmic";
  icon: string;
  params: RingParameters;
  /** Optional overrides applied alongside geometry */
  lunar?: Partial<LunarTextureState>;
  engraving?: Partial<EngravingState>;
  metalPreset?: MetalPreset;
  finishPreset?: FinishPreset;
  tags?: string[];
}

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  // ── Existing templates ─────────────────────────────────────
  {
    id: "classic-band",
    name: "Classic Band",
    description: "Timeless comfort-fit dome profile",
    category: "classic",
    icon: "💍",
    tags: ["simple", "wedding", "everyday"],
    params: {
      size: 8, innerDiameter: 18.1, width: 6, thickness: 2,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
  },
  {
    id: "meteor-groove",
    name: "Meteor Groove",
    description: "Triple-channel band with sharp bevels",
    category: "cosmic",
    icon: "☄️",
    tags: ["grooves", "space", "bold"],
    params: {
      size: 9, innerDiameter: 19.0, width: 8, thickness: 2.5,
      profile: "flat", comfortFit: true,
      grooveCount: 3, grooveDepth: 0.5, bevelSize: 0.6,
    },
  },
  {
    id: "ancient-rune-bevel",
    name: "Ancient Rune Bevel",
    description: "Wide flat band with deep bevels — ready for engravings",
    category: "mythic",
    icon: "🏛️",
    tags: ["engraving", "wide", "ceremonial"],
    params: {
      size: 10, innerDiameter: 19.8, width: 10, thickness: 2.2,
      profile: "flat", comfortFit: false,
      grooveCount: 1, grooveDepth: 0.4, bevelSize: 1.5,
    },
  },
  {
    id: "cosmic-edge",
    name: "Cosmic Edge",
    description: "Knife-edge profile — sleek and futuristic",
    category: "cosmic",
    icon: "✨",
    tags: ["thin", "futuristic", "sleek"],
    params: {
      size: 7, innerDiameter: 17.3, width: 5, thickness: 1.8,
      profile: "knife-edge", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.2,
    },
  },
  {
    id: "forge-heavy",
    name: "Forge Heavy",
    description: "Thick square profile — bold and industrial",
    category: "modern",
    icon: "⚒️",
    tags: ["heavy", "industrial", "bold"],
    params: {
      size: 10, innerDiameter: 19.8, width: 8, thickness: 3.5,
      profile: "square", comfortFit: false,
      grooveCount: 2, grooveDepth: 0.6, bevelSize: 0.4,
    },
  },
  {
    id: "slim-dome",
    name: "Slim Dome",
    description: "Delicate domed band — minimal and elegant",
    category: "classic",
    icon: "○",
    tags: ["minimal", "delicate", "everyday"],
    params: {
      size: 6, innerDiameter: 16.5, width: 3, thickness: 1.5,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
  },

  // ── New surface-driven templates ───────────────────────────
  {
    id: "lunar-crater",
    name: "Lunar Crater Ring",
    description: "Deep impact craters carved across the surface — like a fragment of the Moon",
    category: "cosmic",
    icon: "🌑",
    tags: ["lunar", "craters", "textured", "space"],
    params: {
      size: 9, innerDiameter: 19.0, width: 8, thickness: 2.5,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
    lunar: {
      enabled: true,
      intensity: 72,
      craterDensity: "high",
      craterSize: "large",
      smoothEdges: false,
      microDetail: 55,
      rimSharpness: 70,
      overlapIntensity: 50,
      rimHeight: 65,
      bowlDepth: 75,
      erosion: 15,
      terrainRoughness: 40,
      craterVariation: 60,
    },
    metalPreset: "titanium",
    finishPreset: "matte",
  },
  {
    id: "hammered-band",
    name: "Hammered Ring",
    description: "Hand-forged texture with organic dents and soft edges",
    category: "classic",
    icon: "🔨",
    tags: ["hammered", "artisan", "organic", "textured"],
    params: {
      size: 8, innerDiameter: 18.1, width: 6, thickness: 2.2,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.4,
    },
    lunar: {
      enabled: true,
      intensity: 45,
      craterDensity: "med",
      craterSize: "med",
      smoothEdges: true,
      microDetail: 30,
      rimSharpness: 25,
      overlapIntensity: 40,
      rimHeight: 30,
      bowlDepth: 35,
      erosion: 70,
      terrainRoughness: 55,
      craterVariation: 80,
    },
    finishPreset: "hammered",
    metalPreset: "gold",
  },
  {
    id: "meteorite-style",
    name: "Meteorite Style",
    description: "Widmanstätten-inspired patterning — raw cosmic iron texture",
    category: "cosmic",
    icon: "🪨",
    tags: ["meteorite", "raw", "industrial", "space"],
    params: {
      size: 10, innerDiameter: 19.8, width: 8, thickness: 2.8,
      profile: "flat", comfortFit: true,
      grooveCount: 1, grooveDepth: 0.3, bevelSize: 0.5,
    },
    lunar: {
      enabled: true,
      intensity: 60,
      craterDensity: "low",
      craterSize: "small",
      smoothEdges: false,
      microDetail: 85,
      rimSharpness: 40,
      overlapIntensity: 20,
      rimHeight: 20,
      bowlDepth: 25,
      erosion: 5,
      terrainRoughness: 90,
      craterVariation: 45,
    },
    metalPreset: "tungsten",
    finishPreset: "brushed",
  },
  {
    id: "smooth-comfort",
    name: "Smooth Comfort Band",
    description: "Ultra-smooth interior and exterior — pure comfort, zero texture",
    category: "classic",
    icon: "🤍",
    tags: ["smooth", "comfort", "wedding", "minimal"],
    params: {
      size: 8, innerDiameter: 18.1, width: 5, thickness: 2.0,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
    lunar: { enabled: false },
    metalPreset: "rose-gold",
    finishPreset: "polished",
  },
  {
    id: "rough-cosmic",
    name: "Rough Cosmic Surface",
    description: "Eroded asteroid terrain — dense micro-pitting with heavy roughness",
    category: "cosmic",
    icon: "💫",
    tags: ["rough", "cosmic", "asteroid", "heavy-texture"],
    params: {
      size: 9, innerDiameter: 19.0, width: 7, thickness: 2.6,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
    lunar: {
      enabled: true,
      intensity: 85,
      craterDensity: "high",
      craterSize: "small",
      smoothEdges: false,
      microDetail: 90,
      rimSharpness: 55,
      overlapIntensity: 65,
      rimHeight: 45,
      bowlDepth: 50,
      erosion: 40,
      terrainRoughness: 95,
      craterVariation: 70,
    },
    metalPreset: "titanium",
    finishPreset: "matte",
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === id);
}
