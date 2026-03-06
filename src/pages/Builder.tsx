import { useNavigate } from "react-router-dom";
import { useRingDesign } from "@/hooks/useRingDesign";
import { useEffect, useRef, useState } from "react";
import RingViewport, { RingViewportHandle, SnapshotAngle, CutawayMode } from "@/components/builder/RingViewport";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings2, Eye, RotateCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LightingSettings, DEFAULT_LIGHTING } from "@/types/lighting";

function BuilderInner() {
  const navigate = useNavigate();
  const viewportRef = useRef<RingViewportHandle>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [forgeModalOpen, setForgeModalOpen] = useState(false);
  const [livePreviews, setLivePreviews] = useState<DesignPreview[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<SnapshotAngle | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [cutawayMode, setCutawayMode] = useState<CutawayMode>("normal");
  const [lighting, setLighting] = useState<LightingSettings>(DEFAULT_LIGHTING);
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
    />
  );

  const panelContent = guidedMode ? guidedContent : sidebarContent;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
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
      />

      <div className="flex flex-1 min-h-0 relative">
        {/* Tool rail - compact on mobile */}
        {!isMobile && (
          <div className="w-16 p-1.5 border-r border-border flex-shrink-0">
            <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} onApplyTool={applyTool} />
          </div>
        )}

        {/* Viewport */}
        <div className="flex-1 p-0 sm:p-1 relative">
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
            lighting={lighting}
          />

          {/* Camera preset buttons — top-left overlay */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {CAMERA_BUTTONS.map((cam) => (
              <button
                key={cam.id}
                onClick={() => setCameraPreset(cam.id)}
                className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all
                  ${cameraPreset === cam.id
                    ? "bg-primary/30 text-primary border border-primary/40"
                    : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                  }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* Measurement toggle + Cutaway toggle — top-right */}
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            {/* Cutaway mode buttons */}
            {(["normal", "inside", "cross-section"] as CutawayMode[]).map((mode) => {
              const labels: Record<CutawayMode, string> = {
                "normal": "Full",
                "inside": "Inside",
                "cross-section": "X-Section",
              };
              return (
                <button
                  key={mode}
                  onClick={() => setCutawayMode(mode)}
                  className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all
                    ${cutawayMode === mode
                      ? "bg-primary/30 text-primary border border-primary/40"
                      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                    }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
            <button
              onClick={() => setShowMeasurements((v) => !v)}
              className={`px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all
                ${showMeasurements || activeTool === "measure"
                  ? "bg-primary/30 text-primary border border-primary/40"
                  : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                }`}
              title="Toggle dimension guides"
            >
              📐 Dims
            </button>
          </div>

          {/* Mobile floating buttons */}
          {isMobile && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              {/* Tool selector as horizontal strip */}
              {!guidedMode && (
                <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-1 flex gap-0.5 overflow-x-auto max-w-[55%]">
                  <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} onApplyTool={applyTool} />
                </div>
              )}
              {guidedMode && <div />}

              <div className="flex gap-2">
                {!guidedMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGuidedMode(true)}
                    className="h-10 rounded-full bg-card/90 backdrop-blur-sm border-border shadow-lg px-3"
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    <span className="text-[10px]">Guide</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMobilePanel(true)}
                  className="h-10 w-10 rounded-full bg-card/90 backdrop-blur-sm border-border shadow-lg"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
          <div className="w-80 border-l border-border flex-shrink-0 overflow-hidden">
            {panelContent}
          </div>
        )}

        {/* Mobile bottom sheet */}
        {isMobile && (
          <Sheet open={mobilePanel} onOpenChange={setMobilePanel}>
            <SheetContent side="bottom" className="h-[75vh] p-0 rounded-t-2xl">
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle className="text-sm font-display tracking-wider">
                  {guidedMode ? "Guided Design" : "Controls"}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-hidden h-[calc(75vh-60px)]">
                {panelContent}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {!embed && !isMobile && (
        <div className="px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground text-center">
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
