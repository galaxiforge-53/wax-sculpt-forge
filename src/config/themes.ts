// ThemeRegistry: theme metadata + token overrides
// Themes define visual identity; the active theme is applied via CSS variables.

export interface ThemeTokens {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ember: string;
  emberGlow: string;
}

export interface ThemeMeta {
  id: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
  fontDisplay: string;
  fontBody: string;
}

export const THEME_REGISTRY: ThemeMeta[] = [
  {
    id: "forge",
    name: "Forge",
    description: "Classic blacksmith — soot black, ember orange, molten accents",
    fontDisplay: "Cinzel",
    fontBody: "Inter",
    tokens: {
      background: "0 0% 7%",
      foreground: "30 10% 90%",
      primary: "25 95% 53%",
      primaryForeground: "0 0% 100%",
      accent: "35 100% 50%",
      accentForeground: "0 0% 5%",
      card: "0 0% 10%",
      muted: "0 0% 14%",
      mutedForeground: "30 5% 55%",
      border: "0 0% 18%",
      ember: "25 95% 53%",
      emberGlow: "15 90% 45%",
    },
  },
  {
    id: "cosmic-forge",
    name: "Cosmic Forge",
    description: "Deep space metals — midnight blue, nebula purple, starlight silver",
    fontDisplay: "Cinzel",
    fontBody: "Inter",
    tokens: {
      background: "230 25% 7%",
      foreground: "220 15% 90%",
      primary: "260 70% 60%",
      primaryForeground: "0 0% 100%",
      accent: "200 90% 55%",
      accentForeground: "0 0% 5%",
      card: "230 20% 11%",
      muted: "230 15% 15%",
      mutedForeground: "220 10% 50%",
      border: "230 15% 20%",
      ember: "260 70% 60%",
      emberGlow: "280 60% 45%",
    },
  },
  {
    id: "ancient-realm",
    name: "Ancient Realm",
    description: "Weathered bronze — parchment tones, aged gold, stone textures",
    fontDisplay: "Cinzel",
    fontBody: "Inter",
    tokens: {
      background: "30 10% 8%",
      foreground: "35 20% 85%",
      primary: "40 75% 50%",
      primaryForeground: "0 0% 5%",
      accent: "25 60% 45%",
      accentForeground: "0 0% 100%",
      card: "30 8% 12%",
      muted: "30 8% 15%",
      mutedForeground: "30 10% 50%",
      border: "30 8% 20%",
      ember: "40 75% 50%",
      emberGlow: "35 65% 40%",
    },
  },
];

export function getTheme(id: string): ThemeMeta {
  return THEME_REGISTRY.find((t) => t.id === id) ?? THEME_REGISTRY[0];
}
