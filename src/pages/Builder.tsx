import { useNavigate } from "react-router-dom";
import { useRingDesign } from "@/hooks/useRingDesign";
import { useEffect, useRef, useState } from "react";
import RingViewport, { RingViewportHandle, SnapshotAngle } from "@/components/builder/RingViewport";
import ToolRail from "@/components/builder/ToolRail";
import BuilderSidebar from "@/components/builder/BuilderSidebar";
import TopBar from "@/components/builder/TopBar";
import ForgeCinematicModal from "@/components/forge/ForgeCinematicModal";
import { isEmbedMode } from "@/config/galaxiforge";
import { getTemplate } from "@/config/templates";
import { DesignPreview, ViewMode } from "@/types/ring";
import { getProject, saveProject } from "@/lib/projectsStore";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings2, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Builder() {
  const navigate = useNavigate();
  const viewportRef = useRef<RingViewportHandle>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = useState(false);
  const [forgeModalOpen, setForgeModalOpen] = useState(false);
  const [livePreviews, setLivePreviews] = useState<DesignPreview[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<SnapshotAngle | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);

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
  } = useRingDesign();

  const embed = isEmbedMode();

  // Load template or saved project on mount
  useEffect(() => {
    const templateId = sessionStorage.getItem("applyTemplate");
    if (templateId) {
      sessionStorage.removeItem("applyTemplate");
      const t = getTemplate(templateId);
      if (t) applyTemplate(t.params);
      return;
    }

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
        id = `PRJ-${Date.now().toString(36).toUpperCase()}`;
      }

      const anglePrev = previews.find((p) => p.id === "angle");
      const thumbnail = anglePrev?.dataUrl ?? previews[0]?.dataUrl;
      const now = new Date().toISOString();
      saveProject({
        id: id!, name: name!,
        createdAt: currentProjectId ? (getProject(currentProjectId)?.createdAt ?? now) : now,
        updatedAt: now, designPackage: pkg, thumbnail,
      });

      setCurrentProjectId(id!);
      setCurrentProjectName(name!);
      toast({ title: "Saved to My Designs", description: `"${name}" saved successfully.` });
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
    />
  );

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

          {/* Measurement toggle — top-right */}
          <button
            onClick={() => setShowMeasurements((v) => !v)}
            className={`absolute top-2 right-2 z-10 px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all
              ${showMeasurements || activeTool === "measure"
                ? "bg-primary/30 text-primary border border-primary/40"
                : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
              }`}
            title="Toggle dimension guides"
          >
            📐 Dims
          </button>

          {/* Mobile floating buttons */}
          {isMobile && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              {/* Tool selector as horizontal strip */}
              <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-1 flex gap-0.5 overflow-x-auto max-w-[65%]">
                <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} onApplyTool={applyTool} />
              </div>

              {/* Panel toggle */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMobilePanel(true)}
                className="h-10 w-10 rounded-full bg-card/90 backdrop-blur-sm border-border shadow-lg"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="w-80 border-l border-border flex-shrink-0 overflow-hidden">
            {sidebarContent}
          </div>
        )}

        {/* Mobile bottom sheet */}
        {isMobile && (
          <Sheet open={mobilePanel} onOpenChange={setMobilePanel}>
            <SheetContent side="bottom" className="h-[75vh] p-0 rounded-t-2xl">
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle className="text-sm font-display tracking-wider">Controls</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-hidden h-[calc(75vh-60px)]">
                {sidebarContent}
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
