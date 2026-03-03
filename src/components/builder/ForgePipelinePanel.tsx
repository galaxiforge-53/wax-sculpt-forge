import { ForgePipelineState } from "@/types/pipeline";
import { STAGES } from "@/config/pipeline";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ForgePipelinePanelProps {
  pipelineState: ForgePipelineState;
  onNext: () => void;
  onPrev: () => void;
}

export default function ForgePipelinePanel({
  pipelineState,
  onNext,
  onPrev,
}: ForgePipelinePanelProps) {
  const currentIndex = STAGES.findIndex(
    (s) => s.id === pipelineState.currentStage
  );
  const stage = STAGES[currentIndex];

  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-lg border border-border">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display">
        Forge Stage
      </h3>

      {/* Mini progress dots */}
      <div className="flex items-center gap-1.5 justify-center">
        {STAGES.map((s, i) => (
          <div
            key={s.id}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === currentIndex
                ? "bg-primary"
                : i < currentIndex
                ? "bg-primary/40"
                : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Current stage info */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{stage.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {stage.description}
        </p>
      </div>

      {/* Prev / Next */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="gap-1 text-xs"
        >
          <ChevronLeft className="h-3 w-3" />
          Prev
        </Button>
        <span className="text-[10px] text-muted-foreground font-mono">
          {currentIndex + 1}/{STAGES.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={currentIndex === STAGES.length - 1}
          className="gap-1 text-xs"
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground/60 text-center italic">
        The real-world casting journey — animations coming soon.
      </p>
    </div>
  );
}
