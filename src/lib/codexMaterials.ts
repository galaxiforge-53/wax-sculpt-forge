import { CodexMaterial } from "@/types/codex";

export const CODEX_MATERIALS: CodexMaterial[] = [
  {
    id: "white-opal",
    name: "White Opal",
    type: "opal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/opal/white",
    rarity: "common",
    tags: ["classic", "iridescent"],
  },
  {
    id: "black-opal",
    name: "Black Opal",
    type: "opal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/opal/black",
    rarity: "rare",
    tags: ["dark", "dramatic"],
  },
  {
    id: "boulder-opal",
    name: "Boulder Opal",
    type: "opal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/opal/boulder",
    rarity: "rare",
    tags: ["natural", "earthy"],
  },
  {
    id: "fire-opal",
    name: "Fire Opal",
    type: "opal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/opal/fire",
    rarity: "ultra-rare",
    tags: ["vivid", "warm"],
  },
  {
    id: "campo-del-cielo",
    name: "Campo del Cielo Meteorite",
    type: "meteorite",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/meteorite/campo-del-cielo",
    rarity: "rare",
    tags: ["iron", "widmanstätten"],
  },
  {
    id: "muonionalusta",
    name: "Muonionalusta Meteorite",
    type: "meteorite",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/meteorite/muonionalusta",
    rarity: "ultra-rare",
    tags: ["ancient", "crystalline"],
  },
  {
    id: "moldavite",
    name: "Moldavite",
    type: "crystal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/crystal/moldavite",
    rarity: "ultra-rare",
    tags: ["tektite", "green"],
  },
  {
    id: "lapis-lazuli",
    name: "Lapis Lazuli",
    type: "crystal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/crystal/lapis-lazuli",
    rarity: "common",
    tags: ["blue", "royal"],
  },
  {
    id: "amethyst",
    name: "Amethyst",
    type: "crystal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/crystal/amethyst",
    rarity: "common",
    tags: ["purple", "quartz"],
  },
  {
    id: "emerald",
    name: "Emerald",
    type: "crystal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/crystal/emerald",
    rarity: "rare",
    tags: ["green", "beryl"],
  },
  {
    id: "malachite",
    name: "Malachite",
    type: "crystal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/crystal/malachite",
    rarity: "common",
    tags: ["green", "banded"],
  },
  {
    id: "labradorite",
    name: "Labradorite",
    type: "crystal",
    canonicalUrl: "https://galaxiforge.com/crystal-codex/crystal/labradorite",
    rarity: "rare",
    tags: ["iridescent", "feldspar"],
  },
];

export function findCodexMaterial(id: string): CodexMaterial | undefined {
  return CODEX_MATERIALS.find((m) => m.id === id);
}

export function slugFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  } catch {
    return "";
  }
}
