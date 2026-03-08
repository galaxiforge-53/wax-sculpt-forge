import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeftRight, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RingParameters, MetalPreset, FinishPreset, ViewMode, formatDimension } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import RingViewport, { RingViewportHandle } from "./RingViewport";
import ViewportErrorBoundary from "./ViewportErrorBoundary";
import { LightingSettings, DEFAULT_LIGHTING } from "@/types/lighting";
import { cn } from "@/lib/utils";

export interface DesignSnapshot {
  id: string;
  label: string;
  capturedAt: string;
  params: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  lunarTexture: LunarTextureState;
  engraving: EngravingState;
  thumbnailUrl?: string;
}

interface CompareViewProps {
  // Current live design
  currentParams: RingParameters;
  currentViewMode: ViewMode;
  currentMetal: MetalPreset;
  currentFinish: FinishPreset;
  currentLunar: LunarTextureState;
  currentEngraving: EngravingState;
  lighting: LightingSettings;
  // Snapshot to compare against
  snapshot: DesignSnapshot;
  // Actions
  onClose: () => void;
}

/** Diff a single value */
function DiffRow({ label, left, right }: { label: string; left: string | number; right: string | number }) {
  const changed = String(left) !== String(right);
  if (!changed) return null;
  return (
    <div className="flex items-center gap-2 text-[9px]">
      <span className="text-muted-foreground/70 w-20 text-right shrink-0">{label}</span>
      <span className="text-destructive/70 line-through">{String(left)}</span>
      <span className="text-primary">→</span>
      <span className="text-primary font-medium">{String(right)}</span>
    </div>
  );
}

