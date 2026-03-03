import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STAGES } from "@/config/pipeline";
import { ForgePipelineState, ForgeStageId } from "@/types/pipeline";
import { DesignPreview, ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { CastabilityReport } from "@/types/castability";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Save,
  Send,
  X,
  Flame,
  Sparkles,
} from "lucide-react";

interface ForgeCinematicModalProps {
  open: boolean;
  onClose: () => void;
  pipelineState: ForgePipelineState;
  setStage: (id: ForgeStageId) => void;
  nextStage: () => void;
  prevStage: () => void;
  previews: DesignPreview[];
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  viewMode: ViewMode;
  castabilityReport: CastabilityReport;
  onSave: () => void;
  onSendToGalaxiForge: () => void;
}

const METAL_LABELS: Record<MetalPreset, string> = {
  silver: "Sterling Silver",
  gold: "24K Gold",
  "rose-gold": "Rose Gold",
  titanium: "Titanium",
  tungsten: "Tungsten Carbide",
};

const FINISH_LABELS: Record<FinishPreset, string> = {
  polished: "Mirror Polish",
  brushed: "Brushed Satin",
  hammered: "Hand Hammered",
  matte: "Matte Velvet",
  satin: "Satin Sheen",
};

// Stage-specific CSS overlay effects
const STAGE_EFFECTS: Record<ForgeStageId, string> = {
  WAX_SCULPT: "",
  MOLD_PREP: "",
  BURNOUT: "forge-fx-burnout",
  POUR: "forge-fx-pour",
  QUENCH: "forge-fx-quench",
  FINISH: "forge-fx-finish",
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export default function ForgeCinematicModal({
  open,
  onClose,
  pipelineState,
  setStage,
  nextStage,
  prevStage,
  previews,
  metalPreset,
  finishPreset,
  castabilityReport,
  onSave,
  onSendToGalaxiForge,
}: ForgeCinematicModalProps) {
  const reducedMotion = useReducedMotion();
  const [autoForging, setAutoForging] = useState(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stageTransition, setStageTransition] = useState(false);

  const currentIndex = STAGES.findIndex((s) => s.id === pipelineState.currentStage);
  const stage = STAGES[currentIndex] ?? STAGES[0];
  const isFinish = stage.id === "FINISH";
  const castStages: ForgeStageId[] = ["POUR", "QUENCH", "FINISH"];
  const showCastPreview = castStages.includes(stage.id);

  const bestPreview = previews.find((p) =>
    showCastPreview ? p.viewMode === "cast" : p.viewMode === "wax"
  ) ?? previews.find((p) => p.id === "angle") ?? previews[0];

  const allPreviews = previews.filter((p) =>
    showCastPreview ? p.viewMode === "cast" : p.viewMode === "wax"
  );

  // Stage transition animation
  const triggerTransition = useCallback(() => {
    if (reducedMotion) return;
    setStageTransition(true);
    setTimeout(() => setStageTransition(false), 600);
  }, [reducedMotion]);

  const handleNext = useCallback(() => {
    if (currentIndex < STAGES.length - 1) {
      triggerTransition();
      nextStage();
    }
  }, [currentIndex, nextStage, triggerTransition]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      triggerTransition();
      prevStage();
    }
  }, [currentIndex, prevStage, triggerTransition]);

  // Auto Forge
  const startAutoForge = useCallback(() => {
    if (reducedMotion) return;
    setAutoForging(true);
    setStage(STAGES[0].id);
    let idx = 0;
    const advance = () => {
      idx++;
      if (idx < STAGES.length) {
        triggerTransition();
        setStage(STAGES[idx].id);
        autoRef.current = setTimeout(advance, 1800);
      } else {
        setAutoForging(false);
      }
    };
    autoRef.current = setTimeout(advance, 1500);
  }, [reducedMotion, setStage, triggerTransition]);

  const stopAutoForge = useCallback(() => {
    setAutoForging(false);
    if (autoRef.current) clearTimeout(autoRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) stopAutoForge();
  }, [open, stopAutoForge]);

  const progressPercent = ((currentIndex + 1) / STAGES.length) * 100;

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-none w-screen h-screen p-0 border-none bg-transparent [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-[hsl(var(--forge-dark))] overflow-hidden flex flex-col">
          {/* Cosmic overlays */}
          <div className="absolute inset-0 cosmic-noise pointer-events-none" />
          <div className="absolute inset-0 starfield pointer-events-none" />

          {/* Ancient etch texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 2px,
                hsl(var(--cosmic-star) / 0.08) 2px,
                hsl(var(--cosmic-star) / 0.08) 3px
              )`,
            }}
          />

          {/* Ember sparks */}
          {!reducedMotion && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: `${1 + Math.random() * 2}px`,
                    height: `${1 + Math.random() * 2}px`,
                    left: `${10 + Math.random() * 80}%`,
                    bottom: `-5%`,
                    background: `hsl(${20 + Math.random() * 20} 95% ${50 + Math.random() * 20}%)`,
                    animation: `forge-spark ${3 + Math.random() * 4}s linear ${Math.random() * 3}s infinite`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          )}

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-primary animate-flicker" />
              <h2 className="font-display text-lg tracking-[0.15em] text-foreground">
                The Forge
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { stopAutoForge(); onClose(); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Molten progress line */}
          <div className="relative z-10 px-6">
            <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
                  "bg-gradient-to-r from-primary via-accent to-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
              {!reducedMotion && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-50 blur-sm"
                  style={{
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, hsl(var(--ember)), hsl(var(--molten)))`,
                  }}
                />
              )}
            </div>
            {/* Stage dots */}
            <div className="flex justify-between mt-2">
              {STAGES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { if (!autoForging) { triggerTransition(); setStage(s.id); } }}
                  className={cn(
                    "flex flex-col items-center gap-1 group transition-all",
                    autoForging && "pointer-events-none"
                  )}
                >
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full border transition-all duration-500",
                      i <= currentIndex
                        ? "bg-primary border-primary shadow-[0_0_8px_hsl(var(--ember)/0.5)]"
                        : "bg-secondary border-border"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-medium tracking-wider transition-colors",
                      i === currentIndex ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main content area */}
          <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8 min-h-0">
            {isFinish && !autoForging ? (
              /* ===== REVEAL SCREEN ===== */
              <div className="flex flex-col items-center gap-6 animate-fade-in max-w-2xl w-full">
                <Sparkles className="h-8 w-8 text-accent animate-float" />
                <h3 className="font-display text-2xl tracking-[0.2em] text-foreground ember-text">
                  Your Ring Revealed
                </h3>

                {/* Big preview */}
                {bestPreview && (
                  <div className="relative w-72 h-72 rounded-xl overflow-hidden border border-border panel-premium">
                    <img
                      src={bestPreview.dataUrl}
                      alt="Final ring"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--forge-dark)/0.6)] to-transparent" />
                  </div>
                )}

                {/* Metal + Finish + Score */}
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs px-3 py-1">
                    {METAL_LABELS[metalPreset]}
                  </Badge>
                  <Badge variant="outline" className="border-accent/40 text-accent text-xs px-3 py-1">
                    {FINISH_LABELS[finishPreset]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-3 py-1 border-border",
                      scoreColor(castabilityReport.score)
                    )}
                  >
                    Castability: {castabilityReport.score}
                  </Badge>
                </div>

                {/* CTAs */}
                <div className="flex items-center gap-3 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSave}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Save className="h-4 w-4 mr-1.5" /> Save Design
                  </Button>
                  <Button
                    size="sm"
                    onClick={onSendToGalaxiForge}
                    className="bg-primary text-primary-foreground hover:bg-primary/80"
                  >
                    <Send className="h-4 w-4 mr-1.5" /> Send to GalaxiForge
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="border-border text-muted-foreground hover:text-foreground"
                  >
                    Back to Builder
                  </Button>
                </div>
              </div>
            ) : (
              /* ===== STAGE VIEW ===== */
              <div
                className={cn(
                  "flex flex-col items-center gap-6 max-w-xl w-full",
                  stageTransition && !reducedMotion ? "animate-fade-in" : ""
                )}
              >
                {/* Stage label */}
                <div className="text-center">
                  <h3 className="font-display text-xl tracking-[0.2em] text-foreground ember-text">
                    {stage.label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    {stage.description}
                  </p>
                </div>

                {/* Preview panel with stage effect overlay */}
                <div className="relative w-56 h-56 rounded-xl overflow-hidden border border-border panel-premium">
                  {bestPreview ? (
                    <img
                      src={bestPreview.dataUrl}
                      alt={`${stage.label} preview`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">
                      💍
                    </div>
                  )}

                  {/* Stage-specific FX overlay */}
                  {!reducedMotion && STAGE_EFFECTS[stage.id] && (
                    <div
                      className={cn(
                        "absolute inset-0 pointer-events-none",
                        STAGE_EFFECTS[stage.id],
                        stageTransition && "forge-fx-active"
                      )}
                    />
                  )}
                </div>

                {/* Mini preview strip */}
                {allPreviews.length > 1 && (
                  <div className="flex gap-2">
                    {allPreviews.map((p) => (
                      <div
                        key={p.id}
                        className="w-14 h-14 rounded-md overflow-hidden border border-border/50 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <img src={p.dataUrl} alt={p.label} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}

                {stage.notes && (
                  <p className="text-xs text-muted-foreground/70 italic text-center max-w-sm">
                    {stage.notes}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="relative z-10 flex items-center justify-center gap-4 px-6 pb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              disabled={currentIndex === 0 || autoForging}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            {!reducedMotion && (
              <Button
                variant="outline"
                size="sm"
                onClick={autoForging ? stopAutoForge : startAutoForge}
                className={cn(
                  "border-border text-muted-foreground hover:text-foreground min-w-[120px]",
                  autoForging && "border-primary text-primary"
                )}
              >
                <Play className={cn("h-4 w-4 mr-1.5", autoForging && "animate-pulse")} />
                {autoForging ? "Stop" : "Auto Forge"}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={currentIndex === STAGES.length - 1 || autoForging}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
