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
import { WaxMark } from "@/types/waxmarks";
import { evaluateCastability } from "@/lib/castabilityEngine";
import { ForgePipelineState, ForgeStageId } from "@/types/pipeline";
import { STAGES } from "@/config/pipeline";

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
  const craftStateRef = useRef<CraftState>({
    baseRingParams: DEFAULT_RING,
    actionLog: [],
    waxMarks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [waxMarks, setWaxMarks] = useState<WaxMark[]>([]);

  const logCraftAction = useCallback((type: string, payload: Record<string, unknown>) => {
    const action: CraftAction = { id: craftId(), type, timestamp: Date.now(), payload };
    craftStateRef.current = {
      ...craftStateRef.current,
      actionLog: [...craftStateRef.current.actionLog, action],
      updatedAt: new Date().toISOString(),
    };
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
    setWaxMarks((prev) => {
      const updated = [...prev, newMark];
      craftStateRef.current.waxMarks = updated;
      return updated;
    });
    logCraftAction("wax_mark_added", {
      type: mark.type,
      radiusMm: mark.radiusMm,
      intensity: mark.intensity,
    });
  }, [logCraftAction]);

  const clearWaxMarks = useCallback(() => {
    setWaxMarks([]);
    craftStateRef.current.waxMarks = [];
    logCraftAction("wax_marks_cleared", {});
  }, [logCraftAction]);

  const generateDesignPackage = useCallback((): DesignPackage => {
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
      craftState: { ...craftStateRef.current, waxMarks },
      castabilityReport,
      pipelineState,
    };
  }, [params, viewMode, metalPreset, finishPreset, toolHistory, pipelineState, waxMarks]);

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
    craftStateRef.current = pkg.craftState;
    setWaxMarks(pkg.craftState.waxMarks ?? []);
  }, []);

  return {
    craftState: craftStateRef.current,
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
  };
}
