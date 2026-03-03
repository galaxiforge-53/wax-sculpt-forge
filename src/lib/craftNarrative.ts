import { CraftAction } from "@/types/craft";
import { ForgeStageId } from "@/types/pipeline";

export interface CraftNarrative {
  highlights: string[];
  stats: {
    toolsUsed: number;
    parameterEdits: number;
    templatesApplied: number;
    stagesChanged: number;
  };
  stageNotes: Partial<Record<ForgeStageId, string[]>>;
}

export function summarizeCraftActions(actions: CraftAction[]): CraftNarrative {
  const stats = { toolsUsed: 0, parameterEdits: 0, templatesApplied: 0, stagesChanged: 0 };
  const highlights: string[] = [];
  const toolCounts: Record<string, number> = {};
  const stageNotes: Partial<Record<ForgeStageId, string[]>> = {};
  let lastParams: Record<string, unknown> = {};
  let waxMarkCount = 0;
  const inlayCounts: Record<string, number> = {};
  let lastLunar: string | null = null;

  for (const action of actions) {
    switch (action.type) {
      case "template_applied": {
        stats.templatesApplied++;
        const updates = action.payload.updates as Record<string, unknown> | undefined;
        const profile = updates?.profile;
        highlights.push(profile ? `Template applied (${profile} profile)` : "Template applied");
        break;
      }

      case "tool_used": {
        stats.toolsUsed++;
        const tool = (action.payload.tool as string) ?? "unknown";
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
        break;
      }

      case "parameter_adjusted": {
        stats.parameterEdits++;
        const updates = action.payload.updates as Record<string, unknown> | undefined;
        if (updates) {
          const dominated = ["width", "thickness", "bevelSize", "grooveCount", "grooveDepth", "profile"];
          const changed = Object.keys(updates).filter((k) => dominated.includes(k));
          if (changed.length > 0) {
            // Only highlight if value actually differs from last known
            const dominated2 = changed.filter((k) => updates[k] !== lastParams[k]);
            if (dominated2.length > 0) {
              const desc = dominated2.map((k) => {
                const v = updates[k];
                if (k === "profile") return `profile → ${v}`;
                if (typeof v === "number") return `${k}: ${v}${k !== "grooveCount" ? "mm" : ""}`;
                return `${k}: ${v}`;
              }).join(", ");
              highlights.push(`Adjusted ${desc}`);
            }
          }
          Object.assign(lastParams, updates);
        }
        break;
      }

      case "stage_changed": {
        stats.stagesChanged++;
        const from = action.payload.from as string;
        const to = action.payload.to as string;
        highlights.push(`Forge stage: ${formatStage(from)} → ${formatStage(to)}`);
        break;
      }

      case "wax_mark_added": {
        waxMarkCount++;
        break;
      }

      case "inlay_added": {
        const mt = (action.payload.materialType as string) ?? "unknown";
        inlayCounts[mt] = (inlayCounts[mt] || 0) + 1;
        break;
      }

      case "lunar_texture_updated": {
        const enabled = action.payload.enabled as boolean;
        if (enabled) {
          const density = action.payload.craterDensity as string;
          const size = action.payload.craterSize as string ?? "";
          const seed = action.payload.seed as number;
          lastLunar = `Lunar texture: ${density}, ${size}, seed ${seed}`;
        } else {
          lastLunar = null;
        }
        break;
      }
    }
  }

  // Wax marks highlight
  if (waxMarkCount > 0) {
    highlights.push(`Wax marks added: ${waxMarkCount}`);
  }

  // Inlay highlights
  const inlayEntries = Object.entries(inlayCounts);
  if (inlayEntries.length > 0) {
    const inlayStr = inlayEntries.map(([t, c]) => `${c} ${t}`).join(", ");
    highlights.push(`Inlays: ${inlayStr}`);
  }

  // Lunar texture highlight
  if (lastLunar) {
    highlights.push(lastLunar);
  }

  // Aggregate tool highlights
  const toolEntries = Object.entries(toolCounts);
  if (toolEntries.length > 0) {
    const toolStr = toolEntries
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${capitalize(t)}${c > 1 ? ` ×${c}` : ""}`)
      .join(", ");
    highlights.unshift(`Tools used: ${toolStr}`);
  }

  // Build stage notes from last known params
  if (lastParams.profile || lastParams.width || lastParams.thickness) {
    const parts: string[] = [];
    if (lastParams.profile) parts.push(`${lastParams.profile}`);
    if (lastParams.width) parts.push(`${lastParams.width}mm wide`);
    if (lastParams.thickness) parts.push(`${lastParams.thickness}mm thick`);
    stageNotes.WAX_SCULPT = [`Wax master shaped: ${parts.join(", ")}`];
  }

  stageNotes.BURNOUT = ["Wax evacuated — cavity ready for metal"];
  stageNotes.MOLD_PREP = ["Investment mold prepared around wax tree"];

  return { highlights: highlights.slice(0, 12), stats, stageNotes };
}

/** Add metal/finish context that the caller knows but actions don't always capture */
export function enrichStageNotes(
  notes: Partial<Record<ForgeStageId, string[]>>,
  metalPreset: string,
  finishPreset: string,
  hasInlays?: boolean,
): Partial<Record<ForgeStageId, string[]>> {
  const enriched = { ...notes };
  enriched.POUR = [...(enriched.POUR ?? []), `Molten ${capitalize(metalPreset)} poured into cavity`];
  enriched.QUENCH = [...(enriched.QUENCH ?? []), "Casting cooled — investment broken away"];
  const finishLines = [`${capitalize(finishPreset)} finish applied`];
  if (hasInlays) finishLines.push("Inlays set and sealed");
  enriched.FINISH = [...(enriched.FINISH ?? []), ...finishLines];
  return enriched;
}

function formatStage(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bWax\b/, "Wax").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}
