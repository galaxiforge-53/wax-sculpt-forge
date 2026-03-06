import { TEMPLATE_REGISTRY, TEMPLATE_CATEGORIES, TemplateMeta } from "@/config/templates";
import { RingParameters } from "@/types/ring";
import { LunarTextureState, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { EngravingState, DEFAULT_ENGRAVING } from "@/types/engraving";
import type { MetalPreset, FinishPreset } from "@/types/ring";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TemplatesPanelProps {
  onApply: (params: Partial<RingParameters>) => void;
  currentParams: RingParameters;
  onLunarChange?: (state: LunarTextureState) => void;
  onEngravingChange?: (state: EngravingState) => void;
  onMetalChange?: (metal: MetalPreset) => void;
  onFinishChange?: (finish: FinishPreset) => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  ...TEMPLATE_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
] as const;

export default function TemplatesPanel({
  onApply, currentParams,
  onLunarChange, onEngravingChange, onMetalChange, onFinishChange,
}: TemplatesPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = activeCategory === "all"
    ? TEMPLATE_REGISTRY
    : TEMPLATE_REGISTRY.filter((t) => t.category === activeCategory);

  const isActive = (t: TemplateMeta) =>
    t.params.profile === currentParams.profile &&
    t.params.width === currentParams.width &&
    t.params.grooveCount === currentParams.grooveCount;

  const handleApply = (template: TemplateMeta) => {
    onApply(template.params);

    if (template.lunar && onLunarChange) {
      onLunarChange({
        ...DEFAULT_LUNAR_TEXTURE,
        seed: Math.floor(Math.random() * 9999),
        ...template.lunar,
      });
    }

    if (template.engraving && onEngravingChange) {
      onEngravingChange({ ...DEFAULT_ENGRAVING, ...template.engraving });
    }

    if (template.metalPreset && onMetalChange) {
      onMetalChange(template.metalPreset);
    }

    if (template.finishPreset && onFinishChange) {
      onFinishChange(template.finishPreset);
    }
  };

  const hasExtras = (t: TemplateMeta) =>
    !!t.lunar?.enabled || !!t.engraving?.enabled || !!t.metalPreset || !!t.finishPreset;

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-all",
              activeCategory === cat.id
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
        {filtered.map((template) => (
          <motion.button
            key={template.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleApply(template)}
            className={cn(
              "text-left p-3 rounded-lg border transition-all group",
              isActive(template)
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card/50 hover:border-primary/30 hover:bg-card"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{template.icon}</span>
              <span className="text-xs font-display tracking-wide text-foreground">
                {template.name}
              </span>
              {hasExtras(template) && (
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 ml-auto border-primary/30 text-primary/70">
                  preset
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {template.description}
            </p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[9px] text-muted-foreground/70">{template.params.width}mm W</span>
              <span className="text-[9px] text-muted-foreground/40">·</span>
              <span className="text-[9px] text-muted-foreground/70">{template.params.profile}</span>
              {template.lunar?.enabled && (
                <>
                  <span className="text-[9px] text-muted-foreground/40">·</span>
                  <span className="text-[9px] text-primary/60">🌙 textured</span>
                </>
              )}
              {template.metalPreset && (
                <>
                  <span className="text-[9px] text-muted-foreground/40">·</span>
                  <span className="text-[9px] text-muted-foreground/70">{template.metalPreset}</span>
                </>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
