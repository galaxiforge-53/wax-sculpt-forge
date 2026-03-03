import { LunarTextureState, CraterDensity, CraterSize } from "@/types/lunar";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Shuffle, Dices, RotateCcw } from "lucide-react";

// ── Presets ───────────────────────────────────────────────────────

interface LunarPreset {
  name: string;
  build: () => LunarTextureState;
}

const newSeed = () => Math.floor(Math.random() * 9999);
const randBetween = (lo: number, hi: number) => Math.round(lo + Math.random() * (hi - lo));

const LUNAR_PRESETS: LunarPreset[] = [
  {
    name: "Moon Craters Classic",
    build: () => ({
      enabled: true, intensity: 55, craterDensity: "med", craterSize: "med",
      microDetail: 40, rimSharpness: 50, overlapIntensity: 25, smoothEdges: true, seed: newSeed(),
    }),
  },
  {
    name: "Heavy Impact",
    build: () => ({
      enabled: true, intensity: 80, craterDensity: "high", craterSize: "large",
      microDetail: 30, rimSharpness: 85, overlapIntensity: 75, smoothEdges: false, seed: newSeed(),
    }),
  },
  {
    name: "Ancient Mare",
    build: () => ({
      enabled: true, intensity: 40, craterDensity: "low", craterSize: "med",
      microDetail: 55, rimSharpness: 20, overlapIntensity: 10, smoothEdges: true, seed: newSeed(),
    }),
  },
  {
    name: "Micro Regolith",
    build: () => ({
      enabled: true, intensity: 60, craterDensity: "low", craterSize: "small",
      microDetail: 90, rimSharpness: 30, overlapIntensity: 15, smoothEdges: true, seed: newSeed(),
    }),
  },
  {
    name: "Rugged Terminator",
    build: () => ({
      enabled: true, intensity: 85, craterDensity: "med", craterSize: "large",
      microDetail: 50, rimSharpness: 95, overlapIntensity: 45, smoothEdges: false, seed: newSeed(),
    }),
  },
  {
    name: "Random Chaos",
    build: () => ({
      enabled: true,
      intensity: randBetween(30, 100),
      craterDensity: (["low", "med", "high"] as const)[Math.floor(Math.random() * 3)],
      craterSize: (["small", "med", "large"] as const)[Math.floor(Math.random() * 3)],
      microDetail: randBetween(10, 100),
      rimSharpness: randBetween(10, 100),
      overlapIntensity: randBetween(0, 100),
      smoothEdges: Math.random() > 0.5,
      seed: newSeed(),
    }),
  },
];

// ── Panel ─────────────────────────────────────────────────────────

interface LunarTexturePanelProps {
  state: LunarTextureState;
  onChange: (state: LunarTextureState) => void;
  onApplyPreset: (state: LunarTextureState, presetName: string) => void;
  onRandomize: (state: LunarTextureState) => void;
}

export default function LunarTexturePanel({ state, onChange, onApplyPreset, onRandomize }: LunarTexturePanelProps) {
  const patch = (p: Partial<LunarTextureState>) => onChange({ ...state, ...p });

  const handlePreset = (name: string) => {
    const preset = LUNAR_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    const next = preset.build();
    onApplyPreset(next, name);
  };

  const handleRandomize = () => {
    const chaos = LUNAR_PRESETS.find((p) => p.name === "Random Chaos")!;
    onRandomize(chaos.build());
  };

  const handleReseed = () => {
    onChange({ ...state, seed: newSeed() });
  };

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
          {/* Presets */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Preset</Label>
            <Select value="" onValueChange={handlePreset}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Apply preset…" />
              </SelectTrigger>
              <SelectContent>
                {LUNAR_PRESETS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick actions */}
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={handleRandomize}>
              <Dices className="w-3 h-3 mr-1" /> Randomize
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={handleReseed}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reseed
            </Button>
          </div>

          {/* Intensity */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Intensity: {state.intensity}%</Label>
            <Slider value={[state.intensity]} onValueChange={([v]) => patch({ intensity: v })} min={0} max={100} step={1} />
          </div>

          {/* Crater density */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Crater Density</Label>
            <Select value={state.craterDensity} onValueChange={(v) => patch({ craterDensity: v as CraterDensity })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="med">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Micro detail */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Micro Detail: {state.microDetail}%</Label>
            <Slider value={[state.microDetail]} onValueChange={([v]) => patch({ microDetail: v })} min={0} max={100} step={1} />
          </div>

          {/* Rim sharpness */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Rim Sharpness: {state.rimSharpness}%</Label>
            <Slider value={[state.rimSharpness]} onValueChange={([v]) => patch({ rimSharpness: v })} min={0} max={100} step={1} />
          </div>

          {/* Overlap intensity */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Overlap: {state.overlapIntensity}%</Label>
            <Slider value={[state.overlapIntensity]} onValueChange={([v]) => patch({ overlapIntensity: v })} min={0} max={100} step={1} />
          </div>

          {/* Smooth edges */}
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Smooth Edges</Label>
            <Switch checked={state.smoothEdges} onCheckedChange={(v) => patch({ smoothEdges: v })} />
          </div>

          {/* Seed */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Seed: {state.seed}</Label>
            <div className="flex gap-1.5">
              <Slider value={[state.seed]} onValueChange={([v]) => patch({ seed: v })} min={0} max={9999} step={1} className="flex-1" />
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={handleReseed}>
                <Shuffle className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
