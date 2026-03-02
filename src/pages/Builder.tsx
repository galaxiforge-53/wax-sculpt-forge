import { useNavigate, useSearchParams } from "react-router-dom";
import { useRingDesign } from "@/hooks/useRingDesign";
import { useEffect } from "react";
import RingViewport from "@/components/builder/RingViewport";
import ToolRail from "@/components/builder/ToolRail";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import CastabilityPanel from "@/components/builder/CastabilityPanel";
import TemplatesPanel from "@/components/builder/TemplatesPanel";
import TopBar from "@/components/builder/TopBar";
import { isEmbedMode } from "@/config/galaxiforge";
import { getTemplate } from "@/config/templates";

export default function Builder() {
  const navigate = useNavigate();
  const {
    params, updateParams, applyTemplate,
    viewMode, setViewMode,
    metalPreset, setMetalPreset,
    finishPreset, setFinishPreset,
    activeTool, setActiveTool, applyTool,
    undo, redo, canUndo, canRedo,
    generateDesignPackage,
    castabilityReport,
  } = useRingDesign();

  const embed = isEmbedMode();

  // Apply template from sessionStorage if navigated from /templates
  useEffect(() => {
    const templateId = sessionStorage.getItem("applyTemplate");
    if (templateId) {
      sessionStorage.removeItem("applyTemplate");
      const t = getTemplate(templateId);
      if (t) applyTemplate(t.params);
    }
  }, []);

  const handleExport = () => {
    const pkg = generateDesignPackage();
    sessionStorage.setItem("designPackage", JSON.stringify(pkg));
    navigate("/export" + (embed ? "?embed=1" : ""));
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
      />

      <div className="flex flex-1 min-h-0">
        {/* Left Tool Rail */}
        <div className="w-20 p-2 border-r border-border flex-shrink-0">
          <ToolRail
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onApplyTool={applyTool}
          />
        </div>

        {/* 3D Viewport */}
        <div className="flex-1 p-2">
          <RingViewport
            params={params}
            viewMode={viewMode}
            metalPreset={metalPreset}
          />
        </div>

        {/* Right panel: Properties + Templates */}
        <div className="w-72 flex flex-col border-l border-border flex-shrink-0">
          <div className="flex-1 p-3 overflow-y-auto">
            <PropertiesPanel
              params={params}
              onUpdate={updateParams}
              showMeasure={activeTool === "measure"}
            />
          </div>
          <div className="border-t border-border p-3">
            <CastabilityPanel report={castabilityReport} />
          </div>
          <div className="border-t border-border p-3 h-[35%] overflow-hidden">
            <TemplatesPanel
              onApply={applyTemplate}
              currentParams={params}
            />
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      {!embed && (
        <div className="px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground text-center">
          Orbit: drag · Zoom: scroll · Select a tool and click to apply
        </div>
      )}
    </div>
  );
}
