import { DesignPackage } from "./ring";

export type ProjectId = string;

export interface DesignProject {
  id: ProjectId;
  name: string;
  createdAt: string;
  updatedAt: string;
  designPackage: DesignPackage;
  thumbnail?: string;
}
