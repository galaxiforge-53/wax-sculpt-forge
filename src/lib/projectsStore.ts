import { DesignProject } from "@/types/projects";

const STORAGE_KEY = "forgelab_projects_v1";

function readAll(): DesignProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(projects: DesignProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects(): DesignProject[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProject(id: string): DesignProject | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function saveProject(project: DesignProject): void {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    all[idx] = project;
  } else {
    all.push(project);
  }
  writeAll(all);
}

export function deleteProject(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function renameProject(id: string, newName: string): void {
  const all = readAll();
  const project = all.find((p) => p.id === id);
  if (project) {
    project.name = newName;
    project.updatedAt = new Date().toISOString();
    writeAll(all);
  }
}

export function duplicateProject(id: string): DesignProject | null {
  const all = readAll();
  const source = all.find((p) => p.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: DesignProject = {
    ...structuredClone(source),
    id: `PRJ-${Date.now().toString(36).toUpperCase()}`,
    name: `${source.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  all.push(copy);
  writeAll(all);
  return copy;
}
