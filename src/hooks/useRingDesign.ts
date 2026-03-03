import { useState, useCallback, useRef, useMemo } from "react";
import {
  RingParameters,
  DEFAULT_RING,
  ViewMode,
  MetalPreset,
  FinishPreset,
  ToolType,
  ToolHistoryEntry,
  DesignPackage,
  RING_SIZE_MAP,
} from "@/types/ring";
import { CraftState, CraftAction } from "@/types/craft";
import { WaxMark, WaxMarkType } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { slugFromUrl, findCodexMaterial } from "@/lib/codexMaterials";
import { LunarTextureState, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { evaluateCastability } from "@/lib/castabilityEngine";
import { ForgePipelineState, ForgeStageId } from "@/types/pipeline";
import { STAGES } from "@/config/pipeline";

export interface StampSettings {
  type: WaxMarkType;
  radiusMm: number;
  intensity: number;
}

function craftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useRingDesign() {
  const [params, setParams] = useState<RingParameters>(DEFAULT_RING);
  const [viewMode, setViewMode] = useState<ViewMode>("wax");
  const [metalPreset, setMetalPreset] = useState<MetalPreset>("silver");
  const [finishPreset, setFinishPreset] = useState<FinishPreset>("polished");
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [history, setHistory] = useState<RingParameters[]>([DEFAULT_RING]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [toolHistory, setToolHistory] = useState<ToolHistoryEntry[]>([]);
  const [pipelineState, setPipelineState] = useState<ForgePipelineState>({
    currentStage: "WAX_SCULPT",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [craftActions, setCraftActions] = useState<CraftAction[]>([]);
  const [waxMarks, setWaxMarks] = useState<WaxMark[]>([]);
  const [inlays, setInlays] = useState<InlayChannel[]>([]);
  const [lunarTexture, setLunarTextureRaw] = useState<LunarTextureState>(DEFAULT_LUNAR_TEXTURE);
  const [stampSettings, setStampSettings] = useState<StampSettings>({
    type: "dent",
    radiusMm: 1.2,
    intensity: 0.65,
  });
  const craftStateRef = useRef<{
    baseRingParams: RingParameters;
    createdAt: string;
    updatedAt: string;
  }>({
    baseRingParams: DEFAULT_RING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const logCraftAction = useCallback((type: string, payload: Record<string, unknown>) => {
    const action: CraftAction = { id: craftId(), type, timestamp: Date.now(), payload };
    setCraftActions((prev) => [...prev, action]);
    craftStateRef.current.updatedAt = new Date().toISOString();
  }, []);

  const pushHistory = useCallback(
    (newParams: RingParameters) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newParams);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex]
  );

  const updateParams = useCallback(
    (updates: Partial<RingParameters>) => {
      const newParams = { ...params, ...updates };
      if (updates.size !== undefined) {
        newParams.innerDiameter = RING_SIZE_MAP[updates.size] || params.innerDiameter;
      }
      setParams(newParams);
      pushHistory(newParams);
      craftStateRef.current.baseRingParams = newParams;
      logCraftAction("parameter_adjusted", { updates });
    },
    [params, pushHistory, logCraftAction]
  );

  const applyTemplate = useCallback(
    (updates: Partial<RingParameters>) => {
      const newParams = { ...params, ...updates };
      if (updates.size !== undefined) {
        newParams.innerDiameter = RING_SIZE_MAP[updates.size] || params.innerDiameter;
      }
      setParams(newParams);
      pushHistory(newParams);
      craftStateRef.current.baseRingParams = newParams;
      logCraftAction("template_applied", { updates });
    },
    [params, pushHistory, logCraftAction]
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setParams(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setParams(history[newIndex]);
    }
  }, [history, historyIndex]);

  const applyTool = useCallback(
    (tool: ToolType, toolParams: Record<string, number> = {}) => {
      setToolHistory((prev) => [
        ...prev,
        { tool, timestamp: Date.now(), params: toolParams },
      ]);

      logCraftAction("tool_used", { tool, toolParams });

      switch (tool) {
        case "smooth":
          updateParams({ bevelSize: Math.min(params.bevelSize + 0.1, 1.5) });
          break;
        case "bevel":
          updateParams({ bevelSize: Math.min(params.bevelSize + 0.2, 2.0) });
          break;
        case "groove":
          updateParams({ grooveCount: params.grooveCount + 1 });
          break;
        case "carve":
          updateParams({ thickness: Math.max(params.thickness - 0.2, 1.0) });
          break;
        case "flatten":
          updateParams({ profile: "flat" });
          break;
        case "stamp":
          // stamp tool doesn't modify params; placement is handled in viewport
          break;
        default:
          break;
      }
    },
    [params, updateParams, logCraftAction]
  );

  const setStage = useCallback((id: ForgeStageId) => {
    const stage = STAGES.find((s) => s.id === id);
    if (!stage) return;
    setPipelineState((prev) => {
      logCraftAction("stage_changed", { from: prev.currentStage, to: id });
      return { ...prev, currentStage: id, updatedAt: new Date().toISOString() };
    });
    setViewMode(stage.defaultViewMode);
  }, [setViewMode, logCraftAction]);

  const nextStage = useCallback(() => {
    const idx = STAGES.findIndex((s) => s.id === pipelineState.currentStage);
    if (idx < STAGES.length - 1) setStage(STAGES[idx + 1].id);
  }, [pipelineState.currentStage, setStage]);

  const prevStage = useCallback(() => {
    const idx = STAGES.findIndex((s) => s.id === pipelineState.currentStage);
    if (idx > 0) setStage(STAGES[idx - 1].id);
  }, [pipelineState.currentStage, setStage]);

  const addWaxMark = useCallback((mark: Omit<WaxMark, "id" | "createdAt">) => {
    const newMark: WaxMark = {
      ...mark,
      id: craftId(),
      createdAt: new Date().toISOString(),
    };
    setWaxMarks((prev) => [...prev, newMark]);
    logCraftAction("wax_mark_added", {
      type: mark.type,
      radiusMm: mark.radiusMm,
      intensity: mark.intensity,
    });
  }, [logCraftAction]);

  const clearWaxMarks = useCallback(() => {
    setWaxMarks([]);
    logCraftAction("wax_marks_cleared", {});
  }, [logCraftAction]);

  const setLunarTexture = useCallback((next: LunarTextureState) => {
    setLunarTextureRaw(next);
    logCraftAction("lunar_texture_updated", {
      enabled: next.enabled,
      intensity: next.intensity,
      craterDensity: next.craterDensity,
      craterSize: next.craterSize,
      seed: next.seed,
      microDetail: next.microDetail,
      rimSharpness: next.rimSharpness,
      overlapIntensity: next.overlapIntensity,
    });
  }, [logCraftAction]);

  const applyLunarPreset = useCallback((next: LunarTextureState, presetName: string) => {
    setLunarTextureRaw(next);
    logCraftAction("lunar_preset_applied", {
      presetName,
      seed: next.seed,
      density: next.craterDensity,
      size: next.craterSize,
      intensity: next.intensity,
    });
  }, [logCraftAction]);

  const randomizeLunar = useCallback((next: LunarTextureState) => {
    setLunarTextureRaw(next);
    logCraftAction("lunar_randomized", { seed: next.seed });
  }, [logCraftAction]);

  // --- Inlay helpers ---
  const addInlayChannel = useCallback((input: Omit<InlayChannel, "id" | "createdAt">) => {
    const channel: InlayChannel = {
      ...input,
      id: craftId(),
      createdAt: new Date().toISOString(),
    };
    setInlays((prev) => [...prev, channel]);
    logCraftAction("inlay_added", {
      codexId: input.codexId,
      materialType: input.materialType,
      placement: input.placement,
      width: input.channelWidthMm,
      depth: input.channelDepthMm,
    });
  }, [logCraftAction]);

  const updateInlayChannel = useCallback((id: string, patch: Partial<InlayChannel>) => {
    setInlays((prev) => prev.map((ch) => ch.id === id ? { ...ch, ...patch } : ch));
    logCraftAction("inlay_updated", { id, patchKeys: Object.keys(patch) });
  }, [logCraftAction]);

  const removeInlayChannel = useCallback((id: string) => {
    setInlays((prev) => prev.filter((ch) => ch.id !== id));
    logCraftAction("inlay_removed", { id });
  }, [logCraftAction]);

  const clearInlays = useCallback(() => {
    setInlays([]);
    logCraftAction("inlays_cleared", {});
  }, [logCraftAction]);

  const generateDesignPackage = useCallback((): DesignPackage => {
    const craftState: CraftState = {
      baseRingParams: craftStateRef.current.baseRingParams,
      actionLog: craftActions,
      waxMarks,
      inlays: { channels: inlays },
      lunarTexture,
      createdAt: craftStateRef.current.createdAt,
      updatedAt: craftStateRef.current.updatedAt,
    };
    return {
      id: `WRB-${Date.now().toString(36).toUpperCase()}`,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      parameters: params,
      viewMode,
      metalPreset,
      finishPreset,
      toolHistory,
      previews: [],
      craftState,
      castabilityReport,
      pipelineState,
    };
  }, [params, viewMode, metalPreset, finishPreset, toolHistory, pipelineState, waxMarks, craftActions, inlays, lunarTexture]);

  const castabilityReport = useMemo(() => evaluateCastability(params), [params]);

  const restoreDesign = useCallback((pkg: DesignPackage) => {
    setParams(pkg.parameters);
    setHistory([pkg.parameters]);
    setHistoryIndex(0);
    setViewMode(pkg.viewMode);
    setMetalPreset(pkg.metalPreset);
    setFinishPreset(pkg.finishPreset);
    setToolHistory(pkg.toolHistory);
    setPipelineState(pkg.pipelineState);
    setCraftActions(pkg.craftState.actionLog ?? []);
    setWaxMarks(pkg.craftState.waxMarks ?? []);
    // Backwards-compat: migrate legacy inlays missing codexId
    const rawChannels = pkg.craftState?.inlays?.channels ?? [];
    const migratedChannels = rawChannels.map((ch: any) => {
      if (ch.codexId) return ch as InlayChannel;
      const slug = slugFromUrl(ch.codexUrl ?? "");
      const found = findCodexMaterial(slug);
      return {
        ...ch,
        codexId: found?.id ?? (slug || "legacy"),
        codexUrl: ch.codexUrl ?? "",
        materialImage: found?.image,
        displayName: ch.displayName || found?.name || "Legacy Material",
      } as InlayChannel;
    });
    setInlays(migratedChannels);
    setLunarTextureRaw(pkg.craftState?.lunarTexture ?? { ...DEFAULT_LUNAR_TEXTURE });
    craftStateRef.current = {
      baseRingParams: pkg.parameters,
      createdAt: pkg.craftState.createdAt,
      updatedAt: pkg.craftState.updatedAt,
    };
  }, []);

  return {
    craftActions,
    castabilityReport,
    params,
    updateParams,
    applyTemplate,
    viewMode,
    setViewMode,
    metalPreset,
    setMetalPreset,
    finishPreset,
    setFinishPreset,
    activeTool,
    setActiveTool,
    applyTool,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    generateDesignPackage,
    toolHistory,
    pipelineState,
    setStage,
    nextStage,
    prevStage,
    restoreDesign,
    waxMarks,
    addWaxMark,
    clearWaxMarks,
    stampSettings,
    setStampSettings,
    inlays,
    addInlayChannel,
    updateInlayChannel,
    removeInlayChannel,
    clearInlays,
    lunarTexture,
    setLunarTexture,
    applyLunarPreset,
    randomizeLunar,
  };
}
