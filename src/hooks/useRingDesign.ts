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
import { EngravingState, DEFAULT_ENGRAVING } from "@/types/engraving";
import { ImageTerrainState, DEFAULT_IMAGE_TERRAIN } from "@/types/imageTerrain";
import { evaluateCastability } from "@/lib/castabilityEngine";
import { ForgePipelineState, ForgeStageId } from "@/types/pipeline";
import { STAGES } from "@/config/pipeline";
import { computeEnhancements, EnhancementResult } from "@/lib/designEnhancer";
import { analyzeSurfaceBalance, computeAutoBalance, BalanceAnalysis } from "@/lib/surfaceBalancer";

export interface StampSettings {
  type: WaxMarkType;
  radiusMm: number;
  intensity: number;
}

function craftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Clamp ring parameters to safe ranges to prevent geometry errors.
 */
function clampParams(p: RingParameters): RingParameters {
  return {
    ...p,
    size: Math.max(3, Math.min(16, p.size)),
    innerDiameter: Math.max(14.0, Math.min(24.6, p.innerDiameter)),
    width: Math.max(1, Math.min(20, p.width)),
    thickness: Math.max(0.5, Math.min(8, p.thickness)),
    grooveCount: Math.max(0, Math.min(12, Math.floor(p.grooveCount))),
    grooveDepth: Math.max(0, Math.min(2, p.grooveDepth)),
    bevelSize: Math.max(0, Math.min(3, p.bevelSize)),
    interiorCurvature: Math.max(0, Math.min(100, p.interiorCurvature ?? 40)),
    comfortFitDepth: Math.max(0, Math.min(100, p.comfortFitDepth ?? 50)),
  };
}

