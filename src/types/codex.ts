export type CodexMaterialType = "crystal" | "opal" | "meteorite";

export interface CodexMaterial {
  id: string;
  name: string;
  type: CodexMaterialType;
  image?: string;
  canonicalUrl: string;
  rarity?: "common" | "rare" | "ultra-rare";
  tags?: string[];
}
