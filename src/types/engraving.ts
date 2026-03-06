export type EngravingFont = "serif" | "sans" | "script" | "mono";

export interface EngravingState {
  enabled: boolean;
  text: string;
  font: EngravingFont;
  sizeMm: number;       // character height in mm (0.5–3.0)
  spacingMm: number;    // letter spacing in mm (0–1.0)
  depthMm: number;      // engraving depth in mm (0.1–0.5)
}

export const DEFAULT_ENGRAVING: EngravingState = {
  enabled: false,
  text: "",
  font: "sans",
  sizeMm: 1.2,
  spacingMm: 0.1,
  depthMm: 0.2,
};

export const ENGRAVING_FONTS: { value: EngravingFont; label: string; desc: string }[] = [
  { value: "serif", label: "Serif", desc: "Classic, elegant" },
  { value: "sans", label: "Sans Serif", desc: "Clean, modern" },
  { value: "script", label: "Script", desc: "Flowing, romantic" },
  { value: "mono", label: "Monospace", desc: "Technical, precise" },
];
