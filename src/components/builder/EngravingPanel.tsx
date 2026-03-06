import { EngravingState, EngravingFont, ENGRAVING_FONTS } from "@/types/engraving";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EngravingPanelProps {
  state: EngravingState;
  onChange: (state: EngravingState) => void;
}

export default function EngravingPanel({ state, onChange }: EngravingPanelProps) {
  const update = (patch: Partial<EngravingState>) => onChange({ ...state, ...patch });

  return (
    <div className="flex flex-col gap-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-secondary-foreground">Interior Engraving</Label>
        <Switch checked={state.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>

      {state.enabled && (
        <>
          {/* Text input */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Engraving Text</Label>
            <Input
              value={state.text}
              onChange={(e) => update({ text: e.target.value.slice(0, 60) })}
              placeholder="e.g. Forever Yours · 2025"
              className="bg-secondary border-border text-xs h-8"
              maxLength={60}
            />
            <p className="text-[10px] text-muted-foreground">{state.text.length}/60 characters</p>
          </div>

          {/* Font style */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Font Style</Label>
            <Select value={state.font} onValueChange={(v) => update({ font: v as EngravingFont })}>
              <SelectTrigger className="bg-secondary border-border h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGRAVING_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <div className="flex flex-col">
                      <span>{f.label}</span>
                      <span className="text-[10px] text-muted-foreground">{f.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Size: {state.sizeMm.toFixed(1)}mm</Label>
            <Slider
              value={[state.sizeMm]}
              onValueChange={([v]) => update({ sizeMm: v })}
              min={0.5}
              max={3.0}
              step={0.1}
            />
          </div>

          {/* Letter spacing */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Spacing: {state.spacingMm.toFixed(2)}mm</Label>
            <Slider
              value={[state.spacingMm]}
              onValueChange={([v]) => update({ spacingMm: v })}
              min={0}
              max={1.0}
              step={0.02}
            />
          </div>

          {/* Depth */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Depth: {state.depthMm.toFixed(1)}mm</Label>
            <Slider
              value={[state.depthMm]}
              onValueChange={([v]) => update({ depthMm: v })}
              min={0.1}
              max={0.5}
              step={0.05}
            />
            {state.depthMm > 0.35 && (
              <p className="text-[10px] text-amber-400">⚠ Deep engraving may weaken thin bands</p>
            )}
          </div>

          {/* Preview hint */}
          {state.text && (
            <div className="p-2 rounded bg-secondary border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Preview (use Inside camera view)</p>
              <p
                className="text-sm text-foreground truncate"
                style={{
                  fontFamily: state.font === "serif" ? "Georgia, serif"
                    : state.font === "script" ? "cursive"
                    : state.font === "mono" ? "monospace"
                    : "sans-serif",
                  letterSpacing: `${state.spacingMm * 2}px`,
                }}
              >
                {state.text}
              </p>
            </div>
          )}

          {/* Manufacturing note */}
          <p className="text-[10px] text-muted-foreground italic">
            Engraving depth of {state.depthMm.toFixed(1)}mm is suitable for wax printing and investment casting.
          </p>
        </>
      )}
    </div>
  );
}
