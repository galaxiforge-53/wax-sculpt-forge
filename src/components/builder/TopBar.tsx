import { Button } from "@/components/ui/button";
import { ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Undo2, Redo2, Save, Send, Flame } from "lucide-react";
import { isEmbedMode, getReturnUrl } from "@/config/galaxiforge";

interface TopBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  metalPreset: MetalPreset;
  onMetalChange: (m: MetalPreset) => void;
  finishPreset: FinishPreset;
  onFinishChange: (f: FinishPreset) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onForgeNow: () => void;
}

const METALS: { value: MetalPreset; label: string }[] = [
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "rose-gold", label: "Rose Gold" },
  { value: "titanium", label: "Titanium" },
  { value: "tungsten", label: "Tungsten" },
];

const FINISHES: { value: FinishPreset; label: string }[] = [
  { value: "polished", label: "Polished" },
  { value: "brushed", label: "Brushed" },
  { value: "hammered", label: "Hammered" },
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin" },
];

export default function TopBar({
  viewMode, onViewModeChange, metalPreset, onMetalChange,
  finishPreset, onFinishChange, onUndo, onRedo, canUndo, canRedo, onExport, onSave, isSaving, onForgeNow,
}: TopBarProps) {
  const embed = isEmbedMode();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        {!embed && (
          <h1 className="font-display text-sm text-primary mr-4 tracking-[0.15em]">
            Forge<span className="text-foreground">Lab</span>
            <span className="text-[9px] text-muted-foreground ml-2 font-body tracking-normal">Ring Builder</span>
          </h1>
        )}

        {/* Undo / Redo */}
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="text-muted-foreground hover:text-foreground">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="text-muted-foreground hover:text-foreground">
          <Redo2 className="h-4 w-4" />
        </Button>

        {/* Wax / Cast Toggle */}
        <div className="flex items-center bg-secondary rounded-md ml-2">
          <button
            onClick={() => onViewModeChange("wax")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              viewMode === "wax"
                ? "bg-wax-green text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Wax
          </button>
          <button
            onClick={() => onViewModeChange("cast")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              viewMode === "cast"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cast
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Metal & Finish (only in cast mode) */}
        {viewMode === "cast" && (
          <>
            <Select value={metalPreset} onValueChange={(v) => onMetalChange(v as MetalPreset)}>
              <SelectTrigger className="w-28 h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METALS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={finishPreset} onValueChange={(v) => onFinishChange(v as FinishPreset)}>
              <SelectTrigger className="w-28 h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINISHES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onForgeNow}
          className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary animate-ember-pulse"
        >
          <Flame className="h-4 w-4 mr-1" /> Forge Now
        </Button>

        <Button variant="ghost" size="sm" onClick={onSave} disabled={isSaving} className="text-muted-foreground hover:text-foreground">
          <Save className="h-4 w-4 mr-1" /> {isSaving ? "Saving…" : "Save"}
        </Button>

        <Button size="sm" onClick={onExport} className="bg-primary text-primary-foreground hover:bg-ember-glow">
          <Send className="h-4 w-4 mr-1" /> Send to GalaxiForge
        </Button>

        {embed && (
          <a
            href={getReturnUrl()}
            className="text-xs text-muted-foreground hover:text-primary transition-colors ml-2"
          >
            ← Return to GalaxiForge
          </a>
        )}
      </div>
    </div>
  );
}
