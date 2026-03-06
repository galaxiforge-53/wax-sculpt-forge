import { RingParameters } from "./ring";
import { WaxMark } from "./waxmarks";
import { InlayState } from "./inlays";
import { LunarTextureState } from "./lunar";
import { EngravingState } from "./engraving";

export interface CraftAction {
  id: string;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface CraftState {
  baseRingParams: RingParameters;
  actionLog: CraftAction[];
  waxMarks: WaxMark[];
  inlays?: InlayState;
  lunarTexture?: LunarTextureState;
  engraving?: EngravingState;
  createdAt: string;
  updatedAt: string;
}
