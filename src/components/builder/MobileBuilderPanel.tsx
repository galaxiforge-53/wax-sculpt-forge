import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RingParameters, ViewMode, MetalPreset, FinishPreset, ToolType } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { CastabilityReport } from "@/types/castability";
import { InlayChannel } from "@/types/inlays";
import { StampSettings } from "@/hooks/useRingDesign";
import { WaxMark } from "@/types/waxmarks";
import { LightingSettings } from "@/types/lighting";
import { BalanceAnalysis } from "@/lib/surfaceBalancer";
import { ScrollArea } from "@/components/ui/scroll-area";
import PropertiesPanel from "./PropertiesPanel";
import LunarTexturePanel from "./LunarTexturePanel";
import EngravingPanel from "./EngravingPanel";
import AIAssistantPanel from "./AIAssistantPanel";
import LightingStudioPanel from "./LightingStudioPanel";
import CastabilityPanel from "./CastabilityPanel";
import InlaysPanel from "./InlaysPanel";
import TemplatesPanel from "./TemplatesPanel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAccess } from "@/hooks/useAccess";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Layers, Moon, PenTool, Palette, Send, Save, Flame,
  ChevronUp, ChevronDown, Lock, Sparkles, Wand2, X,
  GripHorizontal,
} from "lucide-react";

// ── Tab definitions ──────────────────────────────────────────────

type MobileTab = "shape" | "surface" | "engraving" | "materials" | "export";

const TABS: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: "shape", label: "Shape", icon: Layers },
  { id: "surface", label: "Surface", icon: Moon },
  { id: "engraving", label: "Engrave", icon: PenTool },
  { id: "materials", label: "Material", icon: Palette },
  { id: "export", label: "Export", icon: Send },
];

// ── Props ────────────────────────────────────────────────────────

export interface MobileBuilderPanelProps {
  params: RingParameters;
  onUpdate: (updates: Partial<RingParameters>) => void;
  activeTool: ToolType | null;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  onViewModeChange: (mode: ViewMode) => void;
  onMetalChange: (metal: MetalPreset) => void;
  onFinishChange: (finish: FinishPreset) => void;
  waxMarks: WaxMark[];
  onClearWaxMarks: () => void;
  stampSettings: StampSettings;
  onStampSettingsChange: (s: StampSettings) => void;
  castabilityReport: CastabilityReport;
  inlays: InlayChannel[];
  onAddInlay: (input: Omit<InlayChannel, "id" | "createdAt">) => void;
  onRemoveInlay: (id: string) => void;
  onClearInlays: () => void;
  lunarTexture: LunarTextureState;
  onLunarChange: (state: LunarTextureState) => void;
  onApplyLunarPreset: (state: LunarTextureState, presetName: string) => void;
  onRandomizeLunar: (state: LunarTextureState) => void;
  engraving: EngravingState;
  onEngravingChange: (state: EngravingState) => void;
  onApplyTemplate: (params: Partial<RingParameters>) => void;
  lighting: LightingSettings;
  onLightingChange: (settings: LightingSettings) => void;
  balanceAnalysis?: BalanceAnalysis;
  onAutoBalance?: () => void;
  // Actions
  onSave: () => void;
  onExport: () => void;
  onForgeNow: () => void;
  isSaving?: boolean;
}

function PremiumLock() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary/70" />
      </div>
      <p className="text-[11px] text-muted-foreground">Premium feature — enter an access code to unlock</p>
      <button onClick={() => navigate("/access")} className="text-[10px] text-primary hover:underline font-medium">
        Enter Access Code →
      </button>
    </div>
  );
}

// ── Panel heights ────────────────────────────────────────────────

type PanelHeight = "collapsed" | "half" | "full";
const PANEL_HEIGHTS: Record<PanelHeight, string> = {
  collapsed: "h-0",
  half: "h-[40vh]",
  full: "h-[70vh]",
};

// ── Component ────────────────────────────────────────────────────

