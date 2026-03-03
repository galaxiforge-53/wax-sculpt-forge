import { useNavigate } from "react-router-dom";
import { useRingDesign } from "@/hooks/useRingDesign";
import { useEffect, useRef, useState } from "react";
import RingViewport, { RingViewportHandle } from "@/components/builder/RingViewport";
import ToolRail from "@/components/builder/ToolRail";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import CastabilityPanel from "@/components/builder/CastabilityPanel";
import ForgePipelinePanel from "@/components/builder/ForgePipelinePanel";
import TemplatesPanel from "@/components/builder/TemplatesPanel";
import TopBar from "@/components/builder/TopBar";
import ForgeCinematicModal from "@/components/forge/ForgeCinematicModal";
import { isEmbedMode } from "@/config/galaxiforge";
import { getTemplate } from "@/config/templates";
import { DesignPreview, ViewMode } from "@/types/ring";
import { getProject, saveProject } from "@/lib/projectsStore";
import { useToast } from "@/hooks/use-toast";

export default function Builder() {
  const navigate = useNavigate();
  const viewportRef = useRef<RingViewportHandle>(null);
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [forgeModalOpen, setForgeModalOpen] = useState(false);
  const [livePreviews, setLivePreviews] = useState<DesignPreview[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

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
    restoreDesign,
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
    const angles = ["front", "angle", "side"] as const;
    const labels: Record<typeof angles[number], string> = {
      front: "Front View", angle: "45° Angle", side: "Side View",
    };
    try {
      const results = await Promise.all(
        angles.map(async (id) => {
          const dataUrl = await viewportRef.current!.captureSnapshot(id, captureMode);
          return { id, label: labels[id], viewMode: captureMode, dataUrl } as DesignPreview;
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
        id: id!,
        name: name!,
        createdAt: currentProjectId ? (getProject(currentProjectId)?.createdAt ?? now) : now,
        updatedAt: now,
        designPackage: pkg,
        thumbnail,
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

      <div className="flex flex-1 min-h-0">
        <div className="w-20 p-2 border-r border-border flex-shrink-0">
          <ToolRail activeTool={activeTool} onSelectTool={setActiveTool} onApplyTool={applyTool} />
        </div>
        <div className="flex-1 p-2">
          <RingViewport ref={viewportRef} params={params} viewMode={viewMode} metalPreset={metalPreset} />
        </div>
        <div className="w-72 flex flex-col border-l border-border flex-shrink-0">
          <div className="flex-1 p-3 overflow-y-auto">
            <PropertiesPanel params={params} onUpdate={updateParams} showMeasure={activeTool === "measure"} />
          </div>
          <div className="border-t border-border p-3">
            <CastabilityPanel report={castabilityReport} />
          </div>
          <div className="border-t border-border p-3">
            <ForgePipelinePanel pipelineState={pipelineState} onNext={nextStage} onPrev={prevStage} />
          </div>
          <div className="border-t border-border p-3 h-[30%] overflow-hidden">
            <TemplatesPanel onApply={applyTemplate} currentParams={params} />
          </div>
        </div>
      </div>

      {!embed && (
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
        onSave={() => { setForgeModalOpen(false); handleSave(); }}
        onSendToGalaxiForge={() => { setForgeModalOpen(false); handleExport(); }}
      />
    </div>
  );
}
