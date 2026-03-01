// TemplateRegistry: ring presets that map to RingParameters
import { RingParameters } from "@/types/ring";

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: "classic" | "modern" | "mythic" | "cosmic";
  icon: string;
  params: RingParameters;
}

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  {
    id: "classic-band",
    name: "Classic Band",
    description: "Timeless comfort-fit dome profile",
    category: "classic",
    icon: "💍",
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
    params: {
      size: 6, innerDiameter: 16.5, width: 3, thickness: 1.5,
      profile: "dome", comfortFit: true,
      grooveCount: 0, grooveDepth: 0.2, bevelSize: 0.2,
    },
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === id);
}