export default function MobileBuilderPanel(props: MobileBuilderPanelProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("shape");
  const [panelHeight, setPanelHeight] = useState<PanelHeight>("collapsed");
  const { isPremium } = useAccess();

  const togglePanel = (tab: MobileTab) => {
    if (activeTab === tab && panelHeight !== "collapsed") {
      setPanelHeight("collapsed");
    } else {
      setActiveTab(tab);
      setPanelHeight("half");
    }
  };

  const cycleHeight = () => {
    if (panelHeight === "collapsed") setPanelHeight("half");
    else if (panelHeight === "half") setPanelHeight("full");
    else setPanelHeight("collapsed");
  };

  // ── Tab content renderers ──────────────────────────────────────

  const renderShape = () => (
    <div className="space-y-4">
      <PropertiesPanel
        params={props.params}
        onUpdate={props.onUpdate}
        showMeasure={props.activeTool === "measure"}
        viewMode={props.viewMode}
        waxMarkCount={props.waxMarks.length}
        onClearWaxMarks={props.onClearWaxMarks}
        stampSettings={props.stampSettings}
        onStampSettingsChange={props.onStampSettingsChange}
        metalPreset={props.metalPreset}
      />
      <div className="border-t border-border pt-3">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-display">Templates</p>
        <TemplatesPanel
          onApply={props.onApplyTemplate}
          currentParams={props.params}
          onLunarChange={props.onLunarChange}
          onEngravingChange={props.onEngravingChange}
          onMetalChange={props.onMetalChange}
          onFinishChange={props.onFinishChange}
        />
      </div>
    </div>
  );

  const renderSurface = () => (
    <div className="space-y-4">
      {isPremium ? (
        <LunarTexturePanel
          state={props.lunarTexture}
          onChange={props.onLunarChange}
          onApplyPreset={props.onApplyLunarPreset}
          onRandomize={props.onRandomizeLunar}
        />
      ) : (
        <PremiumLock />
      )}
      <div className="border-t border-border pt-3">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-display">Inlays</p>
        <InlaysPanel
          inlays={props.inlays}
          onAdd={props.onAddInlay}
          onRemove={props.onRemoveInlay}
          onClear={props.onClearInlays}
        />
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-display">Castability</p>
        <CastabilityPanel
          report={props.castabilityReport}
          balanceAnalysis={props.balanceAnalysis}
          onAutoBalance={props.onAutoBalance}
        />
      </div>
    </div>
  );

  const renderEngraving = () => (
    <div>
      {isPremium ? (
        <EngravingPanel state={props.engraving} onChange={props.onEngravingChange} />
      ) : (
        <PremiumLock />
      )}
    </div>
  );

  const renderMaterials = () => (
    <div className="space-y-4">
      {/* View mode */}
      <div className="space-y-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-display">View Mode</p>
        <div className="flex gap-1">
          {(["wax", "cast", "wax-print"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => props.onViewModeChange(mode)}
              className={cn(
                "flex-1 py-2 text-xs font-medium rounded-lg transition-all",
                props.viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "wax-print" ? "Print" : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Metal picker */}
      <div className="space-y-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-display">Metal</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["silver", "gold", "rose-gold", "titanium", "tungsten"] as MetalPreset[]).map((m) => {
            const colors: Record<MetalPreset, string> = {
              silver: "bg-gray-300", gold: "bg-yellow-500", "rose-gold": "bg-pink-400",
              titanium: "bg-slate-400", tungsten: "bg-zinc-600",
            };
            return (
              <button
                key={m}
                onClick={() => props.onMetalChange(m)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium transition-all border",
                  props.metalPreset === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("w-3 h-3 rounded-full", colors[m])} />
                {m === "rose-gold" ? "Rose" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Finish picker */}
      <div className="space-y-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-display">Finish</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["polished", "brushed", "hammered", "matte", "satin"] as FinishPreset[]).map((f) => (
            <button
              key={f}
              onClick={() => props.onFinishChange(f)}
              className={cn(
                "px-2 py-2 rounded-lg text-[11px] font-medium transition-all border",
                props.finishPreset === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Lighting */}
      <div className="border-t border-border pt-3">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-display">Lighting</p>
        <LightingStudioPanel settings={props.lighting} onChange={props.onLightingChange} />
      </div>
    </div>
  );

  const renderExport = () => (
    <div className="space-y-3">
      {isPremium ? (
        <AIAssistantPanel
          params={props.params}
          lunarTexture={props.lunarTexture}
          viewMode={props.viewMode}
          metalPreset={props.metalPreset}
          finishPreset={props.finishPreset}
          onUpdateParams={props.onUpdate}
          onLunarChange={props.onLunarChange}
          onViewModeChange={props.onViewModeChange}
          onMetalChange={props.onMetalChange}
          onFinishChange={props.onFinishChange}
        />
      ) : (
        <PremiumLock />
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={props.onSave}
          disabled={props.isSaving}
          className="w-full justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          {props.isSaving ? "Saving…" : "Save Design"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={props.onForgeNow}
          className="w-full justify-center gap-2 border-primary/50 text-primary"
        >
          <Flame className="h-4 w-4" />
          Forge Now
        </Button>
        <Button
          size="sm"
          onClick={props.onExport}
          className="w-full justify-center gap-2 bg-primary text-primary-foreground"
        >
          <Send className="h-4 w-4" />
          Send to Galaxy Forge
        </Button>
      </div>
    </div>
  );

  const contentMap: Record<MobileTab, () => React.ReactNode> = {
    shape: renderShape,
    surface: renderSurface,
    engraving: renderEngraving,
    materials: renderMaterials,
    export: renderExport,
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col pointer-events-none">
      {/* Panel content area */}
      <AnimatePresence>
        {panelHeight !== "collapsed" && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: panelHeight === "half" ? "40vh" : "70vh" }}
            exit={{ height: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="bg-card/95 backdrop-blur-xl border-t border-border overflow-hidden pointer-events-auto"
          >
            {/* Drag handle + close */}
            <div
              className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => {
                const startY = e.clientY;
                const startHeight = panelHeight;
                const onMove = (moveE: PointerEvent) => {
                  const dy = startY - moveE.clientY;
                  if (startHeight === "half" && dy > 60) setPanelHeight("full");
                  else if (startHeight === "half" && dy < -60) setPanelHeight("collapsed");
                  else if (startHeight === "full" && dy < -60) setPanelHeight("half");
                };
                const onUp = () => {
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
            >
              <div className="flex-1 flex justify-center">
                <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-display absolute left-1/2 -translate-x-1/2">
                {TABS.find((t) => t.id === activeTab)?.label}
              </span>
              <button
                onClick={() => setPanelHeight("collapsed")}
                className="p-1 -mr-1 text-muted-foreground hover:text-foreground transition-colors relative z-10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ScrollArea className="h-[calc(100%-36px)]">
              <div className="p-3 pb-8">
                {contentMap[activeTab]()}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar — always visible */}
      <div className="bg-card border-t border-border pointer-events-auto safe-area-bottom">
        <div className="flex items-center">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id && panelHeight !== "collapsed";
            return (
              <button
                key={tab.id}
                onClick={() => togglePanel(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileTabIndicator"
                    className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
