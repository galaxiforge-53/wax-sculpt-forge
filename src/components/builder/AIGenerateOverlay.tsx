import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, X, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { RingParameters, ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AIGenerateOverlayProps {
  params: RingParameters;
  lunarTexture: LunarTextureState;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  onUpdateParams: (updates: Partial<RingParameters>) => void;
  onLunarChange: (state: LunarTextureState) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onMetalChange: (metal: MetalPreset) => void;
  onFinishChange: (finish: FinishPreset) => void;
}

const GENERATE_PROMPTS = [
  "Create a dramatic lunar crater ring with deep impacts",
  "Design a sleek minimal titanium band",
  "Build an ancient weathered gold ring",
  "Make a bold volcanic ring with heavy texture",
  "Create a delicate rose gold ring with subtle craters",
  "Design a rugged industrial tungsten band with grooves",
];

export default function AIGenerateOverlay({
  params,
  lunarTexture,
  viewMode,
  metalPreset,
  finishPreset,
  onUpdateParams,
  onLunarChange,
  onViewModeChange,
  onMetalChange,
  onFinishChange,
}: AIGenerateOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const applyAdjustments = (adjustments: Record<string, unknown>) => {
    const ringUpdates: Partial<RingParameters> = {};
    const lunarUpdates: Partial<LunarTextureState> = {};

    for (const [key, value] of Object.entries(adjustments)) {
      if (key.startsWith("lunar_")) {
        const lunarKey = key.replace("lunar_", "") as keyof LunarTextureState;
        (lunarUpdates as Record<string, unknown>)[lunarKey] = value;
      } else if (key === "viewMode") {
        onViewModeChange(value as ViewMode);
      } else if (key === "metalPreset") {
        onMetalChange(value as MetalPreset);
      } else if (key === "finishPreset") {
        onFinishChange(value as FinishPreset);
      } else if (key in params) {
        (ringUpdates as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(ringUpdates).length > 0) {
      onUpdateParams(ringUpdates);
    }
    if (Object.keys(lunarUpdates).length > 0) {
      onLunarChange({ ...lunarTexture, ...lunarUpdates });
    }
  };

  const generate = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    setIsGenerating(true);
    setResult(null);

    try {
      const contextMsg = `GENERATION MODE — Create a complete ring design from this concept: "${text.trim()}"

Current ring state for reference: width=${params.width}mm, thickness=${params.thickness}mm, profile=${params.profile}, grooves=${params.grooveCount}, lunarEnabled=${lunarTexture.enabled}, viewMode=${viewMode}, metal=${metalPreset}, finish=${finishPreset}.

Set ALL relevant parameters to bring this concept to life. Be creative and bold.`;

      const { data, error } = await supabase.functions.invoke("design-assistant", {
        body: {
          messages: [{ role: "user", content: contextMsg }],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { explanation, adjustments } = data;

      if (adjustments && Object.keys(adjustments).length > 0) {
        applyAdjustments(adjustments);
      }

      setResult(explanation || "Ring generated!");
      toast({
        title: "✨ Ring Generated",
        description: explanation || "Your AI-designed ring is ready.",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      setResult(`⚠️ ${errorMsg}`);
      toast({
        title: "Generation Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate(prompt);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "px-2.5 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1",
          "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
        )}
        title="Generate a ring design from a text prompt using AI"
      >
        <Wand2 className="w-3 h-3" /> AI Generate
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isGenerating) setIsOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display tracking-wide text-foreground">AI Ring Generator</h3>
                    <p className="text-[10px] text-muted-foreground">Describe your dream ring and AI will create it</p>
                  </div>
                </div>
                <button
                  onClick={() => !isGenerating && setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Prompt input */}
              <form onSubmit={handleSubmit} className="px-5 pb-3">
                <div className="relative">
                  <input
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Create a dramatic lunar crater ring with deep impacts..."
                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                    disabled={isGenerating}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!prompt.trim() || isGenerating}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-lg"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </form>

              {/* Quick prompts */}
              {!isGenerating && !result && (
                <div className="px-5 pb-4">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-display">
                    Try a prompt
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {GENERATE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setPrompt(p);
                          generate(p);
                        }}
                        className="text-[10px] px-2.5 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all leading-tight"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isGenerating && (
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-3 py-4">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground font-medium">Generating your ring…</p>
                      <p className="text-[10px] text-muted-foreground">AI is crafting the perfect design</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {result && !isGenerating && (
                <div className="px-5 pb-5">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs text-foreground/90 leading-relaxed">{result}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setResult(null);
                        setPrompt("");
                        inputRef.current?.focus();
                      }}
                    >
                      Generate Another
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setIsOpen(false)}
                    >
                      Keep This Design
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
