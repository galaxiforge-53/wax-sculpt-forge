import { useState, useCallback } from "react";
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

export function useRingDesign() {
  const [params, setParams] = useState<RingParameters>(DEFAULT_RING);
  const [viewMode, setViewMode] = useState<ViewMode>("wax");
  const [metalPreset, setMetalPreset] = useState<MetalPreset>("silver");
  const [finishPreset, setFinishPreset] = useState<FinishPreset>("polished");
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [history, setHistory] = useState<RingParameters[]>([DEFAULT_RING]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [toolHistory, setToolHistory] = useState<ToolHistoryEntry[]>([]);

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
      // Sync inner diameter with size
      if (updates.size !== undefined) {
        newParams.innerDiameter = RING_SIZE_MAP[updates.size] || params.innerDiameter;
      }
      setParams(newParams);
      pushHistory(newParams);
    },
    [params, pushHistory]
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
        default:
          break;
      }
    },
    [params, updateParams]
  );

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
    };
  }, [params, viewMode, metalPreset, finishPreset, toolHistory]);

  return {
    params,
    updateParams,
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
  };
}
