// TemplateRegistry: ring presets that map to RingParameters + optional surface/material state
import { RingParameters } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import type { MetalPreset, FinishPreset } from "@/types/ring";

export type TemplateCategory = "classic" | "modern" | "mythic" | "cosmic" | "minimalist" | "textured" | "wedding";

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  params: RingParameters;
  /** Optional overrides applied alongside geometry */
  lunar?: Partial<LunarTextureState>;
  engraving?: Partial<EngravingState>;
  metalPreset?: MetalPreset;
  finishPreset?: FinishPreset;
  tags?: string[];
  /** Marketplace extras */
  popularity?: number; // 0-100
  difficulty?: "beginner" | "intermediate" | "advanced";
  lore?: string;
}

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  // ── Classic ────────────────────────────────────────────────
  {
    id: "classic-band",
    name: "Classic Band",
    description: "Timeless comfort-fit dome profile",
    category: "classic",
    icon: "💍",
    tags: ["simple", "wedding", "everyday"],
    popularity: 95,
    difficulty: "beginner",
    lore: "The ring that started it all — a pure, unadorned circle of metal.",
    params: {
      size: 8, innerDiameter: 18.1, width: 6, thickness: 2,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
  },
  {
    id: "slim-dome",
    name: "Slim Dome",
    description: "Delicate domed band — minimal and elegant",
    category: "minimalist",
    icon: "○",
    tags: ["minimal", "delicate", "everyday"],
    popularity: 88,
    difficulty: "beginner",
    lore: "Less is more. A whisper of metal, refined to its essence.",
    params: {
      size: 6, innerDiameter: 16.5, width: 3, thickness: 1.5,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
  },
  {
    id: "smooth-comfort",
    name: "Smooth Comfort Band",
    description: "Ultra-smooth interior and exterior — pure comfort, zero texture",
    category: "wedding",
    icon: "🤍",
    tags: ["smooth", "comfort", "wedding", "minimal"],
    popularity: 92,
    difficulty: "beginner",
    lore: "Designed for a lifetime of wear. Silky inside, mirror-polished outside.",
    params: {
      size: 8, innerDiameter: 18.1, width: 5, thickness: 2.0,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
    lunar: { enabled: false },
    metalPreset: "rose-gold",
    finishPreset: "polished",
  },

  // ── Minimalist ─────────────────────────────────────────────
  {
    id: "razor-thin",
    name: "Razor Thin",
    description: "Ultra-narrow knife-edge profile — barely there",
    category: "minimalist",
    icon: "⟋",
    tags: ["thin", "modern", "stackable"],
    popularity: 76,
    difficulty: "beginner",
    lore: "A blade of light around the finger. Stack them or wear alone.",
    params: {
      size: 7, innerDiameter: 17.3, width: 2, thickness: 1.2,
      profile: "knife-edge", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.1,
    },
    metalPreset: "silver",
    finishPreset: "polished",
  },
  {
    id: "single-groove",
    name: "Single Groove",
    description: "Clean flat band with a single centered groove",
    category: "minimalist",
    icon: "—",
    tags: ["groove", "clean", "modern"],
    popularity: 82,
    difficulty: "beginner",
    lore: "One line divides light from shadow. Simple geometry, infinite character.",
    params: {
      size: 8, innerDiameter: 18.1, width: 5, thickness: 1.8,
      profile: "flat", comfortFit: true,
      grooveCount: 1, grooveDepth: 0.5, bevelSize: 0.3,
    },
    metalPreset: "titanium",
    finishPreset: "brushed",
  },
  {
    id: "matte-whisper",
    name: "Matte Whisper",
    description: "Soft matte finish on a slim comfort band — understated luxury",
    category: "minimalist",
    icon: "◌",
    tags: ["matte", "soft", "minimal"],
    popularity: 79,
    difficulty: "beginner",
    lore: "No shine, no flash — just quiet confidence on your finger.",
    params: {
      size: 7, innerDiameter: 17.3, width: 4, thickness: 1.6,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
    metalPreset: "titanium",
    finishPreset: "matte",
  },

  // ── Cosmic ─────────────────────────────────────────────────
  {
    id: "lunar-crater",
    name: "Lunar Crater Ring",
    description: "Deep impact craters carved across the surface — a fragment of the Moon",
    category: "cosmic",
    icon: "🌑",
    tags: ["lunar", "craters", "textured", "space"],
    popularity: 94,
    difficulty: "intermediate",
    lore: "Forged from the same forces that shaped the lunar highlands. Each crater tells of an ancient collision.",
    params: {
      size: 9, innerDiameter: 19.0, width: 8, thickness: 2.5,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
    lunar: {
      enabled: true, intensity: 72, craterDensity: "high", craterSize: "large",
      smoothEdges: false, microDetail: 55, rimSharpness: 70,
      overlapIntensity: 50, rimHeight: 65, bowlDepth: 75,
      erosion: 15, terrainRoughness: 40, craterVariation: 60,
    },
    metalPreset: "titanium",
    finishPreset: "matte",
  },
  {
    id: "meteor-groove",
    name: "Meteor Groove",
    description: "Triple-channel band with sharp bevels",
    category: "cosmic",
    icon: "☄️",
    tags: ["grooves", "space", "bold"],
    popularity: 85,
    difficulty: "intermediate",
    lore: "Three channels carved by cosmic debris. A ring born from velocity.",
    params: {
      size: 9, innerDiameter: 19.0, width: 8, thickness: 2.5,
      profile: "flat", comfortFit: true,
      grooveCount: 3, grooveDepth: 0.5, bevelSize: 0.6,
    },
  },
  {
    id: "cosmic-edge",
    name: "Cosmic Edge",
    description: "Knife-edge profile — sleek and futuristic",
    category: "cosmic",
    icon: "✨",
    tags: ["thin", "futuristic", "sleek"],
    popularity: 80,
    difficulty: "beginner",
    lore: "Cut from the edge of a nebula. Sharp enough to slice starlight.",
    params: {
      size: 7, innerDiameter: 17.3, width: 5, thickness: 1.8,
      profile: "knife-edge", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.2,
    },
  },
  {
    id: "rough-cosmic",
    name: "Rough Cosmic Surface",
    description: "Eroded asteroid terrain — dense micro-pitting with heavy roughness",
    category: "cosmic",
    icon: "💫",
    tags: ["rough", "cosmic", "asteroid", "heavy-texture"],
    popularity: 78,
    difficulty: "advanced",
    lore: "Ripped from an asteroid's crust. Every pit and ridge is a billion-year scar.",
    params: {
      size: 9, innerDiameter: 19.0, width: 7, thickness: 2.6,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
    lunar: {
      enabled: true, intensity: 85, craterDensity: "high", craterSize: "small",
      smoothEdges: false, microDetail: 90, rimSharpness: 55,
      overlapIntensity: 65, rimHeight: 45, bowlDepth: 50,
      erosion: 40, terrainRoughness: 95, craterVariation: 70,
    },
    metalPreset: "titanium",
    finishPreset: "matte",
  },
  {
    id: "europa-ice",
    name: "Europa Ice Crust",
    description: "Cracked ice-moon surface with shallow ridges and faint craters",
    category: "cosmic",
    icon: "🧊",
    tags: ["europa", "ice", "cracked", "subtle"],
    popularity: 71,
    difficulty: "intermediate",
    lore: "Inspired by Jupiter's ice moon — hairline fractures over a frozen ocean.",
    params: {
      size: 8, innerDiameter: 18.1, width: 7, thickness: 2.0,
      profile: "dome", comfortFit: true,
      grooveCount: 2, grooveDepth: 0.25, bevelSize: 0.2,
    },
    lunar: {
      enabled: true, intensity: 35, craterDensity: "low", craterSize: "small",
      smoothEdges: true, microDetail: 70, rimSharpness: 30,
      overlapIntensity: 15, rimHeight: 20, bowlDepth: 25,
      erosion: 60, terrainRoughness: 75, craterVariation: 40,
    },
    metalPreset: "silver",
    finishPreset: "polished",
  },
  {
    id: "phobos-deimos",
    name: "Phobos & Deimos",
    description: "Mars-moon inspired — heavy cratering with deep erosion channels",
    category: "cosmic",
    icon: "🔴",
    tags: ["mars", "moons", "deep-crater", "eroded"],
    popularity: 73,
    difficulty: "advanced",
    lore: "Twin moons of Mars, captured and compressed into a single band of scarred metal.",
    params: {
      size: 10, innerDiameter: 19.8, width: 10, thickness: 3.0,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.4,
    },
    lunar: {
      enabled: true, intensity: 90, craterDensity: "high", craterSize: "large",
      smoothEdges: false, microDetail: 65, rimSharpness: 80,
      overlapIntensity: 75, rimHeight: 80, bowlDepth: 85,
      erosion: 45, terrainRoughness: 60, craterVariation: 75,
    },
    metalPreset: "tungsten",
    finishPreset: "matte",
  },

  // ── Textured ───────────────────────────────────────────────
  {
    id: "hammered-band",
    name: "Hammered Ring",
    description: "Hand-forged texture with organic dents and soft edges",
    category: "textured",
    icon: "🔨",
    tags: ["hammered", "artisan", "organic", "textured"],
    popularity: 90,
    difficulty: "beginner",
    lore: "Each dent placed by the jeweler's hammer. No two are alike.",
    params: {
      size: 8, innerDiameter: 18.1, width: 6, thickness: 2.2,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.4,
    },
    lunar: {
      enabled: true, intensity: 45, craterDensity: "med", craterSize: "med",
      smoothEdges: true, microDetail: 30, rimSharpness: 25,
      overlapIntensity: 40, rimHeight: 30, bowlDepth: 35,
      erosion: 70, terrainRoughness: 55, craterVariation: 80,
    },
    finishPreset: "hammered",
    metalPreset: "gold",
  },
  {
    id: "meteorite-style",
    name: "Meteorite Style",
    description: "Widmanstätten-inspired patterning — raw cosmic iron texture",
    category: "textured",
    icon: "🪨",
    tags: ["meteorite", "raw", "industrial", "space"],
    popularity: 87,
    difficulty: "intermediate",
    lore: "The crystalline pattern of iron-nickel meteorites, captured in wearable metal.",
    params: {
      size: 10, innerDiameter: 19.8, width: 8, thickness: 2.8,
      profile: "flat", comfortFit: true,
      grooveCount: 1, grooveDepth: 0.3, bevelSize: 0.5,
    },
    lunar: {
      enabled: true, intensity: 60, craterDensity: "low", craterSize: "small",
      smoothEdges: false, microDetail: 85, rimSharpness: 40,
      overlapIntensity: 20, rimHeight: 20, bowlDepth: 25,
      erosion: 5, terrainRoughness: 90, craterVariation: 45,
    },
    metalPreset: "tungsten",
    finishPreset: "brushed",
  },
  {
    id: "lava-flow",
    name: "Lava Flow",
    description: "Volcanic surface with molten ridges and deep crevices",
    category: "textured",
    icon: "🌋",
    tags: ["volcanic", "lava", "dramatic", "bold"],
    popularity: 75,
    difficulty: "advanced",
    lore: "Cooled magma captured mid-flow. The ring still radiates volcanic intensity.",
    params: {
      size: 10, innerDiameter: 19.8, width: 10, thickness: 3.2,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
    lunar: {
      enabled: true, intensity: 95, craterDensity: "high", craterSize: "large",
      smoothEdges: false, microDetail: 80, rimSharpness: 90,
      overlapIntensity: 85, rimHeight: 90, bowlDepth: 80,
      erosion: 10, terrainRoughness: 85, craterVariation: 50,
    },
    metalPreset: "gold",
    finishPreset: "matte",
  },
  {
    id: "sand-dune",
    name: "Sand Dune",
    description: "Gentle rolling texture like wind-sculpted desert dunes",
    category: "textured",
    icon: "🏜️",
    tags: ["organic", "soft", "desert", "gentle"],
    popularity: 68,
    difficulty: "beginner",
    lore: "Wind and time shaped these curves. A ring that flows like the Sahara at sunset.",
    params: {
      size: 8, innerDiameter: 18.1, width: 7, thickness: 2.0,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.3,
    },
    lunar: {
      enabled: true, intensity: 30, craterDensity: "low", craterSize: "large",
      smoothEdges: true, microDetail: 15, rimSharpness: 10,
      overlapIntensity: 60, rimHeight: 15, bowlDepth: 20,
      erosion: 85, terrainRoughness: 45, craterVariation: 90,
    },
    metalPreset: "rose-gold",
    finishPreset: "satin",
  },
  {
    id: "bark-texture",
    name: "Tree Bark",
    description: "Organic bark-like ridges — nature-inspired rough texture",
    category: "textured",
    icon: "🌳",
    tags: ["organic", "nature", "bark", "rustic"],
    popularity: 72,
    difficulty: "intermediate",
    lore: "The ancient oak's armor, reinterpreted in precious metal.",
    params: {
      size: 9, innerDiameter: 19.0, width: 8, thickness: 2.4,
      profile: "flat", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.2,
    },
    lunar: {
      enabled: true, intensity: 55, craterDensity: "med", craterSize: "small",
      smoothEdges: false, microDetail: 75, rimSharpness: 60,
      overlapIntensity: 30, rimHeight: 40, bowlDepth: 30,
      erosion: 35, terrainRoughness: 80, craterVariation: 85,
    },
    metalPreset: "gold",
    finishPreset: "brushed",
  },

  // ── Modern / Industrial ────────────────────────────────────
  {
    id: "forge-heavy",
    name: "Forge Heavy",
    description: "Thick square profile — bold and industrial",
    category: "modern",
    icon: "⚒️",
    tags: ["heavy", "industrial", "bold"],
    popularity: 83,
    difficulty: "intermediate",
    lore: "Built for those who work with their hands. This ring means business.",
    params: {
      size: 10, innerDiameter: 19.8, width: 8, thickness: 3.5,
      profile: "square", comfortFit: false,
      grooveCount: 2, grooveDepth: 0.6, bevelSize: 0.4,
    },
  },
  {
    id: "tactical-band",
    name: "Tactical Band",
    description: "Wide flat band with triple grooves and brushed tungsten",
    category: "modern",
    icon: "🎖️",
    tags: ["tactical", "military", "grooves", "wide"],
    popularity: 77,
    difficulty: "intermediate",
    lore: "Precision-engineered for durability. A ring that can take anything you throw at it.",
    params: {
      size: 10, innerDiameter: 19.8, width: 10, thickness: 3.0,
      profile: "flat", comfortFit: true,
      grooveCount: 3, grooveDepth: 0.7, bevelSize: 0.6,
    },
    metalPreset: "tungsten",
    finishPreset: "brushed",
  },
  {
    id: "carbon-edge",
    name: "Carbon Edge",
    description: "Sleek knife-edge with brushed titanium finish",
    category: "modern",
    icon: "⚡",
    tags: ["modern", "sleek", "titanium", "sharp"],
    popularity: 81,
    difficulty: "beginner",
    lore: "Aerodynamic precision meets jewelry. Cut from the future.",
    params: {
      size: 9, innerDiameter: 19.0, width: 6, thickness: 2.0,
      profile: "knife-edge", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.15,
    },
    metalPreset: "titanium",
    finishPreset: "brushed",
  },

  // ── Mythic ─────────────────────────────────────────────────
  {
    id: "ancient-rune-bevel",
    name: "Ancient Rune Bevel",
    description: "Wide flat band with deep bevels — ready for engravings",
    category: "mythic",
    icon: "🏛️",
    tags: ["engraving", "wide", "ceremonial"],
    popularity: 74,
    difficulty: "advanced",
    lore: "An artifact awaiting its inscription. What words will you carve into eternity?",
    params: {
      size: 10, innerDiameter: 19.8, width: 10, thickness: 2.2,
      profile: "flat", comfortFit: false,
      grooveCount: 1, grooveDepth: 0.4, bevelSize: 1.5,
    },
  },
  {
    id: "dragon-scale",
    name: "Dragon Scale",
    description: "Dense overlapping texture evoking ancient dragon hide",
    category: "mythic",
    icon: "🐉",
    tags: ["fantasy", "dragon", "textured", "bold"],
    popularity: 69,
    difficulty: "advanced",
    lore: "Scaled armor from a creature of legend. Wear the dragon's strength.",
    params: {
      size: 10, innerDiameter: 19.8, width: 9, thickness: 2.8,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.3, bevelSize: 0.3,
    },
    lunar: {
      enabled: true, intensity: 65, craterDensity: "high", craterSize: "small",
      smoothEdges: false, microDetail: 95, rimSharpness: 85,
      overlapIntensity: 90, rimHeight: 50, bowlDepth: 30,
      erosion: 5, terrainRoughness: 70, craterVariation: 30,
    },
    metalPreset: "gold",
    finishPreset: "hammered",
  },

  // ── Wedding ────────────────────────────────────────────────
  {
    id: "eternity-classic",
    name: "Eternity Classic",
    description: "Medium-width polished gold — the eternal promise",
    category: "wedding",
    icon: "💛",
    tags: ["wedding", "gold", "classic", "polished"],
    popularity: 96,
    difficulty: "beginner",
    lore: "A circle with no beginning and no end. The original symbol of forever.",
    params: {
      size: 7, innerDiameter: 17.3, width: 4, thickness: 1.8,
      profile: "comfort", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.25,
    },
    metalPreset: "gold",
    finishPreset: "polished",
  },
  {
    id: "rose-promise",
    name: "Rose Promise",
    description: "Satin rose-gold dome — warm, romantic, timeless",
    category: "wedding",
    icon: "🌹",
    tags: ["wedding", "rose-gold", "romantic", "satin"],
    popularity: 89,
    difficulty: "beginner",
    lore: "The blush of first love, cast in rose gold and polished to a warm glow.",
    params: {
      size: 6, innerDiameter: 16.5, width: 4, thickness: 1.6,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
    metalPreset: "rose-gold",
    finishPreset: "satin",
  },
];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: string }[] = [
  { id: "cosmic", label: "Cosmic", icon: "🌌" },
  { id: "textured", label: "Textured", icon: "🪨" },
  { id: "minimalist", label: "Minimalist", icon: "◯" },
  { id: "classic", label: "Classic", icon: "💍" },
  { id: "wedding", label: "Wedding", icon: "💛" },
  { id: "modern", label: "Modern", icon: "⚡" },
  { id: "mythic", label: "Mythic", icon: "🏛️" },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === id);
}
