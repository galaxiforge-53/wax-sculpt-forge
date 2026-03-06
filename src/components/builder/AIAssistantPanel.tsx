import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { RingParameters, ViewMode, MetalPreset, FinishPreset } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  adjustments?: Record<string, unknown>;
}

interface AIAssistantPanelProps {
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

const SUGGESTIONS = [
  "Create a dramatic lunar crater ring",
  "Make this ring more lunar",
  "Increase crater density",
  "Make the surface rougher",
  "Show me in gold",
  "Design an ancient weathered band",
  "Make it look bold and volcanic",
];

export default function AIAssistantPanel({
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
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build context message
      const contextMsg = `Current ring state: width=${params.width}mm, thickness=${params.thickness}mm, profile=${params.profile}, grooves=${params.grooveCount}, lunarEnabled=${lunarTexture.enabled}, lunarIntensity=${lunarTexture.intensity}, craterDensity=${lunarTexture.craterDensity}, viewMode=${viewMode}, metal=${metalPreset}, finish=${finishPreset}. User request: ${text.trim()}`;

      const { data, error } = await supabase.functions.invoke("design-assistant", {
        body: {
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: contextMsg },
          ],
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const { explanation, adjustments } = data;

      // Apply adjustments
      if (adjustments && Object.keys(adjustments).length > 0) {
        applyAdjustments(adjustments);
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: explanation || "Done!",
        adjustments,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ ${errorMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Bot className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
          AI Assistant
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-[140px] max-h-[280px] overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              Describe what you want and I'll adjust your ring design automatically.
            </p>
            <div className="flex flex-wrap gap-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[9px] px-2 py-1 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "text-[11px] leading-relaxed rounded-lg px-2.5 py-1.5",
                msg.role === "user"
                  ? "bg-primary/10 text-foreground ml-4"
                  : "bg-secondary/50 text-muted-foreground mr-4"
              )}
            >
              {msg.role === "assistant" && (
                <Sparkles className="w-2.5 h-2.5 text-primary inline mr-1 -mt-0.5" />
              )}
              {msg.content}
              {msg.adjustments && Object.keys(msg.adjustments).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(msg.adjustments).map(([k, v]) => (
                    <span
                      key={k}
                      className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    >
                      {k.replace("lunar_", "🌙 ")} <ArrowRight className="w-2 h-2" /> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 px-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-1.5">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Make it more lunar…"
          className="min-h-[32px] max-h-[64px] text-[11px] resize-none py-1.5 px-2"
          rows={1}
          disabled={isLoading}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
