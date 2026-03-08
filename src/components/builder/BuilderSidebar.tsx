import { RingParameters, ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { WaxMark } from "@/types/waxmarks";
import { InlayChannel } from "@/types/inlays";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { ImageTerrainState } from "@/types/imageTerrain";
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
import ImageTerrainPanel from "./ImageTerrainPanel";
import PresetManager from "./PresetManager";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Lock, Sparkles, Layers, Moon, PenTool, Palette, Send, Flame, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAccess } from "@/hooks/useAccess";
import { useToast } from "@/hooks/use-toast";
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

/* ── Section wrapper with icon ─────────────────────────────────── */

interface SectionProps {
  title: string;
  icon?: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
  premium?: boolean;
}

function Section({ title, icon: Icon, defaultOpen = false, children, premium }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-builder-divider last:border-b-0">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-secondary/30 transition-colors group">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-display group-hover:text-foreground transition-colors flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-foreground/70 transition-colors" />}
          {title}
          {premium && <Sparkles className="w-3 h-3 text-primary/60" />}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 animate-in slide-in-from-top-1 duration-200">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Subsection label ──────────────────────────────────────────── */

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 mt-3 first:mt-0 font-display">
      {children}
    </p>
  );
}

/* ── Premium gate ──────────────────────────────────────────────── */

function PremiumLock() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary/70" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Premium feature — enter an access code to unlock
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

/* ── Metal picker (inline) ─────────────────────────────────────── */

