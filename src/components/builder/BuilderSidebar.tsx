import { RingParameters, ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { CastabilityReport } from "@/types/castability";
import { ForgePipelineState } from "@/types/pipeline";
import { StampSettings } from "@/hooks/useRingDesign";
import { ToolType } from "@/types/ring";
import PropertiesPanel from "./PropertiesPanel";
import CastabilityPanel from "./CastabilityPanel";
import ForgePipelinePanel from "./ForgePipelinePanel";
import InlaysPanel from "./InlaysPanel";
import LunarTexturePanel from "./LunarTexturePanel";
import EngravingPanel from "./EngravingPanel";
import TemplatesPanel from "./TemplatesPanel";
import AIAssistantPanel from "./AIAssistantPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface BuilderSidebarProps {
  params: RingParameters;
  onUpdate: (updates: Partial<RingParameters>) => void;
  activeTool: ToolType | null;
  viewMode: ViewMode;
  waxMarks: WaxMark[];
  onClearWaxMarks: () => void;
  stampSettings: StampSettings;
  onStampSettingsChange: (s: StampSettings) => void;
  castabilityReport: CastabilityReport;
  pipelineState: ForgePipelineState;
  onNext: () => void;
  onPrev: () => void;
  inlays: InlayChannel[];
  onAddInlay: (input: Omit<InlayChannel, "id" | "createdAt">) => void;
  onRemoveInlay: (id: string) => void;
  onClearInlays: () => void;
  lunarTexture: LunarTextureState;
  onLunarChange: (state: LunarTextureState) => void;
  onApplyLunarPreset: (state: LunarTextureState, presetName: string) => void;
  onRandomizeLunar: (state: LunarTextureState) => void;
  onApplyTemplate: (params: Partial<RingParameters>) => void;
  engraving: EngravingState;
  onEngravingChange: (state: EngravingState) => void;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  onViewModeChange: (mode: ViewMode) => void;
  onMetalChange: (metal: MetalPreset) => void;
  onFinishChange: (finish: FinishPreset) => void;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border last:border-b-0">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors group">
        <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-display group-hover:text-foreground transition-colors">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 animate-in slide-in-from-top-1 duration-200">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function BuilderSidebar({
  params, onUpdate, activeTool, viewMode,
  waxMarks, onClearWaxMarks, stampSettings, onStampSettingsChange,
  castabilityReport, pipelineState, onNext, onPrev,
  inlays, onAddInlay, onRemoveInlay, onClearInlays,
  lunarTexture, onLunarChange, onApplyLunarPreset, onRandomizeLunar,
  onApplyTemplate,
  engraving, onEngravingChange,
  metalPreset, finishPreset,
  onViewModeChange, onMetalChange, onFinishChange,
}: BuilderSidebarProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        <Section title="Properties" defaultOpen={true}>
          <PropertiesPanel
            params={params}
            onUpdate={onUpdate}
            showMeasure={activeTool === "measure"}
            viewMode={viewMode}
            waxMarkCount={waxMarks.length}
            onClearWaxMarks={onClearWaxMarks}
            stampSettings={stampSettings}
            onStampSettingsChange={onStampSettingsChange}
          />
        </Section>

        <Section title="AI Assistant" defaultOpen={true}>
          <AIAssistantPanel
            params={params}
            lunarTexture={lunarTexture}
            viewMode={viewMode}
            metalPreset={metalPreset}
            finishPreset={finishPreset}
            onUpdateParams={onUpdate}
            onLunarChange={onLunarChange}
            onViewModeChange={onViewModeChange}
            onMetalChange={onMetalChange}
            onFinishChange={onFinishChange}
          />
        </Section>

        <Section title="Castability" defaultOpen={true}>
          <CastabilityPanel report={castabilityReport} />
        </Section>

        <Section title="Forge Pipeline">
          <ForgePipelinePanel pipelineState={pipelineState} onNext={onNext} onPrev={onPrev} />
        </Section>

        <Section title="Inlays">
          <InlaysPanel inlays={inlays} onAdd={onAddInlay} onRemove={onRemoveInlay} onClear={onClearInlays} />
        </Section>

        <Section title="Lunar Texture">
          <LunarTexturePanel state={lunarTexture} onChange={onLunarChange} onApplyPreset={onApplyLunarPreset} onRandomize={onRandomizeLunar} />
        </Section>

        <Section title="Engraving">
          <EngravingPanel state={engraving} onChange={onEngravingChange} />
        </Section>

        <Section title="Templates">
          <TemplatesPanel
            onApply={onApplyTemplate}
            currentParams={params}
            onLunarChange={onLunarChange}
            onEngravingChange={onEngravingChange}
            onMetalChange={onMetalChange}
            onFinishChange={onFinishChange}
          />
        </Section>
      </div>
    </ScrollArea>
  );
}