export default function CompareView({
  currentParams,
  currentViewMode,
  currentMetal,
  currentFinish,
  currentLunar,
  currentEngraving,
  lighting,
  snapshot,
  onClose,
}: CompareViewProps) {
  const [splitPosition, setSplitPosition] = useState(50);

  // Compute parameter diffs
  const diffs = useMemo(() => {
    const items: { label: string; left: string | number; right: string | number }[] = [];
    const sp = snapshot.params;
    const cp = currentParams;

    if (sp.width !== cp.width) items.push({ label: "Width", left: `${sp.width}mm`, right: `${cp.width}mm` });
    if (sp.thickness !== cp.thickness) items.push({ label: "Thickness", left: `${sp.thickness}mm`, right: `${cp.thickness}mm` });
    if (sp.size !== cp.size) items.push({ label: "Size", left: sp.size, right: cp.size });
    if (sp.profile !== cp.profile) items.push({ label: "Profile", left: sp.profile, right: cp.profile });
    if (sp.comfortFit !== cp.comfortFit) items.push({ label: "Comfort", left: sp.comfortFit ? "Yes" : "No", right: cp.comfortFit ? "Yes" : "No" });
    if (sp.grooveCount !== cp.grooveCount) items.push({ label: "Grooves", left: sp.grooveCount, right: cp.grooveCount });
    if (sp.bevelSize !== cp.bevelSize) items.push({ label: "Bevel", left: `${sp.bevelSize}mm`, right: `${cp.bevelSize}mm` });
    if (snapshot.metalPreset !== currentMetal) items.push({ label: "Metal", left: snapshot.metalPreset, right: currentMetal });
    if (snapshot.finishPreset !== currentFinish) items.push({ label: "Finish", left: snapshot.finishPreset, right: currentFinish });
    if (snapshot.lunarTexture.enabled !== currentLunar.enabled) items.push({ label: "Texture", left: snapshot.lunarTexture.enabled ? "On" : "Off", right: currentLunar.enabled ? "On" : "Off" });
    if (snapshot.lunarTexture.enabled && currentLunar.enabled) {
      if (snapshot.lunarTexture.intensity !== currentLunar.intensity) items.push({ label: "Intensity", left: snapshot.lunarTexture.intensity, right: currentLunar.intensity });
      if (snapshot.lunarTexture.craterDensity !== currentLunar.craterDensity) items.push({ label: "Density", left: snapshot.lunarTexture.craterDensity, right: currentLunar.craterDensity });
    }

    return items;
  }, [snapshot, currentParams, currentMetal, currentFinish, currentLunar]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 bg-background/95 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/80">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-primary" />
          <span className="text-xs font-display text-primary uppercase tracking-wider">Compare Designs</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Split viewport area */}
      <div className="flex-1 flex relative min-h-0">
        {/* Left — Snapshot */}
        <div className="relative" style={{ width: `${splitPosition}%` }}>
          <div className="absolute inset-0">
            <ViewportErrorBoundary>
              <RingViewport
                params={snapshot.params}
                viewMode={snapshot.viewMode}
                metalPreset={snapshot.metalPreset}
                finishPreset={snapshot.finishPreset}
                activeTool={null}
                waxMarks={[]}
                inlays={[]}
                lunarTexture={snapshot.lunarTexture}
                engraving={snapshot.engraving}
                showMeasurements={false}
                cutawayMode="normal"
                cutawayOffset={0}
                lighting={lighting}
                showcaseMode={false}
                inspectionMode={false}
                ringPosition={[0, 0, 0]}
                ringRotation={[0, 0, 0]}
                showPrinterBed={false}
                rotationLocked={false}
                scaleReference="none"
                wearPreview={0}
              />
            </ViewportErrorBoundary>
          </div>
          {/* Label */}
          <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-1.5">
            <p className="text-[10px] font-display text-muted-foreground uppercase tracking-wider">Snapshot</p>
            <p className="text-[11px] font-medium text-foreground">{snapshot.label}</p>
            <p className="text-[8px] text-muted-foreground/50">{new Date(snapshot.capturedAt).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Divider — draggable */}
        <div
          className="w-1 bg-border/60 hover:bg-primary/50 cursor-col-resize relative z-20 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const container = e.currentTarget.parentElement;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const onMove = (ev: MouseEvent) => {
              const pct = ((ev.clientX - rect.left) / rect.width) * 100;
              setSplitPosition(Math.max(20, Math.min(80, pct)));
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-10 bg-card/90 border border-border/60 rounded-md flex items-center justify-center">
            <div className="flex flex-col gap-0.5">
              <div className="w-0.5 h-1.5 bg-muted-foreground/40 rounded-full" />
              <div className="w-0.5 h-1.5 bg-muted-foreground/40 rounded-full" />
              <div className="w-0.5 h-1.5 bg-muted-foreground/40 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right — Current design */}
        <div className="relative flex-1">
          <div className="absolute inset-0">
            <ViewportErrorBoundary>
              <RingViewport
                params={currentParams}
                viewMode={currentViewMode}
                metalPreset={currentMetal}
                finishPreset={currentFinish}
                activeTool={null}
                waxMarks={[]}
                inlays={[]}
                lunarTexture={currentLunar}
                engraving={currentEngraving}
                showMeasurements={false}
                cutawayMode="normal"
                cutawayOffset={0}
                lighting={lighting}
                showcaseMode={false}
                inspectionMode={false}
                ringPosition={[0, 0, 0]}
                ringRotation={[0, 0, 0]}
                showPrinterBed={false}
                rotationLocked={false}
                scaleReference="none"
                wearPreview={0}
              />
            </ViewportErrorBoundary>
          </div>
          {/* Label */}
          <div className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg px-3 py-1.5">
            <p className="text-[10px] font-display text-primary uppercase tracking-wider">Current Design</p>
            <p className="text-[11px] font-medium text-foreground">Live</p>
          </div>
        </div>
      </div>

      {/* Bottom diff panel */}
      {diffs.length > 0 && (
        <div className="border-t border-border/50 bg-card/80 px-4 py-2">
          <p className="text-[9px] font-display text-muted-foreground uppercase tracking-wider mb-1.5">
            {diffs.length} parameter{diffs.length !== 1 ? "s" : ""} changed
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-0.5 max-h-[60px] overflow-y-auto">
            {diffs.map((d) => (
              <DiffRow key={d.label} {...d} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
