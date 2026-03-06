import { RingParameters, ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { CastabilityReport } from "@/types/castability";
import { BalanceAnalysis } from "@/lib/surfaceBalancer";
import { ForgePipelineState } from "@/types/pipeline";
import { StampSettings } from "@/hooks/useRingDesign";
import { ToolType } from "@/types/ring";
import { LightingSettings } from "@/types/lighting";
import PropertiesPanel from "./PropertiesPanel";
import CastabilityPanel from "./CastabilityPanel";
import ForgePipelinePanel from "./ForgePipelinePanel";
import InlaysPanel from "./InlaysPanel";
import LunarTexturePanel from "./LunarTexturePanel";
import EngravingPanel from "./EngravingPanel";
import TemplatesPanel from "./TemplatesPanel";
import AIAssistantPanel from "./AIAssistantPanel";
import LightingStudioPanel from "./LightingStudioPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAccess } from "@/hooks/useAccess";
import { useNavigate } from "react-router-dom";

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
  lighting: LightingSettings;
  onLightingChange: (settings: LightingSettings) => void;
  balanceAnalysis?: BalanceAnalysis;
  onAutoBalance?: () => void;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  premium?: boolean;
}

function Section({ title, defaultOpen = false, children, premium }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border last:border-b-0">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors group">
        <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-display group-hover:text-foreground transition-colors flex items-center gap-1.5">
          {title}
          {premium && <Sparkles className="w-3 h-3 text-primary/60" />}
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

function PremiumLock() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary/70" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Premium feature — enter a premium access code to unlock
      </p>
      <button
        onClick={() => navigate("/access")}
        className="text-[10px] text-primary hover:underline font-medium"
      >
        Enter Access Code →
      </button>
    </div>
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
  lighting, onLightingChange,
  balanceAnalysis, onAutoBalance,
}: BuilderSidebarProps) {
  const { isPremium } = useAccess();

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

        <Section title="AI Assistant" defaultOpen={true} premium={!isPremium}>
          {isPremium ? (
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
          ) : (
            <PremiumLock />
          )}
        </Section>

        <Section title="Castability" defaultOpen={true}>
          <CastabilityPanel report={castabilityReport} balanceAnalysis={balanceAnalysis} onAutoBalance={onAutoBalance} />
        </Section>

        <Section title="Forge Pipeline">
          <ForgePipelinePanel pipelineState={pipelineState} onNext={onNext} onPrev={onPrev} />
        </Section>

        <Section title="Inlays">
          <InlaysPanel inlays={inlays} onAdd={onAddInlay} onRemove={onRemoveInlay} onClear={onClearInlays} />
        </Section>

        <Section title="Lunar Texture" premium={!isPremium}>
          {isPremium ? (
            <LunarTexturePanel state={lunarTexture} onChange={onLunarChange} onApplyPreset={onApplyLunarPreset} onRandomize={onRandomizeLunar} />
          ) : (
            <PremiumLock />
          )}
        </Section>

        <Section title="Engraving" premium={!isPremium}>
          {isPremium ? (
            <EngravingPanel state={engraving} onChange={onEngravingChange} />
          ) : (
            <PremiumLock />
          )}
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

        <Section title="Lighting Studio" defaultOpen={false}>
          <LightingStudioPanel settings={lighting} onChange={onLightingChange} />
        </Section>
      </div>
    </ScrollArea>
  );
}
