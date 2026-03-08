import { Button } from "@/components/ui/button";
import { ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Undo2, Redo2, Save, Send, Flame, MoreVertical, Wand2, Share2 } from "lucide-react";
import { isEmbedMode, getReturnUrl } from "@/config/galaxiforge";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  onEnhance?: () => void;
  isEnhancing?: boolean;
  onShare?: () => void;
  isSharing?: boolean;
}

const METALS: { value: MetalPreset; label: string; gradient: string }[] = [
  { value: "silver", label: "Silver", gradient: "linear-gradient(135deg, hsl(210,8%,82%), hsl(210,5%,65%), hsl(210,10%,88%))" },
  { value: "gold", label: "Gold", gradient: "linear-gradient(135deg, hsl(43,75%,50%), hsl(38,80%,40%), hsl(48,85%,60%))" },
  { value: "rose-gold", label: "Rose Gold", gradient: "linear-gradient(135deg, hsl(10,45%,70%), hsl(5,50%,55%), hsl(15,40%,75%))" },
  { value: "titanium", label: "Titanium", gradient: "linear-gradient(135deg, hsl(215,8%,65%), hsl(220,5%,50%), hsl(210,10%,72%))" },
  { value: "tungsten", label: "Tungsten", gradient: "linear-gradient(135deg, hsl(210,4%,50%), hsl(215,3%,35%), hsl(205,5%,55%))" },
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
  onEnhance, isEnhancing, onShare, isSharing,
}: TopBarProps) {
  const embed = isEmbedMode();
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center justify-between px-2 sm:px-4 py-2 builder-topbar gap-1">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        {!embed && !isMobile && (
          <h1 className="font-display text-sm text-primary mr-2 tracking-[0.15em] whitespace-nowrap">
            Forge<span className="text-foreground">Lab</span>
            <span className="text-[9px] text-muted-foreground ml-2 font-body tracking-normal">Ring Builder</span>
          </h1>
        )}

        {/* Undo / Redo */}
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <Redo2 className="h-4 w-4" />
        </Button>

        {/* Wax / Cast / Print Toggle */}
        <div className="flex items-center bg-secondary rounded-md ml-1">
          <button
            onClick={() => onViewModeChange("wax")}
            className={cn(
              "px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all",
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
              "px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              viewMode === "cast"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cast
          </button>
          <button
            onClick={() => onViewModeChange("wax-print")}
            className={cn(
              "px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              viewMode === "wax-print"
                ? "bg-amber-700 text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Wax printing preparation view"
          >
            Print
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        {/* Metal & Finish (only in cast mode, hidden on mobile) */}
        {viewMode === "cast" && !isMobile && (
          <div className="flex items-center gap-1">
            {METALS.map((m) => (
              <button
                key={m.value}
                onClick={() => onMetalChange(m.value)}
                title={m.label}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border",
                  metalPreset === m.value
                    ? "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/20"
                    : "border-border/40 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-border/20"
                  style={{ background: m.gradient }}
                />
                {m.label}
              </button>
            ))}
            <span className="w-px h-5 bg-border/40 mx-1" />
            <Select value={finishPreset} onValueChange={(v) => onFinishChange(v as FinishPreset)}>
              <SelectTrigger className="w-24 h-7 text-[10px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINISHES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Desktop actions */}
        {!isMobile && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onEnhance}
              disabled={isEnhancing}
              className="border-accent/50 text-accent hover:bg-accent/10 hover:text-accent"
              title="Intelligently optimize your design"
            >
              <Wand2 className="h-4 w-4 mr-1" /> {isEnhancing ? "Enhancing…" : "Enhance Design"}
            </Button>
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
            {onShare && (
              <Button variant="ghost" size="sm" onClick={onShare} disabled={isSharing} className="text-muted-foreground hover:text-foreground">
                <Share2 className="h-4 w-4 mr-1" /> {isSharing ? "Sharing…" : "Share"}
              </Button>
            )}
            <Button size="sm" onClick={onExport} className="bg-primary text-primary-foreground hover:bg-ember-glow">
              <Send className="h-4 w-4 mr-1" /> Send to GalaxiForge
            </Button>
          </>
        )}

        {/* Mobile overflow menu */}
        {isMobile && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onForgeNow}
              className="border-primary/50 text-primary hover:bg-primary/10 h-8 px-2"
            >
              <Flame className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {viewMode === "cast" && (
                  <>
                    <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                      Metal & Finish
                    </DropdownMenuItem>
                    {METALS.map((m) => (
                      <DropdownMenuItem
                        key={m.value}
                        onClick={() => onMetalChange(m.value)}
                        className={cn("text-xs gap-2", metalPreset === m.value && "text-primary font-medium")}
                      >
                        <span className="w-3 h-3 rounded-full flex-shrink-0 border border-border/20" style={{ background: m.gradient }} />
                        {m.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                      Finish
                    </DropdownMenuItem>
                    {FINISHES.map((f) => (
                      <DropdownMenuItem
                        key={f.value}
                        onClick={() => onFinishChange(f.value)}
                        className={cn("text-xs", finishPreset === f.value && "text-primary font-medium")}
                      >
                        {f.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuItem onClick={onEnhance} disabled={isEnhancing} className="text-xs">
                  <Wand2 className="h-3.5 w-3.5 mr-2" /> {isEnhancing ? "Enhancing…" : "Enhance Design"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSave} disabled={isSaving} className="text-xs">
                  <Save className="h-3.5 w-3.5 mr-2" /> {isSaving ? "Saving…" : "Save"}
                </DropdownMenuItem>
                {onShare && (
                  <DropdownMenuItem onClick={onShare} disabled={isSharing} className="text-xs">
                    <Share2 className="h-3.5 w-3.5 mr-2" /> {isSharing ? "Sharing…" : "Share"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onExport} className="text-xs">
                  <Send className="h-3.5 w-3.5 mr-2" /> Send to GalaxiForge
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {embed && (
          <a
            href={getReturnUrl()}
            className="text-xs text-muted-foreground hover:text-primary transition-colors ml-2"
          >
            ← Return
          </a>
        )}
      </div>
    </div>
  );
}
