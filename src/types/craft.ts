import { RingParameters } from "./ring";
import { WaxMark } from "./waxmarks";

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
  createdAt: string;
  updatedAt: string;
}
