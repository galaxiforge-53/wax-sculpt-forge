import { TEMPLATE_REGISTRY, TemplateMeta } from "@/config/templates";
import { RingParameters } from "@/types/ring";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TemplatesPanelProps {
  onApply: (params: Partial<RingParameters>) => void;
  currentParams: RingParameters;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "mythic", label: "Mythic" },
  { id: "cosmic", label: "Cosmic" },
] as const;

import { useState } from "react";

export default function TemplatesPanel({ onApply, currentParams }: TemplatesPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = activeCategory === "all"
    ? TEMPLATE_REGISTRY
    : TEMPLATE_REGISTRY.filter((t) => t.category === activeCategory);

  const isActive = (t: TemplateMeta) =>
    t.params.profile === currentParams.profile &&
    t.params.width === currentParams.width &&
    t.params.grooveCount === currentParams.grooveCount;

  return (
    <div className="flex flex-col gap-3 h-full">
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display px-1">
        Templates
      </h3>

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
            onClick={() => onApply(template.params)}
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
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {template.description}
            </p>
            <div className="flex gap-2 mt-1.5 text-[9px] text-muted-foreground/70">
              <span>{template.params.width}mm W</span>
              <span>·</span>
              <span>{template.params.profile}</span>
              <span>·</span>
              <span>{template.params.grooveCount}G</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
