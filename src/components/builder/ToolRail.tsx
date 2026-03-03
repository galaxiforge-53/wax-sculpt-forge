import { ToolType } from "@/types/ring";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolRailProps {
  activeTool: ToolType | null;
  onSelectTool: (tool: ToolType) => void;
  onApplyTool: (tool: ToolType) => void;
}

const TOOLS: { id: ToolType; name: string; icon: string; tip: string }[] = [
  { id: "carve", name: "Carve", icon: "⚒", tip: "Subtract material — reduces thickness" },
  { id: "smooth", name: "Smooth", icon: "✋", tip: "Polish & soften edges" },
  { id: "bevel", name: "Bevel", icon: "◇", tip: "Round off hard edges" },
  { id: "groove", name: "Groove", icon: "═", tip: "Cut channels into the band" },
  { id: "flatten", name: "Flatten", icon: "▬", tip: "Create flat profile" },
  { id: "measure", name: "Measure", icon: "📐", tip: "View exact dimensions" },
  { id: "stamp", name: "Stamp", icon: "⊙", tip: "Add wax tool marks by clicking the ring (wax mode)" },
];

export default function ToolRail({ activeTool, onSelectTool, onApplyTool }: ToolRailProps) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-card rounded-lg border border-border">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1 font-display">
        Tools
      </span>
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onSelectTool(tool.id);
                  if (tool.id !== "measure" && tool.id !== "stamp") onApplyTool(tool.id);
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-primary/20 text-primary ember-glow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span className="text-lg">{tool.icon}</span>
                <span className="text-[10px] font-medium">{tool.name}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
              {tool.tip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