export function useRingDesign() {
  const [params, setParams] = useState<RingParameters>(DEFAULT_RING);
  const [viewMode, setViewMode] = useState<ViewMode>("wax");
  const [metalPreset, setMetalPreset] = useState<MetalPreset>("silver");
  const [finishPreset, setFinishPreset] = useState<FinishPreset>("polished");
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
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
  const [engraving, setEngravingRaw] = useState<EngravingState>(DEFAULT_ENGRAVING);
  const [imageTerrain, setImageTerrainRaw] = useState<ImageTerrainState>(DEFAULT_IMAGE_TERRAIN);
  const [stampSettings, setStampSettings] = useState<StampSettings>({
    type: "dent",
    radiusMm: 1.2,
    intensity: 0.65,
  });

  // ── History via refs to prevent stale closures ──
  const historyRef = useRef<RingParameters[]>([DEFAULT_RING]);
  const historyIndexRef = useRef(0);
  // Trigger re-renders for undo/redo button state
  const [historyVersion, setHistoryVersion] = useState(0);

  const craftStateRef = useRef<{
    baseRingParams: RingParameters;
    createdAt: string;
    updatedAt: string;
  }>({
    baseRingParams: DEFAULT_RING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Throttle craft action logging to prevent unbounded array growth
  const lastActionTimeRef = useRef(0);
  const logCraftAction = useCallback((type: string, payload: Record<string, unknown>) => {
    const now = Date.now();
    // Throttle to at most one action per 200ms for the same type
    if (now - lastActionTimeRef.current < 200) return;
    lastActionTimeRef.current = now;
    const action: CraftAction = { id: craftId(), type, timestamp: now, payload };
    setCraftActions((prev) => {
      const next = [...prev, action];
      // Keep only last 60 actions to bound memory
      return next.length > 60 ? next.slice(-60) : next;
    });
    craftStateRef.current.updatedAt = new Date().toISOString();
  }, []);

  const pushHistory = useCallback(
    (newParams: RingParameters) => {
      const history = historyRef.current;
      const idx = historyIndexRef.current;

      // Skip duplicate entries to avoid polluting history with identical snapshots
      const last = history[idx];
      if (last && JSON.stringify(last) === JSON.stringify(newParams)) return;

      const newHistory = history.slice(0, idx + 1);
      newHistory.push(newParams);
      // Cap history to 60 entries to reduce memory footprint
      if (newHistory.length > 60) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      setHistoryVersion((v) => v + 1);
    },
    []
  );

  const updateParams = useCallback(
    (updates: Partial<RingParameters>) => {
      setParams((prev) => {
        const merged = { ...prev, ...updates };
        if (updates.size !== undefined) {
          merged.innerDiameter = RING_SIZE_MAP[updates.size] || prev.innerDiameter;
        }
        const clamped = clampParams(merged);
        pushHistory(clamped);
        craftStateRef.current.baseRingParams = clamped;
        logCraftAction("parameter_adjusted", { updates });
        return clamped;
      });
    },
    [pushHistory, logCraftAction]
  );

  const applyTemplate = useCallback(
    (updates: Partial<RingParameters>) => {
      setParams((prev) => {
        const merged = { ...prev, ...updates };
        if (updates.size !== undefined) {
          merged.innerDiameter = RING_SIZE_MAP[updates.size] || prev.innerDiameter;
        }
        const clamped = clampParams(merged);
        pushHistory(clamped);
        craftStateRef.current.baseRingParams = clamped;
        logCraftAction("template_applied", { updates });
        return clamped;
      });
    },
    [pushHistory, logCraftAction]
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx > 0) {
      const newIndex = idx - 1;
      historyIndexRef.current = newIndex;
      setParams(historyRef.current[newIndex]);
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    const history = historyRef.current;
    if (idx < history.length - 1) {
      const newIndex = idx + 1;
      historyIndexRef.current = newIndex;
      setParams(history[newIndex]);
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  const applyTool = useCallback(
    (tool: ToolType, toolParams: Record<string, number> = {}) => {
      setToolHistory((prev) => [
        ...prev,
        { tool, timestamp: Date.now(), params: toolParams },
      ]);

      logCraftAction("tool_used", { tool, toolParams });

      switch (tool) {
        case "smooth":
          updateParams({ bevelSize: Math.min((historyRef.current[historyIndexRef.current]?.bevelSize ?? 0.3) + 0.1, 1.5) });
          break;
        case "bevel":
          updateParams({ bevelSize: Math.min((historyRef.current[historyIndexRef.current]?.bevelSize ?? 0.3) + 0.2, 2.0) });
          break;
        case "groove":
          updateParams({ grooveCount: (historyRef.current[historyIndexRef.current]?.grooveCount ?? 0) + 1 });
          break;
        case "carve":
          updateParams({ thickness: Math.max((historyRef.current[historyIndexRef.current]?.thickness ?? 2) - 0.2, 1.0) });
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
    [updateParams, logCraftAction]
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

  // Throttle craft action logging for lunar updates to avoid excessive array growth
  const lastLunarLogRef = useRef(0);
  const setLunarTexture = useCallback((next: LunarTextureState) => {
    setLunarTextureRaw(next);
    // Only log craft action at most every 500ms during rapid slider changes
    const now = Date.now();
    if (now - lastLunarLogRef.current > 500) {
      lastLunarLogRef.current = now;
      logCraftAction("lunar_texture_updated", {
        enabled: next.enabled,
        intensity: next.intensity,
        craterDensity: next.craterDensity,
        craterSize: next.craterSize,
        seed: next.seed,
      });
    }
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

  const setEngraving = useCallback((next: EngravingState) => {
    setEngravingRaw(next);
    logCraftAction("engraving_updated", { text: next.text, font: next.font, sizeMm: next.sizeMm, depthMm: next.depthMm });
  }, [logCraftAction]);

  const setImageTerrain = useCallback((next: ImageTerrainState) => {
    setImageTerrainRaw(next);
    logCraftAction("image_terrain_updated", { enabled: next.enabled, mode: next.mode, depth: next.depth });
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
      engraving,
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
  }, [params, viewMode, metalPreset, finishPreset, toolHistory, pipelineState, waxMarks, craftActions, inlays, lunarTexture, engraving]);

  const castabilityReport = useMemo(() => evaluateCastability(params, lunarTexture, engraving, inlays), [params, lunarTexture, engraving, inlays]);

  const balanceAnalysis = useMemo(() => analyzeSurfaceBalance(params, lunarTexture, engraving, waxMarks, inlays), [params, lunarTexture, engraving, waxMarks, inlays]);

  const autoBalance = useCallback(() => {
    const currentParams = historyRef.current[historyIndexRef.current] ?? params;
    const result = computeAutoBalance(currentParams, lunarTexture, engraving, waxMarks, inlays);

    if (Object.keys(result.paramsPatch).length > 0) {
      const merged = { ...currentParams, ...result.paramsPatch };
      if (result.paramsPatch.size !== undefined) {
        merged.innerDiameter = RING_SIZE_MAP[result.paramsPatch.size] || currentParams.innerDiameter;
      }
      const clamped = clampParams(merged);
      setParams(clamped);
      pushHistory(clamped);
      craftStateRef.current.baseRingParams = clamped;
    }
    if (result.lunarPatch) {
      setLunarTextureRaw((prev) => ({ ...prev, ...result.lunarPatch! }));
    }
    if (result.engravingPatch) {
      setEngravingRaw((prev) => ({ ...prev, ...result.engravingPatch! }));
    }

    logCraftAction("surface_auto_balanced", {
      score: result.analysis.score,
      fixCount: result.analysis.fixes.length,
      issues: result.analysis.issues.map((i) => i.id),
    });

    return result.analysis;
  }, [params, lunarTexture, engraving, waxMarks, inlays, pushHistory, logCraftAction]);

  const restoreDesign = useCallback((pkg: DesignPackage) => {
    const clamped = clampParams(pkg.parameters);
    setParams(clamped);
    historyRef.current = [clamped];
    historyIndexRef.current = 0;
    setHistoryVersion((v) => v + 1);
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
    // Backward-compat: merge saved lunar state with defaults so new fields get values
    const savedLunar = pkg.craftState?.lunarTexture;
    setLunarTextureRaw(savedLunar ? { ...DEFAULT_LUNAR_TEXTURE, ...savedLunar } : { ...DEFAULT_LUNAR_TEXTURE });
    const savedEngraving = pkg.craftState?.engraving;
    setEngravingRaw(savedEngraving ? { ...DEFAULT_ENGRAVING, ...savedEngraving } : { ...DEFAULT_ENGRAVING });
    craftStateRef.current = {
      baseRingParams: clamped,
      createdAt: pkg.craftState.createdAt,
      updatedAt: pkg.craftState.updatedAt,
    };
  }, []);

  const enhanceDesign = useCallback((): EnhancementResult => {
    const currentParams = historyRef.current[historyIndexRef.current] ?? params;
    const result = computeEnhancements(currentParams, lunarTexture, engraving);

    // Apply parameter changes
    if (Object.keys(result.params).length > 0) {
      const merged = { ...currentParams, ...result.params };
      if (result.params.size !== undefined) {
        merged.innerDiameter = RING_SIZE_MAP[result.params.size] || currentParams.innerDiameter;
      }
      const clamped = clampParams(merged);
      setParams(clamped);
      pushHistory(clamped);
      craftStateRef.current.baseRingParams = clamped;
    }

    // Apply lunar changes
    if (result.lunar) {
      setLunarTextureRaw((prev) => ({ ...prev, ...result.lunar! }));
    }

    // Apply engraving changes
    if (result.engraving) {
      setEngravingRaw((prev) => ({ ...prev, ...result.engraving! }));
    }

    logCraftAction("design_enhanced", {
      changes: result.summary,
      paramKeys: Object.keys(result.params),
    });

    return result;
  }, [params, lunarTexture, engraving, pushHistory, logCraftAction]);

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
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
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
    engraving,
    setEngraving,
    enhanceDesign,
    balanceAnalysis,
    autoBalance,
    // expose for re-render on history changes
    _historyVersion: historyVersion,
  };
}
