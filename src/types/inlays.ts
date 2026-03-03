export type InlayMaterialType = "crystal" | "opal" | "meteorite";

export type InlayPlacement = "center" | "edgeLeft" | "edgeRight";

export interface InlayChannel {
  id: string;
  materialType: InlayMaterialType;
  displayName: string;
  codexUrl: string;
  placement: InlayPlacement;
  channelWidthMm: number;
  channelDepthMm: number;
  notes?: string;
  createdAt: string;
}

export interface InlayState {
  channels: InlayChannel[];
}
