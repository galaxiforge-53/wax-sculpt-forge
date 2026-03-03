export type WaxMarkType = "dent" | "scratch" | "chisel" | "heat-soften";

export interface WaxMark {
  id: string;
  type: WaxMarkType;
  createdAt: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  radiusMm: number;
  intensity: number; // 0..1
}
