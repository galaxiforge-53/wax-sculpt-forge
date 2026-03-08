import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, ChevronUp, Check, X, AlertTriangle, Sparkles, Shield } from "lucide-react";
import { RingParameters } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { EngravingState } from "@/types/engraving";
import { CastabilityReport } from "@/types/castability";
import { computeEnhancements, EnhancementResult } from "@/lib/designEnhancer";

interface Suggestion {
  id: string;
  icon: "sparkles" | "shield" | "alert";
  label: string;
  detail: string;
  category: "visual" | "structural" | "comfort";
  apply: () => void;
}

interface SmartSuggestionsProps {
  params: RingParameters;
  lunarTexture: LunarTextureState;
  engraving: EngravingState;
  castabilityReport: CastabilityReport;
  onUpdateParams: (updates: Partial<RingParameters>) => void;
  onLunarChange: (state: LunarTextureState) => void;
  onEngravingChange: (state: EngravingState) => void;
}

const ICON_MAP = {
  sparkles: Sparkles,
  shield: Shield,
  alert: AlertTriangle,
};

const CATEGORY_COLORS = {
  visual: "text-primary",
  structural: "text-warning",
  comfort: "text-emerald-400",
};

export default function SmartSuggestions({
  params,
  lunarTexture,
  engraving,
  castabilityReport,
  onUpdateParams,
  onLunarChange,
  onEngravingChange,
}: SmartSuggestionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const enhancements = useMemo(
    () => computeEnhancements(params, lunarTexture, engraving),
    [params, lunarTexture, engraving]
  );

  const suggestions = useMemo(() => {
    const items: Suggestion[] = [];
    let idx = 0;

    // From enhancement engine — parameter fixes
    if (enhancements.params && Object.keys(enhancements.params).length > 0) {
      for (const [key, value] of Object.entries(enhancements.params)) {
        const summary = enhancements.summary[idx] ?? `Adjust ${key}`;
        const isComfort = key === "comfortFit" || key === "comfortFitDepth";
        const isStructural = key === "thickness" || key === "bevelSize" || key === "grooveDepth";
        items.push({
          id: `param-${key}`,
          icon: isStructural ? "shield" : "sparkles",
          label: summary,
          detail: `${key}: ${(params as Record<string, unknown>)[key]} → ${value}`,
          category: isComfort ? "comfort" : isStructural ? "structural" : "visual",
          apply: () => onUpdateParams({ [key]: value }),
        });
        idx++;
      }
    }

    // From enhancement engine — lunar fixes
    if (enhancements.lunar && Object.keys(enhancements.lunar).length > 0) {
      const lunarSummaries = enhancements.summary.filter((s) => s.toLowerCase().includes("crater") || s.toLowerCase().includes("rim") || s.toLowerCase().includes("erosion") || s.toLowerCase().includes("terrain") || s.toLowerCase().includes("micro") || s.toLowerCase().includes("lunar"));
      items.push({
        id: "lunar-batch",
        icon: "sparkles",
        label: lunarSummaries[0] ?? "Optimize surface texture",
        detail: `${Object.keys(enhancements.lunar).length} texture adjustments`,
        category: "visual",
        apply: () => onLunarChange({ ...lunarTexture, ...enhancements.lunar! }),
      });
    }

    // From enhancement engine — engraving fixes
    if (enhancements.engraving && Object.keys(enhancements.engraving).length > 0) {
      const engSummaries = enhancements.summary.filter((s) => s.toLowerCase().includes("engrav") || s.toLowerCase().includes("letter") || s.toLowerCase().includes("spacing"));
      items.push({
        id: "engraving-batch",
        icon: "sparkles",
        label: engSummaries[0] ?? "Improve engraving readability",
        detail: `${Object.keys(enhancements.engraving).length} engraving adjustments`,
        category: "visual",
        apply: () => onEngravingChange({ ...engraving, ...enhancements.engraving! }),
      });
    }

    // From castability report — structural risks
    for (const check of castabilityReport.checks) {
      if (check.status === "risk" && check.suggestedFix) {
        items.push({
          id: `cast-${check.id}`,
          icon: "alert",
          label: check.detail,
          detail: check.suggestedFix,
          category: "structural",
          apply: () => {
            // Parse suggested fix into param updates where possible
            if (check.id === "wall-thickness" && params.thickness < 1.5) {
              onUpdateParams({ thickness: 1.5 });
            } else if (check.id === "groove-depth") {
              onUpdateParams({ grooveDepth: Math.round(params.thickness * 0.2 * 10) / 10 });
            } else if (check.id === "bevel-ratio") {
              onUpdateParams({ bevelSize: Math.round(params.thickness * 0.3 * 10) / 10 });
            }
          },
        });
      }
    }

    // Proportional suggestion — aspect ratio
    const ar = params.width / params.thickness;
    if (ar > 5 && params.width > 8) {
      items.push({
        id: "aspect-wide",
        icon: "shield",
        label: "Band may feel flimsy — consider adding thickness",
        detail: `Width/thickness ratio is ${ar.toFixed(1)}:1, ideal is ≤4:1`,
        category: "structural",
        apply: () => onUpdateParams({ thickness: Math.round(params.width / 3.5 * 10) / 10 }),
      });
    }

    // Comfort suggestion
    if (!params.comfortFit && params.width >= 8) {
      items.push({
        id: "comfort-wide",
        icon: "sparkles",
        label: "Wide bands benefit from comfort fit",
        detail: `At ${params.width}mm width, comfort fit improves wearability`,
        category: "comfort",
        apply: () => onUpdateParams({ comfortFit: true }),
      });
    }

    return items.filter((s) => !dismissed.has(s.id) && !applied.has(s.id));
  }, [enhancements, castabilityReport, params, lunarTexture, engraving, dismissed, applied]);

  if (suggestions.length === 0) return null;

  const topSuggestion = suggestions[0];
  const remaining = suggestions.slice(1);
  const TopIcon = ICON_MAP[topSuggestion.icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-3 left-3 z-20 w-[280px] max-w-[calc(100vw-24px)]"
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl shadow-black/20 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
        >
          <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground flex-1 text-left">
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
          </span>
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronUp className="w-3 h-3 text-muted-foreground" />}
        </button>

        {/* Top suggestion always visible */}
        <SuggestionRow
          suggestion={topSuggestion}
          onApply={() => {
            topSuggestion.apply();
            setApplied((s) => new Set(s).add(topSuggestion.id));
          }}
          onDismiss={() => setDismissed((s) => new Set(s).add(topSuggestion.id))}
        />

        {/* Expanded list */}
        <AnimatePresence>
          {expanded && remaining.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {remaining.map((s) => (
                <SuggestionRow
                  key={s.id}
                  suggestion={s}
                  onApply={() => {
                    s.apply();
                    setApplied((prev) => new Set(prev).add(s.id));
                  }}
                  onDismiss={() => setDismissed((prev) => new Set(prev).add(s.id))}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SuggestionRow({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: Suggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const Icon = ICON_MAP[suggestion.icon];
  const catColor = CATEGORY_COLORS[suggestion.category];

  return (
    <div className="px-3 py-2 border-t border-border/30 group hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-2">
        <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${catColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-foreground leading-tight">{suggestion.label}</p>
          <p className="text-[9px] text-muted-foreground/60 mt-0.5 truncate">{suggestion.detail}</p>
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onApply}
            className="w-5 h-5 rounded flex items-center justify-center bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
            title="Apply suggestion"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={onDismiss}
            className="w-5 h-5 rounded flex items-center justify-center bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
