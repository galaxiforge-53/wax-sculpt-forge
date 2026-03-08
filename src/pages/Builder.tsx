import { useNavigate } from "react-router-dom";
import { useRingDesign } from "@/hooks/useRingDesign";
import { useEffect, useRef, useState } from "react";
import RingViewport, { RingViewportHandle, SnapshotAngle, CutawayMode } from "@/components/builder/RingViewport";
import { ScaleReferenceType } from "@/components/builder/ScaleReference";
import ViewportErrorBoundary from "@/components/builder/ViewportErrorBoundary";
import ToolRail from "@/components/builder/ToolRail";
import BuilderSidebar from "@/components/builder/BuilderSidebar";
import TopBar from "@/components/builder/TopBar";
import ForgeCinematicModal from "@/components/forge/ForgeCinematicModal";
import GuidedWorkflow from "@/components/builder/GuidedWorkflow";
import AccessGate from "@/components/access/AccessGate";
import { isEmbedMode } from "@/config/galaxiforge";
import { getTemplate } from "@/config/templates";
import { DesignPreview, ViewMode } from "@/types/ring";
import { getProject, saveProject } from "@/lib/projectsStore";
import { saveCloudDesign, getCloudDesign } from "@/lib/cloudDesignsStore";
import { createShareLink } from "@/lib/shareStore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings2, Eye, RotateCcw, Wand2, Camera, Sparkles, RotateCw, Move, RefreshCw, Printer, Search, ZoomIn, Lock, Unlock, Ruler, Circle, Hand } from "lucide-react";
import InspectionLoupe from "@/components/builder/InspectionLoupe";
import MobileBuilderPanel from "@/components/builder/MobileBuilderPanel";
import AIGenerateOverlay from "@/components/builder/AIGenerateOverlay";
import RenderGalleryModal from "@/components/builder/RenderGalleryModal";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import { LightingSettings, DEFAULT_LIGHTING } from "@/types/lighting";

