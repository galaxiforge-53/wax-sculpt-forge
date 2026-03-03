export type ForgeStageId =
  | "WAX_SCULPT"
  | "MOLD_PREP"
  | "BURNOUT"
  | "POUR"
  | "QUENCH"
  | "FINISH";

export interface ForgeStageMeta {
  id: ForgeStageId;
  label: string;
  description: string;
  defaultViewMode: "wax" | "cast";
  notes?: string;
}

export interface ForgePipelineState {
  currentStage: ForgeStageId;
  startedAt: string;
  updatedAt: string;
}
