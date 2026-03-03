import { RingParameters } from "./ring";
import { WaxMark } from "./waxmarks";
import { InlayState } from "./inlays";

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
  createdAt: string;
  updatedAt: string;
}