function BuilderInner() {
  const navigate = useNavigate();
  const viewportRef = useRef<RingViewportHandle>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [forgeModalOpen, setForgeModalOpen] = useState(false);
  const [livePreviews, setLivePreviews] = useState<DesignPreview[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<SnapshotAngle | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [cutawayMode, setCutawayMode] = useState<CutawayMode>("normal");
  const [cutawayOffset, setCutawayOffset] = useState(0);
  const [lighting, setLighting] = useState<LightingSettings>(DEFAULT_LIGHTING);
  const [showcaseMode, setShowcaseMode] = useState(false);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [ringPosition, setRingPosition] = useState<[number, number, number]>([0, 0, 0]);
  const [ringRotation, setRingRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [showPrinterBed, setShowPrinterBed] = useState(false);
  const [rotationLocked, setRotationLocked] = useState(false);
  const [scaleReference, setScaleReference] = useState<ScaleReferenceType>("none");
  const [renderGalleryOpen, setRenderGalleryOpen] = useState(false);
  const [loupeActive, setLoupeActive] = useState(false);
  const [loupeZoom, setLoupeZoom] = useState(3);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const [guidedMode, setGuidedMode] = useState(() => {
    // Show guided mode for new users (no prior project or template)
    const hasTemplate = !!sessionStorage.getItem("applyTemplate");
    const hasProject = !!sessionStorage.getItem("openProjectId");
    return !hasTemplate && !hasProject;
  });

  const CAMERA_BUTTONS: { id: SnapshotAngle; label: string }[] = [
    { id: "front", label: "Front" },
    { id: "angle", label: "45°" },
    { id: "side", label: "Side" },
    { id: "inside", label: "Inside" },
  ];

  const {
    params, updateParams, applyTemplate,
    viewMode, setViewMode,
    metalPreset, setMetalPreset,
    finishPreset, setFinishPreset,
    activeTool, setActiveTool, applyTool,
    undo, redo, canUndo, canRedo,
    generateDesignPackage,
    castabilityReport,
    pipelineState, setStage, nextStage, prevStage,
    restoreDesign, craftActions,
    waxMarks, addWaxMark, clearWaxMarks,
    stampSettings, setStampSettings,
    inlays, addInlayChannel, removeInlayChannel, clearInlays,
    lunarTexture, setLunarTexture, applyLunarPreset, randomizeLunar,
    engraving, setEngraving,
    enhanceDesign,
    balanceAnalysis,
    autoBalance,
  } = useRingDesign();

  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = () => {
    setIsEnhancing(true);
    // Small delay so UI shows "Enhancing…" state
    setTimeout(() => {
      const result = enhanceDesign();
      setIsEnhancing(false);
      toast({
        title: "✨ Design Enhanced",
        description: result.summary.slice(0, 3).join(" · "),
      });
    }, 400);
  };

  const embed = isEmbedMode();

  // Load template or saved project on mount
  useEffect(() => {
    const templateId = sessionStorage.getItem("applyTemplate");
    if (templateId) {
      sessionStorage.removeItem("applyTemplate");
      const t = getTemplate(templateId);
      if (t) {
        applyTemplate(t.params);
        if (t.lunar) {
          setLunarTexture({ ...lunarTexture, seed: Math.floor(Math.random() * 9999), ...t.lunar });
        }
        if (t.metalPreset) setMetalPreset(t.metalPreset);
        if (t.finishPreset) setFinishPreset(t.finishPreset);
        if (t.engraving) {
          setEngraving({ ...engraving, ...t.engraving });
        }
      }
      return;
    }

    // Cloud design
    const cloudId = sessionStorage.getItem("openCloudDesignId");
    if (cloudId) {
      sessionStorage.removeItem("openCloudDesignId");
      getCloudDesign(cloudId).then((design) => {
        if (design) {
          restoreDesign(design.design_package);
          setCurrentProjectId(design.id);
          setCurrentProjectName(design.name);
        }
      });
      return;
    }

    // Local design
    const projectId = sessionStorage.getItem("openProjectId");
    if (projectId) {
      sessionStorage.removeItem("openProjectId");
      const project = getProject(projectId);
      if (project) {
        restoreDesign(project.designPackage);
        setCurrentProjectId(project.id);
        setCurrentProjectName(project.name);
      }
      return;
    }

    // Shared design via link
    const sharedPkg = sessionStorage.getItem("sharedDesignPackage");
    if (sharedPkg) {
      const sharedName = sessionStorage.getItem("sharedDesignName");
      sessionStorage.removeItem("sharedDesignPackage");
      sessionStorage.removeItem("sharedDesignName");
      try {
        restoreDesign(JSON.parse(sharedPkg));
        setCurrentProjectName(sharedName || "Shared Design");
        toast({ title: "Shared Design Loaded", description: `"${sharedName}" is ready to customize.` });
      } catch (e) {
        console.error("Failed to load shared design:", e);
      }
    }
  }, []);

  const capturePreviewsAsync = async (captureMode: ViewMode): Promise<DesignPreview[]> => {
    if (!viewportRef.current) return [];
    const angles: SnapshotAngle[] = ["angle", "side", "inside"];
    const labels: Record<SnapshotAngle, string> = {
      front: "Front View", angle: "Hero 45°", side: "Side Profile", inside: "Inside View",
    };
    try {
      const results = await Promise.all(
        angles.map(async (id) => {
          const dataUrl = await viewportRef.current!.captureSnapshot(id, captureMode);
          return { id: id as DesignPreview["id"], label: labels[id], viewMode: captureMode, dataUrl } as DesignPreview;
        })
      );
      return results.filter((p) => p.dataUrl.length > 100);
    } catch {
      return [];
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const castStages = ["POUR", "QUENCH", "FINISH"];
      const captureMode: ViewMode = castStages.includes(pipelineState.currentStage) ? "cast" : viewMode;
      const previews = await capturePreviewsAsync(captureMode);
      const pkg = generateDesignPackage();
      pkg.previews = previews;

      let name = currentProjectName;
      let id = currentProjectId;

      if (!id) {
        const input = window.prompt("Name your design:", "My Ring Design");
        if (!input) { setIsSaving(false); return; }
        name = input;
      }

      const anglePrev = previews.find((p) => p.id === "angle");
      const thumbnail = anglePrev?.dataUrl ?? previews[0]?.dataUrl;

      // Save to cloud if authenticated
      if (user) {
        const isExistingCloud = id && !id.startsWith("PRJ-");
        const saved = await saveCloudDesign(
          { name: name!, design_package: pkg, thumbnail },
          isExistingCloud ? id! : undefined,
        );
        setCurrentProjectId(saved.id);
        setCurrentProjectName(saved.name);
        toast({ title: "Saved to Cloud ☁️", description: `"${name}" synced.` });
      } else {
        // Fallback to local storage
        if (!id) id = `PRJ-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date().toISOString();
        saveProject({
          id: id!, name: name!,
          createdAt: currentProjectId ? (getProject(currentProjectId)?.createdAt ?? now) : now,
          updatedAt: now, designPackage: pkg, thumbnail,
        });
        setCurrentProjectId(id!);
        setCurrentProjectName(name!);
        toast({ title: "Saved Locally", description: `"${name}" saved. Sign in to sync to cloud.` });
      }
    } catch (err: any) {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    const castStages = ["POUR", "QUENCH", "FINISH"];
    const captureMode: ViewMode = castStages.includes(pipelineState.currentStage) ? "cast" : viewMode;
    const previews = await capturePreviewsAsync(captureMode);
    const pkg = generateDesignPackage();
    pkg.previews = previews;
    sessionStorage.setItem("designPackage", JSON.stringify(pkg));
    navigate("/export" + (embed ? "?embed=1" : ""));
  };

  const handleForgeNow = async () => {
    const castStages = ["POUR", "QUENCH", "FINISH"];
    const captureMode: ViewMode = castStages.includes(pipelineState.currentStage) ? "cast" : viewMode;
    const previews = await capturePreviewsAsync(captureMode);
    setLivePreviews(previews);
    setForgeModalOpen(true);
  };

  const handleShare = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to share designs.", variant: "destructive" });
      return;
    }
    setIsSharing(true);
    try {
      const castStages = ["POUR", "QUENCH", "FINISH"];
      const captureMode: ViewMode = castStages.includes(pipelineState.currentStage) ? "cast" : viewMode;
      const previews = await capturePreviewsAsync(captureMode);
      const pkg = generateDesignPackage();
      pkg.previews = previews;
      const anglePrev = previews.find((p) => p.id === "angle");
      const thumbnail = anglePrev?.dataUrl ?? previews[0]?.dataUrl ?? null;
      const name = currentProjectName || "Shared Ring Design";

      const { shareUrl } = await createShareLink(user.id, name, pkg, thumbnail);

      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Share Link Copied! 🔗",
        description: "Anyone with this link can view and customize your design.",
      });
    } catch (err: any) {
      console.error("Share error:", err);
      toast({ title: "Share Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const guidedContent = (
    <GuidedWorkflow
      params={params}
      onUpdate={updateParams}
      lunarTexture={lunarTexture}
      onLunarChange={setLunarTexture}
      engraving={engraving}
      onEngravingChange={setEngraving}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      metalPreset={metalPreset}
      onMetalChange={setMetalPreset}
      finishPreset={finishPreset}
      onFinishChange={setFinishPreset}
      castabilityReport={castabilityReport}
      onSave={handleSave}
      onExitGuided={() => setGuidedMode(false)}
    />
  );

  const sidebarContent = (
    <BuilderSidebar
      params={params}
      onUpdate={updateParams}
      activeTool={activeTool}
      viewMode={viewMode}
      waxMarks={waxMarks}
      onClearWaxMarks={clearWaxMarks}
      stampSettings={stampSettings}
      onStampSettingsChange={setStampSettings}
      castabilityReport={castabilityReport}
      pipelineState={pipelineState}
      onNext={nextStage}
      onPrev={prevStage}
      inlays={inlays}
      onAddInlay={addInlayChannel}
      onRemoveInlay={removeInlayChannel}
      onClearInlays={clearInlays}
      lunarTexture={lunarTexture}
      onLunarChange={setLunarTexture}
      onApplyLunarPreset={applyLunarPreset}
      onRandomizeLunar={randomizeLunar}
      onApplyTemplate={applyTemplate}
      engraving={engraving}
      onEngravingChange={setEngraving}
      metalPreset={metalPreset}
      finishPreset={finishPreset}
      onViewModeChange={setViewMode}
      onMetalChange={setMetalPreset}
      onFinishChange={setFinishPreset}
      lighting={lighting}
      onLightingChange={setLighting}
      balanceAnalysis={balanceAnalysis}
      onAutoBalance={autoBalance}
    />
  );

  const panelContent = guidedMode ? guidedContent : sidebarContent;

  return (
    <div className="h-screen flex flex-col bg-forge-dark overflow-hidden">
      <SEOHead title="Ring Builder" description="Design your custom ring in 3D. Sculpt, preview metals, and export for casting." />
      <TopBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        metalPreset={metalPreset}
        onMetalChange={setMetalPreset}
        finishPreset={finishPreset}
        onFinishChange={setFinishPreset}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={handleExport}
        onSave={handleSave}
        isSaving={isSaving}
        onForgeNow={handleForgeNow}
        onEnhance={handleEnhance}
        isEnhancing={isEnhancing}
        onShare={handleShare}
        isSharing={isSharing}
      />

      <div className="flex flex-1 min-h-0 relative">
        {/* Tool rail - compact on mobile */}
        {!isMobile && (
          <div className="w-16 p-1.5 builder-rail flex-shrink-0">
            <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} onApplyTool={applyTool} />
          </div>
        )}

        {/* Viewport */}
        <div ref={viewportContainerRef} className="flex-1 p-0 sm:p-1 relative builder-viewport-bg">
          <ViewportErrorBoundary>
            <RingViewport
              ref={viewportRef}
              params={params}
              viewMode={viewMode}
              metalPreset={metalPreset}
              finishPreset={finishPreset}
              activeTool={activeTool}
              onAddWaxMark={addWaxMark}
              waxMarks={waxMarks}
              stampSettings={stampSettings}
              inlays={inlays}
              lunarTexture={lunarTexture}
              engraving={engraving}
              cameraPreset={cameraPreset}
              onPresetApplied={() => setCameraPreset(null)}
              showMeasurements={showMeasurements || activeTool === "measure"}
              cutawayMode={cutawayMode}
              cutawayOffset={cutawayOffset}
              lighting={lighting}
              showcaseMode={showcaseMode}
              inspectionMode={inspectionMode}
              ringPosition={ringPosition}
              ringRotation={ringRotation}
              showPrinterBed={showPrinterBed}
              rotationLocked={rotationLocked}
              scaleReference={scaleReference}
            />
          </ViewportErrorBoundary>

          {/* Magnified inspection loupe */}
          <InspectionLoupe
            containerRef={viewportContainerRef}
            active={loupeActive}
            zoom={loupeZoom}
            onZoomChange={setLoupeZoom}
          />

          {/* Camera presets — top-left */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {CAMERA_BUTTONS.map((cam) => (
              <button
                key={cam.id}
                onClick={() => setCameraPreset(cam.id)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md backdrop-blur-xl transition-all
                  ${cameraPreset === cam.id
                    ? "bg-primary/20 text-primary border border-primary/30 shadow-sm shadow-primary/10"
                    : "bg-card/60 text-muted-foreground border border-builder-divider hover:bg-card/80 hover:text-foreground"
                  }`}
              >
                {cam.label}
              </button>
            ))}
            {!isMobile && (
              <AIGenerateOverlay
                params={params}
                lunarTexture={lunarTexture}
                viewMode={viewMode}
                metalPreset={metalPreset}
                finishPreset={finishPreset}
                onUpdateParams={updateParams}
                onLunarChange={setLunarTexture}
                onViewModeChange={setViewMode}
                onMetalChange={setMetalPreset}
                onFinishChange={setFinishPreset}
              />
            )}
          </div>

          {/* View controls — top-right, grouped (simplified on mobile) */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-end">
            {/* Cutaway row */}
            <div className="flex gap-1">
              {(["normal", "inside", "cross-section", "quarter-cut"] as CutawayMode[]).map((mode) => {
                const labels: Record<CutawayMode, string> = { normal: "Full", inside: "Inside", "cross-section": "X-Section", "quarter-cut": "¼ Cut" };
                const icons: Record<CutawayMode, string> = { normal: "◉", inside: "◔", "cross-section": "◑", "quarter-cut": "◕" };
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setCutawayMode(mode);
                      setCutawayOffset(0);
                    }}
                    className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all
                      ${cutawayMode === mode
                        ? "bg-primary/30 text-primary border border-primary/40"
                        : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                      }`}
                    title={labels[mode]}
                  >
                    {isMobile ? icons[mode] : labels[mode]}
                  </button>
                );
              })}
            </div>
            {/* Clip offset slider — shown when a cutaway mode is active */}
            {cutawayMode !== "normal" && (
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-md px-2.5 py-1.5">
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">Clip</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={cutawayOffset * 100}
                  onChange={(e) => setCutawayOffset(Number(e.target.value) / 100)}
                  className="w-20 h-1 accent-primary cursor-pointer"
                />
                <button
                  onClick={() => setCutawayOffset(0)}
                  className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Reset clip position"
                >
                  ↺
                </button>
              </div>
            )}
            {/* Tools row — icon-only, compact */}
            <div className="flex gap-1">
              {!isMobile && (
                <button
                  onClick={() => setShowMeasurements((v) => !v)}
                  className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all
                    ${showMeasurements || activeTool === "measure"
                      ? "bg-primary/30 text-primary border border-primary/40"
                      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                    }`}
                  title="Toggle dimension guides"
                >
                  📐
                </button>
              )}
              <button
                onClick={() => setShowcaseMode((v) => !v)}
                className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1
                  ${showcaseMode
                    ? "bg-primary/30 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                    : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                  }`}
                title="High-quality showcase render"
              >
                <Sparkles className="w-3 h-3" />
              </button>
              {!isMobile && (
                <>
                  <button
                    onClick={() => setInspectionMode((v) => !v)}
                    className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1
                      ${inspectionMode
                        ? "bg-primary/30 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                        : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                      }`}
                    title="Inspection mode"
                  >
                    <Search className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setLoupeActive((v) => !v)}
                    className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1
                      ${loupeActive
                        ? "bg-primary/30 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                        : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                      }`}
                    title="Magnifier loupe — scroll to zoom"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setShowPrinterBed((v) => !v);
                      if (!showPrinterBed) setRingRotation([Math.PI / 2, 0, 0]);
                    }}
                    className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1
                      ${showPrinterBed
                        ? "bg-primary/30 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                        : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                      }`}
                    title="Print bed"
                  >
                    <Printer className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setRotationLocked((v) => !v)}
                    className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1
                      ${rotationLocked
                        ? "bg-warning/30 text-warning border border-warning/40 shadow-[0_0_8px_hsl(var(--warning)/0.3)]"
                        : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                      }`}
                    title={rotationLocked ? "Unlock rotation" : "Lock rotation to inspect area"}
                  >
                    {rotationLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => setRenderGalleryOpen(true)}
                    className="px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1
                      bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                    title="Generate beauty renders"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* XYZ Position & Rotation controls — bottom-right overlay (desktop) */}
          {!isMobile && (
            <div className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-xl border border-builder-divider rounded-xl p-2.5 space-y-2 min-w-[180px] shadow-lg shadow-black/30">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-display flex items-center gap-1">
                  <Move className="w-3 h-3" /> Transform
                </span>
                <button
                  onClick={() => { setRingPosition([0, 0, 0]); setRingRotation([0, 0, 0]); }}
                  className="text-[9px] text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
                  title="Reset position and rotation"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Reset
                </button>
              </div>

              {/* Position */}
              <div className="space-y-1">
                <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest">Position</span>
                <div className="flex gap-1">
                  {(["X", "Y", "Z"] as const).map((axis, idx) => (
                    <div key={axis} className="flex-1">
                      <label className={`text-[8px] font-mono font-bold ${idx === 0 ? "text-red-400" : idx === 1 ? "text-emerald-400" : "text-blue-400"}`}>{axis}</label>
                      <input
                        type="number"
                        step="0.05"
                        value={ringPosition[idx].toFixed(2)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          const next: [number, number, number] = [...ringPosition];
                          next[idx] = v;
                          setRingPosition(next);
                        }}
                        className="w-full h-5 px-1 text-[9px] font-mono bg-secondary/50 border border-border/30 rounded text-foreground text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Rotation */}
              <div className="space-y-1">
                <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest">Rotation °</span>
                <div className="flex gap-1">
                  {(["X", "Y", "Z"] as const).map((axis, idx) => (
                    <div key={axis} className="flex-1">
                      <label className={`text-[8px] font-mono font-bold ${idx === 0 ? "text-red-400" : idx === 1 ? "text-emerald-400" : "text-blue-400"}`}>{axis}</label>
                      <input
                        type="number"
                        step="5"
                        value={Math.round(ringRotation[idx] * 180 / Math.PI)}
                        onChange={(e) => {
                          const deg = parseFloat(e.target.value) || 0;
                          const next: [number, number, number] = [...ringRotation];
                          next[idx] = deg * Math.PI / 180;
                          setRingRotation(next);
                        }}
                        className="w-full h-5 px-1 text-[9px] font-mono bg-secondary/50 border border-border/30 rounded text-foreground text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick rotation presets */}
              <div className="flex gap-1">
                <button
                  onClick={() => setRingRotation([Math.PI / 2, 0, 0])}
                  className="flex-1 px-1.5 py-1 text-[8px] rounded bg-secondary/40 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                >
                  Flat
                </button>
                <button
                  onClick={() => setRingRotation([0, 0, 0])}
                  className="flex-1 px-1.5 py-1 text-[8px] rounded bg-secondary/40 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                >
                  Upright
                </button>
                <button
                  onClick={() => setRingRotation([Math.PI / 4, Math.PI / 6, 0])}
                  className="flex-1 px-1.5 py-1 text-[8px] rounded bg-secondary/40 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                >
                  Tilted
                </button>
                <button
                  onClick={() => setRingRotation([0, 0, Math.PI / 2])}
                  className="flex-1 px-1.5 py-1 text-[8px] rounded bg-secondary/40 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                >
                  Side
                </button>
              </div>
            </div>
          )}

          {isMobile && (
            <MobileBuilderPanel
              params={params}
              onUpdate={updateParams}
              activeTool={activeTool}
              viewMode={viewMode}
              metalPreset={metalPreset}
              finishPreset={finishPreset}
              onViewModeChange={setViewMode}
              onMetalChange={setMetalPreset}
              onFinishChange={setFinishPreset}
              waxMarks={waxMarks}
              onClearWaxMarks={clearWaxMarks}
              stampSettings={stampSettings}
              onStampSettingsChange={setStampSettings}
              castabilityReport={castabilityReport}
              inlays={inlays}
              onAddInlay={addInlayChannel}
              onRemoveInlay={removeInlayChannel}
              onClearInlays={clearInlays}
              lunarTexture={lunarTexture}
              onLunarChange={setLunarTexture}
              onApplyLunarPreset={applyLunarPreset}
              onRandomizeLunar={randomizeLunar}
              engraving={engraving}
              onEngravingChange={setEngraving}
              onApplyTemplate={applyTemplate}
              lighting={lighting}
              onLightingChange={setLighting}
              balanceAnalysis={balanceAnalysis}
              onAutoBalance={autoBalance}
              onSave={handleSave}
              onExport={handleExport}
              onForgeNow={handleForgeNow}
              isSaving={isSaving}
            />
          )}

          {/* Desktop guided mode toggle — bottom-left overlay */}
          {!isMobile && !guidedMode && (
            <div className="absolute bottom-3 left-3 z-10">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGuidedMode(true)}
                className="bg-card/80 backdrop-blur-sm border-border/50 text-xs gap-1.5"
              >
                <Wand2 className="w-3.5 h-3.5" /> Guided Mode
              </Button>
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="w-80 builder-sidebar flex-shrink-0 overflow-hidden">
            {panelContent}
          </div>
        )}
      </div>

      {!embed && !isMobile && (
        <div className="px-4 py-1.5 border-t border-builder-divider bg-builder-topbar text-[10px] text-muted-foreground text-center">
          Orbit: drag · Zoom: scroll · Select a tool and click to apply
        </div>
      )}

      <ForgeCinematicModal
        open={forgeModalOpen}
        onClose={() => setForgeModalOpen(false)}
        pipelineState={pipelineState}
        setStage={setStage}
        nextStage={nextStage}
        prevStage={prevStage}
        previews={livePreviews}
        metalPreset={metalPreset}
        finishPreset={finishPreset}
        viewMode={viewMode}
        castabilityReport={castabilityReport}
        craftActions={craftActions}
        hasInlays={inlays.length > 0}
        onSave={() => { setForgeModalOpen(false); handleSave(); }}
        onSendToGalaxiForge={() => { setForgeModalOpen(false); handleExport(); }}
      />

      <RenderGalleryModal
        open={renderGalleryOpen}
        onClose={() => setRenderGalleryOpen(false)}
        viewportRef={viewportRef}
        viewMode={viewMode}
        metalPreset={metalPreset}
        finishPreset={finishPreset}
        params={params}
      />
    </div>
  );
}

export default function Builder() {
  return (
    <AccessGate minTier="free" featureLabel="the ring builder">
      <BuilderInner />
    </AccessGate>
  );
}
