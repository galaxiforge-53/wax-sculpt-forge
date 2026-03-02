import { RingParameters } from "./ring";

export interface CraftAction {
  id: string;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface CraftState {
  baseRingParams: RingParameters;
  actionLog: CraftAction[];
  createdAt: string;
  updatedAt: string;
}
