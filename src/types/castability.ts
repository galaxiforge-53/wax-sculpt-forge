export type CastabilityLevel = "good" | "warning" | "risk";

export interface CastabilityCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "risk";
  detail: string;
  suggestedFix?: string;
}

export interface CastabilityReport {
  score: number;
  level: CastabilityLevel;
  targetMinThicknessMm: number;
  metrics: {
    widthMm: number;
    thicknessMm: number;
    bevelMm: number;
    grooveCount: number;
    grooveDepthMm: number;
    profile: string;
    comfortFit: boolean;
  };
  checks: CastabilityCheck[];
}