function MetalPicker({ metalPreset, onMetalChange, finishPreset, onFinishChange, viewMode, onViewModeChange }: {
  metalPreset: MetalPreset; onMetalChange: (m: MetalPreset) => void;
  finishPreset: FinishPreset; onFinishChange: (f: FinishPreset) => void;
  viewMode: ViewMode; onViewModeChange: (v: ViewMode) => void;
}) {
  const metals: { id: MetalPreset; label: string; gradient: string; highlight: string }[] = [
    { id: "silver", label: "Silver", gradient: "linear-gradient(135deg, hsl(210,8%,82%), hsl(210,5%,65%), hsl(210,10%,88%))", highlight: "hsl(210,8%,90%)" },
    { id: "gold", label: "Gold", gradient: "linear-gradient(135deg, hsl(43,75%,50%), hsl(38,80%,40%), hsl(48,85%,60%))", highlight: "hsl(43,80%,55%)" },
    { id: "rose-gold", label: "Rose Gold", gradient: "linear-gradient(135deg, hsl(10,45%,70%), hsl(5,50%,55%), hsl(15,40%,75%))", highlight: "hsl(10,50%,65%)" },
    { id: "titanium", label: "Titanium", gradient: "linear-gradient(135deg, hsl(215,8%,65%), hsl(220,5%,50%), hsl(210,10%,72%))", highlight: "hsl(210,5%,60%)" },
    { id: "tungsten", label: "Tungsten", gradient: "linear-gradient(135deg, hsl(210,4%,50%), hsl(215,3%,35%), hsl(205,5%,55%))", highlight: "hsl(210,3%,45%)" },
  ];

  const finishes: FinishPreset[] = ["polished", "brushed", "hammered", "matte", "satin"];

  return (
    <div className="space-y-3">
      {/* View mode */}
      <div>
        <SubLabel>View Mode</SubLabel>
        <div className="flex gap-1">
          {(["wax", "cast", "wax-print"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all",
                viewMode === mode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {mode === "wax-print" ? "Print" : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Metal */}
      <div>
        <SubLabel>Metal</SubLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {metals.map((m) => (
            <button
              key={m.id}
              onClick={() => onMetalChange(m.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border",
                metalPreset === m.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/40 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/20"
              )}
            >
              <div
                className="w-full h-5 rounded-md flex-shrink-0"
                style={{
                  background: m.gradient,
                  boxShadow: metalPreset === m.id ? `0 2px 8px ${m.highlight}40` : "none",
                }}
              />
              <span className={cn(
                "text-[9px] font-medium leading-none",
                metalPreset === m.id ? "text-primary" : "text-muted-foreground"
              )}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Finish */}
      <div>
        <SubLabel>Finish</SubLabel>
        <div className="grid grid-cols-3 gap-1">
          {finishes.map((f) => (
            <button
              key={f}
              onClick={() => onFinishChange(f)}
              className={cn(
                "px-2 py-1.5 rounded-md text-[10px] font-medium transition-all border",
                finishPreset === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main sidebar ──────────────────────────────────────────────── */

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
  const { toast } = useToast();

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">

        {/* ═══ 1. RING SHAPE ═══ */}
        <Section title="Ring Shape" icon={Layers} defaultOpen={true}>
          <PropertiesPanel
            params={params}
            onUpdate={onUpdate}
            showMeasure={activeTool === "measure"}
            viewMode={viewMode}
            waxMarkCount={waxMarks.length}
            onClearWaxMarks={onClearWaxMarks}
            stampSettings={stampSettings}
            onStampSettingsChange={onStampSettingsChange}
            metalPreset={metalPreset}
          />
          <div className="border-t border-border/40 mt-3 pt-3">
            <SubLabel>Templates</SubLabel>
            <TemplatesPanel
              onApply={onApplyTemplate}
              currentParams={params}
              onLunarChange={onLunarChange}
              onEngravingChange={onEngravingChange}
              onMetalChange={onMetalChange}
              onFinishChange={onFinishChange}
            />
          </div>
          <div className="border-t border-border/40 mt-3 pt-3">
            <SubLabel>My Presets</SubLabel>
            <PresetManager
              params={params}
              lunarTexture={lunarTexture}
              onApplyDimensions={onUpdate}
              onApplyLunar={onLunarChange}
            />
          </div>
        </Section>

        {/* ═══ 2. SURFACE & TEXTURE ═══ */}
        <Section title="Surface & Texture" icon={Moon} premium={!isPremium}>
          {isPremium ? (
            <>
              <LunarTexturePanel
                state={lunarTexture}
                onChange={onLunarChange}
                onApplyPreset={onApplyLunarPreset}
                onRandomize={onRandomizeLunar}
                ringThickness={params.thickness}
                onEnhanceSummary={(summary) => {
                  toast({
                    title: "✨ Surface Enhanced",
                    description: summary.slice(0, 3).join(" · "),
                  });
                }}
              />
              <div className="border-t border-border/40 mt-3 pt-3">
                <SubLabel>Inlays</SubLabel>
                <InlaysPanel inlays={inlays} onAdd={onAddInlay} onRemove={onRemoveInlay} onClear={onClearInlays} />
              </div>
            </>
          ) : (
            <PremiumLock />
          )}
        </Section>

        {/* ═══ 3. ENGRAVING ═══ */}
        <Section title="Engraving" icon={PenTool} premium={!isPremium}>
          {isPremium ? (
            <EngravingPanel state={engraving} onChange={onEngravingChange} />
          ) : (
            <PremiumLock />
          )}
        </Section>

        {/* ═══ 4. MATERIALS & LIGHTING ═══ */}
        <Section title="Materials" icon={Palette} defaultOpen={false}>
          <MetalPicker
            metalPreset={metalPreset}
            onMetalChange={onMetalChange}
            finishPreset={finishPreset}
            onFinishChange={onFinishChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
          <div className="border-t border-border/40 mt-3 pt-3">
            <SubLabel>Lighting Studio</SubLabel>
            <LightingStudioPanel settings={lighting} onChange={onLightingChange} />
          </div>
        </Section>

        {/* ═══ 5. PRODUCTION ═══ */}
        <Section title="Production" icon={Flame} defaultOpen={false}>
          <CastabilityPanel report={castabilityReport} balanceAnalysis={balanceAnalysis} onAutoBalance={onAutoBalance} />
          <div className="border-t border-border/40 mt-3 pt-3">
            <SubLabel>Forge Pipeline</SubLabel>
            <ForgePipelinePanel pipelineState={pipelineState} onNext={onNext} onPrev={onPrev} />
          </div>
        </Section>

        {/* ═══ 6. AI ASSISTANT ═══ */}
        <Section title="AI Assistant" icon={Sparkles} defaultOpen={false} premium={!isPremium}>
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
      </div>
    </ScrollArea>
  );
}
