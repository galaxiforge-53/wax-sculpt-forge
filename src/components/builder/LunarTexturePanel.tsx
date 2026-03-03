import { LunarTextureState, CraterDensity, CraterSize, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Shuffle } from "lucide-react";

interface LunarTexturePanelProps {
  state: LunarTextureState;
  onChange: (state: LunarTextureState) => void;
}

export default function LunarTexturePanel({ state, onChange }: LunarTexturePanelProps) {
  const patch = (p: Partial<LunarTextureState>) => onChange({ ...state, ...p });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display flex items-center gap-1.5">
          <Moon className="w-3 h-3" />
          Lunar Texture
        </h3>
        <Switch
          checked={state.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>

      {state.enabled && (
        <div className="space-y-3 pt-1">
          {/* Intensity */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Intensity: {state.intensity}%</Label>
            <Slider
              value={[state.intensity]}
              onValueChange={([v]) => patch({ intensity: v })}
              min={0}
              max={100}
              step={1}
            />
          </div>

          {/* Crater density */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Crater Density</Label>
            <Select value={state.craterDensity} onValueChange={(v) => patch({ craterDensity: v as CraterDensity })}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="med">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Crater size */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Crater Size</Label>
            <Select value={state.craterSize} onValueChange={(v) => patch({ craterSize: v as CraterSize })}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="med">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Smooth edges */}
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Smooth Edges</Label>
            <Switch
              checked={state.smoothEdges}
              onCheckedChange={(v) => patch({ smoothEdges: v })}
            />
          </div>

          {/* Seed */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Seed: {state.seed}</Label>
            <div className="flex gap-1.5">
              <Slider
                value={[state.seed]}
                onValueChange={([v]) => patch({ seed: v })}
                min={0}
                max={9999}
                step={1}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => patch({ seed: Math.floor(Math.random() * 9999) })}
              >
                <Shuffle className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
